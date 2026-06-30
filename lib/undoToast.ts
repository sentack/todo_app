export function triggerUndo(message: string, onUndo: () => void) {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent("undo-action", { detail: { message, onUndo } })
  )
}
