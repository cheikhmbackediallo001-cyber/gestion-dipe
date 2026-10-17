/**
 * JEU DE DONNÉES DE DÉMONSTRATION (FIXTURES LOCALES / DÉMO INSTANTANÉE)
 * Conforme à la spécification § 10 :
 * - 1 école fictive : École Maternelle Les Papillons
 * - Directrice : Mme Aïssatou Ba, +221 77 543 21 00, Dakar-Plateau
 * - 3 classes : Petite section (25 000 / 15 000), Moyenne section (25 000 / 15 000), Grande section (30 000 / 18 000)
 * - 30 élèves réels avec parents et téléphones sénégalais
 * - Paiements d'inscriptions et cotisations d'Octobre/Novembre
 * - Reçus numérotés et jetons publics
 */

const DemoData = {
  getInitialState() {
    const schoolId = '11111111-1111-1111-1111-111111111111';
    const schoolYear = '2026-2027';

    const school = {
      id: schoolId,
      name: "École Maternelle Les Papillons",
      director_name: "Mme Aïssatou Ba",
      director_phone: "+221 77 543 21 00",
      address: "12 Rue Félix Faure, Dakar-Plateau",
      region: "Dakar",
      department: "Dakar",
      commune: "Plateau",
      logo_url: null,
      stamp_color: "#DC2626",
      school_year: schoolYear,
      status: "active",
      created_at: "2026-09-01T08:00:00Z"
    };

    const classes = [
      { id: '22222222-0000-1111-1111-111111111111', school_id: schoolId, name: 'Crèche (2 ans)', registration_fee: 25000, monthly_fee: 15000, position: 1 },
      { id: '22222222-1111-1111-1111-111111111111', school_id: schoolId, name: 'Petite section', registration_fee: 25000, monthly_fee: 15000, position: 2 },
      { id: '22222222-2222-1111-1111-111111111111', school_id: schoolId, name: 'Moyenne section', registration_fee: 25000, monthly_fee: 15000, position: 3 },
      { id: '22222222-3333-1111-1111-111111111111', school_id: schoolId, name: 'Grande section', registration_fee: 30000, monthly_fee: 18000, position: 4 }
    ];

    const months = [
      { id: '33333333-1000-1111-1111-111111111111', school_id: schoolId, school_year: schoolYear, month_number: 10, label: 'Octobre', position: 1 },
      { id: '33333333-1100-1111-1111-111111111111', school_id: schoolId, school_year: schoolYear, month_number: 11, label: 'Novembre', position: 2 },
      { id: '33333333-1200-1111-1111-111111111111', school_id: schoolId, school_year: schoolYear, month_number: 12, label: 'Décembre', position: 3 },
      { id: '33333333-0100-1111-1111-111111111111', school_id: schoolId, school_year: schoolYear, month_number: 1,  label: 'Janvier', position: 4 },
      { id: '33333333-0200-1111-1111-111111111111', school_id: schoolId, school_year: schoolYear, month_number: 2,  label: 'Février', position: 5 },
      { id: '33333333-0300-1111-1111-111111111111', school_id: schoolId, school_year: schoolYear, month_number: 3,  label: 'Mars', position: 6 },
      { id: '33333333-0400-1111-1111-111111111111', school_id: schoolId, school_year: schoolYear, month_number: 4,  label: 'Avril', position: 7 },
      { id: '33333333-0500-1111-1111-111111111111', school_id: schoolId, school_year: schoolYear, month_number: 5,  label: 'Mai', position: 8 },
      { id: '33333333-0600-1111-1111-111111111111', school_id: schoolId, school_year: schoolYear, month_number: 6,  label: 'Juin', position: 9 }
    ];

    const students = [
      // Crèche (2 ans) (4 enfants)
      { id: '44444444-0031-1111-1111-111111111111', school_id: schoolId, class_id: classes[0].id, last_name: 'SARR', first_names: 'Ousmane', gender: 'M', birth_date: '2024-02-15', parent_name: 'Pape Sarr', parent_phone: '+221 77 112 33 44', active: true },
      { id: '44444444-0032-1111-1111-111111111111', school_id: schoolId, class_id: classes[0].id, last_name: 'DIALLO', first_names: 'Khady', gender: 'F', birth_date: '2024-05-10', parent_name: 'Mariama Diallo', parent_phone: '+221 78 223 44 55', active: true },
      { id: '44444444-0033-1111-1111-111111111111', school_id: schoolId, class_id: classes[0].id, last_name: 'FAYE', first_names: 'Abdou', gender: 'M', birth_date: '2024-03-22', parent_name: 'Ibrahima Faye', parent_phone: '+221 76 334 55 66', active: true },
      { id: '44444444-0034-1111-1111-111111111111', school_id: schoolId, class_id: classes[0].id, last_name: 'NDIAYE', first_names: 'Awa', gender: 'F', birth_date: '2024-08-18', parent_name: 'Babacar Ndiaye', parent_phone: '+221 70 445 66 77', active: true },

      // Petite section (10 élèves)
      { id: '44444444-0001-1111-1111-111111111111', school_id: schoolId, class_id: classes[1].id, last_name: 'DIOP', first_names: 'Mamadou', gender: 'M', birth_date: '2023-03-12', parent_name: 'Ousmane Diop', parent_phone: '+221 77 123 45 67', active: true },
      { id: '44444444-0002-1111-1111-111111111111', school_id: schoolId, class_id: classes[1].id, last_name: 'SOW', first_names: 'Fatou', gender: 'F', birth_date: '2023-05-24', parent_name: 'Ibrahima Sow', parent_phone: '+221 78 234 56 78', active: true },
      { id: '44444444-0003-1111-1111-111111111111', school_id: schoolId, class_id: classes[1].id, last_name: 'NDIAYE', first_names: 'Cheikh Tidiane', gender: 'M', birth_date: '2023-01-15', parent_name: 'Mariama Diallo', parent_phone: '+221 76 345 67 89', active: true },
      { id: '44444444-0004-1111-1111-111111111111', school_id: schoolId, class_id: classes[1].id, last_name: 'FALL', first_names: 'Aminata', gender: 'F', birth_date: '2023-07-09', parent_name: 'Abdoulaye Fall', parent_phone: '+221 70 456 78 90', active: true },
      { id: '44444444-0005-1111-1111-111111111111', school_id: schoolId, class_id: classes[1].id, last_name: 'GUEYE', first_names: 'Babacar', gender: 'M', birth_date: '2023-04-18', parent_name: 'Khadija Seck', parent_phone: '+221 77 567 89 01', active: true },
      { id: '44444444-0006-1111-1111-111111111111', school_id: schoolId, class_id: classes[1].id, last_name: 'BA', first_names: 'Seynabou', gender: 'F', birth_date: '2023-08-30', parent_name: 'Amadou Ba', parent_phone: '+221 78 678 90 12', active: true },
      { id: '44444444-0007-1111-1111-111111111111', school_id: schoolId, class_id: classes[1].id, last_name: 'CISSE', first_names: 'Mouhamed', gender: 'M', birth_date: '2023-02-14', parent_name: 'Fatimata Cisse', parent_phone: '+221 76 789 01 23', active: true },
      { id: '44444444-0008-1111-1111-111111111111', school_id: schoolId, class_id: classes[1].id, last_name: 'TOURE', first_names: 'Aïda', gender: 'F', birth_date: '2023-06-05', parent_name: 'Moustapha Toure', parent_phone: '+221 77 890 12 34', active: true },
      { id: '44444444-0009-1111-1111-111111111111', school_id: schoolId, class_id: classes[1].id, last_name: 'DIENG', first_names: 'El Hadji Malick', gender: 'M', birth_date: '2023-09-19', parent_name: 'Ndeye Dieng', parent_phone: '+221 70 901 23 45', active: true },
      { id: '44444444-0010-1111-1111-111111111111', school_id: schoolId, class_id: classes[1].id, last_name: 'SY', first_names: 'Mariama', gender: 'F', birth_date: '2023-11-02', parent_name: 'Mansour Sy', parent_phone: '+221 78 012 34 56', active: true },

      // Moyenne section (10 élèves)
      { id: '44444444-0011-1111-1111-111111111111', school_id: schoolId, class_id: classes[2].id, last_name: 'DIAGNE', first_names: 'Ibrahima', gender: 'M', birth_date: '2022-02-10', parent_name: 'Souleymane Diagne', parent_phone: '+221 77 111 22 33', active: true },
      { id: '44444444-0012-1111-1111-111111111111', school_id: schoolId, class_id: classes[2].id, last_name: 'KANE', first_names: 'Khadidiatou', gender: 'F', birth_date: '2022-04-14', parent_name: 'Oumar Kane', parent_phone: '+221 78 222 33 44', active: true },
      { id: '44444444-0013-1111-1111-111111111111', school_id: schoolId, class_id: classes[2].id, last_name: 'SECK', first_names: 'Pape Alassane', gender: 'M', birth_date: '2022-06-21', parent_name: 'Awa Seck', parent_phone: '+221 76 333 44 55', active: true },
      { id: '44444444-0014-1111-1111-111111111111', school_id: schoolId, class_id: classes[2].id, last_name: 'MBAYE', first_names: 'Rokhaya', gender: 'F', birth_date: '2022-01-29', parent_name: 'Modou Mbaye', parent_phone: '+221 70 444 55 66', active: true },
      { id: '44444444-0015-1111-1111-111111111111', school_id: schoolId, class_id: classes[2].id, last_name: 'THIAM', first_names: 'Alioune Badara', gender: 'M', birth_date: '2022-08-11', parent_name: 'Astou Thiam', parent_phone: '+221 77 555 66 77', active: true },
      { id: '44444444-0016-1111-1111-111111111111', school_id: schoolId, class_id: classes[2].id, last_name: 'TALL', first_names: 'Dieynaba', gender: 'F', birth_date: '2022-05-17', parent_name: 'Cheikh Tall', parent_phone: '+221 78 666 77 88', active: true },
      { id: '44444444-0017-1111-1111-111111111111', school_id: schoolId, class_id: classes[2].id, last_name: 'FAYE', first_names: 'Serigne Fallou', gender: 'M', birth_date: '2022-09-03', parent_name: 'Bamba Faye', parent_phone: '+221 76 777 88 99', active: true },
      { id: '44444444-0018-1111-1111-111111111111', school_id: schoolId, class_id: classes[2].id, last_name: 'WANE', first_names: 'Fama', gender: 'F', birth_date: '2022-03-25', parent_name: 'Hamidou Wane', parent_phone: '+221 77 888 99 00', active: true },
      { id: '44444444-0019-1111-1111-111111111111', school_id: schoolId, class_id: classes[2].id, last_name: 'LY', first_names: 'Moussa', gender: 'M', birth_date: '2022-07-08', parent_name: 'Thierno Ly', parent_phone: '+221 70 999 00 11', active: true },
      { id: '44444444-0020-1111-1111-111111111111', school_id: schoolId, class_id: classes[2].id, last_name: 'SARR', first_names: 'Anta', gender: 'F', birth_date: '2022-10-31', parent_name: 'Maguette Sarr', parent_phone: '+221 78 120 34 56', active: true },

      // Grande section (10 élèves)
      { id: '44444444-0021-1111-1111-111111111111', school_id: schoolId, class_id: classes[3].id, last_name: 'NDOYE', first_names: 'Assane', gender: 'M', birth_date: '2021-01-19', parent_name: 'Lamine Ndoye', parent_phone: '+221 77 231 45 67', active: true },
      { id: '44444444-0022-1111-1111-111111111111', school_id: schoolId, class_id: classes[3].id, last_name: 'LO', first_names: 'Coumba', gender: 'F', birth_date: '2021-03-28', parent_name: 'Mor Lo', parent_phone: '+221 78 342 56 78', active: true },
      { id: '44444444-0023-1111-1111-111111111111', school_id: schoolId, class_id: classes[3].id, last_name: 'SAMB', first_names: 'Djibril', gender: 'M', birth_date: '2021-06-15', parent_name: 'Nafi Samb', parent_phone: '+221 76 453 67 89', active: true },
      { id: '44444444-0024-1111-1111-111111111111', school_id: schoolId, class_id: classes[3].id, last_name: 'NIANG', first_names: 'Mame Diarra', gender: 'F', birth_date: '2021-05-04', parent_name: 'Babacar Niang', parent_phone: '+221 70 564 78 90', active: true },
      { id: '44444444-0025-1111-1111-111111111111', school_id: schoolId, class_id: classes[3].id, last_name: 'DIALLO', first_names: 'Abdoulaye', gender: 'M', birth_date: '2021-09-12', parent_name: 'Mamadou Diallo', parent_phone: '+221 77 675 89 01', active: true },
      { id: '44444444-0026-1111-1111-111111111111', school_id: schoolId, class_id: classes[3].id, last_name: 'BARRY', first_names: 'Kadiatou', gender: 'F', birth_date: '2021-02-22', parent_name: 'Alpha Barry', parent_phone: '+221 78 786 90 12', active: true },
      { id: '44444444-0027-1111-1111-111111111111', school_id: schoolId, class_id: classes[3].id, last_name: 'TRAORE', first_names: 'Samba', gender: 'M', birth_date: '2021-08-07', parent_name: 'Adama Traore', parent_phone: '+221 76 897 01 23', active: true },
      { id: '44444444-0028-1111-1111-111111111111', school_id: schoolId, class_id: classes[3].id, last_name: 'CAMARA', first_names: 'Binta', gender: 'F', birth_date: '2021-11-14', parent_name: 'Sekou Camara', parent_phone: '+221 77 908 12 34', active: true },
      { id: '44444444-0029-1111-1111-111111111111', school_id: schoolId, class_id: classes[3].id, last_name: 'MANE', first_names: 'Lamine', gender: 'M', birth_date: '2021-04-09', parent_name: 'Ansoumane Mane', parent_phone: '+221 70 019 23 45', active: true },
      { id: '44444444-0030-1111-1111-111111111111', school_id: schoolId, class_id: classes[3].id, last_name: 'SANE', first_names: 'Aïssatou', gender: 'F', birth_date: '2021-07-26', parent_name: 'Boubacar Sane', parent_phone: '+221 78 130 34 56', active: true }
    ];

    const payments = [];
    const receipts = [];
    let receiptCounter = 1;

    // Helper pour créer un paiement et un reçu
    function addPaymentAndReceipt(student, kind, monthId, amount, method, ref, daysAgo, status = 'valid', cancelReason = null) {
      const pId = '55555555-' + String(receiptCounter).padStart(4, '0') + '-1111-1111-111111111111';
      const paidDate = new Date();
      paidDate.setDate(paidDate.getDate() - daysAgo);
      const paidAtIso = paidDate.toISOString();

      const payment = {
        id: pId,
        school_id: schoolId,
        student_id: student.id,
        kind: kind,
        month_id: monthId,
        amount: amount,
        method: method,
        reference: ref,
        paid_at: paidAtIso,
        status: status,
        cancel_reason: cancelReason,
        created_by: 'director-user-id'
      };
      payments.push(payment);

      const rNum = `REC-2026-${String(receiptCounter).padStart(4, '0')}`;
      const token = 'token_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      const receipt = {
        id: '66666666-' + String(receiptCounter).padStart(4, '0') + '-1111-1111-111111111111',
        school_id: schoolId,
        payment_id: pId,
        receipt_number: rNum,
        public_token: token,
        issued_at: paidAtIso,
        status: status
      };
      receipts.push(receipt);
      receiptCounter++;
    }

    // 1. Inscriptions :
    // Crèche (3 payés sur 4)
    addPaymentAndReceipt(students[0], 'registration', null, 25000, 'wave', 'WAV-CR-01', 22);
    addPaymentAndReceipt(students[1], 'registration', null, 25000, 'orange_money', 'OM-CR-02', 21);
    addPaymentAndReceipt(students[2], 'registration', null, 25000, 'cash', null, 19);

    // Petite Section (7 payés sur 10 : index 4 à 10)
    for (let i = 4; i < 11; i++) {
      addPaymentAndReceipt(students[i], 'registration', null, 25000, i % 2 === 0 ? 'wave' : 'cash', 'WAV-' + (98000 + i), 20 - (i - 4));
    }
    // Moyenne Section (8 payés sur 10 : index 14 à 21)
    for (let i = 14; i < 22; i++) {
      addPaymentAndReceipt(students[i], 'registration', null, 25000, i % 2 === 0 ? 'orange_money' : 'cash', 'OM-' + (45000 + i), 18 - (i - 14));
    }
    // Grande Section (7 payés sur 10 : index 24 à 30)
    for (let i = 24; i < 31; i++) {
      addPaymentAndReceipt(students[i], 'registration', null, 30000, 'wave', 'WAV-' + (77000 + i), 15 - (i - 24));
    }

    // 2. Cotisations Octobre :
    const octId = months[0].id;
    // Crèche (2 payés sur 4)
    addPaymentAndReceipt(students[0], 'monthly', octId, 15000, 'wave', 'WAV-CR-OCT-01', 12);
    addPaymentAndReceipt(students[1], 'monthly', octId, 15000, 'cash', null, 11);

    // Petite Section (6 payés sur 10)
    for (let i = 4; i < 10; i++) {
      addPaymentAndReceipt(students[i], 'monthly', octId, 15000, 'cash', null, 10 - (i - 4));
    }
    // Moyenne Section (6 payés sur 10)
    for (let i = 14; i < 20; i++) {
      addPaymentAndReceipt(students[i], 'monthly', octId, 15000, 'wave', 'WAV-' + (12000 + i), 9 - (i - 14));
    }
    // Grande Section (6 payés sur 10)
    for (let i = 24; i < 30; i++) {
      addPaymentAndReceipt(students[i], 'monthly', octId, 18000, 'orange_money', 'OM-' + (65000 + i), 8 - (i - 24));
    }

    // 3. Cotisations Novembre :
    const novId = months[1].id;
    // Crèche (1 payé)
    addPaymentAndReceipt(students[0], 'monthly', novId, 15000, 'wave', 'WAV-CR-NOV-01', 4);
    for (let i = 4; i < 8; i++) {
      addPaymentAndReceipt(students[i], 'monthly', novId, 15000, 'wave', 'WAV-NOV-' + i, 3 - (i - 4));
    }
    for (let i = 14; i < 17; i++) {
      addPaymentAndReceipt(students[i], 'monthly', novId, 15000, 'cash', null, 2);
    }
    for (let i = 24; i < 27; i++) {
      addPaymentAndReceipt(students[i], 'monthly', novId, 18000, 'wave', 'WAV-NOV-GS-' + i, 1);
    }

    // 4. Exemple de paiement ANNULÉ pour démontrer l'audit et le filigrane
    // On annule le reçu REC-2026-0005 pour démonstration
    if (payments[4] && receipts[4]) {
      payments[4].status = 'cancelled';
      payments[4].cancel_reason = "Erreur de saisie de l'élève (inversion de nom)";
      payments[4].cancelled_at = new Date(Date.now() - 86400000).toISOString();
      receipts[4].status = 'cancelled';
    }

    const audit_log = [
      {
        id: '77777777-0001-1111-1111-111111111111',
        school_id: schoolId,
        user_id: 'director-user-id',
        action: 'PAYMENT_CANCELLED',
        details: {
          receipt_number: 'REC-2026-0005',
          cancel_reason: "Erreur de saisie de l'élève (inversion de nom)"
        },
        created_at: new Date(Date.now() - 86400000).toISOString()
      }
    ];

    const expenses = [
      {
        id: '88888888-0001-1111-1111-111111111111',
        school_id: schoolId,
        motif: "Achat fournitures scolaires & papeterie (cahiers, crayons, peinture)",
        amount: 45000,
        date: "2026-10-04",
        category: "Fournitures",
        created_at: "2026-10-04T10:00:00Z"
      },
      {
        id: '88888888-0002-1111-1111-111111111111',
        school_id: schoolId,
        motif: "Facture électricité Senelec (Septembre / Octobre)",
        amount: 38500,
        date: "2026-10-08",
        category: "Factures",
        created_at: "2026-10-08T14:30:00Z"
      },
      {
        id: '88888888-0003-1111-1111-111111111111',
        school_id: schoolId,
        motif: "Produits de nettoyage & désinfection pour crèche et classes",
        amount: 22000,
        date: "2026-10-12",
        category: "Entretien",
        created_at: "2026-10-12T09:15:00Z"
      },
      {
        id: '88888888-0004-1111-1111-111111111111',
        school_id: schoolId,
        motif: "Goûter & collations collectives pour les enfants (fruits & biscuits)",
        amount: 35000,
        date: "2026-10-15",
        category: "Alimentation",
        created_at: "2026-10-15T11:00:00Z"
      },
      {
        id: '88888888-0005-1111-1111-111111111111',
        school_id: schoolId,
        motif: "Réparation serrure & maintenance de la porte d'entrée",
        amount: 15000,
        date: "2026-10-20",
        category: "Maintenance",
        created_at: "2026-10-20T16:20:00Z"
      }
    ];

    return {
      school,
      classes,
      months,
      students,
      payments,
      receipts,
      expenses,
      audit_log,
      receiptCounter: receiptCounter
    };
  }
};

window.DemoData = DemoData;
