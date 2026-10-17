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
    await Store.init();
    
    // Définition du mois courant par défaut (Octobre)
    const months = Store.getMonths();
    if (months.length > 0) {
      this.currentMonthId = months[0].id;
    }

    this.initTheme();
    this.bindGlobalEvents();
    this.renderHeader();
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

    this.currentTab = resolvedTab;

    // Mise à jour de la classe active sur la sidebar desktop
    document.querySelectorAll('.sidebar-nav-item').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-tab') === resolvedTab);
    });

    // Mise à jour sur la barre mobile
    document.querySelectorAll('.mobile-nav-item').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-tab') === resolvedTab);
    });

    const contentArea = document.getElementById('appViewContent');
    if (!contentArea) return;

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

    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  bindGlobalEvents() {
    // Navigation sidebar et barre mobile
    document.querySelectorAll('[data-tab]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = el.getAttribute('data-tab');
        this.navigate(tab);
      });
    });

    // Écouteur pour modales
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => this.closeAllModals());
    });

    window.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-backdrop')) {
        this.closeAllModals();
      }
    });
  },

  renderHeader() {
    const school = Store.getSchool();
    const titleEl = document.getElementById('topbarSchoolName');
    if (titleEl && school) {
      titleEl.textContent = school.name;
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

      <!-- Cartes KPI de synthèse -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-title">Inscriptions Encaissées</span>
          <div class="kpi-figure" style="color:var(--primary);">${Utils.formatFCFA(metrics.registration.total_collected)}</div>
          <div class="kpi-meta">
            ${metrics.registration.paid_students} sur ${metrics.registration.total_students} inscrits (${metrics.registration.percentage}%)
          </div>
        </div>

        <div class="kpi-card">
          <span class="kpi-title">Mois en cours (${Utils.escapeHtml(metrics.current_month.label)})</span>
          <div class="kpi-figure" style="color:var(--success);">${Utils.formatFCFA(metrics.current_month.total_collected)}</div>
          <div class="kpi-meta">
            Attendu : ${Utils.formatFCFA(metrics.current_month.total_expected)}
          </div>
        </div>

        <div class="kpi-card">
          <span class="kpi-title">Pourcentage du mois</span>
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
            <button class="btn btn-secondary btn-sm" onclick="App.openImportCsvModal()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
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
                <td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">
                  Aucun élève ne correspond à votre recherche.
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
                      <a href="tel:${s.parent_phone}" style="color:var(--primary); font-weight:600;">${Utils.escapeHtml(s.parent_phone)}</a>
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
              <th style="text-align:right;">Reçu</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0 ? `
              <tr>
                <td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">
                  Aucun élève trouvé avec les filtres sélectionnés.
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
                  <td data-label="Reçu" style="text-align:right;">
                    ${isPaid ? `
                      <div style="display:inline-flex; gap:0.35rem; align-items:center; justify-content:flex-end;">
                        <button class="btn btn-outline-primary btn-sm" onclick="App.viewReceipt('${payment.id}')" title="Afficher et imprimer le reçu officiel">
                          📄 Reçu
                        </button>
                        <button class="btn btn-whatsapp btn-sm" onclick="App.shareWhatsApp('${payment.id}')" title="Envoyer le reçu au parent sur WhatsApp" style="padding:0.35rem 0.55rem; font-size:12px;">
                          <span>📲</span>
                          <span>WhatsApp</span>
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
                <th style="text-align:right;">Reçu</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">
                    Aucun élève trouvé avec les filtres sélectionnés.
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
                    <td data-label="Reçu" style="text-align:right;">
                      ${isPaid ? `
                        <div style="display:inline-flex; gap:0.35rem; align-items:center; justify-content:flex-end;">
                          <button class="btn btn-outline-primary btn-sm" onclick="App.viewReceipt('${payment.id}')" title="Afficher et imprimer le reçu officiel">
                            📄 Reçu
                          </button>
                          <button class="btn btn-whatsapp btn-sm" onclick="App.shareWhatsApp('${payment.id}')" title="Envoyer le reçu au parent sur WhatsApp" style="padding:0.35rem 0.55rem; font-size:12px;">
                            <span>📲</span>
                            <span>WhatsApp</span>
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
    const grand = Store.getGrandTotalSummary();
    const rubriques = Store.getExpenseRubriques();

    // Calcul des totaux par rubrique
    const rubriqueTotals = {};
    expenses.forEach(e => {
      const cat = e.category || 'Fournitures scolaires & papeterie';
      rubriqueTotals[cat] = (rubriqueTotals[cat] || 0) + (parseInt(e.amount, 10) || 0);
    });

    const activeFilter = this.activeExpenseRubriqueFilter || 'all';

    const filtered = expenses.filter(e => {
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
            <p class="view-subtitle">Enregistrement et suivi des sorties de caisse de l'école par rubrique budgétaire</p>
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

      <!-- KPI Synthèse Dépenses & Trésorerie Nette -->
      <div class="kpi-grid">
        <div class="kpi-card" style="border-top:4px solid var(--danger);">
          <span class="kpi-title">Total Dépenses Décaissées</span>
          <div class="kpi-figure" style="color:var(--danger);">${Utils.formatFCFA(expensesSummary.total_amount)}</div>
          <div class="kpi-meta">${expensesSummary.count} dépenses dans ${Object.keys(rubriqueTotals).length} rubriques</div>
        </div>

        <div class="kpi-card" style="border-top:4px solid var(--primary);">
          <span class="kpi-title">Total Recettes Encaissées</span>
          <div class="kpi-figure" style="color:var(--primary);">${Utils.formatFCFA(grand.grand_collected)}</div>
          <div class="kpi-meta">Inscriptions (${Utils.formatFCFA(grand.registration.total_collected)}) + Cotisations (${Utils.formatFCFA(grand.monthly.cumulated_collected)})</div>
        </div>

        <div class="kpi-card" style="border-top:4px solid var(--success); background:linear-gradient(180deg, #FFFFFF 0%, #F0FDF4 100%);">
          <span class="kpi-title">
            Solde Net Disponible (Moment T)
            <button class="info-tooltip-btn" title="Total Recettes Encaissées - Total Dépenses Décaissées">i</button>
          </span>
          <div class="kpi-figure" style="color:var(--success); font-weight:800;">${Utils.formatFCFA(grand.net_available)}</div>
          <div class="kpi-meta">Trésorerie nette restant en caisse</div>
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
              <button type="button" class="rubrique-chip ${activeFilter === r ? 'active' : ''}" onclick="App.onExpenseRubriqueFilterChange('${Utils.escapeHtml(r)}')">
                <span>${Utils.escapeHtml(r)}</span>
                <strong>${Utils.formatFCFA(rubriqueTotals[r])}</strong>
              </button>
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
                <th style="text-align:right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="5" style="text-align:center; padding:2.5rem; color:var(--text-muted);">
                    <div style="font-size:2.5rem; margin-bottom:0.5rem;">💸</div>
                    <p style="font-weight:700; font-size:var(--text-base); margin-bottom:0.25rem;">Aucune dépense trouvée</p>
                    <p style="font-size:var(--text-sm); margin-bottom:1.25rem;">Enregistrez vos frais et sorties de caisse (fournitures, factures, salaires, cantine...)</p>
                    <button class="btn btn-danger btn-sm" onclick="App.openAddExpenseModal()" style="padding:0.5rem 1.25rem;">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                      <span>Ajouter une nouvelle dépense</span>
                    </button>
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
                  <td data-label="Action" style="text-align:right; white-space:nowrap;">
                    <button class="btn btn-outline-primary btn-sm" onclick="App.openEditExpenseModal('${e.id}')" title="Modifier la dépense" style="margin-right:0.35rem;">
                      ✏️ Modifier
                    </button>
                    <button class="btn btn-outline-danger btn-sm" onclick="App.confirmDeleteExpense('${e.id}')" title="Supprimer la dépense">
                      🗑️ Supprimer
                    </button>
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
          <div class="kpi-meta">Inscriptions (${Utils.formatFCFA(grand.registration.total_collected)}) + Cotisations (${Utils.formatFCFA(grand.monthly.cumulated_collected)})</div>
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
          <span class="badge badge-info">Année scolaire 2026-2027</span>
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
                    <strong>2. Cotisations mensuelles (Octobre à Juillet)</strong>
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
                    <strong>3. Total Dépenses de fonctionnement décaissées</strong>
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
    const expenses = Store.getExpenses();

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
    const stampSvg = SchoolStamp.generateSVG(school, 200);

    container.innerHTML = `
      <div class="view-header">
        <h1 class="view-title">Paramètres de l'établissement</h1>
        <p class="view-subtitle">Configuration générale de l'école, cachet officiel et tarifs</p>
      </div>

      <div style="display:grid; grid-template-columns:1fr; gap:1.5rem;">
        <!-- Édition du Cachet officiel (§ 6) -->
        <div style="background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-lg); padding:1.5rem;">
          <h2 style="font-size:var(--text-lg); margin-bottom:1rem;">Cachet officiel de l'école</h2>
          <div style="display:flex; flex-wrap:wrap; gap:2rem; align-items:center;">
            <div id="settingsStampDisplay">
              ${stampSvg}
            </div>
            <div style="flex:1; min-width:260px;">
              <p style="font-size:var(--text-sm); color:var(--text-muted); margin-bottom:1rem;">
                Le cachet officiel rouge vif (#DC2626) haute visibilité est généré en temps réel d'après les informations ci-dessous. Il s'applique automatiquement sur tous les reçus imprimables et partagés.
              </p>
              <div class="form-group">
                <label class="form-label">Nom de l'école</label>
                <input type="text" id="settingSchoolName" class="form-input" value="${Utils.escapeHtml(school.name)}">
              </div>
              <div class="form-group">
                <label class="form-label">Nom du Directeur / de la Directrice</label>
                <input type="text" id="settingDirectorName" class="form-input" value="${Utils.escapeHtml(school.director_name)}">
              </div>
              <div class="form-group">
                <label class="form-label">Téléphone du Directeur (cachet)</label>
                <input type="text" id="settingDirectorPhone" class="form-input" value="${Utils.escapeHtml(school.director_phone)}">
              </div>
              <button class="btn btn-primary" onclick="App.saveSettings()">Enregistrer les modifications</button>
            </div>
          </div>
        </div>

        <!-- Réinitialisation ou rechargement démo -->
        <div style="background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-lg); padding:1.5rem;">
          <h2 style="font-size:var(--text-lg); margin-bottom:0.5rem; color:var(--text-main);">Données de démonstration</h2>
          <p style="font-size:var(--text-sm); color:var(--text-muted); margin-bottom:1rem;">
            Réinitialisez l'ensemble des données avec les 30 élèves fictifs et paiements modèles pour vos présentations ou tests.
          </p>
          <button class="btn btn-secondary" onclick="App.resetDemoData()">Réinitialiser les données de test</button>
        </div>
      </div>
    `;
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

    try {
      const res = Store.recordPayment({
        studentId,
        kind,
        monthId,
        amount,
        method,
        reference
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
  // AFFICHAGE & ÉMISSION DU REÇU OFFICIEL FORMAT A5 (§ 7)
  // ----------------------------------------------------------------------------
  viewReceipt(paymentId) {
    const receipt = Store.data.receipts.find(r => r.payment_id === paymentId);
    const payment = Store.data.payments.find(p => p.id === paymentId);
    if (!receipt || !payment) return;

    const school = Store.getSchool();
    const student = Store.getStudentById(payment.student_id);
    const cls = student ? Store.getClassById(student.class_id) : null;

    let objectLabel = "Frais d'inscription";
    if (payment.kind === 'monthly') {
      const m = Store.getMonthById(payment.month_id);
      objectLabel = `Cotisation du mois de ${m ? m.label : ''} ${school.school_year}`;
    }

    const amountInWords = Utils.amountToFrenchWords(payment.amount);
    const verifyUrl = `${window.location.origin}${window.location.pathname.replace('app.html', '')}verify.html?token=${receipt.public_token}`;
    const qrSvg = Utils.generateQRCodeSVG(verifyUrl, 84);
    const stampSvg = SchoolStamp.generateSVG(school, 155, false);

    const modal = document.getElementById('receiptModal');
    const container = document.getElementById('receiptModalBody');

    container.innerHTML = `
      <div class="receipt-document">
        ${receipt.status === 'cancelled' ? `
          <div class="receipt-watermark-cancelled">ANNULÉ</div>
        ` : ''}

        <!-- En-tête -->
        <div class="receipt-header">
          <div class="receipt-school-info">
            <h2>${Utils.escapeHtml(school.name)}</h2>
            <div class="receipt-school-meta">
              ${school.address ? `<div>${Utils.escapeHtml(school.address)}</div>` : ''}
              <div>${Utils.escapeHtml(school.commune)}, ${Utils.escapeHtml(school.region)} — Sénégal</div>
              <div>Tél : ${Utils.escapeHtml(school.director_phone)}</div>
            </div>
          </div>
          <div class="receipt-title-box">
            <span class="receipt-badge-title">REÇU DE PAIEMENT</span>
            <div class="receipt-number">${Utils.escapeHtml(receipt.receipt_number)}</div>
            <div class="receipt-datetime">${Utils.formatDateTime(receipt.issued_at)}</div>
          </div>
        </div>

        <!-- Corps du reçu -->
        <div class="receipt-body">
          <div class="receipt-info-grid">
            <div class="receipt-row">
              <span class="receipt-label">Élève</span>
              <span class="receipt-value-highlight">${Utils.escapeHtml(student ? student.first_names : '')} <strong>${Utils.escapeHtml(student ? (student.last_name || '').toUpperCase() : '')}</strong></span>
            </div>
            <div class="receipt-row">
              <span class="receipt-label">Classe / Section</span>
              <span class="receipt-value">${Utils.escapeHtml(cls ? cls.name : '-')}</span>
            </div>
            <div class="receipt-row">
              <span class="receipt-label">Parent / Tuteur</span>
              <span class="receipt-value">${Utils.escapeHtml(student && student.parent_name ? student.parent_name : 'Non renseigné')}</span>
            </div>
            <div class="receipt-row">
              <span class="receipt-label">Objet du versement</span>
              <span class="receipt-value">${Utils.escapeHtml(objectLabel)}</span>
            </div>
          </div>

          <!-- Montant officiel -->
          <div class="receipt-amount-card">
            <div class="receipt-amount-header">
              <span style="font-weight:700; font-size:0.95rem; text-transform:uppercase;">Montant réglé :</span>
              <span class="receipt-amount-figures">${Utils.formatFCFA(payment.amount)}</span>
            </div>
            <div class="receipt-amount-words">
              Soit : <strong>${Utils.escapeHtml(amountInWords)}</strong>
            </div>
            <div class="receipt-payment-details">
              <span>Mode : <strong>${Utils.escapeHtml(payment.method.toUpperCase())}</strong> ${payment.reference ? `(Réf : ${Utils.escapeHtml(payment.reference)})` : ''}</span>
              <span style="color:#16A34A; font-weight:700;">Situation : Reste à payer pour le mois : 0 FCFA</span>
            </div>
          </div>

          ${receipt.status === 'cancelled' ? `
            <div style="background:#FEE2E2; border:1px solid #FECACA; padding:0.6rem 0.8rem; border-radius:4px; font-size:0.8rem; color:#991B1B; margin-bottom:1rem;">
              ⚠️ <strong>Paiement annulé :</strong> ${Utils.escapeHtml(payment.cancel_reason || 'Annulation')}
            </div>
          ` : ''}

          <!-- Signatures, Cachet & QR Code -->
          <div class="receipt-signatures-area">
            <div class="receipt-qr-box">
              <div class="qr-wrapper">${qrSvg}</div>
              <div class="receipt-qr-caption">Scannez pour vérifier l'authenticité</div>
            </div>

            <div class="receipt-stamp-box">
              ${stampSvg}
            </div>

            <div class="receipt-director-box">
              <span class="receipt-signature-title">Le Directeur</span>
              <div class="receipt-signature-line"></div>
              <span class="receipt-director-name">${Utils.escapeHtml(school.director_name)}</span>
            </div>
          </div>

          <!-- Pied de page officiel -->
          <div class="receipt-footer-text">
            <span>Document généré par Gestion Préscolaire</span>
            <span>Jeton sécurisé : ${receipt.public_token.substring(0, 16)}...</span>
          </div>
        </div>
      </div>

      <!-- Barre d'outils (Partage WhatsApp, PDF, Imprimer) -->
      <div class="receipt-actions-toolbar no-print">
        <div class="receipt-actions-group">
          <button class="btn btn-whatsapp btn-sm" onclick="App.shareWhatsApp('${payment.id}')">
            <span>📲 Partager par WhatsApp</span>
          </button>
          <button class="btn btn-primary btn-sm" onclick="window.print()">
            <span>🖨️ Imprimer (A5)</span>
          </button>
        </div>
        <div>
          <button class="btn btn-secondary btn-sm" onclick="App.copyReceiptLink('${receipt.public_token}')">
            🔗 Copier le lien sécurisé
          </button>
        </div>
      </div>
    `;

    modal.classList.add('is-open');
  },

  shareWhatsApp(paymentId) {
    const payment = Store.data.payments.find(p => p.id === paymentId);
    const receipt = Store.data.receipts.find(r => r.payment_id === paymentId);
    const student = payment ? Store.getStudentById(payment.student_id) : null;
    const school = Store.getSchool();

    let objectText = "l'inscription";
    if (payment && payment.kind === 'monthly') {
      const m = Store.getMonthById(payment.month_id);
      objectText = `la cotisation de ${m ? m.label : 'mensualité'}`;
    }

    const verifyUrl = `${window.location.origin}${window.location.pathname.replace('app.html', '')}verify.html?token=${receipt.public_token}`;
    const studentName = student ? `${student.first_names} ${student.last_name}` : 'votre enfant';

    const message = `Bonjour,\n\nVoici le reçu officiel de paiement n° ${receipt.receipt_number} de ${school.name} pour ${studentName} (${objectText}) d'un montant de ${Utils.formatFCFA(payment.amount)}.\n\nVous pouvez consulter et télécharger votre reçu sécurisé à tout moment sur ce lien :\n${verifyUrl}\n\nCordialement,\nLa Direction`;

    let waPhone = '';
    if (student && student.parent_phone) {
      waPhone = Utils.toWhatsAppPhone(student.parent_phone);
    }

    const waUrl = waPhone 
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank');
  },

  copyReceiptLink(token) {
    const link = `${window.location.origin}${window.location.pathname.replace('app.html', '')}verify.html?token=${token}`;
    navigator.clipboard.writeText(link).then(() => {
      this.showToast("Lien sécurisé copié dans le presse-papier !", "success");
    }).catch(() => {
      prompt("Voici le lien du reçu à copier :", link);
    });
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

    // Remplissage sélecteur classe
    const classSelect = document.getElementById('studentClassSelect');
    classSelect.innerHTML = Store.getClasses().map(c => `
      <option value="${c.id}">${Utils.escapeHtml(c.name)}</option>
    `).join('');

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
      this.showToast("Élève mis à jour avec succès.", "success");
    } else {
      Store.addStudent({
        last_name: lastName,
        first_names: firstNames,
        gender: gender,
        class_id: classId,
        birth_date: birthDate,
        parent_name: parentName,
        parent_phone: parentPhone
      });
      this.showToast("Nouvel élève inscrit avec succès.", "success");
    }

    this.closeAllModals();
    this.navigate(this.currentTab);
  },

  deactivateStudent(id) {
    const s = Store.getStudentById(id);
    if (!s) return;
    if (confirm(`Confirmez-vous le départ de l'élève ${s.first_names} ${s.last_name} ? Il disparaîtra des listes futures mais tout l'historique sera conservé.`)) {
      Store.deactivateStudent(id);
      this.showToast("Élève désactivé avec succès.", "warning");
      this.renderStudents(document.getElementById('appViewContent'));
    }
  },

  // ----------------------------------------------------------------------------
  // IMPORT CSV EN MASSE (§ 3.2)
  // ----------------------------------------------------------------------------
  openImportCsvModal() {
    const modal = document.getElementById('importCsvModal');
    if (modal) modal.classList.add('is-open');
  },

  downloadCsvTemplate() {
    const content = "PRENOMS,NOM,GENRE,CLASSE,DATE_NAISSANCE,NOM_PARENT,TELEPHONE_PARENT\nMamadou,DIOP,M,Petite section,2023-03-12,Ousmane Diop,+221 77 123 45 67\nFatou,SOW,F,Crèche (2 ans),2024-05-24,Ibrahima Sow,+221 78 234 56 78";
    const blob = new Blob(["\uFEFF" + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "modele_import_eleves_gestion_prescolaire.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  processCsvFile(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0);
      if (lines.length <= 1) {
        alert("Le fichier CSV est vide ou ne contient que l'en-tête.");
        return;
      }

      const classes = Store.getClasses();
      let importedCount = 0;
      const headerParts = lines[0].split(',').map(p => p.trim().toUpperCase());
      const isPrenomFirst = headerParts[0].includes('PRENOM');

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim());
        if (parts.length >= 2 && (parts[0] || parts[1])) {
          let firstNames, lastName, gender, className, birthDate, parentName, parentPhone;
          if (isPrenomFirst) {
            firstNames = parts[0];
            lastName = parts[1];
            gender = (parts[2] || 'M').toUpperCase().startsWith('F') ? 'F' : 'M';
            className = parts[3] || '';
            birthDate = parts[4] || null;
            parentName = parts[5] || '';
            parentPhone = parts[6] || '';
          } else {
            lastName = parts[0];
            firstNames = parts[1] || '';
            gender = 'M';
            className = parts[2] || '';
            birthDate = parts[3] || null;
            parentName = parts[4] || '';
            parentPhone = parts[5] || '';
          }

          // Recherche classe correspondante ou première classe
          const matchedClass = classes.find(c => c.name.toLowerCase() === className.toLowerCase()) || classes[0];

          Store.addStudent({
            last_name: lastName,
            first_names: firstNames,
            gender: gender,
            class_id: matchedClass.id,
            birth_date: birthDate,
            parent_name: parentName,
            parent_phone: parentPhone
          });
          importedCount++;
        }
      }

      this.closeAllModals();
      this.showToast(`${importedCount} élèves importés avec succès !`, "success");
      this.renderStudents(document.getElementById('appViewContent'));
    };

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

    if (titleEl) titleEl.textContent = "Ajouter une nouvelle dépense";
    if (submitBtn) submitBtn.textContent = "Enregistrer la dépense";
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
    const idInput = document.getElementById('expenseIdInput');
    const motifInput = document.getElementById('expenseMotif');
    const amountInput = document.getElementById('expenseAmount');
    const dateInput = document.getElementById('expenseDate');
    const customContainer = document.getElementById('customCategoryContainer');
    const customInput = document.getElementById('expenseCustomCategory');

    if (titleEl) titleEl.textContent = "Modifier la dépense";
    if (submitBtn) submitBtn.textContent = "Enregistrer les modifications";
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
          alert("Veuillez saisir le nom de votre nouvelle rubrique.");
          document.getElementById('expenseCustomCategory')?.focus();
          return;
        }
        category = customVal;
        Store.addCustomExpenseRubrique(customVal);
      }

      if (!motif) {
        alert("Le motif de la dépense est obligatoire.");
        document.getElementById('expenseMotif')?.focus();
        return;
      }
      if (!amount || amount <= 0) {
        alert("Veuillez saisir un montant valide en FCFA supérieur à 0.");
        document.getElementById('expenseAmount')?.focus();
        return;
      }
      if (!date) {
        alert("La date de décaissement est obligatoire.");
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
      alert("Une erreur est survenue lors de l'enregistrement de la dépense : " + (err.message || err));
    }
  },

  confirmDeleteExpense(id) {
    const expense = Store.getExpenseById(id);
    if (!expense) return;

    if (confirm(`Confirmez-vous la suppression de la dépense "${expense.motif}" (${Utils.formatFCFA(expense.amount)}) ? Cette somme sera réintégrée dans le solde disponible.`)) {
      Store.deleteExpense(id);
      this.showToast("Dépense supprimée et trésorerie mise à jour.", "info");

      if (this.currentTab === 'expenses') {
        this.renderExpenses(document.getElementById('appViewContent'));
      } else if (this.currentTab === 'bilan') {
        this.renderBilan(document.getElementById('appViewContent'));
      } else {
        this.navigate(this.currentTab);
      }
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
    if (iconEl && labelEl) {
      if (theme === 'dark') {
        iconEl.textContent = '☀️';
        labelEl.textContent = 'Mode Clair';
      } else {
        iconEl.textContent = '🌙';
        labelEl.textContent = 'Mode Sombre';
      }
    }
  },

  // ----------------------------------------------------------------------------
  // EXPORTS CSV DÉDIÉS (§ Bilan Total, Bilan Inscriptions, Bilan Cotisations, Dépenses)
  // ----------------------------------------------------------------------------
  exportCsvGrandTotal() {
    const grand = Store.getGrandTotalSummary();
    let csv = "RUBRIQUE,ATTENDU_FCFA,ENCAISSE_FCFA,RESTE_OU_CHARGES_FCFA,POURCENTAGE\n";
    csv += `"1. Droits d'inscriptions annuels",${grand.registration.total_expected},${grand.registration.total_collected},${grand.registration.total_remaining},${grand.registration.percentage}%\n`;
    csv += `"2. Cotisations mensuelles (Octobre a Juillet)",${grand.monthly.cumulated_expected},${grand.monthly.cumulated_collected},${grand.monthly.cumulated_remaining},${grand.monthly.cumulated_percentage}%\n`;
    csv += `"SOUS-TOTAL RECETTES BRUTES ENCAISSEES",${grand.grand_expected},${grand.grand_collected},${grand.grand_remaining},${grand.grand_percentage}%\n`;
    csv += `"3. Total Depenses de fonctionnement decaissees",-,${grand.total_expenses},-,Charges\n`;
    csv += `"SOLDE RESTANT DISPONIBLE AU MOMENT T",-,${grand.net_available},-,${grand.net_available >= 0 ? 'Positif' : 'Deficit'}\n`;

    this._downloadFile(csv, "bilan_general_gestion_prescolaire.csv", "text/csv;charset=utf-8;");
  },

  exportExpensesCsv() {
    const expenses = Store.getExpenses();
    let csv = "DATE,MOTIF,CATEGORIE,MONTANT_FCFA\n";
    expenses.forEach(e => {
      const cleanMotif = (e.motif || '').replace(/"/g, '""');
      const cleanCat = (e.category || 'Général').replace(/"/g, '""');
      csv += `"${e.date}","${cleanMotif}","${cleanCat}",${e.amount}\n`;
    });
    const total = Store.getTotalExpenses();
    csv += `"TOTAL","TOTAL GENERAL DES DEPENSES DECAISSEES","-",${total}\n`;

    this._downloadFile(csv, "depenses_ecole_gestion_prescolaire.csv", "text/csv;charset=utf-8;");
  },

  exportCsvRegistrations() {
    const summary = Store.getRegistrationSummary();
    let csv = "SECTION,FRAIS_FCFA,EFFECTIF,PAYES,IMPAYES,ATTENDU_FCFA,ENCAISSE_FCFA,RESTE_FCFA,POURCENTAGE\n";
    summary.classes.forEach(c => {
      csv += `"${c.class_name}",${c.fee},${c.total_students},${c.paid_students},${c.unpaid_students},${c.expected_amount},${c.collected_amount},${c.remaining_amount},${c.percentage}%\n`;
    });
    csv += `"TOTAL",-,${summary.total_students},${summary.paid_students},${summary.unpaid_students},${summary.total_expected},${summary.total_collected},${summary.total_remaining},${summary.percentage}%\n`;

    this._downloadFile(csv, "total_inscriptions_gestion_prescolaire.csv", "text/csv;charset=utf-8;");
  },

  exportCsvAnnual() {
    const annual = Store.getAnnualOverview();
    let csv = "MOIS,ATTENDU_FCFA,ENCAISSE_FCFA,RESTE_FCFA,PAYES,IMPAYES,POURCENTAGE\n";
    annual.months.forEach(m => {
      csv += `"${m.month_label}",${m.expected_amount},${m.collected_amount},${m.remaining_amount},${m.paid_students},${m.unpaid_students},${m.percentage}%\n`;
    });
    csv += `"TOTAL CUMULE",${annual.cumulated_expected},${annual.cumulated_collected},${annual.cumulated_remaining},-,-,${annual.cumulated_percentage}%\n`;

    this._downloadFile(csv, "bilan_annuel_gestion_prescolaire.csv", "text/csv;charset=utf-8;");
  },

  _downloadFile(content, fileName, mimeType) {
    const blob = new Blob(["\uFEFF" + content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // ----------------------------------------------------------------------------
  // INTERACTIONS FILTRES ET PARAMÈTRES
  // ----------------------------------------------------------------------------
  onSearchInput(val) {
    this.searchTerm = val;
    this.navigate(this.currentTab);
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

    if (!name || !dirName || !dirPhone) {
      alert("Tous les champs sont obligatoires.");
      return;
    }

    Store.updateSchool({
      name: name,
      director_name: dirName,
      director_phone: Utils.normalizeSenegalPhone(dirPhone)
    });

    this.showToast("Paramètres et cachet officiel mis à jour.", "success");
    this.renderHeader();
    this.renderSettings(document.getElementById('appViewContent'));
  },

  resetDemoData() {
    if (confirm("Réinitialiser l'application avec les données de démonstration ?")) {
      Store.resetToDemo();
      this.showToast("Données réinitialisées.", "info");
      this.navigate('dashboard');
    }
  },

  closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('is-open'));
  },

  showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : type === 'danger' ? '✕' : 'ℹ'}</span> <span>${Utils.escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 200);
    }, 3500);
  }
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
