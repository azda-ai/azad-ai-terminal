"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { VersionedTransaction } from "@solana/web3.js";

type Card = { mint: string; name?: string; symbol?: string; narrative: string; safety_score?: number; flags: string[]; holders: number | null; volume_24h?: number; liquidity_usd?: number; market_cap?: number };
type Msg = { role: "user" | "assistant"; text: string; cards?: Card[]; status?: string };
type SolanaWallet = {
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  signAndSendTransaction: (transaction: VersionedTransaction) => Promise<{ signature: string }>;
};
const fmt = (n?: number | null) => (n == null ? "n/a" : n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : String(Math.round(n)));
const LABEL: Record<string, string> = { fetch_new_pools: "Scanning new pairs", fetch_token_safety: "Checking mint and holders", fetch_smart_money: "Reading tracked wallets", fetch_social_sentiment: "Reading X", show_token_card: "Building card", execute_swap: "Requesting quote" };
const TRY = ["New launches in the last 2 hours with liquidity over $20K", "Check the safety of this mint: paste an address", "Which fresh tokens have a revoked mint and freeze authority?"];

function TokenCard({ c }: { c: Card }) {
  const [sol, setSol] = useState("0.1"), [slip, setSlip] = useState("5"), [st, setSt] = useState("");
  const sc = c.safety_score ?? 0, cls = sc >= 70 ? "ok" : sc >= 40 ? "warn" : "bad";
  async function buy() {
    try {
      const w = (window as Window & { solana?: SolanaWallet }).solana;
      if (!w) return setSt("Wallet not found. Install Phantom.");
      const { publicKey } = await w.connect(); setSt("Building transaction");
      const amount = Number(sol), slippage = Number(slip);
      if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(slippage) || slippage <= 0 || slippage > 100) {
        setSt("Enter a valid SOL amount and slippage from 0 to 100%."); return;
      }
      const response = await fetch("/api/swap", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ mint: c.mint, sol: amount, slippageBps: Math.round(slippage * 100), wallet: publicKey.toString() }) });
      const r = await response.json() as { error?: string; tx?: string };
      if (!response.ok || !r.tx) { setSt(r.error || "Could not build the swap transaction."); return; }
      const tx = VersionedTransaction.deserialize(Uint8Array.from(atob(r.tx), (x) => x.charCodeAt(0)));
      const { signature } = await w.signAndSendTransaction(tx);
      setSt("Sent " + signature.slice(0, 10) + "...");
    } catch (e: unknown) { setSt(e instanceof Error ? e.message : "Wallet request failed."); }
  }
  return (
    <div className="tk" style={{ margin: "12px 0" }}>
      <div className="h"><b>{c.name} <span style={{ color: "var(--mute)", fontWeight: 400 }}>${c.symbol}</span></b><span className={`sc ${cls}`}>{c.safety_score ?? "?"}/100</span></div>
      <div className="ca">{c.mint}</div>
      <div className="m"><div><span>Holders</span><b>{fmt(c.holders)}</b></div><div><span>24h volume</span><b>${fmt(c.volume_24h)}</b></div><div><span>Liquidity</span><b>${fmt(c.liquidity_usd)}</b></div><div><span>Market cap</span><b>${fmt(c.market_cap)}</b></div></div>
      <div style={{ fontSize: 13, color: "var(--mute)", marginBottom: 6 }}>{c.narrative}</div>
      {c.flags.map((f) => <div className="fl" key={f}>{f}</div>)}
      <div className="buy">
        <input inputMode="decimal" value={sol} onChange={(e) => setSol(e.target.value)} aria-label="SOL amount" /> SOL
        <input inputMode="decimal" value={slip} onChange={(e) => setSlip(e.target.value)} aria-label="Slippage percent" /> %
        <button className="btn pri" onClick={buy} style={{ marginLeft: "auto" }}>Buy</button>
      </div>
      {st && <div className="st" role="status">{st}</div>}
    </div>
  );
}

export default function Terminal() {
  const [tab, setTab] = useState("Chat");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState(""), [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  async function send(text = input) {
    if (!text.trim() || busy) return;
    const next: Msg[] = [...msgs, { role: "user", text }, { role: "assistant", text: "", cards: [] }];
    setMsgs(next); setInput(""); setBusy(true);
    const upd = (f: (m: Msg) => Msg) => setMsgs((p) => p.map((m, i) => (i === p.length - 1 ? f(m) : m)));
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next.slice(0, -1).map((m) => ({ role: m.role, content: m.text })) }) });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || `Chat request failed (${res.status}).`);
      }
      if (!res.body) throw new Error("Chat response had no stream.");
      const rd = res.body.getReader(), dec = new TextDecoder(); let buf = "";
      for (;;) {
        const { done, value } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n"); buf = parts.pop()!;
        for (const p of parts) {
          const e = JSON.parse(p.replace(/^data: /, ""));
          if (e.type === "text") upd((m) => ({ ...m, text: m.text + e.text, status: "" }));
          else if (e.type === "tool") upd((m) => ({ ...m, status: (LABEL[e.name] || "Working") + "..." }));
          else if (e.type === "card") upd((m) => ({ ...m, cards: [...(m.cards || []), e.card] }));
          else if (e.type === "error") upd((m) => ({ ...m, text: m.text + `\nSomething went wrong: ${e.error}` }));
          end.current?.scrollIntoView({ block: "end" });
        }
      }
    } catch (e: unknown) { upd((m) => ({ ...m, text: e instanceof Error ? e.message : "Connection lost. Try again." })); }
    setBusy(false); upd((m) => ({ ...m, status: "" }));
  }

  return (
    <main className="term">
      <div className="tbar"><Link href="/" className="logo" aria-label="Azad home">
        <img src="/azad-mark.svg" width="24" height="24" alt="" />Azad</Link></div>
      <div className="tabs" role="tablist">
        {["Chat", "Battle Arena", "Token"].map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {tab !== "Chat" ? <div className="soonbox">{tab === "Token" ? "Token utility" : "Battle Arena"} is in development.</div> : (<>
        <div className="feed">
          {!msgs.length && <div><div style={{ color: "var(--mute)" }}>Ask about new Solana launches, or paste a mint to check it.</div>
            <div className="try">{TRY.map((t) => <button key={t} onClick={() => send(t)}>{t}</button>)}</div></div>}
          {msgs.map((m, i) => m.role === "user" ? <div key={i} className="u">{m.text}</div> : (
            <div key={i}>{m.text && <div className="a">{m.text}</div>}{m.status && <div className="st">{m.status}</div>}{m.cards?.map((c) => <TokenCard key={c.mint} c={c} />)}</div>))}
          <div ref={end} />
        </div>
        <form className="comp" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about a token or a launch" aria-label="Message" enterKeyHint="send" />
          <button className="btn pri" disabled={busy} type="submit">Send</button>
        </form>
        <div className="risk">Not financial advice. Memecoins can go to zero.</div>
      </>)}
    </main>
  );
}
