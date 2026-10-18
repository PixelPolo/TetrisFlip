# TetrisFlip

🇬🇧 English · [🇫🇷 Français](README.fr.md)

A 3D Tetris that runs in your browser, where the **camera orbits the board** and the **board flips like an hourglass**.

## The game

- Classic Tetris rules: 7-bag randomizer, SRS rotations and wall kicks, hold, levels.
- **Two difficulties, chosen before you play**: *Easy* shows a ghost piece (where the piece will land), *Hard* does not. Each has its own leaderboard.
- Pieces and board in 3D (Three.js). Two themes: modern colours, or the original **Game Boy green**.
- **Bullet time**: after a random delay (10 to 60 s, `bulletEveryMs`) the pieces slow right down while the camera sweeps half way around the board with a tilt and motion trails, Matrix style. You then play from the other side with **left/right (and rotations) mirrored**, at half speed, for 6 to 10 s early in the game and 10 to 20 s later. A second bullet time brings you back to normal. In *Easy* mode a small countdown shows when the next bullet time comes.
- **Constant bullet time**: from level 5 (`constantCameraFromLevel`) the random bullet time gives way to a constant mode. The camera turns around the board non stop, faster with each level (`constantSpinDegPerSecond`), the pieces fall at the normal speed of the level (no slow motion), and left/right stay inverted whenever the camera is behind the board. The board frame is blue in front and turns red when the camera is behind.
- **Vertical flip**: every 1,000 points, or as soon as you clear four lines at once (a Tetris), the board turns upside down and the blocks fall like sand in an hourglass, which also frees the lines with holes.
- **Sound**: a chiptune version of the Russian folk tune *Korobeiniki* (public domain) with our own synthesis and bass line, plus sound effects, all synthesised in the browser (no audio files). Music starts after your first click or key press and has a mute button (remembered). It deliberately uses no Nintendo/Tetris Company recording or score: the repository is public and those are copyrighted. The melody is the folk tune everyone knows, so it sounds familiar; a lawyer-grade guarantee is not possible, so replace it if the project ever becomes commercial.
- **Accounts and guest mode**: guests can try the game for one minute in total (`GUEST_TRIAL_MS` in `frontend/src/guest.ts`), then must sign up or log in. Only signed-in players can save scores.
- Keyboard, Game Boy style touch pad (d-pad, A, B, Select, Start) or optional swipe controls on mobile (a rounded swipe square under the board, so your fingers stay off the game).

| Key | Action |
| --- | --- |
| ← → | Move |
| ↑ / X, Z | Rotate clockwise / counter-clockwise |
| ↓ | Soft drop |
| Space | Hard drop |
| C | Hold |
| P / Esc | Pause |

**Mobile**: the d-pad moves (up = hard drop, down = soft drop), A rotates, B rotates back, Select holds the piece, Start starts or pauses. Swipe controls are the default on a phone (the pad disappears), and the burger menu (top right, it pauses the game) switches between swipe and the pad with *Controls*: tap to rotate, drag left/right to move, drag down to soft drop, flick down to hard drop, swipe up to swap the piece (hold).

The rules live in `frontend/src/game/config.ts` (board size, flip and camera frequency, timings).

## Architecture

| Part | Stack | Role |
| --- | --- | --- |
| `frontend/` | TypeScript, Vite, Three.js, served by nginx | The whole game runs in the browser |
| `backend/` | Spring Boot 4, Java 25 | Leaderboard API only (`GET /api/scores?difficulty=easy\|hard`, `POST /api/scores`) |
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

CI (`.github/workflows/ci.yml`) runs the frontend and backend checks on every pull request; the single check to require in the branch ruleset is `ci-ok`.

**The end-to-end tests are disabled in CI for speed. Run them locally and make sure they pass before every merge.** To re-enable them, uncomment the `e2e` job in the workflow and add it back to the `needs` of `ci-ok`.

## Deploy on Coolify

Create **one Docker Compose resource** on this repository (`docker-compose.yml`, no other file).

1. Do **not** put `COMPOSE_FILE` in Coolify: `docker-compose.local.yml` publishes host ports and is for your laptop only.
2. Set the domain of the `frontend` service in the Coolify UI, with port `8080`, and enable the HTTPS redirect. Traefik reaches the container on its internal port; nothing is published on the host.
3. Define `MONGO_ROOT_PASSWORD` and `MONGO_APP_PASSWORD` as **runtime-only secrets** (`openssl rand -hex 24`, hex only because the password goes into a URI). Never give the database or the API a domain.
4. Keep the `mongo-data` volume when deleting or redeploying the resource, and schedule a daily `mongodump` (Coolify *Scheduled Task* on the `tetrisflip-mongo` service) copied off the server: a Mongo inside a Compose resource gets no automatic backup.
5. After the first deploy, check that `https://your-domain/` answers, that `http://` redirects, and that `https://your-domain/actuator/health` shows the game page (not the health JSON).
6. Then test the account flow over HTTPS: sign up, reload (you stay signed in), log out, log in, play a game and save a score. The session cookie is `Secure`, so it only works over HTTPS.
7. Rate limits use the visitor address that nginx sees. Try 6 wrong passwords in a row on one account (you get a 429), then check from another device that you are not blocked too. If every visitor looks identical, add Traefik's Docker network range to `set_real_ip_from` in `frontend/nginx/default.conf.template`.

The service names are prefixed (`tetrisflip-api`, `tetrisflip-mongo`) so they cannot collide with other applications on Coolify's shared Docker network.

## Releasing

Releases are cut from the **Release** workflow (`.github/workflows/release.yml`), run by hand from GitHub: **Actions > Release > Run workflow**. It handles the versions itself.

1. Run the e2e tests locally first (they are disabled in CI, see `CLAUDE.md`).
2. Fill in **version** (`1.1.0`, no `v`; it must match the `-SNAPSHOT` version on `main`). Optionally set **next_version** (the next development version, default: patch + 1, so `1.1.1-SNAPSHOT`).
3. The workflow makes a release commit (`-SNAPSHOT` removed in `backend/pom.xml`, `frontend` and `e2e`), then a commit that bumps to the next `-SNAPSHOT`, and opens a pull request with both. It starts CI on it, creates the tag `vX.Y.Z` on the release commit with a GitHub release (generated notes), and turns on auto-merge. The pull request merges by itself once `ci-ok` is green (merge commit, so the tag stays in the history of `main`).
4. It refuses anything that is not a plain `X.Y.Z`, a tag or branch that already exists, a SNAPSHOT that is not the latest `main`, or versions that disagree between the files.

To tag an older commit of `main` that already holds exactly `X.Y.Z` (for example `1.0.0`), set **commit** to its SHA: the workflow only tags it, and changes no version.

`main` is protected (pull request and `ci-ok`), so the bump goes through a pull request. Two repository settings are needed: **Settings > Actions > General > Allow GitHub Actions to create and approve pull requests**, and **Settings > General > Allow auto-merge**. If the pull request is closed unmerged or CI fails after the tag was created, delete the tag, the release and the branch `release/vX.Y.Z` on GitHub before running again. Merge by hand with a merge commit, never squash or rebase (the tag would leave the history of `main`). Without the first setting the workflow stops before tagging anything; without the second one it still releases and leaves the pull request for you to merge.

The workflow uses only the GitHub CLI of the runner and the automatic `GITHUB_TOKEN` (`contents`, `pull-requests` and `actions` write on that one job, to push the branch, open the pull request and start CI): no third-party action and no secret.

## Security

- Only the nginx container is reachable. MongoDB and the API sit on an internal Docker network with no route to the outside.
- The app connects to MongoDB with its own user (`readWrite` on `tetrisflip` only); the root account is never used by the app. The user is created on the first start of an empty volume, so on an existing volume create it once with `mongosh` or recreate the volume.
- Containers run as non-root, with a read-only filesystem, no capabilities, `no-new-privileges`, memory and process limits, and rotated logs.
- nginx sets the security headers (CSP, HSTS, `nosniff`, ...), limits request size and rate (POST requests: 20 per minute per address), and only forwards `GET` and `POST` on `/api/`.

### Accounts and anti-cheat: what it does and does not protect

- Sign-up with a username and a password (10 to 128 characters). Passwords are hashed with **Argon2id** and never stored or logged in clear. Login errors are generic, and failures are throttled per account (5 per 15 minutes) and per address.
- The session is an `HttpOnly`, `SameSite=Lax`, `Secure` cookie (12 h). State-changing requests need a CSRF token (double-submit cookie). Sessions live in the API's memory: a restart signs everybody out.
- A score is attached to the logged-in account (the name is never taken from the request). The server only accepts it for a game it saw start (`POST /api/games`, single use, same difficulty) and runs cheap plausibility checks (minimum duration, lines and score bounded by elapsed time, level consistent with lines), plus a per-account rate limit.
- **What this stops**: anonymous or forged scores, impersonation, spam, and absurd values sent with `curl`.
- **What it does not stop**: the game runs in the browser, so a determined cheater can script a *plausible* game, or tamper with the client. Only replaying the game on the server would prevent that.
- Known trade-offs: anyone can lock a *known* username for 15 minutes with 5 bad logins (the price of brute-force protection). The throttles key on the client address seen by nginx: after the first deploy, check that it is the visitor's real address (add Traefik's network to `set_real_ip_from` otherwise). The CSRF cookie is not bound to the session, so do not host untrusted apps on sibling subdomains.
- **Guest mode** is a convenience, not a lock: the one-minute timer is kept in the browser (clearing site data resets it). What the server does enforce is that guests can never save a score.

## Secrets

The repository is public and contains **no secrets**. The MongoDB passwords are read from `.env` locally (git-ignored, see `.env.example`) and from Coolify environment variables in production. CI generates a throwaway password for each run.
