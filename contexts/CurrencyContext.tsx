"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"

interface CurrencyContextType {
  currency: string
  setCurrencyPref: (c: string) => Promise<void>
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "ETB",
  setCurrencyPref: async () => {},
})

export function CurrencyProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [currency, setCurrency] = useState("ETB")
  const supabase = createBrowserSupabaseClient()

  useEffect(() => {
    if (!userId) return
    supabase
      .from("users")
      .select("currency")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (data?.currency) setCurrency(data.currency)
      })
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const setCurrencyPref = async (c: string) => {
    setCurrency(c)
    await supabase.from("users").update({ currency: c }).eq("id", userId)
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrencyPref }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export const useCurrency = () => useContext(CurrencyContext)
