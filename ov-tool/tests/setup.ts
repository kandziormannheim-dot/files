// DB-Tests laufen gegen TEST_DATABASE_URL (eigene Datenbank, wird geleert!). Ohne Variable werden sie übersprungen.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
