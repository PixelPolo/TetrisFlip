# Contributor notes

- The `e2e` job is disabled in CI (too slow). Before merging any PR, run the end-to-end tests locally and make sure they pass:
  `docker compose up --build -d` (with `COMPOSE_FILE=docker-compose.yml:docker-compose.local.yml` in `.env`), then `cd e2e && npm ci && npx playwright install chromium && npm test`.
- The only required CI check is `ci-ok` (frontend + backend).
- The repository is public: never commit secrets.
- Everything user-facing is documented in French and English (`README.md`, `README.fr.md`); code is in English.
