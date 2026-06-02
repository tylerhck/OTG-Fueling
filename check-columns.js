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

  const [cols] = await conn.execute('DESCRIBE users');
  console.log('Users table columns:');
  cols.forEach(c => console.log(`  ${c.Field}: ${c.Type} ${c.Null} ${c.Key}`));

  await conn.end();
}

run().catch(e => console.error('ERROR:', e.message));
