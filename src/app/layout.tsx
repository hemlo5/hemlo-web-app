import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "HEMLO — Simulate Reality. Before You Live It.",
  description: "HEMLO predicts how humans react to anything — trades, ideas, tweets, world events. Run the simulation before you commit.",
  keywords: ["AI simulation", "prediction", "sentiment analysis", "future simulation", "market prediction"],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "HEMLO — Simulate Reality. Before You Live It.",
    description: "Predict how humans react to anything using multi-agent AI simulation.",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  )
}
