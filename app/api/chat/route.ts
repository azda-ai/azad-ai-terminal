import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant"; content: string };
type RpcEnvelope<T> = { result?: T; error?: { message?: string } };
type MintAccount = { owner: string; data: [string, string] };
type RpcValue<T> = { value: T };
type TokenAmount = { uiAmountString: string };
type TokenAccountAmount = { uiAmountString: string };
type DexPair = {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  pairCreatedAt?: number;
  url?: string;
};

const TOKEN_PROGRAMS = new Set([
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
]);

async function solanaRpc<T>(method: string, params: unknown[]) {
  const response = await fetch(process.env.SOLANA_RPC_URL || "https://api.mainnet.solana.com", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "azad", method, params }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Solana RPC returned HTTP ${response.status}`);
  const payload = await response.json() as RpcEnvelope<T>;
  if (payload.error || payload.result === undefined) throw new Error(payload.error?.message || "Solana RPC returned no result");
  return payload.result;
}

async function readLiveTokenData(mintAddress: string) {
  const checkedAt = new Date().toISOString();
  const rpcEndpoint = process.env.SOLANA_RPC_URL || "https://api.mainnet.solana.com";
  const sources = [rpcEndpoint];
  const context: Record<string, unknown> = { mint: mintAddress, checkedAt, sources };

  try {
    const account = await solanaRpc<RpcValue<MintAccount | null>>("getAccountInfo", [
      mintAddress,
      { commitment: "confirmed", encoding: "base64" },
    ]);
    const mint = account.value;
    if (!mint) return { ...context, error: "No on-chain account exists for this address." };
    if (!TOKEN_PROGRAMS.has(mint.owner)) return { ...context, ownerProgram: mint.owner, error: "Address is not an SPL Token or Token-2022 mint account." };

    const data = Buffer.from(mint.data[0], "base64");
    if (data.length < 82) return { ...context, ownerProgram: mint.owner, error: "Mint account data is shorter than the SPL mint layout." };

    const mintAuthority = data.readUInt32LE(0) === 0 ? null : new PublicKey(data.subarray(4, 36)).toBase58();
    const supply = data.readBigUInt64LE(36).toString();
    const decimals = data.readUInt8(44);
    const freezeAuthority = data.readUInt32LE(46) === 0 ? null : new PublicKey(data.subarray(50, 82)).toBase58();
    Object.assign(context, {
      ownerProgram: mint.owner,
      initialized: data.readUInt8(45) !== 0,
      mintAuthority: mintAuthority ?? "revoked",
      freezeAuthority: freezeAuthority ?? "revoked",
      supplyBaseUnits: supply,
      decimals,
      supplyUi: Number(supply) / (10 ** decimals),
    });

    const [supplyResult, largestResult, pairsResult] = await Promise.allSettled([
      solanaRpc<RpcValue<TokenAmount>>("getTokenSupply", [mintAddress, { commitment: "confirmed" }]),
      solanaRpc<RpcValue<TokenAccountAmount[]>>("getTokenLargestAccounts", [mintAddress, { commitment: "confirmed" }]),
      fetch(`https://api.dexscreener.com/token-pairs/v1/solana/${mintAddress}`, {
        signal: AbortSignal.timeout(8_000),
      }).then(async (response) => {
        if (!response.ok) throw new Error(`DexScreener returned HTTP ${response.status}`);
        return await response.json() as DexPair[];
      }),
    ]);

    if (supplyResult.status === "fulfilled") context.supplyUi = supplyResult.value.value.uiAmountString;
    if (largestResult.status === "fulfilled" && supplyResult.status === "fulfilled") {
      const totalSupply = Number(supplyResult.value.value.uiAmountString);
      const topTenAccounts = largestResult.value.value.slice(0, 10);
      const topTenBalance = topTenAccounts.reduce((sum, item) => sum + Number(item.uiAmountString), 0);
      context.topTenTokenAccountConcentrationPercent = totalSupply > 0 ? Number((topTenBalance / totalSupply * 100).toFixed(4)) : null;
      context.largestTokenAccountsReturned = largestResult.value.value.length;
      context.holderDataNote = "This is the balance share in the 10 largest token accounts, not unique-wallet concentration or the complete holder set. Accounts can include liquidity pools or custodians.";
    } else {
      context.topAccountsUnavailable = true;
    }

    if (pairsResult.status === "fulfilled") {
      const pair = pairsResult.value
        .filter((item) => item.chainId === "solana" && item.baseToken?.address?.toLowerCase() === mintAddress.toLowerCase())
        .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
      if (pair) {
        context.market = {
          name: pair.baseToken?.name,
          symbol: pair.baseToken?.symbol,
          dex: pair.dexId,
          priceUsd: pair.priceUsd,
          liquidityUsd: pair.liquidity?.usd,
          volume24hUsd: pair.volume?.h24,
          fdvUsd: pair.fdv,
          pairCreatedAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : undefined,
          pairUrl: pair.url,
          source: "DexScreener",
        };
        sources.push("DexScreener");
      } else {
        context.marketUnavailable = "DexScreener has no indexed Solana pair for this mint yet.";
      }
    } else {
      context.marketUnavailable = "DexScreener could not be reached.";
    }
  } catch (error) {
    context.rpcError = error instanceof Error ? error.message : "Could not read Solana RPC data.";
  }
  return context;
}

function event(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI chat needs a free Gemini API key. Add GEMINI_API_KEY to .env.local, then restart the dev server." },
      { status: 503 },
    );
  }

  let payload: { messages?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!Array.isArray(payload.messages) || payload.messages.length === 0 || payload.messages.length > 20) {
    return NextResponse.json({ error: "Send between 1 and 20 chat messages." }, { status: 400 });
  }

  const messages: ChatMessage[] = [];
  for (const item of payload.messages) {
    if (
      typeof item !== "object" || item === null ||
      !["user", "assistant"].includes((item as { role?: string }).role ?? "") ||
      typeof (item as { content?: unknown }).content !== "string" ||
      !(item as { content: string }).content.trim() ||
      (item as { content: string }).content.length > 4000
    ) {
      return NextResponse.json({ error: "Each message needs a user or assistant role and 1–4,000 characters of text." }, { status: 400 });
    }
    messages.push({
      role: (item as { role: ChatMessage["role"] }).role,
      content: (item as { content: string }).content,
    });
  }

  if (messages[messages.length - 1]?.role !== "user") {
    return NextResponse.json({ error: "The latest message must be from the user." }, { status: 400 });
  }

  let upstream: Response;
  try {
    const conversation = messages
      .map((message) => `${message.role === "assistant" ? "Azad" : "User"}: ${message.content}`)
      .join("\n\n");
    const addresses = new Set<string>();
    for (const match of conversation.matchAll(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g)) {
      try {
        addresses.add(new PublicKey(match[0]).toBase58());
      } catch {
        // Ignore text that looks like, but is not, a base58 public key.
      }
      if (addresses.size >= 2) break;
    }
    const liveTokenData = await Promise.all([...addresses].map(readLiveTokenData));
    const input = liveTokenData.length
      ? `${conversation}\n\nLive token data collected for this request at ${new Date().toISOString()}:\n${JSON.stringify(liveTokenData)}\nTreat these results as time-sensitive observations. State their sources and limitations, and do not infer that the token is safe.`
      : conversation;
    upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions?alt=sse", {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
        stream: true,
        store: false,
        system_instruction: "You are Azad, a helpful assistant for Solana memecoin research. Be concise and explain risks clearly. When live Solana or market data is included in the user input, use it accurately and identify that it is a point-in-time reading. Without supplied live data, never claim to have checked a token or current market conditions. Do not present guesses as facts. Do not provide personalized financial advice or claim a token is safe. Largest token accounts are not the same as unique holders. The app does not execute trades through chat.",
        input,
      }),
      signal: request.signal,
    });
  } catch {
    return NextResponse.json({ error: "Could not reach the AI provider. Check the server connection and try again." }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const details = await upstream.json().catch(() => null) as { error?: { message?: string } } | null;
    const message = upstream.status === 401
      ? "The Gemini API key was rejected. Check GEMINI_API_KEY in .env.local."
      : upstream.status === 429
        ? "The Gemini API free-tier limit was reached. Wait for the quota to reset or check your Google AI Studio usage."
        : details?.error?.message || `The AI provider returned HTTP ${upstream.status}.`;
    return NextResponse.json({ error: message }, { status: upstream.status === 401 ? 503 : 502 });
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split(/\r?\n/);
          buffer = chunks.pop() ?? "";
          for (const line of chunks) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data) as {
                event_type?: string;
                delta?: { type?: string; text?: unknown };
              };
              const text = parsed.event_type === "step.delta" && parsed.delta?.type === "text"
                ? parsed.delta.text
                : undefined;
              if (typeof text === "string" && text) controller.enqueue(encoder.encode(event({ type: "text", text })));
            } catch {
              // Ignore incomplete or non-JSON provider event lines.
            }
          }
        }
        controller.enqueue(encoder.encode(event({ type: "done" })));
        controller.close();
      } catch {
        controller.enqueue(encoder.encode(event({ type: "error", error: "The AI response stream was interrupted. Try again." })));
        controller.close();
      } finally {
        reader.releaseLock();
      }
    },
    cancel() {
      void reader.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
