import type { Metadata } from "next"
import { Abril_Fatface, DM_Sans, Outfit } from "next/font/google"
import { SessionProvider } from "next-auth/react"
import { Analytics } from "@vercel/analytics/next"
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

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
})

export const metadata: Metadata = {
  title: "Email Party",
  description: "Your AI-powered inbox",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${abrilFatface.variable} ${dmSans.variable} ${outfit.variable} h-full antialiased`}>
      <body className="h-full" style={{ fontFamily: "var(--font-body, 'DM Sans', sans-serif)" }}>
        <SessionProvider>
          {children}
        </SessionProvider>
        <Analytics />
      </body>
    </html>
  )
}
