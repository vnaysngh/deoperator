import type { Metadata } from "next";
import "./global.css";
import { headers } from "next/headers";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "DexLuthor | AI-Powered CoW Protocol Trading",
  description:
    "Swap tokens across Ethereum, BNB, Polygon, Base, and Arbitrum using natural language with CoW Protocol."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
