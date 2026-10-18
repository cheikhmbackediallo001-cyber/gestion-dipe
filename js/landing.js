/**
 * INTERACTIONS LANDING PAGE ULTRA-PREMIUM - GESTION DIPE
 * - Gestion du menu hamburger accessible
 * - Accordéon FAQ accessible (ARIA)
 * - Modales de connexion et de référencement (Onboarding)
 * - Démonstration interactive intégrée dans la maquette du Hero
 * - Simulateur multi-support (Téléphone / Tablette / Ordinateur)
 */

document.addEventListener('DOMContentLoaded', () => {
  initThemeSwitcher();
  initNavbarScroll();
  initMobileMenu();
  initFaqAccordion();
  initModals();
  initInteractiveHeroDemo();
  initDeviceSimulator();
  initTimeSavingsCalculator();
  initStickyBottomBar();
  initMotionNarrative();
  initPwaInstall();
});

/**
 * Gestion du Mode Clair / Mode Sombre
 */
function initThemeSwitcher() {
  const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    const landingIcon = document.getElementById('landingThemeIcon');
    const mobileHeaderIcon = document.getElementById('mobileHeaderThemeIcon');
    const mobileIcon = document.getElementById('mobileThemeIcon');
    const mobileLabel = document.getElementById('mobileThemeLabel');

    if (landingIcon) landingIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    if (mobileHeaderIcon) mobileHeaderIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    if (mobileIcon) mobileIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    if (mobileLabel) mobileLabel.textContent = theme === 'dark' ? 'Mode Clair' : 'Mode Sombre';
  };

  const toggleTheme = () => {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('gestion_dipe_theme', next);
    } catch (e) {}
    applyTheme(next);
  };

  const saved = localStorage.getItem('gestion_dipe_theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = saved || (prefersDark ? 'dark' : 'light');
  applyTheme(initialTheme);

  const desktopBtn = document.getElementById('landingThemeToggleBtn');
  if (desktopBtn) desktopBtn.addEventListener('click', toggleTheme);

  const mobileHeaderBtn = document.getElementById('mobileHeaderThemeBtn');
  if (mobileHeaderBtn) mobileHeaderBtn.addEventListener('click', toggleTheme);

  const mobileBtn = document.getElementById('mobileThemeToggleBtn');
  if (mobileBtn) mobileBtn.addEventListener('click', toggleTheme);
}

/**
 * Effet glassmorphism dynamique sur la barre de navigation
 */
function initNavbarScroll() {
  const nav = document.querySelector('.landing-nav');
  if (!nav) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  });
}

/**
 * Menu mobile hamburger accessible
 */
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobileMenuToggle');
  const drawer = document.getElementById('mobileMenuDrawer');

  if (toggleBtn && drawer) {
    toggleBtn.addEventListener('click', () => {
      const isOpen = drawer.classList.toggle('is-open');
      toggleBtn.setAttribute('aria-expanded', isOpen);
      toggleBtn.innerHTML = isOpen 
        ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>`
        : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`;
    });

    drawer.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        drawer.classList.remove('is-open');
        toggleBtn.setAttribute('aria-expanded', false);
        toggleBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`;
      });
    });
  }
}

/**
 * Accordéon FAQ accessible avec ARIA
 */
function initFaqAccordion() {
  const faqButtons = document.querySelectorAll('.faq-question-btn');
  faqButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const parentItem = btn.closest('.faq-item');
      const isCurrentlyOpen = parentItem.classList.contains('is-open');

      document.querySelectorAll('.faq-item').forEach(item => {
        item.classList.remove('is-open');
        const itemBtn = item.querySelector('.faq-question-btn');
        if (itemBtn) itemBtn.setAttribute('aria-expanded', 'false');
      });

      if (!isCurrentlyOpen) {
        parentItem.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

/**
 * Modales de connexion et référencement
 */
function initModals() {
  const openOnboardBtns = document.querySelectorAll('[data-action="open-onboarding"]');
  const onboardBackdrop = document.getElementById('onboardingModal');
  const closeOnboardBtn = document.getElementById('closeOnboardingModal');

  openOnboardBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (onboardBackdrop) {
        onboardBackdrop.classList.add('is-open');
        if (window.Onboarding) {
          Onboarding.init();
          Onboarding.goToStep(1);
        }
      }
    });
  });

  if (closeOnboardBtn && onboardBackdrop) {
    closeOnboardBtn.addEventListener('click', () => {
      onboardBackdrop.classList.remove('is-open');
    });
  }

  // Modale de connexion Directeur & Établissement
  const openLoginBtns = document.querySelectorAll('[data-action="open-login"]');
  const loginBackdrop = document.getElementById('loginModal');
  const closeLoginBtn = document.getElementById('closeLoginModal');

  // Onglets et canaux
  const tabPhone = document.getElementById('tabChannelPhone');
  const tabEmail = document.getElementById('tabChannelEmail');
  const panelPhone = document.getElementById('panelPhoneChannel');
  const panelEmail = document.getElementById('panelEmailChannel');

  // Étapes
  const step1 = document.getElementById('loginStep1');
  const step2 = document.getElementById('loginStep2');
  const btnSendOtp = document.getElementById('btnSendOtp');
  const btnQuickDemo = document.getElementById('btnQuickDemoLogin');
  const btnVerifyAndLogin = document.getElementById('btnVerifyAndLogin');
  const btnBackToStep1 = document.getElementById('btnBackToStep1');
  const btnResendOtp = document.getElementById('btnResendOtp');
  const simulatedOtpCode = document.getElementById('simulatedOtpCode');
  const otpTargetDisplay = document.getElementById('otpTargetDisplay');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const loginPassword = document.getElementById('loginPassword');

  let currentChannel = 'phone';
  let currentOtp = '4821';

  // Ouverture
  openLoginBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (loginBackdrop) {
        loginBackdrop.classList.add('is-open');
        // Réinitialise à l'étape 1
        if (step1) step1.style.display = 'block';
        if (step2) step2.style.display = 'none';
      }
    });
  });

  // Fermeture
  if (closeLoginBtn && loginBackdrop) {
    closeLoginBtn.addEventListener('click', () => {
      loginBackdrop.classList.remove('is-open');
    });
  }

  // Fermeture au clic sur le fond
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) {
      e.target.classList.remove('is-open');
    }
  });

  // Changement d'onglets Canal
  if (tabPhone && tabEmail) {
    tabPhone.addEventListener('click', () => {
      currentChannel = 'phone';
      tabPhone.classList.add('is-active');
      tabPhone.setAttribute('aria-selected', 'true');
      tabEmail.classList.remove('is-active');
      tabEmail.setAttribute('aria-selected', 'false');
      if (panelPhone) panelPhone.style.display = 'block';
      if (panelEmail) panelEmail.style.display = 'none';
    });

    tabEmail.addEventListener('click', () => {
      currentChannel = 'email';
      tabEmail.classList.add('is-active');
      tabEmail.setAttribute('aria-selected', 'true');
      tabPhone.classList.remove('is-active');
      tabPhone.setAttribute('aria-selected', 'false');
      if (panelEmail) panelEmail.style.display = 'block';
      if (panelPhone) panelPhone.style.display = 'none';
    });
  }

  // Accès rapide démo en 1 clic
  if (btnQuickDemo) {
    btnQuickDemo.addEventListener('click', () => {
      btnQuickDemo.textContent = 'Accès en cours...';
      setTimeout(() => {
        window.location.href = 'app.html';
      }, 200);
    });
  }

  // Étape 1 : Envoi du code OTP
  if (btnSendOtp) {
    btnSendOtp.addEventListener('click', () => {
      let targetText = '';
      if (currentChannel === 'phone') {
        const phoneInput = document.getElementById('loginPhone');
        const phoneVal = phoneInput ? phoneInput.value.trim() : '';
        if (!phoneVal) {
          alert('Veuillez renseigner votre numéro de téléphone.');
          if (phoneInput) phoneInput.focus();
          return;
        }
        const deliveryMethod = document.querySelector('input[name="otpDelivery"]:checked')?.value || 'whatsapp';
        const channelName = deliveryMethod === 'whatsapp' ? 'WhatsApp' : 'SMS';
        targetText = `+221 ${phoneVal} via ${channelName}`;
      } else {
        const emailInput = document.getElementById('loginEmail');
        const emailVal = emailInput ? emailInput.value.trim() : '';
        if (!emailVal || !emailVal.includes('@')) {
          alert('Veuillez saisir une adresse e-mail valide.');
          if (emailInput) emailInput.focus();
          return;
        }
        targetText = `${emailVal} via E-mail`;
      }

      // Génère un code à 4 chiffres (ou garde 4821 pour consistance)
      currentOtp = '4821';
      if (simulatedOtpCode) simulatedOtpCode.textContent = currentOtp;
      if (otpTargetDisplay) otpTargetDisplay.textContent = targetText;

      // Bascule vers l'étape 2
      if (step1) step1.style.display = 'none';
      if (step2) step2.style.display = 'block';

      // Vide et focus le premier chiffre
      for (let i = 1; i <= 4; i++) {
        const digitEl = document.getElementById(`otpDigit${i}`);
        if (digitEl) digitEl.value = '';
      }
      const firstDigit = document.getElementById('otpDigit1');
      if (firstDigit) firstDigit.focus();
    });
  }

  // Gestion des 4 cases OTP
  const otpInputs = [
    document.getElementById('otpDigit1'),
    document.getElementById('otpDigit2'),
    document.getElementById('otpDigit3'),
    document.getElementById('otpDigit4')
  ].filter(Boolean);

  otpInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      // Nettoie pour ne garder que des chiffres
      input.value = input.value.replace(/[^0-9]/g, '');
      if (input.value.length >= 1) {
        input.value = input.value.slice(-1);
        // Passe au chiffre suivant
        if (index < otpInputs.length - 1) {
          otpInputs[index + 1].focus();
        } else {
          // Dernier chiffre : focus mot de passe
          if (loginPassword) loginPassword.focus();
        }
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && index > 0) {
        otpInputs[index - 1].focus();
      }
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasteData = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
      if (pasteData) {
        for (let i = 0; i < otpInputs.length; i++) {
          if (pasteData[i]) otpInputs[i].value = pasteData[i];
        }
        if (loginPassword) loginPassword.focus();
      }
    });
  });

  // Clic sur le badge de code simulé pour auto-remplir
  if (simulatedOtpCode) {
    simulatedOtpCode.addEventListener('click', () => {
      const codeStr = simulatedOtpCode.textContent.trim();
      for (let i = 0; i < otpInputs.length; i++) {
        if (codeStr[i]) otpInputs[i].value = codeStr[i];
      }
      if (loginPassword) loginPassword.focus();
    });
  }

  // Bascule visibilité mot de passe
  if (togglePasswordBtn && loginPassword) {
    togglePasswordBtn.addEventListener('click', () => {
      if (loginPassword.type === 'password') {
        loginPassword.type = 'text';
        togglePasswordBtn.textContent = '🙈';
      } else {
        loginPassword.type = 'password';
        togglePasswordBtn.textContent = '👁️';
      }
    });
  }

  // Retour à l'étape 1
  if (btnBackToStep1) {
    btnBackToStep1.addEventListener('click', () => {
      if (step2) step2.style.display = 'none';
      if (step1) step1.style.display = 'block';
    });
  }

  // Renvoyer un code
  if (btnResendOtp) {
    btnResendOtp.addEventListener('click', () => {
      const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
      currentOtp = newOtp;
      if (simulatedOtpCode) simulatedOtpCode.textContent = currentOtp;
      alert(`Nouveau code de vérification envoyé : ${currentOtp}`);
      const firstDigit = document.getElementById('otpDigit1');
      if (firstDigit) firstDigit.focus();
    });
  }

  // Étape 2 : Vérification du code et connexion
  if (btnVerifyAndLogin) {
    btnVerifyAndLogin.addEventListener('click', () => {
      const enteredOtp = otpInputs.map(i => i.value).join('');
      if (enteredOtp.length < 4) {
        alert('Veuillez saisir les 4 chiffres du code de vérification reçu.');
        const emptyInput = otpInputs.find(i => !i.value) || otpInputs[0];
        if (emptyInput) emptyInput.focus();
        return;
      }

      if (!loginPassword || !loginPassword.value.trim()) {
        alert('Veuillez renseigner votre mot de passe pour accéder à votre espace.');
        if (loginPassword) loginPassword.focus();
        return;
      }

      // Connexion réussie
      btnVerifyAndLogin.innerHTML = '<span>Connexion réussie...</span>';
      btnVerifyAndLogin.disabled = true;

      setTimeout(() => {
        window.location.href = 'app.html';
      }, 350);
    });
  }
}

/**
 * Démo interactive dans la maquette du Hero
 * Permet au visiteur de tester le clic Payé / Impayé et voir les calculs se faire en direct !
 */
function initInteractiveHeroDemo() {
  const mockRows = document.querySelectorAll('.hero-demo-row');
  const totalPaidBadge = document.getElementById('heroDemoPaidCount');
  const totalAmountBadge = document.getElementById('heroDemoAmountCount');
  const demoToast = document.getElementById('heroDemoToast');
  let toastTimer = null;

  mockRows.forEach(row => {
    const btnPaid = row.querySelector('.demo-btn-paid');
    const btnUnpaid = row.querySelector('.demo-btn-unpaid');

    if (btnPaid && btnUnpaid) {
      btnPaid.addEventListener('click', () => {
        btnPaid.classList.add('is-active');
        btnUnpaid.classList.remove('is-active');
        updateDemoCalculations();
        showDemoCelebration(row);
      });

      btnUnpaid.addEventListener('click', () => {
        btnUnpaid.classList.add('is-active');
        btnPaid.classList.remove('is-active');
        updateDemoCalculations();
      });
    }
  });

  function showDemoCelebration(row) {
    if (!demoToast) return;
    const name = row.querySelector('strong')?.textContent || 'Élève';
    const fee = parseInt(row.getAttribute('data-fee') || '15000', 10);
    demoToast.innerHTML = `<span>✓ Reçu officiel généré pour <strong>${name}</strong> (+${Utils.formatFCFA(fee)}) !</span>`;
    demoToast.classList.add('is-active');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      demoToast.classList.remove('is-active');
    }, 2800);
  }

  function updateDemoCalculations() {
    let paidCount = 0;
    let totalAmount = 0;

    mockRows.forEach(row => {
      const isPaid = row.querySelector('.demo-btn-paid').classList.contains('is-active');
      const amount = parseInt(row.getAttribute('data-fee') || '15000', 10);
      if (isPaid) {
        paidCount++;
        totalAmount += amount;
      }
    });

    if (totalPaidBadge) {
      totalPaidBadge.textContent = `${paidCount} payés`;
    }
    if (totalAmountBadge) {
      totalAmountBadge.textContent = Utils.formatFCFA(totalAmount);
    }
  }
}

/**
 * Simulateur multi-support (Téléphone / Tablette / Ordinateur)
 */
function initDeviceSimulator() {
  const buttons = document.querySelectorAll('[data-simulator-target]');
  const frame = document.getElementById('simulatorDeviceFrame');
  const deviceLabel = document.getElementById('simulatorDeviceLabel');
  const desktopView = document.getElementById('simViewDesktop');
  const tabletView = document.getElementById('simViewTablet');
  const phoneView = document.getElementById('simViewPhone');

  if (!frame || buttons.length === 0) return;

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-simulator-target');

      // Gestion des boutons actifs
      buttons.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      // Mise à jour de la classe de largeur du conteneur
      frame.className = `simulator-device-frame view-${target}`;

      // Affichage du bon layout de démo
      if (desktopView) desktopView.style.display = target === 'desktop' ? 'block' : 'none';
      if (tabletView) tabletView.style.display = target === 'tablet' ? 'block' : 'none';
      if (phoneView) phoneView.style.display = target === 'phone' ? 'block' : 'none';

      // Libellé
      if (deviceLabel) {
        if (target === 'desktop') deviceLabel.textContent = "Affichage Grand Écran / Ordinateur (Navigation latérale & Tableaux complets)";
        if (target === 'tablet') deviceLabel.textContent = "Affichage Tablette / iPad (Grilles adaptatives & Vue par section)";
        if (target === 'phone') deviceLabel.textContent = "Affichage Mobile / Android (Cartes tactiles empilées & Barre à 5 icônes)";
      }
    });
  });
}

/**
 * Calculateur interactif de gain de temps et d'économies
 */
function initTimeSavingsCalculator() {
  const slider = document.getElementById('calcStudentSlider');
  const badge = document.getElementById('calcStudentCountBadge');
  const hoursEl = document.getElementById('calcHoursSaved');
  const amountEl = document.getElementById('calcAmountSecured');
  const btnEl = document.getElementById('calcCtaBtn');

  if (!slider) return;

  const updateCalc = () => {
    const count = parseInt(slider.value, 10);
    if (badge) badge.textContent = `${count} élèves`;
    if (hoursEl) {
      const hours = Math.round(count * 0.22);
      hoursEl.textContent = `~${hours} h / mois`;
    }
    if (amountEl) {
      const avgFee = 15000;
      amountEl.textContent = Utils.formatFCFA(count * avgFee);
    }
    if (btnEl) {
      btnEl.innerHTML = `<span>👉 Référencer mes ${count} élèves gratuitement</span> <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
    }
  };

  slider.addEventListener('input', updateCalc);
  updateCalc();
}

/**
 * Barre d'appel à l'action flottante au scroll
 */
function initStickyBottomBar() {
  const bar = document.getElementById('stickyBottomBar');
  if (!bar) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 450) {
      bar.classList.add('is-visible');
    } else {
      bar.classList.remove('is-visible');
    }
  });
}

/**
 * Animation narrative Motion Design (3 Actes : Arrivée -> Règlement 10 000 FCFA -> Reçu certifié WhatsApp)
 * Style : Vert / Noir / Blanc avec progression fluide et commandes interactives
 */
function initMotionNarrative() {
  const slides = document.querySelectorAll('.motion-scene-slide');
  const stepButtons = document.querySelectorAll('.motion-step-btn');
  const playPauseBtn = document.getElementById('motionPlayPauseBtn');
  const playIcon = document.getElementById('motionPlayIcon');
  const playLabel = document.getElementById('motionPlayLabel');
  const stageCard = document.getElementById('motionStageCard');

  if (!slides.length || !stepButtons.length) return;

  const SLIDE_DURATION = 6000; // 6 secondes par acte
  let currentStep = 1;
  let isPlaying = true;
  let startTime = null;
  let animationFrameId = null;
  let elapsedBeforePause = 0;

  function showSlide(stepNumber, resetProgress = true) {
    currentStep = stepNumber;

    slides.forEach((slide) => {
      const slideStep = parseInt(slide.getAttribute('data-slide'), 10);
      if (slideStep === currentStep) {
        slide.style.display = 'grid';
        slide.classList.add('is-active');
      } else {
        slide.style.display = 'none';
        slide.classList.remove('is-active');
      }
    });

    stepButtons.forEach((btn) => {
      const btnStep = parseInt(btn.getAttribute('data-step'), 10);
      const fill = btn.querySelector('.step-progress-fill');
      
      if (btnStep < currentStep) {
        btn.classList.add('is-active');
        btn.setAttribute('aria-selected', 'false');
        if (fill) fill.style.width = '100%';
      } else if (btnStep === currentStep) {
        btn.classList.add('is-active');
        btn.setAttribute('aria-selected', 'true');
        if (fill) fill.style.width = '0%';
      } else {
        btn.classList.remove('is-active');
        btn.setAttribute('aria-selected', 'false');
        if (fill) fill.style.width = '0%';
      }
    });

    if (resetProgress) {
      elapsedBeforePause = 0;
      startTime = performance.now();
    }
  }

  function tick(now) {
    if (!isPlaying) return;

    if (!startTime) startTime = now - elapsedBeforePause;
    const elapsed = now - startTime;
    const progress = Math.min(100, (elapsed / SLIDE_DURATION) * 100);

    const activeBtn = document.querySelector(`.motion-step-btn[data-step="${currentStep}"]`);
    if (activeBtn) {
      const fill = activeBtn.querySelector('.step-progress-fill');
      if (fill) fill.style.width = `${progress}%`;
    }

    if (elapsed >= SLIDE_DURATION) {
      const nextStep = currentStep === 3 ? 1 : currentStep + 1;
      showSlide(nextStep, true);
    }

    animationFrameId = requestAnimationFrame(tick);
  }

  function pause() {
    if (!isPlaying) return;
    isPlaying = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (startTime) elapsedBeforePause = performance.now() - startTime;
    if (playIcon) playIcon.textContent = '▶️';
    if (playLabel) playLabel.textContent = 'Reprendre la lecture';
    if (playPauseBtn) playPauseBtn.setAttribute('aria-label', "Reprendre l'animation");
  }

  function play() {
    if (isPlaying) return;
    isPlaying = true;
    startTime = performance.now() - elapsedBeforePause;
    if (playIcon) playIcon.textContent = '⏸️';
    if (playLabel) playLabel.textContent = 'Animation automatique en cours';
    if (playPauseBtn) playPauseBtn.setAttribute('aria-label', "Mettre en pause l'animation");
    animationFrameId = requestAnimationFrame(tick);
  }

  // Clic sur les boutons d'étapes (01, 02, 03)
  stepButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = parseInt(btn.getAttribute('data-step'), 10);
      showSlide(step, true);
    });
  });

  // Boutons Suivant / Précédent dans les diapositives
  document.querySelectorAll('.motion-next-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextStep = currentStep === 3 ? 1 : currentStep + 1;
      showSlide(nextStep, true);
    });
  });

  document.querySelectorAll('.motion-prev-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prevStep = currentStep === 1 ? 3 : currentStep - 1;
      showSlide(prevStep, true);
    });
  });

  // Bouton Lecture / Pause
  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
      if (isPlaying) pause();
      else play();
    });
  }

  // Pause sur survol pour confort de lecture
  if (stageCard) {
    stageCard.addEventListener('mouseenter', () => {
      if (isPlaying) pause();
    });
    stageCard.addEventListener('mouseleave', () => {
      if (!isPlaying && playIcon && playIcon.textContent === '⏸️') play();
    });
  }

  // Démarrer la première scène et la boucle
  showSlide(1, true);
  animationFrameId = requestAnimationFrame(tick);
}

/**
 * Progressive Web App (PWA) - Détection et installation en 1 clic
 * Support Android / Chrome (beforeinstallprompt) & iOS Safari (Guide Ajout à l'écran d'accueil)
 */
function initPwaInstall() {
  let deferredPrompt = null;
  const installBanner = document.getElementById('pwaInstallBanner');
  const bannerCloseBtn = document.getElementById('pwaBannerCloseBtn');
  const allInstallTriggers = document.querySelectorAll('.pwa-install-trigger');
  const iosModal = document.getElementById('iosInstallModal');
  const iosCloseBtn = document.getElementById('iosModalCloseBtn');
  const iosDoneBtn = document.getElementById('iosModalDoneBtn');

  // Détection iOS
  const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  // Si déjà installé en mode standalone, masquer les boutons et la bannière
  if (isStandalone) {
    console.log('[PWA] Application déjà lancée en mode autonome (PWA installée).');
    allInstallTriggers.forEach((btn) => {
      btn.style.display = 'none';
    });
    return;
  }

  // Rendre visibles tous les déclencheurs d'installation (nav, tiroir mobile)
  allInstallTriggers.forEach((btn) => {
    btn.style.display = 'inline-flex';
  });

  // Interception de l'événement natif Chrome/Android
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Afficher la bannière si non fermée précédemment dans la session
    const isDismissed = sessionStorage.getItem('pwa_banner_dismissed') === '1';
    if (!isDismissed && installBanner) {
      setTimeout(() => {
        installBanner.style.display = 'flex';
      }, 2500); // Apparition douce après 2.5s
    }
  });

  // Action d'installation au clic sur n'importe quel bouton PWA
  allInstallTriggers.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();

      if (deferredPrompt) {
        // Déclencheur Chrome / Edge / Samsung Internet
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('[PWA] Résultat installation :', outcome);
        if (outcome === 'accepted') {
          if (installBanner) installBanner.style.display = 'none';
        }
        deferredPrompt = null;
      } else if (isIos) {
        // Safari iOS : afficher le guide pas à pas
        if (iosModal) iosModal.style.display = 'flex';
      } else {
        // Navigateur desktop ou Android sans prompt actif : ouvrir bannière ou instructions
        if (installBanner) {
          installBanner.style.display = 'flex';
        }
        alert("📲 Pour installer Gestion DIPE sur votre écran d'accueil :\n\n• Sur Google Chrome / Edge : Cliquez sur l'icône « Installer » (⊕) située à droite de la barre d'adresse.\n• Sur Safari (iPhone/iPad) : Touchez l'icône Partager puis « Sur l'écran d'accueil ».");
      }
    });
  });

  // Fermeture de la bannière flottante
  if (bannerCloseBtn && installBanner) {
    bannerCloseBtn.addEventListener('click', () => {
      installBanner.style.display = 'none';
      try {
        sessionStorage.setItem('pwa_banner_dismissed', '1');
      } catch (e) {}
    });
  }

  // Gestion de la modale iOS
  const closeIosModal = () => {
    if (iosModal) iosModal.style.display = 'none';
  };

  if (iosCloseBtn) iosCloseBtn.addEventListener('click', closeIosModal);
  if (iosDoneBtn) iosDoneBtn.addEventListener('click', closeIosModal);
  if (iosModal) {
    iosModal.addEventListener('click', (e) => {
      if (e.target === iosModal) closeIosModal();
    });
  }

  // Événement quand l'installation est terminée
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] Application installée avec succès !');
    if (installBanner) installBanner.style.display = 'none';
    allInstallTriggers.forEach((btn) => {
      btn.style.display = 'none';
    });
    deferredPrompt = null;
  });
}

