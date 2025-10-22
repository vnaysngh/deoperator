import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Using Turbopack by default in Next.js 15
  // No webpack configuration needed

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "scontent-iad4-1.choicecdn.com",
        port: "",
        pathname: "/**"
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        port: "",
        pathname: "/**"
      },
      {
        protocol: "https",
        hostname: "tba-social.mypinata.cloud",
        port: "",
        pathname: "/**"
      },
      {
        protocol: "https",
        hostname: "ipfs.io",
        port: "",
        pathname: "/**"
      },
      {
        protocol: "https",
        hostname: "gateway.pinata.cloud",
        port: "",
        pathname: "/**"
      }
    ],
    // Add error handling for broken images
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Reduce server-side image optimization errors
    unoptimized: false,
    // Add fallback for broken images
    loader: "default"
  }
};

export default nextConfig;
