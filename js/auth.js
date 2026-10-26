/**
 * GESTION DE L'AUTHENTIFICATION ET DES SESSIONS - GESTION PRÉSCOLAIRE
 * - Session persistante jusqu'à déconnexion explicite (redémarrage, rechargement, PWA)
 * - Renouvellement automatique du jeton (Supabase Auth)
 * - Résilience réseau totale : ne déconnecte JAMAIS en cas de coupure (mode hors-ligne)
 * - Synchronisation multi-onglets de la déconnexion
 * - Protection stricte des routes (app.html <-> index.html)
 *
 * SÉCURITÉ
 * - Les mots de passe ne sont JAMAIS stockés en clair : empreinte PBKDF2-SHA256 salée
 *   (310 000 itérations, sel aléatoire de 128 bits) via l'API WebCrypto du navigateur.
 * - Les anciens mots de passe en clair sont convertis automatiquement en empreinte au démarrage.
 * - Blocage progressif après plusieurs échecs de connexion (persistant entre les rechargements).
 * - Connexion Google uniquement via le fournisseur OAuth officiel (Supabase), jamais simulée.
 */

const Auth = {
  client: null,
  session: null,
  userProfile: null,
  school: null,
  isOffline: !navigator.onLine,
  STORAGE_SESSION_KEY: 'gp_active_session_v1',
  STORAGE_USERS_REGISTRY: 'gp_registered_schools_v1', // Registre d'isolation multi-écoles pour persistance locale
  STORAGE_LOGIN_GUARD: 'gp_login_guard_v1',
  PBKDF2_ITERATIONS: 310000,
  MIN_PASSWORD_LENGTH: 8,
  MAX_FAILED_ATTEMPTS: 5,
  _initPromise: null,

  /**
   * Initialise le client Supabase et restaure la session active (une seule fois par page)
   */
  init() {
    if (!this._initPromise) {
      this._initPromise = this._doInit();
    }
    return this._initPromise;
  },

  async _doInit() {
    // 1. Initialisation Supabase Client si disponible
    if (window.supabase && CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
      try {
        this.client = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: window.localStorage
          }
        });

        // Écoute des changements d'état d'authentification
        this.client.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_OUT') {
            this.handleLocalSignOut(false);
          } else if (event === 'PASSWORD_RECOVERY') {
            // L'utilisateur arrive depuis le lien « Mot de passe oublié » reçu par e-mail
            setTimeout(() => this.openPasswordRecoveryDialog(session), 0);
          } else if (session) {
            this.session = this.session || {};
            this.session.supabaseSession = session;
          }
        });
      } catch (err) {
        console.warn('[Auth] Erreur initialisation Supabase client:', err);
      }
    }

    // 2. Suppression immédiate de tout mot de passe resté en clair dans le stockage local
    try {
      await this.migratePlaintextPasswords();
    } catch (e) {
      console.warn('[Auth] Migration des mots de passe impossible:', e);
    }

    // 3. Écouteurs de connectivité réseau (ne jamais déconnecter, informer avec bandeau)
    this.initNetworkListeners();

    // 4. Écouteur inter-onglets pour synchroniser la déconnexion
    window.addEventListener('storage', (e) => {
      if (e.key === this.STORAGE_SESSION_KEY && !e.newValue) {
        // Un autre onglet s'est déconnecté
        if (window.location.pathname.includes('app')) {
          window.location.replace('index.html');
        }
      }
    });

    // 5. Restauration de la session locale persistée
    await this.restoreSession();

    return this.isAuthenticated();
  },

  // ----------------------------------------------------------------------------
  // CRYPTOGRAPHIE DES MOTS DE PASSE (PBKDF2-SHA256 via WebCrypto)
  // ----------------------------------------------------------------------------

  _hexToBytes(hex) {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  },

  _bytesToHex(bytes) {
    return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Calcule l'empreinte PBKDF2 d'un mot de passe
   * @returns {Promise<{pwdHash:string, pwdSalt:string, pwdIter:number, pwdAlgo:string}>}
   */
  async hashPassword(password, saltHex = null, iterations = null) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error("Votre navigateur ne permet pas de sécuriser le mot de passe. Ouvrez l'application en HTTPS ou mettez à jour votre navigateur.");
    }
    const iter = iterations || this.PBKDF2_ITERATIONS;
    const salt = saltHex ? this._hexToBytes(saltHex) : window.crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw', new TextEncoder().encode(String(password)), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await window.crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, keyMaterial, 256
    );
    return {
      pwdHash: this._bytesToHex(bits),
      pwdSalt: this._bytesToHex(salt),
      pwdIter: iter,
      pwdAlgo: 'PBKDF2-SHA256'
    };
  },

  /**
   * Comparaison à temps constant (évite les attaques par mesure de temps)
   */
  _safeEqual(a, b) {
    const sa = String(a || '');
    const sb = String(b || '');
    let diff = sa.length ^ sb.length;
    const len = Math.max(sa.length, sb.length);
    for (let i = 0; i < len; i++) {
      diff |= (sa.charCodeAt(i) || 0) ^ (sb.charCodeAt(i) || 0);
    }
    return diff === 0;
  },

  /**
   * Vérifie un mot de passe contre une entrée du registre local
   */
  async verifyPassword(password, entry) {
    if (!entry) return false;
    if (entry.pwdHash && entry.pwdSalt) {
      const computed = await this.hashPassword(password, entry.pwdSalt, entry.pwdIter || this.PBKDF2_ITERATIONS);
      return this._safeEqual(computed.pwdHash, entry.pwdHash);
    }
    if (typeof entry.password === 'string' && entry.password) {
      // Ancien format (en clair) : vérifié une dernière fois puis converti
      return this._safeEqual(entry.password, String(password));
    }
    return false;
  },

  /**
   * Enregistre l'empreinte d'un mot de passe sur une entrée du registre (supprime le clair)
   */
  async setEntryPassword(entry, password) {
    const hashed = await this.hashPassword(password);
    Object.assign(entry, hashed);
    delete entry.password;
    return entry;
  },

  /**
   * Convertit en empreintes tous les mots de passe stockés en clair par les anciennes versions
   */
  async migratePlaintextPasswords() {
    const registry = this.getSchoolsRegistry();
    let changed = false;
    for (const entry of registry) {
      if (typeof entry.password === 'string' && entry.password) {
        await this.setEntryPassword(entry, entry.password);
        changed = true;
      } else if ('password' in entry) {
        delete entry.password;
        changed = true;
      }
    }
    if (changed) this.saveSchoolsRegistry(registry);
  },

  /**
   * Règles de robustesse du mot de passe (8 caractères minimum, au moins une lettre et un chiffre)
   */
  validatePasswordStrength(password) {
    const pwd = String(password || '');
    if (pwd.length < this.MIN_PASSWORD_LENGTH) {
      throw new Error(`Le mot de passe doit comporter au moins ${this.MIN_PASSWORD_LENGTH} caractères.`);
    }
    if (pwd.length > 128) {
      throw new Error("Le mot de passe est trop long (128 caractères maximum).");
    }
    if (!/[A-Za-zÀ-ÿ]/.test(pwd) || !/\d/.test(pwd)) {
      throw new Error("Le mot de passe doit contenir au moins une lettre et un chiffre.");
    }
    return true;
  },

  _cleanEmail(email) {
    return String(email || '').trim().toLowerCase().slice(0, 254);
  },

  _isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  },

  // ----------------------------------------------------------------------------
  // PROTECTION ANTI-FORCE BRUTE (persistante, par adresse e-mail)
  // ----------------------------------------------------------------------------
  _readGuard() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_LOGIN_GUARD) || '{}') || {};
    } catch (e) {
      return {};
    }
  },

  _writeGuard(guard) {
    try {
      localStorage.setItem(this.STORAGE_LOGIN_GUARD, JSON.stringify(guard));
    } catch (e) {}
  },

  /**
   * Lève une erreur si l'adresse est temporairement bloquée
   */
  checkLoginGuard(email) {
    const guard = this._readGuard();
    const entry = guard[email];
    if (entry && entry.lockUntil && Date.now() < entry.lockUntil) {
      const seconds = Math.ceil((entry.lockUntil - Date.now()) / 1000);
      const wait = seconds >= 60 ? `${Math.ceil(seconds / 60)} minute(s)` : `${seconds} seconde(s)`;
      throw new Error(`Trop de tentatives infructueuses. Réessayez dans ${wait}.`);
    }
  },

  /**
   * Enregistre un échec ; au-delà de 5 échecs, blocage de 30 s doublé à chaque nouvel échec (15 min max)
   */
  recordLoginFailure(email) {
    const guard = this._readGuard();
    const entry = guard[email] || { fails: 0, lockUntil: 0 };
    entry.fails += 1;
    if (entry.fails >= this.MAX_FAILED_ATTEMPTS) {
      const extra = entry.fails - this.MAX_FAILED_ATTEMPTS;
      const delay = Math.min(30000 * Math.pow(2, extra), 15 * 60 * 1000);
      entry.lockUntil = Date.now() + delay;
    }
    guard[email] = entry;
    this._writeGuard(guard);
  },

  clearLoginGuard(email) {
    const guard = this._readGuard();
    if (guard[email]) {
      delete guard[email];
      this._writeGuard(guard);
    }
  },

  /**
   * Écouteurs de connectivité en ligne / hors-ligne
   */
  initNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOffline = false;
      this.updateOfflineBanner(false);
    });

    window.addEventListener('offline', () => {
      this.isOffline = true;
      this.updateOfflineBanner(true);
    });

    // Mise à jour initiale du bandeau si hors-ligne
    if (!navigator.onLine) {
      this.updateOfflineBanner(true);
    }
  },

  /**
   * Affiche ou masque le bandeau "Hors ligne" sans bloquer l'accès
   */
  updateOfflineBanner(show) {
    let banner = document.getElementById('gpOfflineBanner');
    if (show) {
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'gpOfflineBanner';
        banner.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 99999;
          background: #D97706;
          color: #FFFFFF;
          font-family: var(--font-sans, sans-serif);
          font-size: 13px;
          font-weight: 700;
          text-align: center;
          padding: 8px 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        banner.innerHTML = `
          <span>📡</span>
          <span>Connexion réseau interrompue — Mode hors ligne actif. Vos données restent accessibles.</span>
        `;
        document.body.appendChild(banner);
      } else {
        banner.style.display = 'flex';
      }
    } else {
      if (banner) {
        banner.style.display = 'none';
      }
    }
  },

  /**
   * Restaure la session depuis le stockage local persistant
   */
  async restoreSession() {
    try {
      const raw = localStorage.getItem(this.STORAGE_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.user && typeof parsed.user === 'object') {
          this.session = parsed;
          this.userProfile = parsed.user;
          this.school = parsed.school || null;
        }
      }
    } catch (e) {
      console.warn('[Auth] Erreur lecture session locale:', e);
    }

    // Si Supabase est connecté et qu'on a le réseau, vérifier le token en arrière-plan sans bloquer le rendu
    if (this.client && navigator.onLine) {
      const checkRemoteSession = async () => {
        try {
          const { data: { session }, error } = await this.client.auth.getSession();
          if (session && session.user) {
            this.session = this.session || {};
            this.session.supabaseSession = session;

            if (!this.userProfile || this.userProfile.isDemo) {
              const userMeta = session.user.user_metadata || {};
              this.userProfile = {
                id: session.user.id,
                name: userMeta.full_name || userMeta.name || (session.user.email || '').split('@')[0],
                email: session.user.email,
                role: 'director',
                isGoogle: !!(session.user.app_metadata && session.user.app_metadata.provider === 'google'),
                avatarUrl: userMeta.avatar_url || null
              };
              this.school = null;
            }

            // Synchronise l'école si besoin
            if (!this.school || this.school.isDemo) {
              await this.loadRemoteUserProfile(session.user.id);
            }
            // Sauvegarde en ligne disponible (ex. lien de confirmation ouvert sur un nouvel appareil)
            if ((!this.school || this.school.isDemo) && window.CloudSync) {
              try {
                const restored = await CloudSync.restoreAfterLogin(null);
                if (restored) {
                  this.school = restored;
                  this.userProfile.school_id = restored.id;
                }
              } catch (e) {}
            }
            this.saveActiveSession();
          } else if (error) {
            console.warn('[Auth] Token Supabase non valide:', error.message);
          }
        } catch (e) {
          console.warn('[Auth] Vérification distante impossible (hors-ligne ou réseau):', e);
        }
      };

      // Si nous avons déjà une session locale valide, exécuter la vérification distante en tâche de fond (0 délai d'affichage)
      if (this.session && this.userProfile && !this.userProfile.isDemo) {
        checkRemoteSession();
      } else {
        // Sinon, attendre avec un timeout strict de 1.5 seconde maximum pour ne jamais figer l'écran
        await Promise.race([
          checkRemoteSession(),
          new Promise((resolve) => setTimeout(resolve, 1500))
        ]);
      }
    }
  },

  /**
   * Vérifie si un utilisateur est actuellement authentifié
   */
  isAuthenticated() {
    return !!(this.session && this.userProfile);
  },

  /**
   * Vérifie si l'utilisateur connecté a déjà configuré / référencé son école
   */
  hasSchool() {
    return !!(this.school && this.school.id && this.school.name && !this.school.isDemo && this.school.id !== '11111111-1111-1111-1111-111111111111');
  },

  /**
   * Récupère l'utilisateur actuellement connecté
   */
  getUser() {
    return this.userProfile;
  },

  /**
   * Récupère l'école de l'utilisateur actuellement connecté
   */
  getSchool() {
    return this.school;
  },

  /**
   * URL de retour après confirmation d'e-mail / OAuth / réinitialisation
   */
  _appUrl(page = 'app.html') {
    const basePath = window.location.pathname.replace(/[^/]*$/, '');
    return `${window.location.origin}${basePath}${page}`;
  },

  /**
   * Inscription d'un nouvel utilisateur (Nom + E-mail + Mot de passe)
   */
  async signUpUser({ fullName, email, password }) {
    const cleanName = String(fullName || '').trim().slice(0, 120);
    const cleanEmail = this._cleanEmail(email);
    const cleanPassword = String(password || '');

    if (!cleanName) {
      throw new Error("Veuillez saisir votre nom complet.");
    }
    if (!this._isValidEmail(cleanEmail)) {
      throw new Error("Veuillez saisir une adresse e-mail valide.");
    }
    this.validatePasswordStrength(cleanPassword);

    const registry = this.getSchoolsRegistry();
    const existing = registry.find(r => (r.email || '').toLowerCase() === cleanEmail);
    if (existing && (existing.pwdHash || existing.password)) {
      throw new Error("Un compte existe déjà avec cette adresse e-mail. Veuillez vous connecter.");
    }

    const userId = existing ? existing.directorId : Utils.randomId('usr');

    // Par défaut, l'utilisateur entre dans l'espace démo complète pour découvrir toutes les fonctionnalités
    this.school = existing && existing.school ? existing.school : null;

    this.userProfile = {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      role: 'director',
      school_id: this.school ? this.school.id : null
    };

    // Tentative Supabase SignUp si en ligne (un e-mail de confirmation est envoyé par Supabase)
    if (this.client && navigator.onLine) {
      try {
        const { error } = await this.client.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: { full_name: cleanName },
            emailRedirectTo: this._appUrl('index.html')
          }
        });
        if (error) console.warn('[Auth] SignUp Supabase:', error.message);
      } catch (err) {
        console.warn('[Auth] SignUp Supabase:', err);
      }
    }

    // Sauvegarde dans le registre multi-écoles (empreinte du mot de passe uniquement)
    let entry = existing;
    if (entry) {
      entry.name = cleanName;
      if (!entry.school) entry.school = this.school;
    } else {
      entry = {
        email: cleanEmail,
        name: cleanName,
        directorId: userId,
        school: this.school
      };
      registry.push(entry);
    }
    await this.setEntryPassword(entry, cleanPassword);
    this.saveSchoolsRegistry(registry);
    this.saveActiveSession();

    return { user: this.userProfile, school: this.school };
  },

  /**
   * Connexion avec Google : uniquement via le fournisseur OAuth officiel configuré dans Supabase.
   * Si le fournisseur n'est pas activé, l'utilisateur est invité à utiliser e-mail + mot de passe.
   */
  async signInWithGoogle() {
    const notice = (msg) => this.showAuthNotice(msg);
    if (!this.client || !navigator.onLine) {
      notice("La connexion avec Google nécessite une connexion Internet. Vous pouvez aussi utiliser votre e-mail et votre mot de passe.");
      return;
    }
    try {
      const enabled = await this.isGoogleProviderEnabled();
      if (!enabled) {
        notice("La connexion avec Google n'est pas encore activée sur cette plateforme. Utilisez votre adresse e-mail et votre mot de passe.");
        return;
      }
      const { error } = await this.client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: this._appUrl('app.html') }
      });
      if (error) throw error;
    } catch (err) {
      console.warn('[Auth] Google OAuth:', err);
      notice("Connexion Google impossible pour le moment. Utilisez votre adresse e-mail et votre mot de passe.");
    }
  },

  /**
   * Interroge la configuration publique de Supabase pour savoir si Google est activé
   */
  async isGoogleProviderEnabled() {
    try {
      const res = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/settings`, {
        headers: { apikey: CONFIG.SUPABASE_ANON_KEY }
      });
      if (!res.ok) return false;
      const settings = await res.json();
      return !!(settings && settings.external && settings.external.google);
    } catch (e) {
      return false;
    }
  },

  /**
   * Affiche un message d'information dans la fenêtre de connexion/inscription ouverte
   */
  showAuthNotice(message) {
    const boxes = ['loginErrorBox', 'registerErrorBox']
      .map(id => document.getElementById(id))
      .filter(el => el && el.closest('.modal-backdrop.is-open'));
    if (boxes.length > 0) {
      boxes[0].textContent = message;
      boxes[0].style.display = 'block';
    } else {
      alert(message);
    }
  },

  /**
   * Connexion avec E-mail et Mot de passe
   */
  async signIn(email, password) {
    const cleanEmail = this._cleanEmail(email);
    const cleanPassword = String(password || '');
    const genericError = "E-mail ou mot de passe incorrect. Si vous n'avez pas encore de compte, cliquez sur « S'inscrire ».";

    if (!this._isValidEmail(cleanEmail)) {
      throw new Error("Veuillez saisir une adresse e-mail valide.");
    }
    if (!cleanPassword) {
      throw new Error("Veuillez saisir votre mot de passe.");
    }

    // 0. Blocage temporaire après trop d'échecs
    this.checkLoginGuard(cleanEmail);

    const registry = this.getSchoolsRegistry();
    const found = registry.find(s => (s.email || '').toLowerCase() === cleanEmail);
    let remoteErrorMessage = null;

    // 1. Tentative Supabase Auth si en ligne
    if (this.client && navigator.onLine) {
      try {
        const { data, error } = await this.client.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword
        });

        if (!error && data && data.user) {
          this.school = null;
          this.userProfile = null;
          await this.loadRemoteUserProfile(data.user.id);

          // L'école déjà présente sur cet appareil reste prioritaire
          const localSchool = found && found.school && !found.school.isDemo ? found.school : null;
          if (localSchool) {
            this.school = localSchool;
          }

          // Nouvel appareil ou version plus récente en ligne : restauration de la sauvegarde
          if (window.CloudSync) {
            try {
              const restored = await Promise.race([
                CloudSync.restoreAfterLogin(localSchool ? localSchool.id : null),
                new Promise(resolve => setTimeout(() => resolve(null), 10000))
              ]);
              if (restored) this.school = restored;
            } catch (e) {
              console.warn('[Auth] Restauration en ligne impossible:', e);
            }
          }

          const meta = data.user.user_metadata || {};
          this.userProfile = {
            ...(this.userProfile || {}),
            id: data.user.id,
            name: (this.userProfile && this.userProfile.name) || (found && found.name) || meta.full_name || cleanEmail.split('@')[0],
            email: cleanEmail,
            role: (this.userProfile && this.userProfile.role) || 'director',
            school_id: this.school ? this.school.id : null,
            phone: (found && found.phone) || (this.school ? this.school.director_phone : '')
          };

          // Mémorise le compte et l'empreinte localement pour permettre la connexion hors-ligne
          let entry = found;
          if (!entry) {
            entry = { email: cleanEmail, name: this.userProfile.name, directorId: data.user.id, school: this.school };
            registry.push(entry);
          } else if (this.school && (!entry.school || entry.school.id === this.school.id)) {
            entry.school = this.school;
          }
          entry.supabaseUserId = data.user.id;
          await this.setEntryPassword(entry, cleanPassword);
          this.saveSchoolsRegistry(registry);

          this.clearLoginGuard(cleanEmail);
          this.saveActiveSession();
          return { user: this.userProfile, school: this.school };
        } else if (error) {
          remoteErrorMessage = error.message || '';
          console.warn('[Auth] Échec Supabase Auth:', error.message);
        }
      } catch (err) {
        console.warn('[Auth] Exception Supabase Auth:', err);
      }
    }

    // 2. Vérification dans le registre local des écoles (mode hors-ligne / comptes locaux)
    if (found) {
      if (!found.pwdHash && !found.password) {
        throw new Error("Ce compte n'a pas encore de mot de passe. Cliquez sur « S'inscrire » avec la même adresse e-mail pour en définir un.");
      }

      const valid = await this.verifyPassword(cleanPassword, found);
      if (!valid) {
        this.recordLoginFailure(cleanEmail);
        throw new Error(genericError);
      }

      // Conversion éventuelle d'un ancien mot de passe en clair
      if (!found.pwdHash) {
        await this.setEntryPassword(found, cleanPassword);
        this.saveSchoolsRegistry(registry);
      }

      // Compte uniquement local : création du compte en ligne pour activer la sauvegarde cloud
      // (Supabase envoie un e-mail de confirmation ; au plus une demande par 24 h)
      if (this.client && navigator.onLine && remoteErrorMessage && /invalid login credentials/i.test(remoteErrorMessage)) {
        const lastRequest = Date.parse(found.cloudSignupRequestedAt || '') || 0;
        if (Date.now() - lastRequest > 24 * 60 * 60 * 1000) {
          found.cloudSignupRequestedAt = new Date().toISOString();
          this.saveSchoolsRegistry(registry);
          this.client.auth.signUp({
            email: cleanEmail,
            password: cleanPassword,
            options: { data: { full_name: found.name || '' }, emailRedirectTo: this._appUrl('index.html') }
          }).catch(() => {});
        }
      }

      this.clearLoginGuard(cleanEmail);
      this.school = found.school || null;
      this.userProfile = {
        id: found.directorId || Utils.randomId('usr'),
        name: found.name || (found.school ? found.school.director_name : 'Directeur'),
        role: 'director',
        school_id: found.school ? found.school.id : null,
        email: cleanEmail,
        phone: found.phone || (found.school ? found.school.director_phone : '')
      };

      this.saveActiveSession();
      return { user: this.userProfile, school: this.school };
    }

    this.recordLoginFailure(cleanEmail);
    if (remoteErrorMessage && /confirm/i.test(remoteErrorMessage)) {
      throw new Error("Votre adresse e-mail n'est pas encore confirmée. Ouvrez le lien de confirmation reçu par e-mail, puis reconnectez-vous.");
    }
    throw new Error(genericError);
  },

  /**
   * Référencer une école pour l'utilisateur actuellement connecté
   */
  async referenceSchool(data) {
    const {
      schoolName,
      directorPhone,
      region = 'Dakar',
      department = 'Dakar',
      commune = 'Plateau',
      address = '',
      schoolYear = '2026-2027',
      classes = []
    } = data;

    if (!this.userProfile) {
      throw new Error("Session utilisateur introuvable. Veuillez vous connecter d'abord.");
    }

    const cleanSchoolName = String(schoolName || '').trim().slice(0, 255);
    if (!cleanSchoolName) {
      throw new Error("Veuillez renseigner le nom de votre établissement.");
    }

    const cleanPhone = Utils.normalizeSenegalPhone(String(directorPhone || this.userProfile.phone || '+221 77 000 00 00').slice(0, 30));
    const schoolId = Utils.randomId('sch');
    const cleanYear = /^\d{4}-\d{4}$/.test(String(schoolYear).trim()) ? String(schoolYear).trim() : CONFIG.DEFAULT_SCHOOL_YEAR;

    const newSchool = {
      id: schoolId,
      name: cleanSchoolName,
      director_name: this.userProfile.name,
      director_phone: cleanPhone,
      region: region,
      department: department,
      commune: commune,
      address: address ? String(address).trim().slice(0, 255) : '',
      school_year: cleanYear,
      stamp_color: '#1E3A8A',
      status: 'active',
      created_at: new Date().toISOString()
    };

    const newClasses = (classes.length > 0 ? classes : [
      { name: 'Crèche', registration_fee: 25000, monthly_fee: 15000 },
      { name: 'Petite section', registration_fee: 25000, monthly_fee: 15000 },
      { name: 'Moyenne section', registration_fee: 25000, monthly_fee: 15000 },
      { name: 'Grande section', registration_fee: 30000, monthly_fee: 18000 }
    ]).map((cls, idx) => ({
      id: 'cls_' + schoolId + '_' + (idx + 1),
      school_id: schoolId,
      name: String(cls.name || '').slice(0, 100),
      registration_fee: Math.max(0, parseInt(cls.registration_fee, 10) || 0),
      monthly_fee: Math.max(0, parseInt(cls.monthly_fee, 10) || 0),
      position: idx + 1
    }));

    const newMonths = CONFIG.DEFAULT_MONTHS.map(m => ({
      id: 'mth_' + schoolId + '_' + m.number,
      school_id: schoolId,
      school_year: cleanYear,
      month_number: m.number,
      label: m.label,
      position: m.position
    }));

    // Base VIERGE : other_revenues STRICTEMENT []
    const schoolStoreData = {
      school: newSchool,
      classes: newClasses,
      months: newMonths,
      students: [],
      payments: [],
      receipts: [],
      expenses: [],
      other_revenues: [],
      audit_log: [
        {
          id: Utils.randomId('audit'),
          school_id: schoolId,
          user_id: this.userProfile.id,
          action: 'SCHOOL_REGISTERED',
          details: { school_name: newSchool.name, director: newSchool.director_name },
          created_at: new Date().toISOString()
        }
      ],
      receiptCounter: 1
    };

    localStorage.setItem(`gp_store_${schoolId}`, JSON.stringify(schoolStoreData));

    this.school = newSchool;
    this.userProfile.school_id = schoolId;
    this.userProfile.phone = cleanPhone;
    delete this.userProfile.isDemo;

    // Mise à jour du registre multi-écoles
    const registry = this.getSchoolsRegistry();
    const entry = registry.find(r => (r.email || '').toLowerCase() === (this.userProfile.email || '').toLowerCase());
    if (entry) {
      entry.school = newSchool;
      entry.phone = cleanPhone;
      entry.name = this.userProfile.name;
    } else {
      registry.push({
        email: this.userProfile.email,
        name: this.userProfile.name,
        directorId: this.userProfile.id,
        school: newSchool,
        phone: cleanPhone
      });
    }
    this.saveSchoolsRegistry(registry);
    this.saveActiveSession();

    if (window.Store) {
      Store.storageKey = `gp_store_${schoolId}`;
      Store.currentUser = this.userProfile;
      Store.data = schoolStoreData;
      Store.persist();
    }

    return { school: newSchool, user: this.userProfile };
  },

  /**
   * Inscription ATOMIQUE : Création de l'école, du directeur, des classes, des mois et du cachet
   */
  async registerSchoolAtomic(data) {
    const {
      schoolName,
      directorName,
      directorPhone,
      email,
      password,
      region,
      department,
      commune,
      address,
      schoolYear = '2026-2027',
      classes = []
    } = data;

    const cleanEmail = this._cleanEmail(email);
    const cleanPhone = Utils.normalizeSenegalPhone(String(directorPhone || '').slice(0, 30));
    const cleanSchoolName = String(schoolName || '').trim().slice(0, 255);
    const cleanDirectorName = String(directorName || '').trim().slice(0, 255);

    if (!cleanSchoolName || !cleanDirectorName) {
      throw new Error("Le nom de l'école et celui du directeur sont obligatoires.");
    }
    if (!this._isValidEmail(cleanEmail)) {
      throw new Error("Veuillez saisir une adresse e-mail valide.");
    }
    this.validatePasswordStrength(password);

    // 1. Validation d'unicité (refus strict des doublons)
    const registry = this.getSchoolsRegistry();
    const emailExists = registry.some(r => (r.email || '').toLowerCase() === cleanEmail);
    if (emailExists) {
      throw new Error(`Un établissement est déjà enregistré avec l'adresse ${cleanEmail}. Veuillez vous connecter.`);
    }

    const phoneExists = registry.some(r => r.phone && Utils.normalizeSenegalPhone(r.phone) === cleanPhone);
    if (phoneExists) {
      throw new Error(`Le numéro de téléphone ${cleanPhone} est déjà associé à un établissement.`);
    }

    // 2. Identifiants uniques cryptographiques
    const schoolId = Utils.randomId('sch');
    const directorId = Utils.randomId('usr');
    const cleanYear = /^\d{4}-\d{4}$/.test(String(schoolYear).trim()) ? String(schoolYear).trim() : CONFIG.DEFAULT_SCHOOL_YEAR;

    // 3. Objet École
    const newSchool = {
      id: schoolId,
      name: cleanSchoolName,
      director_name: cleanDirectorName,
      director_phone: cleanPhone,
      region: region || 'Dakar',
      department: department || 'Dakar',
      commune: commune || 'Plateau',
      address: address ? String(address).trim().slice(0, 255) : '',
      school_year: cleanYear,
      stamp_color: '#1E3A8A',
      status: 'active',
      created_at: new Date().toISOString()
    };

    // 4. Classes et tarifs configurés (Crèche + 3 sections préscolaires)
    const newClasses = (classes.length > 0 ? classes : [
      { name: 'Crèche', registration_fee: 25000, monthly_fee: 15000 },
      { name: 'Petite section', registration_fee: 25000, monthly_fee: 15000 },
      { name: 'Moyenne section', registration_fee: 25000, monthly_fee: 15000 },
      { name: 'Grande section', registration_fee: 30000, monthly_fee: 18000 }
    ]).map((cls, idx) => ({
      id: 'cls_' + schoolId + '_' + (idx + 1),
      school_id: schoolId,
      name: String(cls.name || '').slice(0, 100),
      registration_fee: Math.max(0, parseInt(cls.registration_fee, 10) || 0),
      monthly_fee: Math.max(0, parseInt(cls.monthly_fee, 10) || 0),
      position: idx + 1
    }));

    // 5. Mois scolaires (Octobre à Juin)
    const newMonths = CONFIG.DEFAULT_MONTHS.map(m => ({
      id: 'mth_' + schoolId + '_' + m.number,
      school_id: schoolId,
      school_year: cleanYear,
      month_number: m.number,
      label: m.label,
      position: m.position
    }));

    // 6. Profil Directeur
    const newProfile = {
      id: directorId,
      name: cleanDirectorName,
      role: 'director',
      school_id: schoolId,
      email: cleanEmail,
      phone: cleanPhone
    };

    // 7. Tentative d'enregistrement distant Supabase si disponible
    if (this.client && navigator.onLine) {
      try {
        const { data: authData, error: authError } = await this.client.auth.signUp({
          email: cleanEmail,
          password: password,
          options: {
            data: {
              full_name: cleanDirectorName,
              phone: cleanPhone
            },
            emailRedirectTo: this._appUrl('index.html')
          }
        });

        // L'appel RPC n'est possible que si Supabase a ouvert une session (e-mail déjà confirmé)
        if (!authError && authData && authData.session) {
          const { error: rpcError } = await this.client.rpc('register_school_atomically', {
            p_school_name: newSchool.name,
            p_director_name: newSchool.director_name,
            p_director_phone: newSchool.director_phone,
            p_region: newSchool.region,
            p_department: newSchool.department,
            p_commune: newSchool.commune,
            p_address: newSchool.address,
            p_school_year: newSchool.school_year,
            p_classes: newClasses.map(c => ({
              name: c.name,
              registration_fee: c.registration_fee,
              monthly_fee: c.monthly_fee
            }))
          });
          if (rpcError) console.warn('[Auth] RPC register_school_atomically:', rpcError.message);
        } else if (authError) {
          console.warn('[Auth] SignUp Supabase:', authError.message);
        }
      } catch (supaErr) {
        console.warn('[Auth] Enregistrement distant Supabase non bloquant (fallback local actif):', supaErr);
      }
    }

    // 8. Enregistrement dans le registre multi-écoles (empreinte du mot de passe uniquement)
    const entry = {
      email: cleanEmail,
      phone: cleanPhone,
      name: cleanDirectorName,
      directorId: directorId,
      school: newSchool
    };
    await this.setEntryPassword(entry, password);
    registry.push(entry);
    this.saveSchoolsRegistry(registry);

    // 9. Initialisation de la base de l'école (VIERGE : 0 élève, 0 paiement, 0 reçu, 0 dépense)
    const schoolStoreData = {
      school: newSchool,
      classes: newClasses,
      months: newMonths,
      students: [],
      payments: [],
      receipts: [],
      expenses: [],
      other_revenues: [],
      audit_log: [
        {
          id: Utils.randomId('audit'),
          school_id: schoolId,
          user_id: directorId,
          action: 'SCHOOL_REGISTERED',
          details: { school_name: newSchool.name, director: newSchool.director_name },
          created_at: new Date().toISOString()
        }
      ],
      receiptCounter: 1
    };

    // Stockage scoped par école (garantit une isolation stricte)
    localStorage.setItem(`gp_store_${schoolId}`, JSON.stringify(schoolStoreData));

    // 10. Ouverture immédiate de la session active
    this.school = newSchool;
    this.userProfile = newProfile;
    this.saveActiveSession();

    // 11. Initialiser le Store avec cette école
    if (window.Store) {
      Store.storageKey = `gp_store_${schoolId}`;
      Store.currentUser = newProfile;
      Store.data = schoolStoreData;
      Store.persist();
    }

    return { school: newSchool, user: newProfile };
  },

  /**
   * Sauvegarde la session active dans localStorage (aucun secret n'y est stocké)
   */
  saveActiveSession() {
    const safeUser = this.userProfile ? { ...this.userProfile } : null;
    if (safeUser) {
      delete safeUser.password;
      delete safeUser.pwdHash;
      delete safeUser.pwdSalt;
    }
    const sessionData = {
      user: safeUser,
      school: this.school,
      signedAt: new Date().toISOString()
    };
    const supabaseSession = this.session && this.session.supabaseSession;
    this.session = sessionData;
    localStorage.setItem(this.STORAGE_SESSION_KEY, JSON.stringify(sessionData));
    if (supabaseSession) {
      // Conservé en mémoire uniquement (Supabase gère lui-même son stockage)
      this.session.supabaseSession = supabaseSession;
    }
  },

  /**
   * Déconnexion réelle : clôture la session et redirige vers l'accueil
   */
  async signOut() {
    // 1. Déconnexion Supabase
    if (this.client) {
      try {
        await this.client.auth.signOut();
      } catch (e) {
        console.warn('[Auth] Erreur signOut Supabase:', e);
      }
    }

    // 2. Nettoyage de la session locale
    this.handleLocalSignOut(true);
  },

  /**
   * Traite la déconnexion locale et redirige
   */
  handleLocalSignOut(redirect = true) {
    this.session = null;
    this.userProfile = null;
    this.school = null;
    localStorage.removeItem(this.STORAGE_SESSION_KEY);

    if (redirect) {
      // replaceState pour empêcher le bouton "Retour" de rouvrir l'espace
      window.history.replaceState(null, '', 'index.html');
      window.location.replace('index.html?logout=1');
    }
  },

  /**
   * Registre des écoles enregistrées localement (Multi-tenant local)
   */
  getSchoolsRegistry() {
    try {
      const raw = localStorage.getItem(this.STORAGE_USERS_REGISTRY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(r => r && typeof r === 'object') : [];
    } catch (e) {
      return [];
    }
  },

  saveSchoolsRegistry(registry) {
    try {
      localStorage.setItem(this.STORAGE_USERS_REGISTRY, JSON.stringify(registry));
    } catch (e) {
      console.error('[Auth] Erreur écriture registre écoles:', e);
    }
  },

  /**
   * Charge le profil distant depuis Supabase
   */
  async loadRemoteUserProfile(userId) {
    if (!this.client) return;
    try {
      const { data: profile } = await this.client
        .from('profiles')
        .select('*, schools(*)')
        .eq('id', userId)
        .single();

      if (profile && profile.schools) {
        this.school = profile.schools;
        this.userProfile = {
          id: profile.id,
          name: profile.full_name || profile.schools.director_name,
          role: profile.role === 'staff' ? 'staff' : 'director',
          school_id: profile.school_id,
          email: profile.email || '',
          phone: profile.schools.director_phone
        };
      }
    } catch (e) {
      console.warn('[Auth] Profil distant introuvable:', e);
    }
  },

  /**
   * Mot de passe oublié : envoi du lien de réinitialisation par Supabase
   * (même réponse que l'adresse existe ou non, pour ne pas révéler les comptes)
   */
  async resetPassword(email) {
    const cleanEmail = this._cleanEmail(email);
    if (!this._isValidEmail(cleanEmail)) {
      throw new Error("Veuillez renseigner une adresse e-mail valide.");
    }

    if (!this.client || !navigator.onLine) {
      throw new Error("Une connexion Internet est nécessaire pour recevoir le lien de réinitialisation.");
    }

    const { error } = await this.client.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: this._appUrl('index.html')
    });
    if (error && !/rate|limit/i.test(error.message || '')) {
      console.warn('[Auth] resetPasswordForEmail:', error.message);
    } else if (error) {
      throw new Error("Trop de demandes. Patientez quelques minutes avant de réessayer.");
    }
    return true;
  },

  /**
   * Fenêtre « Nouveau mot de passe » affichée après clic sur le lien de réinitialisation
   */
  openPasswordRecoveryDialog(session) {
    if (document.getElementById('gpRecoveryModal')) return;
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop is-open';
    modal.id = 'gpRecoveryModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="modal-container" style="max-width:440px;">
        <div class="modal-header">
          <h2 class="modal-title">Choisir un nouveau mot de passe</h2>
        </div>
        <form id="gpRecoveryForm">
          <div class="modal-body" style="padding-top:1rem;">
            <div id="gpRecoveryMsg" class="alert-box alert-danger" style="display:none;" role="alert"></div>
            <div class="form-group">
              <label class="form-label" for="gpRecoveryPwd">Nouveau mot de passe</label>
              <input type="password" id="gpRecoveryPwd" class="form-input" required minlength="${this.MIN_PASSWORD_LENGTH}" autocomplete="new-password">
              <div class="form-helper">Au moins ${this.MIN_PASSWORD_LENGTH} caractères, dont une lettre et un chiffre.</div>
            </div>
            <div class="form-group">
              <label class="form-label" for="gpRecoveryPwd2">Confirmer le mot de passe</label>
              <input type="password" id="gpRecoveryPwd2" class="form-input" required minlength="${this.MIN_PASSWORD_LENGTH}" autocomplete="new-password">
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%; margin-top:1rem; min-height:44px;">Enregistrer le nouveau mot de passe</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    const form = modal.querySelector('#gpRecoveryForm');
    const msg = modal.querySelector('#gpRecoveryMsg');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pwd = modal.querySelector('#gpRecoveryPwd').value;
      const pwd2 = modal.querySelector('#gpRecoveryPwd2').value;
      try {
        if (pwd !== pwd2) throw new Error("Les deux mots de passe ne correspondent pas.");
        this.validatePasswordStrength(pwd);
        const { error } = await this.client.auth.updateUser({ password: pwd });
        if (error) throw error;

        // Mise à jour de l'empreinte locale pour la connexion hors-ligne
        const email = this._cleanEmail(session && session.user ? session.user.email : '');
        if (email) {
          const registry = this.getSchoolsRegistry();
          const entry = registry.find(r => (r.email || '').toLowerCase() === email);
          if (entry) {
            await this.setEntryPassword(entry, pwd);
            this.saveSchoolsRegistry(registry);
          }
        }
        msg.className = 'alert-box alert-success';
        msg.textContent = "Mot de passe modifié avec succès. Redirection vers votre espace...";
        msg.style.display = 'block';
        setTimeout(() => window.location.replace('app.html'), 1200);
      } catch (err) {
        msg.className = 'alert-box alert-danger';
        msg.textContent = err.message || "Impossible de modifier le mot de passe.";
        msg.style.display = 'block';
      }
    });
  },

  /**
   * Protection de route pour app.html : Redirige vers index.html si non connecté
   */
  requireAuth() {
    if (!this.isAuthenticated()) {
      try {
        localStorage.removeItem(this.STORAGE_SESSION_KEY);
      } catch (e) {}
      window.history.replaceState(null, '', 'index.html');
      window.location.replace('index.html');
      return false;
    }
    return true;
  },

  /**
   * Protection de route pour index.html : Redirige vers app.html si déjà connecté
   */
  redirectIfAuthenticated() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('logout') || urlParams.has('landing') || urlParams.has('home')) {
      return false;
    }
    // Lien de réinitialisation de mot de passe : rester sur la page pour afficher le formulaire
    if (/type=recovery/.test(window.location.hash) || document.getElementById('gpRecoveryModal')) {
      return false;
    }
    const user = this.getUser();
    if (user && user.isDemo) {
      return false; // Permettre au visiteur de voir la page d'accueil sans forcer de redirection
    }
    if (this.isAuthenticated()) {
      window.history.replaceState(null, '', 'app.html');
      window.location.replace('app.html');
      return true;
    }
    return false;
  }
};

window.Auth = Auth;
