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
cp .env.example .env        # puis remplis les deux mots de passe (openssl rand -hex 24)
docker compose up --build
```

Ouvre <http://localhost:8080>. Le conteneur nginx sert le jeu et redirige `/api` vers le backend : le navigateur ne parle qu'à une seule origine.

### Développer sans Docker

```bash
docker compose up tetrisflip-mongo      # MongoDB seul (publié sur 127.0.0.1:27017)
cd backend && MONGODB_URI='mongodb://tetrisflip:MONGO_APP_PASSWORD@localhost:27017/tetrisflip' mvn spring-boot:run
cd frontend && npm ci && npm run dev    # http://localhost:5173, redirige /api vers :8080
```

(`docker-compose.local.yml`, chargé via `COMPOSE_FILE` dans ton `.env`, publie les ports 8080 et 27017 sur `127.0.0.1`. Le `docker-compose.yml` de base ne publie rien.)

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

Crée **une seule ressource Docker Compose** sur ce dépôt (`docker-compose.yml`, aucun autre fichier).

1. Ne mets **pas** `COMPOSE_FILE` dans Coolify : `docker-compose.local.yml` publie des ports sur l'hôte, il est réservé à ton poste.
2. Définis le domaine du service `frontend` dans l'interface Coolify, port `8080`, et active la redirection HTTPS. Traefik atteint le conteneur sur son port interne ; rien n'est publié sur l'hôte.
3. Définis `MONGO_ROOT_PASSWORD` et `MONGO_APP_PASSWORD` comme **secrets d'exécution uniquement** (`openssl rand -hex 24`, en hexadécimal car le mot de passe est dans une URI). Ne donne jamais de domaine à la base ni à l'API.
4. Conserve le volume `mongo-data` quand tu supprimes ou redéploies la ressource, et planifie un `mongodump` quotidien (*Scheduled Task* Coolify sur le service `tetrisflip-mongo`) copié hors du serveur : un Mongo dans une ressource Compose n'a pas de sauvegarde automatique.
5. Après le premier déploiement, vérifie que `https://ton-domaine/` répond, que `http://` redirige, et que `https://ton-domaine/actuator/health` affiche la page du jeu (pas le JSON de santé).

Les noms de services sont préfixés (`tetrisflip-api`, `tetrisflip-mongo`) pour ne pas entrer en collision avec d'autres applications sur le réseau Docker partagé de Coolify.

## Sécurité

- Seul le conteneur nginx est joignable. MongoDB et l'API sont sur un réseau Docker interne, sans route vers l'extérieur.
- L'application se connecte à MongoDB avec son propre utilisateur (`readWrite` sur `tetrisflip` uniquement) ; le compte root n'est jamais utilisé par l'application. L'utilisateur est créé au premier démarrage d'un volume vide : sur un volume existant, crée-le une fois avec `mongosh` ou recrée le volume.
- Les conteneurs tournent sans root, avec un système de fichiers en lecture seule, sans capabilities, `no-new-privileges`, des limites mémoire et processus, et des logs tournants.
- nginx pose les en-têtes de sécurité (CSP, HSTS, `nosniff`, ...), limite la taille et le débit des requêtes (envoi de score : 10 par minute et par adresse), et ne transmet que `GET` et `POST` sur `/api/`.
- Le classement fait confiance au client : n'importe qui peut poster un score avec `curl`. Le débit limité et la validation gardent la table propre, mais seul un rejeu de la partie côté serveur empêcherait la triche.

## Secrets

Le dépôt est public et ne contient **aucun secret**. Les mots de passe MongoDB sont lus dans `.env` en local (ignoré par git, voir `.env.example`) et dans les variables d'environnement Coolify en production. La CI génère un mot de passe jetable à chaque exécution.
