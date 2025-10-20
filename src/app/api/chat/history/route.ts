import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { UIMessage } from "ai";
import { randomUUID } from "crypto";

type PersistedMessage = {
  id: string;
  role: UIMessage["role"];
  parts: UIMessage["parts"];
  metadata?: UIMessage["metadata"];
};

const cloneJson = <T>(value: Prisma.JsonValue | null | undefined, fallback: T): T => {
  if (value === null || value === undefined) {
    return fallback;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch (error) {
    console.error("[API] Failed to clone JSON value:", error);
    return fallback;
  }
};

function normalizeWalletAddress(address: string | null): string | null {
  if (!address) {
    return null;
  }

  const trimmed = address.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed.toLowerCase();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  const walletAddressHeader = req.headers.get("x-wallet-address");
  const normalizedWalletAddress = normalizeWalletAddress(walletAddressHeader);

  if (!sessionId) {
    return new Response(
      JSON.stringify({
        error: "Missing sessionId query parameter."
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  try {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!session) {
      return new Response(
        JSON.stringify({
          error: "Chat session not found."
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    if (
      normalizedWalletAddress &&
      session.walletAddress &&
      session.walletAddress !== normalizedWalletAddress
    ) {
      return new Response(
        JSON.stringify({
          error: "Session belongs to a different wallet address."
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    if (normalizedWalletAddress && !session.walletAddress) {
      try {
        await prisma.chatSession.update({
          where: { id: session.id },
          data: { walletAddress: normalizedWalletAddress }
        });
      } catch (assignError) {
        console.error(
          "[API] Failed to assign wallet to chat session:",
          assignError
        );
      }
    }

    const responseMessages: PersistedMessage[] = [];
    const seenIds = new Set<string>();

    for (const message of session.messages) {
      let resolvedId =
        typeof message.messageId === "string" &&
        message.messageId.trim().length > 0
          ? message.messageId
          : message.id;

      if (!resolvedId || seenIds.has(resolvedId)) {
        const newId = randomUUID();

        try {
          await prisma.chatMessage.update({
            where: { id: message.id },
            data: { messageId: newId }
          });
          resolvedId = newId;
        } catch (updateError) {
          console.error(
            "[API] Failed to assign unique messageId for history row:",
            updateError
          );
          resolvedId = `${message.id}-${Date.now()}`;
        }
      }

      seenIds.add(resolvedId);

      const base: PersistedMessage = {
        id: resolvedId,
        role: message.role as UIMessage["role"],
        parts: cloneJson<UIMessage["parts"]>(message.parts, [])
      };

      if (message.metadata !== null && message.metadata !== undefined) {
        base.metadata = cloneJson<UIMessage["metadata"]>(
          message.metadata,
          undefined
        );
      }

      responseMessages.push(base);
    }

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        messages: responseMessages
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("[API] Failed to fetch chat history:", error);
    return new Response(
      JSON.stringify({ error: "Failed to load chat history" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
