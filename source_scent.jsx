import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════
// source.scent v0.4
// 3 languages · 6 channels · SensoryLab 6ch
// Python(2) + FORTRAN I(1) + CODE SMELL(1) + COBOL(2)
// ═══════════════════════════════════════════════════════════════

const LANGS = {
  python: {
    name: "Python", year: 1991, ext: ".py", status: "живой",
    author: "Guido van Rossum, CWI Amsterdam",
    philosophy: "Beautiful is better than ugly. Simple is better than complex.",
    color: "#4EC9B0", dim: "#4EC9B011",
    channels: [
      { id: 1, scent: "Зелёный чай", code: "MA/1439", note: "верхняя", icon: "🍃", base: 75, env: "Zen of Python" },
      { id: 2, scent: "Капучино", code: "MA/1308", note: "базовая", icon: "☕", base: 55, env: "коворкинг" },
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
    keywords: { branch: ["if", "elif", "else"], loop: ["for", "while"], err: ["except", "finally"] },
  },
  fortran: {
    name: "FORTRAN I", year: 1957, ext: ".f", status: "мёртв",
    author: "John Backus, IBM · для IBM 704",
    philosophy: "Ни компилятора, ни машины. Язык-призрак, чей синтаксис живёт в потомках.",
    color: "#8B7355", dim: "#8B735511",
    channels: [
      { id: 3, scent: "Сосна (канифоль)", code: "MP822/W2", note: "базовая", icon: "🔥", base: 70, env: "машинный зал ЭВМ" },
    ],
    sample: `C     FORTRAN I — IBM 704 (1957)
C     COMPUTE FIBONACCI SEQUENCE
C     FIXED FORMAT: COLS 7-72
      DIMENSION IFIB(21)
      IFIB(1) = 0
      IFIB(2) = 1
      DO 10 I = 3, 21
        IFIB(I) = IFIB(I-1) + IFIB(I-2)
   10 CONTINUE
      DO 20 I = 1, 21
        WRITE(6,100) I, IFIB(I)
  100   FORMAT(1X,I3,5X,I10)
   20 CONTINUE
      STOP
      END`,
    comment: "C",
    keywords: { branch: ["IF", "ELSE", "THEN"], loop: ["DO", "CONTINUE"], err: [] },
  },
  cobol: {
    name: "COBOL", year: 1959, ext: ".cbl", status: "зомби",
    author: "Grace Hopper / CODASYL · Пентагон",
    philosophy: "Язык, который никто не пишет, но невозможно выключить. 95% банкоматов.",
    color: "#A0826D", dim: "#A0826D11",
    channels: [
      { id: 5, scent: "Табак + кофе", code: "MA/1547+MA/1149", note: "верхняя", icon: "🚬", base: 65, env: "торговый зал" },
      { id: 6, scent: "[в подборе]", code: "TBD", note: "базовая", icon: "🏛", base: 60, env: "кабинет" },
    ],
    sample: `       IDENTIFICATION DIVISION.
       PROGRAM-ID. FIBONACCI.
       AUTHOR. GRACE HOPPER.
      *    COBOL — CODASYL, 1959
      *    STILL RUNS 95% OF ATM TRANSACTIONS
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  WS-N        PIC 9(2) VALUE 21.
       01  WS-FIRST    PIC 9(10) VALUE 0.
       01  WS-SECOND   PIC 9(10) VALUE 1.
       01  WS-NEXT     PIC 9(10) VALUE 0.
       01  WS-COUNT    PIC 9(2) VALUE 0.
       PROCEDURE DIVISION.
           PERFORM VARYING WS-COUNT FROM 1
               BY 1 UNTIL WS-COUNT > WS-N
               DISPLAY WS-FIRST
               ADD WS-FIRST TO WS-SECOND
                   GIVING WS-NEXT
               MOVE WS-SECOND TO WS-FIRST
               MOVE WS-NEXT TO WS-SECOND
           END-PERFORM.
           STOP RUN.`,
    comment: "*",
    keywords: { branch: ["IF", "ELSE", "EVALUATE", "WHEN"], loop: ["PERFORM", "UNTIL", "VARYING"], err: ["ON EXCEPTION", "NOT ON EXCEPTION"] },
  },
};

const SMELL_CHANNEL = { id: 4, scent: "Дегтярный", code: "MM2435/16", icon: "☠", color: "#E04040", env: "сгоревшая плата" };

// ── Code Analyzer ──────────────────────────────────────────
function analyzeCode(code, lang) {
  if (!code.trim()) return { modulation: { air: 0, complexity: 0, mass: 0 }, smellScore: 0, smells: [], metrics: {} };
  const allLines = code.split("\n");
  const lines = allLines.filter((l) => l.trim().length > 0);
  const total = lines.length;
  if (total === 0) return { modulation: { air: 0, complexity: 0, mass: 0 }, smellScore: 0, smells: [], metrics: {} };

  const cc = lang.comment;
  const commentLines = lines.filter((l) => {
    const t = l.trim();
    if (cc === "C") return /^[Cc*]/.test(t);
    if (cc === "*") return t.length > 6 && t[6] === "*";
    return t.startsWith(cc);
  }).length;
  const emptyLines = allLines.filter((l) => l.trim().length === 0).length;
  const airRatio = (commentLines + emptyLines) / Math.max(allLines.length, 1);
  const depths = lines.map((l) => { const m = l.match(/^(\s+)/); return m ? Math.floor(m[1].replace(/\t/g, "    ").length / 2) : 0; });
  const maxDepth = Math.max(...depths, 0);
  const kw = lang.keywords;
  const branchCount = lines.filter((l) => kw.branch.some((k) => new RegExp("\\b" + k + "\\b", "i").test(l))).length;
  const loopCount = lines.filter((l) => kw.loop.some((k) => new RegExp("\\b" + k + "\\b", "i").test(l))).length;
  const complexityRaw = (maxDepth / 8) * 0.4 + (branchCount / Math.max(total, 1)) * 0.3 + (loopCount / Math.max(total, 1)) * 0.3;
  const massNorm = Math.min(total / 60, 1);

  const smells = [];
  let smellScore = 0;

  const opens = { "(": 0, "[": 0, "{": 0 };
  const closes = { ")": "(", "]": "[", "}": "{" };
  let doubleQ = 0;
  for (const ch of code) { if (ch in opens) opens[ch]++; if (ch in closes) opens[closes[ch]]--; if (ch === '"') doubleQ++; }
  const unmatched = Object.entries(opens).filter(([, v]) => v !== 0);
  if (unmatched.length > 0) { smells.push({ text: `Несбалансированные скобки: ${unmatched.map(([k, v]) => `${k}${v > 0 ? "+" : ""}${v}`).join(", ")}`, weight: 25 }); smellScore += 25; }
  if (doubleQ % 2 !== 0) { smells.push({ text: 'Незакрытая кавычка "', weight: 20 }); smellScore += 20; }

  const longLines = lines.filter((l) => l.length > 120).length;
  if (longLines > 0) { smells.push({ text: `${longLines} строк > 120 символов`, weight: longLines * 3 }); smellScore += longLines * 3; }

  const deepLines = depths.filter((d) => d > 4).length;
  if (deepLines > 0) { smells.push({ text: `Вложенность >4: ${deepLines} строк`, weight: deepLines * 4 }); smellScore += deepLines * 4; }

  const magicNums = code.match(/(?<![a-zA-Z_\d.])\d{2,}(?!\d*[.eE]\d)(?![a-zA-Z_])/g) || [];
  const realMagic = magicNums.filter((n) => !["00", "10", "20", "21", "100", "1000", "255", "256", "1024"].includes(n));
  if (realMagic.length > 2) { smells.push({ text: `Магические числа: ${realMagic.slice(0, 5).join(", ")}`, weight: realMagic.length * 2 }); smellScore += realMagic.length * 2; }

  if (lang.name === "Python") {
    const ee = (code.match(/except.*:\s*\n\s*(pass|\.\.\.)\s*$/gm) || []).length;
    if (ee > 0) { smells.push({ text: `Пустые except: ${ee}`, weight: ee * 10 }); smellScore += ee * 10; }
    const pr = (code.match(/\bprint\s*\(/g) || []).length;
    if (pr > 5) { smells.push({ text: `Избыток print: ${pr}`, weight: Math.min(pr * 2, 15) }); smellScore += Math.min(pr * 2, 15); }
  }

  let dupeCount = 0;
  for (let i = 1; i < lines.length; i++) { if (lines[i].trim() === lines[i - 1].trim() && lines[i].trim().length > 5) dupeCount++; }
  if (dupeCount > 2) { smells.push({ text: `Дубликаты: ${dupeCount}`, weight: dupeCount * 4 }); smellScore += dupeCount * 4; }

  if (/\bgo\s*to\b/i.test(code)) { smells.push({ text: "GO TO", weight: 15 }); smellScore += 15; }
  if (commentLines === 0 && total > 10) { smells.push({ text: "Нет комментариев", weight: 8 }); smellScore += 8; }

  if (lang.name === "COBOL" && !/STOP\s+RUN/i.test(code) && total > 5) { smells.push({ text: "Нет STOP RUN", weight: 10 }); smellScore += 10; }
  if (lang.name === "FORTRAN I") {
    const bad72 = lines.filter((l) => l.length > 72).length;
    if (bad72 > 0) { smells.push({ text: `${bad72} строк за колонкой 72`, weight: bad72 * 5 }); smellScore += bad72 * 5; }
  }

  smellScore = Math.min(smellScore, 95);
  return {
    modulation: { air: Math.round(airRatio * 100), complexity: Math.round(Math.min(complexityRaw, 1) * 100), mass: Math.round(massNorm * 100) },
    smellScore, smells,
    metrics: { lines: total, comments: commentLines, emptyLines, maxDepth, branches: branchCount, loops: loopCount },
  };
}

function computeChannelValues(lang, analysis) {
  if (!analysis) return lang.channels.map((c) => ({ id: c.id, value: c.base }));
  const { air, complexity, mass } = analysis.modulation;
  return lang.channels.map((c) => {
    let val = c.base;
    if (c.note === "верхняя") { val += (air / 100) * 18; val += (complexity / 100) * 8; }
    if (c.note === "базовая") { val -= (air / 100) * 8; val += (mass / 100) * 18; val += (complexity / 100) * 10; }
    if (lang.channels.length === 1) { val += (mass / 100) * 12; val += (complexity / 100) * 12; val -= (air / 100) * 5; }
    return { id: c.id, value: Math.round(Math.max(5, Math.min(95, val))) };
  });
}

function buildMqtt(ch) { return ch.map((c) => `CH${c.id}:${c.value}`).join(";"); }
function buildBle(ch) { return ch.map((c) => `${c.id}=${c.value}`).join(","); }

// ── Vertical Slider ────────────────────────────────────────
function VSlider({ value, onChange, color, label, icon, note, disabled, glow, code }) {
  const ref = useRef(null); const drag = useRef(false);
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", minWidth: "68px", opacity: disabled ? 0.2 : 1 }}>
      <span style={{ fontSize: "16px" }}>{icon}</span>
      <div ref={ref} onMouseDown={(e) => { drag.current = true; calc(e); }} onTouchStart={(e) => { drag.current = true; calc(e); }}
        style={{ width: "28px", height: "130px", background: "#0d0d0d", borderRadius: "14px", position: "relative", cursor: disabled ? "not-allowed" : "ns-resize", border: `1px solid ${value > 0 ? color + "33" : "#151515"}`, touchAction: "none" }}>
        <div style={{ position: "absolute", bottom: "3px", left: "3px", right: "3px", height: `calc(${value}% - 6px)`, minHeight: 0, background: `linear-gradient(to top, ${color}18, ${color}88)`, borderRadius: "12px", transition: drag.current ? "none" : "height .35s ease" }} />
        <div style={{ position: "absolute", left: "50%", bottom: `calc(${value}% - 10px)`, transform: "translateX(-50%)", width: "20px", height: "20px", borderRadius: "50%", background: `radial-gradient(circle at 35% 35%, ${color}, ${color}66)`, border: "2px solid #070707", boxShadow: glow && value > 0 ? `0 0 12px ${color}55` : "none", transition: drag.current ? "none" : "bottom .35s ease, box-shadow .4s" }} />
      </div>
      <span style={{ fontFamily: "var(--mono)", fontSize: "14px", fontWeight: 600, color: value > 0 ? color : "#2a2a2a", minWidth: "28px", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{value}</span>
      <span style={{ fontFamily: "var(--mono)", fontSize: "7.5px", color: "#555", textAlign: "center", lineHeight: "1.3", maxWidth: "68px" }}>{label}</span>
      {note && <span style={{ fontFamily: "var(--serif)", fontSize: "8px", fontStyle: "italic", color: "#333" }}>{note}</span>}
      {code && <span style={{ fontFamily: "var(--mono)", fontSize: "6px", color: "#1a1a1a", textAlign: "center", maxWidth: "68px", wordBreak: "break-all" }}>{code}</span>}
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
  const [proto, setProto] = useState("mqtt");
  const [mqtt, setMqtt] = useState({ host: "192.168.1.100", port: "1883", topic: "sensorylab/ctrl" });
  const [ble, setBle] = useState({ device: "SensoryLab-6CH", service: "ffe0", char: "ffe1" });
  const [showCfg, setShowCfg] = useState(false);

  const lang = sel ? LANGS[sel] : null;
  const code = mode === "custom" && custom.trim() ? custom : lang?.sample || "";
  const analysis = useMemo(() => lang && code.trim() ? analyzeCode(code, lang) : null, [code, sel, mode]);
  const computed = useMemo(() => lang && analysis ? computeChannelValues(lang, analysis) : [], [lang, analysis]);

  const getVal = (chId) => overrides[chId] !== undefined ? overrides[chId] : (computed.find((c) => c.id === chId)?.value || 0);
  const smellVal = overrides[4] !== undefined ? overrides[4] : (analysis?.smellScore || 0);

  const allChannels = useMemo(() => {
    if (!lang) return [];
    const chs = lang.channels.map((c) => ({ id: c.id, value: getVal(c.id) }));
    chs.push({ id: 4, value: smellVal });
    return chs.sort((a, b) => a.id - b.id);
  }, [lang, computed, overrides, smellVal]);

  const cmdStr = useMemo(() => allChannels.length ? (proto === "mqtt" ? buildMqtt(allChannels) : buildBle(allChannels)) : "", [allChannels, proto]);

  useEffect(() => { if (isDiffusing && cmdStr) console.log(`${proto.toUpperCase()} →`, cmdStr); }, [cmdStr, isDiffusing]);

  const handleDiffuse = () => { if (!lang) return; if (isDiffusing) { setIsDiffusing(false); setOverrides({}); } else setIsDiffusing(true); };
  const selectLang = (k) => { setIsDiffusing(false); setOverrides({}); setCustom(""); setMode("sample"); setSel(sel === k ? null : k); };

  return (
    <div style={{ "--mono": "'JetBrains Mono',ui-monospace,'Fira Code',monospace", "--serif": "'Cormorant Garamond','Georgia',serif", minHeight: "100vh", background: "#050505", color: "#ddd", fontFamily: "var(--serif)" }}>
      <style>{`
        @font-face{font-family:'JetBrains Mono';font-style:normal;font-weight:300 600;src:local('JetBrains Mono'),local('JetBrainsMono-Regular'),local('JetBrainsMono')}
        @font-face{font-family:'Cormorant Garamond';font-style:normal;font-weight:300 600;src:local('Cormorant Garamond'),local('CormorantGaramond-Regular'),local('CormorantGaramond')}
        @font-face{font-family:'Cormorant Garamond';font-style:italic;font-weight:300 600;src:local('Cormorant Garamond Italic'),local('CormorantGaramond-Italic')}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glowBtn{0%,100%{box-shadow:0 0 10px var(--gc,transparent)}50%{box-shadow:0 0 25px var(--gc,transparent)}}
        @keyframes rise{0%{opacity:0;transform:translateY(0)}12%{opacity:.4}100%{opacity:0;transform:translateY(-60px) scale(.1)}}
        *{box-sizing:border-box;margin:0}::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:2px}textarea:focus,input:focus{outline:none}
      `}</style>

      {/* HEADER */}
      <header style={{ padding: "16px 16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: "22px", fontWeight: 300, letterSpacing: "3px", color: lang ? lang.color : "#3a3a3a", transition: "color .5s" }}>source.scent</h1>
          <p style={{ fontFamily: "var(--mono)", fontSize: "7px", color: "#1a1a1a", letterSpacing: "2.5px" }}>CODE → AROMA · 6CH · {proto.toUpperCase()}</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div style={{ display: "flex", borderRadius: "8px", overflow: "hidden", border: "1px solid #151515" }}>
            {["mqtt", "ble"].map((p) => (
              <button key={p} onClick={() => setProto(p)} style={{ background: proto === p ? "#151515" : "#080808", border: "none", padding: "3px 8px", cursor: "pointer", fontFamily: "var(--mono)", fontSize: "8px", color: proto === p ? "#777" : "#2a2a2a", letterSpacing: "1px" }}>{p.toUpperCase()}</button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "12px", background: isDiffusing ? (lang?.color || "#555") + "0e" : "#0a0a0a", border: `1px solid ${isDiffusing ? (lang?.color || "#555") + "40" : "#151515"}` }}>
            <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: isDiffusing ? lang?.color : "#3a3a3a", animation: isDiffusing ? "pulse 1.4s infinite" : "none" }} />
            <span style={{ fontFamily: "var(--mono)", fontSize: "8px", color: isDiffusing ? lang?.color : "#333", letterSpacing: "1px" }}>{isDiffusing ? "DIFF" : "STBY"}</span>
          </div>
          <button onClick={() => setShowCfg(!showCfg)} style={{ background: "none", border: "1px solid #181818", borderRadius: "50%", width: "26px", height: "26px", color: "#333", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center" }}>⚙</button>
        </div>
      </header>

      {/* CONFIG */}
      {showCfg && (
        <div style={{ margin: "10px 16px", padding: "10px", background: "#090909", border: "1px solid #141414", borderRadius: "6px", animation: "fadeIn .25s" }}>
          {proto === "mqtt" ? (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {[{ l: "Host", k: "host", w: "140px" }, { l: "Port", k: "port", w: "55px" }, { l: "Topic", k: "topic", w: "155px" }].map((f) => (
                <div key={f.k}><div style={{ fontFamily: "var(--mono)", fontSize: "7px", color: "#2a2a2a", marginBottom: "2px" }}>{f.l}</div>
                <input value={mqtt[f.k]} onChange={(e) => setMqtt({ ...mqtt, [f.k]: e.target.value })} style={{ background: "#0c0c0c", border: "1px solid #181818", borderRadius: "3px", padding: "3px 6px", color: "#555", fontFamily: "var(--mono)", fontSize: "10px", width: f.w }} /></div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {[{ l: "Device", k: "device", w: "150px" }, { l: "Service", k: "service", w: "80px" }, { l: "Char", k: "char", w: "80px" }].map((f) => (
                <div key={f.k}><div style={{ fontFamily: "var(--mono)", fontSize: "7px", color: "#2a2a2a", marginBottom: "2px" }}>{f.l}</div>
                <input value={ble[f.k]} onChange={(e) => setBle({ ...ble, [f.k]: e.target.value })} style={{ background: "#0c0c0c", border: "1px solid #181818", borderRadius: "3px", padding: "3px 6px", color: "#555", fontFamily: "var(--mono)", fontSize: "10px", width: f.w }} /></div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LANGUAGE CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px", padding: "12px 16px" }}>
        {Object.entries(LANGS).map(([k, l]) => {
          const on = sel === k;
          return (
            <button key={k} onClick={() => selectLang(k)} style={{ background: on ? l.dim : "#080808", border: `1px solid ${on ? l.color + "44" : "#111"}`, borderRadius: "7px", padding: "10px 8px", cursor: "pointer", textAlign: "left", transition: "all .3s", position: "relative", overflow: "hidden" }}>
              {on && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: l.color }} />}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: "13px", fontWeight: 500, color: on ? l.color : "#3a3a3a" }}>{l.name}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: "7px", color: l.status === "мёртв" ? "#4a2020" : l.status === "зомби" ? "#4a3a20" : "#204a2a", padding: "1px 5px", borderRadius: "3px", background: l.status === "мёртв" ? "#1a0808" : l.status === "зомби" ? "#1a1208" : "#081a0a" }}>{l.status}</span>
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: "7px", color: "#222", marginTop: "2px" }}>{l.year} · {l.channels.length}ch</div>
              <div style={{ display: "flex", gap: "3px", marginTop: "4px" }}>{l.channels.map((c) => <span key={c.id} style={{ fontSize: "10px", opacity: on ? 1 : .25 }}>{c.icon}</span>)}</div>
            </button>
          );
        })}
      </div>

      {/* MAIN */}
      {lang && (
        <div style={{ padding: "0 16px 60px", animation: "fadeIn .35s" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "baseline", marginBottom: "10px", flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--serif)", fontSize: "13px", fontWeight: 300, fontStyle: "italic", color: "#4a4a4a" }}>{lang.philosophy}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: "7px", color: "#1a1a1a" }}>{lang.author}</span>
          </div>

          <div style={{ display: "flex", marginBottom: "10px" }}>
            {[{ k: "sample", l: `${lang.ext} sample` }, { k: "custom", l: "свой код ✎" }].map((m) => (
              <button key={m.k} onClick={() => { setMode(m.k); setOverrides({}); }} style={{ background: mode === m.k ? lang.color + "10" : "#080808", border: `1px solid ${mode === m.k ? lang.color + "35" : "#131313"}`, borderRadius: m.k === "sample" ? "4px 0 0 4px" : "0 4px 4px 0", padding: "5px 13px", cursor: "pointer", fontFamily: "var(--mono)", fontSize: "9px", color: mode === m.k ? lang.color : "#3a3a3a" }}>{m.l}</button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "12px" }}>
            {/* LEFT */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: 0 }}>
              {mode === "sample" ? (
                <pre style={{ background: "#080808", border: `1px solid ${lang.color}12`, borderRadius: "6px", padding: "11px", fontFamily: "var(--mono)", fontSize: "10px", lineHeight: "1.6", color: "#5a5a5a", overflowX: "auto", overflowY: "auto", maxHeight: "260px", margin: 0, position: "relative" }}>
                  <span style={{ position: "absolute", top: "4px", right: "8px", fontSize: "7px", color: lang.color + "33", letterSpacing: "1.5px" }}>{lang.ext}</span>
                  {lang.sample}
                </pre>
              ) : (
                <div style={{ position: "relative" }}>
                  <textarea value={custom} onChange={(e) => { setCustom(e.target.value); setOverrides({}); }} placeholder={`// Вставьте ${lang.name} код`} spellCheck={false}
                    style={{ width: "100%", minHeight: "260px", resize: "vertical", background: "#080808", border: `1px solid ${lang.color}18`, borderRadius: "6px", padding: "11px", fontFamily: "var(--mono)", fontSize: "10px", lineHeight: "1.6", color: "#777", whiteSpace: "pre", tabSize: 4 }} />
                  {custom.trim() && <span style={{ position: "absolute", top: "4px", right: "8px", fontFamily: "var(--mono)", fontSize: "7px", color: lang.color + "44" }}>{custom.split("\n").filter((l) => l.trim()).length} lines</span>}
                </div>
              )}

              {analysis && (
                <div style={{ animation: "fadeIn .25s" }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "7px", color: "#222", letterSpacing: "2px", marginBottom: "5px" }}>МОДУЛЯЦИЯ ±20%</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
                    {[
                      { label: "«Воздух»", sub: "→ верхняя ↑", val: analysis.modulation.air, detail: `${analysis.metrics.comments} комм · ${analysis.metrics.emptyLines} пустых` },
                      { label: "«Сложность»", sub: "→ все ноты ↑", val: analysis.modulation.complexity, detail: `глуб ${analysis.metrics.maxDepth} · ${analysis.metrics.branches} ветвл` },
                      { label: "«Масса»", sub: "→ базовая ↑", val: analysis.modulation.mass, detail: `${analysis.metrics.lines} строк` },
                    ].map((m) => (
                      <div key={m.label} style={{ padding: "7px", background: "#080808", borderRadius: "5px", border: "1px solid #111" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <span style={{ fontFamily: "var(--mono)", fontSize: "9px", color: "#666" }}>{m.label}</span>
                          <span style={{ fontFamily: "var(--mono)", fontSize: "13px", fontWeight: 600, color: lang.color }}>{m.val}%</span>
                        </div>
                        <div style={{ fontFamily: "var(--mono)", fontSize: "7px", color: "#333", marginTop: "2px" }}>{m.sub}</div>
                        <div style={{ fontFamily: "var(--mono)", fontSize: "7px", color: "#1e1e1e", marginTop: "1px" }}>{m.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis && analysis.smells.length > 0 && (
                <div style={{ animation: "fadeIn .25s", background: "#0a0606", border: `1px solid ${SMELL_CHANNEL.color}22`, borderRadius: "5px", padding: "8px" }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "7px", color: SMELL_CHANNEL.color + "88", letterSpacing: "2px", marginBottom: "4px" }}>☠ CODE SMELL — CH4: {analysis.smellScore}%</div>
                  {analysis.smells.map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: "6px", alignItems: "baseline", padding: "3px 0" }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: "9px", color: SMELL_CHANNEL.color, minWidth: "28px", textAlign: "right" }}>+{s.weight}%</span>
                      <span style={{ fontFamily: "var(--mono)", fontSize: "9px", color: "#666", lineHeight: "1.4" }}>{s.text}</span>
                    </div>
                  ))}
                </div>
              )}
              {analysis && analysis.smells.length === 0 && (
                <div style={{ fontFamily: "var(--mono)", fontSize: "8px", color: "#1a3a1a", padding: "6px 8px", background: "#060a06", borderRadius: "4px", border: "1px solid #0a1a0a" }}>✓ Код чист. CH4 молчит.</div>
              )}
            </div>

            {/* RIGHT: MIXER */}
            <div style={{ background: "#080808", border: `1px solid ${lang.color}12`, borderRadius: "7px", padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: "7px", color: "#2a2a2a", letterSpacing: "2px", textAlign: "center" }}>MIXER — {lang.name.toUpperCase()}</div>

              <div style={{ display: "flex", justifyContent: "center", gap: "6px", position: "relative" }}>
                {isDiffusing && <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>{Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ position: "absolute", bottom: 0, left: `${8 + Math.random() * 84}%`, width: "3px", height: "3px", borderRadius: "50%", background: lang.color, opacity: 0, animation: `rise 2s ease-out ${i * .35}s infinite`, filter: "blur(1px)" }} />)}</div>}
                {lang.channels.map((ch) => (
                  <VSlider key={ch.id} value={getVal(ch.id)} onChange={(v) => setOverrides((p) => ({ ...p, [ch.id]: v }))} color={lang.color} label={ch.scent} icon={ch.icon} note={ch.note} code={ch.code} glow={isDiffusing} />
                ))}
                <div style={{ width: "1px", background: "#1a1a1a", margin: "20px 2px", alignSelf: "stretch" }} />
                <VSlider value={smellVal} onChange={(v) => setOverrides((p) => ({ ...p, 4: v }))} color={SMELL_CHANNEL.color} label={SMELL_CHANNEL.scent} icon={SMELL_CHANNEL.icon} note="code smell" code={SMELL_CHANNEL.code} glow={isDiffusing && smellVal > 15} />
              </div>

              {analysis && (
                <div style={{ fontFamily: "var(--mono)", fontSize: "8px", color: "#333", textAlign: "center", lineHeight: "1.6" }}>
                  {lang.channels.map((c) => <span key={c.id}>{c.scent} <span style={{ color: lang.color }}>{getVal(c.id)}</span> · </span>)}
                  <span>{SMELL_CHANNEL.scent} <span style={{ color: smellVal > 0 ? SMELL_CHANNEL.color : "#222" }}>{smellVal}</span></span>
                </div>
              )}

              <button onClick={handleDiffuse} style={{ background: isDiffusing ? lang.color + "12" : "#0c0c0c", border: `2px solid ${isDiffusing ? lang.color : "#2a2a2a"}`, borderRadius: "7px", padding: "13px", cursor: "pointer", fontFamily: "var(--mono)", fontSize: "12px", fontWeight: 500, color: isDiffusing ? lang.color : "#555", letterSpacing: "4px", transition: "all .4s", "--gc": isDiffusing ? lang.color + "40" : "transparent", animation: isDiffusing ? "glowBtn 2s infinite" : "none" }}>
                {isDiffusing ? "■ STOP" : "▶ DIFFUSE"}
              </button>

              <div style={{ fontFamily: "var(--mono)", fontSize: "7.5px", color: "#1a1a1a", textAlign: "center", padding: "5px", background: "#060606", borderRadius: "3px", wordBreak: "break-all" }}>
                <span style={{ color: "#222" }}>{proto.toUpperCase()}</span> {isDiffusing ? cmdStr : "—"}
              </div>
            </div>
          </div>

          {/* 6-CHANNEL BAR */}
          <div style={{ marginTop: "12px" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: "6.5px", color: "#181818", letterSpacing: "2px", marginBottom: "3px" }}>ALL 6 CHANNELS</div>
            <div style={{ display: "flex", gap: "3px" }}>
              {[1, 2, 3, 4, 5, 6].map((id) => {
                let val = 0, col = "#1a1a1a", isActive = false, label = "";
                if (id === 4) { val = smellVal; col = SMELL_CHANNEL.color; isActive = true; label = "☠"; }
                else { Object.values(LANGS).forEach((l) => l.channels.forEach((c) => { if (c.id === id) { col = l.color; label = c.icon; if (sel && l === LANGS[sel]) { val = getVal(id); isActive = true; } } })); }
                return (
                  <div key={id} style={{ flex: 1, height: "32px", background: "#070707", borderRadius: "3px", position: "relative", overflow: "hidden", border: `1px solid ${isActive ? col + "28" : "#0a0a0a"}` }}>
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${val}%`, background: `${col}${isActive ? "55" : "15"}`, transition: "height .3s" }} />
                    <span style={{ position: "absolute", top: "1px", width: "100%", textAlign: "center", fontSize: "8px" }}>{label}</span>
                    <span style={{ position: "absolute", bottom: "1px", width: "100%", textAlign: "center", fontFamily: "var(--mono)", fontSize: "7px", color: isActive ? col + "aa" : "#151515" }}>{id}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* EMPTY */}
      {!lang && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "44px 16px", animation: "fadeIn .5s" }}>
          <p style={{ fontFamily: "var(--serif)", fontSize: "17px", fontWeight: 300, color: "#252525", fontStyle: "italic", textAlign: "center", lineHeight: "1.9" }}>
            Мёртвые языки нельзя запустить.<br />Но можно вдохнуть.
          </p>
          <p style={{ fontFamily: "var(--mono)", fontSize: "7px", color: "#131313", letterSpacing: "4px", marginTop: "14px" }}>PYTHON · FORTRAN I · COBOL</p>
          <div style={{ display: "flex", gap: "4px", marginTop: "28px" }}>
            {[LANGS.python.color, LANGS.python.color, LANGS.fortran.color, SMELL_CHANNEL.color, LANGS.cobol.color, LANGS.cobol.color].map((c, i) => (
              <div key={i} style={{ width: "22px", height: "3px", background: c, opacity: 0.2, borderRadius: "1px" }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
