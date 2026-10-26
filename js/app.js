/**
 * LOGIQUE APPLICATIVE COMPLETE - GESTION DIPE
 * Gère le routage par onglets, les formulaires, les calculs, les modales
 * et la génération des reçus officiels A5.
 */

const App = {
  currentTab: 'dashboard',
  activeBilanSubTab: 'total', // 'total' | 'registrations' | 'monthly'
  currentMonthId: null,
  activeClassFilter: 'all',
  activeStatusFilter: 'all',
  activeExpenseRubriqueFilter: 'all',
  searchTerm: '',

  async init() {
    try {
      if (window.Auth) {
        await Auth.init();
        if (!Auth.requireAuth()) {
          return; // Non authentifié, redirection vers index.html
        }
      }

      await Store.init();

      // Définition du mois courant par défaut (mois calendaire du jour)
      const currentMonth = Store.getCurrentMonth();
      if (currentMonth) {
        this.currentMonthId = currentMonth.id;
      }
    } catch (e) {
      console.warn("[App] Initialisation résiliente:", e);
    }

    try {
      this.initTheme();
      this.bindGlobalEvents();
      this.renderHeader();
    } catch (e) {
      console.warn("[App] Initialisation UI résiliente:", e);
    }

    // Synchronisation cloud en arrière-plan (sauvegarde + reçus vérifiables depuis tout téléphone)
    if (window.CloudSync) {
      document.addEventListener('cloudsync-status', () => {
        if (this.currentTab === 'settings') this.updateCloudSyncCard();
      });
      CloudSync.startupSync(() => {
        this.renderHeader();
        this.navigate(this.currentTab, { preserveFilters: true, keepScroll: true });
        this.showToast("Données mises à jour depuis votre sauvegarde en ligne.", "info");
      }).catch(() => {});
    }

    // Support de l'installation PWA
    const showAppInstallBtn = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true || window.__isPwaStandalone;
      if (!isStandalone) {
        const btn = document.getElementById('btnPwaInstallApp');
        if (btn) btn.style.display = 'inline-flex';
      }
    };

    if (window.deferredPwaPrompt) {
      showAppInstallBtn();
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      window.deferredPwaPrompt = e;
      window.__pwaPromptReady = true;
      showAppInstallBtn();
    });

    window.addEventListener('appinstalled', () => {
      window.deferredPwaPrompt = null;
      window.__isPwaStandalone = true;
      const btn = document.getElementById('btnPwaInstallApp');
      if (btn) btn.style.display = 'none';
      this.showToast("✓ Application installée avec succès sur votre écran !", "success");
    });

    // Support du routing hash (ex. app.html#other-revenues ou #autres-rentrees)
    const resolveHashTab = (h) => {
      const clean = (h || '').replace('#', '').toLowerCase();
      const tabMap = {
        'autres-rentrees': 'other-revenues',
        'autre-rentree': 'other-revenues',
        'other-revenues': 'other-revenues',
        'depenses': 'expenses',
        'expenses': 'expenses',
        'bilan': 'bilan',
        'eleves': 'students',
        'students': 'students',
        'inscriptions': 'registrations',
        'registrations': 'registrations',
        'cotisations': 'monthly',
        'monthly': 'monthly',
        'settings': 'settings',
        'parametres': 'settings',
        'accueil': 'dashboard',
        'dashboard': 'dashboard'
      };
      return tabMap[clean] || null;
    };

    const initialTab = resolveHashTab(window.location.hash);
    if (initialTab) {
      this.currentTab = initialTab;
    }

    window.addEventListener('hashchange', () => {
      const newTab = resolveHashTab(window.location.hash);
      if (newTab && newTab !== this.currentTab) {
        this.navigate(newTab, { silentHash: true });
      }
    });

    this.navigate(this.currentTab);
  },

  // ----------------------------------------------------------------------------
  // NAVIGATION & ROUTING SPA
  // ----------------------------------------------------------------------------
  navigate(tabName, options = {}) {
    let resolvedTab = tabName;
    if (tabName === 'total-registrations') {
      resolvedTab = 'bilan';
      options = { ...options, subTab: 'registrations' };
    } else if (tabName === 'annual-report') {
      resolvedTab = 'bilan';
      options = { ...options, subTab: 'monthly' };
    } else if (tabName === 'receipts') {
      // Rubrique Reçus séparée supprimée à la demande de la direction (accessible directement via inscriptions et cotisations)
      resolvedTab = 'registrations';
    }

    // Réinitialisation par défaut des filtres pour afficher l'école complète en ordre alphabétique
    if ((resolvedTab === 'registrations' || resolvedTab === 'students' || resolvedTab === 'monthly') && !options.preserveFilters) {
      this.activeClassFilter = 'all';
      this.activeStatusFilter = 'all';
      this.searchTerm = '';
    }
    // La recherche saisie dans un onglet ne doit pas filtrer les autres onglets
    if (resolvedTab !== this.currentTab && !options.preserveFilters) {
      this.searchTerm = '';
    }

    this.currentTab = resolvedTab;

    // Mise à jour de la classe active sur la sidebar desktop
    document.querySelectorAll('.sidebar-nav-item').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-tab') === resolvedTab);
    });

    // Mise à jour sur la barre mobile
    document.querySelectorAll('.mobile-nav-item').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-tab') === resolvedTab);
    });
    this.syncMobileNav(true);

    const contentArea = document.getElementById('appViewContent');
    if (!contentArea) return;

    try {
      switch (resolvedTab) {
        case 'dashboard':
          this.renderDashboard(contentArea);
          break;
        case 'students':
          this.renderStudents(contentArea);
          break;
        case 'registrations':
          this.renderRegistrations(contentArea);
          break;
        case 'monthly':
          this.renderMonthly(contentArea, options);
          break;
        case 'other-revenues':
          this.renderOtherRevenues(contentArea, options);
          break;
        case 'expenses':
          this.renderExpenses(contentArea, options);
          break;
        case 'bilan':
          this.renderBilan(contentArea, options);
          break;
        case 'settings':
          this.renderSettings(contentArea);
          break;
        default:
          this.renderDashboard(contentArea);
      }
    } catch (renderErr) {
      console.error("[App] Erreur de rendu vue:", resolvedTab, renderErr);
      contentArea.innerHTML = `
        <div style="padding: 2.5rem 1.5rem; text-align: center; background: var(--bg-card); border-radius: var(--radius-lg); margin-top: 1rem; border: 1px solid var(--border-medium); box-shadow: var(--shadow-sm);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🏫</div>
          <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--primary); margin-bottom: 0.5rem;">Votre espace école est prêt</h2>
          <p style="color: var(--text-muted); font-weight: 500; max-width: 500px; margin: 0 auto 1.5rem auto; font-size: var(--text-sm);">
            Cliquez ci-dessous pour charger votre tableau de bord.
          </p>
          <button class="btn btn-primary" onclick="window.location.reload()">Accéder au tableau de bord</button>
        </div>
      `;
    }

    if (!options.silentHash) {
      try {
        if (window.location.hash !== '#' + resolvedTab) {
          history.replaceState(null, '', '#' + resolvedTab);
        }
      } catch (e) {}
    }

    if (!options.keepScroll) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  },

  // ----------------------------------------------------------------------------
  // FORMATAGE ÉLÈVES : PRÉNOM D'ABORD ET NOM + CODE COULEUR GENRE
  // Filles = ROUGE (#DC2626) · Garçons = BLEU BIC (#002FA7)
  // ----------------------------------------------------------------------------
  formatStudentName(student, options = {}) {
    if (!student) return '';
    const first = Utils.escapeHtml(student.first_names || '');
    const last = Utils.escapeHtml((student.last_name || '').toUpperCase());
    const isGirl = student.gender === 'F' || student.gender === 'fille';
    const color = isGirl ? '#DC2626' : '#002FA7';
    const icon = isGirl ? '👧' : '👦';
    const label = isGirl ? 'Fille' : 'Garçon';

    if (options.plainText) {
      return `${student.first_names || ''} ${(student.last_name || '').toUpperCase()}`.trim();
    }

    return `
      <span class="student-name-colored" style="color:${color}; font-weight:700; display:inline-flex; align-items:center; gap:0.4rem;" title="${label} (respect du code couleur)">
        <span style="font-size:1.05em;" aria-hidden="true">${icon}</span>
        <span>${first} <strong style="color:${color}; font-weight:800;">${last}</strong></span>
      </span>
    `;
  },

  // Barre du bas (mobile) : garde l'onglet actif visible et signale les onglets cachés sur les petits écrans
  syncMobileNav(revealActive = false) {
    const nav = document.querySelector('.mobile-bottom-nav');
    if (!nav) return;
    if (revealActive) {
      const active = nav.querySelector('.mobile-nav-item.active');
      if (active && nav.scrollWidth > nav.clientWidth + 1) {
        const left = active.offsetLeft;
        const right = left + active.offsetWidth;
        if (left < nav.scrollLeft + 8) {
          nav.scrollLeft = Math.max(0, left - 28);
        } else if (right > nav.scrollLeft + nav.clientWidth - 8) {
          nav.scrollLeft = right - nav.clientWidth + 28;
        }
      }
    }
    const overflow = nav.scrollWidth > nav.clientWidth + 1;
    nav.classList.toggle('has-more-left', overflow && nav.scrollLeft > 2);
    nav.classList.toggle('has-more-right', overflow && nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 2);
  },

  bindGlobalEvents() {
    const mobileNav = document.querySelector('.mobile-bottom-nav');
    if (mobileNav) {
      mobileNav.scrollLeft = 0;
      mobileNav.addEventListener('scroll', () => this.syncMobileNav(), { passive: true });
      window.addEventListener('resize', () => this.syncMobileNav(true));
      requestAnimationFrame(() => this.syncMobileNav(true));
    }

    // Navigation globale par délégation d'événements (sidebar, mobile nav, cartes dashboard)
    document.addEventListener('click', (e) => {
      const tabTarget = e.target.closest('[data-tab]');
      if (tabTarget) {
        e.preventDefault();
        const tab = tabTarget.getAttribute('data-tab');
        if (tab) {
          this.navigate(tab);
        }
        return;
      }

      if (e.target.closest('.modal-close-btn')) {
        this.closeAllModals();
        return;
      }

      if (e.target.classList && e.target.classList.contains('modal-backdrop')) {
        this.closeAllModals();
      }
    });
  },

  renderHeader() {
    const school = Store.getSchool();
    const user = (window.Auth && Auth.getUser()) || Store.currentUser;

    // Nom de l'école et logo officiel dans la topbar
    const titleEl = document.getElementById('topbarSchoolName');
    if (titleEl && school) {
      titleEl.textContent = school.name;
    }
    const logoEl = document.getElementById('topbarSchoolLogo');
    if (logoEl) {
      logoEl.src = (school && school.logo_url) || 'images/logo.png';
    }

    // Indicateur de mode Démo vs École réelle dans la topbar
    const isDemo = Store.isDemo();
    const demoBadge = document.getElementById('topbarDemoBadge');
    if (demoBadge) {
      demoBadge.style.display = isDemo ? 'inline-block' : 'none';
    }
    const btnAddSchool = document.getElementById('btnTopbarAddSchool');
    if (btnAddSchool) {
      if (isDemo) {
        btnAddSchool.innerHTML = '<span>+ Référencer mon école</span>';
        btnAddSchool.onclick = () => App.openReferenceSchoolModal();
        btnAddSchool.style.display = 'inline-flex';
      } else {
        btnAddSchool.innerHTML = '<span>⚙️ Mon établissement</span>';
        btnAddSchool.onclick = () => App.navigate('settings');
        btnAddSchool.style.display = 'inline-flex';
      }
    }

    // Nom du directeur dans la sidebar
    const userNameEl = document.getElementById('sidebarUserName');
    if (userNameEl && user) {
      userNameEl.textContent = user.name || (school ? school.director_name : 'Direction');
    }

    // Rôle
    const userRoleEl = document.getElementById('sidebarUserRole');
    if (userRoleEl) {
      userRoleEl.textContent = 'Directeur / Directrice';
    }

    // Initiales dynamiques de l'avatar
    const userAvatarEl = document.getElementById('sidebarUserAvatar');
    if (userAvatarEl) {
      const nameStr = (user && user.name) || (school && school.director_name) || 'GP';
      const parts = nameStr.trim().split(/\s+/).filter(Boolean);
      let initials = 'GP';
      if (parts.length >= 2) {
        initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      } else if (parts.length === 1 && parts[0].length >= 2) {
        initials = parts[0].substring(0, 2).toUpperCase();
      }
      userAvatarEl.textContent = initials;
    }
  },

  /**
   * Déconnexion réelle et synchronisée
   */
  async handleLogout() {
    if (window.Auth) {
      await Auth.signOut();
    } else {
      localStorage.removeItem('gp_active_session_v1');
      window.history.replaceState(null, '', 'index.html');
      window.location.replace('index.html');
    }
  },

  // ----------------------------------------------------------------------------
  // VUE 1 : TABLEAU DE BORD (§ 3.8)
  // ----------------------------------------------------------------------------
  renderDashboard(container) {
    const metrics = Store.getDashboardMetrics();
    const school = Store.getSchool();
    const expensesSummary = Store.getExpensesSummary();
    const grand = Store.getGrandTotalSummary();

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <div>
            <h1 class="view-title">Tableau de bord</h1>
            <p class="view-subtitle">${Utils.escapeHtml(school.name)} · Année scolaire ${Utils.escapeHtml(school.school_year)}</p>
          </div>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            <button class="btn btn-outline-primary btn-sm" onclick="App.navigate('registrations')">Inscriptions</button>
            <button class="btn btn-primary btn-sm" onclick="App.navigate('monthly')">Cotisations ${Utils.escapeHtml(metrics.current_month.label)}</button>
          </div>
        </div>
      </div>

      ${(metrics.registration.total_students === 0 || Store.isDemo()) ? `
        <div class="welcome-motion-card">
          <div class="welcome-illus-wrapper">
            <div class="welcome-illus-halo"></div>
            <div class="welcome-illus-frame">
              <img src="images/welcome-directrice-enfant.jpg" alt="Directrice et enfant préscolaire" class="welcome-illus-img">
            </div>
            <div class="welcome-cap-badge" title="Gestion Préscolaire">🎓</div>
            <span class="welcome-sparkle welcome-sparkle-1">✨</span>
            <span class="welcome-sparkle welcome-sparkle-2">✨</span>
            <span class="welcome-sparkle welcome-sparkle-3">⭐</span>
          </div>
          <h2 class="welcome-motion-title">Bienvenue dans votre espace école !</h2>
          <p class="welcome-motion-text">
            Votre établissement <span class="welcome-school-highlight">${Utils.escapeHtml(school.name)}</span> est prêt. Vos sections et votre cachet officiel ont été générés. Pour commencer à piloter vos règlements et délivrer vos premiers reçus officiels, enregistrez vos élèves ou configurez votre établissement.
          </p>
          <div class="welcome-status-pills">
            <div class="welcome-pill">
              <span class="welcome-pill-check">✓</span>
              <span>Sections configurées</span>
            </div>
            <div class="welcome-pill">
              <span class="welcome-pill-check">✓</span>
              <span>Cachet officiel généré</span>
            </div>
            <div class="welcome-pill">
              <span class="welcome-pill-check">✓</span>
              <span>Reçus officiels prêts</span>
            </div>
          </div>
          <div class="welcome-action-group">
            <button type="button" class="btn-welcome-add" onclick="App.openReferenceSchoolModal()" title="Ajouter ou modifier les coordonnées de mon école">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
              <span>Ajouter mon école</span>
            </button>
            <button type="button" class="btn-welcome-csv" onclick="App.openImportCsvModal()" title="Importer les élèves depuis un fichier CSV">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
              <span>Importer un CSV</span>
            </button>
          </div>
        </div>
      ` : ''}

      <!-- Cartes KPI de synthèse harmonisées (Inscriptions & Cotisations) -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-title">Inscriptions Encaissées</span>
          <div class="kpi-figure" style="color:var(--primary);">${Utils.formatFCFA(metrics.registration.total_collected)}</div>
          <div class="kpi-meta">
            ${metrics.registration.paid_students} sur ${metrics.registration.total_students} inscrits réglés
          </div>
          <div class="progress-bar-container" style="margin-top:0.6rem;">
            <div class="progress-bar-fill ${metrics.registration.percentage >= 80 ? 'fill-high' : metrics.registration.percentage >= 50 ? 'fill-medium' : 'fill-low'}" style="width: ${metrics.registration.percentage}%;"></div>
          </div>
        </div>

        <div class="kpi-card">
          <span class="kpi-title">Pourcentage des Inscriptions</span>
          <div class="kpi-figure" style="color:${metrics.registration.percentage >= 80 ? 'var(--success)' : metrics.registration.percentage >= 50 ? 'var(--warning)' : 'var(--danger)'};">
            ${metrics.registration.percentage}%
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar-fill ${metrics.registration.percentage >= 80 ? 'fill-high' : metrics.registration.percentage >= 50 ? 'fill-medium' : 'fill-low'}" style="width: ${metrics.registration.percentage}%;"></div>
          </div>
        </div>

        <div class="kpi-card">
          <span class="kpi-title">Cotisations (${Utils.escapeHtml(metrics.current_month.label)})</span>
          <div class="kpi-figure" style="color:var(--success);">${Utils.formatFCFA(metrics.current_month.total_collected)}</div>
          <div class="kpi-meta">
            Attendu : ${Utils.formatFCFA(metrics.current_month.total_expected)}
          </div>
          <div class="progress-bar-container" style="margin-top:0.6rem;">
            <div class="progress-bar-fill ${metrics.current_month.percentage >= 80 ? 'fill-high' : metrics.current_month.percentage >= 50 ? 'fill-medium' : 'fill-low'}" style="width: ${metrics.current_month.percentage}%;"></div>
          </div>
        </div>

        <div class="kpi-card">
          <span class="kpi-title">Pourcentage du mois (${Utils.escapeHtml(metrics.current_month.label)})</span>
          <div class="kpi-figure" style="color:${metrics.current_month.percentage >= 80 ? 'var(--success)' : metrics.current_month.percentage >= 50 ? 'var(--warning)' : 'var(--danger)'};">
            ${metrics.current_month.percentage}%
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar-fill ${metrics.current_month.percentage >= 80 ? 'fill-high' : metrics.current_month.percentage >= 50 ? 'fill-medium' : 'fill-low'}" style="width: ${metrics.current_month.percentage}%;"></div>
          </div>
        </div>

        <div class="kpi-card">
          <span class="kpi-title">Impayés du mois</span>
          <div class="kpi-figure" style="color:var(--danger);">${metrics.current_month.unpaid_students}</div>
          <div class="kpi-meta">
            Élèves à recouvrer pour ${Utils.escapeHtml(metrics.current_month.label)}
          </div>
        </div>
      </div>

      <!-- Synthèse Trésorerie Générale & Autres Entrées -->
      <div class="kpi-grid" style="margin-top:1rem;">
        <div class="kpi-card" style="border-top:4px solid var(--success); background:linear-gradient(180deg, #FFFFFF 0%, #F0FDF4 100%);">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="kpi-title">Autres Entrées Encaissées</span>
            <button class="btn btn-outline-primary btn-sm" onclick="App.openAddOtherRevenueModal()" style="font-size:11px; padding:2px 8px;">+ Autre entrée</button>
          </div>
          <div class="kpi-figure" style="color:var(--success); font-weight:800;">${Utils.formatFCFA(grand.other_revenues ? grand.other_revenues.total_amount : 0)}</div>
          <div class="kpi-meta">Dons, cantine, blouses, garderie & extras (${grand.other_revenues ? grand.other_revenues.count : 0} op.)</div>
        </div>

        <div class="kpi-card" style="border-top:4px solid var(--danger);">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="kpi-title">Total Dépenses Décaissées</span>
            <button class="btn btn-outline-danger btn-sm" onclick="App.openAddExpenseModal()" style="font-size:11px; padding:2px 8px;">+ Dépense</button>
          </div>
          <div class="kpi-figure" style="color:var(--danger);">${Utils.formatFCFA(grand.total_expenses)}</div>
          <div class="kpi-meta">${expensesSummary.count} sorties de caisse comptabilisées</div>
        </div>

        <div class="kpi-card" style="border-top:4px solid var(--primary); background:linear-gradient(180deg, #FFFFFF 0%, #EFF6FF 100%);">
          <span class="kpi-title">Trésorerie Disponible en Caisse</span>
          <div class="kpi-figure" style="color:var(--primary); font-weight:800;">${Utils.formatFCFA(grand.net_available)}</div>
          <div class="kpi-meta">Recettes totales (${Utils.formatFCFA(grand.grand_collected)}) − Dépenses (${Utils.formatFCFA(grand.total_expenses)})</div>
        </div>
      </div>

      <!-- Actions rapides & 5 derniers paiements -->
      <div style="display:grid; grid-template-columns:1fr; gap:1.5rem; margin-top:1rem;">
        <div style="background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-lg); padding:1.25rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <h3 style="font-size:var(--text-lg); margin-bottom:0;">Derniers paiements enregistrés</h3>
            <span class="badge badge-info">Reçus officiels instantanés</span>
          </div>

          ${metrics.last_payments.length === 0 ? `
            <p style="color:var(--text-muted); font-size:var(--text-sm);">Aucun paiement enregistré pour le moment.</p>
          ` : `
            <div class="data-table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>N° Reçu</th>
                    <th>Date</th>
                    <th>Élève (Prénom & Nom)</th>
                    <th>Section</th>
                    <th>Objet</th>
                    <th>Montant</th>
                    <th>Statut</th>
                    <th style="text-align:right;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${metrics.last_payments.map(p => {
                    const studentObj = Store.getStudentById(p.student_id);
                    return `
                    <tr>
                      <td data-label="N° Reçu"><strong>${Utils.escapeHtml(p.receipt_number)}</strong></td>
                      <td data-label="Date">${Utils.formatDate(p.paid_at)}</td>
                      <td data-label="Élève">${App.formatStudentName(studentObj) || `<strong>${Utils.escapeHtml(p.student_name)}</strong>`}</td>
                      <td data-label="Section"><span class="badge badge-section" style="background:#2563EB; color:#FFFFFF !important; font-weight:700;">${Utils.escapeHtml(p.class_name)}</span></td>
                      <td data-label="Objet">${Utils.escapeHtml(p.object_label)}</td>
                      <td data-label="Montant" style="font-weight:700; color:var(--primary);">${Utils.formatFCFA(p.amount)}</td>
                      <td data-label="Statut">
                        ${p.status === 'valid' 
                          ? `<span class="badge badge-success">✓ Valide</span>`
                          : `<span class="badge badge-danger">✕ Annulé</span>`
                        }
                      </td>
                      <td data-label="Actions" style="text-align:right;">
                        <button class="btn btn-outline-primary btn-sm" onclick="App.viewReceipt('${p.id}')">Voir Reçu</button>
                      </td>
                    </tr>
                  `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;
  },

  // ----------------------------------------------------------------------------
  // VUE 2 : GESTION DES ÉLÈVES (§ 3.2)
  // ----------------------------------------------------------------------------
  renderStudents(container) {
    const classes = Store.getClasses();
    const students = Store.getStudents(true);

    const filtered = students.filter(s => {
      const matchClass = this.activeClassFilter === 'all' || s.class_id === this.activeClassFilter;
      const fullName = `${s.first_names} ${s.last_name} ${s.first_names}`.toLowerCase();
      const matchSearch = !this.searchTerm || fullName.includes(this.searchTerm.toLowerCase());
      return matchClass && matchSearch;
    });

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <div>
            <h1 class="view-title">Gestion des élèves</h1>
            <p class="view-subtitle">${filtered.length} élève(s) affiché(s) · Ordre alphabétique par nom de famille (A-Z)</p>
          </div>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" onclick="App.exportStudentsCsv()" title="Télécharger la liste complète des élèves en format CSV Excel">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              <span>Exporter CSV</span>
            </button>
            <button class="btn btn-secondary btn-sm" onclick="App.openImportCsvModal()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
              <span>Importer CSV</span>
            </button>
            <button class="btn btn-primary btn-sm" onclick="App.openAddStudentModal()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              <span>Ajouter un élève</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Filtres et recherche -->
      <div class="filter-bar">
        <div class="search-box">
          <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" class="form-input search-input" placeholder="Recherche par prénom ou nom..." value="${Utils.escapeHtml(this.searchTerm)}" oninput="App.onSearchInput(this.value)">
        </div>

        <div style="display:flex; gap:0.5rem; align-items:center;">
          <select class="form-select" style="min-width:180px;" onchange="App.onClassFilterChange(this.value)">
            <option value="all" ${this.activeClassFilter === 'all' ? 'selected' : ''}>Toutes les sections (Toute l'école)</option>
            ${classes.map(c => `
              <option value="${c.id}" ${this.activeClassFilter === c.id ? 'selected' : ''}>${Utils.escapeHtml(c.name)}</option>
            `).join('')}
          </select>
          ${this.activeClassFilter !== 'all' || this.searchTerm ? `
            <button class="btn btn-secondary btn-sm" onclick="App.onClassFilterChange('all')" title="Afficher toute l'école">
              ✕ Toute l'école
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Tableau responsive -->
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>N°</th>
              <th>Prénom & Nom</th>
              <th style="text-align:center;">Genre</th>
              <th>Section</th>
              <th>Parent / Tuteur</th>
              <th>Téléphone Parent</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0 ? `
              <tr>
                <td colspan="7" style="text-align:center; padding:3rem 1.5rem; color:var(--text-muted);">
                  ${students.length === 0 ? `
                    <div style="max-width:440px; margin:0 auto;">
                      <div style="font-size:2.5rem; margin-bottom:0.75rem;">👶</div>
                      <h3 style="font-size:var(--text-lg); color:var(--text-main); margin-bottom:0.5rem; font-weight:700;">Aucun élève inscrit pour le moment</h3>
                      <p style="font-size:var(--text-sm); margin-bottom:1.5rem; line-height:1.5;">Votre registre est vierge. Ajoutez votre premier élève ou importez l'effectif complet par fichier CSV.</p>
                      <div style="display:flex; justify-content:center; gap:0.75rem; flex-wrap:wrap;">
                        <button class="btn btn-primary" onclick="App.openAddStudentModal()" style="min-height:44px;">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                          <span>Ajouter mon premier élève</span>
                        </button>
                        <button class="btn btn-secondary" onclick="App.openImportCsvModal()" style="min-height:44px;">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                          <span>Importer un CSV</span>
                        </button>
                      </div>
                    </div>
                  ` : `
                    <div>Aucun élève ne correspond aux critères de filtre ou de recherche sélectionnés.</div>
                  `}
                </td>
              </tr>
            ` : filtered.map((s, idx) => {
              const cls = Store.getClassById(s.class_id);
              const isGirl = s.gender === 'F' || s.gender === 'fille';
              return `
                <tr>
                  <td data-label="N°">${idx + 1}</td>
                  <td data-label="Prénom & Nom">${App.formatStudentName(s)}</td>
                  <td data-label="Genre" style="text-align:center;">
                    ${isGirl
                      ? `<span class="badge" style="background:#FEE2E2; color:#DC2626; font-weight:800; font-size:0.95rem; min-width:32px; text-align:center; display:inline-block; border-radius:6px; padding:0.25rem 0.5rem;" title="Fille">F</span>`
                      : `<span class="badge" style="background:#DBEAFE; color:#002FA7; font-weight:800; font-size:0.95rem; min-width:32px; text-align:center; display:inline-block; border-radius:6px; padding:0.25rem 0.5rem;" title="Garçon">G</span>`
                    }
                  </td>
                  <td data-label="Section"><span class="badge badge-section" style="background:#2563EB; color:#FFFFFF !important; font-weight:700;">${Utils.escapeHtml(cls ? cls.name : '-')}</span></td>
                  <td data-label="Parent">${Utils.escapeHtml(s.parent_name || '-')}</td>
                  <td data-label="Téléphone">
                    ${s.parent_phone ? `
                      <a href="tel:${Utils.escapeHtml(String(s.parent_phone).replace(/[^\d+]/g, ''))}" style="color:var(--primary); font-weight:600;">${Utils.escapeHtml(s.parent_phone)}</a>
                    ` : '-'}
                  </td>
                  <td data-label="Actions" style="text-align:right;">
                    <button class="btn btn-secondary btn-sm" onclick="App.openEditStudentModal('${s.id}')" title="Modifier">✎</button>
                    <button class="btn btn-outline-primary btn-sm" style="color:var(--danger); border-color:#FECACA;" onclick="App.deactivateStudent('${s.id}')" title="Désactiver (départ)">✕</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // ----------------------------------------------------------------------------
  // VUE 3 : INSCRIPTIONS (§ 3.3)
  // Liste complète + DEUX BOUTONS CÔTE À CÔTE : Payé (vert) / Impayé (rouge)
  // ----------------------------------------------------------------------------
  renderRegistrations(container) {
    const summary = Store.getRegistrationSummary();
    const classes = Store.getClasses();
    const students = Store.getStudents(true);

    const filtered = students.filter(s => {
      const matchClass = this.activeClassFilter === 'all' || s.class_id === this.activeClassFilter;
      const payment = Store.getPaymentStatus(s.id, 'registration');
      const isPaid = !!payment;
      const matchStatus = this.activeStatusFilter === 'all' 
        || (this.activeStatusFilter === 'paid' && isPaid)
        || (this.activeStatusFilter === 'unpaid' && !isPaid);

      const fullName = `${s.first_names} ${s.last_name} ${s.first_names}`.toLowerCase();
      const matchSearch = !this.searchTerm || fullName.includes(this.searchTerm.toLowerCase());
      return matchClass && matchStatus && matchSearch;
    });

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <div>
            <h1 class="view-title">Inscriptions de l'école</h1>
            <p class="view-subtitle">${filtered.length} élève(s) affiché(s) · Ordre alphabétique par nom de famille (A-Z)</p>
          </div>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
            <button class="btn btn-primary" onclick="App.openAddStudentModal()" style="display:inline-flex; align-items:center; gap:0.4rem;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Inscrire un élève</span>
            </button>
            <button class="btn btn-outline-primary btn-sm" onclick="App.navigate('bilan', { subTab: 'registrations' })">
              Bilan Inscriptions →
            </button>
          </div>
        </div>

        <!-- Grand format Total Encaissé en vert (#16A34A) demandé par la direction -->
        <div class="registration-highlight-card" style="background:linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%); border:2px solid #86EFAC; border-radius:var(--radius-xl); padding:1.5rem 1.75rem; margin-top:1.25rem; margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1.25rem; box-shadow:0 10px 25px -5px rgba(22, 163, 74, 0.15);">
          <div>
            <div style="text-transform:uppercase; letter-spacing:0.08em; font-size:var(--text-xs); font-weight:800; color:#15803D; margin-bottom:0.35rem; display:flex; align-items:center; gap:0.5rem;">
              <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#16A34A;"></span>
              Total Encaissé Inscriptions
            </div>
            <div style="font-size:clamp(2.4rem, 6vw, 3.25rem); font-weight:900; color:#16A34A; line-height:1.05; letter-spacing:-0.03em;">
              ${Utils.formatFCFA(summary.total_collected)}
            </div>
            <div style="font-size:var(--text-sm); color:#166534; font-weight:600; margin-top:0.4rem;">
              ${summary.paid_students} élèves inscrits payés sur un effectif de ${summary.total_students} (${summary.percentage}%)
            </div>
            <div class="progress-bar-container" style="margin-top:0.65rem; max-width:320px; background:rgba(22, 163, 74, 0.2);">
              <div class="progress-bar-fill fill-high" style="width: ${summary.percentage}%;"></div>
            </div>
          </div>
          <div style="display:flex; gap:0.75rem; flex-wrap:wrap; align-items:center;">
            <div 
              style="background:#FFFFFF; border:2px solid ${this.activeStatusFilter === 'all' && this.activeClassFilter === 'all' ? 'var(--primary)' : '#E2E8F0'}; border-radius:var(--radius-lg); padding:0.875rem 1.25rem; text-align:center; min-width:120px; box-shadow:var(--shadow-sm); cursor:pointer; transition:all 0.15s;" 
              onclick="App.showAllRegistrations()"
              title="Cliquer pour afficher tous les élèves de l'école">
              <div style="font-size:var(--text-xs); color:var(--text-muted); font-weight:700; text-transform:uppercase;">Tous les élèves</div>
              <div style="font-size:var(--text-2xl); font-weight:900; color:var(--primary);">${summary.total_students}</div>
            </div>
            <div 
              style="background:#FFFFFF; border:2px solid ${this.activeStatusFilter === 'paid' ? '#16A34A' : '#BBF7D0'}; border-radius:var(--radius-lg); padding:0.875rem 1.25rem; text-align:center; min-width:120px; box-shadow:var(--shadow-sm); cursor:pointer; transition:all 0.15s;"
              onclick="App.filterRegistrationsStatus('paid')"
              title="Cliquer pour afficher les élèves avec inscription payée">
              <div style="font-size:var(--text-xs); color:#166534; font-weight:700; text-transform:uppercase;">Payés</div>
              <div style="font-size:var(--text-2xl); font-weight:900; color:#16A34A;">${summary.paid_students}</div>
            </div>
            <div 
              style="background:#FFFFFF; border:2px solid ${this.activeStatusFilter === 'unpaid' ? '#DC2626' : '#FECACA'}; border-radius:var(--radius-lg); padding:0.875rem 1.25rem; text-align:center; min-width:120px; box-shadow:var(--shadow-sm); cursor:pointer; transition:all 0.15s;"
              onclick="App.filterRegistrationsStatus('unpaid')"
              title="Cliquer pour afficher les élèves avec inscription impayée">
              <div style="font-size:var(--text-xs); color:#991B1B; font-weight:700; text-transform:uppercase;">Impayés</div>
              <div style="font-size:var(--text-2xl); font-weight:900; color:#DC2626;">${summary.unpaid_students}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Filtres -->
      <div class="filter-bar">
        <div class="search-box">
          <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" class="form-input search-input" placeholder="Rechercher par prénom ou nom..." value="${Utils.escapeHtml(this.searchTerm)}" oninput="App.onSearchInput(this.value)">
        </div>

        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
          <select class="form-select" style="min-width:170px;" onchange="App.onClassFilterChange(this.value)">
            <option value="all" ${this.activeClassFilter === 'all' ? 'selected' : ''}>Toutes les sections (Toute l'école)</option>
            ${classes.map(c => `
              <option value="${c.id}" ${this.activeClassFilter === c.id ? 'selected' : ''}>${Utils.escapeHtml(c.name)}</option>
            `).join('')}
          </select>

          <select class="form-select" style="min-width:160px;" onchange="App.onStatusFilterChange(this.value)">
            <option value="all" ${this.activeStatusFilter === 'all' ? 'selected' : ''}>Tous les statuts (${summary.total_students} élèves)</option>
            <option value="paid" ${this.activeStatusFilter === 'paid' ? 'selected' : ''}>Payés uniquement (${summary.paid_students})</option>
            <option value="unpaid" ${this.activeStatusFilter === 'unpaid' ? 'selected' : ''}>Impayés uniquement (${summary.unpaid_students})</option>
          </select>

          ${(this.activeClassFilter !== 'all' || this.activeStatusFilter !== 'all' || this.searchTerm) ? `
            <button class="btn btn-secondary btn-sm" onclick="App.showAllRegistrations()" title="Afficher tous les élèves de l'école">
              ✕ Toute l'école (${summary.total_students})
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Tableau Responsive avec boutons Payé (vert) / Impayé (rouge) exclusifs -->
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>N°</th>
              <th>Prénom & Nom</th>
              <th>Section</th>
              <th>Montant dû</th>
              <th style="text-align:center;">Statut d'inscription</th>
              <th style="text-align:right;">Actions / Reçu</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0 ? `
              <tr>
                <td colspan="6" style="text-align:center; padding:3rem 1.5rem; color:var(--text-muted);">
                  ${summary.total_students === 0 ? `
                    <div style="max-width:440px; margin:0 auto;">
                      <div style="font-size:2.5rem; margin-bottom:0.75rem;">📝</div>
                      <h3 style="font-size:var(--text-lg); color:var(--text-main); margin-bottom:0.5rem; font-weight:700;">Aucun élève inscrit pour le moment</h3>
                      <p style="font-size:var(--text-sm); margin-bottom:1.5rem; line-height:1.5;">Inscrivez votre premier élève pour valider son inscription et éditer instantanément son reçu certifié n°0001.</p>
                      <button class="btn btn-primary" onclick="App.openAddStudentModal()" style="min-height:44px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                        <span>Ajouter mon premier élève</span>
                      </button>
                    </div>
                  ` : `
                    <div>Aucun élève trouvé avec les filtres sélectionnés.</div>
                  `}
                </td>
              </tr>
            ` : filtered.map((s, idx) => {
              const cls = Store.getClassById(s.class_id);
              const fee = cls ? cls.registration_fee : 0;
              const payment = Store.getPaymentStatus(s.id, 'registration');
              const isPaid = !!payment;

              return `
                <tr>
                  <td data-label="N°">${idx + 1}</td>
                  <td data-label="Élève">${App.formatStudentName(s)}</td>
                  <td data-label="Section"><span class="badge badge-section" style="background:#2563EB; color:#FFFFFF !important; font-weight:700;">${Utils.escapeHtml(cls ? cls.name : '-')}</span></td>
                  <td data-label="Montant dû" style="font-weight:700; color:var(--text-main);">${Utils.formatFCFA(fee)}</td>
                  <td data-label="Statut" class="cell-actions" style="text-align:center;">
                    <div class="payment-toggle-group">
                      <button 
                        class="toggle-btn btn-status-paid ${isPaid ? 'is-active' : ''}" 
                        onclick="App.onTogglePaid('${s.id}', 'registration', null, ${fee})"
                        aria-pressed="${isPaid}">
                        <span>✓</span>
                        <span>Payé</span>
                      </button>
                      <button 
                        class="toggle-btn btn-status-unpaid ${!isPaid ? 'is-active' : ''}" 
                        onclick="App.onToggleUnpaid('${s.id}', 'registration', null)"
                        aria-pressed="${!isPaid}">
                        <span>✕</span>
                        <span>Impayé</span>
                      </button>
                    </div>
                  </td>
                  <td data-label="Actions / Reçu" style="text-align:right;">
                    ${isPaid ? `
                      <div style="display:inline-flex; gap:0.35rem; align-items:center; justify-content:flex-end; flex-wrap:wrap;">
                        <button class="btn btn-secondary btn-sm" onclick="App.openEditPaymentModal('${payment.id}')" title="Modifier ce paiement (somme, date, mode)" style="padding:0.35rem 0.55rem;">
                          ✎
                        </button>
                        <button class="btn btn-outline-primary btn-sm" onclick="App.viewReceipt('${payment.id}')" title="Afficher le reçu officiel A5">
                          📄 Reçu
                        </button>
                        <button class="btn btn-whatsapp btn-sm" onclick="App.shareReceiptPNG('${payment.id}')" title="Envoyer le reçu officiel en image PNG sur WhatsApp" style="padding:0.35rem 0.55rem; font-size:12px; background:#25D366; color:#FFFFFF; border:none; font-weight:700;">
                          <span>📲 WhatsApp (PNG)</span>
                        </button>
                        <button class="btn btn-outline-primary btn-sm" onclick="App.downloadReceiptPNG('${payment.id}')" title="Télécharger le reçu officiel en image PNG" style="padding:0.35rem 0.55rem; font-size:12px;">
                          <span>📥 PNG</span>
                        </button>
                      </div>
                    ` : `
                      <span style="color:var(--text-muted); font-size:var(--text-xs);">-</span>
                    `}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // ----------------------------------------------------------------------------
  // VUE 4 : COTISATIONS MENSUELLES (§ 3.4)
  // Sélecteur d'onglets mobiles + Table avec boutons Payé/Impayé + Option "État par classe"
  // ----------------------------------------------------------------------------
  renderMonthly(container, options = {}) {
    const showClassView = options.showClassView || false;
    const months = Store.getMonths();
    const currentMonth = Store.getMonthById(this.currentMonthId) || months[0];
    const monthSummary = Store.getMonthSummary(currentMonth.id);
    const classes = Store.getClasses();
    const students = Store.getStudents(true);
    const school = Store.getSchool();
    const curIdx = months.findIndex(m => m.id === currentMonth.id);
    const isFirstMonth = curIdx <= 0;
    const isLastMonth = curIdx >= months.length - 1;

    const filtered = students.filter(s => {
      const matchClass = this.activeClassFilter === 'all' || s.class_id === this.activeClassFilter;
      const payment = Store.getPaymentStatus(s.id, 'monthly', currentMonth.id);
      const isPaid = !!payment;
      const matchStatus = this.activeStatusFilter === 'all' 
        || (this.activeStatusFilter === 'paid' && isPaid)
        || (this.activeStatusFilter === 'unpaid' && !isPaid);

      const fullName = `${s.first_names} ${s.last_name} ${s.first_names}`.toLowerCase();
      const matchSearch = !this.searchTerm || fullName.includes(this.searchTerm.toLowerCase());
      return matchClass && matchStatus && matchSearch;
    });

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <div>
            <h1 class="view-title">Cotisations mensuelles</h1>
            <p class="view-subtitle">Suivi des mensualités pour l'année scolaire</p>
          </div>
          <div style="display:flex; gap:0.5rem;">
            <button class="btn ${showClassView ? 'btn-secondary' : 'btn-primary'} btn-sm" onclick="App.renderMonthly(document.getElementById('appViewContent'), { showClassView: false })">
              Liste des élèves
            </button>
            <button class="btn ${showClassView ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="App.renderMonthly(document.getElementById('appViewContent'), { showClassView: true })">
              État par classe
            </button>
          </div>
        </div>

        <!-- Sélecteur de mois compact avec flèches de navigation (§ 3.4) -->
        <div class="month-navigator-box">
          <button 
            class="month-nav-btn" 
            onclick="App.prevMonth(${showClassView})" 
            ${isFirstMonth ? 'disabled' : ''} 
            title="Mois précédent"
            aria-label="Mois précédent">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            <span class="month-nav-btn-label">Précédent</span>
          </button>

          <div class="month-navigator-current">
            <div class="month-picker-wrapper" title="Cliquez pour changer rapidement de mois">
              <span class="month-badge-pill">Mois ${curIdx + 1} sur ${months.length}</span>
              <div class="month-current-title">
                <span>${Utils.escapeHtml(currentMonth.label)} ${school ? school.school_year : ''}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                <select 
                  class="month-dropdown-select" 
                  aria-label="Sélectionner le mois"
                  onchange="App.changeMonth(this.value, ${showClassView})">
                  ${months.map((m, idx) => `
                    <option value="${m.id}" ${m.id === currentMonth.id ? 'selected' : ''}>
                      ${idx + 1}. ${Utils.escapeHtml(m.label)} ${school ? school.school_year : ''}
                    </option>
                  `).join('')}
                </select>
              </div>
            </div>
          </div>

          <button 
            class="month-nav-btn" 
            onclick="App.nextMonth(${showClassView})" 
            ${isLastMonth ? 'disabled' : ''} 
            title="Mois suivant"
            aria-label="Mois suivant">
            <span class="month-nav-btn-label">Suivant</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        <!-- Compteurs visibles pour le mois -->
        <div class="stats-banner">
          <div class="stat-pill">
            <span class="stat-pill-dot dot-paid"></span>
            <span>${monthSummary.paid_students} payés</span>
          </div>
          <span style="color:var(--border-medium);">—</span>
          <div class="stat-pill">
            <span class="stat-pill-dot dot-unpaid"></span>
            <span>${monthSummary.unpaid_students} impayés</span>
          </div>
          <span style="color:var(--border-medium);">—</span>
          <div class="stat-pill">
            <span class="stat-pill-dot dot-total"></span>
            <span>Encaissé : ${Utils.formatFCFA(monthSummary.total_collected)} / ${Utils.formatFCFA(monthSummary.total_expected)}</span>
          </div>
          <div style="margin-left:auto; font-size:var(--text-xs); color:var(--text-muted); align-self:center;">
            Pourcentage : <strong>${monthSummary.percentage}%</strong>
          </div>
        </div>
      </div>

      ${showClassView ? `
        <!-- VUE ÉTAT PAR CLASSE (§ 3.4) -->
        <div style="margin-bottom:1.5rem;">
          <h2 style="font-size:var(--text-xl); margin-bottom:0.75rem;">État par section pour ${Utils.escapeHtml(currentMonth.label)}</h2>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:1rem;">
            ${monthSummary.classes.map(cls => `
              <div 
                style="background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-lg); padding:1.25rem; box-shadow:var(--shadow-sm); cursor:pointer; transition:border var(--transition-fast);"
                onclick="App.filterByClassFromState('${cls.class_id}')"
                title="Cliquez pour filtrer les élèves de cette classe">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
                  <h3 style="font-size:var(--text-base); margin-bottom:0; color:var(--primary);">${Utils.escapeHtml(cls.class_name)}</h3>
                  <span class="badge ${cls.percentage >= 80 ? 'badge-success' : cls.percentage >= 50 ? 'badge-warning' : 'badge-danger'}">
                    ${cls.percentage}%
                  </span>
                </div>

                <div class="progress-bar-container" style="margin-bottom:0.875rem;">
                  <div class="progress-bar-fill ${cls.percentage >= 80 ? 'fill-high' : cls.percentage >= 50 ? 'fill-medium' : 'fill-low'}" style="width: ${cls.percentage}%;"></div>
                </div>

                <div style="font-size:var(--text-xs); color:var(--text-muted); display:flex; flex-direction:column; gap:0.25rem;">
                  <div style="display:flex; justify-content:space-between;">
                    <span>Effectif :</span>
                    <strong>${cls.total_students} élèves</strong>
                  </div>
                  <div style="display:flex; justify-content:space-between;">
                    <span>Payés / Impayés :</span>
                    <span><strong style="color:var(--success);">${cls.paid_students}</strong> / <strong style="color:var(--danger);">${cls.unpaid_students}</strong></span>
                  </div>
                  <div style="display:flex; justify-content:space-between;">
                    <span>Encaissé / Attendu :</span>
                    <span><strong>${Utils.formatFCFA(cls.collected_amount)}</strong> / ${Utils.formatFCFA(cls.expected_amount)}</span>
                  </div>
                </div>

                <div style="margin-top:0.75rem; text-align:right; font-size:11px; color:var(--primary-light);">
                  Filtrer les élèves →
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : `
        <!-- VUE LISTE DES ÉLÈVES (AVEC DEUX CASES PAYÉ / IMPAYÉ) -->
        <div class="filter-bar">
          <div class="search-box">
            <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="form-input search-input" placeholder="Rechercher un élève..." value="${Utils.escapeHtml(this.searchTerm)}" oninput="App.onSearchInput(this.value)">
          </div>

          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            <select class="form-select" style="min-width:160px;" onchange="App.onClassFilterChange(this.value)">
              <option value="all" ${this.activeClassFilter === 'all' ? 'selected' : ''}>Toutes les sections</option>
              ${classes.map(c => `
                <option value="${c.id}" ${this.activeClassFilter === c.id ? 'selected' : ''}>${Utils.escapeHtml(c.name)}</option>
              `).join('')}
            </select>

            <select class="form-select" style="min-width:140px;" onchange="App.onStatusFilterChange(this.value)">
              <option value="all" ${this.activeStatusFilter === 'all' ? 'selected' : ''}>Tous les statuts</option>
              <option value="paid" ${this.activeStatusFilter === 'paid' ? 'selected' : ''}>Payés uniquement</option>
              <option value="unpaid" ${this.activeStatusFilter === 'unpaid' ? 'selected' : ''}>Impayés uniquement</option>
            </select>
          </div>
        </div>

        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Prénom & Nom</th>
                <th>Section</th>
                <th>Mensualité</th>
                <th style="text-align:center;">Statut ${Utils.escapeHtml(currentMonth.label)}</th>
                <th style="text-align:right;">Actions / Reçu</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align:center; padding:3rem 1.5rem; color:var(--text-muted);">
                    ${monthSummary.total_students === 0 ? `
                      <div style="max-width:440px; margin:0 auto;">
                        <div style="font-size:2.5rem; margin-bottom:0.75rem;">📅</div>
                        <h3 style="font-size:var(--text-lg); color:var(--text-main); margin-bottom:0.5rem; font-weight:700;">Aucun élève à pointer pour ce mois</h3>
                        <p style="font-size:var(--text-sm); margin-bottom:1.5rem; line-height:1.5;">Inscrivez vos premiers élèves pour gérer les cotisations mensuelles de ${Utils.escapeHtml(currentMonth.label)} à Juin.</p>
                        <button class="btn btn-primary" onclick="App.openAddStudentModal()" style="min-height:44px;">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                          <span>Ajouter mon premier élève</span>
                        </button>
                      </div>
                    ` : `
                      <div>Aucun élève trouvé avec les filtres sélectionnés pour ce mois.</div>
                    `}
                  </td>
                </tr>
              ` : filtered.map((s, idx) => {
                const cls = Store.getClassById(s.class_id);
                const fee = cls ? cls.monthly_fee : 0;
                const payment = Store.getPaymentStatus(s.id, 'monthly', currentMonth.id);
                const isPaid = !!payment;

                return `
                  <tr>
                    <td data-label="N°">${idx + 1}</td>
                    <td data-label="Élève">${App.formatStudentName(s)}</td>
                    <td data-label="Section"><span class="badge badge-section" style="background:#2563EB; color:#FFFFFF !important; font-weight:700;">${Utils.escapeHtml(cls ? cls.name : '-')}</span></td>
                    <td data-label="Mensualité" style="font-weight:700; color:var(--text-main);">${Utils.formatFCFA(fee)}</td>
                    <td data-label="Statut" class="cell-actions" style="text-align:center;">
                      <div class="payment-toggle-group">
                        <button 
                          class="toggle-btn btn-status-paid ${isPaid ? 'is-active' : ''}" 
                          onclick="App.onTogglePaid('${s.id}', 'monthly', '${currentMonth.id}', ${fee})"
                          aria-pressed="${isPaid}">
                          <span>✓</span>
                          <span>Payé</span>
                        </button>
                        <button 
                          class="toggle-btn btn-status-unpaid ${!isPaid ? 'is-active' : ''}" 
                          onclick="App.onToggleUnpaid('${s.id}', 'monthly', '${currentMonth.id}')"
                          aria-pressed="${!isPaid}">
                          <span>✕</span>
                          <span>Impayé</span>
                        </button>
                      </div>
                    </td>
                    <td data-label="Actions / Reçu" style="text-align:right;">
                      ${isPaid ? `
                        <div style="display:inline-flex; gap:0.35rem; align-items:center; justify-content:flex-end; flex-wrap:wrap;">
                          <button class="btn btn-secondary btn-sm" onclick="App.openEditPaymentModal('${payment.id}')" title="Modifier cette cotisation (somme, date, mode)" style="padding:0.35rem 0.55rem;">
                            ✎
                          </button>
                          <button class="btn btn-outline-primary btn-sm" onclick="App.viewReceipt('${payment.id}')" title="Afficher le reçu officiel A5">
                            📄 Reçu
                          </button>
                          <button class="btn btn-whatsapp btn-sm" onclick="App.shareReceiptPNG('${payment.id}')" title="Envoyer le reçu officiel en image PNG sur WhatsApp" style="padding:0.35rem 0.55rem; font-size:12px; background:#25D366; color:#FFFFFF; border:none; font-weight:700;">
                            <span>📲 WhatsApp (PNG)</span>
                          </button>
                          <button class="btn btn-outline-primary btn-sm" onclick="App.downloadReceiptPNG('${payment.id}')" title="Télécharger le reçu officiel en image PNG" style="padding:0.35rem 0.55rem; font-size:12px;">
                            <span>📥 PNG</span>
                          </button>
                        </div>
                      ` : `
                        <span style="color:var(--text-muted); font-size:var(--text-xs);">-</span>
                      `}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}
    `;
  },

  // ----------------------------------------------------------------------------
  // VUE 5 : GESTION DES DÉPENSES & RUBRIQUES (§ SORTIES DE CAISSE DE L'ÉCOLE)
  // Motifs, Rubrique budgétaire, Somme en FCFA et Date déduits en temps réel
  // ----------------------------------------------------------------------------
  renderExpenses(container, options = {}) {
    const expenses = Store.getExpenses();
    const expensesSummary = Store.getExpensesSummary();
    const rubriques = Store.getExpenseRubriques();

    // Calcul des totaux par rubrique (les dépenses annulées sont exclues des totaux)
    const rubriqueTotals = {};
    expenses.filter(e => e.status !== 'cancelled').forEach(e => {
      const cat = e.category || 'Fournitures scolaires & papeterie';
      rubriqueTotals[cat] = (rubriqueTotals[cat] || 0) + (parseInt(e.amount, 10) || 0);
    });

    const activeFilter = this.activeExpenseRubriqueFilter || 'all';

    const filtered = expenses.filter(e => {
      if (e.status === 'cancelled') return false;
      const matchSearch = !this.searchTerm
        || (e.motif && e.motif.toLowerCase().includes(this.searchTerm.toLowerCase()))
        || (e.category && e.category.toLowerCase().includes(this.searchTerm.toLowerCase()));
      const matchRubrique = activeFilter === 'all' || e.category === activeFilter;
      return matchSearch && matchRubrique;
    });

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <div>
            <h1 class="view-title">Rubrique Gestion des Dépenses</h1>
            <p class="view-subtitle">Enregistrement et suivi exclusif des sorties de caisse de l'école par rubrique budgétaire</p>
          </div>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" onclick="App.exportExpensesCsv()">
              📄 Exporter CSV
            </button>
            <button class="btn btn-danger btn-sm" onclick="App.openAddExpenseModal()">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>Ajouter une dépense</span>
            </button>
          </div>
        </div>
      </div>

      <!-- KPI Synthèse Dépenses Strictes (Zéro mélange avec les sommes encaissées) -->
      <div class="kpi-grid">
        <div class="kpi-card" style="border-top:4px solid var(--danger);">
          <span class="kpi-title">Total Dépenses Décaissées</span>
          <div class="kpi-figure" style="color:var(--danger);">${Utils.formatFCFA(expensesSummary.total_amount)}</div>
          <div class="kpi-meta">${expensesSummary.count === 0 ? 'Registre vierge (0 sortie)' : `${expensesSummary.count} dépense${expensesSummary.count > 1 ? 's' : ''} décaissée${expensesSummary.count > 1 ? 's' : ''}`}</div>
        </div>

        <div class="kpi-card" style="border-top:4px solid #F59E0B;">
          <span class="kpi-title">Nombre d'opérations</span>
          <div class="kpi-figure" style="color:#B45309;">${expensesSummary.count}</div>
          <div class="kpi-meta">Sortie(s) de caisse enregistrée(s)</div>
        </div>

        <div class="kpi-card" style="border-top:4px solid #6366F1;">
          <span class="kpi-title">Dépense Moyenne</span>
          <div class="kpi-figure" style="color:#4F46E5;">${Utils.formatFCFA(expensesSummary.count > 0 ? Math.round(expensesSummary.total_amount / expensesSummary.count) : 0)}</div>
          <div class="kpi-meta">${Object.keys(rubriqueTotals).length} rubrique${Object.keys(rubriqueTotals).length > 1 ? 's' : ''} active${Object.keys(rubriqueTotals).length > 1 ? 's' : ''}</div>
        </div>
      </div>

      <!-- Information d'isolation stricte des dépenses -->
      <div class="alert-box alert-info" style="display:flex; align-items:flex-start; gap:0.75rem; margin-top:1rem; border-left:4px solid #3B82F6;">
        <span style="font-size:1.3rem;">ℹ️</span>
        <div style="font-size:var(--text-xs); line-height:1.5;">
          <strong>Registre des dépenses 100% vierge et autonome :</strong>
          Cet écran retrace exclusivement les sorties d'argent décaissées pour le fonctionnement de l'établissement. Les sommes encaissées (inscriptions, cotisations mensuelles) sont consultables en synthèse dans le <strong>Bilan annuel</strong>.
        </div>
      </div>

      <!-- Barre de synthèse par Rubrique (Chips cliquables) -->
      ${Object.keys(rubriqueTotals).length > 0 ? `
        <div style="margin-top:1.25rem;">
          <div style="font-size:var(--text-xs); font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.5rem;">
            Répartition par rubrique budgétaire :
          </div>
          <div class="rubriques-summary-bar">
            <button type="button" class="rubrique-chip ${activeFilter === 'all' ? 'active' : ''}" onclick="App.onExpenseRubriqueFilterChange('all')">
              <span>📂 Toutes</span>
              <strong style="color:var(--danger);">${Utils.formatFCFA(expensesSummary.total_amount)}</strong>
            </button>
            ${Object.keys(rubriqueTotals).map(r => `
              <div style="display:inline-flex; align-items:center; gap:0.25rem; margin-right:0.25rem;">
                <button type="button" class="rubrique-chip ${activeFilter === r ? 'active' : ''}" onclick="App.onExpenseRubriqueFilterChange(${Utils.jsArg(r)})">
                  <span>${Utils.escapeHtml(r)}</span>
                  <strong>${Utils.formatFCFA(rubriqueTotals[r])}</strong>
                </button>
                ${Store.isCustomExpenseRubrique(r) ? `
                  <button type="button" class="rubrique-chip-del" onclick="App.deleteCustomRubrique(${Utils.jsArg(r)})" title="Supprimer la rubrique ${Utils.escapeHtml(r)}" aria-label="Supprimer la rubrique">✕</button>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Barre de filtres et recherche -->
      <div class="filter-bar" style="margin-top:1rem;">
        <div class="search-box">
          <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" class="form-input search-input" placeholder="Rechercher par motif ou rubrique..." value="${Utils.escapeHtml(this.searchTerm)}" oninput="App.onSearchInput(this.value)">
        </div>

        <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
          <select class="form-select" style="min-width:240px;" onchange="App.onExpenseRubriqueFilterChange(this.value)">
            <option value="all">📂 Filtrer : Toutes les rubriques (${expenses.length})</option>
            ${rubriques.map(r => `
              <option value="${Utils.escapeHtml(r)}"${activeFilter === r ? ' selected' : ''}>📂 ${Utils.escapeHtml(r)} ${rubriqueTotals[r] ? `(${Utils.formatFCFA(rubriqueTotals[r])})` : '(0 F)'}</option>
            `).join('')}
          </select>
          <button class="btn btn-danger btn-sm" onclick="App.openAddExpenseModal()" style="white-space:nowrap;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>Nouvelle dépense</span>
          </button>
        </div>
      </div>

      <!-- Tableau des dépenses -->
      <div style="background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-lg); padding:1.25rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
          <h2 style="font-size:var(--text-lg); margin-bottom:0;">Registre des dépenses</h2>
          <span class="badge badge-info">${filtered.length} sortie(s) affichée(s)</span>
        </div>

        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Motif de la dépense</th>
                <th>Rubrique budgétaire</th>
                <th>Somme Décaissée</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="5" class="empty-state-cell" style="text-align:center; padding:2.5rem 1rem; color:var(--text-muted);">
                    <div style="font-size:2.5rem; margin-bottom:0.5rem;">💸</div>
                    <p style="font-weight:700; font-size:var(--text-base); margin-bottom:0.35rem; color:var(--text-main);">Aucune dépense trouvée</p>
                    <p style="font-size:var(--text-sm); margin:0 auto; max-width:400px; color:var(--text-muted);">Enregistrez vos frais et sorties de caisse (fournitures, factures, salaires, cantine...)</p>
                  </td>
                </tr>
              ` : filtered.map(e => `
                <tr>
                  <td data-label="Date"><strong>${Utils.formatDate(e.date)}</strong></td>
                  <td data-label="Motif"><strong>${Utils.escapeHtml(e.motif)}</strong></td>
                  <td data-label="Rubrique">
                    <span class="badge-rubrique">📂 ${Utils.escapeHtml(e.category || 'Général')}</span>
                  </td>
                  <td data-label="Somme" style="color:var(--danger); font-weight:800;">
                    - ${Utils.formatFCFA(e.amount)}
                  </td>
                  <td data-label="Actions" style="text-align:right; white-space:nowrap;">
                    <button class="btn btn-secondary btn-sm" onclick="App.openEditExpenseModal('${e.id}')" title="Modifier la dépense">✎</button>
                    <button class="btn btn-outline-primary btn-sm" style="color:var(--danger); border-color:#FECACA;" onclick="App.promptDeleteExpense('${e.id}')" title="Supprimer la dépense">✕</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
            ${filtered.length > 0 ? `
              <tfoot>
                <tr style="background:var(--bg-subtle); font-weight:700; font-size:var(--text-base);">
                  <td colspan="3">TOTAL DÉPENSES DÉCAISSÉES ${activeFilter !== 'all' ? `(${Utils.escapeHtml(activeFilter)})` : ''}</td>
                  <td style="color:var(--danger); font-size:var(--text-base); font-weight:800;">
                    - ${Utils.formatFCFA(filtered.reduce((sum, e) => sum + (parseInt(e.amount, 10) || 0), 0))}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            ` : ''}
          </table>
        </div>
      </div>
    `;
  },

  // ----------------------------------------------------------------------------
  // VUE 6 : BILAN ANNUEL UNIFIÉ (Total, Inscription, Cotisation, Dépenses)
  // Conforme aux directives du directeur :
  // - Bilan Inscription : Somme totale des inscriptions
  // - Bilan Cotisation : Somme totale des cotisations
  // - Bilan Dépenses : Somme totale des décaissements
  // - Bilan Total : Recettes - Dépenses = Solde net disponible au moment T
  // ----------------------------------------------------------------------------
  renderBilan(container, options = {}) {
    if (options.subTab) {
      this.activeBilanSubTab = options.subTab;
    }
    const currentSubTab = this.activeBilanSubTab || 'total';
    const grand = Store.getGrandTotalSummary();
    const regSummary = grand.registration;
    const annualOverview = grand.monthly;
    const expensesSummary = Store.getExpensesSummary();

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <div>
            <h1 class="view-title">Bilan financier annuel</h1>
            <p class="view-subtitle">Suivi complet des encaissements, dépenses et trésorerie disponible au moment T</p>
          </div>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            ${currentSubTab === 'total' ? `
              <button class="btn btn-secondary btn-sm" onclick="App.exportCsvGrandTotal()">Exporter Bilan Global CSV</button>
            ` : currentSubTab === 'registrations' ? `
              <button class="btn btn-secondary btn-sm" onclick="App.exportCsvRegistrations()">Exporter Inscriptions CSV</button>
            ` : currentSubTab === 'monthly' ? `
              <button class="btn btn-secondary btn-sm" onclick="App.exportCsvAnnual()">Exporter Cotisations CSV</button>
            ` : `
              <button class="btn btn-secondary btn-sm" onclick="App.exportExpensesCsv()">Exporter Dépenses CSV</button>
            `}
            <button class="btn btn-primary btn-sm" onclick="window.print()">Imprimer / PDF</button>
          </div>
        </div>

        <!-- SOUS-ONGLETS DU BILAN DEMANDÉS PAR LE DIRECTEUR -->
        <div class="bilan-subtabs-nav" role="tablist" aria-label="Sous-bilans de l'école">
          <button 
            class="bilan-subtab-btn ${currentSubTab === 'total' ? 'active' : ''}" 
            onclick="App.changeBilanSubTab('total')">
            <span>📊 Bilan Total</span>
            <span class="badge-pill" style="font-weight:700;">${Utils.formatFCFA(grand.net_available)}</span>
          </button>

          <button 
            class="bilan-subtab-btn ${currentSubTab === 'registrations' ? 'active' : ''}" 
            onclick="App.changeBilanSubTab('registrations')">
            <span>📝 Bilan Inscription</span>
            <span class="badge-pill">${Utils.formatFCFA(regSummary.total_collected)}</span>
          </button>

          <button 
            class="bilan-subtab-btn ${currentSubTab === 'monthly' ? 'active' : ''}" 
            onclick="App.changeBilanSubTab('monthly')">
            <span>📅 Bilan Cotisation</span>
            <span class="badge-pill">${Utils.formatFCFA(annualOverview.cumulated_collected)}</span>
          </button>

          <button 
            class="bilan-subtab-btn ${currentSubTab === 'expenses' ? 'active' : ''}" 
            onclick="App.changeBilanSubTab('expenses')">
            <span>💸 Bilan Dépenses</span>
            <span class="badge-pill" style="background:var(--danger-subtle); color:var(--danger);">${Utils.formatFCFA(grand.total_expenses)}</span>
          </button>
        </div>
      </div>

      <div id="bilanSubViewContent">
        ${currentSubTab === 'total' ? this.renderBilanTotalContent(grand) :
          currentSubTab === 'registrations' ? this.renderBilanRegistrationsContent(regSummary) :
          currentSubTab === 'monthly' ? this.renderBilanMonthlyContent(annualOverview) :
          this.renderBilanExpensesContent(expensesSummary, grand)}
      </div>
    `;
  },

  changeBilanSubTab(subTab) {
    this.activeBilanSubTab = subTab;
    this.renderBilan(document.getElementById('appViewContent'), { subTab });
  },

  // 1. Contenu du SOUS-ONGLET : BILAN TOTAL (Inscriptions + Cotisations - Dépenses = Solde Restant au moment T)
  renderBilanTotalContent(grand) {
    return `
      <!-- Gros chiffres en FCFA du Bilan Total Annuel (Ordre : Estimé -> Encaissé -> Dépenses -> Disponible) -->
      <div class="kpi-grid">
        <div class="kpi-card" style="border-top:4px solid #2563EB;">
          <span class="kpi-title">1. Somme Estimée (Budget Attendu)</span>
          <div class="kpi-figure" style="color:#2563EB;">${Utils.formatFCFA(grand.grand_expected)}</div>
          <div class="kpi-meta">Budget prévisionnel total (Inscriptions + Mensualités)</div>
        </div>

        <div class="kpi-card" style="border-top:4px solid var(--primary); background:linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%);">
          <span class="kpi-title">2. Somme Totale Encaissée</span>
          <div class="kpi-figure" style="color:var(--primary);">${Utils.formatFCFA(grand.grand_collected)}</div>
          <div class="kpi-meta">Inscriptions (${Utils.formatFCFA(grand.registration.total_collected)}) + Cotisations (${Utils.formatFCFA(grand.monthly.cumulated_collected)}) + Autres entrées (${Utils.formatFCFA(grand.other_revenues ? grand.other_revenues.total_amount : 0)})</div>
        </div>

        <div class="kpi-card" style="border-top:4px solid var(--danger);">
          <span class="kpi-title">3. Total Dépenses Décaissées</span>
          <div class="kpi-figure" style="color:var(--danger);">${Utils.formatFCFA(grand.total_expenses)}</div>
          <div class="kpi-meta">Sorties de caisse de l'école déduites</div>
        </div>

        <div class="kpi-card" style="border-top:4px solid var(--success); background:linear-gradient(180deg, #FFFFFF 0%, #F0FDF4 100%);">
          <span class="kpi-title">
            4. Somme Restante Disponible (Moment T)
            <button class="info-tooltip-btn" title="Total Recettes Encaissées - Total Dépenses = Trésorerie nette disponible en caisse">i</button>
          </span>
          <div class="kpi-figure" style="color:var(--success); font-weight:800;">${Utils.formatFCFA(grand.net_available)}</div>
          <div class="kpi-meta">Trésorerie nette disponible en caisse</div>
        </div>
      </div>

      <!-- Synthèse comparative Inscriptions vs Cotisations vs Dépenses -->
      <div style="background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-lg); padding:1.25rem; margin-top:1.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
          <h2 style="font-size:var(--text-lg); margin-bottom:0;">Synthèse financière générale de l'établissement</h2>
          <span class="badge badge-info">Année scolaire ${Utils.escapeHtml(Store.getSchool().school_year || CONFIG.DEFAULT_SCHOOL_YEAR)}</span>
        </div>

        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Rubrique financière</th>
                <th>Montant Attendu</th>
                <th>Montant Encaissé</th>
                <th>Reste à recouvrer / Charges</th>
                <th>Taux d'encaissement</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-label="Rubrique">
                  <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#2563EB;"></span>
                    <strong>1. Droits d'inscriptions annuels</strong>
                  </div>
                </td>
                <td data-label="Attendu">${Utils.formatFCFA(grand.registration.total_expected)}</td>
                <td data-label="Encaissé" style="color:var(--primary); font-weight:700;">${Utils.formatFCFA(grand.registration.total_collected)}</td>
                <td data-label="Reste" style="color:var(--danger);">${Utils.formatFCFA(grand.registration.total_remaining)}</td>
                <td data-label="Taux">
                  <span class="badge ${grand.registration.percentage >= 80 ? 'badge-success' : 'badge-warning'}">
                    ${grand.registration.percentage}%
                  </span>
                </td>
                <td data-label="Actions" style="text-align:right;">
                  <button class="btn btn-outline-primary btn-sm" onclick="App.changeBilanSubTab('registrations')">
                    Détail Inscriptions →
                  </button>
                </td>
              </tr>
              <tr>
                <td data-label="Rubrique">
                  <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#16A34A;"></span>
                    <strong>2. Cotisations mensuelles (Octobre à Juin)</strong>
                  </div>
                </td>
                <td data-label="Attendu">${Utils.formatFCFA(grand.monthly.cumulated_expected)}</td>
                <td data-label="Encaissé" style="color:var(--primary); font-weight:700;">${Utils.formatFCFA(grand.monthly.cumulated_collected)}</td>
                <td data-label="Reste" style="color:var(--danger);">${Utils.formatFCFA(grand.monthly.cumulated_remaining)}</td>
                <td data-label="Taux">
                  <span class="badge ${grand.monthly.cumulated_percentage >= 80 ? 'badge-success' : 'badge-warning'}">
                    ${grand.monthly.cumulated_percentage}%
                  </span>
                </td>
                <td data-label="Actions" style="text-align:right;">
                  <button class="btn btn-outline-primary btn-sm" onclick="App.changeBilanSubTab('monthly')">
                    Détail Cotisations →
                  </button>
                </td>
              </tr>
              <tr>
                <td data-label="Rubrique">
                  <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#F59E0B;"></span>
                    <strong>3. Autres rentrées (Dons, cantine, blouses, etc.)</strong>
                  </div>
                </td>
                <td data-label="Attendu">-</td>
                <td data-label="Encaissé" style="color:var(--success); font-weight:700;">+ ${Utils.formatFCFA(grand.other_revenues ? grand.other_revenues.total_amount : 0)}</td>
                <td data-label="Reste">${grand.other_revenues ? grand.other_revenues.count : 0} encaissements</td>
                <td data-label="Taux">
                  <span class="badge badge-success">Recettes diverses</span>
                </td>
                <td data-label="Actions" style="text-align:right;">
                  <button class="btn btn-outline-primary btn-sm" onclick="App.navigate('other-revenues')">
                    Détail Rentrées →
                  </button>
                </td>
              </tr>
              <tr style="background:#F8FAFC; font-weight:600;">
                <td data-label="Rubrique">
                  <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#0F172A;"></span>
                    <strong>SOUS-TOTAL RECETTES BRUTES ENCAISSÉES</strong>
                  </div>
                </td>
                <td data-label="Attendu">${Utils.formatFCFA(grand.grand_expected)}</td>
                <td data-label="Encaissé" style="color:var(--primary); font-weight:800;">${Utils.formatFCFA(grand.grand_collected)}</td>
                <td data-label="Reste" style="color:var(--danger);">${Utils.formatFCFA(grand.grand_remaining)}</td>
                <td data-label="Taux">
                  <span class="badge badge-success">${grand.grand_percentage}%</span>
                </td>
                <td></td>
              </tr>
              <tr>
                <td data-label="Rubrique">
                  <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#DC2626;"></span>
                    <strong>4. Total Dépenses de fonctionnement décaissées</strong>
                  </div>
                </td>
                <td data-label="Attendu">-</td>
                <td data-label="Encaissé" style="color:var(--danger); font-weight:700;">- ${Utils.formatFCFA(grand.total_expenses)}</td>
                <td data-label="Reste">Sorties de caisse</td>
                <td data-label="Taux">
                  <span class="badge badge-danger">Charges déduites</span>
                </td>
                <td data-label="Actions" style="text-align:right;">
                  <button class="btn btn-outline-danger btn-sm" onclick="App.changeBilanSubTab('expenses')">
                    Détail Dépenses →
                  </button>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr style="background:var(--success-subtle, #F0FDF4); font-weight:700; font-size:var(--text-base); border-top:2px solid var(--success);">
                <td data-label="Rubrique">
                  <div style="font-weight:800; color:var(--text-dark);">
                    SOLDE RESTANT EN CAISSE (DISPONIBLE AU MOMENT T)
                  </div>
                  <div style="font-size:var(--text-xs); color:var(--text-muted); font-weight:normal;">
                    Formule : Total Encaissé (${Utils.formatFCFA(grand.grand_collected)}) − Dépenses (${Utils.formatFCFA(grand.total_expenses)})
                  </div>
                </td>
                <td data-label="Attendu">-</td>
                <td data-label="Encaissé" style="color:var(--success); font-size:var(--text-lg); font-weight:800;">
                  = ${Utils.formatFCFA(grand.net_available)}
                </td>
                <td data-label="Reste" style="color:var(--text-muted);">-</td>
                <td data-label="Taux">
                  <span class="badge ${grand.net_available >= 0 ? 'badge-success' : 'badge-danger'}" style="font-size:var(--text-sm);">
                    ${grand.net_available >= 0 ? '✓ Trésorerie Positive' : '✕ Déficit'}
                  </span>
                </td>
                <td style="text-align:right;">
                  <button class="btn btn-primary btn-sm" onclick="App.navigate('expenses')">
                    Gérer Dépenses
                  </button>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  },

  // 4. Contenu du SOUS-ONGLET : BILAN DÉPENSES
  renderBilanExpensesContent(expensesSummary, grand) {
    const expenses = Store.getExpenses().filter(e => e.status !== 'cancelled');

    // Regroupement par catégorie
    const byCategory = {};
    expenses.forEach(e => {
      const cat = e.category || 'Général';
      if (!byCategory[cat]) byCategory[cat] = { count: 0, total: 0 };
      byCategory[cat].count++;
      byCategory[cat].total += (parseInt(e.amount, 10) || 0);
    });

    const categoryList = Object.keys(byCategory).map(cat => ({
      category: cat,
      count: byCategory[cat].count,
      total: byCategory[cat].total,
      percentage: expensesSummary.total_amount > 0 ? Math.round((byCategory[cat].total / expensesSummary.total_amount) * 1000) / 10 : 0
    })).sort((a, b) => b.total - a.total);

    return `
      <!-- Synthèse KPI Dépenses et Trésorerie -->
      <div class="kpi-grid">
        <div class="kpi-card" style="border-top:4px solid var(--danger);">
          <span class="kpi-title">Total Dépenses de l'Année</span>
          <div class="kpi-figure" style="color:var(--danger);">${Utils.formatFCFA(expensesSummary.total_amount)}</div>
          <div class="kpi-meta">${expensesSummary.count} sorties de caisse comptabilisées</div>
        </div>

        <div class="kpi-card" style="border-top:4px solid var(--primary);">
          <span class="kpi-title">Recettes Encaissées (Inscriptions + Mois)</span>
          <div class="kpi-figure" style="color:var(--primary);">${Utils.formatFCFA(grand.grand_collected)}</div>
          <div class="kpi-meta">Droits d'inscriptions et cotisations</div>
        </div>

        <div class="kpi-card" style="border-top:4px solid var(--success); background:#F0FDF4;">
          <span class="kpi-title">Solde Restant Disponible (Moment T)</span>
          <div class="kpi-figure" style="color:var(--success); font-weight:800;">${Utils.formatFCFA(grand.net_available)}</div>
          <div class="kpi-meta">Trésorerie nette disponible en caisse</div>
        </div>

        <div class="kpi-card">
          <span class="kpi-title">Ratio Dépenses / Recettes</span>
          <div class="kpi-figure" style="color:${grand.grand_collected > 0 && (expensesSummary.total_amount / grand.grand_collected) < 0.7 ? 'var(--success)' : 'var(--warning)'};">
            ${grand.grand_collected > 0 ? Math.round((expensesSummary.total_amount / grand.grand_collected) * 100) : 0}%
          </div>
          <div class="kpi-meta">Part des rentrées consommée par les charges</div>
        </div>
      </div>

      <!-- Répartition des charges par rubrique -->
      <div style="background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-lg); padding:1.25rem; margin-top:1.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
          <h2 style="font-size:var(--text-lg); margin-bottom:0;">Ventilation des dépenses par rubrique budgétaire</h2>
          <button class="btn btn-danger btn-sm" onclick="App.openAddExpenseModal()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>Ajouter une dépense</span>
          </button>
        </div>

        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Rubrique budgétaire</th>
                <th>Nombre d'opérations</th>
                <th>Total Décaissé</th>
                <th>Part du budget dépenses</th>
              </tr>
            </thead>
            <tbody>
              ${categoryList.map(c => `
                <tr>
                  <td data-label="Catégorie"><strong>${Utils.escapeHtml(c.category)}</strong></td>
                  <td data-label="Nombre">${c.count}</td>
                  <td data-label="Total" style="color:var(--danger); font-weight:700;">- ${Utils.formatFCFA(c.total)}</td>
                  <td data-label="Part">
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                      <div class="progress-bar-container" style="flex:1;">
                        <div class="progress-bar-fill fill-low" style="width:${c.percentage}%;"></div>
                      </div>
                      <span style="font-size:var(--text-xs); font-weight:600; width:45px;">${c.percentage}%</span>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background:var(--bg-subtle); font-weight:700;">
                <td>TOTAL GÉNÉRAL DÉPENSES</td>
                <td>${expensesSummary.count}</td>
                <td style="color:var(--danger);">- ${Utils.formatFCFA(expensesSummary.total_amount)}</td>
                <td>100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  },

  // 2. Contenu du SOUS-ONGLET : BILAN INSCRIPTION
  renderBilanRegistrationsContent(summary) {
    return `
      <!-- Gros chiffres du Bilan Inscription -->
      <div class="kpi-grid">
        <div class="kpi-card" style="border-top:4px solid var(--primary);">
          <span class="kpi-title">Total Inscriptions Encaissées</span>
          <div class="kpi-figure" style="color:var(--primary);">${Utils.formatFCFA(summary.total_collected)}</div>
          <div class="kpi-meta">${summary.paid_students} élèves inscrits en règle</div>
        </div>

        <div class="kpi-card">
          <span class="kpi-title">Montant Attendu</span>
          <div class="kpi-figure">${Utils.formatFCFA(summary.total_expected)}</div>
          <div class="kpi-meta">Sur la base de ${summary.total_students} élèves actifs</div>
        </div>

        <div class="kpi-card">
          <span class="kpi-title">Reste à encaisser</span>
          <div class="kpi-figure" style="color:var(--danger);">${Utils.formatFCFA(summary.total_remaining)}</div>
          <div class="kpi-meta">${summary.unpaid_students} élèves non encore inscrits</div>
        </div>

        <div class="kpi-card">
          <span class="kpi-title">
            Taux d'encaissement
            <button class="info-tooltip-btn" title="Nombre d'élèves payés ÷ Nombre total d'élèves × 100">i</button>
          </span>
          <div class="kpi-figure" style="color:var(--success);">${summary.percentage}%</div>
          <div class="progress-bar-container">
            <div class="progress-bar-fill fill-high" style="width:${summary.percentage}%;"></div>
          </div>
        </div>
      </div>

      <!-- Tableau détaillé par section -->
      <div style="background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-lg); padding:1.25rem; margin-top:1.5rem;">
        <h2 style="font-size:var(--text-lg); margin-bottom:1rem;">Détail des inscriptions par section préscolaire</h2>

        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Section</th>
                <th>Frais par élève</th>
                <th>Effectif</th>
                <th>Payés</th>
                <th>Impayés</th>
                <th>Montant Attendu</th>
                <th>Montant Encaissé</th>
                <th>Reste à recouvrer</th>
                <th>Pourcentage</th>
              </tr>
            </thead>
            <tbody>
              ${summary.classes.map(c => `
                <tr>
                  <td data-label="Section"><strong>${Utils.escapeHtml(c.class_name)}</strong></td>
                  <td data-label="Frais">${Utils.formatFCFA(c.fee)}</td>
                  <td data-label="Effectif">${c.total_students}</td>
                  <td data-label="Payés" style="color:var(--success); font-weight:700;">${c.paid_students}</td>
                  <td data-label="Impayés" style="color:var(--danger); font-weight:700;">${c.unpaid_students}</td>
                  <td data-label="Attendu">${Utils.formatFCFA(c.expected_amount)}</td>
                  <td data-label="Encaissé" style="color:var(--primary); font-weight:700;">${Utils.formatFCFA(c.collected_amount)}</td>
                  <td data-label="Reste" style="color:var(--danger);">${Utils.formatFCFA(c.remaining_amount)}</td>
                  <td data-label="Pourcentage">
                    <span class="badge ${c.percentage >= 80 ? 'badge-success' : c.percentage >= 50 ? 'badge-warning' : 'badge-danger'}">
                      ${c.percentage}%
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background:var(--bg-subtle); font-weight:700;">
                <td data-label="Section">TOTAL INSCRIPTIONS</td>
                <td data-label="Frais">-</td>
                <td data-label="Effectif">${summary.total_students}</td>
                <td data-label="Payés" style="color:var(--success);">${summary.paid_students}</td>
                <td data-label="Impayés" style="color:var(--danger);">${summary.unpaid_students}</td>
                <td data-label="Attendu">${Utils.formatFCFA(summary.total_expected)}</td>
                <td data-label="Encaissé" style="color:var(--primary);">${Utils.formatFCFA(summary.total_collected)}</td>
                <td data-label="Reste" style="color:var(--danger);">${Utils.formatFCFA(summary.total_remaining)}</td>
                <td data-label="Pourcentage">${summary.percentage}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  },

  // 3. Contenu du SOUS-ONGLET : BILAN COTISATION (Mensualités Octobre - Juillet)
  renderBilanMonthlyContent(annual) {
    return `
      <!-- Tableau récapitulatif mois par mois -->
      <div style="background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-lg); padding:1.25rem;">
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Mois scolaire</th>
                <th>Montant Attendu</th>
                <th>Montant Encaissé</th>
                <th>Reste à recouvrer</th>
                <th>Payés</th>
                <th>Impayés</th>
                <th>Pourcentage</th>
                <th style="text-align:right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${annual.months.map(m => `
                <tr>
                  <td data-label="Mois"><strong>${Utils.escapeHtml(m.month_label)}</strong></td>
                  <td data-label="Attendu">${Utils.formatFCFA(m.expected_amount)}</td>
                  <td data-label="Encaissé" style="color:var(--primary); font-weight:700;">${Utils.formatFCFA(m.collected_amount)}</td>
                  <td data-label="Reste" style="color:var(--danger);">${Utils.formatFCFA(m.remaining_amount)}</td>
                  <td data-label="Payés" style="color:var(--success); font-weight:700;">${m.paid_students}</td>
                  <td data-label="Impayés" style="color:var(--danger); font-weight:700;">${m.unpaid_students}</td>
                  <td data-label="Pourcentage">
                    <span class="badge ${m.percentage >= 80 ? 'badge-success' : m.percentage >= 50 ? 'badge-warning' : 'badge-danger'}">
                      ${m.percentage}%
                    </span>
                  </td>
                  <td data-label="Action" style="text-align:right;">
                    <button class="btn btn-outline-primary btn-sm" onclick="App.openMonthDetail('${m.month_id}')">
                      Détails
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background:var(--bg-subtle); font-weight:700;">
                <td data-label="Mois">TOTAL CUMULÉ COTISATIONS</td>
                <td data-label="Attendu">${Utils.formatFCFA(annual.cumulated_expected)}</td>
                <td data-label="Encaissé" style="color:var(--primary);">${Utils.formatFCFA(annual.cumulated_collected)}</td>
                <td data-label="Reste" style="color:var(--danger);">${Utils.formatFCFA(annual.cumulated_remaining)}</td>
                <td data-label="Payés">-</td>
                <td data-label="Impayés">-</td>
                <td data-label="Pourcentage">${annual.cumulated_percentage}%</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  },

  // Alias rétrocompatibles
  renderTotalRegistrations(container) {
    this.renderBilan(container, { subTab: 'registrations' });
  },

  renderAnnualReport(container) {
    this.renderBilan(container, { subTab: 'monthly' });
  },

  /**
   * Générateur autonome de graphique SVG léger sans dépendance
   */
  generateMonthlyBarChartSvg(months) {
    const width = 800;
    const height = 240;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const maxVal = Math.max(...months.map(m => Math.max(m.expected_amount, m.collected_amount, 100000)));
    const barGroupW = chartW / months.length;
    const barW = Math.max(12, (barGroupW - 16) / 2);

    let bars = '';
    let labels = '';

    months.forEach((m, idx) => {
      const x = padding.left + (idx * barGroupW);
      const hExpected = Math.round((m.expected_amount / maxVal) * chartH);
      const hCollected = Math.round((m.collected_amount / maxVal) * chartH);

      const yExpected = padding.top + chartH - hExpected;
      const yCollected = padding.top + chartH - hCollected;

      bars += `
        <rect x="${x + 4}" y="${yExpected}" width="${barW}" height="${hExpected}" fill="#CBD5E1" rx="3" />
        <rect x="${x + barW + 8}" y="${yCollected}" width="${barW}" height="${hCollected}" fill="#2563EB" rx="3" />
      `;

      labels += `
        <text x="${x + (barGroupW / 2)}" y="${height - 12}" font-size="11" fill="#475569" text-anchor="middle" font-family="'Inter', sans-serif">
          ${m.month_label.substring(0, 4)}.
        </text>
      `;
    });

    return `
      <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; min-width:600px; display:block;" aria-label="Graphique des cotisations mensuelles">
        <!-- Grille horizontale -->
        <line x1="${padding.left}" y1="${padding.top}" x2="${width - padding.right}" y2="${padding.top}" stroke="#E2E8F0" stroke-dasharray="3" />
        <line x1="${padding.left}" y1="${padding.top + (chartH / 2)}" x2="${width - padding.right}" y2="${padding.top + (chartH / 2)}" stroke="#E2E8F0" stroke-dasharray="3" />
        <line x1="${padding.left}" y1="${padding.top + chartH}" x2="${width - padding.right}" y2="${padding.top + chartH}" stroke="#CBD5E1" />

        <!-- Libellés axe Y -->
        <text x="${padding.left - 8}" y="${padding.top + 4}" font-size="10" fill="#64748B" text-anchor="end">${Utils.formatFCFA(maxVal)}</text>
        <text x="${padding.left - 8}" y="${padding.top + (chartH / 2) + 4}" font-size="10" fill="#64748B" text-anchor="end">${Utils.formatFCFA(maxVal / 2)}</text>
        <text x="${padding.left - 8}" y="${padding.top + chartH + 4}" font-size="10" fill="#64748B" text-anchor="end">0</text>

        ${bars}
        ${labels}
      </svg>
    `;
  },

  // ----------------------------------------------------------------------------
  // VUE 7 : HISTORIQUE DES REÇUS (§ 3.7)
  // ----------------------------------------------------------------------------
  renderReceipts(container) {
    const receipts = Store.getReceipts();

    const filtered = receipts.filter(r => {
      const matchSearch = !this.searchTerm 
        || r.receipt_number.toLowerCase().includes(this.searchTerm.toLowerCase())
        || r.student_name.toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchSearch;
    });

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <div>
            <h1 class="view-title">Registre des reçus officiels</h1>
            <p class="view-subtitle">${receipts.length} reçus émis avec numéro séquentiel et cachet</p>
          </div>
        </div>
      </div>

      <div class="filter-bar">
        <div class="search-box">
          <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" class="form-input search-input" placeholder="Rechercher par n° de reçu ou nom d'élève..." value="${Utils.escapeHtml(this.searchTerm)}" oninput="App.onSearchInput(this.value)">
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>N° Reçu</th>
              <th>Date & Heure</th>
              <th>Élève</th>
              <th>Section</th>
              <th>Objet</th>
              <th>Montant</th>
              <th>Statut</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0 ? `
              <tr>
                <td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">
                  Aucun reçu ne correspond à votre recherche.
                </td>
              </tr>
            ` : filtered.map(r => `
              <tr>
                <td data-label="N° Reçu"><strong>${Utils.escapeHtml(r.receipt_number)}</strong></td>
                <td data-label="Date">${Utils.formatDateTime(r.issued_at)}</td>
                <td data-label="Élève"><strong>${Utils.escapeHtml(r.student_name)}</strong></td>
                <td data-label="Section"><span class="badge badge-section" style="background:#2563EB; color:#FFFFFF !important; font-weight:700;">${Utils.escapeHtml(r.class_name)}</span></td>
                <td data-label="Objet">${Utils.escapeHtml(r.object_label)}</td>
                <td data-label="Montant" style="font-weight:700; color:var(--primary);">${Utils.formatFCFA(r.amount)}</td>
                <td data-label="Statut">
                  ${r.status === 'valid' 
                    ? `<span class="badge badge-success">✓ Valide</span>`
                    : `<span class="badge badge-danger">✕ Annulé</span>`
                  }
                </td>
                <td data-label="Actions" style="text-align:right;">
                  <button class="btn btn-primary btn-sm" onclick="App.viewReceipt('${r.payment_id}')">
                    Ouvrir
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // ----------------------------------------------------------------------------
  // VUE 8 : PARAMÈTRES DE L'ÉCOLE (CACHET, SECTIONS, CONTACTS)
  // ----------------------------------------------------------------------------
  renderSettings(container) {
    const school = Store.getSchool();
    const stampSvg = SchoolStamp.generateSVG({ ...school, stamp_color: '#1E3A8A' }, 200);
    const classes = Store.getClasses();
    const isDemo = Store.isDemo();

    container.innerHTML = `
      <div class="view-header">
        <h1 class="view-title">Paramètres de l'établissement</h1>
        <p class="view-subtitle">Configuration générale de l'école, cachet officiel et tarifs</p>
      </div>

      <div style="display:grid; grid-template-columns:1fr; gap:1.5rem;">
        ${isDemo ? `
          <div style="background:linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%); border:1.5px solid #3B82F6; border-radius:var(--radius-lg); padding:1.5rem; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:1rem;">
            <div>
              <div style="font-weight:800; font-size:1.1rem; color:#1E3A8A; display:flex; align-items:center; gap:0.5rem;">
                <span>🌟</span> <span>Espace Démonstration Actif</span>
              </div>
              <p style="font-size:var(--text-sm); color:#1E40AF; margin-top:0.25rem; max-width:620px;">
                Vous utilisez actuellement les données modèles d'exemple (34 élèves, cotisations et dépenses). Vous pouvez tester toutes les fonctionnalités, ou bien enregistrer votre véritable école avec ses propres sections et son cachet certifié.
              </p>
            </div>
            <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
              <button class="btn btn-primary" onclick="App.openReferenceSchoolModal()" style="background:#1E3A8A;">
                <span>+ Référencer mon école</span>
              </button>
              <button class="btn btn-secondary" onclick="App.restoreDemoFixtures()">
                <span>🔄 Recharger la démo</span>
              </button>
            </div>
          </div>
        ` : ''}

        <!-- Apparence & Thème d'affichage (§ Mode Clair / Mode Sombre) -->
        <div style="background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-lg); padding:1.25rem 1.5rem; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:1rem;">
          <div>
            <div style="font-weight:700; font-size:var(--text-base); color:var(--text-main); display:flex; align-items:center; gap:0.5rem;">
              <span>🌓</span> <span>Apparence & Thème d'affichage</span>
            </div>
            <p style="font-size:var(--text-xs); color:var(--text-muted); margin-top:0.25rem;">
              Basculez à tout moment entre le Mode Clair et le Mode Sombre selon vos préférences.
            </p>
          </div>
          <div>
            <button type="button" id="btnSettingToggleTheme" class="btn btn-secondary" onclick="App.toggleTheme()" style="display:inline-flex; align-items:center; gap:0.5rem; font-weight:700;">
              <span>${document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️ Passer en Mode Clair' : '🌙 Passer en Mode Sombre'}</span>
            </button>
          </div>
        </div>

        <!-- Sauvegarde en ligne & vérification des reçus depuis tout téléphone -->
        <div id="cloudSyncCard" style="background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-lg); padding:1.25rem 1.5rem; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:1rem;">
          ${this.renderCloudSyncCardContent()}
        </div>

        <!-- Mise à jour & Synchronisation PWA de l'application -->
        <div style="background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-lg); padding:1.25rem 1.5rem; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:1rem;">
          <div>
            <div style="font-weight:700; font-size:var(--text-base); color:var(--text-main); display:flex; align-items:center; gap:0.5rem;">
              <span>📲</span> <span>Mise à jour & Synchronisation de l'application</span>
            </div>
            <p style="font-size:var(--text-xs); color:var(--text-muted); margin-top:0.25rem; line-height:1.4;">
              Version : <strong>v1.0.4 (${CONFIG.DEFAULT_SCHOOL_YEAR || '2026-2027'})</strong>. Force le rechargement immédiat de l'application sur votre téléphone pour charger instantanément les dernières corrections sans attendre le cache.
            </p>
          </div>
          <div>
            <button type="button" id="btnForcePwaUpdate" class="btn btn-primary" onclick="App.forceAppUpdate()" style="display:inline-flex; align-items:center; gap:0.5rem; font-weight:700; background:#1E3A8A;">
              <span>🔄 Actualiser & Forcer la mise à jour</span>
            </button>
          </div>
        </div>

        <!-- Édition du Cachet officiel (§ 6) -->
        <div style="background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-lg); padding:1.5rem;">
          <h2 style="font-size:var(--text-lg); margin-bottom:1rem; color:var(--primary); font-weight:700;">Cachet officiel & Coordonnées de l'école</h2>
          <div style="display:flex; flex-wrap:wrap; gap:2rem; align-items:center;">
            <div id="settingsStampDisplay">
              ${stampSvg}
            </div>
            <div style="flex:1; min-width:280px;">
              <p style="font-size:var(--text-sm); color:var(--text-muted); margin-bottom:1rem;">
                Le cachet officiel bleu encre (#1E3A8A) à double contour circulaire est généré en temps réel d'après les informations ci-dessous. Il s'applique automatiquement sur tous les reçus imprimables et partagés.
              </p>
              <div class="form-group">
                <label class="form-label" for="settingSchoolName">Nom officiel de l'école <span style="color:var(--danger)">*</span></label>
                <input type="text" id="settingSchoolName" class="form-input" value="${Utils.escapeHtml(school.name)}">
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                <div class="form-group">
                  <label class="form-label" for="settingDirectorName">Nom du Directeur / de la Directrice <span style="color:var(--danger)">*</span></label>
                  <input type="text" id="settingDirectorName" class="form-input" value="${Utils.escapeHtml(school.director_name)}">
                </div>
                <div class="form-group">
                  <label class="form-label" for="settingDirectorPhone">Téléphone de l'école <span style="color:var(--danger)">*</span></label>
                  <input type="text" id="settingDirectorPhone" class="form-input" value="${Utils.escapeHtml(school.director_phone)}">
                </div>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                <div class="form-group">
                  <label class="form-label" for="settingSchoolYear">Année scolaire</label>
                  <input type="text" id="settingSchoolYear" class="form-input" value="${Utils.escapeHtml(school.school_year || '2026-2027')}">
                </div>
                <div class="form-group">
                  <label class="form-label" for="settingAddress">Adresse précise</label>
                  <input type="text" id="settingAddress" class="form-input" value="${Utils.escapeHtml(school.address || '')}" placeholder="Ex: Quartier Plateau, Rue Félix Faure">
                </div>
              </div>
            </div>
          </div>

          <!-- Tarification des sections -->
          <div style="margin-top:1.5rem; border-top:1px solid var(--border-light); padding-top:1.25rem;">
            <h3 style="font-size:var(--text-md); margin-bottom:0.75rem; color:var(--text-main); font-weight:700;">
              Tarifs des sections préscolaires (en FCFA)
            </h3>
            <p style="font-size:var(--text-xs); color:var(--text-muted); margin-bottom:1rem;">
              Ces montants servent de valeurs par défaut lors de l'enregistrement des paiements d'inscription et des cotisations mensuelles.
            </p>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:1rem;">
              ${classes.map(c => `
                <div style="background:var(--bg-subtle); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border-light);">
                  <strong style="color:var(--primary); font-size:var(--text-sm);">${Utils.escapeHtml(c.name)}</strong>
                  <div style="margin-top:0.5rem; display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
                    <div>
                      <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:2px;">Inscription</label>
                      <input type="number" id="settingFeeReg_${c.id}" class="form-input" value="${c.registration_fee || 0}" min="0" step="500">
                    </div>
                    <div>
                      <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:2px;">Mensualité</label>
                      <input type="number" id="settingFeeMonth_${c.id}" class="form-input" value="${c.monthly_fee || 0}" min="0" step="500">
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div style="margin-top:1.25rem; display:flex; justify-content:flex-end;">
            <button class="btn btn-primary" onclick="App.saveSettings()" style="background:#1E3A8A;">
              <span>Enregistrer les modifications</span>
            </button>
          </div>
        </div>

        <!-- Réinitialisation complète et remise à zéro -->
        <div style="background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-lg); padding:1.5rem; border-left:4px solid var(--danger);">
          <h2 style="font-size:var(--text-lg); margin-bottom:0.5rem; color:var(--danger); display:flex; align-items:center; gap:0.5rem;">
            <span>⚠️</span> <span>Réinitialisation et remise à zéro</span>
          </h2>
          <p style="font-size:var(--text-sm); color:var(--text-muted); margin-bottom:1rem; line-height:1.5;">
            Effacez l'intégralité des saisies actuelles (tous les élèves, inscriptions, cotisations, autres entrées et dépenses) pour repartir sur une base 100% vierge et propre prête pour de nouvelles saisies.
          </p>
          <button class="btn btn-danger" onclick="App.resetAllDataToZero()">
            <span>🗑️</span> <span>Réinitialiser les données (Tout effacer)</span>
          </button>
        </div>
      </div>
    `;
  },

  // ----------------------------------------------------------------------------
  // CARTE « SAUVEGARDE EN LIGNE » (PARAMÈTRES)
  // ----------------------------------------------------------------------------
  renderCloudSyncCardContent() {
    const status = window.CloudSync ? CloudSync.status : { state: 'unavailable', message: '' };
    const palette = {
      ok: { dot: '#16A34A', label: 'Active' },
      syncing: { dot: '#2563EB', label: 'Synchronisation...' },
      error: { dot: '#DC2626', label: 'En attente' },
      'no-session': { dot: '#D97706', label: 'Inactive' },
      demo: { dot: '#94A3B8', label: 'Non disponible en démo' },
      idle: { dot: '#94A3B8', label: 'Vérification...' },
      unavailable: { dot: '#94A3B8', label: 'Indisponible' }
    };
    const p = palette[status.state] || palette.idle;
    let detail = status.message || '';
    if (status.state === 'ok') {
      detail = `Dernière sauvegarde : ${status.lastBackupAt ? Utils.formatDateTime(status.lastBackupAt) : 'à jour'}. ${status.publishedCount || 0} reçu(s) vérifiable(s) par QR code depuis n'importe quel téléphone.`;
    }
    const canSync = window.CloudSync && CloudSync.canSync();
    return `
      <div style="flex:1; min-width:240px;">
        <div style="font-weight:700; font-size:var(--text-base); color:var(--text-main); display:flex; align-items:center; gap:0.5rem;">
          <span>☁️</span> <span>Sauvegarde en ligne & vérification des reçus</span>
          <span style="display:inline-flex; align-items:center; gap:0.35rem; font-size:var(--text-xs); font-weight:700; color:${p.dot};">
            <span style="width:9px; height:9px; border-radius:50%; background:${p.dot}; display:inline-block;"></span>${Utils.escapeHtml(p.label)}
          </span>
        </div>
        <p style="font-size:var(--text-xs); color:var(--text-muted); margin-top:0.25rem; line-height:1.45;">${Utils.escapeHtml(detail || "Vos données sont sauvegardées automatiquement dans votre espace en ligne privé, et vos reçus deviennent vérifiables par les parents.")}</p>
      </div>
      <div>
        <button type="button" class="btn btn-secondary" onclick="App.forceCloudSync()" ${canSync ? '' : 'disabled'} style="display:inline-flex; align-items:center; gap:0.5rem; font-weight:700;">
          <span>☁️ Sauvegarder maintenant</span>
        </button>
      </div>
    `;
  },

  updateCloudSyncCard() {
    const card = document.getElementById('cloudSyncCard');
    if (card) card.innerHTML = this.renderCloudSyncCardContent();
  },

  async forceCloudSync() {
    if (!window.CloudSync) return;
    const status = await CloudSync.syncNow({ force: true });
    this.updateCloudSyncCard();
    if (status.state === 'ok') {
      this.showToast("✓ Sauvegarde en ligne effectuée.", "success");
    } else if (status.message) {
      this.showToast(status.message, status.state === 'error' ? 'danger' : 'warning');
    }
  },

  // ----------------------------------------------------------------------------
  // GESTION DU FLUX DE PAIEMENT & MODALE DE VALIDATION (§ 3.3 & § 3.4)
  // ----------------------------------------------------------------------------
  
  onTogglePaid(studentId, kind, monthId, defaultFee) {
    const existing = Store.getPaymentStatus(studentId, kind, monthId);
    if (existing) {
      // Déjà payé -> On ouvre le reçu officiel
      this.viewReceipt(existing.id);
      return;
    }

    const student = Store.getStudentById(studentId);
    if (!student) return;

    // Si le montant par défaut n'est pas encore défini (tarif 0 ou non renseigné), on ouvre la modale de validation
    if (!defaultFee || defaultFee <= 0) {
      this.openPaymentValidationModal(studentId, kind, monthId, defaultFee);
      return;
    }

    // Activation automatique instantanée (§ Demande direction : un clic sur Payé active le paiement et le reçu)
    try {
      const res = Store.recordPayment({
        studentId,
        kind,
        monthId: monthId || null,
        amount: defaultFee,
        method: 'wave',
        reference: ''
      });

      const studentName = `${student.first_names} ${student.last_name}`;
      const feeFormatted = Utils.formatFCFA(defaultFee);
      
      this.showToast(`✓ Paiement validé pour ${studentName} (${feeFormatted}) ! Reçu officiel généré.`, "success");

      // Rafraîchir la vue courante en préservant la position de défilement et les filtres actifs
      const scrollY = window.scrollY;
      this.navigate(this.currentTab, { preserveFilters: true });
      window.scrollTo(0, scrollY);
    } catch (err) {
      this.showToast("Erreur lors de la validation : " + err.message, "danger");
    }
  },

  onToggleUnpaid(studentId, kind, monthId) {
    const existing = Store.getPaymentStatus(studentId, kind, monthId);
    if (!existing) {
      // Déjà impayé, rien à faire
      return;
    }

    // Le passage de Payé à Impayé exige un motif obligatoire (§ 3.9)
    this.openCancelPaymentModal(existing.id);
  },

  openPaymentValidationModal(studentId, kind, monthId, defaultFee) {
    const student = Store.getStudentById(studentId);
    const cls = student ? Store.getClassById(student.class_id) : null;
    let title = "Validation du paiement de l'inscription";
    if (kind === 'monthly') {
      const m = Store.getMonthById(monthId);
      title = `Validation de la cotisation de ${m ? m.label : ''}`;
    }

    const modal = document.getElementById('paymentValidationModal');
    if (!modal) return;

    document.getElementById('payValTitle').textContent = title;
    document.getElementById('payValStudentName').textContent = `${student.first_names} ${student.last_name} (${cls ? cls.name : ''})`;
    document.getElementById('payValAmount').value = defaultFee;
    document.getElementById('payValMethod').value = 'wave';
    document.getElementById('payValReference').value = '';
    
    // Date du jour par défaut
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('payValDate').value = today;

    // Stockage temporaire du contexte
    modal.dataset.studentId = studentId;
    modal.dataset.kind = kind;
    modal.dataset.monthId = monthId || '';

    modal.classList.add('is-open');
  },

  confirmPayment() {
    const modal = document.getElementById('paymentValidationModal');
    if (!modal) return;

    const studentId = modal.dataset.studentId;
    const kind = modal.dataset.kind;
    const monthId = modal.dataset.monthId || null;

    const amount = parseInt(document.getElementById('payValAmount').value, 10);
    const method = document.getElementById('payValMethod').value;
    const reference = document.getElementById('payValReference').value;
    const paidAt = (document.getElementById('payValDate') || {}).value || null;

    try {
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("Veuillez saisir un montant valide en FCFA.");
      }
      const res = Store.recordPayment({
        studentId,
        kind,
        monthId,
        amount,
        method,
        reference,
        paidAt
      });

      modal.classList.remove('is-open');
      this.showToast("Paiement validé ! Reçu officiel généré.", "success");

      // Rafraîchir la vue courante
      this.navigate(this.currentTab);

      // Ouvrir immédiatement et automatiquement le reçu (§ 7)
      this.viewReceipt(res.payment.id);
    } catch (err) {
      alert("Erreur : " + err.message);
    }
  },

  // ----------------------------------------------------------------------------
  // GESTION DE LA MODIFICATION DE COTISATION OU PAIEMENT D'INSCRIPTION
  // Somme, date, mode, référence avec mise à jour temps réel des reçus & bilans
  // ----------------------------------------------------------------------------
  openEditPaymentModal(paymentId) {
    const payment = Store.getPaymentById(paymentId) || (Store.data.payments && Store.data.payments.find(p => p.id === paymentId));
    if (!payment) {
      this.showToast("Paiement introuvable.", "warning");
      return;
    }

    const modal = document.getElementById('editPaymentModal');
    if (!modal) return;

    const receipt = Store.data.receipts && Store.data.receipts.find(r => r.payment_id === paymentId);
    const student = Store.getStudentById(payment.student_id);
    const cls = student ? Store.getClassById(student.class_id) : null;

    this.activeEditingPayment = payment;

    const idInput = document.getElementById('editPaymentId');
    const amountInput = document.getElementById('editPayAmount');
    const dateInput = document.getElementById('editPayDate');
    const methodSelect = document.getElementById('editPayMethod');
    const refInput = document.getElementById('editPayReference');
    const nameEl = document.getElementById('editPayStudentName');
    const contextEl = document.getElementById('editPayContextLabel');
    const receiptNumEl = document.getElementById('editPayReceiptNumber');

    if (idInput) idInput.value = payment.id;
    if (amountInput) amountInput.value = payment.amount || '';
    if (dateInput) {
      dateInput.value = payment.paid_at ? payment.paid_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
    }
    if (methodSelect) methodSelect.value = payment.method || 'cash';
    if (refInput) refInput.value = payment.reference || '';

    if (nameEl) {
      nameEl.textContent = student ? `${student.first_names} ${(student.last_name || '').toUpperCase()}` : 'Élève inconnu';
    }

    if (contextEl) {
      let ctx = payment.kind === 'monthly'
        ? `Cotisation : Mois de ${Store.getMonthById(payment.month_id)?.label || payment.month_id}`
        : "Frais d'inscription scolaire";
      if (cls) ctx += ` — Section : ${cls.name}`;
      contextEl.textContent = ctx;
    }

    if (receiptNumEl) {
      receiptNumEl.textContent = receipt ? receipt.receipt_number : '-';
    }

    modal.classList.add('is-open');
    setTimeout(() => {
      if (amountInput) {
        amountInput.focus();
        amountInput.select();
      }
    }, 100);
  },

  handleEditPaymentSubmit(event) {
    if (event) event.preventDefault();
    try {
      const paymentId = (document.getElementById('editPaymentId')?.value || '').trim();
      const rawAmount = document.getElementById('editPayAmount')?.value || '';
      const date = document.getElementById('editPayDate')?.value;
      const method = document.getElementById('editPayMethod')?.value || 'cash';
      const ref = document.getElementById('editPayReference')?.value || '';

      if (!paymentId) throw new Error("Identifiant de paiement invalide.");
      if (!rawAmount) throw new Error("Veuillez renseigner un montant.");
      if (!date) throw new Error("La date du règlement est obligatoire.");

      Store.updatePayment(paymentId, {
        amount: rawAmount,
        date: date,
        method: method,
        reference: ref
      });

      this.closeAllModals();
      this.showToast("Paiement modifié avec succès ! Reçu et bilans actualisés.", "success");

      // Rafraîchir la vue active
      if (this.currentTab === 'registrations') {
        this.renderRegistrations(document.getElementById('appViewContent'));
      } else if (this.currentTab === 'monthly') {
        this.renderMonthly(document.getElementById('appViewContent'));
      } else if (this.currentTab === 'bilan') {
        this.renderBilan(document.getElementById('appViewContent'));
      } else {
        this.navigate(this.currentTab, { preserveFilters: true });
      }
    } catch (err) {
      console.error("Erreur modification paiement:", err);
      this.showToast(err.message || "Erreur lors de la modification du paiement.", "danger");
    }
  },

  openEditStudentFromPayment() {
    if (!this.activeEditingPayment) return;
    const studentId = this.activeEditingPayment.student_id;
    this.closeAllModals();
    this.openEditStudentModal(studentId);
  },

  cancelPaymentFromEditModal() {
    if (!this.activeEditingPayment) return;
    const paymentId = this.activeEditingPayment.id;
    this.closeAllModals();
    this.openCancelPaymentModal(paymentId);
  },

  // ----------------------------------------------------------------------------
  // GESTION DU FLUX D'ANNULATION AVEC MOTIF OBLIGATOIRE (§ 3.9)
  // ----------------------------------------------------------------------------
  openCancelPaymentModal(paymentId) {
    const modal = document.getElementById('cancelPaymentModal');
    if (!modal) return;

    const payment = Store.data.payments.find(p => p.id === paymentId);
    const receipt = Store.data.receipts.find(r => r.payment_id === paymentId);
    const student = payment ? Store.getStudentById(payment.student_id) : null;

    modal.dataset.paymentId = paymentId;
    document.getElementById('cancelReceiptNumber').textContent = receipt ? receipt.receipt_number : '-';
    document.getElementById('cancelStudentName').textContent = student ? `${student.first_names} ${student.last_name}` : '-';
    document.getElementById('cancelReasonSelect').value = CONFIG.CANCEL_REASONS[0];
    document.getElementById('cancelReasonText').value = '';

    modal.classList.add('is-open');
  },

  confirmCancelPayment() {
    const modal = document.getElementById('cancelPaymentModal');
    if (!modal) return;

    const paymentId = modal.dataset.paymentId;
    const selectReason = document.getElementById('cancelReasonSelect').value;
    const customReason = document.getElementById('cancelReasonText').value.trim();

    const fullReason = customReason ? `${selectReason} : ${customReason}` : selectReason;

    try {
      Store.cancelPayment(paymentId, fullReason);
      modal.classList.remove('is-open');
      this.showToast("Paiement annulé. Reçu archivé avec mention ANNULÉ.", "danger");
      this.navigate(this.currentTab);
    } catch (err) {
      alert("Erreur lors de l'annulation : " + err.message);
    }
  },

  // ----------------------------------------------------------------------------
  // ----------------------------------------------------------------------------
  // AFFICHAGE & ÉMISSION DU REÇU OFFICIEL FORMAT A5 EN IMAGE PNG (§ 7)
  // Reçu en image PNG haute définition (CORS & vectoriel) - Aucun lien envoyé
  // ----------------------------------------------------------------------------
  getReceiptDocumentHtml(paymentId) {
    const receipt = Store.data.receipts ? Store.data.receipts.find(r => r.payment_id === paymentId || r.id === paymentId) : null;
    const payment = Store.data.payments ? Store.data.payments.find(p => p.id === paymentId) : null;
    const otherRev = !payment && Store.data.other_revenues ? Store.data.other_revenues.find(o => o.id === paymentId || (receipt && o.receipt_number === receipt.receipt_number)) : null;

    if (!receipt || (!payment && !otherRev)) {
      return '<div style="padding:2rem; text-align:center; color:var(--text-muted);">Reçu introuvable</div>';
    }

    const school = Store.getSchool();
    let student = null;
    let cls = null;
    let objectLabel = "Frais d'inscription";
    let amount = 0;
    let method = 'cash';
    let reference = null;
    let studentNameHtml = '';
    let classNameStr = '-';
    let parentNameStr = 'Non renseigné';
    let cancelReasonStr = null;

    if (payment) {
      student = Store.getStudentById(payment.student_id);
      cls = student ? Store.getClassById(student.class_id) : null;
      if (payment.kind === 'monthly') {
        const m = Store.getMonthById(payment.month_id);
        objectLabel = `Cotisation du mois de ${m ? m.label : ''} ${school.school_year}`;
      }
      amount = payment.amount;
      method = payment.method;
      reference = payment.reference;
      studentNameHtml = `<span class="receipt-value-highlight">${Utils.escapeHtml(student ? student.first_names : '')} <strong>${Utils.escapeHtml(student ? (student.last_name || '').toUpperCase() : '')}</strong></span>`;
      classNameStr = cls ? cls.name : '-';
      parentNameStr = student && student.parent_name ? student.parent_name : 'Non renseigné';
      cancelReasonStr = payment.cancel_reason;
    } else if (otherRev) {
      amount = otherRev.amount;
      method = otherRev.payment_method || 'cash';
      reference = otherRev.motif;
      objectLabel = `Autre rentrée : ${otherRev.category || 'Général'} — ${otherRev.motif}`;
      studentNameHtml = `<span class="receipt-value-highlight"><strong>${Utils.escapeHtml(otherRev.payer_name ? otherRev.payer_name : otherRev.motif)}</strong></span>`;
      classNameStr = otherRev.category || 'Recette diverse';
      parentNameStr = otherRev.payer_name || 'Établissement';
      cancelReasonStr = otherRev.cancel_reason;
    }

    const amountInWords = Utils.amountToFrenchWords(amount);
    const basePath = window.location.pathname.replace(/[^/]*$/, '');
    const verifyUrl = `${window.location.origin}${basePath}verify.html?token=${encodeURIComponent(receipt.public_token)}`;
    const qrSvg = Utils.generateQRCodeSVG(verifyUrl, 104);
    const stampSvg = SchoolStamp.generateSVG(school, 155, false);

    return `
      <div class="receipt-document" style="background:#FFFFFF; color:#0F172A; padding:1.75rem; border-radius:12px; font-family:'Inter', sans-serif; box-shadow:0 4px 20px rgba(0,0,0,0.06); position:relative; overflow:hidden;">
        ${receipt.status === 'cancelled' ? `
          <div class="receipt-watermark-cancelled">ANNULÉ</div>
        ` : ''}

        <!-- En-tête -->
        <div class="receipt-header" style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #0F172A; padding-bottom:1rem; margin-bottom:1.25rem; gap:1rem;">
          <div class="receipt-school-info">
            <h2 style="font-size:1.25rem; font-weight:800; color:#1E3A8A; margin-bottom:0.25rem; text-transform:uppercase;">${Utils.escapeHtml(school.name)}</h2>
            <div class="receipt-school-meta" style="font-size:0.875rem; color:#475569; line-height:1.4;">
              ${school.address ? `<div>${Utils.escapeHtml(school.address)}</div>` : ''}
              <div>${Utils.escapeHtml(school.commune || '')}, ${Utils.escapeHtml(school.region || '')} — Sénégal</div>
              <div>Tél : ${Utils.escapeHtml(school.director_phone || '')}</div>
            </div>
          </div>
          <div class="receipt-title-box" style="text-align:right; min-width:170px;">
            <span class="receipt-badge-title" style="display:inline-block; background-color:#1E3A8A; color:#FFFFFF; font-weight:700; font-size:0.95rem; letter-spacing:0.5px; padding:0.35rem 0.75rem; border-radius:4px;">REÇU OFFICIEL</span>
            <div class="receipt-number" style="font-family:monospace; font-size:1.1rem; font-weight:800; color:#0F172A; margin-top:0.35rem;">${Utils.escapeHtml(receipt.receipt_number)}</div>
            <div class="receipt-datetime" style="font-size:0.8rem; color:#64748B; margin-top:0.2rem;">${Utils.formatDateTime(receipt.issued_at)}</div>
          </div>
        </div>

        <!-- Corps du reçu -->
        <div class="receipt-body">
          <div class="receipt-info-grid" style="display:grid; grid-template-columns:1fr; gap:0.5rem; margin-bottom:1.25rem; font-size:0.95rem;">
            <div class="receipt-row" style="display:flex; justify-content:space-between; border-bottom:1px dashed #E2E8F0; padding:0.4rem 0;">
              <span class="receipt-label" style="font-weight:600; color:#64748B;">${payment ? 'Élève inscrit' : 'Bénéficiaire / Payeur'} :</span>
              <span style="font-weight:700; color:#0F172A;">${studentNameHtml}</span>
            </div>
            <div class="receipt-row" style="display:flex; justify-content:space-between; border-bottom:1px dashed #E2E8F0; padding:0.4rem 0;">
              <span class="receipt-label" style="font-weight:600; color:#64748B;">Classe / Rubrique :</span>
              <span class="receipt-value" style="font-weight:700; color:#0F172A;">${Utils.escapeHtml(classNameStr)}</span>
            </div>
            <div class="receipt-row" style="display:flex; justify-content:space-between; border-bottom:1px dashed #E2E8F0; padding:0.4rem 0;">
              <span class="receipt-label" style="font-weight:600; color:#64748B;">Parent / Contact :</span>
              <span class="receipt-value" style="font-weight:700; color:#0F172A;">${Utils.escapeHtml(parentNameStr)}</span>
            </div>
            <div class="receipt-row" style="display:flex; justify-content:space-between; border-bottom:1px dashed #E2E8F0; padding:0.4rem 0;">
              <span class="receipt-label" style="font-weight:600; color:#64748B;">Objet du versement :</span>
              <span class="receipt-value" style="font-weight:700; color:#1E3A8A;">${Utils.escapeHtml(objectLabel)}</span>
            </div>
          </div>

          <!-- Montant officiel -->
          <div class="receipt-amount-card" style="background:#F8FAFC; border:1.5px solid #CBD5E1; border-radius:8px; padding:1rem 1.25rem; margin-bottom:1.25rem;">
            <div class="receipt-amount-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
              <span style="font-weight:800; font-size:0.95rem; text-transform:uppercase; color:#334155;">Montant réglé :</span>
              <span class="receipt-amount-figures" style="font-size:1.6rem; font-weight:900; color:#16A34A; letter-spacing:-0.5px;">${Utils.formatFCFA(amount)}</span>
            </div>
            <div class="receipt-amount-words" style="font-size:0.875rem; color:#475569; margin-bottom:0.5rem; font-style:italic;">
              Soit : <strong>${Utils.escapeHtml(amountInWords)}</strong>
            </div>
            <div class="receipt-payment-details" style="display:flex; justify-content:space-between; font-size:0.85rem; border-top:1px solid #E2E8F0; padding-top:0.45rem;">
              <span>Règlement : <strong>${Utils.escapeHtml(Utils.paymentMethodLabel(method))}</strong> ${reference ? `(Réf : ${Utils.escapeHtml(reference)})` : ''}</span>
              <span style="color:#16A34A; font-weight:800;">✓ Situation : Réglé en totalité</span>
            </div>
          </div>

          ${receipt.status === 'cancelled' ? `
            <div style="background:#FEE2E2; border:1px solid #FECACA; padding:0.6rem 0.8rem; border-radius:4px; font-size:0.8rem; color:#991B1B; margin-bottom:1rem;">
              ⚠️ <strong>Paiement annulé :</strong> ${Utils.escapeHtml(cancelReasonStr || 'Annulation')}
            </div>
          ` : ''}

          <!-- Signatures, Cachet & QR Code -->
          <div class="receipt-signatures-area" style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:1.25rem; padding-top:1rem; border-top:1px solid #E2E8F0;">
            <div class="receipt-qr-box" style="text-align:center;">
              <div class="qr-wrapper">${qrSvg}</div>
              <div class="receipt-qr-caption" style="font-size:10px; color:#64748B; margin-top:4px;">Authenticité certifiée</div>
            </div>

            <div class="receipt-stamp-box" style="display:flex; align-items:center; justify-content:center;">
              ${stampSvg}
            </div>

            <div class="receipt-director-box" style="text-align:center; min-width:150px;">
              <span class="receipt-signature-title" style="font-size:0.85rem; font-weight:700; color:#334155;">Le Directeur</span>
              <div class="receipt-signature-line" style="height:35px; border-bottom:1px dashed #94A3B8; margin-bottom:4px;"></div>
              <span class="receipt-director-name" style="font-size:0.85rem; font-weight:700; color:#0F172A;">${Utils.escapeHtml(school.director_name)}</span>
            </div>
          </div>

          <!-- Pied de page officiel -->
          <div class="receipt-footer-text" style="display:flex; justify-content:space-between; font-size:10.5px; color:#94A3B8; margin-top:1.25rem; padding-top:0.75rem; border-top:1px solid #F1F5F9;">
            <span>Reçu officiel certifié — Gestion Préscolaire</span>
            <span>Document original authentique</span>
          </div>
        </div>
      </div>
    `;
  },

  viewReceipt(paymentId) {
    const modal = document.getElementById('receiptModal');
    const container = document.getElementById('receiptModalBody');
    if (!modal || !container) return;

    const receipt = Store.data.receipts ? Store.data.receipts.find(r => r.payment_id === paymentId || r.id === paymentId) : null;
    const targetId = receipt ? (receipt.payment_id || receipt.id) : paymentId;
    const receiptHtml = this.getReceiptDocumentHtml(targetId);

    container.innerHTML = `
      ${receiptHtml}

      <!-- Barre d'outils (Export PNG exclusif, Partage WhatsApp Image PNG, Impression A5) -->
      <div class="receipt-actions-toolbar no-print" style="margin-top:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
        <div class="receipt-actions-group" style="display:flex; gap:0.6rem; flex-wrap:wrap; align-items:center;">
          <button class="btn btn-whatsapp btn-sm" onclick="App.shareReceiptPNG('${targetId}')" title="Envoyer le reçu en image PNG au parent sur WhatsApp" style="background:#25D366; color:#FFFFFF; border:none; font-weight:700; padding:0.5rem 0.85rem; border-radius:8px; display:inline-flex; align-items:center; gap:0.4rem; box-shadow:0 2px 6px rgba(37, 211, 102, 0.3);">
            <span>📲 Partager l'image PNG (WhatsApp)</span>
          </button>
          <button class="btn btn-primary btn-sm" onclick="App.downloadReceiptPNG('${targetId}')" title="Télécharger l'image PNG haute définition" style="background:#1E3A8A; font-weight:700; padding:0.5rem 0.85rem; border-radius:8px; display:inline-flex; align-items:center; gap:0.4rem;">
            <span>📥 Télécharger l'image PNG</span>
          </button>
          <button class="btn btn-secondary btn-sm" onclick="window.print()" title="Imprimer le reçu officiel A5" style="padding:0.5rem 0.85rem; border-radius:8px;">
            <span>🖨️ Imprimer (A5)</span>
          </button>
        </div>
      </div>
    `;

    modal.classList.add('is-open');
  },

  async renderReceiptToBlob(paymentId) {
    const receipt = Store.data.receipts ? Store.data.receipts.find(r => r.payment_id === paymentId || r.id === paymentId) : null;
    const payment = Store.data.payments ? Store.data.payments.find(p => p.id === paymentId) : null;
    const otherRev = !payment && Store.data.other_revenues ? Store.data.other_revenues.find(o => o.id === paymentId || (receipt && o.receipt_number === receipt.receipt_number)) : null;

    if (!receipt) throw new Error("Reçu introuvable.");

    // Récupérer ou créer l'élément du document
    let docEl = document.querySelector('#receiptModal .receipt-document');
    let tempContainer = null;

    if (!docEl) {
      tempContainer = document.createElement('div');
      tempContainer.id = 'tempReceiptCaptureContainer';
      tempContainer.style.position = 'fixed';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.style.width = '640px';
      tempContainer.style.background = '#FFFFFF';
      tempContainer.style.zIndex = '-9999';
      tempContainer.innerHTML = this.getReceiptDocumentHtml(paymentId);
      document.body.appendChild(tempContainer);
      docEl = tempContainer.querySelector('.receipt-document') || tempContainer;
    }

    if (typeof html2canvas === 'undefined') {
      throw new Error("Bibliothèque html2canvas non chargée.");
    }

    const canvas = await html2canvas(docEl, {
      scale: 2, // 2x haute résolution pour une qualité d'image A5 exceptionnelle
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#FFFFFF',
      logging: false
    });

    if (tempContainer && tempContainer.parentNode) {
      tempContainer.parentNode.removeChild(tempContainer);
    }

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve({
          blob,
          dataUrl: canvas.toDataURL('image/png'),
          receipt,
          payment,
          otherRev
        });
      }, 'image/png', 1.0);
    });
  },

  async downloadReceiptPNG(paymentId) {
    try {
      this.showToast("Génération de l'image PNG en cours...", "info");
      const { blob, receipt } = await this.renderReceiptToBlob(paymentId);
      const cleanNum = (receipt.receipt_number || 'recu').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `recu_officiel_${cleanNum}.png`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);
      this.showToast(`✓ Reçu officiel N° ${receipt.receipt_number} téléchargé en image PNG !`, "success");
    } catch (err) {
      console.error("Erreur téléchargement PNG:", err);
      alert("Erreur lors de la génération de l'image PNG : " + err.message);
    }
  },

  async shareReceiptPNG(paymentId) {
    try {
      this.showToast("Préparation de l'image PNG du reçu...", "info");
      const { blob, receipt, payment, otherRev } = await this.renderReceiptToBlob(paymentId);
      const school = Store.getSchool();
      const cleanNum = (receipt.receipt_number || 'recu').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `recu_officiel_${cleanNum}.png`;
      const pngFile = new File([blob], filename, { type: 'image/png' });

      let student = payment ? Store.getStudentById(payment.student_id) : null;
      let studentName = student ? `${student.first_names} ${student.last_name}` : 'votre enfant';
      let objectText = "l'inscription";
      let amount = payment ? payment.amount : (otherRev ? otherRev.amount : 0);

      if (payment && payment.kind === 'monthly') {
        const m = Store.getMonthById(payment.month_id);
        objectText = `la cotisation de ${m ? m.label : 'mensualité'}`;
      } else if (otherRev) {
        objectText = otherRev.motif || "paiement";
      }

      const captionText = `Reçu officiel N° ${receipt.receipt_number} — ${school.name} pour ${studentName} (${objectText}) : ${Utils.formatFCFA(amount)}`;

      // 1. Partage natif direct du fichier image PNG (Android, iPhone / iPad)
      if (navigator.canShare && navigator.canShare({ files: [pngFile] })) {
        await navigator.share({
          files: [pngFile],
          title: `Reçu officiel N° ${receipt.receipt_number}`,
          text: captionText
        });
        this.showToast("✓ Image PNG du reçu partagée avec succès !", "success");
        return;
      }

      // 2. Si le partage natif de fichier n'est pas supporté (ex: PC / Navigateurs sans partage de fichier) :
      // Télécharger immédiatement l'image PNG
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);

      // Copie dans le presse-papier si possible
      if (navigator.clipboard && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        } catch(e) {}
      }

      // Ouvrir WhatsApp avec message d'accompagnement (ZÉRO LIEN WEB)
      let waPhone = '';
      if (student && student.parent_phone) {
        waPhone = Utils.toWhatsAppPhone(student.parent_phone);
      }
      const waMsg = `Bonjour,\n\nVeuillez trouver ci-joint l'image du reçu officiel de paiement n° ${receipt.receipt_number} de ${school.name} pour ${studentName} (${objectText}) d'un montant de ${Utils.formatFCFA(amount)}.\n\nCordialement,\nLa Direction`;
      const waUrl = waPhone 
        ? `https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}`
        : `https://wa.me/?text=${encodeURIComponent(waMsg)}`;

      window.open(waUrl, '_blank');
      this.showToast("✓ Image PNG téléchargée ! Joignez-la dans WhatsApp pour l'envoyer au parent.", "success");
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error("Erreur partage PNG:", err);
      alert("Erreur lors de la génération de l'image PNG : " + err.message);
    }
  },

  shareWhatsApp(paymentId) {
    // Redirection automatique vers l'envoi de l'image PNG officielle (aucun lien)
    return this.shareReceiptPNG(paymentId);
  },

  // ----------------------------------------------------------------------------
  // GESTION MODALE ÉLÈVES (AJOUT & MODIFICATION)
  // ----------------------------------------------------------------------------
  openAddStudentModal() {
    const modal = document.getElementById('studentModal');
    if (!modal) return;

    document.getElementById('studentModalTitle').textContent = "Inscrire un nouvel élève";
    document.getElementById('studentIdInput').value = '';
    document.getElementById('studentLastName').value = '';
    document.getElementById('studentFirstNames').value = '';
    const genderSelect = document.getElementById('studentGender');
    if (genderSelect) genderSelect.value = 'M';
    document.getElementById('studentBirthDate').value = '';
    document.getElementById('studentParentName').value = '';
    document.getElementById('studentParentPhone').value = '';

    const classes = Store.getClasses();
    const classSelect = document.getElementById('studentClassSelect');
    classSelect.innerHTML = classes.map(c => `
      <option value="${c.id}">${Utils.escapeHtml(c.name)}</option>
    `).join('');

    // Afficher la section d'encaissement et de reçu officiel pour une nouvelle inscription
    const regBox = document.getElementById('studentRegistrationPaymentBox');
    if (regBox) regBox.style.display = 'block';

    const autoPayCheck = document.getElementById('studentAutoPayRegistration');
    if (autoPayCheck) autoPayCheck.checked = true;

    const regFields = document.getElementById('studentRegPaymentFields');
    if (regFields) regFields.style.display = 'grid';

    const regAmountInput = document.getElementById('studentRegAmount');
    if (regAmountInput) {
      const initialClass = classes[0];
      regAmountInput.value = initialClass ? initialClass.registration_fee : 10000;
    }

    classSelect.onchange = () => {
      const selClass = Store.getClassById(classSelect.value);
      if (selClass && regAmountInput) {
        regAmountInput.value = selClass.registration_fee;
      }
    };

    modal.classList.add('is-open');
  },

  openEditStudentModal(id) {
    const student = Store.getStudentById(id);
    if (!student) return;

    const modal = document.getElementById('studentModal');
    if (!modal) return;

    document.getElementById('studentModalTitle').textContent = "Modifier l'élève";
    document.getElementById('studentIdInput').value = student.id;
    document.getElementById('studentLastName').value = student.last_name;
    document.getElementById('studentFirstNames').value = student.first_names;
    const genderSelect = document.getElementById('studentGender');
    if (genderSelect) genderSelect.value = student.gender || 'M';
    document.getElementById('studentBirthDate').value = student.birth_date || '';
    document.getElementById('studentParentName').value = student.parent_name || '';
    document.getElementById('studentParentPhone').value = student.parent_phone || '';

    const classSelect = document.getElementById('studentClassSelect');
    classSelect.innerHTML = Store.getClasses().map(c => `
      <option value="${c.id}" ${c.id === student.class_id ? 'selected' : ''}>${Utils.escapeHtml(c.name)}</option>
    `).join('');

    // Masquer le bloc d'encaissement lors d'une simple modification
    const regBox = document.getElementById('studentRegistrationPaymentBox');
    if (regBox) regBox.style.display = 'none';

    modal.classList.add('is-open');
  },

  saveStudent() {
    const id = document.getElementById('studentIdInput').value;
    const lastName = document.getElementById('studentLastName').value.trim();
    const firstNames = document.getElementById('studentFirstNames').value.trim();
    const genderSelect = document.getElementById('studentGender');
    const gender = genderSelect ? genderSelect.value : 'M';
    const classId = document.getElementById('studentClassSelect').value;
    const birthDate = document.getElementById('studentBirthDate').value;
    const parentName = document.getElementById('studentParentName').value.trim();
    const parentPhone = document.getElementById('studentParentPhone').value.trim();

    if (!lastName || !firstNames) {
      alert("Le nom et les prénoms de l'élève sont obligatoires.");
      return;
    }

    if (id) {
      Store.updateStudent(id, {
        last_name: lastName.toUpperCase(),
        first_names: firstNames,
        gender: gender,
        class_id: classId,
        birth_date: birthDate || null,
        parent_name: parentName,
        parent_phone: parentPhone ? Utils.normalizeSenegalPhone(parentPhone) : ''
      });
      this.closeAllModals();
      this.showToast("Élève mis à jour avec succès.", "success");
      this.navigate(this.currentTab);
    } else {
      const newStudent = Store.addStudent({
        last_name: lastName,
        first_names: firstNames,
        gender: gender,
        class_id: classId,
        birth_date: birthDate,
        parent_name: parentName,
        parent_phone: parentPhone
      });

      const autoPayCheck = document.getElementById('studentAutoPayRegistration');
      const shouldRecordPayment = autoPayCheck && autoPayCheck.checked;
      let recordedPayment = null;

      if (shouldRecordPayment) {
        const amountVal = parseInt(document.getElementById('studentRegAmount')?.value, 10);
        const selClass = Store.getClassById(classId);
        const fee = (!isNaN(amountVal) && amountVal >= 0) ? amountVal : (selClass ? selClass.registration_fee : 10000);
        const method = document.getElementById('studentRegMethod')?.value || 'wave';

        try {
          const res = Store.recordPayment({
            studentId: newStudent.id,
            kind: 'registration',
            amount: fee,
            method: method,
            reference: 'Inscription'
          });
          recordedPayment = res.payment;
        } catch (payErr) {
          console.warn("Notice enregistrement paiement inscription:", payErr);
        }
      }

      this.closeAllModals();
      this.navigate(this.currentTab);

      if (recordedPayment) {
        this.showToast(`✓ Inscription réussie et reçu officiel généré pour ${firstNames} ${lastName.toUpperCase()} !`, "success");
        // Ouvrir automatiquement le reçu officiel au format A5 avec les boutons de téléchargement et d'envoi PNG WhatsApp
        setTimeout(() => {
          this.viewReceipt(recordedPayment.id);
        }, 200);
      } else {
        this.showToast(`Nouvel élève ${firstNames} ${lastName.toUpperCase()} enregistré avec succès.`, "success");
      }
    }
  },

  deactivateStudent(id) {
    const s = Store.getStudentById(id);
    if (!s) return;
    this.openConfirmModal({
      title: "Confirmer le départ de l'élève",
      message: `Confirmez-vous le départ de l'élève ${s.first_names} ${s.last_name} ?`,
      detailsHtml: `
        <div style="font-size:var(--text-sm); color:var(--text-muted); line-height:1.5;">
          L'élève sera retiré des listes actives, mais tous ses paiements et reçus antérieurs resteront archivés et consultables dans les bilans.
        </div>
      `,
      confirmText: "Oui, confirmer le départ",
      cancelText: "Non, annuler",
      onConfirm: () => {
        Store.deactivateStudent(id);
        this.showToast("Élève désactivé avec succès.", "warning");
        this.renderStudents(document.getElementById('appViewContent'));
      }
    });
  },

  // ----------------------------------------------------------------------------
  // IMPORT CSV EN MASSE (§ 3.2)
  // ----------------------------------------------------------------------------
  openImportCsvModal() {
    const modal = document.getElementById('importCsvModal');
    if (modal) modal.classList.add('is-open');
  },

  downloadCsvTemplate() {
    let content = Utils.csvRow(["PRENOMS", "NOM", "GENRE", "CLASSE", "DATE_NAISSANCE", "NOM_PARENT", "TELEPHONE_PARENT"]);
    content += Utils.csvRow(["Mamadou", "DIOP", "M", "Petite section", "2023-03-12", "Ousmane Diop", "+221 77 123 45 67"]);
    content += Utils.csvRow(["Fatou", "SOW", "F", "Crèche", "2024-05-24", "Ibrahima Sow", "+221 78 234 56 78"]);
    Utils.downloadCSV(content, "modele_import_eleves_gestion_prescolaire.csv");
  },

  processCsvFile(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    // Garde-fous : taille et type de fichier
    if (file.size > 2 * 1024 * 1024) {
      alert("Le fichier est trop volumineux (2 Mo maximum).");
      input.value = '';
      return;
    }
    if (!/\.(csv|txt)$/i.test(file.name)) {
      alert("Veuillez choisir un fichier au format CSV (.csv).");
      input.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const rows = Utils.parseCSV(e.target.result);
      input.value = '';
      if (rows.length <= 1) {
        alert("Le fichier CSV est vide ou ne contient que l'en-tête.");
        return;
      }
      if (rows.length > 2001) {
        alert("Le fichier contient trop de lignes (2000 élèves maximum par import).");
        return;
      }

      const normalize = (str) => String(str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
      const classes = Store.getClasses();
      const findClass = (name) => {
        const n = normalize(name);
        if (!n) return classes[0];
        return classes.find(c => normalize(c.name) === n)
          || classes.find(c => n.startsWith(normalize(c.name)) || normalize(c.name).startsWith(n))
          || classes[0];
      };

      const header = rows[0].map(h => normalize(h));
      const isPrenomFirst = header[0] && header[0].includes('prenom');
      let importedCount = 0;
      let skippedCount = 0;

      for (let i = 1; i < rows.length; i++) {
        const parts = rows[i];
        let firstNames, lastName, gender, className, birthDate, parentName, parentPhone;
        if (isPrenomFirst) {
          [firstNames, lastName] = [parts[0], parts[1]];
          gender = String(parts[2] || 'M').toUpperCase().startsWith('F') ? 'F' : 'M';
          [className, birthDate, parentName, parentPhone] = [parts[3], parts[4], parts[5], parts[6]];
        } else {
          [lastName, firstNames] = [parts[0], parts[1]];
          gender = 'M';
          [className, birthDate, parentName, parentPhone] = [parts[2], parts[3], parts[4], parts[5]];
        }

        if (!lastName || !firstNames) {
          skippedCount++;
          continue;
        }

        try {
          Store.addStudent({
            last_name: lastName,
            first_names: firstNames,
            gender: gender,
            class_id: (findClass(className) || {}).id,
            birth_date: birthDate,
            parent_name: parentName,
            parent_phone: parentPhone
          });
          importedCount++;
        } catch (err) {
          skippedCount++;
        }
      }

      this.closeAllModals();
      const skippedMsg = skippedCount > 0 ? ` (${skippedCount} ligne(s) ignorée(s) : nom ou prénom manquant)` : '';
      this.showToast(`${importedCount} élève(s) importé(s) avec succès${skippedMsg}.`, importedCount > 0 ? "success" : "warning");
      this.navigate(this.currentTab, { preserveFilters: true });
    };

    reader.onerror = () => alert("Impossible de lire ce fichier.");
    reader.readAsText(file, "UTF-8");
  },

  // ----------------------------------------------------------------------------
  // GESTION MODALE DÉPENSES (MOTIF, SOMME EN FCFA, RUBRIQUE, DATE)
  // ----------------------------------------------------------------------------
  populateExpenseRubriques(selectedRubrique = '') {
    const select = document.getElementById('expenseCategory');
    if (!select) return;
    const rubriques = Store.getExpenseRubriques();

    let html = '';
    rubriques.forEach(r => {
      const isSelected = r === selectedRubrique;
      html += `<option value="${Utils.escapeHtml(r)}"${isSelected ? ' selected' : ''}>📂 ${Utils.escapeHtml(r)}</option>`;
    });
    html += `<option value="__NEW_CUSTOM_RUBRIQUE__">➕ Ajouter une nouvelle rubrique personnalisée...</option>`;
    select.innerHTML = html;
  },

  onExpenseCategoryChange(value) {
    const container = document.getElementById('customCategoryContainer');
    const input = document.getElementById('expenseCustomCategory');
    if (value === '__NEW_CUSTOM_RUBRIQUE__') {
      if (container) container.style.display = 'block';
      if (input) {
        input.required = true;
        input.focus();
      }
    } else {
      if (container) container.style.display = 'none';
      if (input) {
        input.required = false;
        input.value = '';
      }
    }
  },

  onExpenseRubriqueFilterChange(rubrique) {
    this.activeExpenseRubriqueFilter = rubrique;
    if (this.currentTab === 'expenses') {
      this.renderExpenses(document.getElementById('appViewContent'));
    }
  },

  openAddExpenseModal(defaultRubrique = '') {
    const modal = document.getElementById('expenseModal');
    if (!modal) return;
    const titleEl = document.getElementById('expenseModalTitle');
    const submitBtn = document.getElementById('expenseSubmitBtn');
    const idInput = document.getElementById('expenseIdInput');
    const motifInput = document.getElementById('expenseMotif');
    const amountInput = document.getElementById('expenseAmount');
    const dateInput = document.getElementById('expenseDate');
    const customContainer = document.getElementById('customCategoryContainer');
    const customInput = document.getElementById('expenseCustomCategory');
    const deleteBtn = document.getElementById('expenseModalDeleteBtn');

    if (titleEl) titleEl.textContent = "Ajouter une nouvelle dépense";
    if (submitBtn) submitBtn.textContent = "Enregistrer la dépense";
    if (deleteBtn) deleteBtn.style.display = 'none';
    if (idInput) idInput.value = '';
    if (motifInput) motifInput.value = '';
    if (amountInput) amountInput.value = '';
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    if (customContainer) customContainer.style.display = 'none';
    if (customInput) {
      customInput.value = '';
      customInput.required = false;
    }

    this.populateExpenseRubriques(defaultRubrique || "Fournitures scolaires & papeterie");

    modal.classList.add('is-open');
    setTimeout(() => {
      if (motifInput) motifInput.focus();
    }, 100);
  },

  openEditExpenseModal(id) {
    const expense = Store.getExpenseById(id);
    if (!expense) return;

    const modal = document.getElementById('expenseModal');
    if (!modal) return;
    const titleEl = document.getElementById('expenseModalTitle');
    const submitBtn = document.getElementById('expenseSubmitBtn');
    const deleteBtn = document.getElementById('expenseModalDeleteBtn');
    const idInput = document.getElementById('expenseIdInput');
    const motifInput = document.getElementById('expenseMotif');
    const amountInput = document.getElementById('expenseAmount');
    const dateInput = document.getElementById('expenseDate');
    const customContainer = document.getElementById('customCategoryContainer');
    const customInput = document.getElementById('expenseCustomCategory');

    if (titleEl) titleEl.textContent = "Modifier la dépense";
    if (submitBtn) submitBtn.textContent = "Enregistrer les modifications";
    if (deleteBtn) {
      deleteBtn.style.display = 'inline-flex';
      deleteBtn.setAttribute('data-expense-id', expense.id);
    }
    if (idInput) idInput.value = expense.id;
    if (motifInput) motifInput.value = expense.motif || '';
    if (amountInput) amountInput.value = expense.amount || '';
    if (dateInput) dateInput.value = expense.date || new Date().toISOString().split('T')[0];
    if (customContainer) customContainer.style.display = 'none';
    if (customInput) {
      customInput.value = '';
      customInput.required = false;
    }

    this.populateExpenseRubriques(expense.category || "Fournitures scolaires & papeterie");

    modal.classList.add('is-open');
  },

  handleExpenseSubmit(event) {
    if (event) event.preventDefault();
    try {
      const id = (document.getElementById('expenseIdInput')?.value || '').trim();
      const motif = (document.getElementById('expenseMotif')?.value || '').trim();
      const rawAmount = document.getElementById('expenseAmount')?.value || '';
      // Supporte les saisies avec espaces ou séparateurs (ex: 25 000 ou 25.000)
      const cleanAmountStr = String(rawAmount).replace(/\s/g, '').replace(/,/g, '.');
      const amount = Math.round(parseFloat(cleanAmountStr)) || 0;
      const date = document.getElementById('expenseDate')?.value;
      const categorySelect = document.getElementById('expenseCategory');
      let category = categorySelect ? categorySelect.value : 'Fournitures scolaires & papeterie';

      if (category === '__NEW_CUSTOM_RUBRIQUE__') {
        const customVal = (document.getElementById('expenseCustomCategory')?.value || '').trim();
        if (!customVal) {
          this.showToast("Veuillez saisir le nom de votre nouvelle rubrique.", "warning");
          document.getElementById('expenseCustomCategory')?.focus();
          return;
        }
        category = customVal;
        Store.addCustomExpenseRubrique(customVal);
      }

      if (!motif) {
        this.showToast("Le motif de la dépense est obligatoire.", "danger");
        document.getElementById('expenseMotif')?.focus();
        return;
      }
      if (!amount || amount <= 0) {
        this.showToast("Veuillez saisir un montant valide en FCFA supérieur à 0.", "danger");
        document.getElementById('expenseAmount')?.focus();
        return;
      }
      if (!date) {
        this.showToast("La date de décaissement est obligatoire.", "danger");
        document.getElementById('expenseDate')?.focus();
        return;
      }

      if (id) {
        Store.updateExpense(id, {
          motif: motif,
          amount: amount,
          date: date,
          category: category
        });
        this.closeAllModals();
        this.showToast("Dépense modifiée avec succès !", "success");
      } else {
        Store.addExpense({
          motif: motif,
          amount: amount,
          date: date,
          category: category
        });
        this.closeAllModals();
        this.showToast(`Dépense de ${Utils.formatFCFA(amount)} enregistrée avec succès !`, "success");
      }

      // Rediriger immédiatement vers la rubrique des dépenses pour visualiser immédiatement le résultat
      this.navigate('expenses');
    } catch (err) {
      console.error("Erreur enregistrement dépense:", err);
      this.showToast("Erreur lors de l'enregistrement : " + (err.message || err), "danger");
    }
  },

  // ----------------------------------------------------------------------------
  // MODALE DE CONFIRMATION SÉCURISÉE OUI / NON AVANT SUPPRESSION
  // ----------------------------------------------------------------------------
  promptDeleteExpense(id) {
    const expense = Store.getExpenseById(id);
    if (!expense) return;

    this.openConfirmModal({
      title: "Confirmer la suppression de la dépense",
      message: "Êtes-vous sûr de vouloir supprimer cette dépense ?",
      detailsHtml: `
        <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem;">
          <span style="color:var(--text-muted); font-size:var(--text-xs); text-transform:uppercase; font-weight:700;">Motif :</span>
          <strong style="color:var(--text-main);">${Utils.escapeHtml(expense.motif)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem;">
          <span style="color:var(--text-muted); font-size:var(--text-xs); text-transform:uppercase; font-weight:700;">Somme décaissée :</span>
          <strong style="color:var(--danger); font-size:var(--text-base);">- ${Utils.formatFCFA(expense.amount)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem;">
          <span style="color:var(--text-muted); font-size:var(--text-xs); text-transform:uppercase; font-weight:700;">Rubrique :</span>
          <span>📂 ${Utils.escapeHtml(expense.category || 'Général')}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:var(--text-muted); font-size:var(--text-xs); text-transform:uppercase; font-weight:700;">Date :</span>
          <span>${Utils.formatDate(expense.date)}</span>
        </div>
      `,
      confirmText: "Oui, supprimer",
      cancelText: "Non, annuler",
      onConfirm: () => {
        this.deleteExpense(id);
      }
    });
  },

  /**
   * Exécution de la suppression de dépense avec réintégration de la trésorerie et possibilité d'annulation
   */
  deleteExpense(id) {
    if (!id) return;
    const expense = Store.getExpenseById(id);
    if (!expense) {
      this.showToast("Dépense introuvable ou déjà supprimée.", "warning");
      return;
    }

    const removed = Store.deleteExpense(id);
    if (!removed) return;

    this.lastDeletedExpense = removed;
    this.closeAllModals();

    const motifPreview = expense.motif ? `« ${expense.motif.slice(0, 32)}${expense.motif.length > 32 ? '...' : ''} »` : '';
    const amountPreview = Utils.formatFCFA(expense.amount);

    this.showToast(
      `Dépense ${motifPreview} (${amountPreview}) supprimée. Trésorerie réintégrée.`,
      'info',
      {
        label: '↩️ Annuler',
        callback: () => this.undoDeleteExpense()
      }
    );

    // Rafraîchissement automatique instantané de la vue courante
    if (this.currentTab === 'expenses') {
      this.renderExpenses(document.getElementById('appViewContent'));
    } else if (this.currentTab === 'bilan') {
      this.renderBilan(document.getElementById('appViewContent'));
    } else {
      this.navigate(this.currentTab, { preserveFilters: true });
    }
  },

  confirmDeleteExpense(id) {
    this.promptDeleteExpense(id);
  },

  undoDeleteExpense() {
    if (!this.lastDeletedExpense) return;
    const restored = this.lastDeletedExpense;
    Store.addExpense(restored);
    this.lastDeletedExpense = null;
    this.showToast(`Dépense « ${restored.motif} » (${Utils.formatFCFA(restored.amount)}) restaurée avec succès !`, 'success');
    if (this.currentTab === 'expenses') {
      this.renderExpenses(document.getElementById('appViewContent'));
    } else if (this.currentTab === 'bilan') {
      this.renderBilan(document.getElementById('appViewContent'));
    } else {
      this.navigate(this.currentTab, { preserveFilters: true });
    }
  },

  deleteExpenseFromModal() {
    const idInput = document.getElementById('expenseIdInput');
    const id = idInput ? idInput.value : null;
    if (id) {
      this.promptDeleteExpense(id);
    }
  },

  deleteCustomRubrique(name) {
    if (!name) return;
    Store.deleteCustomExpenseRubrique(name);
    this.showToast(`Rubrique personnalisée « ${name} » retirée.`, 'info');
    if (this.activeExpenseRubriqueFilter === name) {
      this.activeExpenseRubriqueFilter = 'all';
    }
    if (this.currentTab === 'expenses') {
      this.renderExpenses(document.getElementById('appViewContent'));
    }
  },

  // ----------------------------------------------------------------------------
  // GESTION DU THÈME (MODE CLAIR / MODE SOMBRE)
  // ----------------------------------------------------------------------------
  initTheme() {
    const saved = localStorage.getItem('gestion_dipe_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    this.applyTheme(theme);
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('gestion_dipe_theme', next);
    this.applyTheme(next);
  },

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const iconEl = document.getElementById('themeToggleIcon');
    const labelEl = document.getElementById('themeToggleLabel');
    const themeBtn = document.getElementById('themeToggleBtn');
    if (iconEl && labelEl) {
      if (theme === 'dark') {
        iconEl.textContent = '☀️';
        labelEl.innerHTML = '<span class="hide-mobile">Mode </span>Clair';
        if (themeBtn) {
          themeBtn.setAttribute('title', 'Activer le Mode Clair');
          themeBtn.setAttribute('aria-label', 'Activer le Mode Clair');
        }
      } else {
        iconEl.textContent = '🌙';
        labelEl.innerHTML = '<span class="hide-mobile">Mode </span>Sombre';
        if (themeBtn) {
          themeBtn.setAttribute('title', 'Activer le Mode Sombre');
          themeBtn.setAttribute('aria-label', 'Activer le Mode Sombre');
        }
      }
    }
    // Mise à jour synchrone du bouton dans Réglages si présent
    const settingsBtn = document.getElementById('btnSettingToggleTheme');
    if (settingsBtn) {
      settingsBtn.innerHTML = theme === 'dark' 
        ? '<span>☀️ Passer en Mode Clair</span>' 
        : '<span>🌙 Passer en Mode Sombre</span>';
    }
  },

  // ----------------------------------------------------------------------------
  // ACTUALISATION & SYNCHRONISATION FORCÉE DE L'APPLICATION (PWA & MOBILE)
  // Purge immédiate de tous les caches et rechargement instantané avec le code frais
  // ----------------------------------------------------------------------------
  async forceAppUpdate() {
    const refreshBtn = document.getElementById('btnTopbarRefresh');
    const refreshIcon = refreshBtn ? refreshBtn.querySelector('span:first-child') : null;
    const settingsBtn = document.getElementById('btnForcePwaUpdate');
    
    if (refreshIcon) refreshIcon.classList.add('is-spinning');
    if (settingsBtn) {
      settingsBtn.disabled = true;
      settingsBtn.innerHTML = '<span class="is-spinning">🔄</span> <span>Actualisation en cours...</span>';
    }

    this.showToast("Synchronisation avec le serveur et vérification des mises à jour...", "info");

    try {
      // 1. Purge intégrale de tous les caches de CacheStorage
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
        console.log('[PWA] Caches locaux vidés avec succès :', keys);
      }

      // 2. Demander à tous les Service Workers de se mettre à jour
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          try {
            await reg.update();
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          } catch (e) {
            console.warn('[PWA] Erreur update SW :', e);
          }
        }
      }

      this.showToast("Mise à jour prête ! Chargement de la dernière version...", "success");

      setTimeout(() => {
        // Redirection avec timestamp unique pour contourner tout cache mémoire
        const targetUrl = window.location.pathname + '?upd=' + Date.now() + window.location.hash;
        window.location.replace(targetUrl);
      }, 500);
    } catch (err) {
      console.error('[PWA] Erreur lors de l\'actualisation :', err);
      window.location.reload();
    }
  },

  notifyAppUpdateReady() {
    const banner = document.getElementById('pwaUpdateBanner');
    if (banner) {
      banner.style.display = 'inline-flex';
    }
  },

  // ----------------------------------------------------------------------------
  // EXPORTS CSV DÉDIÉS (§ Bilan Total, Bilan Inscriptions, Bilan Cotisations, Dépenses)
  // ----------------------------------------------------------------------------
  exportCsvGrandTotal() {
    const grand = Store.getGrandTotalSummary();
    const other = grand.other_revenues ? grand.other_revenues.total_amount : 0;
    let csv = Utils.csvRow(["RUBRIQUE", "ATTENDU_FCFA", "ENCAISSE_FCFA", "RESTE_OU_CHARGES_FCFA", "POURCENTAGE"]);
    csv += Utils.csvRow(["1. Droits d'inscriptions annuels", grand.registration.total_expected, grand.registration.total_collected, grand.registration.total_remaining, grand.registration.percentage + "%"]);
    csv += Utils.csvRow(["2. Cotisations mensuelles (Octobre à Juin)", grand.monthly.cumulated_expected, grand.monthly.cumulated_collected, grand.monthly.cumulated_remaining, grand.monthly.cumulated_percentage + "%"]);
    csv += Utils.csvRow(["3. Autres rentrées (dons, cantine, blouses...)", "", other, "", ""]);
    csv += Utils.csvRow(["SOUS-TOTAL RECETTES BRUTES ENCAISSÉES", grand.grand_expected, grand.grand_collected, grand.grand_remaining, grand.grand_percentage + "%"]);
    csv += Utils.csvRow(["4. Total dépenses de fonctionnement décaissées", "", grand.total_expenses, "", "Charges"]);
    csv += Utils.csvRow(["SOLDE RESTANT DISPONIBLE AU MOMENT T", "", grand.net_available, "", grand.net_available >= 0 ? "Positif" : "Déficit"]);

    Utils.downloadCSV(csv, "bilan_general_gestion_prescolaire.csv");
  },

  exportStudentsCsv() {
    const students = Store.getStudents(true);
    let csv = Utils.csvRow(["PRENOMS", "NOM", "GENRE", "SECTION", "DATE_NAISSANCE", "STATUT", "NOM_PARENT", "TELEPHONE_PARENT"]);
    students.forEach(s => {
      csv += Utils.csvRow([
        s.first_names || "",
        s.last_name || "",
        s.gender === "F" ? "Fille" : "Garçon",
        Store.getClassName(s.class_id),
        s.birth_date || "",
        s.active === false ? "Quitté" : "Inscrit",
        s.parent_name || "",
        s.parent_phone || ""
      ]);
    });
    Utils.downloadCSV(csv, "liste_eleves_gestion_prescolaire.csv");
    this.showToast("Export CSV de l'ensemble des élèves téléchargé.", "success");
  },

  exportExpensesCsv() {
    const expenses = Store.getExpenses().filter(e => e.status !== "cancelled");
    let csv = Utils.csvRow(["DATE", "MOTIF", "RUBRIQUE", "MONTANT_FCFA"]);
    expenses.forEach(e => {
      csv += Utils.csvRow([e.date || "", e.motif || "", e.category || "Général", parseInt(e.amount, 10) || 0]);
    });
    csv += Utils.csvRow(["TOTAL", "TOTAL GÉNÉRAL DES DÉPENSES DÉCAISSÉES", "", Store.getTotalExpenses()]);

    Utils.downloadCSV(csv, "depenses_ecole_gestion_prescolaire.csv");
  },

  exportCsvRegistrations() {
    const summary = Store.getRegistrationSummary();
    let csv = Utils.csvRow(["SECTION", "FRAIS_FCFA", "EFFECTIF", "PAYES", "IMPAYES", "ATTENDU_FCFA", "ENCAISSE_FCFA", "RESTE_FCFA", "POURCENTAGE"]);
    summary.classes.forEach(c => {
      csv += Utils.csvRow([c.class_name, c.fee, c.total_students, c.paid_students, c.unpaid_students, c.expected_amount, c.collected_amount, c.remaining_amount, c.percentage + "%"]);
    });
    csv += Utils.csvRow(["TOTAL", "", summary.total_students, summary.paid_students, summary.unpaid_students, summary.total_expected, summary.total_collected, summary.total_remaining, summary.percentage + "%"]);

    Utils.downloadCSV(csv, "total_inscriptions_gestion_prescolaire.csv");
  },

  exportCsvAnnual() {
    const annual = Store.getAnnualOverview();
    let csv = Utils.csvRow(["MOIS", "ATTENDU_FCFA", "ENCAISSE_FCFA", "RESTE_FCFA", "PAYES", "IMPAYES", "POURCENTAGE"]);
    annual.months.forEach(m => {
      csv += Utils.csvRow([m.month_label, m.expected_amount, m.collected_amount, m.remaining_amount, m.paid_students, m.unpaid_students, m.percentage + "%"]);
    });
    csv += Utils.csvRow(["TOTAL CUMULÉ", annual.cumulated_expected, annual.cumulated_collected, annual.cumulated_remaining, "", "", annual.cumulated_percentage + "%"]);

    Utils.downloadCSV(csv, "bilan_annuel_gestion_prescolaire.csv");
  },

  _downloadFile(content, fileName) {
    Utils.downloadCSV(content, fileName);
  },

  // ----------------------------------------------------------------------------
  // INTERACTIONS FILTRES ET PARAMÈTRES
  // ----------------------------------------------------------------------------
  onSearchInput(val) {
    this.searchTerm = String(val || '').slice(0, 100);
    // Rafraîchit la vue en conservant les filtres puis redonne le focus au champ de recherche
    this.navigate(this.currentTab, { preserveFilters: true, keepScroll: true });
    this.restoreSearchFocus('.search-input');
  },

  /**
   * Après un nouveau rendu de la vue, remet le curseur dans le champ de recherche
   * (sinon la saisie s'interrompt après chaque lettre).
   */
  restoreSearchFocus(selector) {
    const input = document.querySelector(`#appViewContent ${selector}`);
    if (!input) return;
    input.focus({ preventScroll: true });
    const end = input.value.length;
    try { input.setSelectionRange(end, end); } catch (e) {}
  },

  onClassFilterChange(val) {
    this.activeClassFilter = val;
    this.navigate(this.currentTab, { preserveFilters: true });
  },

  onStatusFilterChange(val) {
    this.activeStatusFilter = val;
    if (val === 'all') {
      this.activeClassFilter = 'all'; // Règle : quand on choisit "Tous les statuts", toute l'école s'affiche
      this.searchTerm = '';
    }
    this.navigate(this.currentTab, { preserveFilters: true });
  },

  showAllRegistrations() {
    this.activeStatusFilter = 'all';
    this.activeClassFilter = 'all';
    this.searchTerm = '';
    this.navigate('registrations', { preserveFilters: true });
  },

  filterRegistrationsStatus(status) {
    this.activeStatusFilter = status;
    this.navigate('registrations', { preserveFilters: true });
  },

  changeMonth(monthId, showClassView) {
    this.currentMonthId = monthId;
    this.renderMonthly(document.getElementById('appViewContent'), { showClassView });
  },

  prevMonth(showClassView = false) {
    const months = Store.getMonths();
    const curIdx = months.findIndex(m => m.id === this.currentMonthId);
    if (curIdx > 0) {
      this.currentMonthId = months[curIdx - 1].id;
      this.renderMonthly(document.getElementById('appViewContent'), { showClassView });
    }
  },

  nextMonth(showClassView = false) {
    const months = Store.getMonths();
    const curIdx = months.findIndex(m => m.id === this.currentMonthId);
    if (curIdx >= 0 && curIdx < months.length - 1) {
      this.currentMonthId = months[curIdx + 1].id;
      this.renderMonthly(document.getElementById('appViewContent'), { showClassView });
    }
  },

  filterByClassFromState(classId) {
    this.activeClassFilter = classId;
    this.renderMonthly(document.getElementById('appViewContent'), { showClassView: false });
  },

  openMonthDetail(monthId) {
    this.currentMonthId = monthId;
    this.navigate('monthly', { showClassView: true });
  },

  saveSettings() {
    const name = document.getElementById('settingSchoolName').value.trim();
    const dirName = document.getElementById('settingDirectorName').value.trim();
    const dirPhone = document.getElementById('settingDirectorPhone').value.trim();
    const schoolYear = (document.getElementById('settingSchoolYear') ? document.getElementById('settingSchoolYear').value.trim() : '') || '2026-2027';
    const address = document.getElementById('settingAddress') ? document.getElementById('settingAddress').value.trim() : '';

    if (!name || !dirName || !dirPhone) {
      alert("Le nom de l'école, le directeur et le téléphone sont obligatoires.");
      return;
    }

    Store.updateSchool({
      name: name,
      director_name: dirName,
      director_phone: Utils.normalizeSenegalPhone(dirPhone),
      school_year: schoolYear,
      address: address,
      stamp_color: '#1E3A8A'
    });

    // Mise à jour des tarifs des classes
    const classes = Store.getClasses();
    classes.forEach(c => {
      const regInput = document.getElementById(`settingFeeReg_${c.id}`);
      const monthInput = document.getElementById(`settingFeeMonth_${c.id}`);
      if (regInput && monthInput) {
        Store.updateClassFees(c.id, regInput.value, monthInput.value);
      }
    });

    this.showToast("Paramètres, tarifs et cachet officiel mis à jour.", "success");
    this.renderHeader();
    this.renderSettings(document.getElementById('appViewContent'));
  },

  restoreDemoFixtures() {
    Store.resetToDemo();
    this.renderHeader();
    this.renderSettings(document.getElementById('appViewContent'));
    this.showToast("Jeu de données de démonstration réinitialisé avec succès !", "success");
  },

  resetAllDataToZero() {
    this.openConfirmModal({
      title: "Réinitialiser et tout effacer",
      message: "Voulez-vous vraiment effacer toutes les données de l'établissement ?",
      detailsHtml: `
        <div style="font-size:var(--text-sm); color:var(--danger); font-weight:600; line-height:1.5;">
          ⚠️ Cette action est irréversible : tous les élèves inscrits, paiements enregistrés, reçus délivrés, dépenses et autres entrées seront définitivement supprimés.
        </div>
        <div style="font-size:var(--text-xs); color:var(--text-muted); margin-top:0.5rem;">
          Votre établissement conservera son nom et ses sections configurées, mais tous les registres comptables seront remis à 0 FCFA.
        </div>
      `,
      confirmText: "Oui, tout effacer à zéro",
      cancelText: "Non, conserver mes données",
      onConfirm: () => {
        Store.resetToZero();
        this.showToast("Toutes les données ont été effacées avec succès. Base 100% vierge prête pour vos saisies.", "success");
        this.renderHeader();
        this.navigate('dashboard');
      }
    });
  },

  openConfirmModal({ title, message, detailsHtml, confirmText = "Oui, confirmer", cancelText = "Non, annuler", onConfirm } = {}) {
    const modal = document.getElementById('confirmDeleteModal');
    if (!modal) {
      if (window.confirm((message || "Voulez-vous vraiment effacer ces données ?") + "\n\nCette action est irréversible.")) {
        if (typeof onConfirm === 'function') onConfirm();
      }
      return;
    }

    const titleEl = modal.querySelector('.modal-title');
    const msgEl = document.getElementById('confirmDeleteMessage');
    const detailsEl = document.getElementById('confirmDeleteDetails');
    const btnYes = document.getElementById('confirmDeleteBtnYes');
    const btnNo = document.getElementById('confirmDeleteBtnNo');

    if (titleEl && title) titleEl.textContent = title;
    if (msgEl && message) msgEl.textContent = message;
    if (detailsEl) {
      if (detailsHtml) {
        detailsEl.innerHTML = detailsHtml;
        detailsEl.style.display = 'block';
      } else {
        detailsEl.style.display = 'none';
      }
    }
    if (btnYes && confirmText) btnYes.textContent = confirmText;
    if (btnNo && cancelText) btnNo.textContent = cancelText;

    this._pendingConfirmCallback = onConfirm;
    modal.classList.add('is-open');
  },

  executeConfirmedDelete() {
    this.closeAllModals();
    if (typeof this._pendingConfirmCallback === 'function') {
      const cb = this._pendingConfirmCallback;
      this._pendingConfirmCallback = null;
      cb();
    }
  },

  resetDemoData() {
    this.resetAllDataToZero();
  },

  closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('is-open'));
  },

  showToast(message, type = 'info', action = null) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✓' : type === 'danger' ? '✕' : type === 'warning' ? '⚠️' : 'ℹ';

    let actionBtnHtml = '';
    if (action && action.label && typeof action.callback === 'function') {
      actionBtnHtml = `<button class="toast-action-btn" type="button" style="margin-left:0.75rem; background:rgba(255,255,255,0.22); border:1px solid rgba(255,255,255,0.45); color:inherit; font-weight:700; padding:0.25rem 0.65rem; border-radius:4px; cursor:pointer; font-size:var(--text-xs); transition:background var(--transition-fast);">${Utils.escapeHtml(action.label)}</button>`;
    }

    toast.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; width:100%;">
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <span style="font-weight:700;">${icon}</span>
          <span>${Utils.escapeHtml(message)}</span>
        </div>
        ${actionBtnHtml}
      </div>
    `;

    if (action && typeof action.callback === 'function') {
      const btn = toast.querySelector('.toast-action-btn');
      if (btn) {
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          action.callback();
          toast.remove();
        });
      }
    }

    container.appendChild(toast);

    const timeout = action ? 6500 : 3500;
    const timer = setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 200);
    }, timeout);

    toast.addEventListener('mouseenter', () => clearTimeout(timer));
  },

  // ----------------------------------------------------------------------------
  // MODULE : AUTRES RENTRÉES (DONS, CANTINE, BLOUSES, KERMESSE, ACTIVITÉS...)
  // ----------------------------------------------------------------------------
  renderOtherRevenues(container, options = {}) {
    const summary = Store.getOtherRevenuesSummary();
    const grand = Store.getGrandTotalSummary();
    const rubriques = Store.getOtherRevenueRubriques();

    const rubriqueTotals = {};
    summary.revenues.forEach(r => {
      if (r.status !== 'cancelled') {
        const cat = r.category || 'Autre encaissement exceptionnel';
        rubriqueTotals[cat] = (rubriqueTotals[cat] || 0) + (parseInt(r.amount, 10) || 0);
      }
    });

    const activeFilter = this.activeOtherRevenueRubriqueFilter || 'all';
    const activeStatus = this.activeOtherRevenueStatusFilter || 'all';

    const filtered = summary.revenues.filter(r => {
      const matchSearch = !this.searchTerm 
        || (r.motif && r.motif.toLowerCase().includes(this.searchTerm.toLowerCase()))
        || (r.category && r.category.toLowerCase().includes(this.searchTerm.toLowerCase()))
        || (r.payer_name && r.payer_name.toLowerCase().includes(this.searchTerm.toLowerCase()))
        || (r.receipt_number && r.receipt_number.toLowerCase().includes(this.searchTerm.toLowerCase()));
      const matchRubrique = activeFilter === 'all' || r.category === activeFilter;
      const matchStatus = activeStatus === 'all' || (activeStatus === 'valid' && r.status !== 'cancelled') || (activeStatus === 'cancelled' && r.status === 'cancelled');
      return matchSearch && matchRubrique && matchStatus;
    });

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <div>
            <h1 class="view-title">Rubrique Autres Entrées</h1>
            <p class="view-subtitle">Enregistrement et suivi des encaissements hors inscriptions et cotisations (Dons, cantine, blouses, sorties...)</p>
          </div>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" onclick="App.exportOtherRevenuesCsv()">
              📄 Exporter CSV
            </button>
            <button id="btnViewAddOtherRevenue" class="btn btn-success btn-sm" onclick="App.openAddOtherRevenueModal()" style="background:#16A34A; color:#FFFFFF; border-color:#16A34A;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>Autre entrée</span>
            </button>
          </div>
        </div>
      </div>

      <!-- KPI Synthèse Autres Entrées UNIQUEMENT (isolé des inscriptions et cotisations) -->
      <div class="kpi-grid">
        <div class="kpi-card" style="border-top:4px solid var(--success); background:linear-gradient(180deg, #FFFFFF 0%, #F0FDF4 100%);">
          <span class="kpi-title">Total Autres Entrées</span>
          <div class="kpi-figure" style="color:var(--success); font-weight:800;">${Utils.formatFCFA(summary.total_amount)}</div>
          <div class="kpi-meta">${summary.count} entrée(s) active(s) comptabilisée(s)</div>
        </div>

        <div class="kpi-card" style="border-top:4px solid var(--primary);">
          <span class="kpi-title">Nombre d'opérations</span>
          <div class="kpi-figure" style="color:var(--primary);">${summary.count}</div>
          <div class="kpi-meta">${summary.cancelled_count > 0 ? `${summary.cancelled_count} annulée(s)` : 'Toutes les opérations sont valides'}</div>
        </div>

        <div class="kpi-card" style="border-top:4px solid #F59E0B; background:linear-gradient(180deg, #FFFFFF 0%, #FEF3C7 100%);">
          <span class="kpi-title">Moyenne par opération</span>
          <div class="kpi-figure" style="color:#B45309; font-weight:800;">
            ${summary.count > 0 ? Utils.formatFCFA(Math.round(summary.total_amount / summary.count)) : '0 FCFA'}
          </div>
          <div class="kpi-meta">${summary.count > 0 ? 'Sur les rentrées actives' : 'Aucune entrée enregistrée'}</div>
        </div>
      </div>

      <!-- Filtres et recherche -->
      <div class="table-toolbar" style="margin-top:1.25rem;">
        <div class="search-input-wrapper">
          <input 
            type="search" 
            class="form-input" 
            placeholder="Rechercher par motif, payeur, N° reçu..." 
            value="${Utils.escapeHtml(this.searchTerm || '')}"
            oninput="App.onOtherRevenueSearch(this.value)">
        </div>

        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <select class="form-select form-select-sm" onchange="App.onOtherRevenueCategoryFilter(this.value)" style="min-width:180px;">
            <option value="all" ${activeFilter === 'all' ? 'selected' : ''}>Toutes les rubriques (${summary.count})</option>
            ${rubriques.map(r => `
              <option value="${Utils.escapeHtml(r)}" ${activeFilter === r ? 'selected' : ''}>
                ${Utils.escapeHtml(r)} ${rubriqueTotals[r] ? `(${Utils.formatFCFA(rubriqueTotals[r])})` : ''}
              </option>
            `).join('')}
          </select>

          <select class="form-select form-select-sm" onchange="App.onOtherRevenueStatusFilter(this.value)">
            <option value="all" ${activeStatus === 'all' ? 'selected' : ''}>Tous les statuts</option>
            <option value="valid" ${activeStatus === 'valid' ? 'selected' : ''}>Valides (${summary.count})</option>
            <option value="cancelled" ${activeStatus === 'cancelled' ? 'selected' : ''}>Annulées (${summary.cancelled_count})</option>
          </select>
        </div>
      </div>

      <!-- Tableau des Autres Rentrées -->
      <div class="data-table-container" style="margin-top:1rem;">
        ${filtered.length === 0 ? `
          <div style="text-align:center; padding:3.5rem 1.5rem; color:var(--text-muted); background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-lg);">
            <div style="font-size:2.8rem; margin-bottom:0.75rem;">💰</div>
            <h3 style="font-size:1.2rem; color:#1E3A8A; margin-bottom:0.5rem; font-weight:700;">Cette rubrique est actuellement vierge</h3>
            <p style="font-size:var(--text-sm); max-width:480px; margin:0 auto 1.5rem auto; line-height:1.6;">
              ${this.searchTerm || activeFilter !== 'all' ? 'Aucune entrée ne correspond à vos filtres de recherche.' : 'Vous n\'avez pas encore enregistré d\'autres entrées d\'argent. Utilisez cette rubrique pour enregistrer les dons, cantine, blouses, kermesse ou autres rentrées hors mensualités.'}
            </p>
            <button id="btnEmptyAddOtherRevenue" class="btn btn-success btn-sm" onclick="App.openAddOtherRevenueModal()" style="background:#16A34A; color:#FFFFFF; border-color:#16A34A; padding:0.6rem 1.25rem;">
              + Enregistrer une autre entrée
            </button>
          </div>
        ` : `
          <table class="data-table">
            <thead>
              <tr>
                <th>N° Reçu</th>
                <th>Date</th>
                <th>Motif & Payeur</th>
                <th>Rubrique</th>
                <th>Mode</th>
                <th>Montant</th>
                <th>Statut</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(r => `
                <tr class="${r.status === 'cancelled' ? 'row-cancelled' : ''}">
                  <td data-label="N° Reçu">
                    <strong>${Utils.escapeHtml(r.receipt_number || '-')}</strong>
                  </td>
                  <td data-label="Date">${Utils.formatDate(r.date)}</td>
                  <td data-label="Motif">
                    <div style="font-weight:700; color:var(--text-dark);">${Utils.escapeHtml(r.motif)}</div>
                    ${r.payer_name ? `<div style="font-size:11px; color:var(--text-muted);">Payeur : ${Utils.escapeHtml(r.payer_name)}</div>` : ''}
                    ${r.status === 'cancelled' && r.cancel_reason ? `<div style="font-size:11px; color:var(--danger); font-weight:600;">Motif annulation : ${Utils.escapeHtml(r.cancel_reason)}</div>` : ''}
                  </td>
                  <td data-label="Rubrique">
                    <span class="badge badge-info">${Utils.escapeHtml(r.category || 'Général')}</span>
                  </td>
                  <td data-label="Mode">
                    <span style="font-size:11px; text-transform:uppercase; font-weight:700; color:var(--text-muted);">${Utils.escapeHtml(Utils.paymentMethodLabel(r.payment_method || 'cash'))}</span>
                  </td>
                  <td data-label="Montant" style="font-weight:800; color:${r.status === 'cancelled' ? 'var(--text-muted)' : 'var(--success)'}; font-size:var(--text-base);">
                    ${r.status === 'cancelled' ? `<del>${Utils.formatFCFA(r.amount)}</del>` : `+ ${Utils.formatFCFA(r.amount)}`}
                  </td>
                  <td data-label="Statut">
                    ${r.status === 'cancelled' 
                      ? `<span class="badge badge-danger">✕ Annulée</span>` 
                      : `<span class="badge badge-success">✓ Encaissée</span>`}
                  </td>
                  <td data-label="Actions" style="text-align:right;">
                    <div style="display:inline-flex; gap:0.25rem;">
                      <button class="btn btn-secondary btn-sm" onclick="App.viewReceipt('${r.id}')" title="Voir / Imprimer le reçu officiel certifié">
                        🖨️ Reçu
                      </button>
                      ${r.status !== 'cancelled' ? `
                        <button class="btn btn-secondary btn-sm" onclick="App.openEditOtherRevenueModal('${r.id}')" title="Modifier cette rentrée">
                          ✎
                        </button>
                        <button class="btn btn-outline-danger btn-sm" onclick="App.openCancelOtherRevenueModal('${r.id}')" title="Annuler cette rentrée">
                          ✕
                        </button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    `;
  },

  openAddOtherRevenueModal(defaultCategory = '') {
    const modal = document.getElementById('otherRevenueModal');
    if (!modal) return;
    const titleEl = document.getElementById('otherRevModalTitle');
    const submitBtn = document.getElementById('otherRevSubmitBtn');
    const deleteBtn = document.getElementById('otherRevDeleteBtn');
    const idInput = document.getElementById('otherRevId');
    const motifInput = document.getElementById('otherRevMotif');
    const amountInput = document.getElementById('otherRevAmount');
    const dateInput = document.getElementById('otherRevDate');
    const payerInput = document.getElementById('otherRevPayer');
    const methodSelect = document.getElementById('otherRevMethod');
    const customContainer = document.getElementById('customOtherRevCategoryContainer');
    const customInput = document.getElementById('customOtherRevCategory');

    if (titleEl) titleEl.textContent = "Enregistrer une autre rentrée d'argent";
    if (submitBtn) submitBtn.textContent = "Enregistrer et émettre le reçu";
    if (deleteBtn) deleteBtn.style.display = 'none';
    if (idInput) idInput.value = '';
    if (motifInput) motifInput.value = '';
    if (amountInput) amountInput.value = '';
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    if (payerInput) payerInput.value = '';
    if (methodSelect) methodSelect.value = 'cash';
    if (customContainer) customContainer.style.display = 'none';
    if (customInput) { customInput.value = ''; customInput.required = false; }

    this.populateOtherRevenueRubriques(defaultCategory || "Dons & Subventions");

    modal.classList.add('is-open');
    setTimeout(() => { if (motifInput) motifInput.focus(); }, 100);
  },

  openEditOtherRevenueModal(id) {
    const revenue = Store.getOtherRevenueById(id);
    if (!revenue) return;
    const modal = document.getElementById('otherRevenueModal');
    if (!modal) return;
    const titleEl = document.getElementById('otherRevModalTitle');
    const submitBtn = document.getElementById('otherRevSubmitBtn');
    const deleteBtn = document.getElementById('otherRevDeleteBtn');
    const idInput = document.getElementById('otherRevId');
    const motifInput = document.getElementById('otherRevMotif');
    const amountInput = document.getElementById('otherRevAmount');
    const dateInput = document.getElementById('otherRevDate');
    const payerInput = document.getElementById('otherRevPayer');
    const methodSelect = document.getElementById('otherRevMethod');
    const customContainer = document.getElementById('customOtherRevCategoryContainer');
    const customInput = document.getElementById('customOtherRevCategory');

    if (titleEl) titleEl.textContent = "Modifier la rentrée d'argent";
    if (submitBtn) submitBtn.textContent = "Enregistrer les modifications";
    if (deleteBtn) {
      deleteBtn.style.display = 'inline-flex';
      deleteBtn.setAttribute('data-revenue-id', revenue.id);
    }
    if (idInput) idInput.value = revenue.id;
    if (motifInput) motifInput.value = revenue.motif || '';
    if (amountInput) amountInput.value = revenue.amount || '';
    if (dateInput) dateInput.value = revenue.date || new Date().toISOString().split('T')[0];
    if (payerInput) payerInput.value = revenue.payer_name || '';
    if (methodSelect) methodSelect.value = revenue.payment_method || 'cash';
    if (customContainer) customContainer.style.display = 'none';
    if (customInput) { customInput.value = ''; customInput.required = false; }

    this.populateOtherRevenueRubriques(revenue.category || "Dons & Subventions");

    modal.classList.add('is-open');
  },

  populateOtherRevenueRubriques(selectedCategory = '') {
    const select = document.getElementById('otherRevCategory');
    if (!select) return;
    const rubriques = Store.getOtherRevenueRubriques();

    select.innerHTML = `
      ${rubriques.map(r => `
        <option value="${Utils.escapeHtml(r)}" ${r === selectedCategory ? 'selected' : ''}>
          ${Utils.escapeHtml(r)}
        </option>
      `).join('')}
      <option value="__NEW_CUSTOM_OTHER_REV__">➕ Ajouter une nouvelle rubrique personnalisée...</option>
    `;
    this.onOtherRevenueCategoryChange(select.value);
  },

  onOtherRevenueCategoryChange(val) {
    const customContainer = document.getElementById('customOtherRevCategoryContainer');
    const customInput = document.getElementById('customOtherRevCategory');
    if (!customContainer) return;
    if (val === '__NEW_CUSTOM_OTHER_REV__') {
      customContainer.style.display = 'block';
      if (customInput) {
        customInput.required = true;
        customInput.focus();
      }
    } else {
      customContainer.style.display = 'none';
      if (customInput) customInput.required = false;
    }
  },

  handleOtherRevenueSubmit(event) {
    if (event) event.preventDefault();
    try {
      const id = (document.getElementById('otherRevId')?.value || '').trim();
      const motif = (document.getElementById('otherRevMotif')?.value || '').trim();
      const rawAmount = document.getElementById('otherRevAmount')?.value || '';
      const cleanAmountStr = String(rawAmount).replace(/\s/g, '').replace(/,/g, '.');
      const amount = Math.round(parseFloat(cleanAmountStr)) || 0;
      const date = document.getElementById('otherRevDate')?.value || new Date().toISOString().split('T')[0];
      const payerName = (document.getElementById('otherRevPayer')?.value || '').trim();
      const paymentMethod = document.getElementById('otherRevMethod')?.value || 'cash';

      const categorySelect = document.getElementById('otherRevCategory');
      let category = categorySelect ? categorySelect.value : 'Dons & Subventions';

      if (category === '__NEW_CUSTOM_OTHER_REV__') {
        const customVal = (document.getElementById('customOtherRevCategory')?.value || '').trim();
        if (!customVal) {
          this.showToast("Veuillez renseigner le nom de la nouvelle rubrique.", "warning");
          document.getElementById('customOtherRevCategory')?.focus();
          return;
        }
        category = customVal;
        Store.addCustomOtherRevenueRubrique(customVal);
      }

      if (!motif) {
        this.showToast("Veuillez renseigner le motif de la rentrée.", "warning");
        return;
      }
      if (amount <= 0) {
        this.showToast("Le montant doit être supérieur à zéro FCFA.", "warning");
        return;
      }

      if (id) {
        Store.updateOtherRevenue(id, { motif, amount, date, category, payment_method: paymentMethod, payer_name: payerName });
        this.showToast("Rentrée financière modifiée avec succès !", "success");
      } else {
        const newRev = Store.addOtherRevenue({ motif, amount, date, category, payment_method: paymentMethod, payer_name: payerName });
        this.showToast("Rentrée enregistrée et reçu officiel généré !", "success");
        setTimeout(() => this.viewReceipt(newRev.id), 300);
      }

      this.closeAllModals();
      if (this.currentTab === 'other-revenues') {
        this.renderOtherRevenues(document.getElementById('appViewContent'));
      } else if (this.currentTab === 'bilan') {
        this.renderBilan(document.getElementById('appViewContent'));
      } else if (this.currentTab === 'dashboard') {
        this.renderDashboard(document.getElementById('appViewContent'));
      }
    } catch (err) {
      alert("Erreur lors de l'enregistrement : " + err.message);
    }
  },

  deleteOtherRevenueFromModal() {
    const id = document.getElementById('otherRevId')?.value;
    if (!id) return;
    const revenue = Store.getOtherRevenueById(id);
    if (!revenue) return;

    this.openConfirmModal({
      title: "Supprimer la rentrée",
      message: `Confirmez-vous la suppression de la rentrée « ${revenue.motif} » d'un montant de ${Utils.formatFCFA(revenue.amount)} ?`,
      detailsHtml: `<div style="font-size:var(--text-sm); color:var(--text-muted); line-height:1.5;">Cette suppression effacera définitivement cette écriture et son reçu n° ${Utils.escapeHtml(revenue.receipt_number || '-')} du registre.</div>`,
      onConfirm: () => {
        Store.deleteOtherRevenue(id);
        this.closeAllModals();
        this.showToast("Rentrée supprimée du registre.", "info");
        if (this.currentTab === 'other-revenues') {
          this.renderOtherRevenues(document.getElementById('appViewContent'));
        } else {
          this.navigate(this.currentTab);
        }
      }
    });
  },

  openCancelOtherRevenueModal(id) {
    const revenue = Store.getOtherRevenueById(id);
    if (!revenue) return;
    this.pendingCancelOtherRevId = id;

    const modal = document.getElementById('cancelOtherRevenueModal');
    if (!modal) return;
    const motifEl = document.getElementById('cancelOtherRevMotif');
    const amountEl = document.getElementById('cancelOtherRevAmount');
    if (motifEl) motifEl.textContent = revenue.motif;
    if (amountEl) amountEl.textContent = Utils.formatFCFA(revenue.amount);

    modal.classList.add('is-open');
  },

  confirmCancelOtherRevenue() {
    if (!this.pendingCancelOtherRevId) return;
    const reasonSelect = document.getElementById('cancelOtherRevReason');
    const reason = reasonSelect ? reasonSelect.value : 'Annulation administrative';

    try {
      Store.cancelOtherRevenue(this.pendingCancelOtherRevId, reason);
      this.closeAllModals();
      this.showToast("Rentrée annulée. Le reçu a été marqué ANNULÉ.", "info");
      this.pendingCancelOtherRevId = null;
      if (this.currentTab === 'other-revenues') {
        this.renderOtherRevenues(document.getElementById('appViewContent'));
      } else {
        this.navigate(this.currentTab);
      }
    } catch (err) {
      alert("Erreur lors de l'annulation : " + err.message);
    }
  },

  onOtherRevenueSearch(term) {
    this.searchTerm = String(term || '').slice(0, 100);
    this.renderOtherRevenues(document.getElementById('appViewContent'));
    this.restoreSearchFocus('.search-input-wrapper input');
  },

  onOtherRevenueCategoryFilter(cat) {
    this.activeOtherRevenueRubriqueFilter = cat;
    this.renderOtherRevenues(document.getElementById('appViewContent'));
  },

  onOtherRevenueStatusFilter(status) {
    this.activeOtherRevenueStatusFilter = status;
    this.renderOtherRevenues(document.getElementById('appViewContent'));
  },

  exportOtherRevenuesCsv() {
    const list = Store.getOtherRevenues();
    const school = Store.getSchool();
    let csv = Utils.csvRow(["Établissement", school.name]);
    csv += Utils.csvRow(["Année scolaire", school.school_year]);
    csv += Utils.csvRow(["Export", "Autres rentrées financières"]);
    csv += Utils.csvRow(["Date d'export", new Date().toLocaleDateString('fr-FR')]);
    csv += '\r\n';
    csv += Utils.csvRow(["N° Reçu", "Date", "Motif", "Payeur", "Rubrique", "Mode", "Montant (FCFA)", "Statut", "Motif annulation"]);

    list.forEach(r => {
      csv += Utils.csvRow([
        r.receipt_number || '',
        r.date || '',
        r.motif || '',
        r.payer_name || '',
        r.category || '',
        Utils.paymentMethodLabel(r.payment_method || 'cash'),
        parseInt(r.amount, 10) || 0,
        r.status === 'cancelled' ? 'Annulé' : 'Valide',
        r.cancel_reason || ''
      ]);
    });

    const safeSchool = String(school.name || 'ecole').replace(/[^a-zA-Z0-9À-ÿ_-]+/g, '_').slice(0, 60);
    Utils.downloadCSV(csv, `autres_rentrees_${safeSchool}_${new Date().toISOString().split('T')[0]}.csv`);
    this.showToast("Export CSV des autres rentrées téléchargé.", "success");
  },

  async triggerPwaInstall() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true || window.__isPwaStandalone;
    if (isStandalone) {
      this.showToast("Gestion Préscolaire est déjà installée sur cet appareil !", "info");
      const btn = document.getElementById('btnPwaInstallApp');
      if (btn) btn.style.display = 'none';
      return;
    }

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    let promptEvent = window.deferredPwaPrompt;

    if (!promptEvent && !isIos) {
      promptEvent = await new Promise((resolve) => {
        if (window.deferredPwaPrompt) return resolve(window.deferredPwaPrompt);
        const timer = setTimeout(() => resolve(window.deferredPwaPrompt || null), 1200);
        document.addEventListener('pwa-prompt-ready', () => {
          clearTimeout(timer);
          resolve(window.deferredPwaPrompt);
        }, { once: true });
      });
    }

    if (promptEvent) {
      try {
        promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice && choice.outcome === 'accepted') {
          this.showToast("✓ Application en cours d'installation sur votre écran...", "success");
          window.deferredPwaPrompt = null;
          const btn = document.getElementById('btnPwaInstallApp');
          if (btn) btn.style.display = 'none';
        }
      } catch (err) {
        console.warn('[PWA] Erreur prompt:', err);
      }
      return;
    }

    if (isIos) {
      alert("Installation sur iPhone / iPad :\n\n1. Appuyez sur le bouton Partager ⎋ en bas de Safari.\n2. Choisissez « Sur l'écran d'accueil ➕ ».\n3. Appuyez sur « Ajouter » en haut à droite.");
      return;
    }

    alert("Pour installer l'application sur votre écran d'accueil :\n\nAppuyez sur le menu de votre navigateur (les trois points ⋮ en haut à droite) puis sur « Installer l'application ».");
  },

  // ----------------------------------------------------------------------------
  // WIZARD : RÉFÉRENCER MON ÉCOLE
  // ----------------------------------------------------------------------------
  openReferenceSchoolModal() {
    const modal = document.getElementById('referenceSchoolModal');
    if (!modal) return;
    this.populateRefRegions();
    const user = window.Auth ? Auth.getUser() : null;
    if (user && user.phone) {
      const phoneInput = document.getElementById('refDirectorPhone');
      if (phoneInput && !phoneInput.value) phoneInput.value = user.phone;
    }
    this.closeAllModals();
    modal.classList.add('is-open');
    const nameInput = document.getElementById('refSchoolName');
    if (nameInput) setTimeout(() => nameInput.focus(), 150);
  },

  populateRefRegions() {
    const regSelect = document.getElementById('refRegion');
    if (!regSelect) return;
    regSelect.innerHTML = '';
    const regions = Object.keys(CONFIG.SENEGAL_REGIONS);
    regions.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r;
      opt.textContent = r;
      regSelect.appendChild(opt);
    });
    this.onRefRegionChange(regions[0] || 'Dakar');
  },

  onRefRegionChange(region) {
    const deptSelect = document.getElementById('refDepartment');
    if (!deptSelect) return;
    deptSelect.innerHTML = '';
    const depts = Object.keys(CONFIG.SENEGAL_REGIONS[region] || {});
    depts.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      deptSelect.appendChild(opt);
    });
    this.onRefDeptChange(depts[0] || '');
  },

  onRefDeptChange(dept) {
    const comSelect = document.getElementById('refCommune');
    const regSelect = document.getElementById('refRegion');
    if (!comSelect || !regSelect) return;
    const region = regSelect.value;
    comSelect.innerHTML = '';
    const communes = (CONFIG.SENEGAL_REGIONS[region] && CONFIG.SENEGAL_REGIONS[region][dept]) || [];
    communes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      comSelect.appendChild(opt);
    });
  },

  async handleReferenceSchoolSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('refSchoolName').value.trim();
    const phone = document.getElementById('refDirectorPhone').value.trim();
    const schoolYear = document.getElementById('refSchoolYear').value.trim() || '2026-2027';
    const region = document.getElementById('refRegion').value;
    const department = document.getElementById('refDepartment').value;
    const commune = document.getElementById('refCommune').value;
    const address = (document.getElementById('refAddress').value || '').trim();

    const crecheReg = parseInt(document.getElementById('refFeeCrecheReg') ? document.getElementById('refFeeCrecheReg').value : 25000, 10) || 25000;
    const crecheMonth = parseInt(document.getElementById('refFeeCrecheMonth') ? document.getElementById('refFeeCrecheMonth').value : 15000, 10) || 15000;
    const psReg = parseInt(document.getElementById('refFeePsReg').value, 10) || 25000;
    const psMonth = parseInt(document.getElementById('refFeePsMonth').value, 10) || 15000;
    const msReg = parseInt(document.getElementById('refFeeMsReg').value, 10) || 25000;
    const msMonth = parseInt(document.getElementById('refFeeMsMonth').value, 10) || 15000;
    const gsReg = parseInt(document.getElementById('refFeeGsReg').value, 10) || 30000;
    const gsMonth = parseInt(document.getElementById('refFeeGsMonth').value, 10) || 18000;

    const errBox = document.getElementById('refSchoolErrorBox');
    if (!name) {
      if (errBox) {
        errBox.textContent = "Veuillez renseigner le nom de votre établissement.";
        errBox.style.display = 'block';
      }
      return;
    }

    try {
      const submitBtn = document.getElementById('btnSubmitRefSchool');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Création de votre école...';
      }

      await Auth.referenceSchool({
        schoolName: name,
        directorPhone: phone,
        schoolYear,
        region,
        department,
        commune,
        address,
        classes: [
          { name: 'Crèche', registration_fee: crecheReg, monthly_fee: crecheMonth },
          { name: 'Petite section', registration_fee: psReg, monthly_fee: psMonth },
          { name: 'Moyenne section', registration_fee: msReg, monthly_fee: msMonth },
          { name: 'Grande section', registration_fee: gsReg, monthly_fee: gsMonth }
        ]
      });

      await Store.init();
      this.closeAllModals();
      this.renderHeader();
      this.showToast(`Établissement ${name} référencé avec succès !`, "success");
      this.navigate('dashboard');
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message || "Erreur lors du référencement.";
        errBox.style.display = 'block';
      } else {
        alert(err.message || "Erreur lors du référencement.");
      }
      const submitBtn = document.getElementById('btnSubmitRefSchool');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Valider et ouvrir mon école</span>`;
      }
    }
  }
};

window.App = App;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}
