const mysql = require('mysql2/promise');

let pool;

async function initDB() {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'projectflow',
    waitForConnections: true,
    connectionLimit: 10,
  });

  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
  console.log('✓ Database connected');
}

function getDB() {
  if (!pool) throw new Error('Database not initialized');
  return pool;
}

module.exports = { initDB, getDB };
