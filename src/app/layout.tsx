import type { Metadata } from "next";
import "./global.css";
import { headers } from "next/headers";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "DeOperator | AI-Powered Trading Terminal",
  description:
    "Swap tokens across Ethereum, Base, and Arbitrum using natural language."
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
