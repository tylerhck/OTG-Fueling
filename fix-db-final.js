const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

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

  console.log('Connected. Dropping all tables and recreating...');
  
  // Drop everything
  await conn.execute('SET FOREIGN_KEY_CHECKS = 0');
  const [tables] = await conn.execute('SHOW TABLES');
  for (const t of tables) {
    const tableName = Object.values(t)[0];
    await conn.execute(`DROP TABLE IF EXISTS \`${tableName}\``);
    console.log('  Dropped:', tableName);
  }
  await conn.execute('SET FOREIGN_KEY_CHECKS = 1');

  console.log('\nNow running prisma db push to let Prisma create tables exactly as it expects...');
  
  await conn.end();
}

run().catch(e => console.error('ERROR:', e.message));
