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
  SidebarMenuItem,
  SidebarFooter
} from "@/components/ui/sidebar";
import {
  ArrowLeftRight,
  Wallet,
  Clock,
  Plus,
  ChevronDown,
  Trash2,
  Activity,
  Coins,
  Twitter,
  Send
  // TrendingUp,
  // History,
  // Shield,
  // Settings,
  // HelpCircle
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";

type SessionSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
};

const sessionsCache = new Map<string, SessionSummary[]>();

const sessionsAreEqual = (
  a: SessionSummary[],
  b: SessionSummary[]
): boolean => {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (
      left.id !== right.id ||
      left.title !== right.title ||
      left.createdAt !== right.createdAt ||
      left.updatedAt !== right.updatedAt ||
      left.lastActiveAt !== right.lastActiveAt
    ) {
      return false;
    }
  }

  return true;
};

const menuItems = [
  { title: "deGPT", icon: ArrowLeftRight, url: "/trade" },
  { title: "basedCreators", icon: Coins, url: "/based-creators" },
  { title: "polyIntelligence", icon: Activity, url: "/poly-intelligence" }
  // { title: "Liquidity", icon: TrendingUp, url: "/liquidity" },
];

const secondaryItems = [
  { title: "Portfolio", icon: Wallet, url: "/portfolio" }
  // { title: "Transactions", icon: Clock, url: "/transactions" }
];

const formatRelativeTime = (input: string) => {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { address } = useAccount();
  const normalizedAddress = address?.toLowerCase() ?? null;
  const [historySessions, setHistorySessions] = useState<SessionSummary[]>(
    () => {
      if (!normalizedAddress) {
        return [];
      }
      const cached = sessionsCache.get(normalizedAddress);
      return cached ? cached : [];
    }
  );
  const [historyOpen, setHistoryOpen] = useState(true);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(
    null
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionPendingDelete, setSessionPendingDelete] =
    useState<SessionSummary | null>(null);

  const fetchHistorySessions = useCallback(async () => {
    if (!normalizedAddress) {
      setHistorySessions([]);
      return;
    }

    try {
      const response = await fetch("/api/chat/sessions", {
        headers: {
          "x-wallet-address": normalizedAddress
        }
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = (await response.json()) as {
        sessions: SessionSummary[];
      };
      const nextSessions = data.sessions ?? [];
      setHistorySessions((prevSessions) => {
        if (sessionsAreEqual(prevSessions, nextSessions)) {
          return prevSessions;
        }
        if (normalizedAddress) {
          sessionsCache.set(normalizedAddress, nextSessions);
        }
        return nextSessions;
      });
    } catch (error) {
      console.error("[SIDEBAR] Failed to fetch chat sessions:", error);
    }
  }, [normalizedAddress]);

  const handleNewChat = useCallback(() => {
    setHistoryOpen(true);
    router.push("/trade");
  }, [router]);

  const performDeleteSession = useCallback(
    async (sessionId: string) => {
      setDeletingSessionId(sessionId);
      try {
        const response = await fetch("/api/chat/sessions", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...(normalizedAddress
              ? { "x-wallet-address": normalizedAddress }
              : {})
          },
          body: JSON.stringify({ sessionId })
        });

        if (!response.ok && response.status !== 204) {
          const text = await response.text();
          throw new Error(text || "Failed to delete chat session");
        }

        await fetchHistorySessions();
        if (pathname === `/trade/${sessionId}`) {
          router.replace("/trade");
        }
      } catch (error) {
        console.error("[SIDEBAR] Failed to delete session:", error);
      } finally {
        setDeletingSessionId(null);
        setDeleteDialogOpen(false);
        setSessionPendingDelete(null);
      }
    },
    [fetchHistorySessions, normalizedAddress, pathname, router]
  );

  const isActivePath = (url: string) => {
    if (url === "/trade") {
      return (
        pathname === url || pathname === "/" || pathname.startsWith("/trade/")
      );
    }
    return pathname === url || pathname.startsWith(`${url}/`);
  };

  useEffect(() => {
    fetchHistorySessions();
  }, [fetchHistorySessions]);

  useEffect(() => {
    const handler = () => {
      fetchHistorySessions();
    };

    window.addEventListener("chat-session-updated", handler);
    return () => {
      window.removeEventListener("chat-session-updated", handler);
    };
  }, [fetchHistorySessions]);

  useEffect(() => {
    if (!normalizedAddress) {
      setHistorySessions([]);
      return;
    }

    const cached = sessionsCache.get(normalizedAddress);
    if (cached) {
      setHistorySessions(cached);
    }
  }, [normalizedAddress]);

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-white/5 w-64 max-w-xs shrink-0"
    >
      <SidebarHeader className="border-b border-white/5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="hover:bg-white/5">
              <Image
                src="/images/logo.png"
                alt="DeOperator Logo"
                width={40}
                height={40}
                className="rounded-md"
              />
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

        {secondaryItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-gray-500 text-xs">
              More
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {secondaryItems.map((item) => {
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
        )}

        {normalizedAddress && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-gray-500 text-xs flex items-center justify-between">
              <button
                type="button"
                className="flex items-center gap-1 text-gray-500 hover:text-primary-400 transition-colors"
                onClick={() => setHistoryOpen((prev) => !prev)}
                aria-expanded={historyOpen}
              >
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    historyOpen ? "rotate-0" : "-rotate-90"
                  )}
                />
                History
              </button>
              <button
                type="button"
                onClick={handleNewChat}
                className="flex items-center gap-1 text-[11px] text-primary-400 hover:text-primary-300 transition-colors"
              >
                <Plus className="h-3 w-3" />
                New
              </button>
            </SidebarGroupLabel>
            {historyOpen && (
              <SidebarGroupContent>
                <SidebarMenu>
                  {historySessions.length === 0 && (
                    <SidebarMenuItem>
                      <div className="px-3 py-2 text-xs text-gray-500">
                        No chats yet.
                      </div>
                    </SidebarMenuItem>
                  )}

                  {historySessions.map((session) => {
                    const sessionPath = `/trade/${session.id}`;
                    const active = pathname === sessionPath;
                    const title =
                      session.title && session.title !== "New chat"
                        ? session.title
                        : "New chat";

                    return (
                      <SidebarMenuItem key={session.id}>
                        <div className="flex items-center gap-2 pr-2">
                          <SidebarMenuButton
                            onClick={() => router.push(sessionPath)}
                            isActive={active}
                            className={cn(
                              "hover:bg-white/5 hover:text-primary-400 transition-colors justify-between flex-1 text-left min-w-0"
                            )}
                          >
                            <div className="flex flex-col gap-1 min-w-0">
                              <span className="text-xs font-medium text-gray-200 truncate">
                                {title}
                              </span>
                              <span className="text-[11px] text-gray-500 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatRelativeTime(session.lastActiveAt)}
                              </span>
                            </div>
                          </SidebarMenuButton>
                          <button
                            type="button"
                            onClick={() => {
                              setSessionPendingDelete(session);
                              setDeleteDialogOpen(true);
                            }}
                            disabled={deletingSessionId === session.id}
                            className="p-1 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                            aria-label="Delete chat"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>
        )}
      </SidebarContent>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open && !deletingSessionId) {
            setSessionPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the conversation and all of its
              messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSessionId !== null}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingSessionId !== null || !sessionPendingDelete}
              onClick={() => {
                if (sessionPendingDelete) {
                  void performDeleteSession(sessionPendingDelete.id);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SidebarFooter className="border-t border-white/5">
        <div className="px-4 py-2">
          <div className="flex items-center justify-center gap-3">
            <a
              href="https://x.com/deopdotfun"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 text-gray-400 hover:bg-[#7fffd41a] hover:text-[#7fffd4] transition-all duration-200 group"
              aria-label="Follow us on Twitter"
            >
              <Twitter className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </a>
            <a
              href="https://t.me/+e2QdhRweac1kYjc9"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 text-gray-400 hover:bg-[#7fffd41a] hover:text-[#7fffd4] transition-all duration-200 group"
              aria-label="Join us on Telegram"
            >
              <Send className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </a>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
