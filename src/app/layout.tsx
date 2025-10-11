import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./global.css";
import { Providers } from "@/components/Providers";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plus-jakarta-sans",
  display: "swap"
});

export const metadata: Metadata = {
  title: "UniPilot | AI-Powered Uniswap Trading",
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
      <body className={`${plusJakartaSans.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
