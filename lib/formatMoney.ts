/**
 * Format a monetary amount for display.
 * < 10,000  → comma-separated with 2 decimals  e.g. "1,234.56"
 * ≥ 10,000  → compact with 2 decimals           e.g. "10.00K", "1.50M", "2.30B"
 */
export function formatMoney(amount: number): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? "-" : ""

  if (abs >= 1_000_000_000) {
    return sign + (abs / 1_000_000_000).toFixed(2) + "B"
  }
  if (abs >= 1_000_000) {
    return sign + (abs / 1_000_000).toFixed(2) + "M"
  }
  if (abs >= 10_000) {
    return sign + (abs / 1_000).toFixed(2) + "K"
  }
  // Under 10K: show with commas
  const parts = abs.toFixed(2).split(".")
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return sign + parts.join(".")
}
