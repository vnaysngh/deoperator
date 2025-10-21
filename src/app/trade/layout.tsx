"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { WalletConnect } from "@/components/WalletConnect";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger
} from "@/components/ui/sidebar";

type TradeLayoutProps = {
  children: ReactNode;
};

export default function TradeLayout({ children }: TradeLayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="md:pl-[var(--sidebar-width)] md:pr-8 md:peer-data-[collapsible=icon]:pl-[calc(var(--sidebar-width-icon)+theme(spacing.4))] md:peer-data-[collapsible=icon]:pr-8">
        <div className="min-h-screen">
          <header className="border-b border-white/5">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center justify-between md:justify-end">
                <SidebarTrigger className="md:hidden" />
                <WalletConnect />
              </div>
            </div>
          </header>

          <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
