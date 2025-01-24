const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  max: 20,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    const client = await pool.connect();
    client.release();
  } catch (err) {
    console.error('Error connecting to database:', err.stack);
  }
})();

module.exports = pool;
