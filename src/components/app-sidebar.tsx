"use client";

import {
  Sidebar,
  SidebarContent,
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
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

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
  const pathname = usePathname();

  const isActivePath = (url: string) => {
    if (url === "/trade") {
      return pathname === url || pathname === "/";
    }
    return pathname === url || pathname.startsWith(`${url}/`);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-white/5">
      <SidebarHeader className="border-b border-white/5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="hover:bg-white/5"
              style={{ gap: "0 rem" }}
            >
              <div className="flex h-10 w-10 flex-col items-start justify-center gap-1 px-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-primary-400">
                  DE
                </span>
                <span className="flex items-center gap-1 text-[9px] font-medium tracking-[0.22em] text-white/80">
                  <span className="text-primary-400/80 font-mono text-[11px] leading-none">
                    ›
                  </span>
                  OP
                </span>
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
              {menuItems.map((item) => {
                const active = isActivePath(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      className={cn(
                        "transition-colors",
                        "hover:bg-[#7fffd41a] hover:text-[#7fffd4]",
                        "data-[active=true]:!bg-[#7fffd41a] data-[active=true]:!text-[#7fffd4]"
                      )}
                    >
                      <Link
                        href={item.url}
                        aria-current={active ? "page" : undefined}
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
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

      {/*  <SidebarFooter className="border-t border-white/5">
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
      </SidebarFooter> */}
    </Sidebar>
  );
}
