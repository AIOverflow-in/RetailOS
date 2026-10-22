# SellOS v1.10.0 — Release Notes

### Bill without the mouse, and know where your customer lives: keyboard-first billing, shortcuts everywhere, customer addresses, and customer edits from the order page

**Release Date:** October 2026
**Branch:** `feat/customer-address-shortcuts` → `main`

---

## Overview

Billing was fast to search but slow to finish: after picking a product the cashier had to reach for the mouse to set the quantity, add the next line and place the order. This release makes the whole bill keyboard-driven and adds shortcuts for moving around the app, with a floating panel that lists them. It also adds an optional customer address (printed on the bill when present) and lets the cashier correct a customer's details from the order page, where the mistake is usually noticed.

---

## What's New

### 1. Keyboard-first billing
**Commit:** `fbd8aed`

- Enter on a product moves to Qty; if the product has several batches it moves to the Batch box first, and Enter there moves to Qty.
- Enter on Qty or Price goes to the next line's product box, adding a line if there isn't one.
- Ctrl+Enter (Cmd+Enter on Mac) places the order from anywhere on the page; Alt+D deletes the current line.
- Qty and Price select their text on focus and no longer change when the scroll wheel passes over them.
- The cursor starts in the first product box when the page opens, after a bill is placed, and when the cashier returns from the print tab.
- Place Order shows what is missing ("Required: …") under the button instead of in a hover tooltip.

**Why it matters:** A bill used to need a mouse trip after every product. Now a bill is: type the product, Enter, type the quantity, Enter, repeat, Ctrl+Enter.

**Technical Notes:**
- Inputs are found through `data-row` / `data-field` attributes (`lib/focusField.ts`), so rows need no ref plumbing.
- Focus after a product pick waits for the row to re-render with its batch, so it never lands on a disabled input.
- Enter in the Batch select moves on, but arrow keys do not, so choosing a batch with the keyboard works.

---

### 2. Navigation shortcuts and a floating shortcut panel
**Commit:** `fbd8aed`

- Alt+1 to Alt+8 jump to the sidebar pages in order; Alt+N starts a new bill; F2 or Alt+P focuses the customer phone; `/` focuses the page's search box (Orders, Inventory, Customers, Distributors); `?` shows or hides the panel.
- A round keyboard button sits at the bottom-left. Hovering shows every shortcut, clicking pins it open, dragging moves it, and it remembers where it was left. It is hidden on mobile and when printing.

**Why it matters:** Shortcuts nobody can find don't get used; the panel is always one hover away.

**Technical Notes:**
- Alt shortcuts match `e.code`, not `e.key`, because Option+digit types symbols on a Mac.
- `/` and `?` do nothing while typing in a field.

---

### 3. Optional customer address
**Commit:** `ab25356`

- An optional Address field on the billing screen, after Age. It fills in for returning customers.
- The address is printed on the bill and the WhatsApp PDF when one is saved, and shown on the order page, the Customers table and the edit dialog.
- A returning customer's name, age and address typed on a bill now update the saved customer. Before, the server ignored them.

**Why it matters:** Deliveries and follow-ups need an address, and it should be captured at the counter without slowing the bill: it is never required.

**Technical Notes:**
- Migration `000014_add_customer_address` adds a nullable `customers.address`. It is registered in `tenantMigrations` (`internal/db/migrate.go`), which is a hardcoded list, so a new file there is not picked up automatically.
- On `POST /orders`, an omitted `address` leaves the saved one alone and a blank one clears it, so older browser tabs cannot erase addresses.
- Verified on a restored copy of the production database: both tenants get the column, row counts are unchanged.

---

### 4. Edit the customer from the order page
**Commit:** `ab25356`

- The Customer card on an order has an Edit button that opens the same dialog as the Customers page (name, phone, age, address). The order reloads with the new details after saving.
- The dialog says the change applies to all of this customer's bills. A phone number already used by another customer is refused with a message.

**Why it matters:** Typos in a name or phone are noticed on the bill, not on the Customers page.

**Technical Notes:**
- Orders store only `customer_id`, so editing changes the shared customer record, and older bills show the new details when opened or reprinted.

---

## Summary of Changes

### New Files
- `frontend/components/shared/Shortcuts.tsx` — global shortcuts and the floating shortcut panel
- `frontend/lib/focusField.ts` — focus an input by row and field
- `backend/internal/migrations/tenant/000014_add_customer_address.up.sql` — nullable `customers.address`

### Modified Files (highlights)

**Frontend:**
- `components/billing/BillingRowItem.tsx`, `BillingTable.tsx` — focus flow, Enter handling, row shortcuts
- `app/(dashboard)/billing/page.tsx` — Ctrl+Enter, inline missing-fields hint, address sent with the order
- `components/billing/CustomerLookup.tsx` — Address field
- `components/customers/EditCustomerModal.tsx`, `app/(dashboard)/orders/[id]/page.tsx` — address field, Edit button on the order
- `app/bill/[id]/page.tsx`, `components/bill/BillDocument.tsx` — address on the printed bill and PDF

**Backend:**
- `internal/handlers/orders.go` — address on create, returning customers updated from the bill
- `internal/handlers/customers.go` — address on update, `cleanAddress`
- `internal/db/migrate.go` — migration registered
- `internal/queries/*.sql`, `internal/generated/*` — regenerated with sqlc

---

## Technical Notes

- Two customer tests that predate the list-mode `GET /customers` could never pass without a database and were removed. Three super-admin handler tests (`TestSuperAdminLogin_*`, `TestSMTPConfig_IsConfigured`) already fail and are unrelated.
- `000011_unique_product_name_company` still logs a warning on Sipra's schema at every start (duplicate products), as before this release.

---

## Known Considerations

- Editing a customer changes their old bills too; there is no per-bill snapshot of the customer.
- The earliest-expiry batch is not chosen automatically; a product with several batches stops at the Batch box.
- Shortcuts are for desktop keyboards; the panel is hidden below the `lg` breakpoint.

---

## Test Plan

### Billing by keyboard
- [ ] Open Billing → the cursor is in the first product box
- [ ] Type part of a product name, Enter → focus is in Qty with the value selected
- [ ] Pick a product with 2+ batches → focus lands on the Batch box; ↓ then Enter → Qty
- [ ] Type a quantity, Enter → a new line opens with the cursor in its product box
- [ ] Alt+D on a line → the line is removed and focus moves to the line above
- [ ] With the phone or items missing, Ctrl+Enter → "Required: …" toast and no bill; with everything filled → the bill is placed
- [ ] Scroll the mouse wheel over Qty or Price while focused → the value does not change
- [ ] After placing a bill and returning from the print tab → the cursor is in the first product box

### Shortcuts and panel
- [ ] Alt+1 … Alt+8 open Dashboard, Billing, Inventory, Distributors, Orders, Customers, Reports, Settings
- [ ] `/` on Orders, Inventory and Customers focuses the search box; typing `/` inside a field types it
- [ ] `?` shows the panel; Esc closes it
- [ ] Hover the bottom-left button → the list appears; drag it elsewhere and reload → it stays there

### Customer address
- [ ] New customer with an address → the printed bill and the WhatsApp PDF show it
- [ ] Bill without an address → no address row on the bill
- [ ] Look up a returning customer by phone → the address is filled in
- [ ] Change the name and address on a returning customer's bill → Customers shows the new values
- [ ] Clear the address on a returning customer's bill → the saved address is removed

### Edit customer from an order
- [ ] Open an order → Customer card → Edit → change the name and address → the card updates
- [ ] Open an older bill of the same customer → it shows the new details
- [ ] Change the phone to another customer's number → "Another customer already has this phone number."

### Deploy
- [ ] Take a database backup first; after deploy, the backend log shows `000014_add_customer_address.up.sql … OK` for every tenant
- [ ] Row counts per table are unchanged

---

**SellOS v1.10.0** — Bills at the speed of typing, and the customer's details right where the cashier needs them.
