# TetrisFlip

🇬🇧 English · [🇫🇷 Français](README.fr.md)

A 3D Tetris that runs in your browser, where the **camera orbits the board** and the **board flips like an hourglass**.

## The game

- Classic Tetris rules: 7-bag randomizer, SRS rotations and wall kicks, hold, levels.
- **Two difficulties, chosen before you play**: *Easy* shows a ghost piece (where the piece will land), *Hard* does not. Each has its own leaderboard.
- Pieces and board in 3D (Three.js). Two themes: modern colours, or the original **Game Boy green**.
- **Bullet time**: after a random delay (10 to 60 s, `bulletEveryMs`) the pieces slow right down while the camera sweeps half way around the board with a tilt and motion trails, Matrix style. You then play from the other side with **left/right (and rotations) mirrored**, at half speed, for 6 to 10 s early in the game and 10 to 20 s later. A second bullet time brings you back to normal. In *Easy* mode a small countdown shows when the next bullet time comes.
- **Spinning bullet time**: from level 5 (`spinFromLevel`) a bullet time no longer flips half way round and back. It comes as often as before, but the camera turns around the board non stop for a random time (same bounds as the mirrored phase), faster with each level (`spinDegPerSecond`), then slows down and stops in front. The pieces fall at the normal speed of the level and left/right stay inverted whenever the camera is behind the board. The board frame is blue in front and turns red when the camera is behind. The sense of rotation alternates from one bullet time to the next (clockwise, then counter-clockwise, and so on), for the half turn as well as for the spin.
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

Each service is its **own Coolify resource**, built from its own Dockerfile in this repository: MongoDB, the API and the frontend. There is no Docker Compose resource. `docker-compose.yml` is for local development only.

Create them in this order, and wait for each one to be **healthy** before creating the next:

1. `tetrisflip-mongo` (folder `/mongo`)
2. `tetrisflip-api` (folder `/backend`)
3. `tetrisflip` (the frontend, folder `/frontend`)

Coolify names each container after its resource, with a suffix. The name is not `tetrisflip-mongo`: note the two container names (shown in the resource's logs, or with `docker ps` on the server). You need them for `MONGODB_URI` and `BACKEND_URL`.

### Settings shared by the three resources

- Source: this repository, branch `main`, build pack **Dockerfile**, base directory as listed above.
- **Connect to Predefined Network**: enabled on all three, so the containers reach each other by name and Traefik reaches the frontend.
- Never set `COMPOSE_FILE` on Coolify: `docker-compose.local.yml` publishes host ports and is for your laptop only.
- Passwords are **runtime secrets only**, set in the Coolify UI. Generate them with `openssl rand -hex 24` (hex only: the password goes into a URI).

> **Network trade-off.** The predefined network is shared with the other Coolify applications on this server. With the compose file, MongoDB and the API sat on a private network with no route in or out. In this mode, any container on the shared network can open a connection to MongoDB and to the API. MongoDB still requires authentication with the least-privileged application user, which limits the damage, but the isolation is weaker than before. If another application on the server is not trusted, do not use this mode.

### 1. MongoDB (`tetrisflip-mongo`)

- Runtime variables:
  - `MONGO_INITDB_ROOT_USERNAME` = `root`
  - `MONGO_INITDB_ROOT_PASSWORD` = a new secret
  - `MONGO_APP_USER` = `tetrisflip`
  - `MONGO_APP_PASSWORD` = a secret, **the same value as on the API**
- The official image turns on authentication only when the `MONGO_INITDB_ROOT_*` variables are set. Never start it without them.
- Persistent storage: volume `tetrisflip-mongo-data` on `/data/db` (the database), and volume `tetrisflip-mongo-backup` on `/backup` (the dumps).
- Start command, if Coolify offers a field for it: `mongod --wiredTigerCacheSizeGB 0.25`. Custom Docker options: `--memory 512m --pids-limit 200`.
- No domain, no published port.
- Health check: built into the image (`mongosh` ping). The user `tetrisflip` is created by the image's init script, **only on an empty data volume**.

### 2. API (`tetrisflip-api`)

- Port: `8080`. No domain.
- Runtime variables:
  - `MONGODB_URI` = `mongodb://tetrisflip:<MONGO_APP_PASSWORD>@<MongoDB container name>:27017/tetrisflip?serverSelectionTimeoutMS=3000`
- Health check: `GET /actuator/health/readiness` on port `8080` (the image has the same check).
- Custom Docker options, the equivalent of the compose hardening: `--read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges:true --memory 768m --pids-limit 200`.

### 3. Frontend (`tetrisflip`)

- Port: `8080`. Domain: `https://your-domain`, with the HTTPS redirect enabled. This is the only resource with a domain.
- Runtime variables:
  - `BACKEND_URL` = `http://<API container name>:8080`. Required: the image default (`tetrisflip-api`) is only the compose service name.
- Health check: `GET /` on port `8080`.
- Custom Docker options: `--read-only --tmpfs /tmp --tmpfs /var/cache/nginx:uid=101,gid=101 --tmpfs /etc/nginx/conf.d:uid=101,gid=101 --cap-drop ALL --security-opt no-new-privileges:true --memory 128m --pids-limit 100`.

Coolify does not apply the compose hardening by itself: the custom Docker options above are what keeps the containers read-only, without capabilities and with memory limits. Check that they show up on each resource.

### Checks after the first deploy

1. `https://your-domain/` shows the game, and `http://` redirects to HTTPS.
2. `https://your-domain/api/scores?difficulty=easy` returns JSON (the API is reached through the frontend).
3. Over HTTPS: sign up, reload (you stay signed in), log out, log in, play a game and save a score. The session cookie is `Secure`, so it only works over HTTPS.
4. Rate limits use the visitor address that nginx sees. Make 6 wrong passwords in a row on one account (you get a 429), then check from another device that you are not blocked too. If every visitor looks identical, add Traefik's Docker network range to `set_real_ip_from` in `frontend/nginx/default.conf.template`.

### Backups

A MongoDB in Coolify has no automatic backup. Add a **Scheduled Task** on `tetrisflip-mongo`, daily, that dumps the application database into the backup volume:

```bash
mongodump --username root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db tetrisflip --gzip --archive=/backup/tetrisflip-$(date +%F).archive.gz
find /backup -name 'tetrisflip-*.archive.gz' -mtime +14 -delete
```

Check first in the Terminal that `mongodump --version` works in the image. A backup that stays on the server is not a backup: copy the files of `tetrisflip-mongo-backup` off the server regularly.

### Reset the data

Never run `dropDatabase`. It also deletes the application user, which is only recreated on an empty volume, so the API would stop logging in to MongoDB. To empty the accounts and scores only, open the Terminal of `tetrisflip-mongo` and run:

```bash
mongosh --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin tetrisflip --eval 'db.users.deleteMany({}); db.scores.deleteMany({})'
```

### Migrating from the old compose stack (once)

The old single stack has its own `mongo-data` volume. Keep it until the new stack is verified.

1. In the old Compose resource, stop the `frontend` service: nothing reaches the API any more. Keep MongoDB running.
2. In the Terminal of the old `tetrisflip-mongo`, run the dump command above with `--archive=/tmp/tetrisflip.archive.gz`. Copy the file to the server: `docker cp <old MongoDB container>:/tmp/tetrisflip.archive.gz ~/`.
3. Stop the whole old stack, and remove its domain, because the new frontend will use it.
4. Create the three new resources, with the **same** `MONGO_APP_PASSWORD` as before, and wait for MongoDB to be healthy. Copy the file into the new backup volume: `docker cp ~/tetrisflip.archive.gz <new MongoDB container>:/backup/`.
5. In the Terminal of the new `tetrisflip-mongo`, restore it. Do **not** add `--drop`:
   ```bash
   mongorestore --username root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --gzip --archive=/backup/tetrisflip.archive.gz --nsInclude 'tetrisflip.*'
   ```
6. Compare the counts in both databases (`db.users.countDocuments({})` and `db.scores.countDocuments({})`), then run the checks above.
7. Delete the old Compose resource, and **answer no** when Coolify asks whether to delete its volumes. Remove the old `mongo-data` volume by hand only after the new stack has run for a while and the backups are confirmed.

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

- Only the frontend (nginx) has a public domain. In the local compose file, MongoDB and the API sit on an internal Docker network with no route to the outside. On Coolify they share the predefined network instead: read the trade-off in *Deploy on Coolify*.
- The app connects to MongoDB with its own user (`readWrite` on `tetrisflip` only); the root account is never used by the app. The user is created on the first start of an empty volume, so on an existing volume create it once with `mongosh` or recreate the volume.
- Containers run as non-root, with a read-only filesystem, no capabilities, `no-new-privileges`, memory and process limits, and rotated logs. The compose file sets all of this; on Coolify it comes from the custom Docker options listed in the deploy steps.
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
