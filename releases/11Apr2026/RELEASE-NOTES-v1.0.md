# RetailOS v1.0 — Release Notes

### Your Complete Pharmacy POS System

**Release Date:** April 2026
**Platform:** Web (Desktop & Mobile browsers)

---

## What is RetailOS?

RetailOS is a modern, cloud-based Point of Sale system purpose-built for **Indian medical and pharmacy shops**. It handles everything from billing and inventory to GST compliance and multi-shop management — so you can focus on running your business, not wrestling with software.

---

## Highlights at a Glance

| Area | What You Get |
|------|-------------|
| **Billing** | Fast bill creation with auto-tax calculation and multiple payment modes |
| **Inventory** | Batch-level stock tracking with expiry alerts and low-stock warnings |
| **GST Compliance** | Automatic CGST/SGST/IGST computation with exportable GST reports |
| **Orders** | Full order history with returns, reprints, and soft-delete |
| **Customers** | Auto-created customer profiles with visit tracking |
| **Dashboard** | Real-time KPIs — today's sales, order count, stock health |
| **Multi-Shop** | Run multiple shops from one account with complete data isolation |
| **Security** | JWT authentication, 2FA for super admin, encrypted passwords |

---

## Feature Details

### 1. Fast, Accurate Billing

Create bills in seconds — not minutes.

- **Quick Product Search** — Type a product name and pick from matching results instantly. No scrolling through endless lists.
- **Batch-Aware Selection** — See available stock and expiry dates for each batch before adding to cart. Always sell the right stock.
- **Automatic GST Calculation** — CGST + SGST for in-state sales, IGST for inter-state. Every line item is taxed correctly based on HSN code — no manual math.
- **Multiple Payment Modes** — Accept **Cash**, **UPI**, **Card**, or **Mixed** payments. Each order records exactly how the customer paid.
- **Inline Customer Lookup** — Search customers by phone number or add new ones right from the billing screen. No switching between pages.
- **One-Click Print** — Generate a complete bill with tax breakdown and print it instantly via your browser.
- **Auto Bill Numbers** — Sequential bill numbers with your shop's custom prefix (e.g., `INV-001`, `MED-042`) — generated automatically, never duplicated.

**Why it matters:** Faster billing means shorter queues, fewer errors, and happier customers. You spend less time on paperwork and more time serving people.

---

### 2. Complete Inventory Management

Know exactly what you have, what's running low, and what's expiring — at all times.

- **Batch-Level Tracking** — Every product is tracked by batch number. One product can have multiple batches with different expiry dates, prices, and quantities.
- **Add Stock Easily** — Enter batch number, expiry date, buying price, selling price, MRP, and quantity. Create new products on the fly if they don't exist yet.
- **Price Validation** — The system enforces buying price < selling price < MRP. No accidental pricing mistakes.
- **Expiry Alerts** — Batches expiring within 60 days are highlighted in amber. Already expired batches show in red. Never accidentally sell expired stock.
- **Low Stock Warnings** — Batches with fewer than 10 units are color-coded so you know what to reorder before you run out.
- **Search & Filter** — Find any product instantly by name, company, or batch number across your entire inventory.
- **Edit Anything** — Update product details, batch prices, expiry dates, or quantities whenever you need to.
- **HSN Code Support** — Attach HSN codes to products for accurate GST slab identification and compliance.
- **Box Number Tracking** — Record physical storage locations so your staff can find products on the shelf quickly.

**Why it matters:** Expired medicines are a compliance risk and a financial loss. RetailOS keeps you ahead of both — you'll never be caught off guard by expired stock or sudden shortages.

---

### 3. Stock Adjustments with Full Audit Trail

Real-world inventory doesn't always match the system. RetailOS handles that gracefully.

- **Manual Corrections** — Adjust stock quantities up or down for any batch.
- **Built-in Reasons** — Select from standard reasons: Damage, Theft, Miscount, Physical Count, or Other.
- **Notes Field** — Add context to every adjustment so there's always a paper trail.
- **Complete History** — View the full adjustment history for any batch — who changed what, when, and why.
- **Safety Checks** — The system prevents adjustments that would create negative stock or conflict with already-sold quantities.

**Why it matters:** During audits or stock-takes, you need a clear record of every change. RetailOS gives you a tamper-proof adjustment history that satisfies both internal reviews and external auditors.

---

### 4. Order History & Returns

Every transaction is recorded. Nothing gets lost.

- **Searchable Order History** — Find any past order by bill number, customer name, or phone number.
- **Detailed Order View** — See every line item, batch number, quantity, unit price, GST breakdown, and total for any order.
- **Order Returns** — Mark an order as returned with one click. Stock is **automatically restored** to the correct batches — no manual inventory corrections needed.
- **Soft Delete** — Accidentally created an order? Delete it and the stock is restored. The record stays in the system (marked as deleted) for audit purposes.
- **Reprint Bills** — Need a duplicate bill? Open any past order and print it again.
- **Payment Mode Visibility** — See how each order was paid (cash, UPI, card, mixed) right in the order list.

**Why it matters:** Returns and corrections are a daily reality in retail. RetailOS handles them cleanly — stock stays accurate, records stay intact, and you never lose track of a transaction.

---

### 5. Customer Management

Build a customer database without extra effort.

- **Auto-Creation** — When you enter a customer's phone number during billing, RetailOS automatically creates their profile. No separate data entry step.
- **Visit Tracking** — Every time a customer makes a purchase, their visit count increments automatically. Identify your most loyal customers at a glance.
- **Customer Directory** — Browse and search your full customer list by name or phone number.
- **Editable Profiles** — Update customer name, phone, or age anytime.
- **Order Linkage** — Every order is linked to the customer, building a complete purchase history over time.

**Why it matters:** Knowing your customers helps you serve them better. RetailOS builds your customer database passively — just by doing your normal billing.

---

### 6. Dashboard & Real-Time KPIs

Open RetailOS and immediately see how your day is going.

- **Today's Sales** — Total revenue generated today, front and center.
- **Orders Today** — How many bills you've created today.
- **Low Stock Count** — Number of batches running low, with a direct link to your inventory.
- **Expiring Soon** — Number of batches expiring within 60 days, so you can plan clearance or returns to distributors.
- **Payment Breakdown** — See today's sales split by payment mode — how much came in via cash vs. UPI vs. card.

**Why it matters:** Business decisions require data. The dashboard gives you an instant health check every time you open the app — no digging through reports.

---

### 7. GST Reports & Tax Compliance

File your GST returns with confidence.

- **Date Range Reports** — Generate GST summaries for any period. Defaults to the current Indian fiscal year (April–March).
- **Tax Summary** — See total orders, total sales, taxable value, and tax collected (CGST, SGST, IGST) at a glance.
- **Slab-Wise Breakdown** — Detailed table showing taxable value and tax amounts for each GST slab (0%, 5%, 12%, 18%, 28%).
- **CSV Export** — Download your GST report as a CSV file and import it directly into Tally, Zoho, or any accounting software.
- **Accurate Calculations** — Tax is computed at the line-item level during billing, so reports are always consistent with your invoices.

**Why it matters:** GST compliance is non-negotiable. RetailOS computes taxes correctly at the point of sale and gives you ready-to-file reports — no CA needed for routine filing.

---

### 8. Multi-Shop Management (Super Admin)

Run one shop or twenty — from a single admin panel.

- **Centralized Shop Management** — Create, activate, or deactivate shops from one super admin dashboard.
- **Complete Data Isolation** — Each shop gets its own isolated database. Shop A's data is completely invisible to Shop B. Zero risk of data leakage.
- **Custom Order Prefixes** — Each shop gets its own bill number prefix (e.g., `INV` for one shop, `MED` for another).
- **Shop Provisioning** — Creating a new shop automatically sets up all required database tables. Your new shop is ready to use immediately.
- **Status Control** — Temporarily suspend a shop by deactivating it, without losing any data.

**Why it matters:** If you're growing from one location to multiple, RetailOS scales with you. Each shop operates independently with its own data, but you manage them all from one place.

---

### 9. Security You Can Trust

Your business data deserves serious protection.

- **Two-Factor Authentication** — Super admin login requires both a password and an email OTP. Even if someone gets your password, they can't access admin controls.
- **Encrypted Passwords** — All passwords are hashed with bcrypt (cost 12). They cannot be reverse-engineered.
- **JWT Session Tokens** — Secure, time-limited tokens (4-hour expiry) that auto-expire. No permanent sessions left open.
- **Role-Based Access** — Super admins and shop operators have separate permissions. A shop login cannot access admin routes and vice versa.
- **Rate Limiting** — Login and OTP endpoints are rate-limited to prevent brute-force attacks.
- **Automatic Logout** — Sessions expire after inactivity, and invalid tokens redirect to the login screen.

**Why it matters:** Pharmacy data includes customer health information and financial records. RetailOS protects both with industry-standard security — not just a password screen.

---

### 10. Clean, Modern Interface

Designed for speed and simplicity — not for tech experts.

- **Minimal, Focused Design** — Every screen shows exactly what you need, nothing more. No cluttered menus or hidden features.
- **Mobile-Friendly** — Works on tablets and phones. Run your billing counter from an iPad if you want.
- **Instant Feedback** — Toast notifications confirm every action. Loading states prevent double-clicks. Error messages tell you what went wrong.
- **Consistent Navigation** — Sidebar navigation with clear labels: Billing, Inventory, Orders, Customers, Reports.
- **Search Everywhere** — Every list (products, orders, customers) has a search bar. Find what you need in seconds.

**Why it matters:** Your staff shouldn't need training to use your POS. RetailOS is intuitive enough that anyone can start billing on day one.

---

## Technical Specifications

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 15 (React 19), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Go (Golang), Chi router, PostgreSQL |
| Auth | JWT (golang-jwt), Bcrypt, SMTP-based OTP |
| Database | PostgreSQL with schema-per-tenant isolation |
| Hosting | Vercel (frontend), Render (backend), NeonDB (database) |
| State Management | Redux Toolkit |

---

## Indian Compliance

- GST-ready with CGST/SGST/IGST support
- HSN code tracking for tax slab identification
- Indian fiscal year (April–March) for reports
- All amounts in Indian Rupees (₹)
- Slab-wise GST reports exportable for Tally/Zoho

---

## What's Next

RetailOS v1.0 is just the beginning. Here's what's on the roadmap:

- **Barcode Scanning** — Scan products directly into the bill
- **Distributor Management** — Track purchase orders and supplier payments
- **Advanced Reports** — Profit margins, sales trends, product performance
- **SMS/WhatsApp Notifications** — Send digital receipts to customers
- **Offline Mode** — Continue billing even without internet
- **Mobile App** — Native Android app for on-the-go management

---

## Getting Started

1. **Super admin** creates your shop from the admin panel
2. **Log in** with your shop credentials
3. **Add inventory** — enter your products and batches
4. **Start billing** — you're ready to serve customers

That's it. No installation, no setup wizards, no configuration files. Just open the browser and go.

---

**RetailOS v1.0** — Built for Indian pharmacies. Simple to use. Impossible to outgrow.
