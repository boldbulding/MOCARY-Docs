# MOCARY Docs

Application de gestion des **devis** et **factures** pour **MOCARY SA** (tapis noués main-artisanat), avec :
- **Export Excel** (liste des documents + détail des lignes)
- **Impression** des documents au format MOCARY (aperçu navigateur puis `Ctrl+P`)
- **Particulier / Revendeur** : case à cocher sur chaque document, avec un **prix par type de client** (ex. 250 DHS/m² particulier, 150 DHS/m² revendeur). La colonne « P.U. » affiche le prix correspondant au type coché et le total est calculé avec ce prix.

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
| `/` (`index.html`) | Liste des devis / factures, filtres, export Excel |
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

## API

| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET    | `/api/documents?type=&search=&etat=` | Liste des documents |
| GET    | `/api/documents/:id` | Détail d'un document + lignes |
| GET    | `/api/documents/next?type=` | Numéro suivant (DEV-xxxx / FAC-xxxx) |
| GET    | `/api/documents/excel/list` | Export Excel |
| POST   | `/api/documents` | Créer un document |
| PUT    | `/api/documents/:id` | Modifier un document |
| DELETE | `/api/documents/:id` | Supprimer un document |
| GET/POST/PUT/DELETE | `/api/clients` | Carnet de clients |

## Prix par type de client

Chaque ligne de document contient deux prix :
- `pu_particulier` — prix appliqué si la case **PARTICULIER** est cochée
- `pu_revendeur` — prix appliqué si la case **REVENDEUR** est cochée

Unité au choix par ligne : **/m²** (montant = SURF × QTE × P.U.) ou **/pièce** (montant = QTE × NB PIÈCES × P.U.).