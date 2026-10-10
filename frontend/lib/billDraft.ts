import type { BillingRow } from '@/components/billing/BillingTable'
import type { CartState } from '@/types'

/**
 * The bill being built at the counter, kept in localStorage so a reload, an
 * expired session or a quick look at another page doesn't lose it. One draft per
 * shop (schema), cleared once the bill is saved.
 *
 * clientRef identifies one attempt to save this exact bill. It is created on the
 * first Place Order and kept across retries, so a retry after a dropped connection
 * returns the bill the server already saved instead of billing twice. Any edit to
 * the bill drops it, since an edited bill is a different bill.
 */
export interface BillDraft {
  rows: BillingRow[]
  cart: CartState
  clientRef: string | null
  // The last attempt got no reply, so it may have been saved.
  unconfirmed: boolean
}

const key = () => `sellos:bill-draft:${localStorage.getItem('schema_name') ?? ''}`

export function loadBillDraft(): BillDraft | null {
  try {
    const raw = localStorage.getItem(key())
    return raw ? (JSON.parse(raw) as BillDraft) : null
  } catch {
    return null
  }
}

export function saveBillDraft(draft: BillDraft) {
  try {
    localStorage.setItem(key(), JSON.stringify(draft))
  } catch {
    // Storage full or blocked: the bill still works, it just won't survive a reload.
  }
}

export function clearBillDraft() {
  try {
    localStorage.removeItem(key())
  } catch {}
}
