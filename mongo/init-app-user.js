// Runs once, on an empty data volume. The application never uses the root account:
// it gets readWrite on its own database only.
db.getSiblingDB('tetrisflip').createUser({
  user: process.env.MONGO_APP_USER,
  pwd: process.env.MONGO_APP_PASSWORD,
  roles: [{ role: 'readWrite', db: 'tetrisflip' }],
});
