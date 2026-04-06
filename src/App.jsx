import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import mqtt from "mqtt";

// ═══════════════════════════════════════════════════════════════
// CODE.scent v0.5
// 3 languages · 6 channels · SensoryLab 6ch + NeuroAir
// Python(2) + FORTRAN I(1) + CODE SMELL(1) + COBOL(2)
// MQTT (WebSocket) + Web Bluetooth + Web Serial (USB)
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
      { id: 3, scent: "Сосна (канифоль)", code: "MP822/W2", note: "базовая", icon: "√", base: 70, env: "машинный зал ЭВМ" },
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
      { id: 5, scent: "Табак", code: "MA/1547", note: "верхняя", icon: "🚬", base: 65, env: "торговый зал" },
      { id: 6, scent: "Кожа", code: "MA/1622", note: "базовая", icon: "🏛", base: 60, env: "кабинет" },
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
  const baseIndent = lang.name === "COBOL" ? 3 : lang.name === "FORTRAN I" ? 3 : 0;
  const depths = lines.map((l) => { const m = l.match(/^(\s+)/); return m ? Math.max(0, Math.floor(m[1].replace(/\t/g, "    ").length / 2) - baseIndent) : 0; });
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
  const realMagic = magicNums.filter((n) => !["00", "01", "02", "05", "10", "20", "21", "77", "88", "99", "100", "1000", "255", "256", "1024"].includes(n));
  if (realMagic.length > 2) { smells.push({ text: `Магические числа: ${realMagic.slice(0, 5).join(", ")}`, weight: realMagic.length * 2 }); smellScore += realMagic.length * 2; }

  if (lang.name === "Python") {
    const ee = (code.match(/except.*:\s*\n\s*(pass|\.\.\.)\s*$/gm) || []).length;
    if (ee > 0) { smells.push({ text: `Пустые except: ${ee}`, weight: ee * 10 }); smellScore += ee * 10; }
    const pr = (code.match(/\bprint\s*\(/g) || []).length;
    if (pr > 5) { smells.push({ text: `Избыток print: ${pr}`, weight: Math.min(pr * 2, 15) }); smellScore += Math.min(pr * 2, 15); }
    const pyKw = /\b(def|class|if|elif|else|for|while|import|from|return|print|try|except|with|as|in|not|and|or|is|None|True|False|self|lambda|yield|raise|pass|break|continue|global|del|assert)\b/;
    const pySyntax = /[=:(){}\[\]@#]/;
    const meaningful = lines.filter((l) => l.trim().length > 0);
    if (meaningful.length >= 3) {
      const recognized = meaningful.filter((l) => pyKw.test(l) || pySyntax.test(l)).length;
      const ratio = recognized / meaningful.length;
      if (ratio < 0.25) { smells.push({ text: "Нераспознаваемый код", weight: 95 }); smellScore += 95; }
    }
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
function buildSerialEnable(ch) {
  return ch.map((c) => `e ${c.id - 1}`).join("\n");
}
function buildSerial(ch) {
  return ch.map((c) => {
    const pwm = Math.round(c.value / 100 * 4095);
    return `p ${c.id - 1} ${pwm} 0`;
  }).join("\n");
}

// ── Device Connection ──────────────────────────────────────
const CONN = { disconnected: "disconnected", connecting: "connecting", connected: "connected", error: "error" };
const CONN_COLORS = { disconnected: "#888", connecting: "#a08030", connected: "#30a040", error: "#E04040" };
const CONN_LABELS = { disconnected: "OFF", connecting: "LINK", connected: "LIVE", error: "ERR" };

function useMqttConnection() {
  const clientRef = useRef(null);
  const [status, setStatus] = useState(CONN.disconnected);
  const [error, setError] = useState("");

  const connect = useCallback((cfg) => {
    if (clientRef.current) { clientRef.current.end(true); clientRef.current = null; }
    setStatus(CONN.connecting); setError("");
    const url = `ws://${cfg.host}:${cfg.port}/mqtt`;
    const client = mqtt.connect(url, { connectTimeout: 5000, reconnectPeriod: 3000 });
    clientRef.current = client;
    client.on("connect", () => setStatus(CONN.connected));
    client.on("error", (err) => { setError(err.message || "MQTT error"); setStatus(CONN.error); });
    client.on("close", () => { if (clientRef.current === client) setStatus(CONN.disconnected); });
    client.on("offline", () => setStatus(CONN.disconnected));
  }, []);

  const disconnect = useCallback(() => {
    if (clientRef.current) { clientRef.current.end(true); clientRef.current = null; }
    setStatus(CONN.disconnected); setError("");
  }, []);

  const publish = useCallback((topic, message) => {
    if (clientRef.current && clientRef.current.connected) {
      clientRef.current.publish(topic, message);
      return true;
    }
    return false;
  }, []);

  useEffect(() => () => { if (clientRef.current) clientRef.current.end(true); }, []);

  return { status, error, connect, disconnect, publish };
}

function useBleConnection() {
  const deviceRef = useRef(null);
  const charRef = useRef(null);
  const [status, setStatus] = useState(CONN.disconnected);
  const [error, setError] = useState("");

  const connect = useCallback(async (cfg) => {
    if (!navigator.bluetooth) { setError("Web Bluetooth not supported. Use Chrome/Edge."); setStatus(CONN.error); return; }
    try {
      setStatus(CONN.connecting); setError("");
      const filters = [];
      if (cfg.device) filters.push({ namePrefix: cfg.device });
      const device = await navigator.bluetooth.requestDevice({
        filters: filters.length ? filters : undefined,
        acceptAllDevices: filters.length === 0,
        optionalServices: [cfg.service],
      });
      deviceRef.current = device;
      device.addEventListener("gattserverdisconnected", () => {
        charRef.current = null;
        setStatus(CONN.disconnected);
      });
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(cfg.service);
      const characteristic = await service.getCharacteristic(cfg.char);
      charRef.current = characteristic;
      setStatus(CONN.connected);
    } catch (err) {
      if (err.name === "NotFoundError") { setError("Device not found. Check name/UUID."); }
      else if (err.name === "SecurityError") { setError("Bluetooth blocked by browser"); }
      else { setError(err.message || "BLE error"); }
      setStatus(CONN.error);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (deviceRef.current?.gatt?.connected) deviceRef.current.gatt.disconnect();
    charRef.current = null; deviceRef.current = null;
    setStatus(CONN.disconnected); setError("");
  }, []);

  const write = useCallback(async (message) => {
    if (!charRef.current) return false;
    const encoder = new TextEncoder();
    try {
      const lines = message.split("\n").filter((l) => l.trim());
      for (const line of lines) {
        const data = encoder.encode(line + "\n");
        try { await charRef.current.writeValueWithoutResponse(data); }
        catch (_) { await charRef.current.writeValue(data); }
        if (lines.length > 1) await new Promise((r) => setTimeout(r, 30));
      }
      return true;
    } catch (err) {
      setError(err.message); setStatus(CONN.error);
      return false;
    }
  }, []);

  return { status, error, connect, disconnect, write };
}

function useSerialConnection() {
  const portRef = useRef(null);
  const writerRef = useRef(null);
  const readerRef = useRef(null);
  const readLoopRef = useRef(false);
  const [status, setStatus] = useState(CONN.disconnected);
  const [error, setError] = useState("");
  const [log, setLog] = useState([]);
  const lastCfgRef = useRef(null);

  const appendLog = useCallback((entry) => {
    setLog((prev) => {
      const next = [...prev, { ...entry, ts: Date.now() }];
      return next.length > 50 ? next.slice(-50) : next;
    });
  }, []);

  const startReader = useCallback(async (port) => {
    if (!port.readable) return;
    readLoopRef.current = true;
    const decoder = new TextDecoderStream();
    port.readable.pipeTo(decoder.writable).catch(() => {});
    const reader = decoder.readable.getReader();
    readerRef.current = reader;
    let lineBuf = "";
    try {
      while (readLoopRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          lineBuf += value;
          const parts = lineBuf.split("\n");
          lineBuf = parts.pop();
          parts.forEach((line) => {
            const trimmed = line.replace(/\r/g, "").trim();
            if (trimmed) appendLog({ dir: "rx", text: trimmed });
          });
        }
      }
    } catch (err) {
      if (readLoopRef.current) {
        appendLog({ dir: "sys", text: `Read error: ${err.message}` });
      }
    } finally {
      if (lineBuf.trim()) appendLog({ dir: "rx", text: lineBuf.trim() });
      try { reader.releaseLock(); } catch (_) {}
      readerRef.current = null;
    }
  }, [appendLog]);

  const cleanup = useCallback(async () => {
    readLoopRef.current = false;
    if (readerRef.current) { try { await readerRef.current.cancel(); } catch (_) {} readerRef.current = null; }
    if (writerRef.current) { try { writerRef.current.releaseLock(); } catch (_) {} writerRef.current = null; }
    if (portRef.current) { try { await portRef.current.close(); } catch (_) {} portRef.current = null; }
  }, []);

  const connect = useCallback(async (cfg) => {
    if (!navigator.serial) { setError("Web Serial not supported. Use Chrome/Edge."); setStatus(CONN.error); return; }
    try {
      setStatus(CONN.connecting); setError("");
      lastCfgRef.current = cfg;
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: parseInt(cfg.baudRate) || 115200 });
      portRef.current = port;
      const writer = port.writable.getWriter();
      writerRef.current = writer;
      startReader(port);
      port.addEventListener("disconnect", () => {
        appendLog({ dir: "sys", text: "USB disconnected" });
        setStatus(CONN.error); setError("Device unplugged");
        cleanup();
      });
      setStatus(CONN.connected);
      appendLog({ dir: "sys", text: `Connected @ ${cfg.baudRate} baud` });
    } catch (err) {
      if (err.name === "NotFoundError") { setError("No port selected"); }
      else { setError(err.message || "Serial error"); }
      setStatus(CONN.error);
    }
  }, [startReader, cleanup, appendLog]);

  const disconnect = useCallback(async () => {
    appendLog({ dir: "sys", text: "Disconnected by user" });
    await cleanup();
    setStatus(CONN.disconnected); setError("");
  }, [cleanup, appendLog]);

  const write = useCallback(async (message) => {
    if (!writerRef.current) return false;
    try {
      const encoder = new TextEncoder();
      await writerRef.current.write(encoder.encode(message + "\n"));
      appendLog({ dir: "tx", text: message });
      return true;
    } catch (err) {
      setError(err.message); setStatus(CONN.error);
      appendLog({ dir: "sys", text: `Write error: ${err.message}` });
      return false;
    }
  }, [appendLog]);

  const clearLog = useCallback(() => setLog([]), []);

  useEffect(() => () => { readLoopRef.current = false; cleanup(); }, [cleanup]);

  return { status, error, connect, disconnect, write, log, clearLog };
}

// ── Vertical Slider ────────────────────────────────────────
function VSlider({ value, onChange, color, icon, disabled, glow }) {
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
    <div className="sc-slider-col" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", minWidth: "68px", opacity: disabled ? 0.2 : 1 }}>
      <span style={{ fontSize: "20px" }}>{icon}</span>
      <div className="sc-slider-track" ref={ref} onMouseDown={(e) => { drag.current = true; calc(e); }} onTouchStart={(e) => { drag.current = true; calc(e); }}
        style={{ width: "28px", height: "130px", background: "#0d0d0d", borderRadius: "14px", position: "relative", cursor: disabled ? "not-allowed" : "ns-resize", border: `1px solid ${value > 0 ? color + "33" : "#151515"}`, touchAction: "none" }}>
        <div style={{ position: "absolute", bottom: "3px", left: "3px", right: "3px", height: `calc(${value}% - 6px)`, minHeight: 0, background: `linear-gradient(to top, ${color}18, ${color}88)`, borderRadius: "12px", transition: drag.current ? "none" : "height .35s ease" }} />
        <div style={{ position: "absolute", left: "50%", bottom: `calc(${value}% - 10px)`, transform: "translateX(-50%)", width: "20px", height: "20px", borderRadius: "50%", background: `radial-gradient(circle at 35% 35%, ${color}, ${color}66)`, border: "2px solid #070707", boxShadow: glow && value > 0 ? `0 0 12px ${color}55` : "none", transition: drag.current ? "none" : "bottom .35s ease, box-shadow .4s" }} />
      </div>
      <span style={{ fontFamily: "var(--mono)", fontSize: "18px", fontWeight: 600, color: value > 0 ? color : "#2a2a2a", minWidth: "28px", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{value}</span>
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
  const [diffuseTimer, setDiffuseTimer] = useState(0);
  const [proto, setProto] = useState("mqtt");
  const [mqttCfg, setMqttCfg] = useState({ host: "192.168.1.100", port: "9001", topic: "sensorylab/ctrl" });
  const [bleCfg, setBleCfg] = useState({ device: "SensoryLab-6CH", service: "ffe0", char: "ffe1" });
  const [serialCfg, setSerialCfg] = useState({ baudRate: "115200" });
  const [serialCmd, setSerialCmd] = useState("");
  const [showCfg, setShowCfg] = useState(false);

  const mqttConn = useMqttConnection();
  const bleConn = useBleConnection();
  const serialConn = useSerialConnection();
  const conn = proto === "mqtt" ? mqttConn : proto === "ble" ? bleConn : serialConn;
  const isConnected = conn.status === CONN.connected;

  const lang = sel ? LANGS[sel] : null;
  const code = mode === "custom" && custom.trim() ? custom : lang?.sample || "";
  const analysis = useMemo(() => lang && code.trim() ? analyzeCode(code, lang) : null, [code, sel, mode]);
  const computed = useMemo(() => lang && analysis ? computeChannelValues(lang, analysis) : [], [lang, analysis]);

  const getVal = (chId) => overrides[chId] !== undefined ? overrides[chId] : (computed.find((c) => c.id === chId)?.value || 0);
  const smellVal = overrides[4] !== undefined ? overrides[4] : (sel === "python" ? (analysis?.smellScore || 0) : 0);

  const allChannels = useMemo(() => {
    if (!lang) return [];
    const chs = lang.channels.map((c) => ({ id: c.id, value: getVal(c.id) }));
    chs.push({ id: 4, value: smellVal });
    return chs.sort((a, b) => a.id - b.id);
  }, [lang, computed, overrides, smellVal]);

  const cmdStr = useMemo(() => {
    if (!allChannels.length) return "";
    if (proto === "mqtt") return buildMqtt(allChannels);
    return buildSerial(allChannels);
  }, [allChannels, proto]);

  // Send commands to device when diffusing
  const sendCmdRef = useRef(null);
  sendCmdRef.current = () => {
    if (!isDiffusing || !cmdStr || !isConnected) return;
    if (proto === "mqtt") mqttConn.publish(mqttCfg.topic, cmdStr);
    else if (proto === "ble") bleConn.write(cmdStr);
    else serialConn.write(cmdStr);
  };

  // Send once when diffusion starts or values change
  const prevCmdRef = useRef("");
  useEffect(() => {
    if (!isDiffusing || !cmdStr || !isConnected) return;
    if (cmdStr === prevCmdRef.current) return;
    prevCmdRef.current = cmdStr;
    sendCmdRef.current();
  }, [isDiffusing, cmdStr, isConnected]);

  // Periodic resend every 2s while diffusing (keep-alive)
  useEffect(() => {
    if (!isDiffusing || !isConnected) return;
    const iv = setInterval(() => sendCmdRef.current(), 2000);
    return () => clearInterval(iv);
  }, [isDiffusing, isConnected]);

  // Stop all channels on stop (always try, even if connection errored)
  const sendStop = useCallback(() => {
    try {
      if (proto === "mqtt") mqttConn.publish(mqttCfg.topic, "CH1:0;CH2:0;CH3:0;CH4:0;CH5:0;CH6:0");
      else if (proto === "ble") bleConn.write("r");
      else serialConn.write("r");
    } catch (_) {}
    prevCmdRef.current = "";
  }, [proto, mqttCfg.topic]);

  const handleConnect = () => {
    if (conn.status === CONN.connected || conn.status === CONN.connecting) {
      if (isDiffusing) { sendStop(); setIsDiffusing(false); setDiffuseTimer(0); setOverrides({}); }
      if (proto === "mqtt") mqttConn.disconnect();
      else if (proto === "ble") bleConn.disconnect();
      else serialConn.disconnect();
    } else {
      if (proto === "mqtt") mqttConn.connect(mqttCfg);
      else if (proto === "ble") bleConn.connect(bleCfg);
      else serialConn.connect(serialCfg);
    }
  };

  const DIFFUSE_DURATION = 10;

  const handleDiffuse = () => {
    if (!lang) return;
    if (isDiffusing) { sendStop(); setIsDiffusing(false); setDiffuseTimer(0); setOverrides({}); }
    else {
      // Enable channels once at start
      if (isConnected && proto !== "mqtt") {
        const enableCmd = buildSerialEnable(allChannels);
        if (proto === "ble") bleConn.write(enableCmd);
        else serialConn.write(enableCmd);
      }
      setIsDiffusing(true); setDiffuseTimer(DIFFUSE_DURATION);
    }
  };

  // Countdown timer — auto-stop when reaches 0
  useEffect(() => {
    if (!isDiffusing || diffuseTimer <= 0) return;
    const t = setTimeout(() => {
      const next = diffuseTimer - 1;
      if (next <= 0) { sendStop(); setIsDiffusing(false); setDiffuseTimer(0); setOverrides({}); }
      else setDiffuseTimer(next);
    }, 1000);
    return () => clearTimeout(t);
  }, [isDiffusing, diffuseTimer, sendStop]);

  const selectLang = (k) => { if (isDiffusing) sendStop(); setIsDiffusing(false); setDiffuseTimer(0); setOverrides({}); setCustom(""); setMode("sample"); setSel(sel === k ? null : k); };

  return (
    <div style={{ "--mono": "'JetBrains Mono',ui-monospace,'Fira Code',monospace", "--serif": "'Cormorant Garamond','Georgia',serif", minHeight: "100vh", background: "#0c0c0c", color: "#e8e8e8", fontFamily: "var(--serif)" }}>
      <style>{`
        @font-face{font-family:'JetBrains Mono';font-style:normal;font-weight:100 800;src:url('./JetBrainsMono-VariableFont_wght.ttf') format('truetype')}
        @font-face{font-family:'JetBrains Mono';font-style:italic;font-weight:100 800;src:url('./JetBrainsMono-Italic-VariableFont_wght.ttf') format('truetype')}
        @font-face{font-family:'Cormorant Garamond';font-style:normal;font-weight:300 700;src:url('./CormorantGaramond-VariableFont_wght.ttf') format('truetype')}
        @font-face{font-family:'Cormorant Garamond';font-style:italic;font-weight:300 700;src:url('./CormorantGaramond-Italic-VariableFont_wght.ttf') format('truetype')}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glowBtn{0%,100%{box-shadow:0 0 10px var(--gc,transparent)}50%{box-shadow:0 0 25px var(--gc,transparent)}}
        @keyframes rise{0%{opacity:0;transform:translateY(0)}12%{opacity:.4}100%{opacity:0;transform:translateY(-60px) scale(.1)}}
        *{box-sizing:border-box;margin:0}::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:2px}textarea:focus,input:focus{outline:none}
        @media(max-width:900px){
          .sc-header{flex-direction:column!important;align-items:flex-start!important;gap:10px!important}
          .sc-header-right{width:100%;justify-content:space-between!important;flex-wrap:wrap!important;gap:6px!important}
          .sc-main-grid{grid-template-columns:1fr!important}
          .sc-cfg-wrap{flex-direction:column!important;gap:8px!important}
          .sc-cfg-wrap input{width:100%!important;min-width:0!important;padding:10px!important}
          .sc-cfg-wrap button{padding:10px 16px!important;width:100%!important}
          .sc-slider-row{gap:6px!important}
          .sc-slider-col{min-width:48px!important}
          .sc-slider-track{height:100px!important;width:34px!important}
          .sc-serial-btns{flex-wrap:wrap!important}
          .sc-diffuse-btn>div{padding:18px!important}
        }
        @media(max-width:500px){
          .sc-lang-cards{grid-template-columns:1fr!important}
          .sc-slider-track{height:80px!important}
        }
      `}</style>

      {/* HEADER */}
      <header className="sc-header" style={{ padding: "16px 16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: "32px", fontWeight: 300, letterSpacing: "3px", color: lang ? lang.color : "#888", transition: "color .5s" }}>CODE.scent</h1>
          <p style={{ fontFamily: "var(--mono)", fontSize: "15px", color: "#999", letterSpacing: "2.5px" }}>CODE → AROMA · 6CH · {proto.toUpperCase()}</p>
        </div>
        <div className="sc-header-right" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div style={{ display: "flex", borderRadius: "8px", overflow: "hidden", border: "1px solid #282828" }}>
            {["mqtt", "ble", "serial"].map((p) => (
              <button key={p} onClick={() => setProto(p)} style={{ background: proto === p ? "#151515" : "#080808", border: "none", padding: "3px 8px", cursor: "pointer", fontFamily: "var(--mono)", fontSize: "15px", color: proto === p ? "#777" : "#2a2a2a", letterSpacing: "1px" }}>{p === "serial" ? "USB" : p.toUpperCase()}</button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "12px", background: isDiffusing ? (lang?.color || "#555") + "0e" : "#0a0a0a", border: `1px solid ${isDiffusing ? (lang?.color || "#555") + "40" : "#151515"}` }}>
            <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: isDiffusing ? lang?.color : "#888", animation: isDiffusing ? "pulse 1.4s infinite" : "none" }} />
            <span style={{ fontFamily: "var(--mono)", fontSize: "15px", color: isDiffusing ? lang?.color : "#333", letterSpacing: "1px" }}>{isDiffusing ? "DIFF" : "STBY"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "3px 8px", borderRadius: "10px", background: "#131313", border: `1px solid ${CONN_COLORS[conn.status]}33`, cursor: "pointer" }} onClick={handleConnect} title={conn.error || (isConnected ? "Disconnect" : "Connect")}>
            <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: CONN_COLORS[conn.status], animation: conn.status === CONN.connecting ? "pulse 0.8s infinite" : "none" }} />
            <span style={{ fontFamily: "var(--mono)", fontSize: "15px", color: CONN_COLORS[conn.status], letterSpacing: "1px" }}>{CONN_LABELS[conn.status]}</span>
          </div>
          <button onClick={() => setShowCfg(!showCfg)} style={{ background: "none", border: "1px solid #2a2a2a", borderRadius: "50%", width: "26px", height: "26px", color: "#888", cursor: "pointer", fontSize: "15px", display: "flex", alignItems: "center", justifyContent: "center" }}>⚙</button>
        </div>
      </header>

      {/* CONFIG */}
      {showCfg && (
        <div style={{ margin: "10px 16px", padding: "10px", background: "#131313", border: "1px solid #282828", borderRadius: "6px", animation: "fadeIn .25s" }}>
          {proto === "mqtt" ? (
            <div className="sc-cfg-wrap" style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
              {[{ l: "Host (WebSocket)", k: "host", w: "140px" }, { l: "WS Port", k: "port", w: "55px" }, { l: "Topic", k: "topic", w: "155px" }].map((f) => (
                <div key={f.k}><div style={{ fontFamily: "var(--mono)", fontSize: "15px", color: "#bbb", marginBottom: "2px" }}>{f.l}</div>
                <input value={mqttCfg[f.k]} onChange={(e) => setMqttCfg({ ...mqttCfg, [f.k]: e.target.value })} disabled={isConnected} style={{ background: "#151515", border: "1px solid #2a2a2a", borderRadius: "3px", padding: "3px 6px", color: "#999", fontFamily: "var(--mono)", fontSize: "15px", width: f.w, opacity: isConnected ? 0.4 : 1 }} /></div>
              ))}
              <button onClick={handleConnect} style={{ background: isConnected ? "#0a1a0a" : "#0c0c0c", border: `1px solid ${CONN_COLORS[conn.status]}44`, borderRadius: "3px", padding: "4px 12px", cursor: "pointer", fontFamily: "var(--mono)", fontSize: "20px", color: CONN_COLORS[conn.status], letterSpacing: "1px" }}>
                {conn.status === CONN.connecting ? "..." : isConnected ? "DISCONNECT" : "CONNECT"}
              </button>
            </div>
          ) : proto === "ble" ? (
            <div className="sc-cfg-wrap" style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
              {[{ l: "Device", k: "device", w: "150px" }, { l: "Service UUID", k: "service", w: "80px" }, { l: "Char UUID", k: "char", w: "80px" }].map((f) => (
                <div key={f.k}><div style={{ fontFamily: "var(--mono)", fontSize: "15px", color: "#bbb", marginBottom: "2px" }}>{f.l}</div>
                <input value={bleCfg[f.k]} onChange={(e) => setBleCfg({ ...bleCfg, [f.k]: e.target.value })} disabled={isConnected} style={{ background: "#151515", border: "1px solid #2a2a2a", borderRadius: "3px", padding: "3px 6px", color: "#999", fontFamily: "var(--mono)", fontSize: "15px", width: f.w, opacity: isConnected ? 0.4 : 1 }} /></div>
              ))}
              <button onClick={handleConnect} style={{ background: isConnected ? "#0a1a0a" : "#0c0c0c", border: `1px solid ${CONN_COLORS[conn.status]}44`, borderRadius: "3px", padding: "4px 12px", cursor: "pointer", fontFamily: "var(--mono)", fontSize: "20px", color: CONN_COLORS[conn.status], letterSpacing: "1px" }}>
                {conn.status === CONN.connecting ? "..." : isConnected ? "DISCONNECT" : "CONNECT"}
              </button>
            </div>
          ) : (
            <div className="sc-cfg-wrap" style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
              {[{ l: "Baud Rate", k: "baudRate", w: "80px" }].map((f) => (
                <div key={f.k}><div style={{ fontFamily: "var(--mono)", fontSize: "15px", color: "#bbb", marginBottom: "2px" }}>{f.l}</div>
                <input value={serialCfg[f.k]} onChange={(e) => setSerialCfg({ ...serialCfg, [f.k]: e.target.value })} disabled={isConnected} style={{ background: "#151515", border: "1px solid #2a2a2a", borderRadius: "3px", padding: "3px 6px", color: "#999", fontFamily: "var(--mono)", fontSize: "15px", width: f.w, opacity: isConnected ? 0.4 : 1 }} /></div>
              ))}
              <button onClick={handleConnect} style={{ background: isConnected ? "#0a1a0a" : "#0c0c0c", border: `1px solid ${CONN_COLORS[conn.status]}44`, borderRadius: "3px", padding: "4px 12px", cursor: "pointer", fontFamily: "var(--mono)", fontSize: "20px", color: CONN_COLORS[conn.status], letterSpacing: "1px" }}>
                {conn.status === CONN.connecting ? "..." : isConnected ? "DISCONNECT" : "CONNECT"}
              </button>
            </div>
          )}
          {conn.error && <div style={{ fontFamily: "var(--mono)", fontSize: "15px", color: CONN_COLORS.error, marginTop: "6px" }}>{conn.error}</div>}

          {/* SERIAL DIAGNOSTIC LOG */}
          {proto === "serial" && serialConn.log.length > 0 && (
            <div style={{ marginTop: "8px", borderTop: "1px solid #282828", paddingTop: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: "15px", color: "#bbb", letterSpacing: "2px" }}>SERIAL LOG</span>
                <button onClick={serialConn.clearLog} style={{ background: "#151515", border: "1px solid #2a2a2a", borderRadius: "3px", padding: "2px 6px", cursor: "pointer", fontFamily: "var(--mono)", fontSize: "15px", color: "#888" }}>CLEAR</button>
              </div>
              <div style={{ maxHeight: "120px", overflowY: "auto", background: "#060606", borderRadius: "3px", padding: "4px 6px" }}>
                {serialConn.log.map((entry, i) => (
                  <div key={i} style={{ fontFamily: "var(--mono)", fontSize: "15px", lineHeight: "1.6", color: entry.dir === "tx" ? "#a08030" : entry.dir === "rx" ? "#30a040" : "#555" }}>
                    <span style={{ color: "#aaa", marginRight: "4px" }}>{new Date(entry.ts).toLocaleTimeString("en", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                    <span style={{ color: entry.dir === "tx" ? "#a08030" : entry.dir === "rx" ? "#30a040" : "#E04040", marginRight: "4px" }}>{entry.dir === "tx" ? "TX" : entry.dir === "rx" ? "RX" : "!!"}</span>
                    {entry.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SERIAL TEST CONTROLS */}
          {proto === "serial" && isConnected && (
            <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <div className="sc-serial-btns" style={{ display: "flex", gap: "6px" }}>
                <button onClick={() => serialConn.write("h")} style={{ background: "#151515", border: "1px solid #2a2a2a", borderRadius: "3px", padding: "4px 10px", cursor: "pointer", fontFamily: "var(--mono)", fontSize: "15px", color: "#999", letterSpacing: "1px" }}>HELP</button>
                <button onClick={() => serialConn.write("r")} style={{ background: "#151515", border: "1px solid #2a2a2a", borderRadius: "3px", padding: "4px 10px", cursor: "pointer", fontFamily: "var(--mono)", fontSize: "15px", color: "#999", letterSpacing: "1px" }}>RESET</button>
                <button onClick={() => serialConn.write("f256")} style={{ background: "#151515", border: "1px solid #2a2a2a", borderRadius: "3px", padding: "4px 10px", cursor: "pointer", fontFamily: "var(--mono)", fontSize: "15px", color: "#30a040", letterSpacing: "1px" }}>FAN 50%</button>
                <button onClick={() => serialConn.write("f511")} style={{ background: "#151515", border: "1px solid #2a2a2a", borderRadius: "3px", padding: "4px 10px", cursor: "pointer", fontFamily: "var(--mono)", fontSize: "15px", color: "#30a040", letterSpacing: "1px" }}>FAN MAX</button>
                <button onClick={() => serialConn.write("f000")} style={{ background: "#151515", border: "1px solid #2a2a2a", borderRadius: "3px", padding: "4px 10px", cursor: "pointer", fontFamily: "var(--mono)", fontSize: "15px", color: "#30a040", letterSpacing: "1px" }}>FAN OFF</button>
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                <input value={serialCmd} onChange={(e) => setSerialCmd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && serialCmd.trim()) { serialConn.write(serialCmd.trim()); setSerialCmd(""); } }} placeholder="Custom command..." style={{ flex: 1, background: "#151515", border: "1px solid #2a2a2a", borderRadius: "3px", padding: "4px 6px", color: "#bbb", fontFamily: "var(--mono)", fontSize: "20px" }} />
                <button onClick={() => { if (serialCmd.trim()) { serialConn.write(serialCmd.trim()); setSerialCmd(""); } }} style={{ background: "#151515", border: "1px solid #2a2a2a", borderRadius: "3px", padding: "4px 8px", cursor: "pointer", fontFamily: "var(--mono)", fontSize: "15px", color: "#999" }}>SEND</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LANGUAGE CARDS */}
      <div className="sc-lang-cards" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px", padding: "12px 16px" }}>
        {Object.entries(LANGS).map(([k, l]) => {
          const on = sel === k;
          return (
            <button key={k} onClick={() => selectLang(k)} style={{ background: on ? l.dim : "#080808", border: `1px solid ${on ? l.color + "44" : "#111"}`, borderRadius: "7px", padding: "10px 8px", cursor: "pointer", textAlign: "left", transition: "all .3s", position: "relative", overflow: "hidden" }}>
              {on && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: l.color }} />}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: "20px", fontWeight: 500, color: on ? l.color : "#888" }}>{l.name}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: "15px", color: l.status === "мёртв" ? "#4a2020" : l.status === "зомби" ? "#4a3a20" : "#204a2a", padding: "1px 5px", borderRadius: "3px", background: l.status === "мёртв" ? "#1a0808" : l.status === "зомби" ? "#1a1208" : "#081a0a" }}>{l.status}</span>
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: "15px", color: "#aaa", marginTop: "2px" }}>{l.year} · {l.channels.length}ch</div>
              <div style={{ display: "flex", gap: "3px", marginTop: "4px" }}>{l.channels.map((c) => <span key={c.id} style={{ fontSize: "15px", opacity: on ? 1 : .25 }}>{c.icon}</span>)}</div>
            </button>
          );
        })}
      </div>

      {/* MAIN */}
      {lang && (
        <div style={{ padding: "0 16px 60px", animation: "fadeIn .35s" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "baseline", marginBottom: "10px", flexWrap: "wrap" }}>
            <span className="sc-philosophy" style={{ fontFamily: "var(--serif)", fontSize: "20px", fontWeight: 300, fontStyle: "italic", color: "#aaa" }}>{lang.philosophy}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: "15px", color: "#999" }}>{lang.author}</span>
          </div>

          <div style={{ display: "flex", marginBottom: "10px" }}>
            {[{ k: "sample", l: `${lang.ext} sample` }, { k: "custom", l: "свой код ✎" }].map((m) => (
              <button key={m.k} onClick={() => { setMode(m.k); setOverrides({}); }} style={{ background: mode === m.k ? lang.color + "10" : "#080808", border: `1px solid ${mode === m.k ? lang.color + "35" : "#131313"}`, borderRadius: m.k === "sample" ? "4px 0 0 4px" : "0 4px 4px 0", padding: "5px 13px", cursor: "pointer", fontFamily: "var(--mono)", fontSize: "20px", color: mode === m.k ? lang.color : "#888" }}>{m.l}</button>
            ))}
          </div>

          <div className="sc-main-grid" style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "12px" }}>
            {/* LEFT */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: 0 }}>
              {mode === "sample" ? (
                <pre className="sc-code-pre" style={{ background: "#111", border: `1px solid ${lang.color}12`, borderRadius: "6px", padding: "11px", fontFamily: "var(--mono)", fontSize: "15px", lineHeight: "1.6", color: "#aaa", overflowX: "auto", overflowY: "auto", maxHeight: "260px", margin: 0, position: "relative" }}>
                  <span style={{ position: "absolute", top: "4px", right: "8px", fontSize: "15px", color: lang.color + "33", letterSpacing: "1.5px" }}>{lang.ext}</span>
                  {lang.sample}
                </pre>
              ) : (
                <div style={{ position: "relative" }}>
                  <textarea value={custom} onChange={(e) => { setCustom(e.target.value); setOverrides({}); }} placeholder={`// Вставьте ${lang.name} код`} spellCheck={false}
                    style={{ width: "100%", minHeight: "260px", resize: "vertical", background: "#111", border: `1px solid ${lang.color}18`, borderRadius: "6px", padding: "11px", fontFamily: "var(--mono)", fontSize: "15px", lineHeight: "1.6", color: "#bbb", whiteSpace: "pre", tabSize: 4 }} />
                  {custom.trim() && <span style={{ position: "absolute", top: "4px", right: "8px", fontFamily: "var(--mono)", fontSize: "15px", color: lang.color + "44" }}>{custom.split("\n").filter((l) => l.trim()).length} lines</span>}
                </div>
              )}

              {analysis && analysis.smells.length > 0 && (
                <div className="sc-smell-panel" style={{ animation: "fadeIn .25s", background: "#0a0606", border: `1px solid ${SMELL_CHANNEL.color}22`, borderRadius: "5px", padding: "8px" }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "15px", color: SMELL_CHANNEL.color + "88", letterSpacing: "2px", marginBottom: "4px" }}>☠ CODE SMELL — CH4: {analysis.smellScore}%</div>
                  {analysis.smells.map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: "6px", alignItems: "baseline", padding: "3px 0" }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: "20px", color: SMELL_CHANNEL.color, minWidth: "28px", textAlign: "right" }}>+{s.weight}%</span>
                      <span style={{ fontFamily: "var(--mono)", fontSize: "20px", color: "#aaa", lineHeight: "1.4" }}>{s.text}</span>
                    </div>
                  ))}
                </div>
              )}
              {analysis && analysis.smells.length === 0 && (
                <div style={{ fontFamily: "var(--mono)", fontSize: "15px", color: "#1a3a1a", padding: "6px 8px", background: "#060a06", borderRadius: "4px", border: "1px solid #0a1a0a" }}>✓ Код чист. CH4 молчит.</div>
              )}
            </div>

            {/* RIGHT: MIXER */}
            <div className="sc-mixer" style={{ background: "#111", border: `1px solid ${lang.color}12`, borderRadius: "7px", padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: "15px", color: "#bbb", letterSpacing: "2px", textAlign: "center" }}>MIXER — {lang.name.toUpperCase()}</div>

              <div className="sc-slider-row" style={{ display: "flex", justifyContent: "center", gap: "6px", position: "relative" }}>
                {isDiffusing && <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>{Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ position: "absolute", bottom: 0, left: `${8 + Math.random() * 84}%`, width: "3px", height: "3px", borderRadius: "50%", background: lang.color, opacity: 0, animation: `rise 2s ease-out ${i * .35}s infinite`, filter: "blur(1px)" }} />)}</div>}
                {lang.channels.map((ch) => (
                  <VSlider key={ch.id} value={getVal(ch.id)} onChange={(v) => setOverrides((p) => ({ ...p, [ch.id]: v }))} color={lang.color} icon={ch.icon} glow={isDiffusing} />
                ))}
                <div style={{ width: "1px", background: "#333", margin: "20px 2px", alignSelf: "stretch" }} />
                <VSlider value={smellVal} onChange={(v) => setOverrides((p) => ({ ...p, 4: v }))} color={SMELL_CHANNEL.color} icon={SMELL_CHANNEL.icon} glow={isDiffusing && smellVal > 15} />
              </div>

              <button className="sc-diffuse-btn" onClick={handleDiffuse} style={{ background: isDiffusing ? lang.color + "12" : "#0c0c0c", border: `2px solid ${isDiffusing ? lang.color : "#2a2a2a"}`, borderRadius: "7px", padding: "0", cursor: "pointer", fontFamily: "var(--mono)", fontSize: "18px", fontWeight: 500, color: isDiffusing ? lang.color : "#555", letterSpacing: "4px", transition: "all .4s", "--gc": isDiffusing ? lang.color + "40" : "transparent", animation: isDiffusing ? "glowBtn 2s infinite" : "none", position: "relative", overflow: "hidden" }}>
                {isDiffusing && <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${(diffuseTimer / DIFFUSE_DURATION) * 100}%`, background: lang.color + "18", transition: "width 1s linear" }} />}
                <div style={{ position: "relative", padding: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <span>{isDiffusing ? "■ STOP" : "▶ DIFFUSE"}</span>
                  {isDiffusing && <span style={{ fontSize: "15px", opacity: 0.7, fontVariantNumeric: "tabular-nums", minWidth: "18px" }}>{diffuseTimer}s</span>}
                </div>
              </button>

              <div style={{ fontFamily: "var(--mono)", fontSize: "15px", color: "#999", textAlign: "center", padding: "5px", background: "#060606", borderRadius: "3px", wordBreak: "break-all" }}>
                <span style={{ color: "#aaa" }}>{proto.toUpperCase()}</span> {isDiffusing ? cmdStr : "—"}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* EMPTY */}
      {!lang && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "44px 16px", animation: "fadeIn .5s" }}>
          <p style={{ fontFamily: "var(--serif)", fontSize: "20px", fontWeight: 300, color: "#888", fontStyle: "italic", textAlign: "center", lineHeight: "1.9" }}>
            Мёртвые языки нельзя запустить.<br />Но можно вдохнуть.
          </p>
          <p style={{ fontFamily: "var(--mono)", fontSize: "15px", color: "#888", letterSpacing: "4px", marginTop: "14px" }}>PYTHON · FORTRAN I · COBOL</p>
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
