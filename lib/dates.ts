// Calendar dates in the user's timezone.
//
// Two kinds of values flow through the app:
//  - date keys ("YYYY-MM-DD"): `date` columns. They're calendar days, not
//    instants — never convert them through UTC or the device timezone.
//  - instants (timestamptz, e.g. created_at): turn them into a date key with
//    dayKey(), which resolves the day in the user's timezone.
//
// The timezone is the user's saved preference (set by CurrencyProvider), or the
// device timezone when they haven't chosen one.

let userTimeZone: string | undefined

export function setUserTimeZone(tz: string | null | undefined) {
  userTimeZone = tz || undefined
}

export const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

/** The timezone in effect: the saved preference, else the device's. */
export const activeTimeZone = () => userTimeZone ?? deviceTimeZone()

/** Calendar day of an instant in the user's timezone. */
export function dayKey(instant: Date | string | number = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: userTimeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(instant))
  const get = (t: string) => parts.find(p => p.type === t)!.value
  return `${get("year")}-${get("month")}-${get("day")}`
}

export const todayStr = () => dayKey()

/** Shift a date key by n calendar days. Pure calendar math, no timezone involved. */
export function addDays(key: string, n: number) {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

export const daysAgo = (n: number) => addDays(todayStr(), -n)

/** Format an instant (timestamptz) in the user's timezone. */
export function formatInstant(instant: Date | string, opts: Intl.DateTimeFormatOptions = {}, locale?: string) {
  return new Date(instant).toLocaleDateString(locale, { ...opts, timeZone: userTimeZone })
}
