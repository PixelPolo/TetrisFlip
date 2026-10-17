# TetrisFlip

🇬🇧 English · [🇫🇷 Français](README.fr.md)

A 3D Tetris that runs in your browser, where the **camera orbits the board** and the **board flips like an hourglass**.

## The game

- Classic Tetris rules: 7-bag randomizer, SRS rotations and wall kicks, hold, ghost piece, levels.
- Pieces and board in 3D (Three.js). Two themes: modern colours, or the original **Game Boy green**.
- **Camera orbit**: every 5,000 points the camera travels half way around the board, in slow motion, Matrix style. You then play from the other side, and the left/right controls are mirrored so they always match your screen.
- **Vertical flip**: every 10 lines the board turns upside down and the blocks fall as if you had flipped an hourglass.
- Keyboard and touch controls.

| Key | Action |
| --- | --- |
| ← → | Move |
| ↑ / X, Z | Rotate clockwise / counter-clockwise |
| ↓ | Soft drop |
| Space | Hard drop |
| C | Hold |
| P / Esc | Pause |

The rules live in `frontend/src/game/config.ts` (board size, flip and camera frequency, timings).

## Architecture

| Part | Stack | Role |
| --- | --- | --- |
| `frontend/` | TypeScript, Vite, Three.js, served by nginx | The whole game runs in the browser |
| `backend/` | Spring Boot 4, Java 25 | Leaderboard API only (`GET/POST /api/scores`) |
| MongoDB 9 | | Stores the scores |
| `e2e/` | Playwright | End-to-end tests on desktop and mobile viewports |

The game logic is a pure TypeScript module (`frontend/src/game`) with no DOM or WebGL, so it is unit tested directly. The backend only validates and stores scores, which keeps server load tiny. Scores are sent by the client, so the leaderboard is for fun, not cheat-proof.

## Run it locally

You need Docker with Compose.

```bash
cp .env.example .env        # then fill both passwords (openssl rand -hex 24)
docker compose up --build
```

Open <http://localhost:8080>. The nginx container serves the game and forwards `/api` to the backend, so the browser only talks to one origin.

### Development without Docker

```bash
docker compose up tetrisflip-mongo      # MongoDB only (published on 127.0.0.1:27017)
cd backend && MONGODB_URI='mongodb://tetrisflip:MONGO_APP_PASSWORD@localhost:27017/tetrisflip' mvn spring-boot:run
cd frontend && npm ci && npm run dev    # http://localhost:5173, proxies /api to :8080
```

(`docker-compose.local.yml`, loaded through `COMPOSE_FILE` in your `.env`, is what publishes ports 8080 and 27017 on `127.0.0.1`. The base `docker-compose.yml` publishes nothing.)

## Tests

```bash
cd frontend && npm test          # game logic (Vitest)
cd frontend && npm run lint      # ESLint + Prettier
cd backend && mvn verify         # API (Spring MockMvc)
cd e2e && npm ci && npx playwright install chromium
docker compose up --build -d && npm test     # end-to-end, needs the stack running
```

CI (`.github/workflows/ci.yml`) runs all of them on every pull request.

## Deploy on Coolify

Create **one Docker Compose resource** on this repository (`docker-compose.yml`, no other file).

1. Do **not** put `COMPOSE_FILE` in Coolify: `docker-compose.local.yml` publishes host ports and is for your laptop only.
2. Set the domain of the `frontend` service in the Coolify UI, with port `8080`, and enable the HTTPS redirect. Traefik reaches the container on its internal port; nothing is published on the host.
3. Define `MONGO_ROOT_PASSWORD` and `MONGO_APP_PASSWORD` as **runtime-only secrets** (`openssl rand -hex 24`, hex only because the password goes into a URI). Never give the database or the API a domain.
4. Keep the `mongo-data` volume when deleting or redeploying the resource, and schedule a daily `mongodump` (Coolify *Scheduled Task* on the `tetrisflip-mongo` service) copied off the server: a Mongo inside a Compose resource gets no automatic backup.
5. After the first deploy, check that `https://your-domain/` answers, that `http://` redirects, and that `https://your-domain/actuator/health` shows the game page (not the health JSON).

The service names are prefixed (`tetrisflip-api`, `tetrisflip-mongo`) so they cannot collide with other applications on Coolify's shared Docker network.

## Security

- Only the nginx container is reachable. MongoDB and the API sit on an internal Docker network with no route to the outside.
- The app connects to MongoDB with its own user (`readWrite` on `tetrisflip` only); the root account is never used by the app. The user is created on the first start of an empty volume, so on an existing volume create it once with `mongosh` or recreate the volume.
- Containers run as non-root, with a read-only filesystem, no capabilities, `no-new-privileges`, memory and process limits, and rotated logs.
- nginx sets the security headers (CSP, HSTS, `nosniff`, ...), limits request size and rate (score submissions: 10 per minute per address), and only forwards `GET` and `POST` on `/api/`.
- The leaderboard is client-trusted: anyone can post a score with `curl`. Rate limiting and validation keep the table clean, but only a server-side replay of the game would prevent cheating.

## Secrets

The repository is public and contains **no secrets**. The MongoDB passwords are read from `.env` locally (git-ignored, see `.env.example`) and from Coolify environment variables in production. CI generates a throwaway password for each run.
