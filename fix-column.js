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

  // Check current columns
  const [cols] = await conn.execute('SHOW COLUMNS FROM users');
  console.log('Current columns:');
  cols.forEach(c => console.log(' ', c.Field));

  // The error says it's looking for "reset_referral_source" but we have "referral_source"
  // Let's add the column it's looking for, or maybe it's a different issue
  // Actually the error might be that the Prisma client generated during build expects a different column name
  // Let's just add the column if it doesn't exist
  const hasResetReferral = cols.some(c => c.Field === 'reset_referral_source');
  const hasReferral = cols.some(c => c.Field === 'referral_source');
  
  console.log('\nhas referral_source:', hasReferral);
  console.log('has reset_referral_source:', hasResetReferral);

  if (hasReferral && !hasResetReferral) {
    // Rename to what Prisma expects
    await conn.execute('ALTER TABLE users CHANGE COLUMN referral_source reset_referral_source VARCHAR(255) NULL');
    console.log('\nRenamed referral_source -> reset_referral_source');
  }

  // Verify
  const [cols2] = await conn.execute('SHOW COLUMNS FROM users');
  console.log('\nUpdated columns:');
  cols2.forEach(c => console.log(' ', c.Field));

  await conn.end();
  console.log('\nDone!');
}

run().catch(e => console.error('ERROR:', e.message));
