// Date helpers in the user's local timezone.
// Avoid toISOString() for calendar dates — it converts to UTC, so items added
// shortly after local midnight land on the previous day (or month).

export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

export const todayStr = () => ymd(new Date())
