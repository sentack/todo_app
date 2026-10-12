/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @next/next/no-html-link-for-pages */

import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export default function AuthCodeError() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full p-6 sm:p-10 bg-white dark:bg-gray-950 border border-black/[0.06] dark:border-white/[0.08] rounded-[2rem] shadow-2xl animate-slide-in-up">
        <div className="text-center">
          <BrandMark className="w-14 h-14 mx-auto -rotate-6" />
          <h2 className="mt-6 text-3xl font-extrabold text-black dark:text-white">Authentication Error</h2>
          <p className="mt-2 text-[15px] text-gray-500 dark:text-gray-400">
            Sorry, we couldn't sign you in. Please try again.
          </p>
          <Link
            href="/"
            className="mt-7 inline-flex items-center h-12 px-7 text-sm font-bold text-white dark:text-black bg-black dark:bg-volt rounded-full shadow-lg shadow-black/10 dark:shadow-volt/20 hover:opacity-90 focus-ring transition-all"
          >
            Go back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
