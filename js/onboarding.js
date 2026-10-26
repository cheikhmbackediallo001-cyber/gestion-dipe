/**
 * WIZARD DE RÉFÉRENCEMENT D'ÉCOLE (ONBOARDING DIRECTEUR) - GESTION DIPE
 * Conforme à la spécification § 3.1 :
 * - Formulaire multi-étapes courtes avec indicateur de progression
 * - Validation stricte du téléphone sénégalais (+221 7X XXX XX XX)
 * - Menus déroulants en cascade (Région -> Département -> Commune)
 * - Configuration des classes et mensualités
 * - Génération instantanée et validation du cachet vectoriel officiel
 */

const Onboarding = {
  currentStep: 1,
  totalSteps: 4,
  formData: {
    schoolName: '',
    directorName: '',
    directorPhone: '',
    email: '',
    password: '',
    region: 'Dakar',
    department: 'Dakar',
    commune: 'Plateau',
    address: '',
    schoolYear: '2026-2027',
    classes: [
      { name: 'Crèche', registration_fee: 25000, monthly_fee: 15000 },
      { name: 'Petite section', registration_fee: 25000, monthly_fee: 15000 },
      { name: 'Moyenne section', registration_fee: 25000, monthly_fee: 15000 },
      { name: 'Grande section', registration_fee: 30000, monthly_fee: 18000 }
    ]
  },

  init() {
    this.bindEvents();
    this.populateRegions();
  },

  bindEvents() {
    // Écouteurs de navigation wizard
    const nextBtn = document.getElementById('onboardingNextBtn');
    const prevBtn = document.getElementById('onboardingPrevBtn');
    const submitBtn = document.getElementById('onboardingSubmitBtn');

    if (nextBtn) nextBtn.addEventListener('click', () => this.nextStep());
    if (prevBtn) prevBtn.addEventListener('click', () => this.prevStep());
    if (submitBtn) submitBtn.addEventListener('click', () => this.submit());

    // Cascade Sénégal
    const regionSelect = document.getElementById('onboardRegion');
    const deptSelect = document.getElementById('onboardDepartment');

    if (regionSelect) {
      regionSelect.addEventListener('change', (e) => this.onRegionChange(e.target.value));
    }
    if (deptSelect) {
      deptSelect.addEventListener('change', (e) => this.onDepartmentChange(e.target.value));
    }
  },

  populateRegions() {
    const regionSelect = document.getElementById('onboardRegion');
    if (!regionSelect) return;

    regionSelect.innerHTML = '';
    const regions = Object.keys(CONFIG.SENEGAL_REGIONS);
    regions.forEach(reg => {
      const opt = document.createElement('option');
      opt.value = reg;
      opt.textContent = reg;
      regionSelect.appendChild(opt);
    });

    this.onRegionChange(regions[0] || 'Dakar');
  },

  onRegionChange(region) {
    const deptSelect = document.getElementById('onboardDepartment');
    if (!deptSelect) return;

    deptSelect.innerHTML = '';
    const departments = Object.keys(CONFIG.SENEGAL_REGIONS[region] || {});
    departments.forEach(dept => {
      const opt = document.createElement('option');
      opt.value = dept;
      opt.textContent = dept;
      deptSelect.appendChild(opt);
    });

    this.onDepartmentChange(departments[0] || '');
  },

  onDepartmentChange(dept) {
    const communeSelect = document.getElementById('onboardCommune');
    const regionSelect = document.getElementById('onboardRegion');
    if (!communeSelect || !regionSelect) return;

    const region = regionSelect.value;
    communeSelect.innerHTML = '';
    const communes = (CONFIG.SENEGAL_REGIONS[region] && CONFIG.SENEGAL_REGIONS[region][dept]) || [];
    communes.forEach(com => {
      const opt = document.createElement('option');
      opt.value = com;
      opt.textContent = com;
      communeSelect.appendChild(opt);
    });
  },

  validateCurrentStep() {
    let isValid = true;
    const stepEl = document.getElementById(`onboardStep${this.currentStep}`);
    if (!stepEl) return true;

    // Reset des erreurs
    stepEl.querySelectorAll('.form-group').forEach(fg => fg.classList.remove('has-error'));

    if (this.currentStep === 1) {
      const name = document.getElementById('onboardSchoolName').value.trim();
      const dirName = document.getElementById('onboardDirectorName').value.trim();
      const phone = document.getElementById('onboardDirectorPhone').value.trim();
      const email = document.getElementById('onboardEmail').value.trim();
      const pass = document.getElementById('onboardPassword').value;

      if (!name) {
        document.getElementById('groupSchoolName').classList.add('has-error');
        isValid = false;
      }
      if (!dirName) {
        document.getElementById('groupDirectorName').classList.add('has-error');
        isValid = false;
      }
      if (!Utils.validateSenegalPhone(phone)) {
        document.getElementById('groupDirectorPhone').classList.add('has-error');
        isValid = false;
      }
      if (!email || !email.includes('@')) {
        document.getElementById('groupEmail').classList.add('has-error');
        isValid = false;
      }
      let passwordOk = true;
      try { Auth.validatePasswordStrength(pass); } catch (e) { passwordOk = false; }
      if (!passwordOk) {
        document.getElementById('groupPassword').classList.add('has-error');
        isValid = false;
      }

      if (isValid) {
        this.formData.schoolName = name;
        this.formData.directorName = dirName;
        this.formData.directorPhone = Utils.normalizeSenegalPhone(phone);
        this.formData.email = email;
        this.formData.password = pass;
      }
    } else if (this.currentStep === 2) {
      this.formData.region = document.getElementById('onboardRegion').value;
      this.formData.department = document.getElementById('onboardDepartment').value;
      this.formData.commune = document.getElementById('onboardCommune').value;
      this.formData.address = document.getElementById('onboardAddress').value.trim();
    } else if (this.currentStep === 3) {
      // Lecture des classes configurées
      this.formData.schoolYear = document.getElementById('onboardSchoolYear').value.trim() || '2026-2027';
      // Validation des montants positifs
      const crecheReg = parseInt(document.getElementById('feeCrecheReg') ? document.getElementById('feeCrecheReg').value : 25000, 10) || 25000;
      const crecheMonth = parseInt(document.getElementById('feeCrecheMonth') ? document.getElementById('feeCrecheMonth').value : 15000, 10) || 15000;
      const psReg = parseInt(document.getElementById('feePsReg').value, 10) || 0;
      const psMonth = parseInt(document.getElementById('feePsMonth').value, 10) || 0;
      const msReg = parseInt(document.getElementById('feeMsReg').value, 10) || 0;
      const msMonth = parseInt(document.getElementById('feeMsMonth').value, 10) || 0;
      const gsReg = parseInt(document.getElementById('feeGsReg').value, 10) || 0;
      const gsMonth = parseInt(document.getElementById('feeGsMonth').value, 10) || 0;

      this.formData.classes = [
        { name: 'Crèche', registration_fee: crecheReg, monthly_fee: crecheMonth },
        { name: 'Petite section', registration_fee: psReg, monthly_fee: psMonth },
        { name: 'Moyenne section', registration_fee: msReg, monthly_fee: msMonth },
        { name: 'Grande section', registration_fee: gsReg, monthly_fee: gsMonth }
      ];
    }

    return isValid;
  },

  nextStep() {
    if (!this.validateCurrentStep()) return;

    if (this.currentStep < this.totalSteps) {
      this.goToStep(this.currentStep + 1);
    }
  },

  prevStep() {
    if (this.currentStep > 1) {
      this.goToStep(this.currentStep - 1);
    }
  },

  goToStep(stepNumber) {
    this.currentStep = stepNumber;

    // Mise à jour de l'affichage des panneaux
    for (let i = 1; i <= this.totalSteps; i++) {
      const panel = document.getElementById(`onboardStep${i}`);
      const indicator = document.getElementById(`stepIndicator${i}`);
      if (panel) panel.style.display = i === stepNumber ? 'block' : 'none';
      if (indicator) {
        // Reset styles
        indicator.style.cssText = 'width:30px; height:30px; border-radius:50%; display:inline-flex; justify-content:center; align-items:center; font-weight:700; font-size:13px;';
        if (i < stepNumber) {
          indicator.className = 'badge badge-success';
          indicator.innerHTML = '✓';
        } else if (i === stepNumber) {
          indicator.className = 'badge badge-primary';
          indicator.innerHTML = i;
        } else {
          indicator.className = 'badge badge-neutral';
          indicator.innerHTML = i;
        }
      }
    }

    // Gestion des boutons
    const prevBtn = document.getElementById('onboardingPrevBtn');
    const nextBtn = document.getElementById('onboardingNextBtn');
    const submitBtn = document.getElementById('onboardingSubmitBtn');

    if (prevBtn) prevBtn.style.display = stepNumber === 1 ? 'none' : 'inline-flex';
    if (nextBtn) nextBtn.style.display = stepNumber === this.totalSteps ? 'none' : 'inline-flex';
    if (submitBtn) submitBtn.style.display = stepNumber === this.totalSteps ? 'inline-flex' : 'none';

    // À l'étape 4 : Génération de l'aperçu du cachet (§ 3.1 & § 6)
    if (stepNumber === 4) {
      this.renderStampPreview();
    }
  },

  renderStampPreview() {
    const previewContainer = document.getElementById('onboardStampPreview');
    if (!previewContainer) return;

    const stampSvg = SchoolStamp.generateSVG({
      name: this.formData.schoolName,
      director_name: this.formData.directorName,
      director_phone: this.formData.directorPhone,
      commune: this.formData.commune,
      region: this.formData.region
    }, 220);

    previewContainer.innerHTML = stampSvg;

    // Résumé textuel
    const detailsContainer = document.getElementById('onboardStampSummary');
    if (detailsContainer) {
      detailsContainer.innerHTML = `
        <div style="font-size: var(--text-sm); line-height: 1.5; color: var(--text-main);">
          <p><strong>Établissement :</strong> ${Utils.escapeHtml(this.formData.schoolName)}</p>
          <p><strong>Directeur(rice) :</strong> ${Utils.escapeHtml(this.formData.directorName)}</p>
          <p><strong>Téléphone cachet :</strong> ${Utils.escapeHtml(this.formData.directorPhone)}</p>
          <p><strong>Localisation :</strong> ${Utils.escapeHtml(this.formData.commune)}, ${Utils.escapeHtml(this.formData.region)}</p>
          <p><strong>Année scolaire :</strong> ${Utils.escapeHtml(this.formData.schoolYear)}</p>
        </div>
      `;
    }
  },

  async submit() {
    const submitBtn = document.getElementById('onboardingSubmitBtn');
    const originalText = submitBtn ? submitBtn.innerHTML : 'Valider et accéder à mon école';

    // Nettoyage des erreurs existantes
    let errorContainer = document.getElementById('onboardGlobalError');
    if (errorContainer) {
      errorContainer.remove();
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
          <span style="display:inline-flex; align-items:center; gap:0.5rem;">
            <svg class="spin-animation" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10"></path></svg>
            Création de votre école...
          </span>
        `;
      }

      // Exécution de la séquence atomique complète via Auth
      await Auth.registerSchoolAtomic(this.formData);
      this.formData.password = ''; // Ne pas conserver le mot de passe en mémoire

      if (submitBtn) {
        submitBtn.innerHTML = '<span>Établissement créé ! Redirection...</span>';
      }

      // Redirection immédiate vers l'espace école sans retour arrière possible vers le formulaire
      window.history.replaceState(null, '', 'app.html?onboarding=success');
      window.location.replace('app.html?onboarding=success');

    } catch (err) {
      console.error('[Onboarding] Erreur séquence atomique:', err);

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }

      // Affichage d'un message d'erreur clair
      const modalBody = document.querySelector('#onboardingModal .modal-body');
      if (modalBody) {
        errorContainer = document.createElement('div');
        errorContainer.id = 'onboardGlobalError';
        errorContainer.style.cssText = `
          background: #FEE2E2;
          color: #991B1B;
          border-left: 4px solid var(--danger, #DC2626);
          padding: 0.875rem 1rem;
          border-radius: var(--radius-md, 8px);
          font-size: var(--text-sm, 13px);
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
        `;
        errorContainer.innerHTML = `
          <span style="font-size:1.2rem;">⚠️</span>
          <span>${Utils.escapeHtml(err.message || "Une erreur est survenue lors de l'enregistrement.")}</span>
        `;
        modalBody.prepend(errorContainer);
        errorContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        alert(err.message || "Erreur lors de la création de l'établissement.");
      }
    }
  }
};

window.Onboarding = Onboarding;
