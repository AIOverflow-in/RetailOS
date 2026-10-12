# SellOS v1.7.0 — Release Notes

### Safe at the counter: no duplicate bills, no lost carts, and every failure explained in plain words

**Release Date:** October 2026
**Branch:** `feat/error-handling` → `main` (merge after v1.6.0, PR #21)

---

## Overview

A bill could be saved twice if the connection dropped after the server saved it, and a bill being built could be lost to a reload, an expired session or a quick look at another page. Several screens also showed believable but wrong data (₹0 sales, empty lists) when loading failed, and raw database errors reached shop owners. This release makes billing safe to retry, keeps the bill in progress, and makes every failure visible and understandable. It touches the request layer, the billing page, seven data pages, the backend error messages and the app's error pages.

---

## What's New

### 1. Duplicate-safe bill creation
**Commit:** `2d73d3b`

- Each Place Order sends a `client_ref` that identifies that exact bill. If the same bill is sent again (after a timeout, a dropped connection, or a double send), the server returns the bill it already saved instead of creating a second one and deducting stock twice.
- Editing the bill (items, quantities, prices, customer, payment or GST mode) makes it a new bill with a new ref.
- If an attempt gets no reply, a banner on the billing page says the bill may already be saved and that pressing Place Order again for the same bill is safe. If the bill was edited since, it points to Orders instead.

**Why it matters:** A dropped connection after the server saved the bill used to leave the cart on screen with an error. Pressing Place Order again created a second bill and took the stock twice. That's lost money, wrong stock, and a GST record that doesn't match the till.

**Technical Notes:**
- Migration `000013` adds a nullable `orders.client_ref UUID` and a partial unique index `orders_client_ref_key` (`WHERE client_ref IS NOT NULL`). Existing orders and older clients have no ref and are unaffected.
- `CreateOrder` looks up the ref first and returns `200` with the existing order. Concurrent identical requests race on the unique index; the loser rolls back its transaction (including the stock deduction) and returns the winner's order.
- A unique violation without a matching ref (two different bills taking the same bill number at once) now returns a plain "please press Place Order again" message. With `client_ref`, that retry is safe.
- The ref is saved with the bill draft before the request goes out, so a reload mid-request keeps it.

---

### 2. The bill in progress is never lost
**Commit:** `2d73d3b`

- Rows, customer, payment mode, GST mode and the current `client_ref` are saved to `localStorage` (one draft per shop) as the bill is built, and restored on return with an inline "Restored the bill you were working on" note and a **Start a new bill** link.
- Restored rows reload their batch lists, so the batch picker works as before.
- The draft is cleared when the bill is saved or the bill is cleared.

**Why it matters:** A session that expired after 8 hours, an accidental reload, or a quick look at Inventory used to wipe a half-built bill at the counter.

**Technical Notes:**
- `lib/billDraft.ts`; key `sellos:bill-draft:<schema_name>`. A 401 redirect clears the token but not the draft, so the bill comes back after logging in again.
- Storage failures (full or blocked) are ignored: billing works, the draft just doesn't survive a reload.

---

### 3. Failures are visible, never disguised as data
**Commit:** `2d73d3b`

- Dashboard, inventory, customers, distributors (and their batch panel), stock adjustments and order detail show **"Couldn't load …: reason · Retry"** instead of ₹0 sales, empty tables or "Order not found".
- Billing and order rows show **"Couldn't load · Retry"** when a product's batches fail to load, instead of a stuck row or a wrong "Out of stock".
- Product search failures say so in the dropdown, and Add Stock never offers "+ Add as new product" off a failed search.
- Customer lookup failures are shown instead of silently treating a returning customer as new.
- New error pages (`app/error.tsx`, `app/(dashboard)/error.tsx`, `app/global-error.tsx`) replace Next's bare "Application error" with Try again / Dashboard. The dashboard one keeps the sidebar.

**Why it matters:** A dashboard showing ₹0 on a bad network looks like a real, terrible day. An empty inventory list looks like lost stock. The owner needs to know it's a loading problem, and how to retry.

**Technical Notes:**
- Shared `components/shared/LoadError.tsx` (also used by Orders, replacing its inline copy) and `components/shared/ErrorScreen.tsx`.
- Order detail treats only 404/400 as "Order not found"; anything else is a retryable load error.

---

### 4. Clear, honest messages
**Commit:** `2d73d3b`

- **Request layer** (`lib/api.ts`):
  - every request times out after 20s;
  - messages distinguish "You're offline", "The server is taking too long" and "Can't reach SellOS right now";
  - HTML or other non-JSON replies never reach a toast;
  - each failure is reported once (the extra global toast is gone).
- **Backend:** raw database errors are logged and replaced with plain sentences. Unique and check violations map to specific messages ("Another product already uses this SKU.", "Prices don't add up: …", "Another customer already has this phone number."). Bill errors name the product and batch instead of internal IDs. Validation messages are reworded for shop owners.
- **Print and share:** if the browser blocks the print tab, a toast offers **Print bill**. WhatsApp PDF failures are reported. On order detail, Print no longer depends on settings, and WhatsApp fetches them if needed.
- **CSV export** reports errors instead of saving the error text as the `.csv` file.
- **Toaster:** imported statically and rendered after mount. The lazily loaded version never appeared if the shop went offline before it loaded, which hid every error toast exactly when they mattered.

**Why it matters:** "Service temporarily unavailable. Please try again in 5 minutes" when the shop's Wi-Fi dropped, Postgres constraint text, and "Unexpected token '<'" are confusing and erode trust at the counter.

**Technical Notes:**
- `ApiError` carries `kind` (`offline` / `timeout` / `unreachable` / `http`) and `status`. `isConnectionError()` drives the billing no-reply banner.
- `serverError()` and `pgErrorCode()` in `handlers/helpers.go`.

---

## Summary of Changes

### New Files
- `backend/internal/migrations/tenant/000013_add_order_client_ref.up.sql` — `orders.client_ref` + partial unique index
- `frontend/lib/billDraft.ts` — bill-in-progress storage
- `frontend/components/shared/LoadError.tsx` — inline load error with Retry
- `frontend/components/shared/ErrorScreen.tsx` — crash screen
- `frontend/app/error.tsx`, `frontend/app/(dashboard)/error.tsx`, `frontend/app/global-error.tsx` — error boundaries
- `releases/October/10Oct2026/PR-v1.7.0.md` — this file

### Modified Files (highlights)

**Frontend:**
- `lib/api.ts` — timeout, `ApiError`, offline/unreachable/timeout messages, safe JSON parse, no global toast
- `app/(dashboard)/billing/page.tsx` — `client_ref`, draft save/restore, no-reply banner, print right after save
- `components/billing/BillingRowItem.tsx` — restored rows, batch load errors, search errors
- `components/billing/CustomerLookup.tsx` — lookup failures shown
- `lib/generateBill.tsx` — `printBill` with blocked-tab fallback; WhatsApp PDF errors
- `lib/useProductSearch.ts` — exposes search errors
- `store/cartSlice.ts` — `restoreCart`
- `app/toaster-client.tsx` — static import, mount-only render
- Dashboard, inventory, inventory/add, adjustments, customers, distributors, orders, orders/[id], reports pages — load errors, retry, CSV export errors

**Backend:**
- `internal/handlers/orders.go` — `client_ref` idempotency, plain bill errors
- `internal/handlers/helpers.go` — `serverError`, `pgErrorCode`
- `internal/handlers/{inventory,customers,distributors,settings,admin,reports,stock_adjustments}.go` — plain messages, no raw database text
- `internal/queries/orders.sql` — `client_ref` on `CreateOrder`, `GetOrderByClientRef`
- `frontend/package.json` — version 1.7.0; `landing/app/page.tsx` — v1.7 stats

---

## Technical Notes

- Branched from `feat/subhanu` (v1.6.0) because both touch `lib/api.ts`, Add Stock and the billing row. Until PR #21 merges, this PR's diff also shows the v1.6.0 commits.
- Migration `000013` uses `ADD COLUMN IF NOT EXISTS` (same pattern as `000006`/`000010`) so sqlc can see the column. It takes a brief lock on `orders` at each startup, as those already do. The column is nullable with no default, so adding it is a metadata-only change.
- Deploy order: the frontend sends `client_ref` only to a backend that has the column (the backend runs migrations before listening). An older frontend without `client_ref` keeps working (verified).
- The 20s timeout applies to every request. The report CSV download uses its own 30s timeout.

---

## Known Considerations

- **Super-admin portal** (`lib/super-admin-api.ts`) still uses the old request logic and messages. It's not shop-facing, and is left for a follow-up.
- **P2 polish not included:** longer error-toast duration and a close button, field-level form errors, and confirm dialogs that show progress (delete/return).
- **Bill number race:** two different bills saved at the same instant can still collide on the bill number (`count+1`). The second now gets a clear "press Place Order again" message, and that retry is safe.
- **Pre-existing test failures** (also on `main`): `TestLookupCustomer_PhoneValidation`, `TestLookupCustomer_NoPhoneParam`, `TestSuperAdminLogin_InvalidJSON`, `TestSuperAdminLogin_MissingCredentials` and `TestSMTPConfig_IsConfigured`.

---

## Test Plan

### Duplicate-safe billing
- [ ] Same bill posted twice with one `client_ref` → second reply `200` with the same order number; one order; stock deducted once
- [ ] Same bill posted 3× concurrently with one `client_ref` → one order; stock deducted once
- [ ] Browser: block the reply after the server saves (or drop Wi-Fi right after clicking Place Order) → no-reply banner says retrying is safe → Place Order again → "Bill created" with the **same** number; one order in Orders
- [ ] After a no-reply, change a quantity → banner says it's now a new bill and links to Orders
- [ ] Bill posted without `client_ref` (older frontend) → created normally

### Bill in progress
- [ ] Add items + customer → reload → "Restored the bill you were working on"; rows, batch, customer, payment and GST mode restored; batch dropdown works
- [ ] Let the session expire mid-bill → log in → bill restored
- [ ] Save the bill → reload → empty bill, no restore note
- [ ] **Start a new bill** on the restore note clears it

### Load failures
- [ ] Stop the backend → Dashboard, Inventory, Customers, Distributors (+ batch panel), Adjustments and an Order show "Couldn't load … · Retry"; start the backend → Retry loads data
- [ ] Billing row: batches fail to load → "Couldn't load · Retry"; Retry loads them
- [ ] Add Stock search fails → "Search failed …" and no "+ Add as new product"
- [ ] Customer phone lookup fails → toast says so; details can still be typed

### Messages
- [ ] Turn Wi-Fi off → any action shows "You're offline…" (once)
- [ ] Backend unreachable while online → "Can't reach SellOS right now…"
- [ ] Add a product with an SKU already used → "Another product already uses this SKU."
- [ ] Edit a customer to another customer's phone → "Another customer already has this phone number."
- [ ] Order more than available stock → "Not enough stock for <product> (batch <no>): …"
- [ ] CSV export with the backend failing → error toast; no `.csv` downloaded
- [ ] Block popups → Place Order → "Print bill" toast action opens the bill

### Error pages
- [ ] Force a render error on a dashboard page → error screen inside the app layout with Try again / Dashboard

---

**SellOS v1.7.0** — Every bill counted once, every cart kept, and every problem explained in words a shop owner understands.
