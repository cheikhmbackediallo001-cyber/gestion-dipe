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
│   ├── utils.js               # Formatage FCFA, dates, montants en lettres, vrai encodeur QR code (ISO 18004), CSV sécurisé
│   ├── stamp.js               # Générateur vectoriel de cachet officiel en SVG (double contour bleu #1E3A8A)
│   ├── demo-data.js           # 30 élèves sénégalais préscolaires, 3 sections, paiements d'inscriptions et cotisations
│   ├── auth.js                # Comptes & sessions (mots de passe chiffrés PBKDF2, anti-force brute, Supabase Auth)
│   ├── cloud-sync.js          # Sauvegarde automatique dans Supabase, restauration, publication des reçus
│   ├── store.js               # Moteur de données & règles strictes de calcul (pourcentages, unicité, numérotation de reçu, audit)
│   ├── landing.js             # Interactions landing page (menu mobile, accordéons FAQ, modales, démo interactive)
│   ├── onboarding.js          # Wizard de référencement en 4 étapes avec aperçu dynamique du cachet officiel
│   └── app.js                 # Logique applicative (Dashboard, Élèves, Inscriptions, Cotisations, Bilans, Reçus, WhatsApp)
├── sql/
│   ├── 01_schema.sql          # Tables, types énumérés, contraintes CHECK et index
│   ├── 02_views_functions.sql # Vues SQL de totaux agrégés, fonction de numérotation séquentielle et RPC
│   ├── 03_rls_policies.sql    # Politiques de sécurité Row Level Security (isolation multi-écoles étanche)
│   ├── 04_seed_data.sql       # Jeu de données de démonstration SQL prêt à exécuter
│   ├── 05_expenses_and_auth_trigger.sql # Dépenses + inscription atomique d'une école
│   ├── 06_other_revenues.sql  # Autres rentrées (dons, cantine, blouses...)
│   ├── 07_security_hardening.sql # Durcissement de sécurité
│   ├── 08_synchronisation_cloud.sql # Sauvegarde en ligne + reçus vérifiables depuis tout téléphone
│   └── A_EXECUTER_DANS_SUPABASE.sql # ⚠️ Script unique (05 + 06 + 07 + 08) à coller dans Supabase
├── server.js                  # Serveur local de test sécurisé (node server.js)
└── README.md                  # Ce guide de déploiement et checklist de validation
```

---

## 2. Guide de Déploiement Pas à Pas

### Option A : Test Immédiat en Mode Autonome (Zéro Dépendance)
L'application intègre un moteur autonome avec jeu de données pré-rempli (`demo-data.js` et `store.js`) :
1. Lancez `node server.js` puis ouvrez http://localhost:3000 (ou ouvrez directement `index.html` dans un navigateur moderne).
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
5. **`sql/A_EXECUTER_DANS_SUPABASE.sql` : OBLIGATOIRE.** Ce fichier unique regroupe les scripts 05 (dépenses), 06 (autres rentrées), 07 (sécurité) et 08 (synchronisation). Il s'exécute en une seule transaction (rien n'est modifié en cas d'erreur) et peut être relancé sans risque. Il a été testé sur un vrai PostgreSQL imitant Supabase (49 tests de sécurité).

Dans *Authentication > URL Configuration*, renseignez **Site URL** = `https://gestion-dipe.vercel.app` et ajoutez `https://gestion-dipe.vercel.app/**` aux *Redirect URLs* (liens de confirmation d'e-mail et de mot de passe oublié).

> Contrôle après exécution : `SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND 'anon' = ANY(roles);` doit renvoyer **0 ligne**.

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

## 3. Sécurité de la plateforme

| Domaine | Mesure en place |
| :--- | :--- |
| **Mots de passe** | Jamais stockés en clair : empreinte PBKDF2-SHA256 salée (310 000 itérations). Les anciens mots de passe en clair sont convertis automatiquement. 8 caractères minimum avec lettres et chiffres. |
| **Connexion** | Blocage progressif après 5 échecs (30 s, puis doublé jusqu'à 15 min), mémorisé entre les rechargements. Message d'erreur générique (ne révèle pas si un compte existe). |
| **Google** | Uniquement via le fournisseur OAuth officiel de Supabase. Les boutons restent masqués tant que Google n'est pas activé dans *Authentication > Providers*. |
| **Base Supabase** | RLS stricte par école, aucun accès anonyme aux tables, vues en `security_invoker`, écritures financières uniquement via fonctions contrôlées, journal d'audit infalsifiable (script 07). |
| **Navigateur** | En-têtes HTTP : Content-Security-Policy, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy (`vercel.json`). |
| **Données saisies** | Échappement systématique contre les injections (XSS), exports CSV protégés contre les formules Excel malveillantes, longueurs limitées. |
| **Reçus** | Jetons de vérification aléatoires cryptographiques (128 bits) ; vérification publique limitée aux informations non sensibles. |
| **Publication** | `.vercelignore` exclut `sql/`, `server.js` et les fichiers internes du site public. |

### Sauvegarde en ligne et vérification des reçus

Les données de l'école sont enregistrées sur l'appareil (fonctionnement hors-ligne) **et** sauvegardées automatiquement dans Supabase dès que la directrice est connectée avec un compte en ligne confirmé :

- **Sauvegarde privée** (`school_backups`) : visible uniquement par le compte propriétaire ; envoyée quelques secondes après chaque modification et au retour de la connexion.
- **Nouvel appareil** : à la connexion, l'école est restaurée automatiquement ; les modifications faites sur un autre appareil sont récupérées à l'ouverture.
- **Reçus vérifiables partout** (`published_receipts`) : seules les informations non sensibles (n°, école, montant, date, statut) sont publiées. Un parent peut scanner le QR code depuis son propre téléphone. Un reçu supprimé reste visible avec la mention ANNULÉ.
- Le statut est affiché dans **Paramètres > Sauvegarde en ligne** (bouton « Sauvegarder maintenant »).

Les comptes créés uniquement sur l'appareil reçoivent automatiquement un e-mail de confirmation pour activer la sauvegarde. Sur un appareil partagé, déconnectez-vous après usage.

---

## 4. Checklist de Tests et de Validation

| Test à effectuer | Résultat attendu | Statut |
| :--- | :--- | :---: |
| **Boutons Payé / Impayé mutuellement exclusifs** | Un clic sur « Payé » ouvre la modale de validation ; à la validation, le bouton passe au vert (#16A34A) et le bouton « Impayé » se désactive. | ✅ Validé |
| **Unicité stricte des paiements** | Impossible d'enregistrer deux cotisations valides pour le même élève et le même mois. | ✅ Validé |
| **Génération instantanée du reçu officiel** | Dès validation d'un versement, le reçu A5 s'ouvre avec numéro séquentiel unique (ex. `REC-2026-0001`), cachet vectoriel de l'école et montant converti en toutes lettres. | ✅ Validé |
| **Partage WhatsApp** | Le reçu est généré en image PNG et partagé (ou téléchargé) pour l'envoyer au parent sur WhatsApp. | ✅ Validé |
| **QR code du reçu** | Le QR code est un vrai code ISO 18004, lisible par tout scanner, pointant vers `verify.html?token=...`. | ✅ Validé |
| **Annulation avec motif obligatoire (Directeur)** | Repasser à « Impayé » exige un motif. Le reçu n'est jamais effacé, porte le filigrane rouge « ANNULÉ » et l'action est consignée dans l'audit. | ✅ Validé |
| **Calcul des pourcentages** | Formule : `(élèves payés ÷ total élèves) × 100` arrondie à 1 décimale. Montants en entiers FCFA sans virgule flottante. | ✅ Validé |
| **Pages dédiées Total Inscriptions & Bilan Mensuel** | Pages spécifiques avec KPIs en gros chiffres, tableaux récapitulatifs, graphique SVG léger et boutons d'export CSV. | ✅ Validé |
| **Isolation des données (RLS)** | Chaque directeur / établissement ne voit et ne modifie que les données de son propre `school_id`. | ✅ Validé |
| **Responsive Mobile (Android 360px -> 1920px)** | Aucun défilement horizontal à 320px, conversion automatique table-to-card, boutons tactiles ≥ 44 px. | ✅ Validé |
