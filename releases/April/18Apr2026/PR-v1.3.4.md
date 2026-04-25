# RetailOS v1.3.4 — Release Notes

### WhatsApp Bills, Smarter Billing Defaults, and a More Readable UI

**Release Date:** April 2026
**Branch:** `feat/subhanu` → `main`

---

## Overview

RetailOS v1.3.4 ships **four improvements**: send bills directly to customers on WhatsApp from the billing screen or any past order, GST rate auto-fill from purchase data eliminating a repeated manual step, a full-app UI readability pass with darker labels, accessible tooltips, and bordered action buttons — plus the public landing page updated to reflect the latest features and correct pricing.

---

## What's New

### 1. Send Bill via WhatsApp
**Commit:** `6aded14`

After completing a sale, or from any past order, staff can send the customer's PDF bill directly to their WhatsApp with two clicks — bill downloaded, WhatsApp opened, message pre-filled, all in one flow.

#### After Completing a Sale (Billing Page)

When a customer's phone number was entered during billing, a green banner appears immediately after the order is completed:

> *"Bill ready — send to 9876543210 on WhatsApp?"*

Two actions:
- **Send Bill** — Downloads the PDF and opens WhatsApp Web (or native app on mobile) with the customer's number and a pre-filled message:
  > *"Hi [Name], your bill for order INV-042 from [Shop Name] is ₹1,240. Please find the PDF attached."*
- **Dismiss** — Closes the banner and the page is ready for the next sale

#### From a Past Order (Order Detail Page)

A **"Send Bill"** button appears on any order detail page where the customer's phone is on record. Same flow — PDF download + WhatsApp pre-filled.

The banner and button are both absent for anonymous orders with no phone number — no clutter in those cases.

**Why it matters:** Customers increasingly expect digital receipts. A WhatsApp bill reaches the customer before they leave the counter, gives them a permanent record for insurance or reimbursement, and takes two seconds instead of printing.

---

### 2. Purchase GST Auto-Fills Sale GST on Billing
**Commit:** `b242747`

When a batch is selected on the billing screen, the GST rate field now defaults to the **purchase GST rate** recorded when that stock was added — instead of always defaulting to 0%.

**Before:** Staff had to manually set the GST rate on every line item, even for products whose rate had already been captured at stock entry.

**After:** Select a batch → GST rate is automatically filled from the batch's purchase GST rate. Still editable if needed.

**Why it matters:** For most pharmacy products, the sale GST rate matches the purchase GST rate. Removing this repeated manual step speeds up billing and eliminates a category of GST mis-reporting errors caused by staff leaving the rate at 0%.

---

### 3. UI Readability — Labels, Tooltips, and Button Styling
**Commit:** `cde2e8f`

A full-app accessibility and readability pass across every screen, addressing feedback that labels were hard to read and icon buttons were hard to identify.

#### Darker Form and Table Labels

All field labels, table column headers, and section headings have been darkened from a near-invisible light grey (`#BBBBBB`, contrast ratio 1.92:1) to a legible medium grey (`#666666`, contrast ratio 5.74:1) — now exposed as a `text-label` design token so it can be updated globally from one line.

This affects **every screen**: Billing, Inventory, Add Stock, Inventory Adjustments, Customers, Distributors, Orders, Order Detail, Dashboard, Reports, Settings, Super Admin Dashboard, and all modal forms. The new shade passes **WCAG AA** for small text (minimum 4.5:1 required).

**Why it matters:** Shop staff reported difficulty reading field labels under bright counter lighting and on lower-quality screens. Every label on every screen is now clearly legible.

#### Tooltips on Icon Buttons

A new accessible `Tooltip` component wraps all icon-only action buttons across the app. Hovering shows a label after a short delay. Browser `title` attributes — which don't work on touch devices and behave inconsistently across browsers — have been replaced.

Buttons with tooltips:
- **Inventory page** — Edit product, Edit batch, Adjust stock icons
- **Customers page** — Edit customer icon
- **Distributors page** — Edit distributor, Delete distributor icons
- **Order detail page** — Send Bill and Print buttons

**Why it matters:** Three unlabelled icon buttons on every inventory row confused new staff. Accessible tooltips are consistent across all browsers and work on touch devices.

#### Visible Borders on Action Buttons

Text-only action buttons that previously appeared as unstyled coloured text now have a visible outlined style with a hover background.

- **Neutral actions** (Back, View, Send Bill, Print) — Light grey border, subtle hover background
- **Delete action** — Red-tinted border variant
- **Icon-only buttons** (pencil, sliders, trash) — Unchanged; hover background already signals interactivity; tooltips were added instead

**Why it matters:** "View" and "Delete" in the orders table, and "Back", "Print", and "Send Bill" in the order detail header, previously looked like plain text. Bordered buttons are visually clickable and reduce the time staff spend scanning for the right action.

---

### 4. Landing Page Updated to v1.3
**Commit:** `a05153a`

The public marketing page at retailos.in has been updated to reflect what RetailOS actually does today.

**Feature cards updated:**
- *"Indian-standard Invoices"* → **"Professional PDF Bills"** — now describes real PDFs with GSTIN, drug/food licences, MRP, expiry dates, patient age, GST summary table, and Google Review QR code
- *"Customer Profiles"* → **"Distributor Management"** — reflects the new first-class distributor entity with stock linking and dashboard analytics
- **Lightning-fast Billing** description updated to mention one-click returns with automatic stock restoration

**How it works section updated:**
- Step 1 now mentions linking batches to distributors with a purchase invoice number

**Pricing corrected:**
- Updated from ₹10/month to **₹799/shop/month** across the hero section, pricing card, and CTA — all three locations were inconsistent with actual pricing
- Pricing card feature list updated to include: one-click returns, distributor management, and professional PDF bill generation

**Stats section:**
- "24/7 Cloud availability" → **"v1.3 — Latest release, April 2026"** to keep the stats current

---

## Summary of Changes

### New Files
- `frontend/components/ui/tooltip.tsx` — Accessible tooltip component built on `@base-ui/react/tooltip`; 400ms delay; uses `render` prop to avoid nested `<button>` DOM violations

### Modified Frontend Files
- `frontend/components/billing/AddItemBar.tsx` — `selectBatch()` sets GST rate from `purchase_gst_rate` instead of hardcoded `0`
- `frontend/lib/generateBill.tsx` — Refactored to shared `buildPdfBlob()` helper; added `sendBillViaWhatsApp()` export
- `frontend/app/(dashboard)/billing/page.tsx` — `lastBill` state + green WhatsApp prompt banner post-order
- `frontend/app/(dashboard)/orders/[id]/page.tsx` — "Send Bill" WhatsApp button on order detail action bar
- `frontend/app/globals.css` — `--color-label` design token (`oklch(0.510 0 0)`)
- **20 components and pages** — All `text-[#BBBBBB]` replaced with `text-label`; Tooltip added to icon buttons; action buttons restyled with borders

### Modified Landing Files
- `landing/app/page.tsx` — Feature cards, pricing (₹799/month), stats, and how-it-works copy updated to reflect v1.3 capabilities

---

## Technical Notes

- WhatsApp phone number normalisation: strips non-digit characters, prepends `91` (India code) only if not already present — both `9876543210` and `919876543210` formats work correctly
- The WhatsApp link format is `wa.me/{phone}?text={message}` — opens WhatsApp Web on desktop, native app on mobile
- PDF blob object URL is revoked after 10 seconds in both the open-in-tab and WhatsApp-download flows to avoid memory leaks
- `text-label` is a Tailwind v4 design token defined via `--color-label` in `@theme inline` — changing the label shade globally requires editing one line in `globals.css`
- The `Tooltip` component uses `@base-ui/react` which was already a project dependency — no new packages added

---

## Test Plan

- [ ] Complete an order with a customer phone → verify green WhatsApp banner appears with the correct phone number
- [ ] Click "Send Bill" on the banner → verify PDF downloads as `Bill-{OrderNumber}.pdf` and WhatsApp opens with pre-filled message (correct order number, customer name, shop name, total)
- [ ] Click "Dismiss" → verify banner clears and billing is ready for next order
- [ ] Complete an anonymous order (no phone) → verify no WhatsApp banner appears
- [ ] Open a past order with a customer phone at `/orders/[id]` → verify "Send Bill" button is visible and triggers the same flow
- [ ] Open a past order with no customer phone → verify "Send Bill" button is absent
- [ ] Add a product to a bill whose batch has a purchase GST rate set → verify GST rate auto-fills to that value (not 0%)
- [ ] Add a product with no purchase GST rate recorded → verify GST rate defaults to 0%
- [ ] Open any page — verify all form labels and table column headers are clearly legible in darker grey
- [ ] Hover over pencil, sliders, trash icons on any inventory row → verify tooltips appear with correct labels after ~400ms
- [ ] Hover over pencil icon on a customer row → "Edit customer" tooltip
- [ ] Hover over pencil and trash on a distributor row → correct tooltips
- [ ] Hover over Send Bill and Print on order detail → tooltips appear
- [ ] Orders list — verify "View" and "Delete" buttons have visible borders and hover backgrounds
- [ ] Order detail — verify Back, Send Bill, Print have bordered styling aligned with "Return Order" button
- [ ] Check the public landing page — verify pricing shows ₹799/month in all three locations (hero, pricing card, CTA)
- [ ] Check landing page feature cards — verify "Professional PDF Bills" and "Distributor Management" cards are present
- [ ] Confirm version shows as `v1.3.4` in the bottom-right corner of the UI

---

**RetailOS v1.3.4** — Bills that reach customers, labels that can be read, and pricing that reflects reality.
