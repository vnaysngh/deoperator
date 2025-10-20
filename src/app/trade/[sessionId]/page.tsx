"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { Chat } from "@/components/Chat";

function useSessionId(): string | null {
  const params = useParams<{ sessionId: string | string[] }>();
  return useMemo(() => {
    if (!params) return null;
    const raw = params.sessionId;
    if (Array.isArray(raw)) {
      return raw[0] ?? null;
    }
    return raw ?? null;
  }, [params]);
}

export default function TradeSessionPage() {
  const sessionId = useSessionId();

  return (
    <>
      <div className="text-center mb-12 mt-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
          <span className="gradient-text">
            Trade tokens using natural language
          </span>
        </h1>
      </div>

      <div className="max-w-4xl mx-auto mb-12 px-4 sm:px-6">
        <Chat key={sessionId ?? "new"} sessionId={sessionId} />
      </div>
    </>
  );
}
