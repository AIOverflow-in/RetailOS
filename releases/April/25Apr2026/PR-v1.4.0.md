# RetailOS v1.4.0 — Release Notes

### Edit Orders, Filter Everything, Bill Faster

**Release Date:** April 2026
**Branch:** `feat/subhanu` → `main`

---

## Overview

RetailOS v1.4.0 is the largest release since launch — driven directly by feedback from the first beta shop. It brings **four major capabilities**: a redesigned row-based billing form, full per-item order editing with partial returns and product additions, comprehensive filters and sort across the inventory and orders pages, and a flipped GST convention on stock entry that matches how distributors actually invoice. Plus a collapsible sidebar for more screen space and a stale-while-revalidate cache for shop settings.

Two new database columns, two new endpoints, and a meaningful rethink of three core workflows. Every change is grounded in real shop-floor friction.

---

## What's New

### 1. Per-Item Order Edit, Partial Returns & Product Additions
**Commit:** `405b7a5`

The biggest functional addition: shopkeepers can now **edit any active order** after it's been billed — change a line's quantity up or down, return a single line, or add a new product to an order that's already been printed.

**What you can do on any `active` or `partially_returned` order:**

- **Reduce a line's quantity** — Click the pencil icon on a row, enter a new quantity, optionally add a note. Stock is automatically restored to the batch and the order's totals are recomputed.
- **Increase a line's quantity** — Same dialog. Stock is locked, validated, and deducted from the batch atomically. If there's insufficient stock, the dialog stays open with a clear error message — no half-applied changes.
- **Fully return a single line** — Click the trash icon on any row. After confirmation, the line is marked returned, full stock is restored, and the order moves to `partially_returned` status (or `returned` if everything has been returned).
- **Add a new product to an existing order** — Click "Add Product" → search for a product → pick a batch → enter quantity, sale price, GST → ✓ to commit. New line appears, stock deducts, totals recompute. All in one transaction.
- **Order audit trail** — Every edit captures the timestamp ("Last edited: …") and an optional comment which displays as an amber note on the order detail page.

**Status transitions:**
- All-returned → `returned`
- Some returned → `partially_returned` (orange status badge)
- Anything else → `active`

**Why it matters:** Before this, the only way to handle a partial return was to void the entire order and re-bill from scratch — which forced shopkeepers to either eat losses on small returns or annoy customers with a full re-billing. Real-world retail doesn't fit that model. Now: customer wants to return one strip from a five-strip purchase, or wants to add an extra item to a bill they just paid for? It's two clicks, atomically applied to stock and totals.

**Technical Notes:**
- Single ACID transaction wraps the entire edit — stock changes, line updates, status recomputation, and audit fields all commit together or not at all
- New backend endpoint: `POST /orders/{id}/edit` accepting edits, additions, and an optional comment
- New schema: `orders.updated_at`, `orders.return_comment`, `order_items.returned_qty`
- Insufficient-stock errors use the same wording as `CreateOrder` for consistency
- Order totals recompute proportionally using `(qty - returned_qty) / qty` weights to avoid rounding drift

---

### 2. Row-Based Billing Form with Required Customer Fields
**Commit:** `3098814`

The billing page has been **rebuilt from scratch** as a single editable grid. The old "compose-above-then-list-below" flow (with a separate "Add Item" form above and line items below) is gone — replaced by a row table where each line is self-contained and editable inline.

**The new billing experience:**

- **One editable row per line item** — Columns: Product, Batch, Expiry, MRP, **Box No** (new), Sale Price, Qty, GST, Stock, Total, ✕
- **Inline product search** — Click the Name cell, see top 20 products instantly, type to filter. No separate search dialog.
- **Auto-prefill on selection** — Pick a product with one batch and everything (batch number, expiry, MRP, box, available stock, sale price, GST rate) is filled in. Multi-batch products show a batch picker.
- **Mandatory customer fields** — Customer name and 10-digit phone are now **required**. Red asterisks on the labels make this visible. The "Place Order" button is disabled until both are filled along with at least one valid line.
- **Tooltip on disabled "Place Order"** — Hover the disabled button and see exactly which requirement is missing: *"Required: Add at least one item, Customer name, Customer phone (10 digits)"*. No more guessing why the button doesn't work.
- **Box No on every row** — Counter staff can now see physical storage locations directly on the billing form, without going back to the inventory page

**Bill PDF labels updated** to be neutral commerce terms instead of medical-specific:
- "Patient Name" → **"Customer Name"**
- "Patient Contact Number" → **"Customer Contact Number"**
- "Patient Age" → **"Customer Age"**
- "Medicine Name" → **"Product Name"**
- "Price Per Strip" → **"Price"**

**Why it matters:**
- Faster bill entry — scan products, batches, and quantities down a single grid instead of repeatedly using a separate add form
- Lower bad-data risk — every order now has a lookup-able customer; the previous optional-then-skipped pattern is gone
- Bills can serve any retailer, not just pharmacies, without per-tenant template forks

**Technical Notes:**
- Cart items moved out of Redux into local component state (Redux's `CartItem` type required every field; new rows exist before product/batch selection)
- `crypto.randomUUID()` is used for stable React keys across rows
- Qty and Sale Price use local text state with sync effects so users can fully clear and retype the field; values normalize only on blur

---

### 3. Inventory & Orders Pages — Filters, Sort, Box Column, Error Recovery
**Commit:** `cee3411`

Both list pages got a comprehensive upgrade in response to first-beta feedback that "with more SKUs the flat list became unscannable."

#### Inventory Page (`/inventory`)

- **Multi-select filters:** Company, Box, Distributor, Stock status (In stock / Low ≤5 / Out / Expired)
- **Hide Expired toggle** — defaults to **ON** (most users don't want to see expired stock by default)
- **Sort control** — Expiry date / Stock level / Date added, with direction toggle
- **`Showing X of Y batches`** count header so you always know what's filtered out
- **Box column** added to the table for quick physical lookup
- **Stock status colour coding** (existing) is now exposed as a filterable category

The processing pipeline is: hide-expired → filters → search → sort → paginate. Page resets to 1 on any filter change.

#### Orders Page (`/orders`)

- **Multi-select filters:** Payment mode, Status, Date range (from/to native date pickers)
- **Sort by** Date or Total, with direction toggle
- **Default view changed** — was "active only" (which silently hid returned orders), now shows **all non-deleted statuses**. Returned and partially-returned orders are reachable from the UI for the first time.
- **Inline error recovery** — Backend connection failures used to crash the page with `unhandledRejection` and a blank table. Now: a sonner toast with a Retry button appears, plus a persistent inline red banner above the table. **Existing data is preserved** during the failure so the table doesn't flash empty.

**Why it matters:**
- **Inventory at scale** — first beta user has hundreds of SKUs; filtering by box, company, distributor, and stock status lets them triage low-stock or expired inventory in seconds
- **Reachable returned orders** — operators previously had to query the database to verify a return existed. Now it's one chip-click away.
- **Robustness during transient backend failures** — Neon's serverless pooler occasionally drops connections; the page now self-recovers with retry instead of crashing

---

### 4. GST Convention Flipped on Stock Addition
**Commit:** `cee3411`

A small but important conceptual change driven by direct user feedback.

**Before:** "Buying price" meant pre-GST cost, and "Landing price" was buying + GST. Users had to mentally subtract GST from their distributor invoice before entering it — a frequent source of typos.

**After:** "Buying price (incl. GST)" is what's actually printed on the distributor's bill. Landing price is auto-calculated as `buying / (1 + gst/100)` — the pre-GST cost basis, derived for you.

**Other improvements bundled in:**
- Every form label on the Stock Addition page now has an **info-icon tooltip** explaining whether the price includes GST, so there's no ambiguity
- The Edit Batch modal uses the same flipped formula and labelling for consistency

**Why it matters:** The user enters figures directly from their distributor invoice without doing math. Faster stock entry, fewer errors.

**Important note for existing data:** Batches entered under the old convention will now show a *negative* input GST on the Reports page until they're either edited or naturally cycle out. This is an accepted tradeoff — the alternative was a complex one-time DB migration. New batches behave correctly from day one.

---

### 5. Collapsible Sidebar & Cached Shop Settings
**Commit:** `7ede0cf`

Two small polish items that improve daily ergonomics.

#### Collapsible Sidebar

- Click the new icon-rail toggle to **collapse the sidebar** to icons-only
- Default is open; state is session-only (resets on next session)
- Hides the 224px text panel — gives billing and bill-preview pages more horizontal room

#### Cached Shop Settings (Stale-While-Revalidate)

- Shop settings (address, GSTIN, licenses, policies, Google review link) are cached in `localStorage`
- Pages that need them — Settings page, billing flow, order detail — **hydrate from cache instantly** so there's no loading flicker
- Settings are refreshed from the API in the background and the cache updates only on diff
- **Logout clears the cache** so a super-admin switching tenants doesn't see stale data
- The sidebar shop name now reads directly from `localStorage` in a `useEffect` (matching the settings cache pattern) instead of round-tripping through Redux

**Why it matters:** The settings page and bill-PDF flow used to show a brief loading state every time. Now they feel instant. Sidebar collapse reclaims real estate for users on smaller screens or who want more focus during billing.

---

## Summary of Changes

### New Files

**Frontend:**
- `frontend/components/billing/BillingTable.tsx` — Row-based billing table shell
- `frontend/components/billing/BillingRowItem.tsx` — One self-contained editable row per line
- `frontend/components/EditQuantityDialog.tsx` — Per-item edit modal with note field
- `frontend/lib/settingsCache.ts` — Stale-while-revalidate cache for shop settings

**Backend:**
- `backend/internal/migrations/tenant/000010_add_partial_return.up.sql` — `orders.updated_at`, `orders.return_comment`, `order_items.returned_qty`

### Deleted Files
- `frontend/components/billing/AddItemBar.tsx` — Replaced by `BillingRowItem`
- `frontend/components/billing/LineItem.tsx` — Replaced by the row table

### New Backend Endpoints
- `POST /orders/{id}/edit` — Edit order (line edits, additions, comment)

### Modified Files (highlights)

**Frontend:**
- `frontend/app/(dashboard)/billing/page.tsx` — Local row state, `placeOrder()` with required-field validation, dynamic disabled-button tooltip
- `frontend/app/(dashboard)/orders/[id]/page.tsx` — Per-row Edit/Trash actions, Add Product inline row, Last-edited subtitle, return comment block, Returned column, partially_returned status colour
- `frontend/app/(dashboard)/orders/page.tsx` — Multi-select filters, sort, date range, error toast + retry banner
- `frontend/app/(dashboard)/inventory/page.tsx` — Multi-select filters, sort, Box column, hide-expired toggle, count header
- `frontend/app/(dashboard)/inventory/add/page.tsx` — GST convention flipped, label tooltips, "Buying price (incl. GST, ₹)" relabel
- `frontend/components/inventory/EditBatchModal.tsx` — Same GST flip and relabel for edit path
- `frontend/components/shared/Sidebar.tsx` — Collapse toggle, shop name from localStorage
- `frontend/components/billing/CartSummary.tsx` — Prop-driven (`{ rows, isInState }`) instead of Redux-reading
- `frontend/components/billing/CustomerLookup.tsx` — Required asterisks on Phone and Name labels
- `frontend/components/bill/BillDocument.tsx` — Patient → Customer label rename
- `frontend/lib/api.ts` — `editOrder()`, `listOrders` filter params, `listActiveBatches()`
- `frontend/lib/useProductSearch.ts` — Now exposes `allProducts` and `catalogExceedsCap`
- `frontend/lib/gst.ts` — `calcCartTotals` signature loosened to structural type
- `frontend/store/cartSlice.ts` — Removed cart items from Redux (kept payment/customer/GST mode)

**Backend:**
- `backend/internal/handlers/orders.go` — New `EditOrder` handler (single ACID transaction); `ListOrders` extended with filters, status/payment validation, date parsing, sort
- `backend/internal/handlers/inventory.go` — Landing price formula flipped to `buying / (1 + gst/100)`, validation message updated
- `backend/internal/queries/orders.sql` — `GetOrderItemByID`, `UpdateOrderItemReturnedQty`, `UpdateOrderItemQuantity`, `UpdateOrderAfterEdit`; `ListOrders` and `CountOrdersFiltered` extended
- `backend/internal/queries/batches.sql` — `ListInventory` returns `created_at`
- `backend/internal/queries/reports.sql` — Input-GST sign flipped: `(buying − landing)`

---

## Technical Notes

- The order edit transaction handles 0% GST orders by inspecting per-item GST distribution to determine in-state vs out-of-state mode (since totals are zero); falls back to in-state for fully-ambiguous cases
- Order totals are recomputed proportionally from existing line GST amounts (`cgst_amount * (active/qty)`) rather than re-deriving from price × qty — this stays consistent with the existing `CreateOrder` path even after rounding
- The `ListInventory` `CHECK (COALESCE(landing, buying) < selling)` constraint is unaffected by the GST flip because under the new formula `landing < buying`, so `COALESCE` resolves to landing (the smaller value) and the constraint stays satisfied without DB changes
- `ListOrders` sort uses four `CASE WHEN $6 = 'date_asc' THEN o.created_at END ASC NULLS LAST` clauses with a stable `o.created_at DESC` tie-breaker; status `'deleted'` is hard-excluded with a final `AND o.status <> 'deleted'` guard
- The settings cache uses a stale-while-revalidate pattern — read from cache for instant UI, refresh from API in the background, update only on diff
- Disabled-button tooltips use a `<span title>` + `pointer-events-none` pattern because a bare `<button disabled>` does not fire mouse events in most browsers
- All new database columns use `ADD COLUMN IF NOT EXISTS` for idempotent migration on existing tenant schemas

---

## Known Considerations

- **Legacy batches and input GST:** Batches entered under the pre-flip GST convention will report a *negative* input GST on the Reports page until they're edited or naturally cycle out. No migration was performed — accepted tradeoff agreed with the user during the cutover.
- **0% GST out-of-state orders:** When adding products to an existing 0% GST order, the GST mode defaults to in-state due to ambiguity. Acceptable for the current customer base but worth revisiting if multi-state 0% billing becomes common.
- **Inventory filter options** are derived from the loaded dataset; if `/inventory` ever moves to server-paginated, those will need to come from a separate distinct-values endpoint.
- **Date filter timezone:** Uses server timezone for `created_at::date` comparisons — could drift by a few hours for IST tenants on a UTC server. Acceptable for v1.

---

## Test Plan

### Order Editing & Partial Returns
- [ ] Open an active order → reduce one line's qty (e.g., 5 → 3); verify stock for that batch increases by 2, status flips to `partially_returned`, "Last edited" appears
- [ ] Click trash icon on a line; verify line marked returned, full stock restored, row dimmed
- [ ] Increase a line's qty (e.g., 2 → 5) with sufficient stock; verify batch stock decreases by 3, line total recomputes
- [ ] Increase past available stock; verify dialog stays open with red "insufficient stock for X" error and no DB writes
- [ ] Click "Add Product" → pick a batch → submit; verify new line appears, stock deducts, totals recompute
- [ ] Set every item's qty to 0 across multiple edits; verify status transitions to `returned`
- [ ] Verify "Return Order" full-return button still works on `active` orders
- [ ] Add a return comment and verify the amber note appears on the order detail page

### Row-Based Billing
- [ ] Open billing → verify one empty row visible
- [ ] Click Name cell → verify dropdown opens with top 20 products before typing
- [ ] Type a query → verify live filtering
- [ ] Select a single-batch product → verify all batch fields auto-prefill
- [ ] Select a multi-batch product → verify Batch dropdown appears for manual choice
- [ ] Try to place order without customer name → verify button is disabled with tooltip listing missing fields
- [ ] Place order with valid data → verify PDF bill opens with new "Customer Name" / "Product Name" labels

### Filters & Sort
- [ ] Inventory: filter by company, box, distributor, stock status; toggle hide-expired; switch sort field and direction; verify `Showing X of Y batches` reflects state
- [ ] Orders: filter by status (Active, Returned, Partially Returned), payment mode, date range; switch sort field and direction
- [ ] Orders: simulate backend down → verify toast with Retry, inline red banner, and existing data is preserved (not blanked)

### GST Convention Flip
- [ ] Add stock with buying = 118, GST 18% → verify landing displays as 100.00 and persists as 100.00
- [ ] Hover every Stock Addition label → verify tooltips explain GST inclusion clearly
- [ ] Edit an existing batch → verify same flipped convention applies

### Sidebar & Settings Cache
- [ ] Click sidebar collapse toggle → verify text panel hides; expand again → verify it reappears
- [ ] Open Settings page → verify it loads instantly from cache (no flicker) and updates if data changed server-side
- [ ] Logout → log back in as different tenant → verify cache is fresh, no stale data
- [ ] Verify sidebar shop name reflects the logged-in tenant after switch

### Version
- [ ] Confirm version shows as `v1.4.0` in the bottom-right corner of the UI

---

**RetailOS v1.4.0** — Edit any order, find any batch, bill any retailer.
