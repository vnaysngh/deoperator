"use client";

import { Chat } from "@/components/Chat";
import { WalletConnect } from "@/components/WalletConnect";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { useState } from "react";

export default function Home() {
  const [isExecuting] = useState(false);
  const [status] = useState("");

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="min-h-screen">
          <header className="border-b border-white/5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center justify-end">
                <WalletConnect />
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center mb-12 mt-8">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
                <span className="gradient-text">
                  Trade tokens using natural language
                </span>
              </h1>
            </div>

            {status && (
              <div className="max-w-3xl mx-auto mb-6">
                <div
                  className={`glass-strong rounded-xl p-4 border ${
                    status.includes("failed") || status.includes("error")
                      ? "border-red-500/30 bg-red-500/10"
                      : status.includes("successful")
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : "border-primary-500/30 bg-primary-500/10"
                  }`}
                >
                  <p
                    className={`text-sm ${
                      status.includes("failed") || status.includes("error")
                        ? "text-red-400"
                        : status.includes("successful")
                        ? "text-emerald-400"
                        : "text-primary-400"
                    }`}
                  >
                    {status}
                  </p>
                </div>
              </div>
            )}

            {isExecuting && (
              <div className="max-w-3xl mx-auto mb-6">
                <div className="glass-strong rounded-xl p-4 border border-primary-500/30">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm text-gray-300">
                      Processing transaction...
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="max-w-4xl mx-auto mb-12">
              <Chat />
            </div>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
