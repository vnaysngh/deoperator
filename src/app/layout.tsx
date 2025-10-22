import type { Metadata } from "next";
import "./global.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "BasedOperator | AI-Powered Trading Terminal",
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
