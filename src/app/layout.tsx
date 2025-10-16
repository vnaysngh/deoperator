import type { Metadata } from "next";
import "./global.css";
import "@rainbow-me/rainbowkit/styles.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "DexLuthor | AI-Powered Uniswap Trading",
  description:
    "Trade tokens on Uniswap using natural language with AI assistance"
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
