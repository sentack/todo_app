/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @next/next/no-html-link-for-pages */

import Link from "next/link";

export default function AuthCodeError() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">Authentication Error</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Sorry, we couldn't sign you in. Please try again.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus-ring"
          >
            Go back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
