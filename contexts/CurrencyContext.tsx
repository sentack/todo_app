"use client"

import { createContext, useContext, useState, useEffect, ReactNode, Fragment } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import { setUserTimeZone } from "@/lib/dates"

// User preferences stored on the users row: currency and timezone.

interface CurrencyContextType {
  currency: string
  setCurrencyPref: (c: string) => Promise<void>
  /** Saved IANA timezone, or null to follow the device */
  timezone: string | null
  setTimezonePref: (tz: string | null) => Promise<void>
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "ETB",
  setCurrencyPref: async () => {},
  timezone: null,
  setTimezonePref: async () => {},
})

// Cached per device so the first render already uses the right timezone
const TZ_CACHE_KEY = "timezone-pref"

function readCachedTimezone() {
  try { return localStorage.getItem(TZ_CACHE_KEY) || null } catch { return null }
}

function applyTimezone(tz: string | null) {
  setUserTimeZone(tz)
  try {
    if (tz) localStorage.setItem(TZ_CACHE_KEY, tz)
    else localStorage.removeItem(TZ_CACHE_KEY)
  } catch {}
}

export function CurrencyProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [currency, setCurrency] = useState("ETB")
  const [timezone, setTimezone] = useState<string | null>(() => {
    const tz = readCachedTimezone()
    setUserTimeZone(tz)
    return tz
  })
  const supabase = createBrowserSupabaseClient()

  useEffect(() => {
    if (!userId) return
    ;(async () => {
      const { data, error } = await supabase.from("users").select("currency, timezone").eq("id", userId).single()
      if (error) {
        // timezone column not migrated yet — still load the currency
        const { data: cur } = await supabase.from("users").select("currency").eq("id", userId).single()
        if (cur?.currency) setCurrency(cur.currency)
        return
      }
      if (data?.currency) setCurrency(data.currency)
      const tz = data?.timezone ?? null
      applyTimezone(tz)
      setTimezone(tz)
    })()
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const setCurrencyPref = async (c: string) => {
    setCurrency(c)
    await supabase.from("users").update({ currency: c }).eq("id", userId)
  }

  const setTimezonePref = async (tz: string | null) => {
    applyTimezone(tz)
    setTimezone(tz)
    await supabase.from("users").update({ timezone: tz }).eq("id", userId)
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrencyPref, timezone, setTimezonePref }}>
      {/* Remount pages when the timezone changes so every "today" is recomputed */}
      <Fragment key={timezone ?? "device"}>{children}</Fragment>
    </CurrencyContext.Provider>
  )
}

export const useCurrency = () => useContext(CurrencyContext)
