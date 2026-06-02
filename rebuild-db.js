const mysql = require('mysql2/promise');
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
    ssl: { rejectUnauthorized: true },
    multipleStatements: true
  });

  console.log('Connected. Dropping existing tables...');

  // Drop all tables in correct order (respecting foreign keys)
  await conn.execute('SET FOREIGN_KEY_CHECKS = 0');
  const [tables] = await conn.execute('SHOW TABLES');
  for (const t of tables) {
    const tableName = Object.values(t)[0];
    await conn.execute(`DROP TABLE IF EXISTS \`${tableName}\``);
    console.log(`  Dropped: ${tableName}`);
  }
  await conn.execute('SET FOREIGN_KEY_CHECKS = 1');

  console.log('\nCreating tables...');

  // Users
  await conn.execute(`
    CREATE TABLE users (
      id VARCHAR(30) NOT NULL PRIMARY KEY,
      email VARCHAR(320) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      referral_source VARCHAR(255),
      role ENUM('CUSTOMER','ADMIN') NOT NULL DEFAULT 'CUSTOMER',
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    )
  `);
  console.log('  Created: users');

  // Vehicles
  await conn.execute(`
    CREATE TABLE vehicles (
      id VARCHAR(30) NOT NULL PRIMARY KEY,
      user_id VARCHAR(30) NOT NULL,
      nickname VARCHAR(255),
      make VARCHAR(255) NOT NULL,
      model VARCHAR(255) NOT NULL,
      year INT NOT NULL,
      color VARCHAR(100) NOT NULL,
      license_plate VARCHAR(50),
      notes TEXT,
      fuel_cap_side ENUM('LEFT','RIGHT','REAR','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
      fuel_type ENUM('REGULAR_87','PREMIUM_93','DIESEL') NOT NULL DEFAULT 'REGULAR_87',
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      deleted_at DATETIME(3),
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  console.log('  Created: vehicles');

  // Boats
  await conn.execute(`
    CREATE TABLE boats (
      id VARCHAR(30) NOT NULL PRIMARY KEY,
      user_id VARCHAR(30),
      nickname VARCHAR(255),
      make VARCHAR(255),
      model VARCHAR(255),
      year INT,
      color VARCHAR(100),
      registration_number VARCHAR(100) NOT NULL,
      notes TEXT,
      fuel_type ENUM('REGULAR_87','PREMIUM_93','DIESEL') NOT NULL DEFAULT 'REGULAR_87',
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      deleted_at DATETIME(3),
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  console.log('  Created: boats');

  // Addresses
  await conn.execute(`
    CREATE TABLE addresses (
      id VARCHAR(30) NOT NULL PRIMARY KEY,
      user_id VARCHAR(30) NOT NULL,
      label VARCHAR(255),
      street VARCHAR(500) NOT NULL,
      city VARCHAR(255) NOT NULL,
      state VARCHAR(50) NOT NULL,
      zip VARCHAR(20) NOT NULL,
      lat DOUBLE NOT NULL,
      lng DOUBLE NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  console.log('  Created: addresses');

  // Service Areas
  await conn.execute(`
    CREATE TABLE service_areas (
      id VARCHAR(30) NOT NULL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      center_lat DOUBLE NOT NULL,
      center_lng DOUBLE NOT NULL,
      radius_miles DOUBLE NOT NULL,
      polygon JSON,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    )
  `);
  console.log('  Created: service_areas');

  // Service Schedules
  await conn.execute(`
    CREATE TABLE service_schedules (
      id VARCHAR(30) NOT NULL PRIMARY KEY,
      day_of_week ENUM('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY') NOT NULL,
      service_area_id VARCHAR(30) NOT NULL,
      description TEXT,
      start_time VARCHAR(10) NOT NULL,
      end_time VARCHAR(10) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      slot_minutes INT NOT NULL DEFAULT 15,
      capacity_per_slot INT NOT NULL DEFAULT 1,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      FOREIGN KEY (service_area_id) REFERENCES service_areas(id) ON DELETE CASCADE
    )
  `);
  console.log('  Created: service_schedules');

  // Schedule Slot Overrides
  await conn.execute(`
    CREATE TABLE schedule_slot_overrides (
      id VARCHAR(30) NOT NULL PRIMARY KEY,
      schedule_id VARCHAR(30) NOT NULL,
      slot_start VARCHAR(10) NOT NULL,
      is_closed BOOLEAN NOT NULL DEFAULT TRUE,
      capacity_override INT,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      FOREIGN KEY (schedule_id) REFERENCES service_schedules(id) ON DELETE CASCADE,
      UNIQUE KEY unique_schedule_slot (schedule_id, slot_start)
    )
  `);
  console.log('  Created: schedule_slot_overrides');

  // Fuel Prices
  await conn.execute(`
    CREATE TABLE fuel_prices (
      id VARCHAR(30) NOT NULL PRIMARY KEY,
      fuel_type ENUM('REGULAR_87','PREMIUM_93','DIESEL') NOT NULL UNIQUE,
      base_price_cents INT NOT NULL,
      markup_percent DOUBLE NOT NULL,
      effective_price_cents INT NOT NULL,
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    )
  `);
  console.log('  Created: fuel_prices');

  // Orders
  await conn.execute(`
    CREATE TABLE orders (
      id VARCHAR(30) NOT NULL PRIMARY KEY,
      user_id VARCHAR(30),
      vehicle_id VARCHAR(30),
      address_id VARCHAR(30),
      fuel_type ENUM('REGULAR_87','PREMIUM_93','DIESEL'),
      gallons DOUBLE,
      price_per_gallon_cents INT,
      delivery_fee_cents INT NOT NULL DEFAULT 0,
      total_cents INT NOT NULL,
      stripe_payment_intent_id VARCHAR(255),
      stripe_customer_id VARCHAR(255),
      stripe_payment_method_id VARCHAR(255),
      status ENUM('AWAITING_PAYMENT','PENDING','CONFIRMED','ACTIVE','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'AWAITING_PAYMENT',
      scheduled_at DATETIME(3),
      available_from VARCHAR(10),
      available_to VARCHAR(10),
      eta_minutes INT,
      notes TEXT,
      subscription_delivery BOOLEAN NOT NULL DEFAULT FALSE,
      is_fill_up BOOLEAN NOT NULL DEFAULT FALSE,
      auth_amount_cents INT,
      pin_lat DOUBLE,
      pin_lng DOUBLE,
      sms_notified_at DATETIME(3),
      guest_name VARCHAR(255),
      guest_email VARCHAR(320),
      guest_phone VARCHAR(50),
      guest_vehicle TEXT,
      guest_address TEXT,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
      FOREIGN KEY (address_id) REFERENCES addresses(id)
    )
  `);
  console.log('  Created: orders');

  // Order Items
  await conn.execute(`
    CREATE TABLE order_items (
      id VARCHAR(30) NOT NULL PRIMARY KEY,
      order_id VARCHAR(30) NOT NULL,
      kind ENUM('PRIMARY_VEHICLE','SECOND_VEHICLE','TRAILERED_BOAT','PRIMARY_BOAT','DEF_ADDON','DEF_ONLY') NOT NULL,
      vehicle_id VARCHAR(30),
      boat_id VARCHAR(30),
      fuel_type ENUM('REGULAR_87','PREMIUM_93','DIESEL') NOT NULL,
      gallons DOUBLE,
      is_fill_up BOOLEAN NOT NULL DEFAULT FALSE,
      price_per_gallon_cents INT NOT NULL,
      gas_cents INT NOT NULL DEFAULT 0,
      service_fee_cents INT NOT NULL DEFAULT 0,
      auth_amount_cents INT,
      notes TEXT,
      item_make VARCHAR(255),
      item_model VARCHAR(255),
      item_year INT,
      item_color VARCHAR(100),
      item_plate VARCHAR(50),
      item_reg_number VARCHAR(100),
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
      FOREIGN KEY (boat_id) REFERENCES boats(id)
    )
  `);
  console.log('  Created: order_items');

  // Notifications
  await conn.execute(`
    CREATE TABLE notifications (
      id VARCHAR(30) NOT NULL PRIMARY KEY,
      order_id VARCHAR(30) NOT NULL,
      user_id VARCHAR(30),
      type ENUM('EMAIL','SMS','PUSH') NOT NULL,
      status ENUM('QUEUED','SENT','FAILED') NOT NULL DEFAULT 'QUEUED',
      sent_at DATETIME(3),
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  console.log('  Created: notifications');

  // Site Settings
  await conn.execute(`
    CREATE TABLE site_settings (
      \`key\` VARCHAR(255) NOT NULL PRIMARY KEY,
      value VARCHAR(500) NOT NULL,
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    )
  `);
  console.log('  Created: site_settings');

  // Subscriptions
  await conn.execute(`
    CREATE TABLE subscriptions (
      id VARCHAR(30) NOT NULL PRIMARY KEY,
      user_id VARCHAR(30) NOT NULL,
      stripe_subscription_id VARCHAR(255) NOT NULL UNIQUE,
      stripe_customer_id VARCHAR(255) NOT NULL,
      status ENUM('ACTIVE','PAST_DUE','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
      current_period_start DATETIME(3) NOT NULL,
      current_period_end DATETIME(3) NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  console.log('  Created: subscriptions');

  // Waitlist
  await conn.execute(`
    CREATE TABLE waitlist (
      id VARCHAR(30) NOT NULL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(320) NOT NULL UNIQUE,
      phone VARCHAR(50),
      zip VARCHAR(20) NOT NULL,
      city VARCHAR(255),
      state VARCHAR(50),
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    )
  `);
  console.log('  Created: waitlist');

  // Password Reset Tokens
  await conn.execute(`
    CREATE TABLE password_reset_tokens (
      id VARCHAR(30) NOT NULL PRIMARY KEY,
      user_id VARCHAR(30) NOT NULL,
      token VARCHAR(255) NOT NULL UNIQUE,
      expires_at DATETIME(3) NOT NULL,
      used_at DATETIME(3),
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  console.log('  Created: password_reset_tokens');

  // Recurring Orders
  await conn.execute(`
    CREATE TABLE recurring_orders (
      id VARCHAR(30) NOT NULL PRIMARY KEY,
      user_id VARCHAR(30) NOT NULL,
      vehicle_id VARCHAR(30),
      boat_id VARCHAR(30),
      address_id VARCHAR(30) NOT NULL,
      fuel_type ENUM('REGULAR_87','PREMIUM_93','DIESEL') NOT NULL DEFAULT 'REGULAR_87',
      is_fill_up BOOLEAN NOT NULL DEFAULT TRUE,
      gallons DOUBLE,
      day_of_week ENUM('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY') NOT NULL,
      preferred_time VARCHAR(10) NOT NULL DEFAULT '09:00',
      window_from VARCHAR(10),
      window_to VARCHAR(10),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      notes TEXT,
      last_order_id VARCHAR(30),
      last_order_date DATE,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
      FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE CASCADE
    )
  `);
  console.log('  Created: recurring_orders');

  // SMS Recipients
  await conn.execute(`
    CREATE TABLE sms_recipients (
      id VARCHAR(30) NOT NULL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    )
  `);
  console.log('  Created: sms_recipients');

  // Push Tokens
  await conn.execute(`
    CREATE TABLE push_tokens (
      id VARCHAR(30) NOT NULL PRIMARY KEY,
      user_id VARCHAR(30) NOT NULL,
      token VARCHAR(500) NOT NULL,
      platform VARCHAR(20) NOT NULL DEFAULT 'ios',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_user_token (user_id, token)
    )
  `);
  console.log('  Created: push_tokens');

  // Canvass Pins
  await conn.execute(`
    CREATE TABLE canvass_pins (
      id VARCHAR(30) NOT NULL PRIMARY KEY,
      lat DOUBLE NOT NULL,
      lng DOUBLE NOT NULL,
      color VARCHAR(20) NOT NULL DEFAULT '#E53935',
      label VARCHAR(255),
      notes TEXT,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    )
  `);
  console.log('  Created: canvass_pins');

  // Now create admin user
  console.log('\nCreating admin account...');
  const bcrypt = require('bcryptjs');
  const passwordHash = await bcrypt.hash('@Lan1958', 12);
  const adminId = 'cm' + crypto.randomBytes(12).toString('hex').slice(0, 22);
  
  await conn.execute(
    `INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, 'ADMIN')`,
    [adminId, 'tyler.hackworth@aol.com', passwordHash, 'Tyler Hackworth']
  );
  console.log('  Admin account created: tyler.hackworth@aol.com');

  // Re-add SMS recipient
  const smsId = 'cm' + crypto.randomBytes(12).toString('hex').slice(0, 22);
  await conn.execute(
    `INSERT INTO sms_recipients (id, name, phone) VALUES (?, 'Tyler', '+18173001234')`,
    [smsId]
  );
  console.log('  SMS recipient re-added');

  // Add default fuel prices
  const fp1 = 'cm' + crypto.randomBytes(12).toString('hex').slice(0, 22);
  const fp2 = 'cm' + crypto.randomBytes(12).toString('hex').slice(0, 22);
  const fp3 = 'cm' + crypto.randomBytes(12).toString('hex').slice(0, 22);
  await conn.execute(`INSERT INTO fuel_prices (id, fuel_type, base_price_cents, markup_percent, effective_price_cents) VALUES (?, 'REGULAR_87', 280, 15, 322)`, [fp1]);
  await conn.execute(`INSERT INTO fuel_prices (id, fuel_type, base_price_cents, markup_percent, effective_price_cents) VALUES (?, 'PREMIUM_93', 340, 15, 391)`, [fp2]);
  await conn.execute(`INSERT INTO fuel_prices (id, fuel_type, base_price_cents, markup_percent, effective_price_cents) VALUES (?, 'DIESEL', 320, 15, 368)`, [fp3]);
  console.log('  Default fuel prices added');

  // Add site settings for page views
  await conn.execute(`INSERT INTO site_settings (\`key\`, value) VALUES ('page_views_total', '0')`);
  await conn.execute(`INSERT INTO site_settings (\`key\`, value) VALUES ('unique_visitors_total', '0')`);
  console.log('  Site settings initialized');

  await conn.end();
  console.log('\n✅ Database rebuilt successfully!');
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
