// Set by lib/api after any saved change, read by lib/productCatalog. Its own
// module so those two don't import each other.
let stale = true

/** Products or stock changed: the next refreshCatalog() call fetches again. */
export function markCatalogStale() {
  stale = true
}

/** Reads and clears the flag. */
export function takeCatalogStale(): boolean {
  const was = stale
  stale = false
  return was
}
