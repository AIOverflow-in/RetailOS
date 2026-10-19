# SellOS v1.8.1 — Release Notes

### Sales you can trust: partial returns counted right, a GST report that separates the tax, and deleted bills kept on record

**Release Date:** October 2026
**Branch:** `fix/returns-and-void-orders` → `main`

---

## Overview

Partially returning a bill made the whole bill vanish from today's sales and from the GST report, instead of just the returned units. Edits that added items or quantity to a bill also charged GST on top of a price that already includes it. The GST report showed "Taxable Value" equal to the total, with the tax never taken out. Deleted bills disappeared from Orders entirely. This release fixes all four, and carries the blue search highlight that missed v1.8.0.

---

## What's New

### 1. Partially returned bills count at their kept value
**Commit:** `3761d54`

- Today's sales, the order count and the payment-mode split on the dashboard now include partially returned bills, at their amount after the return.
- The GST report (summary, rate slabs and CSV export) includes them too, counting only the units the customer kept.
- Fully returned and deleted bills still don't count.

**Why it matters:** Returning 1 strip out of a ₹550 bill used to drop all ₹550 from today's sales, not ₹150. Every partially returned bill was missing from that day's sales and GST report. Sipra had 34 such bills (₹17,507 kept by customers) missing from its reports.

**Technical Notes:**
- Dashboard queries now count `status IN ('active', 'partially_returned')`. `orders.total_amount` is already kept net of returns by the edit flow, so the dashboard needed no other change.
- The report queries scale each line by `(qty - returned_qty) / qty` and round per line, the same way the edit flow computes the bill's net total. So the report total matches the sum of the bills.

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

## Summary of Changes

### New Files
- `releases/October/19Oct2026/PR-v1.8.1.md` — this file

### Modified Files (highlights)

**Frontend:**
- `app/(dashboard)/orders/page.tsx` — Deleted filter, struck-through amount, clearer delete confirmation
- `app/(dashboard)/orders/[id]/page.tsx` — "Deleted" date and note on deleted bills
- `components/billing/BillingRowItem.tsx` — blue highlight
- `package.json` — version 1.8.1

**Backend:**
- `internal/queries/dashboard.sql` — partially returned bills count at net value
- `internal/queries/reports.sql` — net of returns; taxable value excludes tax
- `internal/queries/orders.sql` — deleted bills listed; delete stamps `updated_at`
- `internal/handlers/orders.go` — `lineAmounts()` for new and edited bills; `deleted` status filter
- `internal/handlers/orders_test.go` — `TestLineAmounts_GSTInclusive`
- `internal/generated/{dashboard,reports,orders}.sql.go` — regenerated (`sqlc v1.30.0`)

---

## Technical Notes

- No migrations and no data changes. Reports change because the queries changed, so past periods recompute correctly too.
- The API contract is unchanged. The order list can now return `status: "deleted"` rows, and `status=deleted` is an accepted filter.
- Verified end to end on a local copy of the database:
  - a bill partially returned then edited, and another deleted;
  - dashboard and GST report moved by exactly the kept amount (₹525);
  - taxable value + CGST + SGST = total, to the paisa.

---

## Known Considerations

- **Returns are counted on the original bill's date**, not as credit notes in the month of the return. A return in November against an October bill lowers October's figures.
- **Historical bills are not rewritten.** Bills before 26 Apr 2026 keep their GST-on-top amounts, as charged. The 2 bills edited under the old edit bug keep their ₹23.50 extra.
- **Deleted bills can still be opened, printed and shared** from their page, with the Deleted note shown on screen.
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

### Search highlight
- [ ] In billing, ↓ / ↑ and mouse hover show the highlighted product in sky blue with a left bar

---

**SellOS v1.8.1** — Every return counted for what was kept, every rupee of tax in its column, and every deleted bill still on the books.
