import type { Metadata } from "next"
import { Abril_Fatface, DM_Sans } from "next/font/google"
import { SessionProvider } from "next-auth/react"
import "./globals.css"

const abrilFatface = Abril_Fatface({
  weight: "400",
  variable: "--font-display",
  subsets: ["latin"],
})

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "Inbox AI",
  description: "Spatial email triage dashboard",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${abrilFatface.variable} ${dmSans.variable} h-full antialiased`}>
      <body className="h-full" style={{ fontFamily: "var(--font-body, 'DM Sans', sans-serif)" }}>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
