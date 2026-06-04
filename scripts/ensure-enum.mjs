// Ensures the orders.status enum includes UNRESOLVED
// Runs after prisma db push to fix any enum sync issues
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
  connectTimeout: 10000,
};
if (needsSsl) {
  config.ssl = { rejectUnauthorized: false };
}

async function run() {
  let conn;
  try {
    conn = await mariadb.createConnection(config);
    const [cols] = await conn.query("SHOW COLUMNS FROM orders LIKE 'status'");
    const currentType = cols?.Type || "";
    console.log("Current status enum:", currentType);

    if (!currentType.includes("UNRESOLVED")) {
      console.log("Adding UNRESOLVED to enum...");
      await conn.query(
        "ALTER TABLE orders MODIFY COLUMN status ENUM('AWAITING_PAYMENT','PENDING','CONFIRMED','ACTIVE','IN_PROGRESS','COMPLETED','CANCELLED','UNRESOLVED') NOT NULL DEFAULT 'PENDING'"
      );
      console.log("DONE - UNRESOLVED added");
    } else {
      console.log("UNRESOLVED already present - no action needed");
    }
  } catch (e) {
    console.error("ensure-enum error:", e.message);
    // Don't fail the build
  } finally {
    if (conn) await conn.end();
  }
}

run();
