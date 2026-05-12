import type { Metadata } from "next"
import { GoogleAnalytics } from "@next/third-parties/google"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "Hemlo AI",
    template: "%s | Hemlo",
  },
  description: "AI simulation intelligence for Polymarket, Kalshi, prediction markets, and world events.",
  keywords: ["Polymarket AI", "Kalshi AI", "prediction market analysis", "AI simulation", "MiroFish", "market prediction"],
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    title: "Hemlo AI",
    description: "AI simulation intelligence for prediction markets.",
    type: "website",
    url: "https://hemloai.com",
    siteName: "Hemlo AI",
  },
  metadataBase: new URL("https://hemloai.com"),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body suppressHydrationWarning>
        {children}
        <GoogleAnalytics gaId="G-BGG7CNDSK7" />
      </body>
    </html>
  )
}
