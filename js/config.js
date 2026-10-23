/**
 * CONFIGURATION GLOBALE - GESTION PRÉSCOLAIRE
 */

const CONFIG = {
  // Identité de la plateforme
  PLATFORM_NAME: "Gestion Préscolaire",
  PLATFORM_LEGAL_NAME: "Gestion Préscolaire",
  PLATFORM_SLOGAN: "Une école bien gérée, un meilleur avenir",
  VERSION: "1.0.0",

  // Localisation & monnaie
  CURRENCY: "FCFA",
  CURRENCY_CODE: "XOF",
  TIMEZONE: "Africa/Dakar",
  DEFAULT_SCHOOL_YEAR: "2026-2027",

  // Contacts officiels plateforme
  CONTACT_EMAIL: "contact@gestionprescolaire.sn",
  CONTACT_PHONE: "+221 33 800 00 00 / WhatsApp : +221 77 000 00 00",

  // Configuration Supabase (laisser vide pour activer le mode démo local automatique)
  // Renseigner avec les clés de votre projet Supabase pour le mode production
  SUPABASE_URL: "https://rkkgwhxtpozwwkyvzcqz.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJra2d3aHh0cG96d3dreXZ6Y3F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMTg1NTMsImV4cCI6MjEwNzg5NDU1M30.lLIeEVQaN3Zl4yd95GF8d1zXt3cdtkvB4e_MLjS5ClQ",

  // Structure administrative intégrale du Sénégal (14 Régions, 46 Départements et Communes)
  SENEGAL_REGIONS: {
    "Dakar": {
      "Dakar": ["Plateau", "Médina", "Fann-Point E-Amitié", "Grand Dakar", "Biscuiterie", "Dieuppeul-Derklé", "Gueule Tapée-Fass-Colobane", "Hann Bel-Air", "Mermoz-Sacré-Cœur", "Ouakam", "Ngor", "Yoff", "Cambérène", "Gorée"],
      "Guédiawaye": ["Golf Sud", "Médina Gounass", "Ndiarème Limamoulaye", "Sam Notaire", "Wakhinane Nimzatt"],
      "Pikine": ["Pikine Ouest", "Pikine Est", "Pikine Nord", "Dalifort", "Djiddah Thiaroye Kao", "Guinaw Rail Nord", "Guinaw Rail Sud", "Thiaroye Gare", "Thiaroye sur Mer", "Diamaguène Sicap Mbao", "Tivaouane Diack Sao", "Mbao"],
      "Rufisque": ["Rufisque Est", "Rufisque Ouest", "Rufisque Nord", "Bargny", "Sébikotane", "Diamniadio", "Sendou", "Sangalkam", "Bambylor", "Yène"],
      "Keur Massar": ["Keur Massar Nord", "Keur Massar Sud", "Malika", "Yeumbeul Nord", "Yeumbeul Sud", "Jaxaay-Parcelles"]
    },
    "Thiès": {
      "Thiès": ["Thiès Nord", "Thiès Ouest", "Thiès Est", "Fandène", "Notto Diobass", "Touba Toul", "Khombole", "Pout", "Cayar"],
      "Mbour": ["Mbour Commune", "Saly Portudal", "Somone", "Ngaparou", "Popenguine", "Nguékhokh", "Joal-Fadiouth", "Sindia", "Malicounda", "Diass"],
      "Tivaouane": ["Tivaouane Commune", "Méouane", "Mboro", "Pire Goureye", "Taïba Ndiaye", "Darou Khoudoss", "Pékese", "Niakhène"]
    },
    "Diourbel": {
      "Diourbel": ["Diourbel Commune", "Ndindy", "Ndoulo", "Ngohe", "Touré Mbonde", "Dankh Sène", "Gade Escale"],
      "Mbacké": ["Mbacké Commune", "Touba Mosquée", "Taïf", "Kael", "Sadio", "Dalla Ngabou", "Touba Fall"],
      "Bambey": ["Bambey Commune", "Ngoye", "Baba Garage", "Lambaye", "Réfane", "Dangalma", "Dinguiraye"]
    },
    "Fatick": {
      "Fatick": ["Fatick Commune", "Diakhao", "Diofior", "Djilor", "Fimela", "Niakhar", "Tattaguine", "Thiaré Ndialgui"],
      "Foundiougne": ["Foundiougne Commune", "Sokone", "Karang Poste", "Passy", "Djilor", "Toubacouta", "Soum"],
      "Gossas": ["Gossas Commune", "Colobane", "Mbar", "Ouadiour", "Patar Lia"]
    },
    "Kaolack": {
      "Kaolack": ["Kaolack Commune", "Kahone", "Ndoffane", "Latmingué", "Ndiaffate", "Keur Socé", "Gandiaye", "Sibassor"],
      "Guinguinéo": ["Guinguinéo Commune", "Mboss", "Khelcom Birane", "Gagnick", "Ndiago"],
      "Nioro du Rip": ["Nioro Commune", "Paoskoto", "Médina Sabakh", "Wack Ngouna", "Keur Maba Diakhou", "Porokhane"]
    },
    "Kaffrine": {
      "Kaffrine": ["Kaffrine Commune", "Nganda", "Diamagadio", "Gniby", "Kahi"],
      "Birkelane": ["Birkelane Commune", "Diamal", "Mabo", "Keur Mboucki", "Ndiognick"],
      "Koungheul": ["Koungheul Commune", "Fass Thiékène", "Ida Mouride", "Lour Escale", "Ribot Escale", "Saly Escale"],
      "Malem Hodar": ["Malem Hodar Commune", "Dianké Souf", "Djilor", "Ndioum Ngainth", "Khelcom"]
    },
    "Saint-Louis": {
      "Saint-Louis": ["Saint-Louis Commune", "Gandon", "Fass Ngom", "Ndiébène Gandiol"],
      "Dagana": ["Dagana Commune", "Richard-Toll", "Rosso-Sénégal", "Gaé", "Ross Béthio", "Ronkh", "Bokhol", "Mbane"],
      "Podor": ["Podor Commune", "Ndioum", "Aéré Lao", "Golléré", "Guédé Village", "Démette", "Galoya Toubcou", "Fanaye", "Pété"]
    },
    "Louga": {
      "Louga": ["Louga Commune", "Koki", "Nguidilé", "Sakal", "Keur Momar Sarr", "Syer", "Léona"],
      "Kébémer": ["Kébémer Commune", "Guéoul", "Ndande", "Sagatta Gueth", "Darou Mousty", "Sam Yabal"],
      "Linguère": ["Linguère Commune", "Dahra", "Barkédji", "Dodji", "Yang-Yang", "Mbeuleukhé", "Sagatta Djolof"]
    },
    "Matam": {
      "Matam": ["Matam Commune", "Ourossogui", "Thilogne", "Nguidjilone", "Bokidiawé", "Dabia", "Ogo"],
      "Kanel": ["Kanel Commune", "Semmé", "Waoundé", "Dembancané", "Hamady Hounaré", "Sinthiou Bamambé", "Odobéré"],
      "Ranérou Ferlo": ["Ranérou Commune", "Vélingara Ferlo", "Lougré Thioly", "Oudalaye"]
    },
    "Tambacounda": {
      "Tambacounda": ["Tambacounda Commune", "Koussanar", "Missirah", "Makacolibantang", "Dialacoto"],
      "Bakel": ["Bakel Commune", "Diawara", "Kidira", "Ballou", "Gabou", "Moudéry", "Bélé"],
      "Goudiry": ["Goudiry Commune", "Kothiary", "Bala", "Dianké Makha", "Boynguel Bamba", "Bani Israël", "Komoti"],
      "Koumpentoum": ["Koumpentoum Commune", "Malem Niani", "Bamba Thialène", "Kouthiaba Wolof", "Pass Koto"]
    },
    "Kédougou": {
      "Kédougou": ["Kédougou Commune", "Bandafassi", "Tomboronkoto", "Dindéfélo", "Dimboli"],
      "Salemata": ["Salemata Commune", "Dakately", "Dar Salam", "Kevoye", "Oubadji"],
      "Saraya": ["Saraya Commune", "Bembou", "Médina Baffé", "Khossanto", "Sabodala"]
    },
    "Kolda": {
      "Kolda": ["Kolda Commune", "Dabo", "Saré Yoba Diéga", "Dioulacolon", "Médina El Hadj", "Tankanto Escale"],
      "Médina Yoro Foulah": ["Médina Yoro Foulah Commune", "Pata", "Niaming", "Fafacourou", "Bourouco", "Bignarabé"],
      "Vélingara": ["Vélingara Commune", "Kounkané", "Diaobé-Kabendou", "Bonconto", "Linkéring", "Médina Gounass", "Saré Coly Sallé"]
    },
    "Sédhiou": {
      "Sédhiou": ["Sédhiou Commune", "Diannah Malary", "Marsassoum", "Bambaly", "Djibabouya", "Oudoucar", "Koussy"],
      "Bounkiling": ["Bounkiling Commune", "Madina Wandifa", "Boghal", "Bona", "Diambaty", "Faoune", "Tankon"],
      "Goudomp": ["Goudomp Commune", "Samine", "Tanaff", "Diattacounda", "Kaour", "Karantaba", "Simbandi Balante"]
    },
    "Ziguinchor": {
      "Ziguinchor": ["Ziguinchor Commune", "Enampore", "Nyassia", "Boutoupa-Camaracounda"],
      "Bignona": ["Bignona Commune", "Thionck Essyl", "Diouloulou", "Tenghory", "Balingore", "Kafountine", "Sindian", "Oulampane"],
      "Oussouye": ["Oussouye Commune", "Cap Skirring", "Diembéring", "Santhiaba Manjack", "Mlomp"]
    }
  },

  // Mois scolaires par défaut au Sénégal (Octobre à Juin)
  DEFAULT_MONTHS: [
    { number: 10, label: "Octobre", position: 1 },
    { number: 11, label: "Novembre", position: 2 },
    { number: 12, label: "Décembre", position: 3 },
    { number: 1,  label: "Janvier", position: 4 },
    { number: 2,  label: "Février", position: 5 },
    { number: 3,  label: "Mars", position: 6 },
    { number: 4,  label: "Avril", position: 7 },
    { number: 5,  label: "Mai", position: 8 },
    { number: 6,  label: "Juin", position: 9 }
  ],

  // Modes de paiement supportés
  PAYMENT_METHODS: [
    { id: 'cash', label: 'Espèces' },
    { id: 'wave', label: 'Wave' },
    { id: 'orange_money', label: 'Orange Money' },
    { id: 'cheque', label: 'Chèque' },
    { id: 'bank_transfer', label: 'Virement bancaire' },
    { id: 'other', label: 'Autre' }
  ],

  // Motifs types d'annulation
  CANCEL_REASONS: [
    "Erreur de saisie de l'élève",
    "Erreur sur le montant encaissé",
    "Double saisie accidentelle",
    "Chèque sans provision ou virement rejeté",
    "Remboursement suite à désistement",
    "Autre motif (préciser ci-dessous)"
  ]
};

window.CONFIG = CONFIG;
