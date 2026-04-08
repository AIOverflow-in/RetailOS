# RetailOS Backend — Test Suite

## Overview

86 unit tests covering input validation, business logic, authentication, and authorization across 8 test files. All tests run **without a database connection** — they exercise handler validation paths, pure functions, and middleware using `httptest`.

```
go test ./internal/... -v
```

---

## Test Files

### 1. `internal/handlers/helpers_test.go`
**Feature:** Core utility functions used by every handler

| Test | What it verifies |
|------|-----------------|
| `TestRound2` (10 cases) | `round2()` correctly rounds float64 to 2 decimal places — covers zero, positive, negative, the classic `0.1+0.2` float issue, large numbers, and half-cent rounding |
| `TestNumericFromFloat` (5 cases) | `numericFromFloat()` converts float64 → `pgtype.Numeric` with round-trip accuracy within 0.001 epsilon |
| `TestWriteJSON` (4 cases) | JSON response writer sets correct status code, `Content-Type: application/json`, serializes nil slices as `[]` (not `null`), and handles nil values |
| `TestWriteError` | Error response format `{"error":"..."}` with correct HTTP status |

**Why it matters:** `round2` and `numericFromFloat` are used in every GST calculation and order total. A bug here silently corrupts financial data for every customer.

---

### 2. `internal/handlers/orders_test.go`
**Feature:** Order creation, GST calculation, financial year, pagination

| Test | What it verifies |
|------|-----------------|
| `TestFinancialYearStart` (6 cases) | Indian financial year boundary detection (April 1) — correctly handles dates before/after April, exact boundary, December, January crossover |
| `TestGSTCalculation_InState` | In-state GST: taxable value, total tax, CGST/SGST split (50/50) at 18% |
| `TestGSTCalculation_InterState` | Inter-state GST: full IGST (no split) at 12% |
| `TestGSTCalculation_OddRounding` | Rounding edge case: half-cent GST split on ₹33.33 at 5% — verifies no money is created/lost |
| `TestGSTCalculation_ZeroRate` | 0% GST exempt items produce zero tax and correct line total |
| `TestGSTCalculation_MultiItemAggregation` | Multi-item order with mixed GST rates (18%, 12%, 5%) — verifies aggregated CGST, SGST, and total match expected values |
| `TestCreateOrder_EmptyItems` | Rejects orders with zero items → 400 "order must have at least one item" |
| `TestCreateOrder_InvalidJSON` | Rejects malformed JSON body → 400 |
| `TestListOrders_PaginationDefaults` (10 cases) | Pagination logic: defaults (page=1, limit=50), negative values, zero, max limit (200), over-max capped |
| `TestSoftDeleteOrder_InvalidUUID` | Rejects non-UUID order ID → 400 |
| `TestGetOrder_InvalidUUID` | Rejects non-UUID order ID → 400 |

**Why it matters:** GST miscalculation = legal non-compliance. Financial year errors = wrong order numbering. Stock locking bugs = overselling.

---

### 3. `internal/middleware/auth_test.go`
**Feature:** JWT authentication and authorization for both tenant and super admin flows

| Test | What it verifies |
|------|-----------------|
| `TestJWTAuth_ValidToken` | Valid HS256 JWT with correct secret → 200, request forwarded |
| `TestJWTAuth_MissingHeader` | No Authorization header → 401 |
| `TestJWTAuth_MalformedHeader` (4 cases) | Wrong prefix ("Token"), empty bearer, "Basic" auth, bare "Bearer" → 401 |
| `TestJWTAuth_ExpiredToken` | Token expired 1 hour ago → 401 |
| `TestJWTAuth_WrongSecret` | Token signed with different secret → 401 |
| `TestJWTAuth_InvalidSigningMethod` | Token signed with `alg: none` (JWT attack vector) → 401 |
| `TestJWTAuth_ClaimsInContext` | After auth, `ClaimsFromCtx()` returns correct TenantID, SchemaName, Username, OrderPrefix |
| `TestSuperAdminAuth_ValidToken` | Super admin JWT with `role: super_admin` → 200 |
| `TestSuperAdminAuth_WrongRole` | JWT with `role: tenant` → 403 Forbidden |
| `TestSuperAdminAuth_MissingHeader` | No header → 401 |
| `TestSuperAdminAuth_ExpiredToken` | Expired super admin token → 401 |
| `TestSuperAdminAuth_ClaimsInContext` | `SuperAdminClaimsFromCtx()` returns correct AdminID and Role |
| `TestClaimsFromCtx_NilContext` | Empty context returns nil (no panic) |
| `TestSuperAdminClaimsFromCtx_NilContext` | Empty context returns nil (no panic) |
| `TestJWTAuth_ErrorResponseFormat` | Error response is valid JSON with `"error"` field |

**Why it matters:** Auth bypass = any user can access any tenant's data. The `alg: none` test specifically guards against a well-known JWT attack where attackers forge unsigned tokens.

---

### 4. `internal/handlers/auth_test.go`
**Feature:** Tenant login endpoint input validation

| Test | What it verifies |
|------|-----------------|
| `TestLogin_InvalidJSON` | Malformed JSON → 400 "invalid request body" |
| `TestLogin_MissingUsername` | Empty username → 400 |
| `TestLogin_MissingPassword` | Empty password → 400 |
| `TestLogin_BothFieldsMissing` | Both empty → 400 |
| `TestLogin_EmptyBody` | Empty request body → 400 |
| `TestLoginRequest_JSONRoundTrip` | JSON serialization preserves `username`/`password` fields |
| `TestLoginResponse_JSONFields` | Response contains `token`, `shop_name`, `schema_name` with correct JSON keys |

**Why it matters:** Login is the most attacked endpoint. These tests ensure malformed requests are rejected early before hitting the database.

---

### 5. `internal/handlers/inventory_test.go`
**Feature:** Product and batch creation validation, price hierarchy enforcement

| Test | What it verifies |
|------|-----------------|
| `TestCreateProduct_InvalidJSON` | Malformed JSON → 400 |
| `TestCreateProduct_MissingName` | Empty product name → 400 "name and company_name are required" |
| `TestCreateProduct_MissingCompanyName` | Empty company name → 400 |
| `TestCreateBatch_InvalidJSON` | Malformed JSON → 400 |
| `TestCreateBatch_MissingRequiredFields` (3 cases) | Missing product_id, batch_no, or expiry_date → 400 |
| `TestCreateBatch_ZeroPurchaseQty` | Quantity ≤ 0 → 400 "purchase_qty must be greater than 0" |
| `TestCreateBatch_PriceHierarchy_BuyingGteSelling` | buying_price ≥ selling_price → 400 |
| `TestCreateBatch_PriceHierarchy_SellingGteMRP` | selling_price ≥ MRP → 400 |
| `TestCreateBatch_PriceHierarchy_BuyingGtSelling` | buying_price > selling_price → 400 |
| `TestCreateBatch_PastExpiryDate` | Past date → 400 "expiry_date must be a future date" |
| `TestCreateBatch_BadDateFormat` | Wrong format (DD-MM-YYYY instead of YYYY-MM-DD) → 400 |
| `TestCreateBatch_InvalidProductID` | Non-UUID product ID → 400 |
| `TestListBatches_MissingProductID` | No product_id query param → 400 |
| `TestListBatches_InvalidProductID` | Invalid UUID → 400 |
| `TestListActiveBatches_MissingProductID` | No product_id → 400 |
| `TestListActiveBatches_InvalidProductID` | Invalid UUID → 400 |

**Why it matters:** Price hierarchy (buying < selling < MRP) is a legal requirement for Indian retail. Expired batches must never enter inventory. These tests catch business logic violations before they reach the database.

---

### 6. `internal/handlers/customers_test.go`
**Feature:** Customer phone number validation

| Test | What it verifies |
|------|-----------------|
| `TestLookupCustomer_PhoneValidation` (5 cases) | Empty, too short (5), too long (11), 9-digit, 11-digit phones → 400 "phone must be exactly 10 digits" |
| `TestLookupCustomer_NoPhoneParam` | Missing query param → 400 |

**Why it matters:** Indian phone numbers are exactly 10 digits. Invalid phone lookups would either fail silently or match wrong customers.

---

### 7. `internal/handlers/reports_test.go`
**Feature:** GST report date range parsing and handler validation

| Test | What it verifies |
|------|-----------------|
| `TestParseDateRange_Valid` | Correct parsing of from/to dates; `to` is set to end-of-day (23:59:59) |
| `TestParseDateRange_MissingFrom` | No `from` param → error |
| `TestParseDateRange_MissingTo` | No `to` param → error |
| `TestParseDateRange_MissingBoth` | Neither param → error |
| `TestParseDateRange_BadFromFormat` | DD-MM-YYYY → "invalid from date format, use YYYY-MM-DD" |
| `TestParseDateRange_BadToFormat` | DD-MM-YYYY → "invalid to date format" |
| `TestGSTReport_MissingDateRange` | Handler returns 400 without dates |
| `TestGSTReportCSV_MissingDateRange` | CSV export returns 400 without dates |
| `TestGSTReport_InvalidDateFormat` | Slash-separated dates → 400 |
| `TestMustFloat` | `mustFloat(numericFromFloat(123.45))` ≈ 123.45 |
| `TestMustFloat_Zero` | `mustFloat(numericFromFloat(0))` = 0 |

**Why it matters:** GST reports are submitted to tax authorities. Wrong date ranges or missing end-of-day handling would produce incorrect tax filings.

---

### 8. `internal/handlers/admin_test.go` + `superadmin_test.go`
**Feature:** Tenant management and super admin authentication

| Test | What it verifies |
|------|-----------------|
| `TestRandomHex_Length` (4 sizes) | Output length matches requested length |
| `TestRandomHex_OnlyHexChars` (100 iterations) | Only produces `[0-9a-f]` characters |
| `TestRandomHex_NotAllSame` | Outputs vary across calls (not broken RNG) |
| `TestRandomHex_ZeroLength` | `randomHex(0)` returns empty string |
| `TestCreateTenant_InvalidJSON` | Malformed JSON → 400 |
| `TestCreateTenant_MissingFields` (4 cases) | Missing shop_name, username, password, or all → 400 |
| `TestCreateTenant_DefaultOrderPrefix` | Empty prefix defaults to "INV" |
| `TestCreateTenant_CustomOrderPrefix` | Custom prefix "RX" is preserved |
| `TestSetTenantActive_InvalidJSON` | Malformed JSON → 400 |
| `TestSetTenantActive_InvalidUUID` | Non-UUID tenant ID → 400 |
| `TestCreateTenantRequest_JSONFields` | Correct JSON field names (`shop_name`, `username`, etc.) |
| `TestSuperAdminLogin_SMTPNotConfigured` | Login when SMTP missing → 503 "SMTP is not configured" |
| `TestSuperAdminLogin_InvalidJSON` | Malformed JSON → 400 |
| `TestSuperAdminLogin_MissingCredentials` (3 cases) | Missing username, password, or both → 400 |
| `TestVerifyOTP_InvalidJSON` | Malformed JSON → 400 |
| `TestVerifyOTP_MissingFields` (3 cases) | Missing session_id, OTP, or both → 400 |
| `TestVerifyOTP_InvalidSessionID` | Non-UUID session ID → 400 |
| `TestGenerateOTP_Format` (100 iterations) | OTP is always 6 digits, all numeric |
| `TestGenerateOTP_NotAllSame` | OTPs vary (crypto/rand working) |
| `TestSMTPConfig_IsConfigured` (6 cases) | Each SMTP field being empty makes `IsConfigured()` return false |

**Why it matters:** `randomHex` generates tenant schema names — predictable names = cross-tenant data access. OTP must be cryptographically random. SMTP validation prevents admin lockout when email is misconfigured.

---

## Test Infrastructure

### `internal/testutil/mock_dbtx.go`
Provides `MockDBTX` implementing the sqlc `DBTX` interface for testing handlers that interact with the database layer. Includes `MockRow` and `NewErrorRow` helpers for simulating query results and failures.

---

## Running Tests

```bash
# Run all tests
go test ./internal/... -v

# Run specific package
go test ./internal/handlers/... -v
go test ./internal/middleware/... -v

# Run a specific test
go test ./internal/handlers/... -run TestGSTCalculation -v

# With coverage
go test ./internal/... -cover
```

## What's Covered vs. What's Not

| Area | Covered | Not Covered (needs integration tests) |
|------|---------|--------------------------------------|
| Input validation | All handler validation paths | — |
| GST calculation | In-state, inter-state, rounding, multi-item | — |
| Financial year | All boundary cases | — |
| JWT auth | Valid, expired, wrong secret, alg:none, claims | — |
| Super admin auth | Role check, OTP format, SMTP validation | OTP email delivery |
| Price hierarchy | buying < selling < MRP enforced | DB constraint enforcement |
| Pagination | Defaults, bounds, edge cases | Actual DB query results |
| Order creation | Empty items, invalid JSON | Stock locking under concurrency |
| Tenant isolation | Schema name generation | Cross-tenant query prevention |
| Customer lookup | Phone validation | DB lookup + upsert |
