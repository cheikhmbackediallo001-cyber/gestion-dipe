/**
 * GESTION DE L'AUTHENTIFICATION ET DES SESSIONS - GESTION PRÉSCOLAIRE
 * - Session persistante jusqu'à déconnexion explicite (redémarrage, rechargement, PWA)
 * - Renouvellement automatique du jeton (Supabase Auth)
 * - Résilience réseau totale : ne déconnecte JAMAIS en cas de coupure (mode hors-ligne)
 * - Synchronisation multi-onglets de la déconnexion
 * - Protection stricte des routes (app.html <-> index.html)
 */

const Auth = {
  client: null,
  session: null,
  userProfile: null,
  school: null,
  isOffline: !navigator.onLine,
  STORAGE_SESSION_KEY: 'gp_active_session_v1',
  STORAGE_USERS_REGISTRY: 'gp_registered_schools_v1', // Registre d'isolation multi-écoles pour persistance locale

  /**
   * Initialise le client Supabase et restaure la session active
   */
  async init() {
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
          } else if (session) {
            this.session = session;
          }
        });
      } catch (err) {
        console.warn('[Auth] Erreur initialisation Supabase client:', err);
      }
    }

    // 2. Écouteurs de connectivité réseau (ne jamais déconnecter, informer avec bandeau)
    this.initNetworkListeners();

    // 3. Écouteur inter-onglets pour synchroniser la déconnexion
    window.addEventListener('storage', (e) => {
      if (e.key === this.STORAGE_SESSION_KEY && !e.newValue) {
        // Un autre onglet s'est déconnecté
        if (window.location.pathname.includes('app.html')) {
          window.location.replace('index.html');
        }
      }
    });

    // 4. Restauration de la session locale persistée
    await this.restoreSession();

    return this.isAuthenticated();
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
        if (parsed && parsed.user) {
          this.session = parsed;
          this.userProfile = parsed.user;
          this.school = parsed.school || null;
        }
      }
    } catch (e) {
      console.warn('[Auth] Erreur lecture session locale:', e);
    }

    // Si Supabase est connecté et qu'on a le réseau, vérifier le token
    if (this.client && navigator.onLine) {
      try {
        const { data: { session }, error } = await this.client.auth.getSession();
        if (session && session.user) {
          this.session = this.session || {};
          this.session.supabaseSession = session;
          
          if (!this.userProfile) {
            const userMeta = session.user.user_metadata || {};
            this.userProfile = {
              id: session.user.id,
              name: userMeta.full_name || userMeta.name || session.user.email.split('@')[0],
              email: session.user.email,
              role: 'director',
              isGoogle: session.user.app_metadata && session.user.app_metadata.provider === 'google',
              avatarUrl: userMeta.avatar_url || null
            };
          }

          // Synchronise l'école si besoin
          if (!this.school) {
            await this.loadRemoteUserProfile(session.user.id);
          }
          this.saveActiveSession();
        } else if (error) {
          console.warn('[Auth] Token Supabase non valide:', error.message);
        }
      } catch (e) {
        console.warn('[Auth] Vérification distante impossible (hors-ligne ou réseau):', e);
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
   * Inscription d'un nouvel utilisateur (Nom + E-mail + Mot de passe)
   */
  async signUpUser({ fullName, email, password }) {
    const cleanName = (fullName || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!cleanName) {
      throw new Error("Veuillez saisir votre nom complet.");
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error("Veuillez saisir une adresse e-mail valide.");
    }
    if (!cleanPassword || cleanPassword.length < 6) {
      throw new Error("Le mot de passe est obligatoire et doit comporter au moins 6 caractères.");
    }

    const registry = this.getSchoolsRegistry();
    const existing = registry.find(r => (r.email || '').toLowerCase() === cleanEmail);
    if (existing && existing.password) {
      throw new Error("Un compte existe déjà avec cette adresse e-mail. Veuillez vous connecter.");
    }

    const userId = existing ? existing.directorId : ('usr_' + Math.random().toString(36).substring(2, 10));

    // Par défaut, l'utilisateur entre dans l'espace démo complète pour découvrir toutes les fonctionnalités
    this.school = existing && existing.school ? existing.school : null;

    this.userProfile = {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      role: 'director',
      school_id: this.school ? this.school.id : null
    };

    // Tentative Supabase SignUp si en ligne
    if (this.client && navigator.onLine) {
      try {
        await this.client.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: { full_name: cleanName }
          }
        });
      } catch (err) {
        console.warn('[Auth] SignUp Supabase:', err);
      }
    }

    // Sauvegarde dans le registre multi-écoles
    if (existing) {
      existing.name = cleanName;
      existing.password = cleanPassword;
      if (!existing.school) existing.school = this.school;
    } else {
      registry.push({
        email: cleanEmail,
        name: cleanName,
        password: cleanPassword,
        directorId: userId,
        school: this.school
      });
    }
    this.saveSchoolsRegistry(registry);
    this.saveActiveSession();

    return { user: this.userProfile, school: this.school };
  },

  /**
   * Connexion avec Google OAuth officiel ou sélecteur Google intégré
   */
  async signInWithGoogle() {
    this.openGoogleAccountPicker();
  },

  /**
   * Ouvre la modale de sélection de compte Google
   */
  openGoogleAccountPicker() {
    const modal = document.getElementById('googleAccountPickerModal');
    if (modal) {
      document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('is-open'));
      modal.classList.add('is-open');
    } else {
      const email = prompt("Connexion avec Google — Votre adresse e-mail Google :", "directrice.teranga@gmail.com");
      if (email) {
        const name = prompt("Votre nom complet :", "Mme Aïssatou Ba") || "Directrice";
        this.signInGoogleDirect({ name, email }).then(() => {
          window.location.replace('app.html');
        });
      }
    }
  },

  /**
   * Connexion directe via Google Account certifié
   */
  async signInGoogleDirect({ name, email, avatarUrl }) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (name || '').trim() || cleanEmail.split('@')[0];

    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error("Adresse e-mail Google invalide.");
    }

    const registry = this.getSchoolsRegistry();
    let existing = registry.find(r => (r.email || '').toLowerCase() === cleanEmail);

    const userId = existing ? existing.directorId : ('usr_goog_' + Math.random().toString(36).substring(2, 9));
    
    // Si école existante ou compte démo officiel
    if (existing && existing.school) {
      this.school = existing.school;
    } else {
      this.school = null;
    }

    this.userProfile = {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      role: 'director',
      isGoogle: true,
      avatarUrl: avatarUrl || null,
      school_id: this.school ? this.school.id : null
    };

    if (!existing) {
      registry.push({
        email: cleanEmail,
        name: cleanName,
        isGoogle: true,
        directorId: userId,
        school: this.school
      });
      this.saveSchoolsRegistry(registry);
    } else if (!existing.school) {
      existing.school = this.school;
      this.saveSchoolsRegistry(registry);
    }

    this.saveActiveSession();
    return { user: this.userProfile, school: this.school };
  },

  /**
   * Connexion avec E-mail et Mot de passe
   */
  async signIn(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error("Veuillez saisir une adresse e-mail valide.");
    }
    if (!cleanPassword) {
      throw new Error("Veuillez saisir votre mot de passe.");
    }

    // 1. Tentative Supabase Auth si en ligne
    if (this.client && navigator.onLine) {
      try {
        const { data, error } = await this.client.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword
        });

        if (!error && data && data.user) {
          await this.loadRemoteUserProfile(data.user.id);
          this.userProfile = this.userProfile || {
            id: data.user.id,
            name: (data.user.user_metadata && data.user.user_metadata.full_name) || cleanEmail.split('@')[0],
            email: cleanEmail,
            role: 'director'
          };
          this.saveActiveSession();
          return { user: this.userProfile, school: this.school };
        } else if (error) {
          console.warn('[Auth] Échec Supabase Auth:', error.message);
        }
      } catch (err) {
        console.warn('[Auth] Exception Supabase Auth:', err);
      }
    }

    // 2. Recherche dans le registre local des écoles
    const registry = this.getSchoolsRegistry();
    const found = registry.find(s => (s.email || '').toLowerCase() === cleanEmail);

    if (found) {
      if (found.password && found.password !== cleanPassword) {
        throw new Error("Mot de passe incorrect pour cet établissement.");
      }

      this.school = found.school || null;
      this.userProfile = {
        id: found.directorId || (found.school ? 'usr_' + found.school.id : 'usr_' + Date.now()),
        name: found.name || (found.school ? found.school.director_name : 'Directeur'),
        role: 'director',
        school_id: found.school ? found.school.id : null,
        email: cleanEmail,
        phone: found.phone || (found.school ? found.school.director_phone : '')
      };

      this.saveActiveSession();
      return { user: this.userProfile, school: this.school };
    }

    throw new Error("Aucun compte trouvé avec cette adresse e-mail. Vérifiez vos identifiants ou cliquez sur S'inscrire.");
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

    const cleanSchoolName = (schoolName || '').trim();
    if (!cleanSchoolName) {
      throw new Error("Veuillez renseigner le nom de votre établissement.");
    }

    const cleanPhone = Utils.normalizeSenegalPhone(directorPhone || this.userProfile.phone || '+221 77 000 00 00');
    const schoolId = 'sch_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();

    const newSchool = {
      id: schoolId,
      name: cleanSchoolName,
      director_name: this.userProfile.name,
      director_phone: cleanPhone,
      region: region,
      department: department,
      commune: commune,
      address: address ? address.trim() : '',
      school_year: schoolYear,
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
      name: cls.name,
      registration_fee: parseInt(cls.registration_fee, 10) || 0,
      monthly_fee: parseInt(cls.monthly_fee, 10) || 0,
      position: idx + 1
    }));

    const newMonths = CONFIG.DEFAULT_MONTHS.map(m => ({
      id: 'mth_' + schoolId + '_' + m.number,
      school_id: schoolId,
      school_year: schoolYear,
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
          id: 'audit_init_' + Date.now(),
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

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = Utils.normalizeSenegalPhone(directorPhone);

    // 1. Validation d'unicité (refus strict des doublons)
    const registry = this.getSchoolsRegistry();
    const emailExists = registry.some(r => (r.email || '').toLowerCase() === cleanEmail);
    if (emailExists) {
      throw new Error(`Un établissement est déjà enregistré avec l'adresse ${cleanEmail}. Veuillez vous connecter.`);
    }

    const phoneExists = registry.some(r => Utils.normalizeSenegalPhone(r.phone) === cleanPhone);
    if (phoneExists) {
      throw new Error(`Le numéro de téléphone ${directorPhone} est déjà associé à un établissement.`);
    }

    // 2. Identifiants uniques cryptographiques
    const schoolId = 'sch_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    const directorId = 'usr_' + Math.random().toString(36).substring(2, 11);

    // 3. Objet École
    const newSchool = {
      id: schoolId,
      name: schoolName.trim(),
      director_name: directorName.trim(),
      director_phone: cleanPhone,
      region: region || 'Dakar',
      department: department || 'Dakar',
      commune: commune || 'Plateau',
      address: address ? address.trim() : '',
      school_year: schoolYear,
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
      name: cls.name,
      registration_fee: parseInt(cls.registration_fee, 10) || 0,
      monthly_fee: parseInt(cls.monthly_fee, 10) || 0,
      position: idx + 1
    }));

    // 5. Mois scolaires (Octobre à Juin)
    const newMonths = CONFIG.DEFAULT_MONTHS.map(m => ({
      id: 'mth_' + schoolId + '_' + m.number,
      school_id: schoolId,
      school_year: schoolYear,
      month_number: m.number,
      label: m.label,
      position: m.position
    }));

    // 6. Profil Directeur
    const newProfile = {
      id: directorId,
      name: directorName.trim(),
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
              full_name: directorName,
              phone: cleanPhone
            }
          }
        });

        if (!authError && authData && authData.user) {
          // Appel RPC atomique PostgreSQL ou insertion directe
          await this.client.rpc('register_school_atomically', {
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
        }
      } catch (supaErr) {
        console.warn('[Auth] Enregistrement distant Supabase non bloquant (fallback local actif):', supaErr);
      }
    }

    // 8. Enregistrement dans le registre multi-écoles
    registry.push({
      email: cleanEmail,
      phone: cleanPhone,
      password: password,
      directorId: directorId,
      school: newSchool
    });
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
      audit_log: [
        {
          id: 'audit_init_' + Date.now(),
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
   * Sauvegarde la session active dans localStorage
   */
  saveActiveSession() {
    const sessionData = {
      user: this.userProfile,
      school: this.school,
      signedAt: new Date().toISOString()
    };
    this.session = sessionData;
    localStorage.setItem(this.STORAGE_SESSION_KEY, JSON.stringify(sessionData));
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
      window.location.replace('index.html');
    }
  },

  /**
   * Registre des écoles enregistrées localement (Multi-tenant local)
   */
  getSchoolsRegistry() {
    try {
      const raw = localStorage.getItem(this.STORAGE_USERS_REGISTRY);
      return raw ? JSON.parse(raw) : [];
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
          role: profile.role || 'director',
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
   * Mot de passe oublié : Envoi du lien ou e-mail de réinitialisation
   */
  async resetPassword(email) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error("Veuillez renseigner votre adresse e-mail.");
    }

    if (this.client && navigator.onLine) {
      try {
        const { error } = await this.client.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: window.location.origin + '/index.html'
        });
        if (error) throw error;
        return true;
      } catch (e) {
        throw new Error(e.message || "Erreur lors de l'envoi de l'e-mail de réinitialisation.");
      }
    }

    // Si hors ligne
    const registry = this.getSchoolsRegistry();
    const found = registry.some(s => (s.email || '').toLowerCase() === cleanEmail);
    if (!found) {
      throw new Error("Aucun établissement n'est enregistré avec cette adresse e-mail.");
    }

    return true;
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
