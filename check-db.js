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

  // List all tables
  const [tables] = await conn.execute('SHOW TABLES');
  console.log('=== ALL TABLES ===');
  for (const t of tables) {
    const tableName = Object.values(t)[0];
    const [count] = await conn.execute(`SELECT COUNT(*) as cnt FROM \`${tableName}\``);
    console.log(`  ${tableName}: ${count[0].cnt} rows`);
  }

  await conn.end();
}
run().catch(e => console.error(e));
