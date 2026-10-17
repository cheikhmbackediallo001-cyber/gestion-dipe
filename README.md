# GESTION DIPE — Plateforme de Gestion Préscolaire

> **GESTION DIPE** est une plateforme web ultra-légère, mobile-first, conçue pour les écoles préscolaires, crèches et garderies du Sénégal et de la zone francophone (optimisée pour connexions 3G et smartphones Android d'entrée de gamme).

---

## 1. Arborescence du Projet

```text
GESTION DIPE/
├── index.html                 # Landing page publique complète avec maquette interactive
├── app.html                   # Application de gestion complète (Tableau de bord, Inscriptions, Cotisations, Bilans, Reçus)
├── verify.html                # Page publique d'authentification de reçu par QR code (sans exposition de données sensibles)
├── manifest.webmanifest       # PWA manifest pour installation écran d'accueil Android/iOS
├── sw.js                      # Service Worker (mise en cache statique hors-ligne)
├── css/
│   ├── design-system.css      # Variables officielles, typographie Poppins/Inter, palette WCAG AA, reset
│   ├── landing.css            # Styles spécifiques de la landing page publique
│   ├── app.css                # Styles applicatifs, navigation bureau/mobile, table-to-card, boutons Payé/Impayé
│   └── receipt.css            # Styles du reçu officiel format A5, cachet officiel, filigrane ANNULÉ et impression
├── js/
│   ├── config.js              # Paramètres globaux, devise FCFA, cascade administrative Sénégal (Régions/Départements/Communes)
│   ├── utils.js               # Formatage FCFA insécable, dates Africa/Dakar, montants en toutes lettres françaises, QR code SVG
│   ├── stamp.js               # Générateur vectoriel de cachet officiel en SVG (double contour bleu #1E3A8A)
│   ├── demo-data.js           # 30 élèves sénégalais préscolaires, 3 sections, paiements d'inscriptions et cotisations
│   ├── store.js               # Moteur de données & règles strictes de calcul (pourcentages, unicité, numérotation de reçu, audit)
│   ├── landing.js             # Interactions landing page (menu mobile, accordéons FAQ, modales, démo interactive)
│   ├── onboarding.js          # Wizard de référencement en 4 étapes avec aperçu dynamique du cachet officiel
│   └── app.js                 # Logique applicative (Dashboard, Élèves, Inscriptions, Cotisations, Bilans, Reçus, WhatsApp)
├── sql/
│   ├── 01_schema.sql          # Tables, types énumérés, contraintes CHECK et index
│   ├── 02_views_functions.sql # Vues SQL de totaux agrégés, fonction de numérotation séquentielle et RPC
│   ├── 03_rls_policies.sql    # Politiques de sécurité Row Level Security (isolation multi-écoles étanche)
│   └── 04_seed_data.sql       # Jeu de données de démonstration SQL prêt à exécuter
└── README.md                  # Ce guide de déploiement et checklist de validation
```

---

## 2. Guide de Déploiement Pas à Pas

### Option A : Test Immédiat en Mode Autonome (Zéro Dépendance)
L'application intègre un moteur autonome avec jeu de données pré-rempli (`demo-data.js` et `store.js`) :
1. Ouvrez simplement `index.html` ou `app.html` dans n'importe quel navigateur moderne (Chrome, Edge, Firefox, Safari sur ordinateur ou mobile).
2. Vous pouvez immédiatement tester l'intégralité des flux :
   - Clic sur **Payé** / **Impayé** avec recalcul en direct.
   - Émission instantanée du reçu A5 avec cachet vectoriel officiel et QR code.
   - Partage WhatsApp pré-formaté.
   - Consultation des pages dédiées **Total des inscriptions** et **Bilan mensuel**.
   - Test de vérification du reçu en ouvrant `verify.html`.

### Option B : Déploiement en Production avec Supabase (PostgreSQL + RLS + Auth)

#### Étape 1 : Création du projet Supabase
1. Rendez-vous sur [supabase.com](https://supabase.com) et créez un projet (région recommandée : Europe de l'Ouest ou la plus proche de l'Afrique de l'Ouest).
2. Notez votre **Project URL** et votre **anon public key** dans *Project Settings > API*.

#### Étape 2 : Exécution des scripts SQL
Dans le **SQL Editor** de Supabase, exécutez les scripts dans l'ordre strict suivant :
1. `sql/01_schema.sql` : création des tables, contraintes d'intégrité et index.
2. `sql/02_views_functions.sql` : création des vues de totaux, de la fonction séquentielle de numérotation et des RPC.
3. `sql/03_rls_policies.sql` : activation du RLS et des politiques d'isolation par établissement.
4. `sql/04_seed_data.sql` *(optionnel)* : insertion de l'école de test « Les Papillons », 3 classes et 30 élèves sénégalais.

#### Étape 3 : Configuration du client web
Dans le fichier `js/config.js`, renseignez vos identifiants :
```javascript
const CONFIG = {
  // ...
  SUPABASE_URL: "https://votre-projet.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  // ...
};
```

#### Étape 4 : Hébergement Statique
Comme le front-end est conçu en HTML5/CSS3/JavaScript natif ultra-léger (< 200 Ko) :
- **Sur Netlify** : Glissez-déposez le dossier `GESTION DIPE` directement sur [app.netlify.com/drop](https://app.netlify.com/drop).
- **Sur Vercel** : Déployez avec la commande `vercel` ou via l'interface Vercel (sélectionnez "Other" / static).
- **Sur GitHub Pages** : Activez GitHub Pages dans les réglages du dépôt sur la branche principale.

---

## 3. Checklist de Tests et de Validation

| Test à effectuer | Résultat attendu | Statut |
| :--- | :--- | :---: |
| **Boutons Payé / Impayé mutuellement exclusifs** | Un clic sur « Payé » ouvre la modale de validation ; à la validation, le bouton passe au vert (#16A34A) et le bouton « Impayé » se désactive. | ✅ Validé |
| **Unicité stricte des paiements** | Impossible d'enregistrer deux cotisations valides pour le même élève et le même mois. | ✅ Validé |
| **Génération instantanée du reçu officiel** | Dès validation d'un versement, le reçu A5 s'ouvre avec numéro séquentiel unique (ex. `REC-2026-0001`), cachet vectoriel de l'école et montant converti en toutes lettres. | ✅ Validé |
| **Partage WhatsApp** | Le bouton WhatsApp pré-remplit le message avec le lien sécurisé vers `verify.html?token=...` vers le numéro du parent. | ✅ Validé |
| **Annulation avec motif obligatoire (Directeur)** | Repasser à « Impayé » exige un motif. Le reçu n'est jamais effacé, porte le filigrane rouge « ANNULÉ » et l'action est consignée dans l'audit. | ✅ Validé |
| **Calcul des pourcentages** | Formule : `(élèves payés ÷ total élèves) × 100` arrondie à 1 décimale. Montants en entiers FCFA sans virgule flottante. | ✅ Validé |
| **Pages dédiées Total Inscriptions & Bilan Mensuel** | Pages spécifiques avec KPIs en gros chiffres, tableaux récapitulatifs, graphique SVG léger et boutons d'export CSV. | ✅ Validé |
| **Isolation des données (RLS)** | Chaque directeur / établissement ne voit et ne modifie que les données de son propre `school_id`. | ✅ Validé |
| **Responsive Mobile (Android 360px -> 1920px)** | Aucun défilement horizontal à 320px, conversion automatique table-to-card, boutons tactiles ≥ 44 px. | ✅ Validé |
