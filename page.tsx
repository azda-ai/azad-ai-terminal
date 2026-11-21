import Link from "next/link";

const Logo = () => (
  <span className="logo"><img src="/azad-mark.svg" width="26" height="26" alt="" />Azad</span>
);

/* Deterministic field of launches: most are filtered out at the scan line. */
function Funnel() {
  let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const dots = Array.from({ length: 96 }, () => ({ x: 14 + r() * 330, y: 18 + r() * 324, k: r() }));
  const pass = [{ y: 92, t: "88" }, { y: 178, t: "81" }, { y: 262, t: "74" }];
  return (
    <svg className="fun" viewBox="0 0 560 360" role="img" aria-label="Ninety-six new launches enter on the left; three pass the checks on the right.">
      <g fill="#8b8f95">{dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={1.6 + d.k * 2.2} opacity={0.18 + d.k * 0.32} />)}</g>
      <line x1="372" y1="8" x2="372" y2="352" stroke="#ff5b1f" strokeWidth="1.5" strokeDasharray="3 5" />
      <text x="372" y="352" dy="14" textAnchor="middle" fontFamily="ui-monospace,Menlo,monospace" fontSize="10" fill="#8b8f95">on-chain checks</text>
      {pass.map((p) => (
        <g key={p.y}>
          <path d={`M372 ${p.y}H430`} stroke="#ff5b1f" strokeWidth="1.5" />
          <circle cx="440" cy={p.y} r="9" fill="#ff5b1f" />
          <rect x="462" y={p.y - 15} width="78" height="30" rx="6" fill="#121416" stroke="#23262a" />
          <text x="474" y={p.y + 4} fontFamily="ui-monospace,Menlo,monospace" fontSize="12" fill="#ece9e2">{p.t}/100</text>
        </g>
      ))}
    </svg>
  );
}

const checks: [string, string, string, string][] = [
  ["Mint authority", "Can the deployer print more supply?", "revoked or open", "ok"],
  ["Freeze authority", "Can the deployer freeze your tokens?", "revoked or open", "ok"],
  ["Holder concentration", "Share held by the ten largest accounts, via RPC.", "percent", "ok"],
  ["Liquidity lock", "Not verified yet. Shown as unknown, never as safe.", "unknown", "warn"],
];
const faqs = [
  ["Is this financial advice?", "No. Azad shows data and a model's reading of it. Most memecoins lose value and many go to zero. Only trade what you can afford to lose."],
  ["Does Azad hold my keys or funds?", "No. Azad builds an unsigned Jupiter transaction. Your wallet shows it to you and signs it. Azad has no way to move your funds."],
  ["Where does the data come from?", "Solana RPC for mint and holder data, DexScreener for new pairs, Jupiter for quotes. Smart-money and social signals appear only when those sources are connected, and are marked unavailable otherwise."],
  ["Can the model be wrong?", "Yes. It can misread data or miss a scam. A high safety score means a few known red flags are absent. It is not a guarantee."],
];

export default function Landing() {
  return (
    <>
      <nav><div className="wrap">
        <Link href="/" aria-label="Azad home"><Logo /></Link>
        <div className="nl">
          <a href="#output">Output</a><a href="#checks">Checks</a><a href="#custody">Custody</a><a href="#faq">FAQ</a>
          <Link href="/terminal" className="btn pri">Open terminal</Link>
        </div>
        <details className="menu"><summary>Menu</summary><div>
          <a href="#output">Output</a><a href="#checks">Checks</a><a href="#custody">Custody</a><a href="#faq">FAQ</a>
          <Link href="/terminal" className="btn pri" style={{ marginTop: 6 }}>Open terminal</Link>
        </div></details>
      </div></nav>

      <header className="hero"><div className="wrap">
        <div>
          <h1>Find the launch. Check the contract. <span>Sign the swap.</span></h1>
          <p className="sub">Azad is a chat terminal for Solana memecoins. Ask in plain English. It pulls new pairs, reads mint and holder data on-chain, and prepares the Jupiter swap for you to sign.</p>
          <div className="row"><Link href="/terminal" className="btn pri">Open terminal</Link><a href="#output" className="btn">See what it returns</a></div>
          <p className="note">Non-custodial. Memecoins are high risk.</p>
        </div>
        <figure><Funnel /><figcaption>Illustration: a day of launches in, a short list out.</figcaption></figure>
      </div></header>

      <section id="output"><div className="wrap two">
        <div>
          <h2>One question, one card per candidate.</h2>
          <p className="lead">Each result carries the numbers you would otherwise open four tabs for.</p>
          <ol className="notes">
            <li><div><b>Safety score first</b><p>Authorities and holder concentration are checked before a Buy button appears.</p></div></li>
            <li><div><b>Flags in plain text</b><p>Open mint, open freeze or a heavy top-ten share is listed on the card, not buried.</p></div></li>
            <li><div><b>Slippage is yours</b><p>Set the amount and tolerance per trade. The quote comes from Jupiter.</p></div></li>
          </ol>
        </div>
        <figure>
          <div className="tk" aria-label="Sample token card">
            <div className="h"><b>Sample Token <span style={{ color: "var(--mute)", fontWeight: 400 }}>$SMPL</span></b><span className="sc ok">86/100</span></div>
            <div className="ca">So1ana...SampleMintAddress...1111</div>
            <div className="m"><div><span>Holders</span><b>1,204</b></div><div><span>24h volume</span><b>$310K</b></div><div><span>Liquidity</span><b>$42K</b></div><div><span>Top 10 hold</span><b>31.4%</b></div></div>
            <div className="fl">Liquidity lock not verified</div>
            <div className="buy"><input defaultValue="0.1" aria-label="SOL amount" readOnly /> SOL <input defaultValue="5" aria-label="Slippage percent" readOnly /> % <Link href="/terminal" className="btn pri" style={{ marginLeft: "auto" }}>Buy</Link></div>
          </div>
          <figcaption>Sample data for layout. Not a real token.</figcaption>
        </figure>
      </div></section>

      <section id="checks"><div className="wrap">
        <h2>What gets checked, and what doesn't.</h2>
        <p className="lead">Every check reads chain state through your RPC. Where a check isn't built yet, the card says so.</p>
        <div className="ledger">
          <div><span>Check</span><span>Question</span><span style={{ textAlign: "right" }}>Result</span></div>
          {checks.map(([a, b, c, t]) => (<div key={a}><b>{a}</b><i>{b}</i><em className={t}>{c}</em></div>))}
        </div>
      </div></section>

      <section id="custody"><div className="wrap two">
        <div><h2>Azad builds transactions. Your wallet signs them.</h2></div>
        <div>
          <p className="lead" style={{ marginBottom: 20 }}>There is no custody, no deposit and no API key for your funds. The agent can request a quote. It cannot send one. Every swap opens in your wallet for review first.</p>
          <ul className="road">
            <li><div><b>AI Battle Arena</b><p>Agents with different strategies, ranked publicly.</p></div><span>In development</span></li>
            <li><div><b>Platform token utility</b><p>Pay for premium analysis and data.</p></div><span>In development</span></li>
          </ul>
        </div>
      </div></section>

      <section id="faq"><div className="wrap" style={{ maxWidth: 760 }}>
        <h2>Questions</h2>
        <div style={{ marginTop: 28 }}>{faqs.map(([q, a]) => (<details className="q" key={q}><summary>{q}</summary><p>{a}</p></details>))}</div>
      </div></section>

      <section id="community" className="community"><div className="wrap">
        <div className="two">
          <div>
            <h2>Contact & community</h2>
            <p className="lead">Follow Azad and get in touch.</p>
            <div className="community-links">
              <a className="btn" href="https://x.com/Azadai_xyz" target="_blank" rel="noreferrer">Follow us on X <span aria-hidden="true">↗</span></a>
              <a className="btn" href="https://github.com/azad-ai" target="_blank" rel="noreferrer">GitHub <span aria-hidden="true">↗</span></a>
            </div>
          </div>
          <div className="backers">
            <h3>Backers</h3>
            <ul>
              <li>SolanaFDN</li>
              <li>anza_xyz</li>
              <li>Dynamo Ventures</li>
            </ul>
          </div>
        </div>
      </div></section>

      <section className="end"><div className="wrap">
        <h2>Ask it something.</h2>
        <div className="row"><Link href="/terminal" className="btn pri">Open terminal</Link></div>
      </div></section>

      <footer><div className="wrap">
        <Logo />
        <p>Azad is software, not a broker or adviser. Nothing here is financial advice. Crypto assets are speculative and can lose all value.</p>
      </div></footer>
    </>
  );
}
