import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════
// source.scent v0.3
// 4 languages × (3+3+3+2) channels + 1 CODE SMELL channel = 12
// SensoryLab 12ch · MQTT/BLE
// ═══════════════════════════════════════════════════════════════

const LANGS = {
  python: {
    name: "Python", year: 1991, ext: ".py", author: "van Rossum, 1991",
    philosophy: "Beautiful is better than ugly. Explicit is better than implicit.",
    color: "#4EC9B0", dim: "#4EC9B011",
    channels: [
      { id: 1, scent: "Зелёный чай", note: "верхняя", icon: "🍃", base: 75 },
      { id: 2, scent: "Бергамот", note: "сердечная", icon: "🍊", base: 60 },
      { id: 3, scent: "Белый мускус", note: "базовая", icon: "◯", base: 45 },
    ],
    sample: `# The Zen of Python
import this

def fibonacci(n):
    """Beautiful is better than ugly."""
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b

# Simple is better than complex
for num in fibonacci(21):
    print(num)`,
    comment: "#",
    blockPairs: [],
    keywords: { branch: ["if", "elif", "else"], loop: ["for", "while"], err: ["except", "finally"] },
  },
  ada: {
    name: "Ada", year: 1983, ext: ".adb", author: "Ichbiah / DoD, 1983",
    philosophy: "Named after Ada Lovelace. Reliability is not negotiable.",
    color: "#D4A44C", dim: "#D4A44C11",
    channels: [
      { id: 4, scent: "Кордит", note: "верхняя", icon: "💥", base: 80 },
      { id: 5, scent: "Кожа", note: "сердечная", icon: "🛡", base: 70 },
      { id: 6, scent: "Порох", note: "базовая", icon: "🎖", base: 65 },
    ],
    comment: "--",
    blockPairs: [["begin", "end"], ["is", "end"], ["loop", "end loop"], ["if", "end if"]],
    keywords: { branch: ["if", "elsif", "else", "case", "when"], loop: ["loop", "while", "for"], err: ["exception", "raise"] },
  },
  cobol: {
    name: "COBOL", year: 1959, ext: ".cbl", author: "Grace Hopper, 1959",
    philosophy: "Still runs 95% of ATM transactions worldwide.",
    color: "#A0826D", dim: "#A0826D11",
    channels: [
      { id: 7, scent: "Старая бумага", note: "верхняя", icon: "📜", base: 60 },
      { id: 8, scent: "Чернила", note: "сердечная", icon: "🖋", base: 70 },
      { id: 9, scent: "Картон", note: "базовая", icon: "📦", base: 80 },
    ],
    comment: "*",
    blockPairs: [["PROCEDURE DIVISION", "STOP RUN"], ["PERFORM", "."]],
    keywords: { branch: ["IF", "ELSE", "EVALUATE", "WHEN"], loop: ["PERFORM", "UNTIL", "VARYING"], err: ["ON EXCEPTION", "NOT ON EXCEPTION"] },
  },
  javascript: {
    name: "JavaScript", year: 1995, ext: ".js", author: "Brendan Eich, 1995",
    philosophy: "Designed in 10 days. typeof null === 'object'. NaN !== NaN.",
    color: "#F0DB4F", dim: "#F0DB4F11",
    channels: [
      { id: 10, scent: "Ваниль", note: "верхняя", icon: "🍦", base: 80 },
      { id: 11, scent: "Жжёная резина", note: "базовая", icon: "🔥", base: 70 },
    ],
    comment: "//",
    blockPairs: [["{", "}"]],
    keywords: { branch: ["if", "else", "switch", "case", "\\?"], loop: ["for", "while", "do"], err: ["catch", "finally"] },
  },
};

const SMELL_CHANNEL = { id: 12, scent: "Горелый пластик", icon: "☠", color: "#E04040" };

// ── Code Analyzer ──────────────────────────────────────────
function analyzeCode(code, lang) {
  if (!code.trim()) return { modulation: { air: 0, complexity: 0, mass: 0 }, smellScore: 0, smells: [], metrics: {} };

  const allLines = code.split("\n");
  const lines = allLines.filter((l) => l.trim().length > 0);
  const total = lines.length;
  if (total === 0) return { modulation: { air: 0, complexity: 0, mass: 0 }, smellScore: 0, smells: [], metrics: {} };

  // ── Modulation metrics ──
  const cc = lang.comment;
  const commentLines = lines.filter((l) => l.trim().startsWith(cc)).length;
  const emptyLines = allLines.filter((l) => l.trim().length === 0).length;
  const airRatio = (commentLines + emptyLines) / Math.max(allLines.length, 1);

  const depths = lines.map((l) => { const m = l.match(/^(\s+)/); return m ? Math.floor(m[1].replace(/\t/g, "    ").length / 2) : 0; });
  const maxDepth = Math.max(...depths, 0);
  const kw = lang.keywords;
  const branchCount = lines.filter((l) => kw.branch.some((k) => new RegExp("\\b" + k + "\\b", "i").test(l))).length;
  const loopCount = lines.filter((l) => kw.loop.some((k) => new RegExp("\\b" + k + "\\b", "i").test(l))).length;
  const complexityRaw = (maxDepth / 8) * 0.4 + (branchCount / Math.max(total, 1)) * 0.3 + (loopCount / Math.max(total, 1)) * 0.3;

  const massNorm = Math.min(total / 60, 1);

  const air = Math.round(airRatio * 100);
  const complexity = Math.round(Math.min(complexityRaw, 1) * 100);
  const mass = Math.round(massNorm * 100);

  // ── Smell detection ──
  const smells = [];
  let smellScore = 0;

  // 1. JS syntax check
  if (lang.name === "JavaScript") {
    try { new Function(code); } catch (e) {
      smells.push({ text: `Синтаксическая ошибка: ${e.message.slice(0, 60)}`, weight: 30 });
      smellScore += 30;
    }
  }

  // 2. Unmatched brackets / parens / quotes
  const opens = { "(": 0, "[": 0, "{": 0 };
  const closes = { ")": "(", "]": "[", "}": "{" };
  let singleQ = 0, doubleQ = 0, backtick = 0;
  for (const ch of code) {
    if (ch in opens) opens[ch]++;
    if (ch in closes) opens[closes[ch]]--;
    if (ch === "'" && lang.name !== "COBOL") singleQ++;
    if (ch === '"') doubleQ++;
    if (ch === '`') backtick++;
  }
  const unmatched = Object.entries(opens).filter(([, v]) => v !== 0);
  if (unmatched.length > 0) {
    smells.push({ text: `Несбалансированные скобки: ${unmatched.map(([k, v]) => `${k}${v > 0 ? "+" : ""}${v}`).join(", ")}`, weight: 25 });
    smellScore += 25;
  }
  if (doubleQ % 2 !== 0) { smells.push({ text: "Незакрытая строковая кавычка \"", weight: 20 }); smellScore += 20; }
  if (singleQ % 2 !== 0 && lang.name !== "COBOL") { smells.push({ text: "Незакрытая кавычка '", weight: 20 }); smellScore += 20; }

  // 3. Long lines
  const longLines = lines.filter((l) => l.length > 120).length;
  if (longLines > 0) { smells.push({ text: `${longLines} строк длиннее 120 символов`, weight: longLines * 3 }); smellScore += longLines * 3; }

  // 4. Deep nesting
  const deepLines = depths.filter((d) => d > 4).length;
  if (deepLines > 0) { smells.push({ text: `Глубокая вложенность (>4): ${deepLines} строк, макс ${maxDepth}`, weight: deepLines * 4 }); smellScore += deepLines * 4; }

  // 5. Magic numbers
  const magicNums = code.match(/(?<![a-zA-Z_\d.])\d{2,}(?!\d*[.eE]\d)(?![a-zA-Z_])/g) || [];
  const realMagic = magicNums.filter((n) => !["00", "10", "100", "1000", "255", "256", "1024"].includes(n));
  if (realMagic.length > 2) { smells.push({ text: `Магические числа: ${realMagic.slice(0, 5).join(", ")}${realMagic.length > 5 ? "..." : ""}`, weight: realMagic.length * 2 }); smellScore += realMagic.length * 2; }

  // 6. Empty catch/except
  const emptyErrPattern = lang.name === "JavaScript"
    ? /catch\s*\([^)]*\)\s*\{\s*\}/g
    : lang.name === "Python"
      ? /except.*:\s*\n\s*(pass|\.\.\.)\s*$/gm
      : null;
  if (emptyErrPattern) {
    const emptyHandlers = (code.match(emptyErrPattern) || []).length;
    if (emptyHandlers > 0) { smells.push({ text: `Пустые обработчики ошибок: ${emptyHandlers}`, weight: emptyHandlers * 10 }); smellScore += emptyHandlers * 10; }
  }

  // 7. Duplicate consecutive lines
  let dupeCount = 0;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === lines[i - 1].trim() && lines[i].trim().length > 5) dupeCount++;
  }
  if (dupeCount > 2) { smells.push({ text: `Дублированные строки: ${dupeCount}`, weight: dupeCount * 4 }); smellScore += dupeCount * 4; }

  // 8. goto
  if (/\bgoto\b/i.test(code)) { smells.push({ text: "goto обнаружен", weight: 15 }); smellScore += 15; }

  // 9. Console/print spam
  const printPattern = lang.name === "JavaScript" ? /console\.(log|warn|error)/g : lang.name === "Python" ? /\bprint\s*\(/g : null;
  if (printPattern) {
    const prints = (code.match(printPattern) || []).length;
    if (prints > 5) { smells.push({ text: `Избыток отладочного вывода: ${prints}`, weight: Math.min(prints * 2, 15) }); smellScore += Math.min(prints * 2, 15); }
  }

  // 10. No comments at all
  if (commentLines === 0 && total > 10) { smells.push({ text: "Ни одного комментария", weight: 8 }); smellScore += 8; }

  smellScore = Math.min(smellScore, 95);

  return {
    modulation: { air, complexity, mass },
    smellScore,
    smells,
    metrics: { lines: total, comments: commentLines, emptyLines, maxDepth, branches: branchCount, loops: loopCount },
  };
}

function computeChannelValues(lang, analysis) {
  if (!analysis) return lang.channels.map((c) => ({ id: c.id, value: c.base }));

  const { air, complexity, mass } = analysis.modulation;

  return lang.channels.map((c, i) => {
    let val = c.base;
    const noteType = c.note;

    // Air → top note up, base note down
    if (noteType === "верхняя") val += (air / 100) * 20;
    if (noteType === "базовая") val -= (air / 100) * 10;

    // Complexity → heart up (or base for 2-channel JS)
    if (noteType === "сердечная") val += (complexity / 100) * 20;
    if (lang.channels.length === 2 && i === 1) val += (complexity / 100) * 15;

    // Mass → base up
    if (noteType === "базовая") val += (mass / 100) * 20;
    if (lang.channels.length === 2 && i === 1) val += (mass / 100) * 10;

    return { id: c.id, value: Math.round(Math.max(5, Math.min(95, val))) };
  });
}

function buildMqtt(channels) { return channels.map((c) => `CH${c.id}:${c.value}`).join(";"); }

// ── Vertical Slider ────────────────────────────────────────
function VSlider({ value, onChange, color, label, icon, note, disabled, glow }) {
  const ref = useRef(null);
  const drag = useRef(false);
  const calc = useCallback((e) => {
    if (!ref.current || disabled) return;
    const r = ref.current.getBoundingClientRect();
    const y = (e.touches ? e.touches[0].clientY : e.clientY);
    onChange(Math.max(0, Math.min(100, Math.round(100 - ((y - r.top) / r.height) * 100))));
  }, [onChange, disabled]);

  useEffect(() => {
    const mv = (e) => { if (drag.current) { e.preventDefault(); calc(e); } };
    const up = () => { drag.current = false; };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", mv, { passive: false }); window.addEventListener("touchend", up);
    return () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); window.removeEventListener("touchmove", mv); window.removeEventListener("touchend", up); };
  }, [calc]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", minWidth: "58px", opacity: disabled ? 0.25 : 1 }}>
      <span style={{ fontSize: "16px" }}>{icon}</span>
      <div ref={ref} onMouseDown={(e) => { drag.current = true; calc(e); }} onTouchStart={(e) => { drag.current = true; calc(e); }}
        style={{ width: "26px", height: "120px", background: "#0d0d0d", borderRadius: "13px", position: "relative", cursor: disabled ? "not-allowed" : "ns-resize", border: `1px solid ${value > 0 ? color + "33" : "#151515"}`, touchAction: "none", transition: "border-color .3s" }}>
        <div style={{ position: "absolute", bottom: "3px", left: "3px", right: "3px", height: `calc(${value}% - 6px)`, minHeight: 0, background: `linear-gradient(to top, ${color}18, ${color}88)`, borderRadius: "11px", transition: drag.current ? "none" : "height .35s ease" }} />
        <div style={{ position: "absolute", left: "50%", bottom: `calc(${value}% - 10px)`, transform: "translateX(-50%)", width: "20px", height: "20px", borderRadius: "50%", background: `radial-gradient(circle at 35% 35%, ${color}, ${color}66)`, border: "2px solid #070707", boxShadow: glow && value > 0 ? `0 0 12px ${color}55` : "none", transition: drag.current ? "none" : "bottom .35s ease, box-shadow .4s" }} />
      </div>
      <span style={{ fontFamily: "var(--mono)", fontSize: "13px", fontWeight: 600, color: value > 0 ? color : "#2a2a2a", minWidth: "28px", textAlign: "center", fontVariantNumeric: "tabular-nums", transition: "color .3s" }}>{value}</span>
      <span style={{ fontFamily: "var(--mono)", fontSize: "7.5px", color: "#555", textAlign: "center", lineHeight: "1.3", maxWidth: "58px" }}>{label}</span>
      {note && <span style={{ fontFamily: "var(--serif)", fontSize: "8px", fontStyle: "italic", color: "#333" }}>{note}</span>}
    </div>
  );
}

// ── Smell List Item ────────────────────────────────────────
function SmellItem({ text, weight }) {
  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "baseline", padding: "3px 0" }}>
      <span style={{ fontFamily: "var(--mono)", fontSize: "9px", color: SMELL_CHANNEL.color, minWidth: "28px", textAlign: "right" }}>+{weight}%</span>
      <span style={{ fontFamily: "var(--mono)", fontSize: "9px", color: "#666", lineHeight: "1.4" }}>{text}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [sel, setSel] = useState(null);
  const [mode, setMode] = useState("sample");
  const [custom, setCustom] = useState("");
  const [overrides, setOverrides] = useState({});
  const [isDiffusing, setIsDiffusing] = useState(false);
  const [mqtt, setMqtt] = useState({ host: "192.168.1.100", port: "1883", topic: "sensorylab/ctrl", connected: false });
  const [showCfg, setShowCfg] = useState(false);

  const lang = sel ? LANGS[sel] : null;
  const code = mode === "custom" && custom.trim() ? custom : lang?.sample || "";
  const analysis = useMemo(() => lang && code.trim() ? analyzeCode(code, lang) : null, [code, sel, mode]);

  const computed = useMemo(() => {
    if (!lang || !analysis) return [];
    return computeChannelValues(lang, analysis);
  }, [lang, analysis]);

  const getVal = (chId) => overrides[chId] !== undefined ? overrides[chId] : (computed.find((c) => c.id === chId)?.value || 0);
  const smellVal = overrides[12] !== undefined ? overrides[12] : (analysis?.smellScore || 0);

  const allChannels = useMemo(() => {
    if (!lang) return [];
    const chs = lang.channels.map((c) => ({ id: c.id, value: getVal(c.id) }));
    chs.push({ id: 12, value: smellVal });
    return chs;
  }, [lang, computed, overrides, smellVal]);

  const mqttCmd = useMemo(() => allChannels.length ? buildMqtt(allChannels) : "", [allChannels]);

  useEffect(() => {
    if (isDiffusing && mqttCmd) console.log("MQTT →", mqtt.topic, mqttCmd);
  }, [mqttCmd, isDiffusing]);

  const handleDiffuse = () => {
    if (!lang) return;
    if (isDiffusing) { setIsDiffusing(false); setOverrides({}); }
    else setIsDiffusing(true);
  };

  const selectLang = (k) => {
    setIsDiffusing(false); setOverrides({}); setCustom(""); setMode("sample");
    setSel(sel === k ? null : k);
  };

  const M = "var(--mono)";
  const S = "var(--serif)";

  return (
    <div style={{ "--mono": "'JetBrains Mono',ui-monospace,'Fira Code',monospace", "--serif": "'Cormorant Garamond','Georgia',serif", minHeight: "100vh", background: "#050505", color: "#ddd", fontFamily: "var(--serif)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap');
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glowBtn{0%,100%{box-shadow:0 0 10px var(--gc,transparent)}50%{box-shadow:0 0 25px var(--gc,transparent)}}
        @keyframes rise{0%{opacity:0;transform:translateY(0)}12%{opacity:.4}100%{opacity:0;transform:translateY(-60px) scale(.1)}}
        *{box-sizing:border-box;margin:0}
        ::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:2px}
        textarea:focus,input:focus{outline:none}
      `}</style>

      {/* ═══ HEADER ═══ */}
      <header style={{ padding: "16px 16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontFamily: S, fontSize: "22px", fontWeight: 300, letterSpacing: "3px", color: lang ? lang.color : "#3a3a3a", transition: "color .5s" }}>source.scent</h1>
          <p style={{ fontFamily: M, fontSize: "7px", color: "#222", letterSpacing: "2.5px" }}>CODE → AROMA · SENSORYLAB 12CH</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "12px", background: isDiffusing ? (lang?.color || "#555") + "0e" : "#0a0a0a", border: `1px solid ${isDiffusing ? (lang?.color || "#555") + "40" : "#151515"}`, transition: "all .4s" }}>
            <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: isDiffusing ? lang?.color : mqtt.connected ? "#3a7a3a" : "#3a3a3a", animation: isDiffusing ? "pulse 1.4s infinite" : "none" }} />
            <span style={{ fontFamily: M, fontSize: "8px", color: isDiffusing ? lang?.color : "#333", letterSpacing: "1px" }}>{isDiffusing ? "DIFF" : mqtt.connected ? "READY" : "STBY"}</span>
          </div>
          <button onClick={() => setShowCfg(!showCfg)} style={{ background: "none", border: "1px solid #181818", borderRadius: "50%", width: "26px", height: "26px", color: "#333", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center" }}>⚙</button>
        </div>
      </header>

      {/* MQTT cfg */}
      {showCfg && (
        <div style={{ margin: "10px 16px", padding: "10px", background: "#090909", border: "1px solid #141414", borderRadius: "6px", animation: "fadeIn .25s" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
            {[{ l: "Host", k: "host", w: "140px" }, { l: "Port", k: "port", w: "55px" }, { l: "Topic", k: "topic", w: "155px" }].map((f) => (
              <div key={f.k}>
                <div style={{ fontFamily: M, fontSize: "7px", color: "#2a2a2a", marginBottom: "2px" }}>{f.l}</div>
                <input value={mqtt[f.k]} onChange={(e) => setMqtt({ ...mqtt, [f.k]: e.target.value })} style={{ background: "#0c0c0c", border: "1px solid #181818", borderRadius: "3px", padding: "3px 6px", color: "#555", fontFamily: M, fontSize: "10px", width: f.w }} />
              </div>
            ))}
            <button onClick={() => setMqtt({ ...mqtt, connected: !mqtt.connected })} style={{ background: mqtt.connected ? "#0a1a0a" : "#0c0c0c", border: `1px solid ${mqtt.connected ? "#1a3a1a" : "#1a1a1a"}`, borderRadius: "3px", padding: "3px 10px", color: mqtt.connected ? "#4a9a7a" : "#555", fontFamily: M, fontSize: "9px", cursor: "pointer" }}>
              {mqtt.connected ? "✓" : "CONNECT"}
            </button>
          </div>
        </div>
      )}

      {/* ═══ LANGUAGE CARDS ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", padding: "12px 16px" }}>
        {Object.entries(LANGS).map(([k, l]) => {
          const on = sel === k;
          return (
            <button key={k} onClick={() => selectLang(k)} style={{ background: on ? l.dim : "#080808", border: `1px solid ${on ? l.color + "44" : "#111"}`, borderRadius: "7px", padding: "9px 7px", cursor: "pointer", textAlign: "left", transition: "all .3s", position: "relative", overflow: "hidden" }}>
              {on && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: l.color }} />}
              <div style={{ fontFamily: M, fontSize: "12px", fontWeight: 500, color: on ? l.color : "#3a3a3a", transition: "color .3s", letterSpacing: ".5px" }}>{l.name}</div>
              <div style={{ fontFamily: M, fontSize: "7px", color: "#222", marginTop: "1px" }}>{l.year} · {l.channels.length}ch</div>
              <div style={{ display: "flex", gap: "2px", marginTop: "4px" }}>
                {l.channels.map((c) => <span key={c.id} style={{ fontSize: "9px", opacity: on ? 1 : .25, transition: "opacity .3s" }}>{c.icon}</span>)}
              </div>
            </button>
          );
        })}
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      {lang && (
        <div style={{ padding: "0 16px 60px", animation: "fadeIn .35s" }}>
          {/* Info line */}
          <div style={{ display: "flex", gap: "8px", alignItems: "baseline", marginBottom: "10px", flexWrap: "wrap" }}>
            <span style={{ fontFamily: S, fontSize: "13px", fontWeight: 300, fontStyle: "italic", color: "#4a4a4a" }}>{lang.philosophy}</span>
            <span style={{ fontFamily: M, fontSize: "7px", color: "#222" }}>{lang.author}</span>
          </div>

          {/* Mode toggle */}
          <div style={{ display: "flex", marginBottom: "10px" }}>
            {[{ k: "sample", l: `${lang.ext} sample` }, { k: "custom", l: "свой код ✎" }].map((m) => (
              <button key={m.k} onClick={() => { setMode(m.k); setOverrides({}); }} style={{ background: mode === m.k ? lang.color + "10" : "#080808", border: `1px solid ${mode === m.k ? lang.color + "35" : "#131313"}`, borderRadius: m.k === "sample" ? "4px 0 0 4px" : "0 4px 4px 0", padding: "5px 13px", cursor: "pointer", fontFamily: M, fontSize: "9px", color: mode === m.k ? lang.color : "#3a3a3a", transition: "all .3s" }}>{m.l}</button>
            ))}
          </div>

          {/* ═══ GRID: CODE + MIXER ═══ */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "12px" }}>

            {/* ── LEFT: Code + Metrics + Smells ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: 0 }}>
              {mode === "sample" ? (
                <pre style={{ background: "#080808", border: `1px solid ${lang.color}12`, borderRadius: "6px", padding: "11px", fontFamily: M, fontSize: "10px", lineHeight: "1.6", color: "#5a5a5a", overflowX: "auto", overflowY: "auto", maxHeight: "240px", margin: 0, position: "relative" }}>
                  <span style={{ position: "absolute", top: "4px", right: "8px", fontSize: "7px", color: lang.color + "33", letterSpacing: "1.5px" }}>{lang.ext}</span>
                  {lang.sample}
                </pre>
              ) : (
                <div style={{ position: "relative" }}>
                  <textarea value={custom} onChange={(e) => { setCustom(e.target.value); setOverrides({}); }} placeholder={`// Вставьте ${lang.name} код\n// Метрики и рецептура обновляются\n// в реальном времени`} spellCheck={false}
                    style={{ width: "100%", minHeight: "240px", resize: "vertical", background: "#080808", border: `1px solid ${lang.color}18`, borderRadius: "6px", padding: "11px", fontFamily: M, fontSize: "10px", lineHeight: "1.6", color: "#777", whiteSpace: "pre", tabSize: 4 }} />
                  {custom.trim() && <span style={{ position: "absolute", top: "4px", right: "8px", fontFamily: M, fontSize: "7px", color: lang.color + "44" }}>{custom.split("\n").filter((l) => l.trim()).length} lines</span>}
                </div>
              )}

              {/* Modulation Metrics */}
              {analysis && (
                <div style={{ animation: "fadeIn .25s" }}>
                  <div style={{ fontFamily: M, fontSize: "7px", color: "#222", letterSpacing: "2px", marginBottom: "5px" }}>МЕТРИКИ → МОДУЛЯЦИЯ ±20%</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
                    {[
                      { label: "«Воздух»", sub: "комменты + пустые строки → верхняя ↑", val: analysis.modulation.air, detail: `${analysis.metrics.comments} комм · ${analysis.metrics.emptyLines} пустых` },
                      { label: "«Сложность»", sub: "вложенность + ветвления → сердечная ↑", val: analysis.modulation.complexity, detail: `глуб ${analysis.metrics.maxDepth} · ${analysis.metrics.branches} ветвл · ${analysis.metrics.loops} цикл` },
                      { label: "«Масса»", sub: "количество строк → базовая ↑", val: analysis.modulation.mass, detail: `${analysis.metrics.lines} строк` },
                    ].map((m) => (
                      <div key={m.label} style={{ padding: "7px", background: "#080808", borderRadius: "5px", border: "1px solid #111" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <span style={{ fontFamily: M, fontSize: "9px", color: "#666" }}>{m.label}</span>
                          <span style={{ fontFamily: M, fontSize: "13px", fontWeight: 600, color: lang.color }}>{m.val}%</span>
                        </div>
                        <div style={{ fontFamily: M, fontSize: "7px", color: "#333", marginTop: "3px" }}>{m.sub}</div>
                        <div style={{ fontFamily: M, fontSize: "7px", color: "#2a2a2a", marginTop: "2px" }}>{m.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Smell Report */}
              {analysis && analysis.smells.length > 0 && (
                <div style={{ animation: "fadeIn .25s", background: "#0a0606", border: `1px solid ${SMELL_CHANNEL.color}22`, borderRadius: "5px", padding: "8px" }}>
                  <div style={{ fontFamily: M, fontSize: "7px", color: SMELL_CHANNEL.color + "88", letterSpacing: "2px", marginBottom: "4px" }}>☠ CODE SMELL DETECTED — CH12: {analysis.smellScore}%</div>
                  {analysis.smells.map((s, i) => <SmellItem key={i} text={s.text} weight={s.weight} />)}
                </div>
              )}
              {analysis && analysis.smells.length === 0 && (
                <div style={{ fontFamily: M, fontSize: "8px", color: "#1a3a1a", padding: "6px 8px", background: "#060a06", borderRadius: "4px", border: "1px solid #0a1a0a" }}>
                  ✓ Код чист. Канал 12 молчит.
                </div>
              )}
            </div>

            {/* ── RIGHT: Mixer ── */}
            <div style={{ background: "#080808", border: `1px solid ${lang.color}12`, borderRadius: "7px", padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ fontFamily: M, fontSize: "7px", color: "#2a2a2a", letterSpacing: "2px", textAlign: "center" }}>OLFACTORY MIXER — {lang.name.toUpperCase()}</div>

              {/* Language channel sliders */}
              <div style={{ display: "flex", justifyContent: "center", gap: "8px", position: "relative" }}>
                {isDiffusing && <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>{Array.from({ length: 8 }).map((_, i) => <div key={i} style={{ position: "absolute", bottom: 0, left: `${8 + Math.random() * 84}%`, width: "3px", height: "3px", borderRadius: "50%", background: lang.color, opacity: 0, animation: `rise 2s ease-out ${i * .3}s infinite`, filter: "blur(1px)" }} />)}</div>}
                {lang.channels.map((ch) => (
                  <VSlider key={ch.id} value={getVal(ch.id)} onChange={(v) => setOverrides((p) => ({ ...p, [ch.id]: v }))} color={lang.color} label={ch.scent} icon={ch.icon} note={ch.note} glow={isDiffusing} />
                ))}
                {/* Divider */}
                <div style={{ width: "1px", background: "#1a1a1a", margin: "20px 2px", alignSelf: "stretch" }} />
                {/* Smell channel */}
                <VSlider value={smellVal} onChange={(v) => setOverrides((p) => ({ ...p, 12: v }))} color={SMELL_CHANNEL.color} label={SMELL_CHANNEL.scent} icon={SMELL_CHANNEL.icon} note="ошибка" glow={isDiffusing && smellVal > 20} />
              </div>

              {/* Recipe summary */}
              {analysis && (
                <div style={{ fontFamily: M, fontSize: "8px", color: "#333", textAlign: "center", lineHeight: "1.5" }}>
                  {lang.channels.map((c) => <span key={c.id}>{c.scent} <span style={{ color: lang.color }}>{getVal(c.id)}</span> · </span>)}
                  <span>{SMELL_CHANNEL.scent} <span style={{ color: smellVal > 0 ? SMELL_CHANNEL.color : "#222" }}>{smellVal}</span></span>
                </div>
              )}

              {/* Diffuse */}
              <button onClick={handleDiffuse} style={{ background: isDiffusing ? lang.color + "12" : "#0c0c0c", border: `2px solid ${isDiffusing ? lang.color : "#2a2a2a"}`, borderRadius: "7px", padding: "13px", cursor: "pointer", fontFamily: M, fontSize: "12px", fontWeight: 500, color: isDiffusing ? lang.color : "#555", letterSpacing: "4px", transition: "all .4s", "--gc": isDiffusing ? lang.color + "40" : "transparent", animation: isDiffusing ? "glowBtn 2s infinite" : "none" }}>
                {isDiffusing ? "■ STOP" : "▶ DIFFUSE"}
              </button>

              {/* MQTT readout */}
              <div style={{ fontFamily: M, fontSize: "7.5px", color: "#1a1a1a", textAlign: "center", padding: "5px", background: "#060606", borderRadius: "3px", wordBreak: "break-all", lineHeight: "1.4" }}>
                {isDiffusing ? mqttCmd : `mqtt://${mqtt.host}:${mqtt.port}/${mqtt.topic}`}
              </div>
            </div>
          </div>

          {/* ═══ 12-CHANNEL BAR ═══ */}
          <div style={{ marginTop: "12px" }}>
            <div style={{ fontFamily: M, fontSize: "6.5px", color: "#181818", letterSpacing: "2px", marginBottom: "3px" }}>ALL 12 CHANNELS</div>
            <div style={{ display: "flex", gap: "2px" }}>
              {Array.from({ length: 12 }, (_, i) => {
                const id = i + 1;
                let val = 0, col = "#1a1a1a", isActive = false;
                if (id === 12) { val = smellVal; col = SMELL_CHANNEL.color; isActive = true; }
                else {
                  Object.values(LANGS).forEach((l) => l.channels.forEach((c) => { if (c.id === id) { col = l.color; if (sel && l === LANGS[sel]) { val = getVal(id); isActive = true; } } }));
                }
                return (
                  <div key={id} style={{ flex: 1, height: "26px", background: "#070707", borderRadius: "2px", position: "relative", overflow: "hidden", border: `1px solid ${isActive ? col + "28" : "#0a0a0a"}`, transition: "border-color .3s" }}>
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${val}%`, background: `${col}${isActive ? "55" : "15"}`, transition: "height .3s" }} />
                    <span style={{ position: "absolute", bottom: "1px", width: "100%", textAlign: "center", fontFamily: M, fontSize: "6px", color: isActive ? col + "aa" : "#151515" }}>{id}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ EMPTY STATE ═══ */}
      {!lang && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "44px 16px", animation: "fadeIn .5s" }}>
          <p style={{ fontFamily: S, fontSize: "16px", fontWeight: 300, color: "#252525", fontStyle: "italic", textAlign: "center", lineHeight: "1.9" }}>
            Выберите язык программирования,<br />чтобы почувствовать его аромат
          </p>
          <p style={{ fontFamily: M, fontSize: "7px", color: "#131313", letterSpacing: "4px", marginTop: "12px" }}>PYTHON · ADA · COBOL · JAVASCRIPT</p>
          <div style={{ display: "flex", gap: "2px", marginTop: "28px" }}>{Array.from({ length: 12 }, (_, i) => <div key={i} style={{ width: "18px", height: "2px", background: i === 11 ? "#1a0808" : "#0d0d0d", borderRadius: "1px" }} />)}</div>
        </div>
      )}
    </div>
  );
}
