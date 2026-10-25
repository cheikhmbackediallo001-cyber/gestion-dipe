/**
 * LOGIQUE DE LA PAGE D'ACCUEIL MINIMALE - GESTION PRÉSCOLAIRE
 * - Redirection immédiate si session active
 * - Contrôle des modales d'inscription (Onboarding) et de connexion épurée
 * - Authentification sécurisée E-mail + Mot de passe avec gestion d'erreurs
 * - Limitation des tentatives de connexion (anti-bruteforce)
 * - Réinitialisation de mot de passe oublié
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialise l'authentification et redirige immédiatement si l'utilisateur est déjà connecté
  if (window.Auth) {
    await Auth.init();
    if (Auth.redirectIfAuthenticated()) {
      return; // L'utilisateur est connecté, redirection en cours vers app.html
    }
  }

  // 2. Initialisation des composants
  initModals();
  initRegisterForm();
  initLoginForm();
});

/**
 * Gestion des ouvertures et fermetures de modales
 */
function initModals() {
  const registerModal = document.getElementById('registerModal');
  const onboardModal = document.getElementById('onboardingModal');
  const loginModal = document.getElementById('loginModal');
  const forgotModal = document.getElementById('forgotPasswordModal');
  const googlePickerModal = document.getElementById('googleAccountPickerModal');

  const closeRegisterBtn = document.getElementById('closeRegisterModal');
  const closeOnboardBtn = document.getElementById('closeOnboardingModal');
  const closeLoginBtn = document.getElementById('closeLoginModal');
  const closeForgotBtn = document.getElementById('closeForgotModal');

  // Boutons d'ouverture d'inscription directe (Google ou Formulaire)
  document.querySelectorAll('[data-action="open-register"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      closeAllModals();
      if (registerModal) {
        registerModal.classList.add('is-open');
        const nameInput = document.getElementById('regFullName');
        if (nameInput) setTimeout(() => nameInput.focus(), 100);
      }
    });
  });

  // Boutons d'ouverture du wizard complet de référencement d'école
  document.querySelectorAll('[data-action="open-onboarding"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      closeAllModals();
      if (onboardModal) {
        onboardModal.classList.add('is-open');
        if (window.Onboarding) {
          Onboarding.init();
          Onboarding.goToStep(1);
        }
      }
    });
  });

  // Boutons d'ouverture de connexion
  document.querySelectorAll('[data-action="open-login"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      closeAllModals();
      if (loginModal) {
        loginModal.classList.add('is-open');
        const emailInput = document.getElementById('loginEmail');
        if (emailInput) setTimeout(() => emailInput.focus(), 100);
      }
    });
  });

  // Bouton Mot de passe oublié
  const forgotLink = document.getElementById('linkForgotPassword');
  if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      closeAllModals();
      if (forgotModal) {
        forgotModal.classList.add('is-open');
        const fEmail = document.getElementById('forgotEmail');
        if (fEmail) {
          const lEmail = document.getElementById('loginEmail');
          if (lEmail && lEmail.value) fEmail.value = lEmail.value;
          setTimeout(() => fEmail.focus(), 100);
        }
      }
    });
  }

  // Fermetures individuelles
  if (closeRegisterBtn) closeRegisterBtn.addEventListener('click', () => registerModal.classList.remove('is-open'));
  if (closeOnboardBtn) closeOnboardBtn.addEventListener('click', () => onboardModal.classList.remove('is-open'));
  if (closeLoginBtn) closeLoginBtn.addEventListener('click', () => loginModal.classList.remove('is-open'));
  if (closeForgotBtn) closeForgotBtn.addEventListener('click', () => forgotModal.classList.remove('is-open'));

  // Fermeture au clic sur l'arrière-plan
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) {
      e.target.classList.remove('is-open');
    }
  });

  // Fermeture avec la touche Échap (Accessibilité)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
    }
  });
}

/**
 * Gestion du formulaire d'inscription direct
 */
function initRegisterForm() {
  const regForm = document.getElementById('mainRegisterForm');
  const regName = document.getElementById('regFullName');
  const regEmail = document.getElementById('regEmail');
  const regPassword = document.getElementById('regPassword');
  const regSubmitBtn = document.getElementById('btnRegisterSubmit');
  const regErrorBox = document.getElementById('registerErrorBox');
  const togglePassBtn = document.getElementById('toggleRegPassword');

  const regPasswordConfirm = document.getElementById('regPasswordConfirm');
  const togglePassConfirmBtn = document.getElementById('toggleRegPasswordConfirm');

  if (togglePassBtn && regPassword) {
    togglePassBtn.addEventListener('click', () => {
      if (regPassword.type === 'password') {
        regPassword.type = 'text';
        togglePassBtn.textContent = '🙈';
      } else {
        regPassword.type = 'password';
        togglePassBtn.textContent = '👁️';
      }
    });
  }

  if (togglePassConfirmBtn && regPasswordConfirm) {
    togglePassConfirmBtn.addEventListener('click', () => {
      if (regPasswordConfirm.type === 'password') {
        regPasswordConfirm.type = 'text';
        togglePassConfirmBtn.textContent = '🙈';
      } else {
        regPasswordConfirm.type = 'password';
        togglePassConfirmBtn.textContent = '👁️';
      }
    });
  }

  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const firstNameInput = document.getElementById('regFirstName');
      const lastNameInput = document.getElementById('regLastName');
      const fullNameInput = document.getElementById('regFullName');
      
      let fullName = '';
      if (firstNameInput && lastNameInput) {
        fullName = `${firstNameInput.value.trim()} ${lastNameInput.value.trim()}`.trim();
      } else if (fullNameInput) {
        fullName = fullNameInput.value.trim();
      }

      const email = regEmail ? regEmail.value.trim() : '';
      const password = regPassword ? regPassword.value : '';
      const passwordConfirm = regPasswordConfirm ? regPasswordConfirm.value : '';

      if (!fullName || !email || !password) {
        showRegisterError("Veuillez renseigner votre prénom, nom, e-mail/Gmail et mot de passe.");
        return;
      }

      if (password.length < 6) {
        showRegisterError("Le mot de passe est obligatoire et doit comporter au moins 6 caractères.");
        return;
      }

      if (regPasswordConfirm && password !== passwordConfirm) {
        showRegisterError("Les mots de passe ne correspondent pas. Veuillez ressaisir votre mot de passe à l'identique.");
        return;
      }

      hideRegisterError();

      try {
        regSubmitBtn.disabled = true;
        regSubmitBtn.innerHTML = `
          <span style="display:inline-flex; align-items:center; gap:0.5rem;">
            <svg class="spin-animation" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10"></path></svg>
            Création de votre compte...
          </span>
        `;

        await Auth.signUpUser({ fullName, email, password });

        regSubmitBtn.innerHTML = '<span>Compte créé ! Accès à la démo...</span>';
        window.history.replaceState(null, '', 'app.html');
        window.location.replace('app.html');

      } catch (err) {
        regSubmitBtn.disabled = false;
        regSubmitBtn.innerHTML = `
          <span>S'inscrire</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        `;
        showRegisterError(err.message || "Erreur lors de l'inscription.");
      }
    });
  }

  function showRegisterError(msg) {
    if (regErrorBox) {
      regErrorBox.textContent = msg;
      regErrorBox.style.display = 'block';
    } else {
      alert(msg);
    }
  }

  function hideRegisterError() {
    if (regErrorBox) {
      regErrorBox.style.display = 'none';
      regErrorBox.textContent = '';
    }
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('is-open'));
}

/**
 * Gestion du formulaire de connexion épuré (E-mail + Mot de passe)
 */
function initLoginForm() {
  const loginForm = document.getElementById('mainLoginForm');
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  const loginSubmitBtn = document.getElementById('btnLoginSubmit');
  const loginErrorBox = document.getElementById('loginErrorBox');
  const togglePassBtn = document.getElementById('toggleLoginPassword');

  let failedAttempts = 0;
  let lockUntilTime = 0;

  // Afficher / masquer mot de passe
  if (togglePassBtn && loginPassword) {
    togglePassBtn.addEventListener('click', () => {
      if (loginPassword.type === 'password') {
        loginPassword.type = 'text';
        togglePassBtn.textContent = '🙈';
        togglePassBtn.setAttribute('aria-label', 'Masquer le mot de passe');
      } else {
        loginPassword.type = 'password';
        togglePassBtn.textContent = '👁️';
        togglePassBtn.setAttribute('aria-label', 'Afficher le mot de passe');
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Vérification limitation de tentatives (anti-bruteforce)
      const now = Date.now();
      if (now < lockUntilTime) {
        const remainingSeconds = Math.ceil((lockUntilTime - now) / 1000);
        showLoginError(`Trop de tentatives infructueuses. Veuillez patienter ${remainingSeconds} secondes.`);
        return;
      }

      const email = loginEmail.value.trim();
      const password = loginPassword.value;

      if (!email || !password) {
        showLoginError("Veuillez renseigner votre e-mail et votre mot de passe.");
        return;
      }

      hideLoginError();

      try {
        loginSubmitBtn.disabled = true;
        loginSubmitBtn.innerHTML = `
          <span style="display:inline-flex; align-items:center; gap:0.5rem;">
            <svg class="spin-animation" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10"></path></svg>
            Connexion en cours...
          </span>
        `;

        await Auth.signIn(email, password);

        loginSubmitBtn.innerHTML = '<span>Connexion réussie ! Redirection...</span>';

        // Redirection vers l'espace école
        window.history.replaceState(null, '', 'app.html');
        window.location.replace('app.html');

      } catch (err) {
        failedAttempts++;
        loginSubmitBtn.disabled = false;
        loginSubmitBtn.innerHTML = `
          <span>Se connecter à mon école</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        `;

        if (failedAttempts >= 5) {
          lockUntilTime = Date.now() + 30000; // Blocage 30s
          failedAttempts = 0;
          showLoginError("Nombre maximal d'essais atteint. Accès verrouillé pendant 30 secondes.");
        } else {
          showLoginError(err.message || "Identifiant ou mot de passe incorrect.");
        }
      }
    });
  }

  function showLoginError(msg) {
    if (loginErrorBox) {
      loginErrorBox.textContent = msg;
      loginErrorBox.style.display = 'block';
    } else {
      alert(msg);
    }
  }

  function hideLoginError() {
    if (loginErrorBox) {
      loginErrorBox.style.display = 'none';
      loginErrorBox.textContent = '';
    }
  }

  // Formulaire mot de passe oublié
  const forgotForm = document.getElementById('forgotPasswordForm');
  const forgotEmail = document.getElementById('forgotEmail');
  const forgotSubmitBtn = document.getElementById('btnForgotSubmit');
  const forgotMsgBox = document.getElementById('forgotMsgBox');

  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = forgotEmail.value.trim();
      if (!email) return;

      try {
        forgotSubmitBtn.disabled = true;
        forgotSubmitBtn.textContent = 'Envoi en cours...';

        await Auth.resetPassword(email);

        forgotMsgBox.className = 'alert-box alert-success';
        forgotMsgBox.textContent = `Un lien de réinitialisation sécurisé a été préparé pour ${email}. Vérifiez votre boîte de réception.`;
        forgotMsgBox.style.display = 'block';
        forgotSubmitBtn.textContent = 'E-mail envoyé';

      } catch (err) {
        forgotSubmitBtn.disabled = false;
        forgotSubmitBtn.textContent = 'Envoyer les instructions';
        forgotMsgBox.className = 'alert-box alert-danger';
        forgotMsgBox.textContent = err.message || "Impossible d'envoyer l'e-mail pour le moment.";
        forgotMsgBox.style.display = 'block';
      }
    });
  }
}

// ------------------------------------------------------------------------------
// GESTION DU TÉLÉCHARGEMENT & INSTALLATION PWA
// ------------------------------------------------------------------------------
let deferredPwaPrompt = window.deferredPwaPrompt || null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPwaPrompt = e;
  window.deferredPwaPrompt = e;
  window.__pwaPromptReady = true;
  const btn = document.getElementById('btnPwaInstallLanding');
  if (btn && !window.__isPwaStandalone) btn.style.display = 'flex';
});

window.addEventListener('appinstalled', () => {
  deferredPwaPrompt = null;
  window.deferredPwaPrompt = null;
  window.__isPwaStandalone = true;
  window.__pwaInstalled = true;
  const btn = document.getElementById('btnPwaInstallLanding');
  if (btn) {
    btn.innerHTML = `
      <span class="pwa-icon">✓</span>
      <span class="pwa-text-group">
        <span class="pwa-btn-title">Application installée avec succès</span>
        <span class="pwa-btn-sub">Accessible directement sur votre écran d'accueil</span>
      </span>
      <span class="pwa-badge" style="background:#DCFCE7; color:#166534;">Actif</span>
    `;
  }
});

const Landing = {
  launchDemo(event) {
    if (event) event.preventDefault();
    try {
      const demoSession = {
        user: {
          id: 'usr_demo_director',
          name: 'Direction Démo',
          email: 'demo@gestionprescolaire.sn',
          role: 'director',
          isDemo: true
        },
        school: {
          id: '11111111-1111-1111-1111-111111111111',
          name: 'École Maternelle Les Papillons',
          director_name: 'Mme Aïssatou Ba',
          director_phone: '+221 77 543 21 00',
          region: 'Dakar',
          department: 'Dakar',
          commune: 'Plateau',
          school_year: '2026-2027',
          isDemo: true
        }
      };
      localStorage.setItem('gp_active_session_v1', JSON.stringify(demoSession));
    } catch (e) {}
  },

  launchDemoFeature(featureName) {
    try {
      document.querySelectorAll('.pillar-chip').forEach(c => c.classList.remove('is-selected'));
      if (window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add('is-selected');
      }
    } catch (e) {}

    try {
      const demoSession = {
        user: {
          id: 'usr_demo_director',
          name: 'Direction Démo',
          email: 'demo@gestionprescolaire.sn',
          role: 'director',
          isDemo: true
        },
        school: {
          id: '11111111-1111-1111-1111-111111111111',
          name: 'École Maternelle Les Papillons',
          director_name: 'Mme Aïssatou Ba',
          director_phone: '+221 77 543 21 00',
          region: 'Dakar',
          department: 'Dakar',
          commune: 'Plateau',
          school_year: '2026-2027',
          isDemo: true
        }
      };
      localStorage.setItem('gp_active_session_v1', JSON.stringify(demoSession));
    } catch (e) {}

    const targetUrl = featureName ? `app.html#${featureName}` : 'app.html';
    setTimeout(() => {
      window.location.href = targetUrl;
    }, 160);
  },

  async triggerPwaInstall() {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true || window.__isPwaStandalone;

    if (isStandalone) {
      alert("L'application Gestion Préscolaire est déjà installée sur cet appareil !\n\nVous pouvez l'ouvrir directement depuis votre écran d'accueil.");
      return;
    }

    const btn = document.getElementById('btnPwaInstallLanding');
    let promptEvent = window.deferredPwaPrompt || deferredPwaPrompt;

    // Si le prompt n'a pas encore fini de s'initialiser, on patiente brièvement (jusqu'à 1.2s)
    if (!promptEvent && !isIos) {
      const originalHtml = btn ? btn.innerHTML : null;
      if (btn) {
        btn.style.pointerEvents = 'none';
        btn.innerHTML = `
          <span class="pwa-icon" style="display:inline-block; animation: spin 1s infinite linear;">⚙️</span>
          <span class="pwa-text-group">
            <span class="pwa-btn-title">Préparation de l'installation...</span>
            <span class="pwa-btn-sub">Connexion directe avec votre appareil</span>
          </span>
        `;
      }

      promptEvent = await new Promise((resolve) => {
        if (window.deferredPwaPrompt) return resolve(window.deferredPwaPrompt);
        const timer = setTimeout(() => resolve(window.deferredPwaPrompt || null), 1200);
        document.addEventListener('pwa-prompt-ready', () => {
          clearTimeout(timer);
          resolve(window.deferredPwaPrompt);
        }, { once: true });
      });

      if (btn && originalHtml && !window.__pwaInstalled) {
        btn.innerHTML = originalHtml;
        btn.style.pointerEvents = '';
      }
    }

    if (promptEvent) {
      try {
        promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice && choice.outcome === 'accepted') {
          deferredPwaPrompt = null;
          window.deferredPwaPrompt = null;
          if (btn) {
            btn.innerHTML = `
              <span class="pwa-icon">✓</span>
              <span class="pwa-text-group">
                <span class="pwa-btn-title">Installation en cours...</span>
                <span class="pwa-btn-sub">L'icône s'ajoute directement sur votre écran</span>
              </span>
              <span class="pwa-badge" style="background:#DCFCE7; color:#166534;">En cours</span>
            `;
          }
        }
      } catch (err) {
        console.warn('[PWA] Erreur prompt:', err);
      }
      return;
    }

    if (isIos) {
      const iosModal = document.getElementById('iosPwaModal');
      if (iosModal) {
        iosModal.classList.add('is-open');
      } else {
        alert("Pour installer l'application sur iPhone ou iPad :\n\n1. Appuyez sur le bouton Partager ⎋ en bas de Safari.\n2. Sélectionnez « Sur l'écran d'accueil » (➕).\n3. Appuyez sur « Ajouter ».");
      }
      return;
    }

    // Si le navigateur ne fournit pas le prompt direct (ex: navigateur intégré WhatsApp/Facebook ou déjà refusé)
    const manualModal = document.getElementById('manualInstallModal');
    if (manualModal) {
      manualModal.classList.add('is-open');
    } else {
      alert("Installation directe :\n\nAppuyez sur le menu de votre navigateur (les trois points ⋮ en haut à droite) puis sélectionnez « Installer l'application ».");
    }
  },

  async chooseGoogleAccount(name, email) {
    try {
      await Auth.signInGoogleDirect({ name, email });
      const picker = document.getElementById('googleAccountPickerModal');
      if (picker) picker.classList.remove('is-open');
      window.history.replaceState(null, '', 'app.html');
      window.location.replace('app.html');
    } catch (err) {
      alert(err.message || "Erreur de connexion Google.");
    }
  },

  async submitCustomGoogleAccount() {
    const input = document.getElementById('customGoogleEmail');
    const nameInput = document.getElementById('customGoogleName');
    if (!input) return;
    const email = input.value.trim();
    if (!email || !email.includes('@')) {
      alert("Veuillez saisir une adresse e-mail Google valide (ex: directrice@gmail.com).");
      return;
    }
    const enteredName = nameInput ? nameInput.value.trim() : '';
    const name = enteredName || email.split('@')[0];
    await this.chooseGoogleAccount(name, email);
  }
};

window.Landing = Landing;

