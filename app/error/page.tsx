"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"

const ERROR_MESSAGES: Record<string, string> = {
  OAuthCallback: "Google sign-in failed. Please try again.",
  OAuthSignin: "Could not start Google sign-in. Please try again.",
  Callback: "Authentication callback failed.",
  RefreshAccessTokenError: "Your session expired. Please sign in again.",
  Configuration: "There is a problem with the server configuration.",
  AccessDenied: "Access was denied.",
}

function AuthErrorContent() {
  const params = useSearchParams()
  const error = params.get("error")
  const message = (error && ERROR_MESSAGES[error]) ?? "An authentication error occurred."

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-10 text-center max-w-sm w-full">
      <div className="text-4xl mb-4">⚠️</div>
      <h1 className="text-xl font-semibold text-zinc-900 mb-1">Sign-in error</h1>
      <p className="text-sm text-zinc-500 mb-2">{message}</p>
      {error && (
        <p className="text-xs text-zinc-400 mb-6 font-mono">{error}</p>
      )}
      <button
        onClick={() => signIn("google", { redirectTo: "/" })}
        className="w-full bg-zinc-900 hover:bg-zinc-700 text-white font-medium py-2.5 rounded-xl transition-colors"
      >
        Try again
      </button>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-8">
      <Suspense fallback={
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-10 text-center max-w-sm w-full">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-zinc-900 mb-1">Sign-in error</h1>
          <p className="text-sm text-zinc-500 mb-6">An authentication error occurred.</p>
          <button
            onClick={() => signIn("google", { redirectTo: "/" })}
            className="w-full bg-zinc-900 hover:bg-zinc-700 text-white font-medium py-2.5 rounded-xl transition-colors"
          >
            Try again
          </button>
        </div>
      }>
        <AuthErrorContent />
      </Suspense>
    </div>
  )
}
