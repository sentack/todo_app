export const CATEGORIES = [
  "Food & Drinks",
  "Coffee",
  "Transport",
  "Shopping",
  "Entertainment",
  "Health",
  "Bills",
  "Other",
] as const

export type ExpenseCategory = (typeof CATEGORIES)[number]

export const CATEGORY_COLORS: Record<string, string> = {
  "Food & Drinks": "bg-orange-400 dark:bg-orange-500",
  "Coffee":        "bg-amber-700 dark:bg-amber-600",
  "Transport":     "bg-blue-400 dark:bg-blue-500",
  "Shopping":      "bg-pink-400 dark:bg-pink-500",
  "Entertainment": "bg-purple-400 dark:bg-purple-500",
  "Health":        "bg-green-400 dark:bg-green-500",
  "Bills":         "bg-red-400 dark:bg-red-500",
  "Other":         "bg-gray-400 dark:bg-gray-500",
}

export const CATEGORY_TEXT: Record<string, string> = {
  "Food & Drinks": "text-orange-600 dark:text-orange-400",
  "Coffee":        "text-amber-700 dark:text-amber-400",
  "Transport":     "text-blue-600 dark:text-blue-400",
  "Shopping":      "text-pink-600 dark:text-pink-400",
  "Entertainment": "text-purple-600 dark:text-purple-400",
  "Health":        "text-green-600 dark:text-green-400",
  "Bills":         "text-red-600 dark:text-red-400",
  "Other":         "text-gray-600 dark:text-gray-400",
}

export const CATEGORY_BADGE: Record<string, string> = {
  "Food & Drinks": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  "Coffee":        "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  "Transport":     "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "Shopping":      "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  "Entertainment": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "Health":        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "Bills":         "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  "Other":         "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
}

export const CURRENCIES = [
  { code: "ETB", name: "Ethiopian Birr" },
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "INR", name: "Indian Rupee" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "ZAR", name: "South African Rand" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" },
]
