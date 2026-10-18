# SellOS v1.8.0 — Release Notes

### Instant search at the counter: the whole product list one click away, no waiting, no mouse needed

**Release Date:** October 2026
**Branch:** `feat/instant-search` → `main`

---

## Overview

Billing is the most-used screen in SellOS, and its product search made the counter wait. In shops with more than 200 products, nothing appeared until 3 letters were typed and the server answered. The dropdown was cut off by the bill table and scrolled the table instead of itself, and products could only be picked with the mouse. This release loads the shop's full product list as soon as the app opens and keeps it in the browser, so search is instant from the first click. The dropdown now opens on click, scrolls on its own and works fully from the keyboard. The changes are one new frontend module, the billing row, the shared search hook and a one-line backend sort fix.

---

## What's New

### 1. The full product list, loaded before it's needed
**Commit:** `3b93c21`

- The shop's whole product list is fetched in the background as soon as the app opens (any dashboard page), not when billing is first used.
- It's kept in the browser (`localStorage`), so on later visits the list is there instantly, even before the network answers.
- It's refreshed quietly in the background:
  - each time the app opens;
  - after any saved change (new product, stock added, bill, return, adjustment);
  - at most every 5 minutes otherwise.
- All search boxes share it: billing rows, Add Stock and order edit. Before, each billing row fetched its own copy.

**Why it matters:** Every search used to wait on the server once a shop had more than 200 products (Sipra has 745), and nothing showed until 3 letters were typed. Now typing filters the full list locally, with no load time at all. Measured: the dropdown opens about 30–40 ms after the click, including when the API is slowed to 5 seconds.

**Technical Notes:**
- `lib/productCatalog.ts`: the list is held in memory and in `localStorage` under `sellos:catalog:<schema_name>`. It's fetched page by page (200 per page, 4 pages at a time) and de-duplicated by `product_id`. Names are sorted A–Z, ignoring case and leading spaces.
- Why not refresh only once a day: out-of-stock products can't be picked in billing. With a once-a-day list, a product restocked during the day would stay unpickable until the next day. So the cached list is always shown instantly, and a background refresh keeps it current.
- `request()` in `lib/api.ts` marks the list stale after any successful non-GET request, so all change paths are covered in one place. The flag lives in `lib/catalogStale.ts`, so `api.ts` and `productCatalog.ts` don't import each other.
- A failed refresh keeps the cached list. If there's no list yet and loading fails, search falls back to the server, as before.
- Switching shops on the same browser can't show another shop's list: the key includes the schema, and an in-flight refresh is discarded if the shop changed.

---

### 2. Dropdown opens on click, A–Z, and scrolls on its own
**Commit:** `3b93c21`

- Clicking the product box opens the list right away: the first 20 products A–Z, in every shop and also on rows that already have a product.
- Scrolling to the bottom of the list adds 20 more, all the way to the end of the catalog.
- Typing filters the whole list (name or company) instantly.
- The dropdown is no longer clipped by the bill table, and the table no longer scrolls up and down. Only the list scrolls.

**Why it matters:** The dropdown was cut off at the bottom of the bill table, and the mouse wheel scrolled the table instead of the list. That made it hard to see or reach anything past the first one or two results.

**Technical Notes:**
- The table wrapper uses `overflow-x-auto` for narrow screens. CSS then also clips vertical overflow, so an absolutely positioned dropdown inside it is cut off. The dropdown is now `position: fixed` under the input, and follows it on scroll and resize.
- The list's height shrinks to fit the space below the input (between 120 and 256 px), and uses `overscroll-contain` so scrolling it doesn't scroll the page.
- Only rendered items grow on scroll (20 at a time), so a large catalog doesn't render hundreds of rows at once.

---

### 3. Full keyboard control
**Commits:** `3b93c21`, `f15da6a`

- **↓ / ↑** move the highlight through the list. The highlighted product (also under the mouse) is shown in brand sky blue with a bar on the left, so it's easy to see at a glance. Out-of-stock products are skipped, and the list scrolls to keep the highlight visible.
- **Enter** picks the highlighted product. **Esc** closes the list, and an arrow key or click reopens it.
- The first in-stock match is highlighted after every keystroke, so typing a few letters and pressing Enter is enough.

**Why it matters:** At a busy counter, reaching for the mouse for every line item slows billing down. Owners can now search and pick without taking their hands off the keyboard.

**Technical Notes:**
- The highlight is tracked by `product_id`, not by position. A background refresh can add products above the highlighted one while the dropdown is open, and Enter must never pick a neighbouring product. If the highlighted product leaves the list or goes out of stock, the first pickable match is highlighted instead.

---

### 4. Stable product paging
**Commit:** `3b93c21`

- `GET /products` now sorts by name, then by product ID.

**Why it matters:** Sorting by name alone lets products with identical names swap places between pages. Loading the list page by page could then skip one product and show another twice. Sipra has 15 such names.

---

## Summary of Changes

### New Files
- `frontend/lib/productCatalog.ts` — shared product list: background loading, `localStorage` cache, staleness and filtering
- `frontend/lib/catalogStale.ts` — the "product list changed" flag shared by `api.ts` and `productCatalog.ts`
- `releases/October/18Oct2026/PR-v1.8.0.md` — this file

### Modified Files (highlights)

**Frontend:**
- `components/billing/BillingRowItem.tsx` — fixed-position dropdown, open on click, scroll paging, arrow keys, Enter and Esc
- `lib/useProductSearch.ts` — reads the shared list; server search only as a fallback
- `lib/api.ts` — marks the list stale after any saved change
- `components/shared/AuthGuard.tsx` — starts loading the list when the app opens
- `package.json` — version 1.8.0

**Backend:**
- `internal/queries/products.sql` (+ regenerated `internal/generated/products.sql.go`) — `ORDER BY p.name, p.product_id`

**Landing:**
- `landing/app/page.tsx` — billing feature card mentions instant search and keyboard picking; stats show v1.8

---

## Technical Notes

- No migrations and no API changes. The frontend and backend can be deployed in either order.
- Size: Sipra's 745 products are about 120 KB in `localStorage`, fetched as 4 requests in parallel.
- Add Stock and order edit get the shared list automatically. Add Stock's "+ Add as new product" check now searches the full list locally, where it used to depend on the server for catalogs over 200 products.
- Generated code was regenerated with the pinned `sqlc v1.30.0`. The only change in it is the `ORDER BY` line.

---

## Known Considerations

- **Batches still load after a product is picked** (one request per pick). They could be prefetched while a product is highlighted. That's a follow-up.
- **Long product names wrap** in the dropdown, so only 2–3 long names fit in view at once. A wider dropdown or truncated names would show more.
- **The whole list is refetched after every saved change, including every bill.** For Sipra that's 4 requests and about 120 KB, which is fine. At around 5,000 products it would be about 25 requests and 800 KB per bill, plus a large `localStorage` write, and it would approach the browser's 5 MB `localStorage` limit (past that, the write fails silently and search falls back to the slower path). Follow-up: update only the stock flags after a bill, or fetch only products changed since the last refresh.
- **Just after a restock, the dropdown can briefly show the product as Out of stock.** The cached list is shown first, until the background refresh returns. That's normally under a second, and up to the 20s request timeout on a bad connection.
- **Changes made on another device** (e.g. a product added on a second counter) appear after the next refresh, within 5 minutes or on the next app open. Changes made on the same browser show up right away.
- The `npm run dev` server was very slow on the development machine (60s+ per page, even after compiling), so testing used `next build` + `next start`. Worth looking into separately.

---

## Test Plan

### Preloading
- [ ] Log in → open DevTools → Application → `localStorage` has `sellos:catalog:<schema>` with every product, before Billing is opened
- [ ] Reload Billing with the network throttled to Slow 3G → clicking the product box shows the list instantly
- [ ] Add a new product in Add Stock → go to Billing → the new product is found by search
- [ ] Sell the last unit of a batch → the product shows as Out of stock in the dropdown after the bill is saved

### Dropdown
- [ ] Click an empty product box → 20 products A–Z appear immediately
- [ ] Click a row that already has a product → the full list appears; typing replaces the name and filters
- [ ] Scroll to the bottom of the list → 20 more appear, until the end of the catalog
- [ ] With the list open, the bill table itself doesn't scroll vertically, and the list isn't cut off
- [ ] Type `pan` → only matching products (name or company) show, with the first in-stock one highlighted

### Keyboard
- [ ] ↓ / ↑ move the highlight, skip Out of stock items, and keep the highlight in view
- [ ] Highlight a product, then let a background refresh add a product above it (e.g. add one on another device, then wait for the refresh) → the highlight stays on the same product, and Enter picks it
- [ ] Enter picks the highlighted product and loads its batches
- [ ] Esc closes the list; ↓ or a click reopens it

### Paging
- [ ] A shop with two products that have the exact same name → both appear in the list, once each

---

**SellOS v1.8.0** — Every product a click away, found as fast as you can type, and picked without touching the mouse.
