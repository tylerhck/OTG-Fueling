require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const url = process.env.DATABASE_URL;
  const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (!match) { console.log('Failed to parse URL'); return; }
  const [, user, password, host, port, database] = match;
  
  const conn = await mysql.createConnection({
    host, port: parseInt(port), user, password, database,
    ssl: { rejectUnauthorized: true }
  });
  
  // Check table structure
  const [cols] = await conn.query("DESCRIBE canvass_pins");
  console.log("Table columns:", cols.map(c => c.Field).join(', '));
  
  // Check existing rows
  const [rows] = await conn.query("SELECT * FROM canvass_pins");
  console.log("Existing rows:", rows.length);
  if (rows.length > 0) {
    console.log("First row:", JSON.stringify(rows[0]).substring(0, 200));
  }
  
  // Try inserting a test row
  const testId = 'test_' + Date.now();
  await conn.query(
    "INSERT INTO canvass_pins (id, lat, lng, color, label, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(3), NOW(3))",
    [testId, 32.87, -97.32, '#E53935', 'Test Zone', '[[32.87,-97.32],[32.871,-97.32],[32.871,-97.321]]']
  );
  console.log("Test insert successful, id:", testId);
  
  // Read it back
  const [check] = await conn.query("SELECT * FROM canvass_pins WHERE id = ?", [testId]);
  console.log("Read back:", check.length > 0 ? "SUCCESS" : "FAILED");
  if (check.length > 0) console.log("Data:", JSON.stringify(check[0]));
  
  // Clean up test
  await conn.query("DELETE FROM canvass_pins WHERE id = ?", [testId]);
  console.log("Test row cleaned up");
  
  await conn.end();
}
run().catch(e => { console.error("Error:", e.message); process.exit(1); });
