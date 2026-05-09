import type { Metadata } from "next"
import { Geist } from "next/font/google"
import { SessionProvider } from "next-auth/react"
import "./globals.css"

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Inbox AI",
  description: "Spatial email triage dashboard",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="h-full">
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
