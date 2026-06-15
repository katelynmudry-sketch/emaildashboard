"use client"

import { useState, useEffect } from "react"
import { useSession, signIn } from "next-auth/react"
import type { PartyMode } from "@/lib/party-mode"
import { getPartyMode } from "@/lib/party-mode"

const ACCENT: Record<PartyMode, string> = {
  zen: "#C8960C",
  party: "#8B3FD8",
  "wabi-sabi": "#C17D3C",
}

const COPY: Record<PartyMode, {
  devTitle: string
  devBody: string
  walkthroughTitle: string
  reassurance: string
}> = {
  zen: {
    devTitle: "A work in progress",
    devBody: "This app hasn't been reviewed by Google yet, so you'll see a caution screen when signing in. That's expected, not a sign something's wrong.",
    walkthroughTitle: "What you'll see next",
    reassurance: "Email Party only ever talks to your own Google account. You can revoke access anytime from Google Account → Security → Third-party access.",
  },
  party: {
    devTitle: "🚧 Heads up — early build!",
    devBody: "This app hasn't been verified by Google yet, so you'll hit a warning screen at sign-in. Totally normal — here's exactly what to click 👇",
    walkthroughTitle: "What you'll see next",
    reassurance: "Email Party only ever talks to your own Google account — your access can be revoked anytime from Google Account → Security → Third-party access.",
  },
  "wabi-sabi": {
    devTitle: "🚧 lil disclaimer bestie",
    devBody: "this app is still in dev mode so Google's gonna show u a scary-looking warning when u sign in. it's fine, it's normal, just click through.",
    walkthroughTitle: "what u'll see next",
    reassurance: "Email Party only ever talks to ur own Google account, and u can revoke access anytime from Google Account → Security → Third-party access. it's giving safe.",
  },
}

const WALKTHROUGH_STEPS = [
  "Click “Sign in with Google” below and pick your Google account.",
  "Google shows “Google hasn't verified this app” — click Advanced.",
  "Click “Go to Email Party (unsafe)” — “unsafe” just means Google hasn't reviewed it, not that anything's wrong.",
  "Review the requested permissions (Gmail, Calendar, Docs) and click Continue / Allow.",
]

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [mode, setMode] = useState<PartyMode>("party")

  useEffect(() => {
    setMode(getPartyMode())
  }, [])

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    const accent = ACCENT[mode]
    const c = COPY[mode]

    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-10 text-center max-w-md w-full">
          <h1
            className="text-zinc-900 mb-2"
            style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", letterSpacing: "0.04em", lineHeight: 1.1 }}
          >
            EMAIL PARTY
          </h1>
          <p className="text-base font-semibold text-zinc-700 mb-2">
            Inbox zero is just one party away.
          </p>
          <p className="text-sm text-zinc-500 leading-relaxed mb-6">
            Auto-organized and visually sorted into the spaces that matter — your Gardens,
            Arenas, or Eras — so you instantly see what needs you today, what can wait, and
            what&rsquo;s ready for a reply, whether you write it yourself or let AI draft one for you.
          </p>

          <button
            onClick={() => signIn("google", { redirectTo: "/" })}
            className="w-full bg-zinc-900 hover:bg-zinc-700 text-white font-medium py-2.5 rounded-xl transition-colors mb-6"
          >
            Sign in with Google
          </button>

          <div
            className="rounded-xl border p-4 text-left mb-4"
            style={{ borderColor: `${accent}40`, background: `${accent}0D` }}
          >
            <p className="text-xs font-semibold mb-1" style={{ color: accent }}>
              {c.devTitle}
            </p>
            <p className="text-xs text-zinc-600 leading-relaxed">
              {c.devBody}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 p-4 text-left">
            <p className="text-xs font-semibold text-zinc-700 mb-2">
              {c.walkthroughTitle}
            </p>
            <ol className="text-xs text-zinc-600 leading-relaxed space-y-1.5 list-decimal list-inside mb-3">
              {WALKTHROUGH_STEPS.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <p className="text-xs text-zinc-500 leading-relaxed border-t border-zinc-100 pt-2.5">
              {c.reassurance}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (session.error === "RefreshTokenError") {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-10 text-center max-w-sm w-full">
          <p className="text-sm text-zinc-700 mb-4">Your session expired. Please sign in again.</p>
          <button
            onClick={() => signIn("google", { redirectTo: "/" })}
            className="w-full bg-zinc-900 hover:bg-zinc-700 text-white font-medium py-2.5 rounded-xl transition-colors"
          >
            Sign in again
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
