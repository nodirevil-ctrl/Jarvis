import { useState, useRef, useEffect } from "react";

// 👇 Google AI Studio dan olgan API keyingizni shu yerga kiriting
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";
const GEMINI_MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `Sen JARVIS — Nodirbek uchun maxsus yaratilgan sun'iy intellekt yordamchisan.

Xarakteringni JARVIS uslubida saqla:
- Har doim "Sir" deb murojaat qil
- Professional, lo'nda va aniq gapir
- Ba'zan kichik hazil aral (Stark uslubida)
- Texnik ma'lumotlarni qisqa va ravshan ber
- Xavf yoki muhim ogohlantirishlarni ALERT deb belgiла

Qobiliyatlaring:
- Dasturlash: kod yozish, debug, arxitektura tahlili
- Trading: bozor tahlili, risk menejment, strategiyalar
- Tizim tahlili va optimizatsiya
- Umumiy bilim va muammolarni hal qilish

Javob formati:
- Qisqa va aniq (3-5 gap, kerak bo'lsa ko'proq)
- Muhim so'zlarni **bold** qil
- Kodlarni \`kod\` ichida ko'rsat
- Har javobning boshida holat: [TAYYOR] [TAHLIL] [OGOHLANTIRISH] [BAJARILDI]

Tillar: O'zbek, Rus, Ingliz — foydalanuvchi qaysi tilda yozsa, shunda javob ber.`;

const QUICK_CMDS = ["Tizim holati", "BTC tahlili", "Python kod yoz", "Bugungi reja"];

const ArcReactor = () => (
  <svg width="100" height="100" viewBox="0 0 100 100">
    <defs>
      <radialGradient id="coreGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="30%" stopColor="#00f5ff" />
        <stop offset="100%" stopColor="#001133" stopOpacity="0.2" />
      </radialGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="2.5" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <circle cx="50" cy="50" r="46" fill="none" stroke="#00f5ff" strokeWidth="0.8" strokeOpacity="0.25"/>
    <circle cx="50" cy="50" r="40" fill="none" stroke="#0080ff" strokeWidth="0.5" strokeOpacity="0.4"/>
    {[0,45,90,135,180,225,270,315].map((a, i) => (
      <line key={i}
        x1={50 + 28 * Math.cos(a * Math.PI / 180)} y1={50 + 28 * Math.sin(a * Math.PI / 180)}
        x2={50 + 38 * Math.cos(a * Math.PI / 180)} y2={50 + 38 * Math.sin(a * Math.PI / 180)}
        stroke="#00f5ff" strokeWidth="1.8" strokeOpacity="0.7" filter="url(#glow)"
      />
    ))}
    {[0,1,2,3,4,5].map(i => {
      const a1 = (i * 60 - 90) * Math.PI / 180;
      const a2 = ((i+1) * 60 - 90) * Math.PI / 180;
      return <line key={i}
        x1={50 + 20 * Math.cos(a1)} y1={50 + 20 * Math.sin(a1)}
        x2={50 + 20 * Math.cos(a2)} y2={50 + 20 * Math.sin(a2)}
        stroke="#0080ff" strokeWidth="1.2" strokeOpacity="0.9"
      />;
    })}
    <circle cx="50" cy="50" r="14" fill="url(#coreGrad)" filter="url(#glow)"/>
    <circle cx="50" cy="50" r="7" fill="#00f5ff" fillOpacity="0.95" filter="url(#glow)"/>
    <circle cx="50" cy="50" r="3" fill="white"/>
  </svg>
);

const getTag = (content) => {
  const m = content.match(/^\[([A-ZOGL']+)\]/);
  if (!m) return null;
  const colors = { TAYYOR:"#00ff88", TAHLIL:"#00f5ff", OGOHLANTIRISH:"#ff6b35", BAJARILDI:"#00ff88", XATO:"#ff3333", ALERT:"#ff6b35" };
  return { label: m[1], color: colors[m[1]] || "#00f5ff" };
};

const FormatMsg = ({ text }) => {
  const body = text.replace(/^\[.*?\]\s*/, "");
  return (
    <div>
      {body.split("\n").map((line, i) => {
        if (!line) return <div key={i} style={{ height: 5 }} />;
        const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        return (
          <p key={i} style={{ margin: "2px 0", lineHeight: 1.65 }}>
            {parts.map((p, j) => {
              if (p.startsWith("**") && p.endsWith("**"))
                return <strong key={j} style={{ color: "#00f5ff" }}>{p.slice(2,-2)}</strong>;
              if (p.startsWith("`") && p.endsWith("`"))
                return <code key={j} style={{ background:"rgba(0,245,255,0.12)", color:"#00f5ff", padding:"1px 6px", borderRadius:3, fontFamily:"monospace", fontSize:12 }}>{p.slice(1,-1)}</code>;
              return p;
            })}
          </p>
        );
      })}
    </div>
  );
};

export default function JarvisAgent() {
  const [messages, setMessages] = useState([
    { role:"assistant", content:"[TAYYOR] Tizim faollashtirildi, Sir. Barcha modullar ishga tushdi. Bugun sizga qanday yordam bera olaman?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [time, setTime] = useState(new Date());
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const speak = (text) => {
    if (!ttsEnabled || !window.speechSynthesis) return;
    const clean = text.replace(/\[.*?\]/g, "").replace(/\*\*/g, "").replace(/`/g, "").trim();
    if (!clean) return;

    const doSpeak = () => {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(clean);
      const voices = window.speechSynthesis.getVoices();
      const uz = voices.find(v => v.lang.startsWith("uz"));
      const ru = voices.find(v => v.lang.startsWith("ru"));
      const en = voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("male"))
              || voices.find(v => v.lang.startsWith("en"));
      utter.voice = uz || ru || en || voices[0] || null;
      utter.rate = 0.92;
      utter.pitch = 0.82;
      utter.volume = 1;
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utter);
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      doSpeak();
    } else {
      // Voices hali yuklanmagan — event kutamiz
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        doSpeak();
      };
      // 500ms dan keyin baribir urinib ko'ramiz (fallback)
      setTimeout(doSpeak, 500);
    }
  };

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages, loading]);

  const sendMessage = async (txt) => {
    const userText = txt || input.trim();
    if (!userText || loading) return;
    setInput("");

    const userMsg = { role:"user", content:userText };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);

    try {
      // Gemini contents formatiga o'tkazish
      // "assistant" → "model", system promptni birinchi "user" xabar sifatida yuboramiz
      const geminiContents = [
        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
        { role: "model", parts: [{ text: "[TAYYOR] Tushunarli, Sir. Buyruqlaringizni kutaman." }] },
        ...history.map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
      ];

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY,
          },
          body: JSON.stringify({ contents: geminiContents }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setMessages([...history, { role:"assistant", content:`[XATO] HTTP ${res.status}: ${data?.error?.message || "Server xatosi"}` }]);
        return;
      }

      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "[XATO] Bo'sh javob.";
      setMessages([...history, { role:"assistant", content:reply }]);
      if (ttsEnabled) speak(reply);
    } catch (err) {
      setMessages([...history, { role:"assistant", content:`[XATO] ${err?.message || "Tarmoq muammosi"}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:"#020b18", color:"#8ab8d4", fontFamily:"'Courier New',monospace", display:"flex", flexDirection:"column", alignItems:"center", position:"relative", overflow:"hidden" }}>
      <style>{`
        @keyframes rotate { to{transform:rotate(360deg)} }
        @keyframes scan { 0%{top:-2px} 100%{top:100%} }
        @keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes wave { from{height:4px} to{height:22px} }
        ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:#0080ff33;border-radius:2px}
        textarea:focus{outline:none} textarea::placeholder{color:#1a4060;letter-spacing:1px}
        .cmd-btn:hover{background:rgba(0,245,255,0.12)!important;color:#00f5ff!important;border-color:rgba(0,245,255,0.4)!important}
      `}</style>

      {/* Grid */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", backgroundImage:"linear-gradient(rgba(0,128,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,128,255,0.04) 1px,transparent 1px)", backgroundSize:"40px 40px" }}/>

      {/* Scan line */}
      <div style={{ position:"fixed", left:0, right:0, height:"1px", background:"linear-gradient(90deg,transparent,#00f5ff22,transparent)", animation:"scan 7s linear infinite", pointerEvents:"none", zIndex:1 }}/>

      {/* HUD */}
      <div style={{ position:"fixed", top:14, left:16, fontSize:10, color:"#0a3a5a", lineHeight:2, zIndex:5, letterSpacing:1 }}>
        <div>■ SYS ONLINE</div><div>■ CPU 08%</div><div>■ NET SECURE</div>
      </div>
      <div style={{ position:"fixed", top:14, right:16, fontSize:10, color:"#0a3a5a", textAlign:"right", lineHeight:2, zIndex:5, letterSpacing:1 }}>
        <div>{time.toLocaleTimeString()}</div>
        <div>{time.toLocaleDateString()}</div>
        <div>JARVIS v4.1</div>
      </div>

      {/* Content */}
      <div style={{ width:"100%", maxWidth:780, flex:1, display:"flex", flexDirection:"column", padding:"20px 20px 0", zIndex:3 }}>

        {/* Header */}
        <div style={{ textAlign:"center", padding:"28px 0 16px" }}>
          <div style={{ display:"inline-block", animation:"rotate 10s linear infinite", marginBottom:12 }}>
            <ArcReactor/>
          </div>
          <div style={{ fontSize:26, letterSpacing:10, color:"#00f5ff", fontWeight:"bold", textShadow:"0 0 24px #00f5ff66" }}>J.A.R.V.I.S</div>
          <div style={{ fontSize:10, letterSpacing:4, color:"#0a4060", marginTop:4 }}>JUST A RATHER VERY INTELLIGENT SYSTEM</div>
          <div style={{ display:"flex", justifyContent:"center", gap:20, marginTop:12 }}>
            {["NEURAL","ONLINE","SECURE"].map((s,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:"#0a5070" }}>
                <div style={{ width:5, height:5, borderRadius:"50%", background:"#00ff88", boxShadow:"0 0 6px #00ff88", animation:`pulse ${1.5+i*0.3}s ease-in-out infinite` }}/>{s}
              </div>
            ))}
          </div>
        </div>

        <div style={{ height:1, background:"linear-gradient(90deg,transparent,#00f5ff33,transparent)", margin:"0 0 14px" }}/>

        {/* Quick cmds */}
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
          {QUICK_CMDS.map((cmd,i) => (
            <button key={i} className="cmd-btn" onClick={() => sendMessage(cmd)}
              style={{ background:"rgba(0,128,255,0.07)", border:"1px solid rgba(0,245,255,0.15)", color:"#0a6080", padding:"5px 13px", borderRadius:4, cursor:"pointer", fontSize:11, letterSpacing:1, fontFamily:"'Courier New',monospace", transition:"all 0.2s" }}>
              ▶ {cmd.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:12, paddingBottom:8, minHeight:280 }}>
          {messages.map((msg, i) => {
            const tag = msg.role === "assistant" ? getTag(msg.content) : null;
            return (
              <div key={i} style={{ animation:"fadeUp 0.3s ease", display:"flex", flexDirection:msg.role==="user"?"row-reverse":"row", gap:10, alignItems:"flex-start" }}>
                <div style={{ width:30, height:30, borderRadius:3, flexShrink:0, border:msg.role==="user"?"1px solid #0060aa":"1px solid #00f5ff33", background:msg.role==="user"?"rgba(0,96,170,0.18)":"rgba(0,245,255,0.04)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:msg.role==="user"?"#0080cc":"#00f5ff", letterSpacing:1 }}>
                  {msg.role==="user"?"SIR":"AI"}
                </div>
                <div style={{ maxWidth:"83%", background:msg.role==="user"?"rgba(0,96,170,0.09)":"rgba(0,20,40,0.75)", border:msg.role==="user"?"1px solid rgba(0,128,255,0.18)":"1px solid rgba(0,245,255,0.12)", padding:"10px 14px", borderRadius:4, fontSize:13 }}>
                  {tag && (
                    <div style={{ fontSize:10, letterSpacing:2, marginBottom:6, color:tag.color, display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ width:5, height:5, borderRadius:"50%", background:tag.color, boxShadow:`0 0 5px ${tag.color}` }}/>{tag.label}
                    </div>
                  )}
                  {msg.role==="assistant" ? <FormatMsg text={msg.content}/> : <p style={{ margin:0, lineHeight:1.6 }}>{msg.content}</p>}
                </div>
              </div>
            );
          })}

          {loading && (
            <div style={{ display:"flex", gap:10, alignItems:"center", animation:"fadeUp 0.3s ease" }}>
              <div style={{ width:30, height:30, borderRadius:3, border:"1px solid #00f5ff33", background:"rgba(0,245,255,0.04)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#00f5ff" }}>AI</div>
              <div style={{ background:"rgba(0,20,40,0.75)", border:"1px solid rgba(0,245,255,0.12)", padding:"11px 16px", borderRadius:4, fontSize:11, color:"#0a5070", letterSpacing:2, display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", border:"1.5px solid #00f5ff", borderTopColor:"transparent", animation:"spin 0.8s linear infinite" }}/>
                TAHLIL QILINMOQDA...
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        <div style={{ height:1, background:"linear-gradient(90deg,transparent,#00f5ff33,transparent)", margin:"14px 0 12px" }}/>

        {/* Speaking indicator */}
        {speaking && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:8, fontSize:10, color:"#00f5ff", letterSpacing:2 }}>
            {[0,1,2,3,4,5,6,7].map(i => (
              <div key={i} style={{ width:3, borderRadius:2, background:"#00f5ff", animation:`wave ${0.4+i*0.07}s ease-in-out infinite alternate`, minHeight:4 }}/>
            ))}
            <span style={{ marginLeft:4 }}>JARVIS GAPIRMOQDA...</span>
            {[7,6,5,4,3,2,1,0].map(i => (
              <div key={i} style={{ width:3, borderRadius:2, background:"#00f5ff", animation:`wave ${0.4+i*0.07}s ease-in-out infinite alternate`, minHeight:4 }}/>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ display:"flex", gap:8, alignItems:"flex-end", background:"rgba(0,12,28,0.95)", border:`1px solid ${speaking?"rgba(0,245,255,0.4)":"rgba(0,245,255,0.18)"}`, borderRadius:4, padding:"10px 10px 10px 14px", marginBottom:16, transition:"border-color 0.3s" }}>
          <span style={{ fontSize:11, color:"#0a5070", paddingBottom:6, flexShrink:0 }}>▶</span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="BUYRUQ KIRITING, SIR..."
            rows={1}
            style={{ flex:1, background:"transparent", border:"none", color:"#8ab8d4", fontSize:13, resize:"none", lineHeight:1.6, maxHeight:100, overflowY:"auto", fontFamily:"'Courier New',monospace" }}
            onInput={e => { e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,100)+"px"; }}
          />
          {/* TTS toggle */}
          <button
            onClick={() => { setTtsEnabled(p => !p); window.speechSynthesis?.cancel(); setSpeaking(false); }}
            title={ttsEnabled ? "Ovozni o'chirish" : "Ovozni yoqish"}
            style={{ width:34, height:34, borderRadius:4, background:ttsEnabled?"rgba(0,245,255,0.1)":"rgba(255,60,60,0.08)", border:`1px solid ${ttsEnabled?"rgba(0,245,255,0.3)":"rgba(255,60,60,0.3)"}`, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0, transition:"all 0.2s" }}>
            {ttsEnabled ? "🔊" : "🔇"}
          </button>
          {/* Send */}
          <button onClick={() => sendMessage()} disabled={!input.trim()||loading}
            style={{ width:34, height:34, borderRadius:4, background:input.trim()&&!loading?"rgba(0,245,255,0.14)":"rgba(0,245,255,0.04)", border:`1px solid ${input.trim()&&!loading?"rgba(0,245,255,0.45)":"rgba(0,245,255,0.08)"}`, cursor:input.trim()&&!loading?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", color:input.trim()&&!loading?"#00f5ff":"#0a3050", fontSize:15, flexShrink:0, transition:"all 0.2s" }}>
            ▶
          </button>
        </div>

        <div style={{ textAlign:"center", fontSize:10, color:"#051525", marginBottom:16, letterSpacing:2 }}>
          STARK INDUSTRIES · JARVIS AI · POWERED BY GEMINI
        </div>
      </div>
    </div>
  );
}
