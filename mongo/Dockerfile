FROM mongo:9.0
# Creates the least-privileged application user on the first start of an empty volume.
COPY init-app-user.js /docker-entrypoint-initdb.d/10-app-user.js
