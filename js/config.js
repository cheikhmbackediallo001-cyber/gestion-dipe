/**
 * CONFIGURATION GLOBALE - GESTION PRÉSCOLAIRE
 */

const CONFIG = {
  // Identité de la plateforme
  PLATFORM_NAME: "Gestion Préscolaire",
  PLATFORM_LEGAL_NAME: "Gestion Préscolaire",
  PLATFORM_SLOGAN: "La gestion préscolaire simple, transparente et sans tracas",
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

  // Structure administrative du Sénégal en cascade (Régions, Départements, Communes)
  SENEGAL_REGIONS: {
    "Dakar": {
      "Dakar": ["Plateau", "Médina", "Fann-Point E-Amitié", "Grand Dakar", "Biscuiterie", "Dieuppeul-Derklé", "Gueule Tapée-Fass-Colobane", "Hann Bel-Air", "Mermoz-Sacré-Cœur", "Ouakam", "Ngor", "Yoff", "Camberène"],
      "Guédiawaye": ["Golf Sud", "Médina Gounass", "Ndiarème Limamoulaye", "Sam Notaire", "Wakhinane Nimzatt"],
      "Pikine": ["Pikine Ouest", "Pikine Est", "Pikine Nord", "Dalifort", "Djiddah Thiaroye Kao", "Guinaw Rail Nord", "Guinaw Rail Sud", "Thiaroye Gare", "Thiaroye sur Mer", "Yeumbeul Nord", "Yeumbeul Sud", "Malika", "Keur Massar"],
      "Rufisque": ["Rufisque Est", "Rufisque Ouest", "Rufisque Nord", "Bargny", "Sébikotane", "Diamniadio", "Sendou"]
    },
    "Thiès": {
      "Thiès": ["Thiès Nord", "Thiès Ouest", "Thiès Est", "Fandène", "Notto"],
      "Mbour": ["Mbour", "Saly Portudal", "Somone", "Ngaparou", "Popenguine", "Nguékhokh", "Joal-Fadiouth"],
      "Tivaouane": ["Tivaouane", "Méouane", "Mboro", "Pire Goureye"]
    },
    "Diourbel": {
      "Diourbel": ["Diourbel Commune", "Ndindy", "Ndoulo"],
      "Mbacké": ["Mbacké Commune", "Touba Mosquée", "Taïf", "Kael"],
      "Bambey": ["Bambey Commune", "Ngoye", "Baba Garage"]
    },
    "Saint-Louis": {
      "Saint-Louis": ["Saint-Louis Commune", "Gandon", "Fass"],
      "Dagana": ["Dagana Commune", "Richard-Toll", "Rosso-Sénégal"],
      "Podor": ["Podor", "Ndioum", "Aéré Lao", "Golléré"]
    },
    "Kaolack": {
      "Kaolack": ["Kaolack Commune", "Kahone", "Ndoffane", "Latmingué"],
      "Nioro du Rip": ["Nioro Commune", "Paoskoto", "Médina Sabakh"],
      "Guinguinéo": ["Guinguinéo Commune", "Mboss", "Khelcom"]
    },
    "Ziguinchor": {
      "Ziguinchor": ["Ziguinchor Commune", "Enampore", "Nyassia"],
      "Oussouye": ["Oussouye Commune", "Cap Skirring", "Diembéring"],
      "Bignona": ["Bignona Commune", "Tenghory", "Thionck Essyl"]
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
