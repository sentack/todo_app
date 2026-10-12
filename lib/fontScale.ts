// User-adjustable text size. Stored as a percentage of the browser's base
// font size and applied to <html>, so every rem-based size scales with it.

export const FONT_SCALE_KEY = "font-scale"
export const FONT_SCALE_MIN = 50
export const FONT_SCALE_MAX = 200
export const FONT_SCALE_STEP = 5
export const FONT_SCALE_DEFAULT = 100

export function readFontScale(): number {
  try {
    const v = parseFloat(localStorage.getItem(FONT_SCALE_KEY) ?? "")
    if (v >= FONT_SCALE_MIN && v <= FONT_SCALE_MAX) return v
  } catch {}
  return FONT_SCALE_DEFAULT
}

export function applyFontScale(pct: number) {
  document.documentElement.style.fontSize = pct === FONT_SCALE_DEFAULT ? "" : `${pct}%`
}

export function saveFontScale(pct: number) {
  applyFontScale(pct)
  try {
    if (pct === FONT_SCALE_DEFAULT) localStorage.removeItem(FONT_SCALE_KEY)
    else localStorage.setItem(FONT_SCALE_KEY, String(pct))
  } catch {}
}

// Inline <head> script: applies the saved size before first paint (no flash)
export const FONT_SCALE_SCRIPT = `try{var v=parseFloat(localStorage.getItem(${JSON.stringify(FONT_SCALE_KEY)}));if(v>=${FONT_SCALE_MIN}&&v<=${FONT_SCALE_MAX})document.documentElement.style.fontSize=v+"%"}catch(e){}`
