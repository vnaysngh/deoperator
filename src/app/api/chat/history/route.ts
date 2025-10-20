import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { UIMessage } from "ai";

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
  const walletAddressHeader = req.headers.get("x-wallet-address");
  const normalizedWalletAddress = normalizeWalletAddress(walletAddressHeader);

  if (!normalizedWalletAddress) {
    return new Response(
      JSON.stringify({
        error: "Missing wallet address. Include x-wallet-address header."
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  try {
    const session = await prisma.chatSession.findUnique({
      where: { walletAddress: normalizedWalletAddress },
      include: {
        messages: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!session) {
      const newSession = await prisma.chatSession.create({
        data: { walletAddress: normalizedWalletAddress }
      });

      return new Response(
        JSON.stringify({
          sessionId: newSession.id,
          messages: []
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
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
