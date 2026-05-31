"use client"

import { useSession, signIn } from "next-auth/react"

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-10 text-center max-w-sm w-full">
          <div className="text-4xl mb-4">📬</div>
          <h1 className="text-xl font-semibold text-zinc-900 mb-1">Email Party</h1>
          <p className="text-sm text-zinc-500 mb-6">
            Sign in with Google to connect your Gmail and start triaging.
          </p>
          <button
            onClick={() => signIn("google", { redirectTo: "/" })}
            className="w-full bg-zinc-900 hover:bg-zinc-700 text-white font-medium py-2.5 rounded-xl transition-colors"
          >
            Sign in with Google
          </button>
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
