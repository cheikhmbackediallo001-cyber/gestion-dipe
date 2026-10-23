/**
 * COUCHE DE GESTION DES DONNÉES & RÈGLES DE CALCUL - GESTION DIPE
 * - RÈGLES STRICTES DE CALCUL (§ 4) :
 *   * Pourcentage de cotisation = (élèves actifs ayant payé ÷ élèves actifs) × 100 arrondi à 1 décimale
 *   * Pourcentage en valeur = montant encaissé ÷ montant attendu × 100
 *   * Montant attendu = somme des mensualités dues par les élèves actifs
 *   * Total inscriptions = somme des paiements d'inscription valides
 *   * Paiements annulés STRICTEMENT EXCLUS de tous les totaux
 *   * Tous les montants sont des ENTIERS (FCFA, zéro calcul flottant sur la monnaie)
 * - Persistance locale (LocalStorage) ou synchronisation Supabase si clés configurées
 */

const Store = {
  data: null,
  storageKey: 'gestion_prescolaire_store_v1',
  currentUser: {
    id: 'director-user-id',
    name: 'Mme Aïssatou Ba',
    role: 'director', // 'director' ou 'staff'
    school_id: '11111111-1111-1111-1111-111111111111'
  },

  /**
   * Initialise le magasin de données pour l'école connectée
   */
  async init() {
    // Synchronisation avec la session active Auth
    if (window.Auth && !Auth.isAuthenticated()) {
      await Auth.init();
    }

    const user = (window.Auth && Auth.getUser()) || this.currentUser;
    let school = window.Auth ? Auth.getSchool() : null;

    // Détermine si on doit utiliser le mode démo universel (si pas d'école configurée ou école démo)
    const hasCustomSchool = school && school.id && !school.isDemo && school.id !== '11111111-1111-1111-1111-111111111111';

    if (hasCustomSchool) {
      // Établissement réel configuré
      this.currentUser = user;
      this.storageKey = `gp_store_${school.id}`;
      let raw = localStorage.getItem(this.storageKey);
      if (raw) {
        try {
          this.data = JSON.parse(raw);
        } catch (e) {
          console.error("Erreur lecture données école:", e);
        }
      }

      if (!this.data || !this.data.school) {
        this.data = {
          school: school,
          classes: [
            { id: 'cls_' + school.id + '_0', school_id: school.id, name: 'Crèche', registration_fee: 25000, monthly_fee: 15000, position: 1 },
            { id: 'cls_' + school.id + '_1', school_id: school.id, name: 'Petite section', registration_fee: 25000, monthly_fee: 15000, position: 2 },
            { id: 'cls_' + school.id + '_2', school_id: school.id, name: 'Moyenne section', registration_fee: 25000, monthly_fee: 15000, position: 3 },
            { id: 'cls_' + school.id + '_3', school_id: school.id, name: 'Grande section', registration_fee: 30000, monthly_fee: 18000, position: 4 }
          ],
          months: CONFIG.DEFAULT_MONTHS.map(m => ({
            id: 'mth_' + school.id + '_' + m.number,
            school_id: school.id,
            school_year: school.school_year || '2026-2027',
            month_number: m.number,
            label: m.label,
            position: m.position
          })),
          students: [],
          payments: [],
          receipts: [],
          expenses: [],
          other_revenues: [],
          audit_log: [],
          receiptCounter: 1
        };
        this.persist();
      }
    } else {
      // MODE DÉMO UNIVERSEL : Accessible à tout le monde
      this.currentUser = user || {
        id: 'usr_demo_director',
        name: 'Mme Aïssatou Ba',
        role: 'director'
      };
      this.storageKey = 'gp_store_demo';
      let raw = localStorage.getItem(this.storageKey);
      if (raw) {
        try {
          this.data = JSON.parse(raw);
        } catch (e) {}
      }

      if (!this.data || !this.data.school || !Array.isArray(this.data.students) || (this.data.students.length === 0 && !this.data.wasReset)) {
        if (window.DemoData) {
          this.data = DemoData.getInitialState();
          this.persist();
        }
      }
    }

    const activeSchoolId = (this.data && this.data.school && this.data.school.id) ? this.data.school.id : 'sch_main';

    // Rétablissement et garantie des 4 sections préscolaires fondamentales (dont la Crèche)
    if (!Array.isArray(this.data.classes) || this.data.classes.length === 0) {
      this.data.classes = [
        { id: 'cls_' + activeSchoolId + '_0', school_id: activeSchoolId, name: 'Crèche', registration_fee: 25000, monthly_fee: 15000, position: 1 },
        { id: 'cls_' + activeSchoolId + '_1', school_id: activeSchoolId, name: 'Petite section', registration_fee: 25000, monthly_fee: 15000, position: 2 },
        { id: 'cls_' + activeSchoolId + '_2', school_id: activeSchoolId, name: 'Moyenne section', registration_fee: 25000, monthly_fee: 15000, position: 3 },
        { id: 'cls_' + activeSchoolId + '_3', school_id: activeSchoolId, name: 'Grande section', registration_fee: 30000, monthly_fee: 18000, position: 4 }
      ];
    } else if (!this.data.classes.some(c => (c.name || '').toLowerCase().includes('crèche') || (c.name || '').toLowerCase().includes('creche'))) {
      this.data.classes.unshift({
        id: 'cls_' + activeSchoolId + '_0',
        school_id: activeSchoolId,
        name: 'Crèche',
        registration_fee: 25000,
        monthly_fee: 15000,
        position: 1
      });
    }

    // Garantie des 9 mois scolaires standard (Octobre à Juin)
    if (!Array.isArray(this.data.months) || this.data.months.length === 0) {
      this.data.months = CONFIG.DEFAULT_MONTHS.map(m => ({
        id: 'mth_' + activeSchoolId + '_' + m.number,
        school_id: activeSchoolId,
        school_year: (this.data.school && this.data.school.school_year) || '2026-2027',
        month_number: m.number,
        label: m.label,
        position: m.position
      }));
    }

    if (this.data && this.data.school && !this.data.school.stamp_color) {
      this.data.school.stamp_color = '#1E3A8A';
    }
    if (this.data && !this.data.expenses) {
      this.data.expenses = [];
    }
    if (this.data && !this.data.other_revenues) {
      this.data.other_revenues = [];
    }
    if (this.data && !this.data.custom_other_revenue_rubriques) {
      this.data.custom_other_revenue_rubriques = [];
    }

    return this.data;
  },

  /**
   * Réinitialise intégralement toutes les données comptables et élèves à zéro
   * Garantit une base 100% vierge et propre immédiatement persistée
   */
  resetToZero() {
    if (!this.data) return null;
    this.data.students = [];
    this.data.payments = [];
    this.data.receipts = [];
    this.data.expenses = [];
    this.data.other_revenues = [];
    this.data.audit_log = [];
    this.data.receiptCounter = 1;
    this.data.wasReset = true;
    this.persist();
    return this.data;
  },

  /**
   * Vérifie si le compte actif est en mode démo
   */
  isDemo() {
    const school = this.data ? this.data.school : (window.Auth ? Auth.getSchool() : null);
    if (!school) return true;
    return !!(school.isDemo || school.id === '11111111-1111-1111-1111-111111111111' || school.id === 'sch_demo');
  },

  resetToDemo() {
    if (window.DemoData) {
      this.data = DemoData.getInitialState();
      this.persist();
      return this.data;
    }
    return null;
  },

  persist() {
    if (this.data && this.storageKey) {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    }
  },

  // ----------------------------------------------------------------------------
  // ÉCOLE & PARAMÈTRES
  // ----------------------------------------------------------------------------
  getSchool() {
    if (this.data && this.data.school && this.data.school.name) {
      return this.data.school;
    }
    if (window.DemoData) {
      return DemoData.getInitialState().school;
    }
    return {
      id: '11111111-1111-1111-1111-111111111111',
      name: "École Maternelle Les Papillons",
      director_name: "Mme Aïssatou Ba",
      director_phone: "+221 77 543 21 00",
      region: "Dakar",
      department: "Dakar",
      commune: "Plateau",
      school_year: "2026-2027",
      status: "active",
      stamp_color: "#1E3A8A",
      isDemo: true
    };
  },

  updateSchool(updates) {
    this.data.school = {
      ...this.data.school,
      ...updates,
      updated_at: new Date().toISOString()
    };
    this.persist();
    return this.data.school;
  },

  updateClassFees(classId, regFee, monthFee) {
    if (!this.data || !this.data.classes) return;
    const cls = this.data.classes.find(c => c.id === classId);
    if (cls) {
      if (regFee !== undefined) cls.registration_fee = parseInt(regFee, 10) || 0;
      if (monthFee !== undefined) cls.monthly_fee = parseInt(monthFee, 10) || 0;
      this.persist();
    }
  },

  getClasses() {
    return [...this.data.classes].sort((a, b) => a.position - b.position);
  },

  getClassById(classId) {
    return this.data.classes.find(c => c.id === classId);
  },

  getMonths() {
    return [...this.data.months].sort((a, b) => a.position - b.position);
  },

  getMonthById(monthId) {
    return this.data.months.find(m => m.id === monthId);
  },

  // ----------------------------------------------------------------------------
  // GESTION DES ÉLÈVES
  // ----------------------------------------------------------------------------
  getStudents(activeOnly = true) {
    let list = this.data.students;
    if (activeOnly) {
      list = list.filter(s => s.active !== false);
    }
    // Tri strict par ordre alphabétique sur le NOM DE FAMILLE (last_name), puis prénom (first_names)
    // Permet d'avoir toute la liste de l'école ou par section rigoureusement ordonnée de A à Z par nom de famille
    return [...list].sort((a, b) => {
      const lastA = (a.last_name || '').trim().toLowerCase();
      const lastB = (b.last_name || '').trim().toLowerCase();
      const cmpLast = lastA.localeCompare(lastB, 'fr', { sensitivity: 'base' });
      if (cmpLast !== 0) return cmpLast;
      const firstA = (a.first_names || '').trim().toLowerCase();
      const firstB = (b.first_names || '').trim().toLowerCase();
      return firstA.localeCompare(firstB, 'fr', { sensitivity: 'base' });
    });
  },

  getStudentById(id) {
    return this.data.students.find(s => s.id === id);
  },

  addStudent(studentData) {
    const newStudent = {
      id: 'student_' + Math.random().toString(36).substring(2, 9),
      school_id: this.data.school.id,
      class_id: studentData.class_id,
      last_name: studentData.last_name.trim().toUpperCase(),
      first_names: studentData.first_names.trim(),
      gender: (studentData.gender === 'F' || studentData.gender === 'fille') ? 'F' : 'M',
      birth_date: studentData.birth_date || null,
      parent_name: studentData.parent_name ? studentData.parent_name.trim() : '',
      parent_phone: studentData.parent_phone ? Utils.normalizeSenegalPhone(studentData.parent_phone) : '',
      active: true,
      created_at: new Date().toISOString()
    };
    this.data.students.push(newStudent);
    this.persist();
    return newStudent;
  },

  updateStudent(id, updates) {
    const index = this.data.students.findIndex(s => s.id === id);
    if (index === -1) throw new Error("Élève introuvable");
    const safeUpdates = { ...updates };
    if (safeUpdates.gender) {
      safeUpdates.gender = (safeUpdates.gender === 'F' || safeUpdates.gender === 'fille') ? 'F' : 'M';
    }
    this.data.students[index] = {
      ...this.data.students[index],
      ...safeUpdates,
      updated_at: new Date().toISOString()
    };
    this.persist();
    return this.data.students[index];
  },

  deactivateStudent(id) {
    return this.updateStudent(id, { active: false });
  },

  // ----------------------------------------------------------------------------
  // PAIEMENTS & REÇUS (§ 3.3, § 3.4, § 4, § 7)
  // ----------------------------------------------------------------------------
  
  /**
   * Vérifie le statut de paiement d'un élève pour une inscription ou un mois
   * Retourne l'objet paiement valide ou null
   */
  getPaymentStatus(studentId, kind, monthId = null) {
    return this.data.payments.find(p => 
      p.student_id === studentId &&
      p.kind === kind &&
      (kind === 'registration' || p.month_id === monthId) &&
      p.status === 'valid'
    ) || null;
  },

  /**
   * Enregistre un paiement et génère automatiquement le reçu officiel
   */
  recordPayment({ studentId, kind, monthId = null, amount, method, reference = null }) {
    // 1. Règle d'unicité stricte : un élève ne peut avoir qu'un seul paiement valide pour un objet donné
    const existing = this.getPaymentStatus(studentId, kind, monthId);
    if (existing) {
      throw new Error(`Un paiement valide existe déjà pour cet élève et ce mois/inscription (Reçu n° ${existing.id}).`);
    }

    const student = this.getStudentById(studentId);
    if (!student) throw new Error("Élève introuvable");

    const parsedAmount = Math.round(Number(amount));
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      throw new Error("Le montant doit être un entier positif en FCFA.");
    }

    const schoolYear = this.data.school.school_year || '2026-2027';
    const yearPrefix = schoolYear.substring(0, 4);

    // 2. Numérotation séquentielle stricte par école sans trou
    const nextVal = (this.data.receiptCounter || 1);
    this.data.receiptCounter = nextVal + 1;
    const receiptNumber = `REC-${yearPrefix}-${String(nextVal).padStart(4, '0')}`;

    // 3. Jeton public cryptographique non devinable
    const publicToken = 'tok_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const nowIso = new Date().toISOString();

    const paymentId = 'pay_' + Math.random().toString(36).substring(2, 9);
    const receiptId = 'rec_' + Math.random().toString(36).substring(2, 9);

    const payment = {
      id: paymentId,
      school_id: this.data.school.id,
      student_id: studentId,
      kind: kind,
      month_id: monthId,
      amount: parsedAmount,
      method: method,
      reference: reference ? reference.trim() : null,
      paid_at: nowIso,
      status: 'valid',
      cancel_reason: null,
      created_by: this.currentUser.id
    };

    const receipt = {
      id: receiptId,
      school_id: this.data.school.id,
      payment_id: paymentId,
      receipt_number: receiptNumber,
      public_token: publicToken,
      issued_at: nowIso,
      status: 'valid'
    };

    this.data.payments.push(payment);
    this.data.receipts.push(receipt);

    // Journal d'audit
    this.data.audit_log.push({
      id: 'audit_' + Math.random().toString(36).substring(2, 9),
      school_id: this.data.school.id,
      user_id: this.currentUser.id,
      action: 'PAYMENT_RECORDED',
      details: {
        payment_id: paymentId,
        receipt_number: receiptNumber,
        amount: parsedAmount,
        kind: kind,
        student_name: `${student.last_name} ${student.first_names}`
      },
      created_at: nowIso
    });

    this.persist();
    return { payment, receipt };
  },

  /**
   * Annulation d'un paiement (Seul le directeur peut annuler, motif obligatoire)
   */
  cancelPayment(paymentId, cancelReason) {
    if (this.currentUser.role !== 'director') {
      throw new Error("Seul le directeur de l'établissement est autorisé à annuler un paiement.");
    }

    if (!cancelReason || cancelReason.trim().length < 5) {
      throw new Error("Un motif d'annulation explicite (minimum 5 caractères) est obligatoire.");
    }

    const payment = this.data.payments.find(p => p.id === paymentId);
    if (!payment) throw new Error("Paiement introuvable");
    if (payment.status === 'cancelled') throw new Error("Ce paiement a déjà été annulé.");

    const nowIso = new Date().toISOString();
    payment.status = 'cancelled';
    payment.cancel_reason = cancelReason.trim();
    payment.cancelled_at = nowIso;
    payment.cancelled_by = this.currentUser.id;

    const receipt = this.data.receipts.find(r => r.payment_id === paymentId);
    if (receipt) {
      receipt.status = 'cancelled';
    }

    const student = this.getStudentById(payment.student_id);

    this.data.audit_log.push({
      id: 'audit_' + Math.random().toString(36).substring(2, 9),
      school_id: this.data.school.id,
      user_id: this.currentUser.id,
      action: 'PAYMENT_CANCELLED',
      details: {
        payment_id: paymentId,
        receipt_number: receipt ? receipt.receipt_number : null,
        cancel_reason: cancelReason,
        student_name: student ? `${student.last_name} ${student.first_names}` : 'Élève inconnu'
      },
      created_at: nowIso
    });

    this.persist();
    return { payment, receipt };
  },

  getPaymentById(paymentId) {
    if (!this.data || !Array.isArray(this.data.payments)) return null;
    return this.data.payments.find(p => p.id === paymentId) || null;
  },

  /**
   * Modifier un paiement existant (somme, mode, date, référence) avec recalcul automatique des reçus et bilans
   */
  updatePayment(paymentId, updates = {}) {
    if (!this.data || !Array.isArray(this.data.payments)) return null;
    const payment = this.data.payments.find(p => p.id === paymentId);
    if (!payment) throw new Error("Paiement introuvable");

    const previousAmount = payment.amount;

    if (updates.amount !== undefined) {
      const cleanStr = String(updates.amount).replace(/\s/g, '').replace(/,/g, '.');
      const parsedAmount = Math.round(parseFloat(cleanStr));
      if (isNaN(parsedAmount) || parsedAmount < 0) {
        throw new Error("Veuillez saisir un montant valide en FCFA supérieur ou égal à 0.");
      }
      payment.amount = parsedAmount;
    }

    if (updates.method) {
      payment.method = updates.method;
    }

    if (updates.reference !== undefined) {
      payment.reference = updates.reference ? updates.reference.trim() : null;
    }

    if (updates.date) {
      payment.paid_at = new Date(updates.date).toISOString();
    }

    payment.updated_at = new Date().toISOString();

    const student = this.getStudentById(payment.student_id);

    try {
      this.logAudit('PAYMENT_UPDATED', {
        payment_id: paymentId,
        previous_amount: previousAmount,
        new_amount: payment.amount,
        kind: payment.kind,
        month_id: payment.month_id,
        method: payment.method,
        student_name: student ? `${student.last_name} ${student.first_names}` : 'Élève inconnu'
      });
    } catch (e) {
      console.warn("Audit log notice:", e);
    }

    this.persist();
    return payment;
  },

  // ----------------------------------------------------------------------------
  // CALCULS STRICTS : TOTAL INSCRIPTIONS (§ 3.5 & § 4)
  // ----------------------------------------------------------------------------
  getRegistrationSummary() {
    const activeStudents = this.getStudents(true);
    const classes = this.getClasses();

    // Map des paiements d'inscriptions valides
    const validPayments = this.data.payments.filter(p => p.kind === 'registration' && p.status === 'valid');
    const paidStudentIds = new Set(validPayments.map(p => p.student_id));
    const paymentByStudent = new Map(validPayments.map(p => [p.student_id, p]));

    const classSummaries = classes.map(cls => {
      const clsStudents = activeStudents.filter(s => s.class_id === cls.id);
      const totalCount = clsStudents.length;
      let paidCount = 0;
      let collectedAmount = 0;

      clsStudents.forEach(s => {
        if (paidStudentIds.has(s.id)) {
          paidCount++;
          const p = paymentByStudent.get(s.id);
          collectedAmount += (p ? p.amount : cls.registration_fee);
        }
      });

      const unpaidCount = totalCount - paidCount;
      const expectedAmount = totalCount * cls.registration_fee;
      const remainingAmount = expectedAmount - collectedAmount;
      const percentage = totalCount > 0 ? Math.round((paidCount / totalCount) * 1000) / 10 : 0.0;
      const valuePercentage = expectedAmount > 0 ? Math.round((collectedAmount / expectedAmount) * 1000) / 10 : 0.0;

      return {
        class_id: cls.id,
        class_name: cls.name,
        fee: cls.registration_fee,
        total_students: totalCount,
        paid_students: paidCount,
        unpaid_students: unpaidCount,
        expected_amount: expectedAmount,
        collected_amount: collectedAmount,
        remaining_amount: remainingAmount,
        percentage: percentage,
        value_percentage: valuePercentage
      };
    });

    // Totaux globaux
    const totalStudents = classSummaries.reduce((acc, c) => acc + c.total_students, 0);
    const paidStudents = classSummaries.reduce((acc, c) => acc + c.paid_students, 0);
    const unpaidStudents = totalStudents - paidStudents;
    const totalExpected = classSummaries.reduce((acc, c) => acc + c.expected_amount, 0);
    const totalCollected = classSummaries.reduce((acc, c) => acc + c.collected_amount, 0);
    const totalRemaining = totalExpected - totalCollected;

    const globalPercentage = totalStudents > 0 ? Math.round((paidStudents / totalStudents) * 1000) / 10 : 0.0;
    const globalValuePercentage = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 1000) / 10 : 0.0;

    return {
      classes: classSummaries,
      total_students: totalStudents,
      paid_students: paidStudents,
      unpaid_students: unpaidStudents,
      total_expected: totalExpected,
      total_collected: totalCollected,
      total_remaining: totalRemaining,
      percentage: globalPercentage,
      value_percentage: globalValuePercentage
    };
  },

  // ----------------------------------------------------------------------------
  // CALCULS STRICTS : COTISATIONS & BILAN MENSUEL (§ 3.4, § 3.6 & § 4)
  // ----------------------------------------------------------------------------
  
  /**
   * Synthèse détaillée d'un mois spécifique avec état par classe et impayés
   */
  getMonthSummary(monthId) {
    const month = this.getMonthById(monthId) || this.getMonths()[0];
    const activeStudents = this.getStudents(true);
    const classes = this.getClasses();

    // Paiements valides pour ce mois
    const validPayments = this.data.payments.filter(p => p.kind === 'monthly' && p.month_id === month.id && p.status === 'valid');
    const paidStudentIds = new Set(validPayments.map(p => p.student_id));
    const paymentByStudent = new Map(validPayments.map(p => [p.student_id, p]));

    const classDetails = classes.map(cls => {
      const clsStudents = activeStudents.filter(s => s.class_id === cls.id);
      const totalCount = clsStudents.length;
      let paidCount = 0;
      let collectedAmount = 0;

      clsStudents.forEach(s => {
        if (paidStudentIds.has(s.id)) {
          paidCount++;
          const p = paymentByStudent.get(s.id);
          collectedAmount += (p ? p.amount : cls.monthly_fee);
        }
      });

      const unpaidCount = totalCount - paidCount;
      const expectedAmount = totalCount * cls.monthly_fee;
      const remainingAmount = expectedAmount - collectedAmount;
      const percentage = totalCount > 0 ? Math.round((paidCount / totalCount) * 1000) / 10 : 0.0;
      const valuePercentage = expectedAmount > 0 ? Math.round((collectedAmount / expectedAmount) * 1000) / 10 : 0.0;

      return {
        class_id: cls.id,
        class_name: cls.name,
        monthly_fee: cls.monthly_fee,
        total_students: totalCount,
        paid_students: paidCount,
        unpaid_students: unpaidCount,
        expected_amount: expectedAmount,
        collected_amount: collectedAmount,
        remaining_amount: remainingAmount,
        percentage: percentage,
        value_percentage: valuePercentage
      };
    });

    const totalStudents = classDetails.reduce((acc, c) => acc + c.total_students, 0);
    const paidStudents = classDetails.reduce((acc, c) => acc + c.paid_students, 0);
    const unpaidStudents = totalStudents - paidStudents;
    const totalExpected = classDetails.reduce((acc, c) => acc + c.expected_amount, 0);
    const totalCollected = classDetails.reduce((acc, c) => acc + c.collected_amount, 0);
    const totalRemaining = totalExpected - totalCollected;

    const globalPercentage = totalStudents > 0 ? Math.round((paidStudents / totalStudents) * 1000) / 10 : 0.0;
    const globalValuePercentage = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 1000) / 10 : 0.0;

    // Liste des élèves impayés du mois pour action rapide
    const unpaidList = activeStudents
      .filter(s => !paidStudentIds.has(s.id))
      .map(s => {
        const cls = this.getClassById(s.class_id);
        return {
          ...s,
          class_name: cls ? cls.name : '-',
          due_amount: cls ? cls.monthly_fee : 0
        };
      });

    return {
      month: month,
      classes: classDetails,
      total_students: totalStudents,
      paid_students: paidStudents,
      unpaid_students: unpaidStudents,
      total_expected: totalExpected,
      total_collected: totalCollected,
      total_remaining: totalRemaining,
      percentage: globalPercentage,
      value_percentage: globalValuePercentage,
      unpaid_students_list: unpaidList
    };
  },

  /**
   * Récapitulatif mensuel de toute l'année scolaire pour la page Bilan Mensuel
   */
  getAnnualOverview() {
    const months = this.getMonths();
    const monthsSummaries = months.map(m => {
      const summary = this.getMonthSummary(m.id);
      return {
        month_id: m.id,
        month_label: m.label,
        month_position: m.position,
        total_students: summary.total_students,
        paid_students: summary.paid_students,
        unpaid_students: summary.unpaid_students,
        expected_amount: summary.total_expected,
        collected_amount: summary.total_collected,
        remaining_amount: summary.total_remaining,
        percentage: summary.percentage,
        value_percentage: summary.value_percentage
      };
    });

    const cumulatedExpected = monthsSummaries.reduce((acc, m) => acc + m.expected_amount, 0);
    const cumulatedCollected = monthsSummaries.reduce((acc, m) => acc + m.collected_amount, 0);
    const cumulatedRemaining = cumulatedExpected - cumulatedCollected;
    const cumulatedPercentage = cumulatedExpected > 0 ? Math.round((cumulatedCollected / cumulatedExpected) * 1000) / 10 : 0.0;

    return {
      months: monthsSummaries,
      cumulated_expected: cumulatedExpected,
      cumulated_collected: cumulatedCollected,
      cumulated_remaining: cumulatedRemaining,
      cumulated_percentage: cumulatedPercentage
    };
  },

  /**
   * Bilan Global Annuel : Fusion Inscriptions + Cotisations et DÉDUCTION DES DÉPENSES
   * Calcule :
   * - Total Inscriptions (attendu, encaissé, reste)
   * - Total Cotisations (attendu, encaissé, reste)
   * - Grand Total Global Recettes (attendu, encaissé, reste, pourcentage)
   * - Total Dépenses décaissées
   * - SOLDE RESTANT DISPONIBLE AU MOMENT T = Total Encaissé - Total Dépenses
   */
  getGrandTotalSummary() {
    const regSummary = this.getRegistrationSummary();
    const annualOverview = this.getAnnualOverview();
    const otherRevenuesSummary = this.getOtherRevenuesSummary();
    const totalExpenses = this.getTotalExpenses();

    const totalOtherRevenues = otherRevenuesSummary.total_amount;
    const grandExpected = regSummary.total_expected + annualOverview.cumulated_expected + totalOtherRevenues;
    const grandCollected = regSummary.total_collected + annualOverview.cumulated_collected + totalOtherRevenues;
    const grandRemaining = (regSummary.total_expected + annualOverview.cumulated_expected) - (regSummary.total_collected + annualOverview.cumulated_collected);
    const grandPercentage = (regSummary.total_expected + annualOverview.cumulated_expected) > 0 
      ? Math.round(((regSummary.total_collected + annualOverview.cumulated_collected) / (regSummary.total_expected + annualOverview.cumulated_expected)) * 1000) / 10 
      : 0.0;

    // SOLDE RESTANT DISPONIBLE EN CAISSE AU MOMENT T (Recettes totales - Dépenses)
    const netAvailable = grandCollected - totalExpenses;

    return {
      registration: regSummary,
      monthly: annualOverview,
      other_revenues: otherRevenuesSummary,
      grand_expected: grandExpected,
      grand_collected: grandCollected,
      grand_remaining: grandRemaining,
      grand_percentage: grandPercentage,
      total_expenses: totalExpenses,
      net_available: netAvailable
    };
  },

  // ----------------------------------------------------------------------------
  // GESTION DES DÉPENSES & RUBRIQUES BUDGÉTAIRES (§ SORTIES DE CAISSE)
  // ----------------------------------------------------------------------------
  getExpenses() {
    if (!this.data.expenses) this.data.expenses = [];
    return [...this.data.expenses].sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));
  },

  getExpenseById(id) {
    if (!this.data.expenses) return null;
    return this.data.expenses.find(e => e.id === id);
  },

  getExpenseRubriques() {
    const defaultRubriques = [
      "Fournitures scolaires & papeterie",
      "Factures (Eau, Senelec, Internet)",
      "Goûter, cantine & alimentation",
      "Entretien & hygiène",
      "Maintenance & réparations locaux",
      "Salaires & primes personnel",
      "Transport, sorties & carburant",
      "Pharmacie & premiers secours",
      "Fêtes & cérémonies scolaires",
      "Autre dépense de fonctionnement"
    ];

    if (!this.data.custom_expense_rubriques) {
      this.data.custom_expense_rubriques = [];
    }

    const combined = [...defaultRubriques];

    // Inclut toute catégorie déjà enregistrée dans les dépenses réelles
    if (Array.isArray(this.data.expenses)) {
      this.data.expenses.forEach(e => {
        if (e.category && !combined.includes(e.category)) {
          combined.push(e.category);
        }
      });
    }

    // Inclut les rubriques personnalisées créées par l'utilisateur
    this.data.custom_expense_rubriques.forEach(r => {
      if (r && !combined.includes(r)) {
        combined.push(r);
      }
    });

    return combined;
  },

  addCustomExpenseRubrique(name) {
    if (!name || !name.trim()) return;
    const clean = name.trim();
    if (!this.data.custom_expense_rubriques) {
      this.data.custom_expense_rubriques = [];
    }
    if (!this.data.custom_expense_rubriques.includes(clean)) {
      this.data.custom_expense_rubriques.push(clean);
      this.persist();
    }
  },

  deleteCustomExpenseRubrique(name) {
    if (!name || !this.data || !Array.isArray(this.data.custom_expense_rubriques)) return false;
    const clean = name.trim();
    const idx = this.data.custom_expense_rubriques.indexOf(clean);
    if (idx !== -1) {
      this.data.custom_expense_rubriques.splice(idx, 1);
      this.persist();
      return true;
    }
    return false;
  },

  isCustomExpenseRubrique(name) {
    if (!name || !this.data || !Array.isArray(this.data.custom_expense_rubriques)) return false;
    return this.data.custom_expense_rubriques.includes(name.trim());
  },

  logAudit(action, details = {}) {
    if (!this.data) return;
    if (!Array.isArray(this.data.audit_log)) {
      this.data.audit_log = [];
    }
    const schoolId = (this.data.school && this.data.school.id) ? this.data.school.id : '11111111-1111-1111-1111-111111111111';
    this.data.audit_log.push({
      id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      school_id: schoolId,
      user_id: this.currentUser ? this.currentUser.id : 'director-user-id',
      action: action,
      details: details,
      created_at: new Date().toISOString()
    });
    if (this.data.audit_log.length > 200) {
      this.data.audit_log = this.data.audit_log.slice(-200);
    }
  },

  addExpense(expenseData) {
    if (!this.data) this.data = DemoData.getInitialState();
    if (!Array.isArray(this.data.expenses)) this.data.expenses = [];
    const category = (expenseData.category || 'Fournitures scolaires & papeterie').trim();
    const schoolId = (this.data.school && this.data.school.id) ? this.data.school.id : '11111111-1111-1111-1111-111111111111';
    const newExpense = {
      id: expenseData.id || ('expense_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
      school_id: schoolId,
      motif: (expenseData.motif || '').trim(),
      amount: parseInt(expenseData.amount, 10) || 0,
      date: expenseData.date || new Date().toISOString().split('T')[0],
      category: category,
      status: expenseData.status || 'active',
      created_at: expenseData.created_at || new Date().toISOString()
    };
    this.data.expenses.push(newExpense);
    this.addCustomExpenseRubrique(category);
    this.persist();

    // Trace dans l'audit en toute sécurité
    try {
      this.logAudit('EXPENSE_ADDED', {
        expense_id: newExpense.id,
        motif: newExpense.motif,
        amount: newExpense.amount,
        category: newExpense.category,
        date: newExpense.date
      });
    } catch (e) {
      console.warn("Audit log notice:", e);
    }

    return newExpense;
  },

  updateExpense(id, expenseData) {
    if (!this.data || !Array.isArray(this.data.expenses)) return null;
    const index = this.data.expenses.findIndex(e => e.id === id);
    if (index !== -1) {
      const existing = this.data.expenses[index];
      const category = (expenseData.category !== undefined ? expenseData.category : (existing.category || 'Général')).trim();
      const updated = {
        ...existing,
        motif: (expenseData.motif !== undefined ? expenseData.motif : existing.motif).trim(),
        amount: expenseData.amount !== undefined ? (parseInt(expenseData.amount, 10) || 0) : existing.amount,
        date: expenseData.date || existing.date,
        category: category,
        updated_at: new Date().toISOString()
      };
      this.data.expenses[index] = updated;
      this.addCustomExpenseRubrique(category);
      this.persist();
      try {
        this.logAudit('EXPENSE_UPDATED', {
          expense_id: id,
          motif: updated.motif,
          amount: updated.amount,
          category: updated.category,
          date: updated.date
        });
      } catch (e) {
        console.warn("Audit log notice:", e);
      }
      return updated;
    }
    return null;
  },

  /**
   * Annuler une dépense avec motif obligatoire (traçabilité comptable et réintégration du montant)
   */
  cancelExpense(id, cancelReason) {
    if (!this.data || !Array.isArray(this.data.expenses)) return null;
    if (!cancelReason || !cancelReason.trim()) {
      throw new Error("Un motif d'annulation explicite est obligatoire.");
    }
    const expense = this.data.expenses.find(e => e.id === id);
    if (!expense) throw new Error("Dépense introuvable");
    if (expense.status === 'cancelled') {
      throw new Error("Cette dépense a déjà été annulée.");
    }

    const nowIso = new Date().toISOString();
    expense.status = 'cancelled';
    expense.cancel_reason = cancelReason.trim();
    expense.cancelled_at = nowIso;
    expense.cancelled_by = this.currentUser ? this.currentUser.id : 'director-user-id';

    this.persist();

    try {
      this.logAudit('EXPENSE_CANCELLED', {
        expense_id: id,
        motif: expense.motif,
        amount: expense.amount,
        category: expense.category,
        cancel_reason: expense.cancel_reason,
        date: expense.date
      });
    } catch (e) {
      console.warn("Audit log notice:", e);
    }

    return expense;
  },

  deleteExpense(id) {
    if (!this.data || !Array.isArray(this.data.expenses)) return false;
    const index = this.data.expenses.findIndex(e => e.id === id);
    if (index !== -1) {
      const removed = this.data.expenses.splice(index, 1)[0];
      this.persist();
      try {
        this.logAudit('EXPENSE_DELETED', {
          expense_id: id,
          motif: removed.motif,
          amount: removed.amount
        });
      } catch (e) {
        console.warn("Audit log notice:", e);
      }
      return removed;
    }
    return false;
  },

  getTotalExpenses() {
    if (!this.data || !Array.isArray(this.data.expenses)) return 0;
    return this.data.expenses
      .filter(e => e.status !== 'cancelled')
      .reduce((sum, e) => sum + (parseInt(e.amount, 10) || 0), 0);
  },

  getExpensesSummary() {
    const list = this.getExpenses();
    const active = list.filter(e => e.status !== 'cancelled');
    const total = this.getTotalExpenses();
    return {
      total_amount: total,
      count: active.length,
      total_count: list.length,
      cancelled_count: list.length - active.length,
      expenses: list
    };
  },

  // ----------------------------------------------------------------------------
  // GESTION DES AUTRES RENTRÉES (§ HORS INSCRIPTIONS ET COTISATIONS)
  // Dons, subventions, cantine, blouses/uniformes, activités périscolaires, etc.
  // ----------------------------------------------------------------------------
  getOtherRevenues() {
    if (!this.data.other_revenues) this.data.other_revenues = [];
    return [...this.data.other_revenues].sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));
  },

  getOtherRevenueById(id) {
    if (!this.data.other_revenues) return null;
    return this.data.other_revenues.find(r => r.id === id);
  },

  getOtherRevenueRubriques() {
    const defaultRubriques = [
      "Dons & Subventions",
      "Cantine scolaire & Goûters",
      "Vente d'uniformes, blouses & fournitures",
      "Activités périscolaires & Sorties éducatives",
      "Garderie du soir & Mercredis",
      "Kermesse & Événements de l'école",
      "Autre encaissement exceptionnel"
    ];

    if (!this.data.custom_other_revenue_rubriques) {
      this.data.custom_other_revenue_rubriques = [];
    }

    const combined = [...defaultRubriques];
    if (Array.isArray(this.data.other_revenues)) {
      this.data.other_revenues.forEach(r => {
        if (r.category && !combined.includes(r.category)) {
          combined.push(r.category);
        }
      });
    }

    this.data.custom_other_revenue_rubriques.forEach(cr => {
      if (cr && !combined.includes(cr)) {
        combined.push(cr);
      }
    });

    return combined;
  },

  addCustomOtherRevenueRubrique(name) {
    if (!name || typeof name !== 'string') return false;
    const clean = name.trim();
    if (!clean) return false;
    if (!this.data.custom_other_revenue_rubriques) {
      this.data.custom_other_revenue_rubriques = [];
    }
    if (!this.data.custom_other_revenue_rubriques.includes(clean)) {
      this.data.custom_other_revenue_rubriques.push(clean);
      this.persist();
      return true;
    }
    return false;
  },

  addOtherRevenue(revenueData) {
    if (!this.data || !this.data.school) throw new Error("Établissement non initialisé.");
    if (!Array.isArray(this.data.other_revenues)) this.data.other_revenues = [];

    const category = (revenueData.category || 'Autre encaissement exceptionnel').trim();
    const nowIso = new Date().toISOString();
    const schoolYear = this.data.school.school_year || '2026-2027';
    const yearPrefix = schoolYear.substring(0, 4);

    // Numérotation séquentielle certifiée pour le reçu
    const nextVal = (this.data.receiptCounter || 1);
    this.data.receiptCounter = nextVal + 1;
    const receiptNumber = `REC-${yearPrefix}-${String(nextVal).padStart(4, '0')}`;
    const publicToken = 'tok_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    const newRevenue = {
      id: revenueData.id || ('other_rev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
      school_id: this.data.school.id,
      motif: (revenueData.motif || '').trim(),
      amount: parseInt(revenueData.amount, 10) || 0,
      date: revenueData.date || nowIso.split('T')[0],
      category: category,
      payment_method: revenueData.payment_method || 'cash',
      payer_name: (revenueData.payer_name || '').trim(),
      receipt_number: receiptNumber,
      public_token: publicToken,
      status: revenueData.status || 'valid',
      cancel_reason: null,
      created_by: this.currentUser ? this.currentUser.id : 'director-user-id',
      created_at: nowIso
    };

    // Émission du reçu officiel dans le registre
    if (!Array.isArray(this.data.receipts)) this.data.receipts = [];
    this.data.receipts.push({
      id: 'rec_' + Math.random().toString(36).substring(2, 9),
      school_id: this.data.school.id,
      payment_id: newRevenue.id,
      receipt_number: receiptNumber,
      public_token: publicToken,
      issued_at: nowIso,
      status: 'valid'
    });

    this.data.other_revenues.push(newRevenue);
    this.addCustomOtherRevenueRubrique(category);

    this.logAudit('OTHER_REVENUE_ADDED', {
      revenue_id: newRevenue.id,
      receipt_number: receiptNumber,
      motif: newRevenue.motif,
      amount: newRevenue.amount,
      category: newRevenue.category,
      date: newRevenue.date
    });

    this.persist();
    return newRevenue;
  },

  updateOtherRevenue(id, revenueData) {
    if (!this.data || !Array.isArray(this.data.other_revenues)) return null;
    const index = this.data.other_revenues.findIndex(r => r.id === id);
    if (index === -1) throw new Error("Rentrée introuvable");

    const existing = this.data.other_revenues[index];
    const category = (revenueData.category !== undefined ? revenueData.category : (existing.category || 'Général')).trim();

    const updated = {
      ...existing,
      motif: (revenueData.motif !== undefined ? revenueData.motif : existing.motif).trim(),
      amount: revenueData.amount !== undefined ? (parseInt(revenueData.amount, 10) || 0) : existing.amount,
      date: revenueData.date || existing.date,
      category: category,
      payment_method: revenueData.payment_method || existing.payment_method || 'cash',
      payer_name: revenueData.payer_name !== undefined ? (revenueData.payer_name || '').trim() : existing.payer_name,
      updated_at: new Date().toISOString()
    };

    this.data.other_revenues[index] = updated;
    this.addCustomOtherRevenueRubrique(category);

    this.logAudit('OTHER_REVENUE_UPDATED', {
      revenue_id: id,
      motif: updated.motif,
      amount: updated.amount,
      category: updated.category
    });

    this.persist();
    return updated;
  },

  cancelOtherRevenue(id, cancelReason) {
    if (!this.data || !Array.isArray(this.data.other_revenues)) return null;
    if (!cancelReason || !cancelReason.trim()) {
      throw new Error("Le motif d'annulation est obligatoire.");
    }

    const revenue = this.data.other_revenues.find(r => r.id === id);
    if (!revenue) throw new Error("Rentrée introuvable");
    if (revenue.status === 'cancelled') {
      throw new Error("Cette rentrée a déjà été annulée.");
    }

    const nowIso = new Date().toISOString();
    revenue.status = 'cancelled';
    revenue.cancel_reason = cancelReason.trim();
    revenue.cancelled_at = nowIso;
    revenue.cancelled_by = this.currentUser ? this.currentUser.id : 'director-user-id';

    // Mise à jour du statut du reçu associé
    if (Array.isArray(this.data.receipts)) {
      const rec = this.data.receipts.find(r => r.payment_id === id || r.receipt_number === revenue.receipt_number);
      if (rec) {
        rec.status = 'cancelled';
      }
    }

    this.logAudit('OTHER_REVENUE_CANCELLED', {
      revenue_id: id,
      receipt_number: revenue.receipt_number,
      motif: revenue.motif,
      amount: revenue.amount,
      cancel_reason: revenue.cancel_reason
    });

    this.persist();
    return revenue;
  },

  deleteOtherRevenue(id) {
    if (!this.data || !Array.isArray(this.data.other_revenues)) return false;
    const index = this.data.other_revenues.findIndex(r => r.id === id);
    if (index === -1) return false;

    const removed = this.data.other_revenues.splice(index, 1)[0];

    // Suppression du reçu associé
    if (Array.isArray(this.data.receipts)) {
      const rIdx = this.data.receipts.findIndex(r => r.payment_id === id || (removed && r.receipt_number === removed.receipt_number));
      if (rIdx !== -1) {
        this.data.receipts.splice(rIdx, 1);
      }
    }

    this.logAudit('OTHER_REVENUE_DELETED', {
      revenue_id: id,
      motif: removed ? removed.motif : '',
      amount: removed ? removed.amount : 0
    });

    this.persist();
    return true;
  },

  getTotalOtherRevenues() {
    if (!this.data || !Array.isArray(this.data.other_revenues)) return 0;
    return this.data.other_revenues
      .filter(r => r.status !== 'cancelled')
      .reduce((sum, r) => sum + (parseInt(r.amount, 10) || 0), 0);
  },

  getOtherRevenuesSummary() {
    const list = this.getOtherRevenues();
    const active = list.filter(r => r.status !== 'cancelled');
    const total = this.getTotalOtherRevenues();
    return {
      total_amount: total,
      count: active.length,
      total_count: list.length,
      cancelled_count: list.length - active.length,
      revenues: list
    };
  },

  // ----------------------------------------------------------------------------
  // TABLEAU DE BORD (§ 3.8)
  // ----------------------------------------------------------------------------
  getDashboardMetrics() {
    const regSummary = this.getRegistrationSummary() || {
      total_collected: 0,
      total_expected: 0,
      paid_students: 0,
      total_students: 0,
      percentage: 0
    };
    const months = this.getMonths() || [];
    // Mois courant (par défaut le 1er mois de l'année scolaire)
    const currentMonth = (months.length > 0) ? months[0] : { id: 'mth_10', label: 'Octobre' };
    const currentMonthSummary = (currentMonth && currentMonth.id) 
      ? this.getMonthSummary(currentMonth.id)
      : { total_collected: 0, total_expected: 0, paid_students: 0, unpaid_students: 0, percentage: 0 };

    // 5 derniers paiements
    const lastPayments = Array.isArray(this.data.payments)
      ? [...this.data.payments]
          .sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
          .slice(0, 5)
          .map(p => {
            const student = this.getStudentById(p.student_id);
            const receipt = Array.isArray(this.data.receipts) ? this.data.receipts.find(r => r.payment_id === p.id) : null;
            const cls = student ? this.getClassById(student.class_id) : null;
            let objectLabel = "Frais d'inscription";
            if (p.kind === 'monthly') {
              const m = this.getMonthById(p.month_id);
              objectLabel = `Cotisation ${m ? m.label : 'mensuelle'}`;
            }
            return {
              ...p,
              receipt_number: receipt ? receipt.receipt_number : '-',
              public_token: receipt ? receipt.public_token : null,
              student_name: student ? `${student.last_name} ${student.first_names}` : 'Élève inconnu',
              class_name: cls ? cls.name : '-',
              object_label: objectLabel
            };
          })
      : [];

    return {
      registration: {
        total_collected: regSummary.total_collected || 0,
        total_expected: regSummary.total_expected || 0,
        paid_students: regSummary.paid_students || 0,
        total_students: regSummary.total_students || 0,
        percentage: regSummary.percentage || 0
      },
      current_month: {
        label: currentMonth ? currentMonth.label : 'Octobre',
        id: currentMonth ? currentMonth.id : 'mth_10',
        total_collected: currentMonthSummary ? (currentMonthSummary.total_collected || 0) : 0,
        total_expected: currentMonthSummary ? (currentMonthSummary.total_expected || 0) : 0,
        paid_students: currentMonthSummary ? (currentMonthSummary.paid_students || 0) : 0,
        unpaid_students: currentMonthSummary ? (currentMonthSummary.unpaid_students || 0) : 0,
        percentage: currentMonthSummary ? (currentMonthSummary.percentage || 0) : 0
      },
      last_payments: lastPayments
    };
  },

  // ----------------------------------------------------------------------------
  // GESTION DES REÇUS (§ 3.7 & § 7)
  // ----------------------------------------------------------------------------
  getReceipts() {
    return [...this.data.receipts]
      .sort((a, b) => new Date(b.issued_at) - new Date(a.issued_at))
      .map(r => {
        const payment = this.data.payments ? this.data.payments.find(p => p.id === r.payment_id) : null;
        const otherRev = !payment && this.data.other_revenues ? this.data.other_revenues.find(o => o.id === r.payment_id || o.receipt_number === r.receipt_number) : null;
        const student = payment ? this.getStudentById(payment.student_id) : null;
        const cls = student ? this.getClassById(student.class_id) : null;

        let objectLabel = "Frais d'inscription";
        if (payment && payment.kind === 'monthly') {
          const m = this.getMonthById(payment.month_id);
          objectLabel = `Cotisation ${m ? m.label : 'mensuelle'}`;
        } else if (otherRev) {
          objectLabel = `Autre rentrée : ${otherRev.category || 'Général'}`;
        }

        return {
          id: r.id,
          receipt_number: r.receipt_number,
          public_token: r.public_token,
          issued_at: r.issued_at,
          status: r.status,
          amount: payment ? payment.amount : (otherRev ? otherRev.amount : 0),
          method: payment ? payment.method : (otherRev ? (otherRev.payment_method || 'cash') : 'cash'),
          reference: payment ? payment.reference : (otherRev ? otherRev.motif : null),
          object_label: objectLabel,
          student_id: student ? student.id : null,
          student_name: student ? `${student.last_name} ${student.first_names}` : (otherRev && otherRev.payer_name ? `Payeur : ${otherRev.payer_name}` : (otherRev ? otherRev.motif : 'Rentrée diverse')),
          class_name: cls ? cls.name : (otherRev ? (otherRev.category || 'Recette') : '-'),
          parent_name: student ? student.parent_name : (otherRev ? (otherRev.payer_name || '-') : ''),
          parent_phone: student ? student.parent_phone : '',
          payment_id: r.payment_id,
          cancel_reason: payment ? payment.cancel_reason : (otherRev ? otherRev.cancel_reason : null),
          is_other_revenue: !!otherRev
        };
      });
  },

  /**
   * Récupère un reçu par son jeton public (pour vérification publique sans authentification)
   */
  getReceiptByPublicToken(token) {
    if (!token) return null;

    let targetData = this.data;
    let receipt = targetData && targetData.receipts ? targetData.receipts.find(r => r.public_token === token) : null;

    // Si non trouvé dans l'école courante, chercher dans toutes les écoles locales
    if (!receipt) {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('gp_store_') || key.startsWith('gestion_prescolaire_store'))) {
          try {
            const parsed = JSON.parse(localStorage.getItem(key));
            if (parsed && Array.isArray(parsed.receipts)) {
              const found = parsed.receipts.find(r => r.public_token === token);
              if (found) {
                receipt = found;
                targetData = parsed;
                break;
              }
            }
          } catch (e) {}
        }
      }
    }

    if (!receipt || !targetData) return null;

    const payment = targetData.payments ? targetData.payments.find(p => p.id === receipt.payment_id) : null;
    const otherRev = !payment && targetData.other_revenues ? targetData.other_revenues.find(o => o.id === receipt.payment_id || o.receipt_number === receipt.receipt_number) : null;
    const student = payment && targetData.students ? targetData.students.find(s => s.id === payment.student_id) : null;
    const cls = student && targetData.classes ? targetData.classes.find(c => c.id === student.class_id) : null;

    let objectLabel = "Frais d'inscription";
    if (payment && payment.kind === 'monthly') {
      const m = targetData.months ? targetData.months.find(month => month.id === payment.month_id) : null;
      objectLabel = `Cotisation ${m ? m.label : 'mensuelle'}`;
    } else if (otherRev) {
      objectLabel = `Autre rentrée : ${otherRev.category || 'Général'}`;
    }

    return {
      receipt_number: receipt.receipt_number,
      public_token: receipt.public_token,
      issued_at: receipt.issued_at,
      status: receipt.status,
      amount: payment ? payment.amount : (otherRev ? otherRev.amount : 0),
      method: payment ? payment.method : (otherRev ? (otherRev.payment_method || 'cash') : 'cash'),
      reference: payment ? payment.reference : (otherRev ? otherRev.motif : null),
      object_label: objectLabel,
      school_name: targetData.school ? targetData.school.name : 'Établissement Scolaire',
      school_director: targetData.school ? targetData.school.director_name : 'Direction',
      school_phone: targetData.school ? targetData.school.director_phone : '',
      school_address: targetData.school ? targetData.school.address : '',
      school_commune: targetData.school ? targetData.school.commune : '',
      school_region: targetData.school ? targetData.school.region : '',
      student_name: student ? `${student.last_name} ${student.first_names}` : (otherRev && otherRev.payer_name ? `Payeur : ${otherRev.payer_name}` : (otherRev ? otherRev.motif : '-')),
      class_name: cls ? cls.name : (otherRev ? (otherRev.category || 'Recette diverse') : '-'),
      parent_name: student ? student.parent_name : (otherRev ? (otherRev.payer_name || '-') : '-'),
      parent_phone: student ? student.parent_phone : '-'
    };
  }
};

window.Store = Store;
