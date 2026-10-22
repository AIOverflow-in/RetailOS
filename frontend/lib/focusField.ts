// Keyboard billing: inputs are found by data attributes, so rows don't need ref plumbing.
export function focusField(rowId: string | null, field: 'product' | 'batch' | 'qty' | 'price') {
  const sel = rowId
    ? `[data-row="${rowId}"][data-field="${field}"]`
    : `[data-field="${field}"]:not(:disabled)`
  const el = document.querySelector<HTMLElement>(sel)
  el?.focus()
  return !!el
}
