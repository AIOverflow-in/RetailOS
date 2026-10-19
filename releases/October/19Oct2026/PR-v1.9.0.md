# SellOS v1.9.0 — Release Notes

### Sales you can trust, and every bill findable: partial returns counted right, tax correct on reports and bills, bad lines stopped, IST dates, and bills found by batch

**Release Date:** October 2026
**Branch:** `fix/returns-and-void-orders` → `main`

---

## Overview

Partially returning a bill made the whole bill vanish from today's sales and from the GST report, instead of just the returned units. Edits that added items or quantity to a bill also charged GST on top of a price that already includes it. The GST report showed "Taxable Value" equal to the total, with the tax never taken out. Deleted bills disappeared from Orders entirely. A billing audit then found more:
- printed bills had the same taxable-value mistake, and reprinted partially returned bills at their original quantities;
- the server accepted negative quantities and ₹0 prices, and let the same batch on two lines oversell;
- batches without a GST rate billed silently at 0%;
- every "day" started at 05:30 IST.

This release fixes all of these, verified on a local copy of Sipra's data. It also adds a way to find a bill by batch number, for returns from walk-in customers billed under the shop's name, and carries the blue search highlight that missed v1.8.0.

---

## What's New

### 1. Partially returned bills count at their kept value
**Commits:** `3761d54`, `dafabbe`

- Today's sales, the order count and the payment-mode split on the dashboard now include partially returned bills, at their amount after the return.
- The GST report (summary, rate slabs and CSV export) includes them too, counting only the units the customer kept.
- Fully returned and deleted bills still don't count.

**Why it matters:** Returning 1 strip out of a ₹550 bill used to drop all ₹550 from today's sales, not ₹150. Every partially returned bill was missing from that day's sales and GST report. Sipra had 34 such bills (₹17,507 kept by customers) missing from its reports.

**Technical Notes:**
- Dashboard queries now count `status IN ('active', 'partially_returned')`. `orders.total_amount` is already kept net of returns by the edit flow, so the dashboard needed no other change.
- The report queries scale each line by `(qty - returned_qty) / qty` and round per line, the same way the edit flow computes the bill's net total. So the report total matches the sum of the bills.
- Taxable value is the rounded kept total minus the rounded kept CGST, SGST and IGST, so the columns always add up to the paisa. Rounding each piece separately could leave a partially returned line 1 paisa off (3 × ₹35 at 5% with 1 returned: 66.67 + 1.67 + 1.67 = 70.01 instead of 70.00). On the local copy of Sipra's data, every month, the full year and every rate slab add up exactly (6 figures were 1 paisa off before).

---

### 2. The GST report separates the tax from the taxable value
**Commit:** `3761d54`

- "Taxable Value" is now the sale amount without GST (bill total minus CGST, SGST and IGST), in the summary, every rate slab and the CSV export.

**Why it matters:** Prices are GST-inclusive, but the report computed taxable value as price × qty, so it showed the tax-inclusive amount, the same number as the total. Filing from that would overstate the taxable turnover. Sipra's October so far: ₹72,865.85 shown, ₹69,857.67 correct.

**Technical Notes:**
- `taxable = line_total − cgst − sgst − igst`. This is also correct for bills from before 26 Apr 2026, when GST was still added on top of the price.

---

### 3. Editing a bill no longer adds GST on top
**Commit:** `3761d54`

- Adding an item to a saved bill, or raising a line's quantity, now prices it the same way as a new bill: the selling price includes GST, and the tax is extracted from it.

**Why it matters:** Adding a ₹125 item at 5% GST to an existing bill made the bill go up by ₹131.25 instead of ₹125. The customer was overcharged, and sales and tax were inflated.

**Technical Notes:**
- New `lineAmounts()` helper in `handlers/orders.go` is the only place a bill line is priced, used by new bills and both edit paths. Unit test: `TestLineAmounts_GSTInclusive`.
- Existing data is not changed. On Sipra, only 4 lines in 2 edited bills (₹23.50) were affected. The other 53 lines where GST sits on top are from bills before 26 Apr 2026, when that was how bills were priced and charged.

---

### 4. Deleted bills stay in the order history
**Commit:** `aa8bcc0`

- Deleting a bill still puts its stock back and removes it from sales and GST reports, but the bill now stays in Orders, labelled **Deleted** with its amount struck through.
- A new **Deleted** status filter shows just the deleted bills.
- The bill's own page says it was deleted, when, and that it no longer counts.
- The delete confirmation explains this before the bill is deleted.

**Why it matters:** A deleted bill used to vanish without a trace. That leaves a gap in the bill-number sequence that nobody can explain, and no record of what was deleted or when.

**Technical Notes:**
- The list and count queries no longer exclude `deleted`. The default view (no filter) shows every bill.
- Deleting sets `updated_at`, which the bill page shows as "Deleted: <date>".

---

### 5. Selected search result highlighted in blue
**Commit:** `850a989`

- The highlighted product in the billing search dropdown (arrow keys or mouse) is shown in brand sky blue with a blue bar on the left. Before, it was a faint grey.

**Why it matters:** The grey highlight was hard to see, especially while moving quickly with the arrow keys.

---

### 6. Every date is an IST date
**Commit:** `a582486`

- Today's sales on the dashboard, the GST report's date range, the order list's date filter, the bill-number financial year and expiry checks all use India time. Before, each day began at 05:30 IST.
- The GST report now includes the whole last day of the range. Before, it stopped at 23:59:59 and dropped the final second.

**Why it matters:** The server and database run in UTC. A bill at 00:30 IST counted as the previous day, and a bill at 02:00 IST on 1 October landed in September's GST report. A batch expiring today stayed billable until 05:30 IST. Sipra has never billed between midnight and 05:30, so its figures are unchanged. A late-night pharmacy would have seen wrong days.

**Technical Notes:**
- `SET TIME ZONE 'Asia/Kolkata'` runs with the per-request `search_path` (and is reset on release), so `CURRENT_DATE` and `created_at::date` are IST. Every timestamp column is `timestamptz`, so no stored data changes.
- In Go, a fixed IST zone (`time.FixedZone`, since India has no daylight saving) is used for the dashboard's "today", report ranges (`from` 00:00 IST, up to but not including 00:00 IST after `to`), the financial year and the Add Stock expiry check.
- API timestamps now come back with a `+05:30` offset instead of `Z`. They are the same instants, and the frontend parses them as before.
- Verified on a local copy of Sipra's database running in UTC like Neon:
  - The old and new servers returned the same data for 178 responses: dashboard, every month and day of the GST report, CSV exports, order lists for 40 days, products, batches and distributors.
  - Test bills at 00:30 IST, 23:59:59.5 IST and 02:00 IST on 1 October moved to the correct day and month only on the new server.

---

### 7. Printed and WhatsApp bills: correct taxable value and kept quantities
**Commit:** `498e387`

- The GST summary on every printed bill and WhatsApp PDF shows the taxable value without GST. Before, it showed the GST-inclusive amount.
- Reprinting a partially returned bill shows only what the customer kept. Returned lines are left out, quantities and tax are net, and "You saved" is computed from the kept items. Before, the returned amount showed up as an extra "discount".

**Why it matters:** A ₹112 item at 12% printed "Taxable ₹112.00" next to ₹12 of tax. A reprint of a bill with a ₹290 item returned listed that item and claimed the customer saved ₹290 more than they did. Sipra has 34 partially returned bills.

**Technical Notes:**
- New `lib/billItems.ts` (`orderItemsToBillItems`) is shared by the print page and the WhatsApp PDF. It scales each line by kept/qty with per-line rounding, the same way the server nets the order total, so the printed lines add up to the bill total. It's a separate file so the billing page doesn't load the PDF library.
- Verified on SL/3196/26-27 (local copy): 4 of 5 lines, taxable ₹252.36, CGST/SGST ₹6.32 each, saved ₹651.37, all matching the database.

---

### 8. Bad bill lines are stopped, with clear messages
**Commit:** `460e868`

- New bills and lines added to saved bills are refused, with a message naming the product, when:
  - the quantity is 0 or less (a negative quantity used to *add* stock);
  - the selling price is ₹0 or less;
  - the GST rate isn't 0, 5, 12, 18 or 28%;
  - the batch has expired (expiry today or earlier, IST).
- A price above MRP is still allowed.
- The same batch on several lines is checked against its stock in total ("8 requested across 2 lines, only 6 available"). Before, each line was checked alone, so the batch could be oversold.
- The billing screen shows the same errors before saving. A ₹0 price is outlined in red, and the Qty box shows the quantity that will actually be billed (capped to stock, whole units).

**Why it matters:** The server trusted whatever the screen sent, so a typo like `-5` or `0` went straight into the bill and the stock.

**Technical Notes:**
- `validateBillLine()` and `expiredBatchMessage()` in `handlers/orders.go`, with unit tests. `LockBatchForUpdate` now also returns `expiry_date`.
- Batches are locked in sorted order, so two bills sharing batches can't deadlock.

---

### 9. Warning when a batch has no GST rate
**Commit:** `460e868`

- Picking a batch saved without a GST rate shows a warning ("this batch has no GST rate saved, so GST is set to 0%") and highlights the GST box in amber until a rate is chosen. The same warning appears when adding such a batch to a saved bill.

- It's only a warning: billing at 0% still goes through, since some products really are 0% GST. Batches saved with a 0% rate show no warning; only batches with no rate at all do.

**Why it matters:** These batches silently billed at 0% GST. Sipra has 11 such batches in stock, and 10 lines have already gone out at 0%.

---

### 10. CGST and SGST add up to the tax exactly
**Commit:** `dc4642f`

- The tax is split in whole paise: CGST takes the odd paisa and SGST the rest. For example, ₹5.33 of tax is now ₹2.67 + ₹2.66. Before, each half was rounded up separately, giving ₹2.67 + ₹2.67 = ₹5.34.
- The billing screen now rounds exactly like the server: the line total first, then the same rounding rule. The cart summary and WhatsApp bill show exactly what gets saved.

**Why it matters:** About half of all in-state lines recorded 1 paisa of extra tax. That's 3,130 lines and ₹31.30 on Sipra so far, overstating output tax and understating taxable value in GST filings. Separately, the screen and the saved bill could differ by a paisa on some price × qty combinations.

**Technical Notes:**
- `lineAmounts()` (server) and `calcGST()` (`lib/gst.ts`) use the same steps. A check over 115,400 price/qty/rate/state combinations gave identical total, CGST, SGST and IGST on both sides.
- Unit test `TestLineAmounts_HalvesAddUpToTax`: CGST + SGST equals the tax for every price tried, and CGST equals SGST or is 1 paisa more.
- Existing bills keep their stored amounts. Only new bills and edits use the new split.

### 11. Every new bill starts in-state
**Commit:** `c6144ae`

- After a bill is saved, or when **Clear** or **Start a new bill** is used, the next bill starts in-state with cash payment. Before, an out-of-state choice stayed on for every following bill.
- New sessions already started in-state. A bill in progress that's restored after a reload keeps its own setting.

**Why it matters:** Almost all bills are in-state. One out-of-state sale made every later bill IGST until someone noticed and switched it back, putting the wrong tax type on those invoices and in the GST report.

### 12. Find a bill by batch number or product
**Commit:** `0cada5f`

- **Orders search** now also matches the batch number and product name on any line of a bill. Typing the batch number printed on the strip lists every bill it was sold on.
- **Inventory → Bills with this batch** (new action on each batch row) opens Orders filtered to exactly that batch, with a chip showing which batch it is. **✕** or **Clear filters** goes back to all bills.
- Each result shows the matching line under the bill: product, batch, quantity kept (and any returned) and price each, so bills under the same name can be told apart. Date, status and payment filters still apply.

**Why it matters:** Many customers don't want a bill in their name, so the cashier bills them under a default name. On Sipra, 1,611 bills (44%) are under one name, and searching it returned all of them. When such a customer returns an item, the cashier had no way to find the original bill. A batch appears on 4 bills in a typical case, so the batch number plus the date usually leaves one or two candidates.

**Technical Notes:**
- `ListOrders` and `CountOrdersFiltered`: the search adds an `EXISTS` on `order_items` (`batch_no` / `product_name` `ILIKE`); a new optional `batch_id` parameter filters by exact batch. `ListOrders` returns `matched_items`, the matching lines as text, or `''` when none matched.
- Verified on a local copy of Sipra's data: batch ZD603029 (Cetirizine, CTZ) → 12 bills by search and by the Inventory link, matching the database (10 of them under the walk-in name); product search "Mupicip" → 14, matching the database; clearing returns all 3,677.
- No migration. The search runs over a few thousand bill lines per shop, which is fast without an index.

---

## Summary of Changes

### New Files
- `frontend/lib/billItems.ts` — bill lines at kept quantities, shared by print and WhatsApp PDF
- `releases/October/19Oct2026/PR-v1.9.0.md` — this file

### Modified Files (highlights)

**Frontend:**
- `app/(dashboard)/orders/page.tsx` — Deleted filter, struck-through amount, clearer delete confirmation
- `app/(dashboard)/orders/[id]/page.tsx` — "Deleted" date and note on deleted bills
- `components/billing/BillingRowItem.tsx` — blue highlight; GST warning; ₹0 price outlined; Qty shows the billed quantity
- `app/(dashboard)/billing/page.tsx` — price, quantity and same-batch stock errors before saving
- `lib/gst.ts` — same rounding and CGST/SGST split as the server
- `store/cartSlice.ts` — clearing a bill resets it to in-state and cash
- `app/(dashboard)/orders/page.tsx` — search by batch/product; batch filter chip; matching lines under each bill
- `app/(dashboard)/inventory/page.tsx` — "Bills with this batch" action
- `lib/api.ts`, `types/index.ts` — `batchId` filter, `matched_items`
- `app/bill/[id]/page.tsx`, `lib/generateBill.tsx` — bill lines at kept quantities
- `components/bill/BillDocument.tsx` — taxable value excludes GST
- `package.json` — version 1.9.0

**Backend:**
- `internal/queries/dashboard.sql` — partially returned bills count at net value
- `internal/queries/reports.sql` — net of returns; taxable value excludes tax
- `internal/queries/orders.sql` — deleted bills listed; delete stamps `updated_at`; search by batch/product; `batch_id` filter; `matched_items`
- `internal/handlers/orders.go` — `lineAmounts()` for new and edited bills; `deleted` status filter; line validation, per-batch stock, expiry; IST financial year
- `internal/middleware/tenant.go` — IST session time zone per request
- `internal/handlers/{helpers,dashboard,reports,inventory}.go` — IST dates
- `internal/queries/batches.sql` — `LockBatchForUpdate` returns `expiry_date`
- `internal/handlers/reports_test.go` — date range test for IST and the exclusive end bound
- `internal/handlers/orders_test.go` — `TestLineAmounts_GSTInclusive`, `TestLineAmounts_HalvesAddUpToTax`, `TestValidateBillLine`, `TestExpiredBatchMessage`
- `internal/generated/{dashboard,reports,orders,batches}.sql.go` — regenerated (`sqlc v1.30.0`)

---

## Technical Notes

- No migrations and no data changes. Reports change because the queries changed, so past periods recompute correctly too. The IST change uses a per-request session setting, and all timestamps are already `timestamptz`.
- A verified pre-release backup was taken: `backups/full/2026-10-19_132432_pre-v1.8.1`.
- The API contract is unchanged. The order list can now return `status: "deleted"` rows, and `status=deleted` is an accepted filter.
- Verified end to end on a local copy of the database:
  - a bill partially returned then edited, and another deleted;
  - dashboard and GST report moved by exactly the kept amount (₹525);
  - taxable value + CGST + SGST = total, to the paisa.

---

## Known Considerations

- **Returns are counted on the original bill's date**, not as credit notes in the month of the return. A return in November against an October bill lowers October's figures.
- **Historical bills are not rewritten.** Bills before 26 Apr 2026 keep their GST-on-top amounts, as charged. The 2 bills edited under the old edit bug keep their ₹23.50 extra.
- **Bills saved before this release keep their old CGST/SGST split** (1 paisa high on odd-paisa tax, ₹31.30 in total on Sipra). They aren't rewritten, since those amounts are what was printed and given to customers.
- **Returned and deleted bills still reprint like normal bills.** This was reviewed and left as is.
- **Double-clicking Delete or Return** could put stock back twice. Not changed, since both go through a confirmation dialog.
- **Deleted bills can still be opened, printed and shared** from their page, with the Deleted note shown on screen.
- **Orders search also matches batch numbers and product names for every search.** A bill number or phone fragment like `1234` can also bring up bills with that text in a batch number. If this gets in the way, a follow-up can match lines only for non-numeric searches, or add a "search in items" option.
- **Raising the quantity on a line from before 26 Apr 2026** re-prices the whole line GST-inclusive. Those older lines had GST added on top, so their earlier units lose that extra tax when edited. This only affects old bills that get edited, which should be rare.
- **Pre-existing test failures** (also on `main`): `TestLookupCustomer_*`, `TestSuperAdminLogin_*` and `TestSMTPConfig_IsConfigured`.

---

## Test Plan

### Partial returns
- [ ] Bill 2 × ₹150 + 2 × ₹125 → dashboard today's sales +₹550
- [ ] Return 1 × ₹150 on that bill → today's sales drop by ₹150 (not ₹550), and the order count is unchanged
- [ ] GST report for today → the bill counts once, with only the kept units in each rate slab
- [ ] Fully return a bill → it no longer counts anywhere

### GST report
- [ ] For any date range, Taxable Value + CGST + SGST + IGST = Total (to the paisa), in the summary and in every slab
- [ ] CSV export shows the same numbers as the screen

### Editing bills
- [ ] Add a ₹125 item at 5% GST to a saved bill → the bill total rises by exactly ₹125
- [ ] Raise a line from 1 to 2 units at ₹150 → the line total is ₹300

### Deleted bills
- [ ] Delete a bill → it stays in Orders as **Deleted**, with the amount struck through; stock is back in the batch
- [ ] Today's sales and the GST report drop by that bill's amount
- [ ] **Deleted** filter shows only deleted bills
- [ ] Open the deleted bill → "Deleted: <date>" and the note are shown; Return and Edit aren't offered

### IST dates
- [ ] A bill at 00:30 IST appears under that day's date in Orders and in that day's GST report
- [ ] Dashboard "Today" resets at midnight IST
- [ ] GST report for a month includes bills up to 23:59:59 IST on its last day

### Printed bills
- [ ] Any bill's GST summary: Taxable + CGST + SGST = Total
- [ ] Partially return one line of a bill, then reprint and send on WhatsApp → the returned line is gone, quantities and Total match the order, and "You saved" is based on kept items only

### Bill line checks
- [ ] Type a price of 0 → the box turns red and Place Order says "enter a selling price above ₹0"
- [ ] Same batch on two rows, total above stock → "… across 2 lines, only N available"; no bill is saved
- [ ] A price above MRP still bills
- [ ] API: negative qty, price 0, GST 3%, or an expired batch → 400 with the product named

### GST warning
- [ ] Pick a batch with no GST rate → warning shown, GST box amber; choose a rate → amber goes away
- [ ] Leave it at 0% and place the order → the bill saves (0% is never blocked)

### Find bills by batch
- [ ] Orders → search a batch number from a strip → only bills containing it; each shows the product, batch, qty and price under it
- [ ] Inventory → a batch row → "Bills with this batch" → Orders shows the chip and only that batch's bills; count matches
- [ ] ✕ on the chip (or Clear filters) → all bills again
- [ ] Search by product name → bills containing it
- [ ] Combine with a date range → narrows the list

### In-state default
- [ ] Switch to Out-of-state, place a bill → the next bill shows In-state
- [ ] Switch to Out-of-state, press Clear → In-state

### CGST / SGST split
- [ ] Bill ₹112 at 5% in-state → CGST ₹2.67, SGST ₹2.66 (tax ₹5.33); cart summary, saved order, print and WhatsApp PDF all show the same
- [ ] GST report for a period of new bills: Taxable + CGST + SGST = Total

### Search highlight
- [ ] In billing, ↓ / ↑ and mouse hover show the highlighted product in sky blue with a left bar

---

**SellOS v1.9.0** — Every rupee of sales and tax where it belongs, and every bill one batch number away.
