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
cp .env.example .env        # then set a MONGO_PASSWORD of your own
docker compose up --build
```

Open <http://localhost:8080>. The nginx container serves the game and forwards `/api` to the backend, so the browser only talks to one origin.

### Development without Docker

```bash
docker compose up mongo                 # MongoDB only
cd backend && MONGODB_URI='mongodb://USER:PASSWORD@localhost:27017/tetrisflip?authSource=admin' mvn spring-boot:run
cd frontend && npm ci && npm run dev    # http://localhost:5173, proxies /api to :8080
```

(Add `ports: ["27017:27017"]` to the `mongo` service in a `docker-compose.override.yml` to reach it from the host.)

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

Create one **Docker Compose** resource pointing at this repository, or three resources:

1. **MongoDB**: use Coolify's MongoDB database (or the `mongo:9.0` image) and note its connection string.
2. **backend**: build pack *Dockerfile*, base directory `/backend`. Set `MONGODB_URI` as a secret environment variable.
3. **frontend**: build pack *Dockerfile*, base directory `/frontend`, port `8080`, domain of your choice. Set `BACKEND_URL` to the internal address of the backend, for example `http://backend:8080`.

## Secrets

The repository is public and contains **no secrets**. The MongoDB password is read from `.env` locally (git-ignored, see `.env.example`) and from Coolify environment variables in production. CI generates a throwaway password for each run.
