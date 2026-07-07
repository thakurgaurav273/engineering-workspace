import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/platform/providers/providers";

export const metadata: Metadata = {
  title: "Grovyn One - Engineering Performance Platform",
  description:
    "Measure engineering performance, growth, mentoring and recognition - built for modern software teams.",
  openGraph: {
    title: "Grovyn One",
    description: "Engineering performance, growth, mentoring and recognition.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/grovyn_logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
