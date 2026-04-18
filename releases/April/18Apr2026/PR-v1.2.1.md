# RetailOS v1.2.1 — Release Notes

### Professional PDF Bills, Smarter Invoices

**Release Date:** April 2026
**Branch:** `feat/subhanu` → `main`

---

## Overview

RetailOS v1.2.1 replaces the browser's `window.print()` with a **real PDF bill generation pipeline**. Bills now open as structured, printable, shareable PDFs in a new browser tab — with a professional pharmacy invoice layout driven by your shop's settings.

This release also brings **six new pieces of information to every bill**: MRP, expiry date, discount savings, customer age, a slab-wise GST summary, and your store policies footer. And a new **Google Review QR code** feature makes it frictionless to collect customer reviews at the point of sale.

---

## What's New

### 1. Professional PDF Bill Generation
**Commit:** `5fa916a`

Bills are now real PDFs, not browser print dialogs.

**What changed:**
- Clicking "Complete Order" on the billing page now generates a PDF and opens it in a **new browser tab** automatically
- The "Print" button on any past order detail page does the same
- PDFs can be **saved, shared, forwarded, or printed** with consistent formatting on any device or printer
- `window.print()` is completely removed — no more layout-dependent, browser-specific output

**PDF Layout (matches SIPRA LIFELINE invoice format):**
- **Header** — Shop name, address, GSTIN, drug license, food license — all pulled from your Settings page
- **Bill Info Grid** — Bill number, date, customer name, phone, age, and payment mode
- **Line Items Table** — Product name, batch number, expiry date, quantity, MRP, sale price, GST rate, and CGST/SGST or IGST columns
- **Totals Section** — Total MRP → Discount with percentage → Grand Total
- **GST Summary Table** — Tax broken down by slab (0%, 5%, 12%, 18%, 28%)
- **Savings Message** — "You saved ₹X.XX on this purchase" shown when a discount applies
- **Authorized Signatory Line** — Standard pharmacy invoice footer
- **Store Policies** — Your return/exchange policy text printed at the bottom of every bill

**Why it matters:** `window.print()` produced unpredictable results — cut-off tables, browser UI in the printout, layout dependent on screen size. A PDF always looks the same regardless of who prints it, on what device, or when. It can also be sent to customers over WhatsApp or email.

---

### 2. MRP and Expiry Date on Every Line Item
**Commit:** `5fa916a`

Bills now show patients exactly what they need to verify their purchase.

- **MRP** — The Maximum Retail Price printed alongside the sale price for every product
- **Expiry Date** — Batch expiry date printed on each line item
- **Discount Visibility** — The bill automatically calculates and shows the total discount amount and percentage (Total MRP vs Grand Total)

**Why it matters:** Patients can verify they're receiving medicines within shelf life and at or below MRP — both are regulatory expectations and trust signals. The discount percentage ("You saved 12.5%") also reinforces value without any manual calculation by staff.

---

### 3. Customer Age on Bills
**Commit:** `5fa916a`

Patient age is now captured on the printed invoice.

- Appears in the bill info section when available
- Shows `—` gracefully when the order was created without a customer
- Satisfies common pharmacy documentation requirements for certain medication categories

**Why it matters:** For certain prescription categories, pharmacies are required to record the patient's age on the dispensing record. This is now automatic.

---

### 4. Google Review QR Code on Bills
**Commit:** `5fa916a`

Turn every bill into a review prompt — without any extra effort from staff.

- **New Setting: Google Review Link** — Add your Google Business review URL in the Settings page
- **QR Code on Bill** — A 60×60 QR code generated from the link appears in the top-right corner of the bill header
- **Label** — "Review Us on Google" printed below the QR code
- **Conditional** — If no Google Review Link is set, the QR block simply doesn't appear. No broken images, no blank space.

**Why it matters:** Getting a customer to leave a Google review usually requires them to search for your shop later — most forget. Putting a QR code on the bill gets them while the interaction is fresh. One scan, one review, done.

---

### 5. New Settings Field — Google Review Link
**Commit:** `5fa916a`

A single new field added to the Settings page.

- Paste your Google Business review URL (e.g., `https://g.page/r/...`)
- The URL is validated as a proper URL format
- Saved per-shop alongside your other settings
- Immediately reflected on all new bills once saved

---

### 6. GST Summary Table on Bills
**Commit:** `5fa916a`

Every bill now includes a full GST breakdown by slab — ready for customer records and audit.

- Shows taxable value and tax collected for each applicable GST slab
- In-state orders show CGST + SGST columns; out-of-state orders show IGST
- Only slabs with actual values are shown — no empty rows

**Why it matters:** Customers running a business need itemised GST on their purchase receipts for their own ITC claims. This satisfies that requirement automatically.

---

## Summary of Changes

### New Frontend Files
- `frontend/components/bill/BillDocument.tsx` — Full PDF layout component using `@react-pdf/renderer`
- `frontend/lib/generateBill.tsx` — Bill data builder and PDF generation pipeline with SSR-safe dynamic imports

### Modified Frontend Files
- `frontend/app/(dashboard)/billing/page.tsx` — Replaced `window.print()` with `generateBill()` after order creation
- `frontend/app/(dashboard)/orders/[id]/page.tsx` — Print button now calls `generateBill()` using stored order data and fetched settings
- `frontend/app/(dashboard)/settings/page.tsx` — Added Google Review Link input field
- `frontend/types/index.ts` — Added `mrp`, `expiry_date` to `OrderItem`; `customer_age` to `Order`; `google_review_link` to `ShopSettings`

### Modified Backend Files
- `backend/internal/queries/orders.sql` — `GetOrderByID` now fetches `customer_age`; `GetOrderItems` now joins `batches` for `mrp` and `expiry_date`
- `backend/internal/generated/orders.sql.go` — Updated Go structs and scan calls to match new query shapes

### New Dependencies
- `@react-pdf/renderer@^4.5.1` — Client-side PDF generation
- `qrcode@^1.5.4` — QR code PNG generation from URL
- `@types/qrcode@^1.5.6` — TypeScript types for qrcode

---

## Technical Notes

- PDF generation is entirely **client-side** — no server-side rendering, no new API endpoints
- `generateBill()` uses dynamic imports (`import()`) for both `qrcode` and `@react-pdf/renderer` to keep them out of the initial bundle (SSR-safe)
- The QR code is generated as a base64 PNG and embedded directly into the PDF via `@react-pdf/renderer`'s `<Image>` component
- On the billing page, cart state is captured into local variables before `clearCart()` is dispatched, so the PDF can be built from fresh cart data without re-fetching the order
- On the order detail page, settings are fetched in parallel with the order via a second `useEffect` call
- `GetOrderItems` now performs a `JOIN` with `batches` instead of `SELECT *` — no schema migration required as `mrp` and `expiry_date` already existed in the `batches` table
- `isInState` is derived from `order.cgst_total > 0` — if CGST was charged, it's an in-state sale

---

## Test Plan

- [ ] Complete a new order on `/billing` → PDF opens in new tab automatically
- [ ] Verify PDF shows correct line items, MRP, expiry dates, GST breakdown, and totals
- [ ] Open an existing order at `/orders/[id]` → click Print → PDF opens with the same data
- [ ] Add a Google Review Link in Settings → create a new order → verify QR code appears on bill
- [ ] Remove Google Review Link from Settings → verify QR code is absent (no broken image)
- [ ] Create an anonymous order (no customer) → verify bill shows `—` for name/phone/age gracefully
- [ ] Create an out-of-state order → verify bill shows IGST column instead of CGST/SGST
- [ ] Create an order where sale price = MRP → verify no discount row appears on bill
- [ ] Create an order with a discount → verify savings message and discount percentage are correct
- [ ] Open the bill PDF and verify store policies text appears at the bottom (requires policies saved in Settings)
- [ ] Print the PDF from the browser → verify formatting is consistent and nothing is cut off
- [ ] Confirm version shows as `v1.2.1` in the bottom-right corner of the UI

---

**RetailOS v1.2.1** — Bills your customers will actually trust.
