# SellOS — Mobile Responsiveness Audit & Plan

**Audited:** 2026-09-01 · **Build:** v1.5.0 (`app.sellos.in`, tenant `testshop`)
**Method:** Playwright + real Chrome at 320 / 390 / 768 / 844×390 (landscape) / 1024 / 1152 / 1200 / 1280 / 1440 / 1920.
Evidence in [`mobile-audit/shots/`](mobile-audit/shots/), rerunnable via [`mobile-audit/audit.mjs`](mobile-audit/audit.mjs).

---

## Verdict

**Not mobile responsive — unusable below ~900px. Desktop ≥1280px is clean today and must stay that way.**

> **Superseded by the Status section below — Phases 1–4 are shipped and this is now 0/14 at every
> width from 320px to 1920px. The audit below is preserved as the before-state.**

At a 390px viewport the sidebar consumes 280px and the app renders into a **110px column**.
At 320px (iPhone SE, budget Androids) it renders into a **40px column**. Every dashboard screen
then requires sideways scrolling, and on list screens that means *two nested levels* of it.

Nothing is permanently lost — `<main>` carries `overflow-y-auto`, whose used `overflow-x`
resolves to `auto`, so off-screen content is reachable. It is reachable the way a filing cabinet
viewed through a keyhole is reachable.

**Baseline: 11/14 screens fail at 390px. 0/14 fail at 1280px.**

| Screen | main @390px | Sideways scroll | Elements past viewport¹ | Phone |
|---|---|---|---|---|
| `/login` | n/a (no sidebar) | 0px | 0 | ✅ |
| `/super-admin/login` | n/a (no sidebar) | 0px | 0 | ✅ |
| `/bill/[id]` | n/a (no sidebar) | 0px | 0 | ✅ |
| `/billing` | 110px | **791px** | 75 | ❌ |
| `/inventory` | 110px | **304px** | 16 | ❌ |
| `/orders/[id]` | 110px | **285px** | 14 | ❌ |
| `/orders` | 110px | **283px** | 12 | ❌ |
| `/distributors` | 110px | 230px | 7 | ❌ |
| `/reports` | 110px | 130px | 8 | ❌ |
| `/dashboard` | 110px | 84px | 0 | ❌ |
| `/inventory/add` | 110px | 70px | 38 | ❌ |
| `/settings` | 110px | 42px | 1 | ❌ |
| `/inventory/adjustments` | 110px | 19px | 1 | ❌ |
| `/customers` | 110px | 5px | 0 | ❌ |

¹ Excludes content inside the deliberate `overflow-x-auto` table wrappers — an accepted desktop
escape hatch, not breakage.

The viewport meta tag is correct (`width=device-width, initial-scale=1`), so the browser really
is laying out at 390 CSS pixels. Nothing masks this.

**Landscape is already fine.** At 844×390 `/inventory` gives main=564px, 0 sideways scroll,
0 spill. No landscape-specific work needed.

---

## Does this break desktop? — measured, not assumed

### The baseline the retrofit must preserve

| Viewport | main width | Page h-scroll | Spill | Tables scrolling internally |
|---|---|---|---|---|
| 1920px | 1640px | no | 0 | 0 |
| 1440px | 1160px | no | 0 | 0 |
| 1280px | 1000px | no | 0 | orders (973px table, marginal) |
| 1200px | 920px | no | 0 | orders |
| 1152px | 872px | **billing: 29px** | **billing: 14** | orders |
| 1024px | 744px | **billing: 157px** | **billing: 20** | inventory, orders |

**Desktop at ≥1200px is clean and stays clean.** Every proposed change is gated behind a
Tailwind min-width prefix, and Tailwind is mobile-first: `p-4 lg:p-8` leaves desktop on `p-8`,
`h-10 md:h-8` leaves desktop on `h-8`. Above the breakpoint the computed styles are byte-identical
to today's.

**New finding: `/billing` is already broken on small laptops.** At 1024–1152px it needs 157px /
29px of sideways scrolling with 14–20 elements overflowing — today, on desktop, with no phone
involved. This is not a mobile-only defect, and Phase 2 fixes it for desktop too.

### Per-change risk to desktop

| Change | Desktop risk | Why |
|---|---|---|
| Sidebar drawer below the breakpoint | **None above it** | Desktop branch renders today's markup unchanged. |
| `p-8` → `p-4 lg:p-8` | None | Desktop keeps `p-8`. |
| `w-72` → `w-full sm:w-72` | None | `sm` = 640px; desktop keeps `w-72`. |
| `flex-wrap` on toolbars | **Low** | Wrapping only engages when items don't fit — they fit on desktop today (spill=0 at ≥1200). Verified by the desktop guard. |
| `h-8` → `h-10 md:h-8` | None | Desktop keeps `h-8`. |
| Dual-render card lists (`hidden md:block` / `md:hidden`) | **Low** | Doubles DOM nodes below `md` only. Verified safe: the codebase has **zero** `id=` / `htmlFor=` attributes, so there are no duplicate-id or label-association collisions. |
| Mobile top bar | **Medium if print is forgotten** | See below. |

### The one real regression risk: printing

`Sidebar.tsx` carries `print:hidden` on its root. A new mobile top bar **must carry
`print:hidden` too**, or bills printed from a tablet get a nav bar across the top. `/bill/[id]`
and `/orders/[id]` are both print surfaces (`print:hidden`, `print:p-0`, `print:max-w-none` in
`frontend/app/(dashboard)/layout.tsx`). This is the single change most likely
to break something users care about, and it is one class.

### Breakpoint choice — a decision, not a detail

No custom breakpoints are configured, so Tailwind 4 defaults apply: `sm` 640, `md` 768, `lg` 1024,
`xl` 1280.

- **Gate the drawer at `lg` (1024) — recommended.** 1024–1279 keeps today's desktop sidebar, so
  small-laptop users see no change at all. Billing's 1024–1152 overflow gets fixed by Phase 2
  instead.
- **Gate at `xl` (1280) — the alternative.** Gives 1024–1279 the full width (744px → ~1216px) and
  fixes billing there outright, but small-laptop users lose the always-visible sidebar. That is a
  visible behaviour change for existing desktop users, so it's your call, not mine.

---

## The root causes

### 1. The sidebar is unconditionally 280px wide
[`components/shared/Sidebar.tsx`](../../frontend/components/shared/Sidebar.tsx) renders a 56px icon
rail plus a 224px text panel, both `shrink-0`, no breakpoint anywhere. 390px phone → 110px of app.
320px phone → **40px**. The collapse toggle only reaches 334px and is plain `useState`, so it
resets to expanded on every reload.

**This single cause produces most of the table above.**

### 2. There are no breakpoints in the application code at all
Every file under `app/(dashboard)/` and `components/{billing,inventory,customers,distributors,shared}/`
contains **zero** `sm:`/`md:`/`lg:` prefixes. The only responsive classes live inside untouched
shadcn primitives. `globals.css` has no media queries other than `@media print`. Mobile layout was
never attempted — there is nothing to fix, only to add.

### 3. Toolbars and filter rows overflow the content column
Header action rows, `w-72` search inputs, filter chips and sort controls sit outside the table
scrollers and push past the column — 75 such elements on `/billing`, 38 on `/inventory/add`.

### 4. Tables are built for a ~1000px column
Natural widths: **inventory 1004px, orders 973px, billing 864px, distributors 589px, customers 498px**.
Billing's grid is `table-fixed` with a `colgroup`, so it cannot reflow at all.

### 5. Touch targets are desktop-sized, with no shared control layer
`h-8` (32px) is the house height, against a 44px touch minimum; 19–45 elements per screen measure
under 40px tall. Only **one** file imports `components/ui/button.tsx` — nine dashboard pages
hand-roll `<button>` with inline classes, hardcoded across ~23 files.

### 6. Icon-only actions are labelled by hover only
`/customers`, `/distributors` and `/inventory` wrap icon-only Edit/Delete buttons in `<Tooltip>`,
which is hover-driven and therefore **silent on touch** — including *"Delete distributor"*. The
out-of-stock flag in `BillingRowItem.tsx:189` uses a bare `title=` attribute, equally invisible on
a phone. Unlabelled destructive buttons are the worst of the mobile gaps, and the cheapest to fix.

---

## What we should *not* build

**Do not build parallel mobile versions of each screen.** Two copies of billing, inventory and
orders means two places for every GST fix and guaranteed drift within a release or two. The screens
are already Tailwind; making them responsive is a smaller diff than duplicating them, and it is the
diff that keeps working.

**Do not build a separate mobile app or PWA shell.** Nothing in the gap list needs it.

---

## Plan

### Phase 0 — Decide what a phone is actually for (½ day, before any code)

Two answers are needed; both change later phases.

1. **What does a shopkeeper do on a phone?** This plan assumes: check stock at a shelf
   (`/inventory`), look up a bill or today's takings (`/orders`, `/dashboard`) — and *not* create a
   full bill. If billing-on-phone is real, Phase 5 stops being optional and Phase 3 roughly doubles.
2. **Drawer at `lg` or `xl`?** See the breakpoint section above.

---

### Phase 1 — The shell (1 day, unblocks every screen)

80% of the value. Two files.

**1a. Sidebar → off-canvas drawer below the chosen breakpoint** — `components/shared/Sidebar.tsx`
- At/above the breakpoint: exactly what exists today, untouched.
- Below it: hide rail and panel; render a slim top bar (hamburger + shop name + sign-out) that
  opens the same `NAV` array as a `fixed inset-y-0 left-0 w-64` drawer with a backdrop. No new
  component tree, no new dependency.
- **The top bar must carry `print:hidden`.** Non-negotiable — see the printing risk above.
- **Effect: 110px → ~358px at 390px, and 40px → ~288px at 320px.** On its own this clears
  `/dashboard`, `/customers`, `/settings` and `/inventory/adjustments` outright.

**1b. Layout padding** — `app/(dashboard)/layout.tsx`: `p-8` → `p-4 lg:p-8`, and move the version
badge so it stops sitting on content on short screens.

**1c. (optional one-liner)** Persist the desktop collapse state to `localStorage` so it survives a
reload.

**Exit check:** `node audit.mjs 390` → four screens flip to `ok`. `node audit.mjs 1280` → still 0 failures.

---

### Phase 2 — Toolbars and filter rows (1 day — and a desktop bug fix)

Per page: `flex-wrap` on header action rows, `gap-2 lg:gap-4`, `w-72` → `w-full sm:w-72`, wrapping
filter chip rows.

Files: `billing`, `inventory`, `orders`, `orders/[id]`, `distributors`, `inventory/add`,
`inventory/adjustments`, `reports`, `settings`. Under ~15 lines each.

**This also fixes `/billing` at 1024–1152px on desktop**, which is broken today.

**Exit check:** `spill=0` on every screen at 390px; only table-driven `hScroll` remains.

---

### Phase 3 — Tables (2–3 days, decided per screen)

Horizontal scroll already works and costs nothing. Spend card-layout effort only where a phone
user actually goes.

| Screen | Decision | Why |
|---|---|---|
| `/orders` | **Card list below `md`** | Primary phone use case: look up a bill. 973px table. |
| `/inventory` | **Card list below `md`** | Primary phone use case: check stock at the shelf. 1004px, widest. |
| `/orders/[id]` | **Stack summary blocks**, keep line-item table scrollable | 285px of scroll, 14 spill — all header/summary, not the table. |
| `/dashboard` | Stack stat cards `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` | Clean at 768px; just needs to stack. |
| `/distributors` | Keep horizontal scroll | 589px, secondary screen. |
| `/customers` | Keep horizontal scroll | 498px, only 5px of scroll after Phase 1. |
| `/inventory/adjustments` | Keep horizontal scroll | Near-clean after Phase 1. |
| `/reports` | Keep horizontal scroll | Date inputs are a Phase 2 fix. |
| `/settings` | Nothing beyond Phases 1–2 | 1 overflowing element. |
| `/billing` | **Defer — Phase 5** | `table-fixed` + `colgroup` + a 357-line row component of per-cell inputs. 791px of scroll, worst by far. |

Card pattern: render the same array twice behind `hidden md:block` / `md:hidden` in the same
component. No new fetching, no route changes, no duplicate page files — and verified free of
id-collision risk.

---

### Phase 4 — Touch targets, labels and forms (1 day)

- `h-8` → `h-10 md:h-8` across the ~23 files that hardcode it
  (`grep -rlE '\bh-(7|8)\b' app components`).
- **Give icon-only Edit/Delete buttons a visible label or an accessible name on touch**, and
  replace the `title=` out-of-stock flag with something tappable. Highest-value item in this phase —
  today a phone user taps an unlabelled bin icon to delete a distributor.
- `inventory/add` and modal contents: single-column below `md`.
- **Modals need no shell work** — verified: the shadcn primitives already carry
  `max-w-[calc(100%-2rem)] sm:max-w-sm`, and `EditProductModal` renders correctly at 390px
  (354×423, fits width and height). See [`shots/390-ov-inv-modal.png`](mobile-audit/shots/).

---

### Phase 5 — Billing on mobile (2–3 days, only if Phase 0 says yes)

The billing grid is genuine data entry: product search, batch select, qty, discount, per-line GST.
Shrinking that into 358px is a redesign, not a layout change.

Cheap shape if needed: cart becomes a read-only card list, and *adding a line* moves into a
full-screen sheet with one field per row — reusing `useProductSearch` and the cart Redux slice
untouched.

Otherwise ship Phases 1–4 and leave `/billing` desktop-only behind a "best viewed on a larger
screen" note.

---

## Effort summary

| Phase | Scope | Effort |
|---|---|---|
| 0 | Decide phone use case + breakpoint | ½ day |
| 1 | Sidebar drawer + layout padding + print guard | 1 day |
| 2 | Toolbars / filter rows (also fixes desktop billing) | 1 day |
| 3 | Tables (orders + inventory cards, order-detail stacking) | 2–3 days |
| 4 | Touch targets + icon labels + forms | 1 day |
| 5 | Billing mobile (conditional) | 2–3 days |

**Phases 1–4: ~5 days.** Phase 1 alone is worth shipping — it multiplies the content column by
3.2× at 390px and 7× at 320px.

---

## Verification

[`mobile-audit/audit.mjs`](mobile-audit/audit.mjs) covers **14 routes** — the ten dashboard screens
plus `/login`, `/super-admin/login`, `/orders/[id]` and `/bill/[id]` (detail routes discovered at
runtime from a live order). It fails (exit 1) if a screen needs horizontal scrolling or has content
outside the intentional table scrollers.

```bash
cd docs/feature/mobile-audit
npm i playwright
node audit.mjs 390     # mobile target      — baseline today: 11/14 FAIL
node audit.mjs 320     # small phones
node audit.mjs 768     # tablet
node audit.mjs 1280    # DESKTOP GUARD      — baseline today:  0/14 fail, must stay 0
node audit.mjs 1440
node audit.mjs 390 http://localhost:3000    # against local dev
```

**Run 390 and 1280 after every phase.** The first tracks progress; the second is what proves
desktop didn't regress. Screenshots land in `shots/` on every run.

---

## Status — Phases 1–4 shipped (2026-09-01)

Implemented and verified. **0/14 screens fail at every width from 320px to 1920px.**

| Width | Before | After |
|---|---|---|
| 320px | 5/14 fail (main = **40px**) | **0/14** (main = 320px) |
| 390px | 11/14 fail (main = **110px**) | **0/14** (main = 390px) |
| 768px | 0/14 (tables scrolling) | **0/14** |
| 1024px | **billing failed** (157px h-scroll) | **0/14** — desktop bug fixed |
| 1280 / 1440 / 1920px | 0/14 | **0/14 — unchanged** |

Mobile touch targets under 40px, per screen: dashboard 19→**0**, reports 22→**0**,
settings 19→**0**, inventory 36→**3**, billing 28→**5**, inventory-add 41→**11**, orders 45→**20**.
Desktop counts are **byte-identical to the pre-change baseline** (19/28/36/41/20/25/45/21/22/19/25/1),
which is the proof that every change is gated above the breakpoint.

Before/after screenshots: [`shots/`](mobile-audit/shots/) and [`shots-after/`](mobile-audit/shots-after/).

### What shipped

**Phase 1 — shell** (`components/shared/Sidebar.tsx`, `app/(dashboard)/layout.tsx`)
- Sidebar splits at `lg`: desktop markup untouched; below it a 48px top bar (hamburger + active
  page + sign-out) opens a 264px off-canvas drawer with backdrop, Escape-to-close, scroll lock,
  and auto-close on navigate or on growing past `lg`.
- Nav list extracted to a shared `NavList` — one source of truth for drawer and desktop panel,
  with row height and icon size stepping down at `lg` so the desktop panel keeps its exact dimensions.
- Layout is `flex-col lg:flex-row`; `main` gained `min-h-0` so it still scrolls as a column child.
- `p-8` → `p-4 lg:p-8`. Version badge is `hidden lg:block` (it floated over content on a phone).
- **The top bar carries `print:hidden`** — verified under `emulateMedia({media:'print'})`.
- Desktop collapse state now persists via `localStorage`.

**Phase 2 — toolbars** (billing, inventory, orders, order detail, distributors)
- Page headers stack below `sm`/`md`; action rows and filter rows got `flex-wrap`.
- `w-72` search inputs → `w-full sm:w-72` (with `relative w-full sm:w-auto` on their wrappers).
- **`BillingTable` had no scroll wrapper at all** — its 864px `table-fixed` grid overflowed the
  page. Now `overflow-x-auto` + `min-w-215`, which is below the desktop column width so desktop
  is unaffected. This is what fixed `/billing` at 1024px.

**Phase 3 — tables → cards** (orders, inventory)
- Both pages render the same array twice: `hidden md:block` table, `md:hidden` card list.
- Order card: bill no, customer, total, date/phone/payment, status, View + Delete.
- Inventory card: product, company, selling price, MRP, stock, expiry, batch/box/HSN, actions.
- Shared `OrderActions` / `BatchActions` components — the delete-confirm dialog and the three
  batch actions exist once, not once per view.

**Phase 4 — touch targets and labels**
- 60 padded controls across 20 files: `h-8 px-` → `h-10 md:h-8 px-`, `h-9 px-` → `h-10 md:h-9 px-`.
  Square icon buttons were deliberately excluded so they keep their shape.
- **Icon-only Edit/Delete now carry `aria-label` everywhere and a visible text label on mobile**
  (`md:hidden`), with the desktop Tooltip unchanged. The unlabelled-bin-icon problem is gone.
- Form grids: `inventory/add` → `grid-cols-1 md:grid-cols-2`; `EditBatchModal` price row →
  `grid-cols-2 sm:grid-cols-3`; reports skeleton matched to its content grid.

### Verified by interaction, not just measurement

PASS — drawer opens / navigates / auto-closes / close button; inventory table hidden on mobile;
labelled actions present; modal opens from a mobile card and fits (354px); order cards render
actions; **top bar hidden when printing**; desktop has no top bar; no `md:hidden` element visible
on desktop; desktop tables render at 1086px with correct row counts.

### Notes for whoever picks this up

- The dual-render pattern duplicates buttons in the DOM. Hidden copies use `display:none`, so they
  are out of the accessibility tree — but **automated tests must select `:visible`**, or they will
  grab the hidden desktop copy.
- Still open: **Phase 5 (billing on mobile)**, which is gated on the Phase 0 question. `/billing`
  no longer overflows at any width, but its grid is still a sideways-scrolling data-entry table
  on a phone.
- Still unverified (unchanged from the audit): `cmdk` product search, the date-picker calendar and
  `select` dropdowns as *overlays*; `/super-admin/dashboard`; Safari/iOS.


---

## Coverage gaps — what this audit did *not* establish

Stated plainly so nobody mistakes silence for a pass:

- **`cmdk` product search, `react-day-picker` calendar, and `select` dropdowns are unverified at
  mobile.** The probe's triggers didn't fire, so these are unknown, not known-good. Portal-rendered
  overlays that open near a screen edge are a classic mobile failure, and billing's product search
  is on the critical path. **Check these first in Phase 2.**
- **`/super-admin/dashboard` was not audited** — it needs OTP login. Internal-only, low priority.
- The `testshop` tenant has 2 inventory batches and 10 orders. Real data (long product names, many
  batches) will be worse, not better.
- `main`'s horizontal scrollability is incidental — it falls out of `overflow-y-auto` resolving
  `overflow-x` to `auto`, not a deliberate decision. Don't treat it as a mobile strategy.
- Tested in Chrome only. Safari/iOS was not exercised; `100vh` and safe-area insets on notched
  devices are unverified.
- Landing (`landing/`) is a separate Next.js app, outside this audit.
