# On The Go Fueling

Mobile fuel delivery platform for the Fort Worth metro area. Customers order fuel to their vehicle, boat, or DEF fluid at their location; admins manage service areas, schedules, pricing, and fulfillment.

Built with **Next.js 16** (App Router), **Prisma 7**, **MySQL/MariaDB**, **Stripe**, and **NextAuth.js**.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Order lifecycle](#order-lifecycle)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Environment variables](#environment-variables)
- [Local development](#local-development)
- [Database](#database)
- [Stripe setup](#stripe-setup)
- [Docker](#docker)
- [Production deployment](#production-deployment)
- [Business rules (quick reference)](#business-rules-quick-reference)
- [Security](#security)
- [Scripts](#scripts)

---

## Features

### Customer

- Sign up / sign in with email + password
- Save vehicles, boats, and delivery addresses
- Order fuel (Regular 87, Premium 93, Diesel) — ASAP or scheduled slots
- **Fill Up** mode: $1 card authorization, billed after delivery based on actual gallons
- Subscriber benefits: free first weekly fill-up, discounted second fill-up
- Add-ons: second vehicle, trailered boat, DEF fluid (diesel orders)
- Standalone DEF-only orders (`/order/def`)
- Guest checkout (vehicle and boat flows)
- Order tracking with delivery time windows and status progress
- Monthly subscription via Stripe Checkout

### Admin (`/admin`)

- Dashboard: orders, revenue, customers, gallons delivered, site visitors
- Order queue: confirm with ETA, start delivery, complete, capture fill-up payments
- Service area management (map-based, radius check via haversine)
- Weekly schedule + slot capacity + per-slot overrides
- Fuel pricing (manual + optional EIA API sync)
- User list, waitlist management

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16.2 (App Router, Turbopack, standalone output) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS 4 |
| Database | MySQL / MariaDB via Prisma 7 + `@prisma/adapter-mariadb` |
| Auth | NextAuth.js v5 (JWT, credentials provider) |
| Payments | Stripe (PaymentIntents, Checkout Sessions, webhooks) |
| Validation | Zod 4 |
| Maps | Leaflet / react-leaflet |
| Geocoding | Nominatim (OSM) + US Census fallback |
| Email / SMS | Nodemailer (SMTP), Twilio (optional) |

---

## Architecture

```mermaid
flowchart TB
  subgraph client [Browser]
    Pages[App Router pages]
    StripeJS[Stripe Elements]
  end

  subgraph next [Next.js server]
    Proxy[src/proxy.ts]
    API[Route handlers /api/*]
    Auth[NextAuth]
  end

  subgraph external [External services]
    DB[(MySQL)]
    Stripe[Stripe API]
    SMTP[SMTP / Twilio]
    Geo[Nominatim / Census]
  end

  Pages --> API
  Pages --> Auth
  StripeJS --> Stripe
  Proxy --> Auth
  API --> DB
  API --> Stripe
  API --> SMTP
  API --> Geo
  Stripe -->|webhooks| API
```

**Request flow (authenticated order):**

1. Customer submits order form → `POST /api/orders` → order created as `AWAITING_PAYMENT`
2. Client calls `POST /api/stripe/create-intent` → Stripe PaymentIntent returned
3. Customer pays on `/order/payment` via Stripe Elements
4. Stripe webhook `payment_intent.succeeded` → order moves to `PENDING`
5. Admin confirms with ETA → `CONFIRMED` → customer notified (email/SMS)
6. Admin marks `IN_PROGRESS` → `COMPLETED`

---

## Order lifecycle

| Status | Meaning |
|--------|---------|
| `AWAITING_PAYMENT` | Order shell created; user has not completed payment |
| `PENDING` | Payment received; waiting for admin review / ETA |
| `CONFIRMED` | Admin confirmed; customer notified with delivery window |
| `IN_PROGRESS` | Driver en route |
| `COMPLETED` | Delivered |
| `CANCELLED` | Payment failed or manually cancelled |

`AWAITING_PAYMENT` orders are hidden from the admin active queue. They appear only as an informational count until payment succeeds.

---

## Project structure

```
src/
├── app/
│   ├── admin/              # Admin dashboard pages
│   ├── api/                # Route handlers
│   │   ├── auth/           # NextAuth + signup
│   │   ├── orders/         # Order CRUD + guest flows
│   │   ├── stripe/         # Payment intents + webhooks
│   │   ├── subscription/   # Stripe subscription checkout
│   │   └── admin/          # Admin-only APIs
│   ├── order/              # Customer order flows (vehicle, boat, def, guest, payment)
│   ├── orders/             # My orders
│   ├── profile/            # Account, vehicles, boats, addresses
│   ├── landing.tsx         # Marketing homepage
│   └── page.tsx            # Route entry (landing vs waitlist mode)
├── components/             # Shared UI (Navbar, maps, progress bar, etc.)
├── lib/
│   ├── auth.ts             # NextAuth config
│   ├── prisma.ts           # Prisma client (MariaDB adapter)
│   ├── stripe.ts           # Stripe singleton
│   ├── validators.ts       # Zod schemas
│   ├── subscriptions.ts    # Stripe subscription self-heal
│   ├── deliveryWindow.ts   # ETA window formatting
│   ├── notifications.ts    # Email + SMS
│   ├── geocode.ts          # Address → lat/lng
│   ├── haversine.ts        # Service area distance check
│   └── rateLimit.ts        # In-memory rate limiting
└── proxy.ts                # Auth gate for /admin routes (Next.js 16 proxy convention)
prisma/
├── schema.prisma           # Data model
└── seed.ts                 # Admin user, service area, fuel prices
```

---

## Prerequisites

- **Node.js 20+**
- **MySQL 8** or **MariaDB 10.6+**
- **Stripe account** (test mode for development)
- Optional: SMTP credentials, Twilio, EIA API key for live gas price sync

---

## Environment variables

Create a `.env` file in the project root:

```env
# Database (required)
DATABASE_URL="mysql://user:password@localhost:3306/otgfueling"

# Auth (required)
NEXTAUTH_SECRET="generate-a-long-random-string"
NEXTAUTH_URL="http://localhost:3000"

# Stripe (required for payments)
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Email (optional — notifications skipped if unset)
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="..."
SMTP_PASS="..."
EMAIL_FROM="noreply@otgfueling.com"

# SMS (optional)
TWILIO_ACCOUNT_SID="..."
TWILIO_AUTH_TOKEN="..."
TWILIO_PHONE_NUMBER="+1..."

# Admin gas price sync (optional)
EIA_API_KEY="..."
```

Generate `NEXTAUTH_SECRET`:

```bash
openssl rand -base64 32
```

---

## Local development

```bash
# Install dependencies
npm install

# Push schema to database and generate Prisma client
npx prisma db push
npx prisma generate

# Seed admin user + default service area + fuel prices
npx prisma db seed

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Default seed admin:**

| Field | Value |
|-------|-------|
| Email | `admin@otgfueling.com` |
| Password | `admin123` |

Change this password immediately in any shared or production environment.

---

## Database

Prisma schema lives in `prisma/schema.prisma`. The app uses `prisma db push` (no migration history required for local dev).

**Useful commands:**

```bash
npx prisma db push      # Sync schema to DB
npx prisma generate     # Regenerate client after schema changes
npx prisma db seed      # Run seed script
npx prisma studio       # Visual DB browser
```

### Production schema updates

If deploying to an existing production database, run SQL **before** deploying code that depends on new enum values:

```sql
-- Order status (AWAITING_PAYMENT)
ALTER TABLE `Order`
  MODIFY COLUMN `status` ENUM(
    'AWAITING_PAYMENT','PENDING','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED'
  ) NOT NULL DEFAULT 'AWAITING_PAYMENT';

-- Order item kinds (DEF)
ALTER TABLE `OrderItem`
  MODIFY COLUMN `kind` ENUM(
    'PRIMARY_VEHICLE','SECOND_VEHICLE','TRAILERED_BOAT','PRIMARY_BOAT','DEF_ADDON','DEF_ONLY'
  ) NOT NULL;
```

---

## Stripe setup

### Local webhook forwarding

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

### Events handled

| Event | Action |
|-------|--------|
| `payment_intent.succeeded` | Order → `PENDING` |
| `payment_intent.amount_capturable_updated` | Fill-up auth → `PENDING` |
| `payment_intent.payment_failed` | Order → `CANCELLED` |
| `checkout.session.completed` | Create subscription record |
| `customer.subscription.updated` | Sync subscription status |
| `customer.subscription.deleted` | Mark subscription cancelled |
| `invoice.payment_failed` | Mark subscription past due |

### Subscription self-heal

If a user completes Stripe Checkout but the webhook is delayed, `ensureSubscriptionFromStripe()` in `src/lib/subscriptions.ts` queries Stripe by email and upserts the local subscription record. Called from order creation and fuel-prices endpoints.

---

## Docker

Multi-stage Dockerfile with standalone Next.js output:

```bash
docker build \
  --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_... \
  -t otg-fueling .

docker run -p 3000:3000 \
  -e DATABASE_URL="mysql://..." \
  -e NEXTAUTH_SECRET="..." \
  -e NEXTAUTH_URL="https://yourdomain.com" \
  -e STRIPE_SECRET_KEY="sk_live_..." \
  -e STRIPE_WEBHOOK_SECRET="whsec_..." \
  otg-fueling
```

The container runs as a non-root `nextjs` user on port 3000.

---

## Production deployment

1. Run production SQL enum updates (see [Database](#production-schema-updates))
2. Set all required environment variables
3. Configure Stripe webhook endpoint → `https://yourdomain.com/api/stripe/webhook`
4. Build: `npm run build` (runs `prisma db push`, `prisma generate`, `next build`)
5. Start: `npm start` (standalone server)

**Post-deploy checks:**

- [ ] Sign up / sign in works
- [ ] Stripe test payment completes and order moves to `PENDING`
- [ ] Admin can confirm order and set ETA
- [ ] Webhook events appear in Stripe dashboard
- [ ] Change default admin password

---

## Business rules (quick reference)

| Rule | Value |
|------|-------|
| Standard delivery fee | $15 |
| Subscriber 1st fill-up / week | Free delivery |
| Subscriber 2nd fill-up / week | $10 delivery |
| Boat base fee | $20 |
| Second vehicle add-on | $5 service fee |
| Trailered boat add-on | $10 service fee |
| DEF 2.5 gal | $30 |
| DEF 5 gal | $55 |
| Fill-up max gallons (vehicle) | 30 |
| Fill-up max gallons (boat) | 100 |
| Scheduled delivery window | 2 hours from slot start (default) |

Service area validation uses haversine distance from address coordinates to each active area's center + radius.

---

## Security

- Passwords hashed with **bcrypt** (cost 12)
- All DB access via **Prisma** (parameterized queries)
- Input validated with **Zod** on every API route
- Admin API routes check `role === "ADMIN"`; admin UI layout redirects non-admins
- `/admin` and `/api/admin` gated by `src/proxy.ts` (requires authenticated session)
- Signup rate limit: **5 accounts / hour / IP**
- Sign-in rate limit: **10 attempts / 15 min / email**
- Signup name validation blocks URLs, bit.ly links, and control characters
- No `dangerouslySetInnerHTML` — React auto-escapes rendered user content

**Note:** Rate limiting is in-memory (per process). For multi-instance deployments, consider Redis or Upstash.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (Turbopack) |
| `npm run build` | Push schema, generate client, production build |
| `npm start` | Run standalone production server |
| `npm run lint` | ESLint |
| `npx prisma db seed` | Seed admin, service area, fuel prices |

---

## License

Private — On The Go Fueling. All rights reserved.
