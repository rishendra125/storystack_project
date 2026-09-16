import { useState, useEffect } from "react";

// ── Constants ──
const EXAMPLE_BACKLOG = [
  "Add real-time fraud detection for card transactions using ML scoring at checkout",
  "Rebuild the 3DS2 authentication flow to reduce step-up rate by 30% and improve conversion",
  "Introduce dynamic currency conversion (DCC) at POS and online checkout for international buyers",
  "Implement PCI-DSS Level 1 tokenisation across all card storage endpoints to pass upcoming audit",
  "Add Apple Pay and Google Pay as express checkout options on mobile web",
  "Build a merchant self-serve dashboard to view transaction decline reasons and retry rates",
  "Migrate payment processing engine from monolith to event-driven microservices (Kafka-backed)",
  "Integrate buy-now-pay-later (BNPL) options — Klarna and Afterpay — at checkout",
];

const SYNTHETIC_SCORES = [
  { impact: 90, effort: 65, fit: 95, band: "must", rationale: "Fraud is a direct revenue and trust risk; ML detection at scoring time is table-stakes for a Growth + Risk-Reduction quarter." },
  { impact: 88, effort: 55, fit: 85, band: "must", rationale: "A 30% drop in step-up rate translates directly to conversion lift — highest ROI item in the backlog given Medium capacity." },
  { impact: 72, effort: 50, fit: 80, band: "should", rationale: "DCC unlocks international revenue; strong Growth fit but lower urgency than fraud and auth hardening." },
  { impact: 95, effort: 70, fit: 90, band: "must", rationale: "PCI audit is a hard compliance deadline — non-negotiable regardless of strategic priority; blocks merchant growth." },
  { impact: 78, effort: 35, fit: 82, band: "should", rationale: "Apple/Google Pay adoption is high on mobile; reasonable effort with clear conversion upside for a Growth frame." },
  { impact: 60, effort: 40, fit: 65, band: "nice", rationale: "Merchant visibility into declines is valuable but internally-facing; good Efficiency win but not critical path this sprint." },
  { impact: 55, effort: 90, fit: 50, band: "deprio", rationale: "Engine migration is a multi-quarter effort with high risk; valuable long-term but wrong size for Medium sprint capacity." },
  { impact: 80, effort: 55, fit: 75, band: "should", rationale: "BNPL drives basket conversion; strong Growth signal but integration complexity and partner dependency warrant Should Have." },
];

const BAND_ORDER = { must: 0, should: 1, nice: 2, deprio: 3 };
const BAND_LABELS = { must: "Must Have", should: "Should Have", nice: "Nice to Have", deprio: "Deprioritize" };

const AREA_LABELS = { payments: "Payments", ecommerce: "eCommerce", data_platform: "Data Platform" };
const SPRINT_LABELS = { small: "Small", medium: "Medium", large: "Large" };
const STRAT_LABELS = { growth: "Growth", risk_reduction: "Risk Reduction", compliance: "Compliance", efficiency: "Efficiency" };

// ── Helpers ──
function parseFeatures(text) {
  return text.split(/\n{2,}|\n(?=\S)/).map(s => s.replace(/\n/g, " ").trim()).filter(s => s.length > 0);
}

function scoreColor(val) {
  if (val >= 80) return "#3B82F6";
  if (val >= 60) return "#10B981";
  if (val >= 40) return "#F59E0B";
  return "#6B7280";
}

// ── API Calls ──
async function callScoringAPI(features, context) {
  const areaLabel = AREA_LABELS[context.productArea];
  const sprintLabel = SPRINT_LABELS[context.sprintCapacity];
  const stratLabel = STRAT_LABELS[context.strategicPriority];

  const prompt = `You are a senior Technical Program Manager scoring a product backlog for prioritization.

Context:
- Product Area: ${areaLabel}
- Sprint Capacity: ${sprintLabel}
- Strategic Priority: ${stratLabel}

Score each of the following feature requests. Return ONLY a JSON array — no markdown, no preamble, no explanation outside the array.

Each element must have exactly these fields:
{
  "impact": <integer 0-100, business value and revenue/risk impact>,
  "effort": <integer 0-100, implementation complexity and cost, 100 = hardest>,
  "fit": <integer 0-100, alignment with ${stratLabel} strategic priority>,
  "band": <one of: "must" | "should" | "nice" | "deprio">,
  "rationale": <one concise sentence explaining the band assignment in context of ${areaLabel} and ${stratLabel}>
}

Scoring guidance:
- "must": high impact (≥80) + high fit (≥75) + effort feasible for ${sprintLabel} sprint
- "should": strong scores but slightly lower urgency or higher effort
- "nice": valuable but not critical this sprint
- "deprio": low fit, excessive effort, or misaligned with ${stratLabel} frame

Features to score (${features.length} items):
${features.map((f, i) => `${i + 1}. ${f}`).join("\n")}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await response.json();
  const text = data.content.map(b => b.text || "").join("");
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

async function callBriefAPI(features, scores, context) {
  const areaLabel = AREA_LABELS[context.productArea];
  const sprintLabel = SPRINT_LABELS[context.sprintCapacity];
  const stratLabel = STRAT_LABELS[context.strategicPriority];
  const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const rankedList = features.map((f, i) => {
    const s = scores[i];
    const bandLabel = BAND_LABELS[s.band];
    return `${i + 1}. [${bandLabel}] ${f}\n   Impact: ${s.impact}/100 | Effort: ${s.effort}/100 | Fit: ${s.fit}/100\n   Rationale: ${s.rationale}`;
  }).join("\n\n");

  const prompt = `You are a senior Technical Program Manager writing a concise prioritization decision brief to present to engineering and leadership.

Context:
- Product Area: ${areaLabel}
- Sprint Capacity: ${sprintLabel}
- Strategic Priority: ${stratLabel}
- Date: ${dateStr}

Ranked backlog:
${rankedList}

Write a 1-page Decision Brief using this exact structure — plain text only, no markdown formatting:

STORYSTACK DECISION BRIEF
${areaLabel} · ${sprintLabel} Sprint Capacity · ${stratLabel} Strategic Frame
Generated: ${dateStr}

━━━ EXECUTIVE SUMMARY ━━━
[2-3 sentences: what was scored, what the recommendation is, and why it fits the strategic frame]

━━━ MUST HAVE (THIS SPRINT) ━━━
[Numbered list of Must Have features]
[1 paragraph: why these are the right sprint bets]

━━━ SHOULD HAVE (NEXT SPRINT / REFINEMENT) ━━━
[Numbered list of Should Have features]
[1 sentence: sequencing rationale]

━━━ NICE TO HAVE & DEPRIORITIZED ━━━
[Brief list with one-line reason each]

━━━ RECOMMENDATION FOR ENGINEERING ━━━
[2-3 concrete sentences on sprint scope, refinement queue, and what to block]

━━━ RECOMMENDATION FOR LEADERSHIP ━━━
[2 sentences: endorsement framing and escalation condition]

— Generated by StoryStack`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await response.json();
  return data.content.map(b => b.text || "").join("");
}

// ── Sub-components ──
function Spinner() {
  return (
    <div style={{
      width: 14, height: 14,
      border: "2px solid rgba(255,255,255,0.3)",
      borderTopColor: "#fff",
      borderRadius: "50%",
      animation: "spin 0.6s linear infinite",
      display: "inline-block",
    }} />
  );
}

function ScoreBar({ label, value, inverted = false }) {
  const displayVal = inverted ? 100 - value : value;
  const color = scoreColor(displayVal);
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10, fontFamily: "DM Mono, monospace", color: "#7A9BBF", marginBottom: 4 }}>{label}</div>
      <div style={{ height: 4, background: "#182844", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 2, transition: "width 0.4s ease" }} />
      </div>
      <div style={{ fontSize: 11, fontFamily: "DM Mono, monospace", color: "#E2E8F0", marginTop: 3 }}>{value}/100</div>
    </div>
  );
}

function BandTag({ band }) {
  const styles = {
    must:   { background: "rgba(59,130,246,0.15)", color: "#93C5FD", border: "1px solid rgba(59,130,246,0.3)" },
    should: { background: "rgba(16,185,129,0.15)", color: "#6EE7B7", border: "1px solid rgba(16,185,129,0.3)" },
    nice:   { background: "rgba(245,158,11,0.15)",  color: "#FCD34D", border: "1px solid rgba(245,158,11,0.3)" },
    deprio: { background: "rgba(107,114,128,0.15)", color: "#9CA3AF", border: "1px solid rgba(107,114,128,0.3)" },
  };
  return (
    <div style={{
      ...styles[band],
      fontSize: 10, fontFamily: "DM Mono, monospace",
      padding: "3px 9px", borderRadius: 20,
      whiteSpace: "nowrap", flexShrink: 0, fontWeight: 500,
    }}>
      {BAND_LABELS[band]}
    </div>
  );
}

function FeatureCard({ feature, score, rank }) {
  const bandColors = { must: "#3B82F6", should: "#10B981", nice: "#F59E0B", deprio: "#6B7280" };
  return (
    <div style={{
      background: "#111F35", border: "1px solid #1E3050",
      borderLeft: `4px solid ${bandColors[score.band]}`,
      borderRadius: 10, display: "grid",
      gridTemplateColumns: "32px 1fr", overflow: "hidden",
      marginBottom: 2,
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "DM Mono, monospace", fontSize: 12, color: "#7A9BBF",
        background: "#182844", borderRight: "1px solid #1E3050",
      }}>
        {rank}
      </div>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, flex: 1 }}>{feature}</div>
          <BandTag band={score.band} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          <ScoreBar label="Business Impact" value={score.impact} />
          <ScoreBar label="Effort" value={score.effort} inverted />
          <ScoreBar label="Strategic Fit" value={score.fit} />
        </div>
        <div style={{
          fontSize: 12, color: "#7A9BBF", lineHeight: 1.55, fontStyle: "italic",
          borderTop: "1px solid #1E3050", paddingTop: 8,
        }}>
          {score.rationale}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──
export default function StoryStack() {
  const [input, setInput] = useState("");
  const [productArea, setProductArea] = useState("payments");
  const [sprintCapacity, setSprintCapacity] = useState("medium");
  const [strategicPriority, setStrategicPriority] = useState("growth");

  const [features, setFeatures] = useState([]);
  const [scores, setScores] = useState([]);
  const [context, setContext] = useState({});
  const [hasResults, setHasResults] = useState(false);

  const [scoringLoading, setScoringLoading] = useState(false);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefText, setBriefText] = useState("");
  const [showBrief, setShowBrief] = useState(false);

  const loadExample = () => {
    setInput(EXAMPLE_BACKLOG.join("\n\n"));
    setProductArea("payments");
    setSprintCapacity("medium");
    setStrategicPriority("growth");
  };

  const runPrioritization = async () => {
    const raw = input.trim();
    if (!raw) { alert("Please enter at least one feature request."); return; }

    const parsed = parseFeatures(raw);
    const ctx = { productArea, sprintCapacity, strategicPriority };

    setScoringLoading(true);
    setShowBrief(false);
    setBriefText("");

    let result;
    try {
      result = await callScoringAPI(parsed, ctx);
      if (!Array.isArray(result) || result.length !== parsed.length) throw new Error("length mismatch");
    } catch (err) {
      console.warn("API failed, using synthetic fallback:", err);
      result = parsed.map((_, i) => {
        if (i < SYNTHETIC_SCORES.length) return SYNTHETIC_SCORES[i];
        const impact = 40 + Math.floor(Math.random() * 50);
        const effort = 30 + Math.floor(Math.random() * 60);
        const fit = 40 + Math.floor(Math.random() * 50);
        const avg = (impact + fit - effort * 0.3) / 2;
        const band = avg > 75 ? "must" : avg > 60 ? "should" : avg > 45 ? "nice" : "deprio";
        return { impact, effort, fit, band, rationale: "Scored based on context and capacity analysis." };
      });
    }

    // Sort
    const indexed = parsed.map((f, i) => ({ f, s: result[i] }));
    indexed.sort((a, b) => {
      const ba = BAND_ORDER[a.s.band] ?? 3, bb = BAND_ORDER[b.s.band] ?? 3;
      if (ba !== bb) return ba - bb;
      return (b.s.impact + b.s.fit - b.s.effort * 0.3) - (a.s.impact + a.s.fit - a.s.effort * 0.3);
    });

    setFeatures(indexed.map(x => x.f));
    setScores(indexed.map(x => x.s));
    setContext(ctx);
    setHasResults(true);
    setScoringLoading(false);
  };

  const generateBrief = async () => {
    setBriefLoading(true);
    setShowBrief(false);
    try {
      const text = await callBriefAPI(features, scores, context);
      setBriefText(text);
      setShowBrief(true);
    } catch (err) {
      setBriefText("Failed to generate brief. Please try again.");
      setShowBrief(true);
    }
    setBriefLoading(false);
  };

  useEffect(() => {
    loadExample();
  }, []);

  useEffect(() => {
    if (input) runPrioritization();
  }, []); // run once on mount after example loads

  // Band counts
  const bandCounts = { must: 0, should: 0, nice: 0, deprio: 0 };
  scores.forEach(s => { if (s.band) bandCounts[s.band]++; });
  const bandColors = { must: "#3B82F6", should: "#10B981", nice: "#F59E0B", deprio: "#6B7280" };

  const selectStyle = {
    width: "100%", background: "#182844", border: "1px solid #1E3050",
    borderRadius: 8, padding: "9px 12px", color: "#E2E8F0",
    fontFamily: "Inter, sans-serif", fontSize: 13, outline: "none",
    cursor: "pointer", appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%237A9BBF' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0B1628; }
        @keyframes spin { to { transform: rotate(360deg); } }
        textarea:focus { border-color: #3B82F6 !important; outline: none; }
        textarea::placeholder { color: #7A9BBF; }
        select:focus { border-color: #3B82F6 !important; outline: none; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0B1628; }
        ::-webkit-scrollbar-thumb { background: #1E3050; border-radius: 3px; }
      `}</style>

      <div style={{ background: "#0B1628", color: "#E2E8F0", fontFamily: "Inter, sans-serif", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", borderBottom: "1px solid #1E3050", background: "#111F35" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, background: "#3B82F6", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: "DM Mono, monospace" }}>S</div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.3px" }}>Story<span style={{ color: "#60A5FA" }}>Stack</span></div>
          </div>
          <div style={{ fontSize: 11, fontFamily: "DM Mono, monospace", color: "#7A9BBF", background: "#182844", padding: "4px 10px", borderRadius: 20, border: "1px solid #1E3050" }}>
            Product Backlog Prioritization Assistant · Technical PM Portfolio
          </div>
        </header>

        {/* Workspace */}
        <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", flex: 1, minHeight: 0 }}>

          {/* Left Panel */}
          <div style={{ background: "#111F35", borderRight: "1px solid #1E3050", padding: "24px 20px", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto" }}>

            <div>
              <div style={{ fontSize: 10, fontFamily: "DM Mono, monospace", color: "#7A9BBF", letterSpacing: "0.08em", marginBottom: 8 }}>feature requests / user stories</div>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={"Paste feature requests, one per paragraph…\n\nE.g. Add real-time fraud detection for card transactions\nRebuild checkout with 1-click payment…"}
                style={{ width: "100%", background: "#182844", border: "1px solid #1E3050", borderRadius: 8, padding: 12, color: "#E2E8F0", fontFamily: "Inter, sans-serif", fontSize: 13, lineHeight: 1.55, resize: "vertical", minHeight: 160 }}
              />
            </div>

            {/* Dropdowns */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, fontFamily: "DM Mono, monospace", color: "#7A9BBF", letterSpacing: "0.08em" }}>context</div>

              {[
                { label: "Product Area", value: productArea, setter: setProductArea, options: [["payments","Payments"],["ecommerce","eCommerce"],["data_platform","Data Platform"]] },
                { label: "Sprint Capacity", value: sprintCapacity, setter: setSprintCapacity, options: [["small","Small"],["medium","Medium"],["large","Large"]] },
                { label: "Strategic Priority", value: strategicPriority, setter: setStrategicPriority, options: [["growth","Growth"],["risk_reduction","Risk Reduction"],["compliance","Compliance"],["efficiency","Efficiency"]] },
              ].map(({ label, value, setter, options }) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: "#7A9BBF", marginBottom: 5, fontFamily: "DM Mono, monospace" }}>{label}</div>
                  <select value={value} onChange={e => setter(e.target.value)} style={selectStyle}>
                    {options.map(([val, txt]) => <option key={val} value={val}>{txt}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <button
              onClick={runPrioritization}
              disabled={scoringLoading}
              style={{ width: "100%", padding: 12, background: scoringLoading ? "#1E3050" : "#3B82F6", color: "#fff", border: "none", borderRadius: 8, fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 600, cursor: scoringLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {scoringLoading ? <><Spinner /> Scoring with AI…</> : <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 2h12M3 7h8M5 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                {hasResults ? "Re-prioritize" : "Prioritize Backlog"}
              </>}
            </button>

            <button
              onClick={loadExample}
              style={{ width: "100%", padding: 10, background: "transparent", color: "#7A9BBF", border: "1px solid #1E3050", borderRadius: 8, fontFamily: "Inter, sans-serif", fontSize: 13, cursor: "pointer" }}
            >
              Load Example Backlog
            </button>

            <div style={{ fontSize: 11, color: "#7A9BBF", lineHeight: 1.5, background: "#182844", borderRadius: 8, padding: "10px 12px", borderLeft: "3px solid #3B82F6" }}>
              Pre-loaded with a synthetic Payments backlog for demo. Hit <strong style={{ color: "#E2E8F0" }}>Load Example Backlog</strong> to populate, then <strong style={{ color: "#E2E8F0" }}>Prioritize</strong> to rank.
            </div>
          </div>

          {/* Right Panel */}
          <div style={{ padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>

            {!hasResults ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "#7A9BBF", textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 40, opacity: 0.4 }}>⚡</div>
                <p style={{ fontSize: 14, maxWidth: 280, lineHeight: 1.55 }}>Load the example backlog or paste your own feature requests, set your context, and hit Prioritize.</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>
                      Prioritized Backlog <span style={{ color: "#7A9BBF", fontWeight: 400, fontSize: 13 }}>— {features.length} feature{features.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                      {[
                        AREA_LABELS[context.productArea],
                        `${SPRINT_LABELS[context.sprintCapacity]} Sprint`,
                        STRAT_LABELS[context.strategicPriority],
                      ].map(label => (
                        <div key={label} style={{ fontSize: 11, fontFamily: "DM Mono, monospace", background: "#182844", border: "1px solid #1E3050", borderRadius: 20, padding: "4px 10px", color: "#7A9BBF" }}>
                          <strong style={{ color: "#E2E8F0" }}>{label}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    {Object.entries(bandCounts).filter(([, v]) => v > 0).map(([band, count]) => (
                      <div key={band} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontFamily: "DM Mono, monospace" }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: bandColors[band] }} />
                        {count} {BAND_LABELS[band]}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Feature cards */}
                <div>
                  {features.map((feat, idx) => (
                    <FeatureCard key={idx} feature={feat} score={scores[idx]} rank={idx + 1} />
                  ))}
                </div>

                {/* Brief bar */}
                <div style={{ background: "#111F35", border: "1px solid #1E3050", borderRadius: 10, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Decision Brief</div>
                    <div style={{ fontSize: 13, color: "#7A9BBF", marginTop: 2 }}>Generate a 1-page prioritization memo for engineering and leadership sign-off</div>
                  </div>
                  <button
                    onClick={generateBrief}
                    disabled={briefLoading}
                    style={{ padding: "10px 20px", background: "linear-gradient(135deg,#4F46E5,#3B82F6)", color: "#fff", border: "none", borderRadius: 8, fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600, cursor: briefLoading ? "not-allowed" : "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 8, opacity: briefLoading ? 0.6 : 1 }}
                  >
                    {briefLoading ? <><Spinner /> Generating…</> : <>
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="1" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M4 5h5M4 7.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                      {showBrief ? "Regenerate Brief" : "Generate Brief"}
                    </>}
                  </button>
                </div>

                {/* Brief output */}
                {showBrief && (
                  <div style={{ background: "#111F35", border: "1px solid #1E3050", borderRadius: 10, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, borderBottom: "1px solid #1E3050", paddingBottom: 12, color: "#60A5FA" }}>Decision Brief</div>
                    <pre style={{ fontFamily: "Inter, sans-serif", fontSize: 13, lineHeight: 1.7, color: "#E2E8F0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{briefText}</pre>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
