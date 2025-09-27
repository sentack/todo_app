import { createServerSupabaseClient } from "@/lib/supabaseServer";
import Sidebar from "@/components/Sidebar"
import ThemeToggle from "@/components/ThemeToggle"
import "./globals.css"
import SignOutButton from "@/components/SignOutButton";
import HomeClient from "@/components/HomeClient";

export default async function Home() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <HomeClient user={user} />
  )
}
