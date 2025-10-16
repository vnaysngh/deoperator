import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./global.css";
import "@rainbow-me/rainbowkit/styles.css";
import { Providers } from "@/components/Providers";

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap"
});

export const metadata: Metadata = {
  title: "DexLuthor | AI-Powered Multi-Chain Trading",
  description:
    "Trade tokens on Arbitrum and BNB Chain using natural language with AI assistance powered by CoW Protocol"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${jetbrains.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
