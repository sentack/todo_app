"use client";

import type React from "react";
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginForm() {
  const [loading, setLoading]     = useState(false);
  const [isSignUp, setIsSignUp]   = useState(false);
  const [identifier, setIdentifier] = useState(""); // sign-in: email or username
  const [email, setEmail]         = useState("");    // sign-up: email
  const [username, setUsername]   = useState("");    // sign-up: username
  const [password, setPassword]   = useState("");
  const [error, setError]         = useState("");
  const router  = useRouter();
  const supabase = createBrowserSupabaseClient();

  const switchMode = (toSignUp: boolean) => {
    setIsSignUp(toSignUp);
    setError("");
    setIdentifier(""); setEmail(""); setUsername(""); setPassword("");
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isSignUp) {
        const trimmedUsername = username.trim().toLowerCase();
        if (!/^[a-z0-9_]{3,30}$/.test(trimmedUsername)) {
          throw new Error("Username must be 3–30 characters: letters, numbers, and underscores only.");
        }
        // Pre-check username uniqueness
        const { data: existing } = await supabase
          .from("users")
          .select("id")
          .eq("username", trimmedUsername)
          .maybeSingle();
        if (existing) throw new Error("That username is already taken.");

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: trimmedUsername },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (signUpError) throw signUpError;
        setError("Check your email for the confirmation link!");
      } else {
        // Resolve email: if identifier has no @, treat it as a username
        let loginEmail = identifier.trim();
        if (!loginEmail.includes("@")) {
          const { data: resolvedEmail, error: lookupError } = await supabase
            .rpc("get_email_by_username", { p_username: loginEmail.toLowerCase() });
          if (lookupError || !resolvedEmail) throw new Error("Username not found. Try signing in with your email instead.");
          loginEmail = resolvedEmail as string;
        }
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (signInError) throw signInError;
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  const isSuccess = error.includes("Check your email");

  return (
    <div className="relative bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] rounded-[2rem] p-6 sm:p-8 shadow-2xl">
      <div className="mb-7">
        <h3 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-black dark:text-white mb-1.5">
          {isSignUp ? "Create Account" : "Sign In"}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {isSignUp ? "Join TodoFlow to get started" : "Welcome back to TodoFlow"}
        </p>
      </div>

      <form onSubmit={handleAuth} className="space-y-6">
        <div className="space-y-4">

          {/* Sign-in: single identifier field */}
          {!isSignUp && (
            <div>
              <label htmlFor="identifier" className="block text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-2">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  Email or Username
                </div>
              </label>
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                required
                autoComplete="username"
                placeholder="Enter your email or username"
                className="w-full px-4 py-3 border border-gray-200 dark:border-white/[0.08] rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/5 dark:focus:ring-volt/15 focus:border-black dark:focus:border-volt bg-gray-50 dark:bg-white/[0.04] focus:bg-white dark:focus:bg-white/[0.06] text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200"
              />
            </div>
          )}

          {/* Sign-up: username field */}
          {isSignUp && (
            <div>
              <label htmlFor="username" className="block text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-2">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  Username
                </div>
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                required
                minLength={3}
                maxLength={30}
                autoComplete="username"
                placeholder="your_username"
                className="w-full px-4 py-3 border border-gray-200 dark:border-white/[0.08] rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/5 dark:focus:ring-volt/15 focus:border-black dark:focus:border-volt bg-gray-50 dark:bg-white/[0.04] focus:bg-white dark:focus:bg-white/[0.06] text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200"
              />
              <p className="mt-1.5 px-1 text-xs text-gray-400 dark:text-gray-500">Letters, numbers and underscores only</p>
            </div>
          )}

          {/* Sign-up: email field */}
          {isSignUp && (
            <div>
              <label htmlFor="email" className="block text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-2">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  Email Address
                </div>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="Enter your email"
                className="w-full px-4 py-3 border border-gray-200 dark:border-white/[0.08] rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/5 dark:focus:ring-volt/15 focus:border-black dark:focus:border-volt bg-gray-50 dark:bg-white/[0.04] focus:bg-white dark:focus:bg-white/[0.06] text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200"
              />
            </div>
          )}

          {/* Password — always shown */}
          <div>
            <label htmlFor="password" className="block text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-2">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                Password
              </div>
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              placeholder={isSignUp ? "Create a password (min 6 chars)" : "Enter your password"}
              className="w-full px-4 py-3 border border-gray-200 dark:border-white/[0.08] rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/5 dark:focus:ring-volt/15 focus:border-black dark:focus:border-volt bg-gray-50 dark:bg-white/[0.04] focus:bg-white dark:focus:bg-white/[0.06] text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200"
            />
          </div>
        </div>

        {/* Error / success banner */}
        {error && (
          <div className={`text-sm font-medium p-4 rounded-2xl animate-slide-in-down ${
            isSuccess
              ? "text-volt-900 bg-volt-100 dark:text-volt-200 dark:bg-volt/10 border border-volt-300/70 dark:border-volt/20"
              : "text-rose-800 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20"
          }`}>
            <div className="flex items-center gap-2">
              {isSuccess ? (
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              )}
              {error}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center w-full h-[3.25rem] px-6 text-[15px] font-bold text-white dark:text-black bg-black dark:bg-volt rounded-2xl hover:bg-gray-800 dark:hover:bg-volt-300 shadow-lg shadow-black/10 dark:shadow-volt/10 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-volt focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black transition-all duration-200 gap-2"
        >
          {loading ? (
            <>
              {isSignUp ? "Creating Account..." : "Signing In..."}
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </>
          ) : (
            <>
              {isSignUp ? "Create Account" : "Sign In"}
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={() => switchMode(!isSignUp)}
          className="text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white px-4 py-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors duration-200"
        >
          {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>
      </div>
    </div>
  );
}
