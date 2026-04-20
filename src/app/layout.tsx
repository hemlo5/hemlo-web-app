import type { Metadata } from "next"
import { GoogleAnalytics } from "@next/third-parties/google"
import "./globals.css"

export const metadata: Metadata = {
  title: "HEMLO AI",
  description: "Advanced multi-agent AI simulation platform for trades, ideas, and world events.",
  keywords: ["AI simulation", "prediction", "sentiment analysis", "market prediction"],
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    title: "HEMLO AI",
    description: "Multi-agent AI simulation platform.",
    type: "website",
    url: "https://app.hemloai.com",
    siteName: "Hemlo AI",
  },
  metadataBase: new URL("https://app.hemloai.com"),
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

