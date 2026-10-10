# SellOS v1.6.0 — Release Notes

### One product, one place: no duplicate products, restock straight from inventory, and a dashboard that works on phones

**Release Date:** October 2026
**Branch:** `feat/subhanu` → `main`

---

## Overview

Sipra Lifeline had 100 duplicate products (84 groups). The same medicine was being created again at restock time, so its stock was split across copies (P40 DSR existed four times). This release stops duplicates at the database level and makes restocking start from the existing product. It also lets a repeat purchase of a batch be saved as its own entry, which keeps purchase GST reports correct. Alongside this, the dashboard now works on phones and tablets down to 320px, the landing page gets a WhatsApp lead form and Meta Pixel, and marketing assets are added to `docs/`.

---

## What's New

### 1. Duplicate product prevention
**Commits:** `82d8e48`, `a4e3084`

- **One product per name + company.** Case, spacing and punctuation are ignored, so "Omeprazole 20mg + Domperidone" and "OMEPRAZOLE 20mg & domperidone" count as the same product.
- **Strengths and variants stay separate.** Punctuation between digits is kept, so "Thyronorm 12.5 mcg" ≠ "Thyronorm 125 mcg" and "50/1000" ≠ "501000". A "+" attached to the end of a word is kept too, so "Sugar Free Gold+" ≠ "Sugar Free Gold", "SPF 50+" ≠ "SPF 50" and "PA+++" ≠ "PA++++". A spaced " + " between ingredients is still ignored. Names in non-Latin scripts keep their letters.
- **Matches are never used silently.** If "+ Add as new product" matches an existing product, Add Stock stops and shows it: *"This product is already in your catalog: Thyronorm 12.5 mcg · Abbott"*, with **Use this product** or **Edit name**.
- **Search finishes before "+ Add as new product" appears.** It used to show from the first keystroke, before results had loaded.
- **Company name suggestions** on the new-product form, so "Knoll" and "Knoll Healthcare" don't both get created.

**Why it matters:** "+ Add as new product" was always on offer, and the backend accepted duplicates without complaint. About 90 of the 100 duplicates were created more than a day after the original, during restocks. Split stock means billing shows the same medicine several times and stock counts are wrong.

**Technical Notes:**
- Migration `000011` creates `products_name_company_norm_key` on a normalized name and company. The key is built in three steps on `lower(x) COLLATE "C"`: trailing "+" runs become one `p` each, punctuation between digits becomes `d`, and the remaining spaces and punctuation are stripped. It then drops the exact-name `products_name_company_key`. It runs as one implicit transaction. If near-duplicates still exist, the `CREATE` fails (logged as a warning), the `DROP` never runs, and the exact-name index stays in force. `IF NOT EXISTS` makes later startups a no-op.
- `CreateProduct` looks up the product first, then inserts, so it works whether or not a tenant's index exists yet. It returns `200 {…, existing: true}` on a match and `201 {…, existing: false}` on create. If a concurrent identical create hits the unique index, it looks up again and returns the winning row.
- `COLLATE "C"` pins `[[:punct:]]` / `[[:space:]]` to ASCII, so the key is identical on every server locale. Without it, a Mac's `en_US.UTF-8` doesn't treat "+" as punctuation, while production (`C.UTF-8`) does. The same test cases were verified on production and on an `en_US.UTF-8` copy with identical results. Pinning it now matters, because changing the key after the index is built means rebuilding the index.
- `FindProductByNameCompany` uses the same expression and orders by `created_at`, so a tenant that still has near-duplicates always gets the oldest product.

---

### 2. Restock from inventory, and repeat purchases of a batch
**Commits:** `82d8e48`, `a4e3084`

- **"Add batch" on every inventory row** opens Add Stock with the product selected. MRP, selling price, GST rate, distributor and box no. are filled from the latest batch, with a note saying so. Batch no., expiry, qty, buying price and invoice no. are always left blank.
- **Pre-fill respects what you type.** A field is only replaced if it's empty or still holds the value carried in last time. A slow response for a previously selected product is ignored. Moving away from a selected product (new search, or "+ Add as new product") clears its untouched carried values, so one product's prices can't carry over to another.
- **A batch no. bought again is saved as its own entry.** Add Stock lists the earlier purchases of that batch no. as soon as it's typed: date, buying, selling, MRP, stock, invoice and distributor. It includes a **View batch ↗** link that opens Inventory searched to that batch in a new tab. The expiry is filled from the earlier entry and highlighted if changed. An auto-filled expiry is cleared again if the batch no. stops matching (e.g. "2301" matching on the way to typing "23015"); an expiry you typed is kept. Corrections to an earlier entry go through Edit batch.
- **Billing tells repeated batches apart.** When a product has the same batch no. more than once, the dropdown shows `TN001 · cost ₹90.00 · sells ₹120.00 · 10 left` for each entry, older purchase first. Batch nos. that appear once keep the plain label.

**Why it matters:** `UNIQUE(product_id, batch_no)` rejected a second purchase of the same batch with a raw database error, and creating the product again was the only workaround. Adding the units onto the old batch row instead would put a later purchase into an earlier month of the purchase GST report, at the old price and GST rate. Separate rows keep each purchase's date, price, GST, invoice and distributor, so GST, distributor and margin reports stay correct with no report changes.

**Technical Notes:**
- Migration `000012` drops `batches_product_id_batch_no_key`. Stock, bills, returns and adjustments all key on `batch_id`; nothing relied on batch no. being unique.
- `ListActiveBatchesForProduct` orders by `expiry_date, created_at`, so the older purchase of a repeated batch is listed first.
- `GET /products/{id}` (Add Stock pre-select) and `GET /products/companies` (new-product suggestions) added. `/inventory` accepts `?q=` and shows expired batches when opened that way.

---

### 3. Data repair scripts
**Commits:** `82d8e48`, `a4e3084`

- `backend/scripts/merge_duplicate_products.sql` merges exact-duplicate products in one tenant. It keeps the oldest product, moves the copies' batches to it unchanged, copies removed products into `merge_archive_products`, and runs in one transaction.
- `backend/scripts/unfold_merged_batches.sql` splits batches that the first version of the merge script combined. It restores each folded purchase as its own row from `merge_archive_batches`, takes its quantities off the older row, and points bill lines and adjustments back using `merge_archive_repoints`. It aborts if any row would go negative. After the split, it checks that every involved batch's sold qty equals the units billed minus returned on its bill lines; that held for all 20 batches before the merge. Any mismatch (e.g. a return after the merge on a re-pointed line) rolls everything back. It's idempotent.

**Why it matters:** The first merge on Sipra Lifeline (2026-10-08) combined 10 same-batch-no. pairs. 8 of them moved a purchase into an earlier month of the purchase GST report, and one folded a 0% GST purchase into a 5% batch. Nothing was lost, since every row was archived, and the split script restores them exactly.

**Technical Notes:**
- Tested on a local restore of production. After the split, all 859 batch rows (ids, dates, prices, GST, purchased, sold, invoice, distributor), the purchase GST totals by month and slab, and all 5,254 bill line → batch links are identical to the pre-merge backup.

---

### 4. Dashboard responsive down to 320px
**Commit:** `297c20d`

- Below `lg`, the sidebar becomes a 48px top bar with an off-canvas drawer (backdrop, Escape to close, scroll lock, closes on navigate). The desktop layout is unchanged, and the collapsed state now persists.
- Orders and inventory show as cards below `md`. Row actions are shared through `OrderActions` / `BatchActions`.
- Toolbars wrap, search inputs go full width, and touch targets grow to 40px on mobile. Icon-only buttons get aria-labels and visible labels on mobile.
- `BillingTable` gets a scroll wrapper, which also fixes `/billing` on 1024–1152px laptops.

**Why it matters:** The app was desktop-only below about 900px. At 390px the content column was 110px wide, and 11 of 14 screens overflowed. Shop owners check stock and orders on their phones.

**Technical Notes:**
- Verified with a Playwright audit (`docs/feature/mobile-audit/audit.mjs`) over 14 routes: 0 failures at 320/390/430/768/1024/1280/1440/1920px.
- The top bar is `print:hidden`, so bills still print cleanly from a tablet.

---

### 5. WhatsApp contact form on landing CTAs
**Commit:** `3624c2e`

- Landing CTAs open a lead form (name and shop name required) that hands off to WhatsApp with a pre-filled message.
- Fires the Meta Pixel `Lead` event on submit, when the pixel is loaded.

**Why it matters:** Visitors had no low-friction way to reach us. WhatsApp is how medical shop owners in Kolkata and Tirupati actually talk to vendors.

**Technical Notes:**
- The number comes from `NEXT_PUBLIC_WHATSAPP_NUMBER` (falls back to `919073055125`).

---

### 6. Marketing assets, Meta Pixel and pricing copy
**Commit:** `16a50a3`

- `docs/branding/branding.html` (brand guide), the Facebook ad set (9 creatives and an export script), an A5 flyer, a field kit, a UI showcase, and the GA and mobile-responsive plans.
- The landing page loads the Meta Pixel only when `NEXT_PUBLIC_META_PIXEL_ID` is set.
- Landing SEO and structured-data pricing changed from "₹10/month" to **"First month free, then ₹799/month"** (`price: 799`).

**Why it matters:** This gives the go-to-market work a single brand reference and ready-to-run ads, and the landing page now measures conversions from them.

---

## Summary of Changes

### New Files
- `backend/internal/migrations/tenant/000011_unique_product_name_company.up.sql` — product name + company uniqueness (punctuation-insensitive, strength-safe)
- `backend/internal/migrations/tenant/000012_allow_repeat_batch_no.up.sql` — drops `UNIQUE(product_id, batch_no)`
- `backend/scripts/merge_duplicate_products.sql` — one-off per-tenant duplicate product merge
- `backend/scripts/unfold_merged_batches.sql` — splits batches combined by the first merge
- `landing/components/lead.tsx` — WhatsApp lead form provider and modal
- `docs/branding/`, `docs/marketing/`, `docs/feature/*` — brand guide, ads, flyers, plans, mobile audit
- `releases/October/10Oct2026/PR-v1.6.0.md` — this file

### New Backend Endpoints
- `GET /products/{id}` — fetch one product (Add Stock pre-select)
- `GET /products/companies` — distinct company names (new-product suggestions)

### Modified Files (highlights)

**Frontend:**
- `frontend/app/(dashboard)/inventory/add/page.tsx` — `?product_id=` pre-select, last-batch pre-fill, earlier-purchase panel, existing-product confirmation, company suggestions, search-settled gating
- `frontend/app/(dashboard)/inventory/page.tsx` — "Add batch" row action, `?q=` search, mobile cards
- `frontend/components/billing/BillingRowItem.tsx` — cost / selling / stock labels for repeated batch nos.
- `frontend/lib/api.ts` — `getProduct`, `listCompanyNames`, typed `createProduct` response
- `frontend/package.json` — version 1.6.0
- Sidebar, layout, orders, billing and modals — responsive work (see `297c20d`)
- `landing/app/page.tsx`, `landing/app/layout.tsx` — lead CTAs, Meta Pixel, pricing copy, v1.6 stats, Batch & Expiry card

**Backend:**
- `backend/internal/handlers/inventory.go` — `CreateProduct` with `existing` flag and race handling, `GetProduct`, `ListCompanyNames`
- `backend/internal/handlers/helpers.go` — `isUniqueViolation`
- `backend/internal/queries/products.sql`, `batches.sql` — `FindProductByNameCompany`, `ListCompanyNames`, active batches ordered by `created_at` within expiry
- `backend/internal/db/migrate.go` — registers `000011`, `000012`
- `.gitignore` — ignores `backups/` (local DB dumps contain customer data)

---

## Technical Notes

- Tenant migrations re-run on every startup and only log a warning on failure, so the order between deploying and running the data scripts doesn't matter. Both scripts drop the batch-no. constraint themselves.
- Bill lines (`order_items`) keep their own copy of `product_name`, `batch_no` and prices. Re-pointing `batch_id` never changes a printed or reprinted bill.
- `backend/.env` points at production. For local testing, override `DATABASE_URL` with a local restore (`godotenv` doesn't override existing env vars).
- The restock-as-stock-adjustment approach from the first review round was removed rather than fixed. Purchase GST reports read batch rows by `created_at`, so any design that adds units to an existing row moves purchases between months.

---

## Known Considerations

- **Sipra Lifeline production data.** The 100 exact duplicates were merged on 2026-10-08 after a verified full backup. The 10 batch pairs that merge combined are still combined in production until `unfold_merged_batches.sql` runs, after shop hours, with a fresh backup. Since the merge, 2 bill lines (3 units) were billed against those batches. They stay on the older row, and no row goes negative. No re-pointed bill line has been returned, deleted or edited since the merge (checked on 2026-10-10).
- **Near-duplicates still on Sipra.** 10 groups (same company) differ only by punctuation, plus company-name variants such as "Knoll" vs "Knoll Healthcare". Until they're cleaned up with a reviewed mapping, `000011` logs a warning on Sipra and the exact-name index keeps enforcing uniqueness.
- **Punctuation between digits is treated alike**, so "12-5" and "12.5" match. The existing-product confirmation shows the match before anything is saved.
- **A sale larger than one entry's stock.** When a batch no. has two entries, a sale bigger than either entry's stock needs a second bill line from the other entry.
- **Pre-existing test failures.** `go test ./internal/handlers` has 5 failures that are also on `main`: `TestLookupCustomer_PhoneValidation` and `TestLookupCustomer_NoPhoneParam` (nil pool panic), `TestSuperAdminLogin_InvalidJSON`, `TestSuperAdminLogin_MissingCredentials`, and `TestSMTPConfig_IsConfigured`. The panic was hiding the last three. The remaining 68 tests pass.
- **Pricing copy** on the landing page now says ₹799/month after a free first month. It needs business sign-off before merging.

---

## Test Plan

### Duplicate prevention
- [ ] "+ Add as new product" with `THYRONORM 12.5mcg` / `abbott` when "Thyronorm 12.5 mcg" / "Abbott" exists → "already in your catalog" panel → **Use this product** selects it; no new product row
- [ ] "+ Add as new product" with `Thyronorm 125 mcg` / `Abbott` → created as a separate product
- [ ] Type 1–2 letters in Add Stock search on a catalog over 200 products → "Type at least 3 letters to search", with no "+ Add" option
- [ ] The Company field suggests existing company names
- [ ] Rename a product (Edit product) to an existing name + company → "A product with this name and company already exists"

### Restock and repeat batches
- [ ] Inventory row → "Add batch" → product selected; MRP, selling, GST, distributor, box match the latest batch, and the note names its batch no.
- [ ] Batch no., expiry, qty, buying price and invoice no. are empty
- [ ] Type an MRP, then switch product → the typed MRP is kept; untouched fields take the new product's values
- [ ] Select a product (prices pre-fill), then retype the search and choose "+ Add as new product" → the pre-filled prices and note are cleared
- [ ] "+ Add as new product" with "Sugar Free Gold+ 100 Pellets" when "Sugar Free Gold 100 Pellets" exists (same company) → created as a separate product
- [ ] Type an existing batch no. → expiry fills in; the panel lists each earlier purchase; **View batch ↗** opens Inventory in a new tab searched to that batch (expired included)
- [ ] Change the expiry on a repeated batch → field highlighted with a warning
- [ ] Product has batch `2301`; type `23015` into Batch no. → the expiry auto-filled at `2301` is cleared at `23015`
- [ ] Save → a second row with the same batch no. appears in Inventory with this purchase's date, price, invoice and distributor
- [ ] Billing → that product → the dropdown shows both entries with cost, selling and stock, older first; picking each fills its own selling price
- [ ] Reports → purchase GST for this month includes the new purchase; earlier months are unchanged

### Migrations and data scripts
- [ ] Backend startup on a tenant without near-duplicates → `000011` and `000012` OK; `products_name_company_norm_key` exists; `batches_product_id_batch_no_key` is gone
- [ ] On Sipra → `000011` logs a warning; `products_name_company_key` still exists; `000012` OK
- [ ] `unfold_merged_batches.sql` on a restore of Sipra → 10 batches restored; batch rows, purchase GST by month and bill-line links match the pre-merge backup; a second run restores 0; with a return on a re-pointed line made first, the run rolls back with nothing changed

### Responsive dashboard
- [ ] At 390px: top bar and drawer open/close (Escape, backdrop, navigation); no horizontal page scroll on billing, inventory or orders
- [ ] Inventory and orders render as cards below 768px; all row actions work
- [ ] Desktop (1440px) layout unchanged; sidebar collapse persists across reloads
- [ ] Print a bill from a tablet width → no top bar in the print

### Landing
- [ ] Each CTA opens the lead form; submitting without name or shop is blocked
- [ ] Submit → WhatsApp opens to the configured number with the pre-filled message
- [ ] With `NEXT_PUBLIC_META_PIXEL_ID` unset → no pixel script in the page source
- [ ] The stats strip shows "v1.6 — Latest release — October 2026"

---

**SellOS v1.6.0** — Every medicine on one shelf: one product record, every purchase kept on its own, and the whole dashboard in your pocket.
