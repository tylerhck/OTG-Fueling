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

  // Delete existing user
  await conn.execute("DELETE FROM users WHERE email = 'tyler.hackworth@aol.com'");
  console.log('Deleted old account');

  // Create new one with proper cuid format
  const id = 'cm3x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const passwordHash = await bcrypt.hash('@Lan1958', 12);
  
  await conn.execute(
    `INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, 'ADMIN', NOW(3), NOW(3))`,
    [id, 'tyler.hackworth@aol.com', passwordHash, 'Tyler Hackworth']
  );
  console.log('Created new admin:', id);
  console.log('Email: tyler.hackworth@aol.com');
  console.log('Password: @Lan1958');

  // Verify
  const [rows] = await conn.execute("SELECT id, email, password_hash, role FROM users WHERE email = 'tyler.hackworth@aol.com'");
  console.log('\nVerification:', rows[0]);
  
  // Test password
  const valid = await bcrypt.compare('@Lan1958', rows[0].password_hash);
  console.log('Password match:', valid);

  await conn.end();
}

run().catch(e => console.error('ERROR:', e));
