const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

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

  // Delete all users
  await conn.execute("DELETE FROM users");
  console.log('Cleared users table');

  // Create fresh admin with a simple known password
  const id = 'cm3x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const password = '@Lan1958';
  const hash = await bcrypt.hash(password, 10);
  
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('Verify:', await bcrypt.compare(password, hash));

  await conn.execute(
    `INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, 'ADMIN', NOW(3), NOW(3))`,
    [id, 'tyler.hackworth@aol.com', hash, 'Tyler Hackworth']
  );
  console.log('\nCreated user:', id);

  // Read it back and verify
  const [rows] = await conn.execute("SELECT * FROM users WHERE email = 'tyler.hackworth@aol.com'");
  console.log('\nStored hash:', rows[0].password_hash);
  const valid = await bcrypt.compare(password, rows[0].password_hash);
  console.log('Password verify after read:', valid);

  await conn.end();
  console.log('\nDone!');
}

run().catch(e => console.error('ERROR:', e.message));
