FROM mongo:9.0
# Creates the least-privileged application user on the first start of an empty volume.
COPY init-app-user.js /docker-entrypoint-initdb.d/10-app-user.js
# On Coolify the API waits for this check before it starts (same command as docker-compose.yml).
HEALTHCHECK --interval=5s --timeout=5s --start-period=30s --retries=20 \
    CMD ["mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok"]
