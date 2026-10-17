# TetrisFlip

[🇬🇧 English](README.md) · 🇫🇷 Français

Un Tetris 3D qui tourne dans le navigateur, où la **caméra tourne autour du plateau** et où le **plateau se retourne comme un sablier**.

## Le jeu

- Règles classiques : tirage « 7-bag », rotations SRS avec wall kicks, réserve (hold), pièce fantôme, niveaux.
- Pièces et plateau en 3D (Three.js). Deux thèmes : couleurs modernes, ou le **vert d'origine de la Game Boy**.
- **Rotation de caméra** : tous les 5 000 points, la caméra fait un demi-tour autour du plateau, au ralenti, façon Matrix. On joue alors de l'autre côté, et les commandes gauche/droite sont inversées pour toujours correspondre à l'écran.
- **Flip vertical** : toutes les 10 lignes, le plateau se retourne et les blocs retombent comme dans un sablier.
- Commandes clavier et tactiles.

| Touche | Action |
| --- | --- |
| ← → | Déplacer |
| ↑ / X, Z | Tourner dans le sens horaire / antihoraire |
| ↓ | Descente douce |
| Espace | Chute immédiate |
| C | Réserve (hold) |
| P / Échap | Pause |

Les règles sont dans `frontend/src/game/config.ts` (taille du plateau, fréquence du flip et de la caméra, durées).

## Architecture

| Partie | Technologies | Rôle |
| --- | --- | --- |
| `frontend/` | TypeScript, Vite, Three.js, servi par nginx | Tout le jeu tourne dans le navigateur |
| `backend/` | Spring Boot 4, Java 25 | API du classement uniquement (`GET/POST /api/scores`) |
| MongoDB 9 | | Stocke les scores |
| `e2e/` | Playwright | Tests de bout en bout (écran de bureau et mobile) |

La logique du jeu est un module TypeScript pur (`frontend/src/game`), sans DOM ni WebGL : elle est testée directement. Le backend valide et stocke seulement les scores, donc il consomme très peu. Les scores sont envoyés par le client : le classement est ludique, pas à l'épreuve de la triche.

## Lancer en local

Il faut Docker avec Compose.

```bash
cp .env.example .env        # puis choisis ton propre MONGO_PASSWORD
docker compose up --build
```

Ouvre <http://localhost:8080>. Le conteneur nginx sert le jeu et redirige `/api` vers le backend : le navigateur ne parle qu'à une seule origine.

### Développer sans Docker

```bash
docker compose up mongo                 # MongoDB seul
cd backend && MONGODB_URI='mongodb://USER:PASSWORD@localhost:27017/tetrisflip?authSource=admin' mvn spring-boot:run
cd frontend && npm ci && npm run dev    # http://localhost:5173, redirige /api vers :8080
```

(Ajoute `ports: ["27017:27017"]` au service `mongo` dans un `docker-compose.override.yml` pour y accéder depuis ta machine.)

## Tests

```bash
cd frontend && npm test          # logique du jeu (Vitest)
cd frontend && npm run lint      # ESLint + Prettier
cd backend && mvn verify         # API (Spring MockMvc)
cd e2e && npm ci && npx playwright install chromium
docker compose up --build -d && npm test     # bout en bout, la stack doit tourner
```

La CI (`.github/workflows/ci.yml`) lance tout cela à chaque pull request.

## Déployer sur Coolify

Crée une ressource **Docker Compose** pointant vers ce dépôt, ou trois ressources :

1. **MongoDB** : la base MongoDB de Coolify (ou l'image `mongo:9.0`), puis note sa chaîne de connexion.
2. **backend** : build pack *Dockerfile*, répertoire de base `/backend`. Définis `MONGODB_URI` en variable d'environnement secrète.
3. **frontend** : build pack *Dockerfile*, répertoire de base `/frontend`, port `8080`, domaine au choix. Définis `BACKEND_URL` avec l'adresse interne du backend, par exemple `http://backend:8080`.

## Secrets

Le dépôt est public et ne contient **aucun secret**. Le mot de passe MongoDB est lu dans `.env` en local (ignoré par git, voir `.env.example`) et dans les variables d'environnement Coolify en production. La CI génère un mot de passe jetable à chaque exécution.
