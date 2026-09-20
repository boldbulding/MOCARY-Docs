# MOCARY Docs

Application de gestion des **devis** et **factures** pour **MOCARY SA** (tapis noués main-artisanat), avec :
- **Export Excel** (liste des documents + détail des lignes)
- **Impression** des documents au format MOCARY (aperçu navigateur puis `Ctrl+P`)
- **Particulier / Revendeur** : case à cocher sur chaque document, avec un **prix par type de client** (ex. 250 DHS/m² particulier, 150 DHS/m² revendeur). La colonne « P.U. » affiche le prix correspondant au type coché et le total est calculé avec ce prix.
- **Connexion sécurisée** Gmail + mot de passe (JWT, session 24 h), protégeant toutes les données.
- **Workflow Service Production Tapis** : les commandes créées par l'administrateur apparaissent dans la page « Production Tapis » (`production.html`). Le service production indique **Tapis prêt : OUI/NON** par commande puis la **valide** → la commande passe à l'état **VALIDÉE** avec la **date, l'heure et l'utilisateur** de validation, consultables chez l'administrateur (colonnes « Tapis prêt » et « Validation » de la liste des documents). Tant que le tapis n'est pas prêt, la commande reste « En attente » (visible chez l'Admin).

## Connexion

L'application est protégée : la page d'accueil est la page de **connexion**.

- Compte administrateur créé automatiquement au 1er démarrage :
  - Email : **admin@example.com**
  - Mot de passe : **admin123**
- Compte **Service Production Tapis** créé automatiquement au démarrage :
  - Email : **production@example.com**
  - Mot de passe : **production123**
  - Identifiants personnalisables via `PRODUCTION_EMAIL` et `PRODUCTION_PASSWORD`.
- Identifiants personnalisables via les variables d'environnement `ADMIN_EMAIL` et `ADMIN_PASSWORD` (créent le compte si absent).
- Pour changer le mot de passe en production : définir `ADMIN_PASSWORD` dans Render puis redéployer (le compte est recréé uniquement s'il est absent — pour un vrai changement, modifier ces variables et supprimer la ligne `utilisateur` correspondante dans la base, ou passer par un script).

⚠️ Pensez à changer ce mot de passe avant une mise en production réelle.

## Prérequis
- Node.js **>= 22.5** (base de données SQLite intégrée à Node, aucune installation)
- Aucune base de données externe requise

## Démarrage

```bash
npm install
npm start
```

Ouvrir ensuite **http://localhost:4000** dans le navigateur (port dédié, autonome par rapport à l'ancien site sur 3000).

Pour le rendre accessible depuis internet, lancer un tunnel vers le port 4000 :
```bash
cloudflared tunnel --url http://localhost:4000
```

La base SQLite est créée automatiquement dans `data/mocary.db` au premier démarrage.

## Pages

| Page | Rôle |
|------|------|
| `/` (`index.html`) | Page de **connexion** (email + mot de passe) |
| `documents.html` | Liste des devis / factures, filtres, export Excel |
| `form.html?type=devis` / `form.html?type=facture` | Création / modification d'un document (case Particulier/Revendeur, lignes, prix dynamique, montant en lettres) |
| `print.html?id=N` | Aperçu imprimable du document au format MOCARY |

## Déploiement permanent (Render + PostgreSQL)

Le projet détecte automatiquement la base utilisée :
- `DATABASE_URL` définie → **PostgreSQL** (production / Render)
- sinon → **SQLite** locale (développement)

### Étapes pour mettre le site en ligne 24h/24

1. **Base de données gratuite (Neon)** : sur https://neon.tech, se connecter, créer un projet, puis copier la *connection string* (`postgresql://...`).
2. **Déployer sur Render** : se connecter à https://render.com, cliquer **New → Blueprint**, choisir le dépôt `MOCARY-Docs`, renseigner `DATABASE_URL` avec la connection string Neon, puis **Create**.
3. Render fournit une URL publique (ex. https://mocary-docs.onrender.com) accessible depuis partout.

Variables d'environnement : `DATABASE_URL` (PostgreSQL, obligatoire en production), `JWT_SECRET` (signature des sessions — Render en génère une automatiquement), `ADMIN_EMAIL` / `ADMIN_PASSWORD` (identifiants du compte admin, optionnel), `PRODUCTION_EMAIL` / `PRODUCTION_PASSWORD` (identifiants du compte Service Production Tapis, optionnel).

## API

| Méthode | Chemin | Description |
|---------|--------|-------------|
| POST   | `/api/auth/login` | Connexion (email + mot de passe) → retourne un token JWT |
| GET    | `/api/documents?type=&search=&etat=&tapis_pret=` | Liste des documents (admin + production voient tout) |
| GET    | `/api/documents/:id` | Détail d'un document + lignes |
| GET    | `/api/documents/next?type=` | Numéro suivant (DEV-xxxx / FAC-xxxx) |
| GET    | `/api/documents/excel/list` | Export Excel |
| POST   | `/api/documents` | Créer un document (interdit au rôle `production`) |
| PUT    | `/api/documents/:id` | Modifier un document |
| DELETE | `/api/documents/:id` | Supprimer un document (interdit au rôle `production`) |
| PATCH  | `/api/documents/:id/tapis-pret` | Indiquer « Tapis prêt : OUI/NON » (`tapis_pret`: 0/1) — admin + production |
| POST   | `/api/documents/:id/valider-production` | Valider la commande : `etat=validee` + `valide_le` (date/heure) + `valide_par` (utilisateur) — admin + production |
| GET/POST/PUT/DELETE | `/api/clients` | Carnet de clients |

Les routes `/api/documents`, `/api/clients` et l'export Excel exigent l'en-tête `Authorization: Bearer <token>`.

## Prix par type de client

Chaque ligne de document contient deux prix :
- `pu_particulier` — prix appliqué si la case **PARTICULIER** est cochée
- `pu_revendeur` — prix appliqué si la case **REVENDEUR** est cochée

Calcul des lignes :
- **SURF = QTE × LONG × LARG** (en m², arrondi à 2 décimales)
- **MONTANT = SURF × P.U.**
- Colonne **TAILLE** : l'utilisateur choisit **S, M ou L**