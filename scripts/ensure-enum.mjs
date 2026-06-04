// Ensures the orders.status column is VARCHAR(50) to avoid enum sync issues
// Runs AFTER prisma db push in the build pipeline
import mariadb from "mariadb";

const dbUrl = new URL(process.env.DATABASE_URL);
const needsSsl =
  dbUrl.hostname.includes("ondigitalocean.com") ||
  dbUrl.searchParams.get("ssl") === "true" ||
  dbUrl.searchParams.get("sslmode") === "REQUIRED";

const config = {
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port || "3306"),
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  database: dbUrl.pathname.slice(1),
  connectTimeout: 15000,
};
if (needsSsl) {
  config.ssl = { rejectUnauthorized: false };
}

async function run() {
  let conn;
  try {
    conn = await mariadb.createConnection(config);
    const cols = await conn.query("SHOW COLUMNS FROM orders LIKE 'status'");
    const currentType = (cols[0]?.Type || "").toLowerCase();
    console.log("Current status column type:", currentType);

    // If it's still an enum (not varchar), convert it
    if (currentType.includes("enum")) {
      console.log("Converting status column from ENUM to VARCHAR(50)...");
      await conn.query(
        "ALTER TABLE orders MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'PENDING'"
      );
      console.log("DONE - status is now VARCHAR(50)");
    } else {
      console.log("status is already VARCHAR - no action needed");
    }
  } catch (e) {
    console.error("ensure-enum error:", e.message);
    // Don't fail the build
  } finally {
    if (conn) await conn.end();
  }
}

run();
