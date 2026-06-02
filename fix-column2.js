const mysql = require('mysql2/promise');

async function run() {
  const url = process.env.DATABASE_URL;
  const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  const conn = await mysql.createConnection({
    host: match[3],
    port: parseInt(match[4]),
    user: match[1],
    password: match[2],
    database: match[5],
    ssl: { rejectUnauthorized: true }
  });

  // Rename back to referral_source
  await conn.execute('ALTER TABLE users CHANGE COLUMN reset_referral_source referral_source VARCHAR(255) NULL');
  console.log('Renamed reset_referral_source -> referral_source');

  const [cols] = await conn.execute('SHOW COLUMNS FROM users');
  console.log('Columns:');
  cols.forEach(c => console.log(' ', c.Field));

  await conn.end();
  console.log('Done!');
}

run().catch(e => console.error('ERROR:', e.message));
