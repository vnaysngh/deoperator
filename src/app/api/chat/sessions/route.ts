import { prisma } from "@/lib/prisma";

const normalizeWallet = (address: string | null): string | null => {
  if (!address) return null;
  const trimmed = address.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
};

export async function GET(req: Request) {
  const walletAddress = normalizeWallet(req.headers.get("x-wallet-address"));

  if (!walletAddress) {
    return new Response(JSON.stringify({ sessions: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  const sessions = await prisma.chatSession.findMany({
    where: { walletAddress },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      lastActiveAt: true
    }
  });

  return new Response(
    JSON.stringify({
      sessions
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }
  );
}

type CreateSessionPayload = {
  title?: string;
  sessionId?: string;
};

export async function POST(req: Request) {
  const walletAddress = normalizeWallet(req.headers.get("x-wallet-address"));
  let payload: CreateSessionPayload | null = null;

  try {
    payload = (await req.json()) as CreateSessionPayload | null;
  } catch {
    payload = null;
  }

  const trimmedTitle =
    payload?.title?.trim().length ? payload.title.trim().slice(0, 80) : null;
  const providedSessionId = payload?.sessionId?.trim() || null;

  const session = await prisma.chatSession.create({
    data: {
      id: providedSessionId ?? undefined,
      walletAddress,
      title: trimmedTitle ?? "New chat"
    }
  });

  return new Response(
    JSON.stringify({
      sessionId: session.id,
      title: session.title
    }),
    {
      status: 201,
      headers: { "Content-Type": "application/json" }
    }
  );
}

type DeleteSessionPayload = {
  sessionId?: string;
};

export async function DELETE(req: Request) {
  const walletAddress = normalizeWallet(req.headers.get("x-wallet-address"));
  let payload: DeleteSessionPayload | null = null;

  try {
    payload = (await req.json()) as DeleteSessionPayload | null;
  } catch {
    payload = null;
  }

  const sessionId = payload?.sessionId?.trim();
  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: "sessionId is required" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (
    walletAddress &&
    session.walletAddress &&
    session.walletAddress !== walletAddress
  ) {
    return new Response(
      JSON.stringify({
        error: "Cannot delete a session owned by a different wallet."
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  await prisma.chatSession.delete({
    where: { id: sessionId }
  });

  return new Response(null, { status: 204 });
}
