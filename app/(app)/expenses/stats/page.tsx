import { redirect } from "next/navigation"

// Expense stats now live in the Money tab of Insights
export default function ExpenseStatsPage() {
  redirect("/stats?tab=money")
}
