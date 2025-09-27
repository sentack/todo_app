"use client"

import { useState } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import ConfirmModal from "./ConfirmModal"

interface ClearDataModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ClearDataModal({ isOpen, onClose }: ClearDataModalProps) {
  const [loading, setLoading] = useState(false)
  const supabase = createBrowserSupabaseClient()

  const handleClearData = async () => {
    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error("Not authenticated")
      }

      const { error } = await supabase
        .from("todos")
        .delete()
        .eq("user_id", user.id)

      if (error) throw error

      onClose()
      // Refresh the page to update the todo list
      window.location.reload()
    } catch (error) {
      console.error("Error clearing data:", error)
      alert(`Failed to clear data: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleClearData}
      title="Clear All Data"
      message="Are you sure you want to delete all your todos? This action cannot be undone and will permanently remove all your tasks, notes, and progress."
      confirmText="Clear All Data"
      cancelText="Cancel"
      isLoading={loading}
      confirmationText="DELETE ALL"
    />
  )
}