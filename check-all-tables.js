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

  const [tables] = await conn.execute('SHOW TABLES');
  console.log('Tables and row counts:');
  for (const t of tables) {
    const tableName = Object.values(t)[0];
    try {
      const [rows] = await conn.execute(`SELECT COUNT(*) as cnt FROM \`${tableName}\``);
      console.log(`  ${tableName}: ${rows[0].cnt} rows`);
    } catch (e) {
      console.log(`  ${tableName}: ERROR - ${e.message}`);
    }
  }

  // Check service_areas specifically
  try {
    const [areas] = await conn.execute('SELECT * FROM service_areas');
    console.log('\nService Areas:', JSON.stringify(areas, null, 2));
  } catch(e) {
    console.log('\nNo service_areas table or error:', e.message);
  }

  await conn.end();
}

run().catch(e => console.error('ERROR:', e.message));
