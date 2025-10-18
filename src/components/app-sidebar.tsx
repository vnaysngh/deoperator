"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from "@/components/ui/sidebar";
import {
  ArrowLeftRight,
  Wallet,
  BarChart3
  // TrendingUp,
  // History,
  // Shield,
  // Settings,
  // HelpCircle
} from "lucide-react";
import Link from "next/link";

const menuItems = [
  { title: "Trade", icon: ArrowLeftRight, url: "/trade" },
  { title: "Positions", icon: Wallet, url: "/positions" },
  { title: "Transactions", icon: BarChart3, url: "/transactions" }
  // { title: "Liquidity", icon: TrendingUp, url: "/liquidity" },
];

/* const secondaryItems = [
  { title: "Transaction History", icon: History, url: "/history" },
  { title: "Security", icon: Shield, url: "/security" },
  { title: "Settings", icon: Settings, url: "/settings" },
  { title: "Help & Support", icon: HelpCircle, url: "/help" },
];
 */
export function AppSidebar() {
  return (
    <Sidebar collapsible="icon" className="border-r border-white/5">
      <SidebarHeader className="border-b border-white/5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="hover:bg-white/5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center shadow-glow">
                <span className="text-white font-bold text-lg">D</span>
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-bold gradient-text">DeOperator</span>
                <span className="text-xs text-gray-500">Trading Terminal</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-gray-500 text-xs">
            Main Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    className="hover:bg-white/5 hover:text-primary-400 transition-colors"
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/*   <SidebarGroup>
          <SidebarGroupLabel className="text-gray-500 text-xs">
            More
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    className="hover:bg-white/5 hover:text-primary-400 transition-colors"
                  >
                    <a href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup> */}
      </SidebarContent>

      <SidebarFooter className="border-t border-white/5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="hover:bg-white/5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-600/20 to-primary-700/20 flex items-center justify-center border border-primary-500/30">
                <span className="text-primary-400 font-semibold text-sm">
                  V
                </span>
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="text-sm font-medium">Vinay</span>
                <span className="text-xs text-gray-500">0x1234...5678</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
