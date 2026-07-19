import { useState, useEffect, useRef, useCallback } from "react";

const BASE = import.meta.env.BASE_URL;

const BUILD_URL =
  "https://expo.dev/accounts/aryuxxs-team/projects/s-movie/builds/16728804-eddc-4c99-be8d-7be51fc7e839";

const FEATURES = [
  { icon: "🎬", title: "Movies & Web Series", desc: "Thousands of titles in HD quality with multi-server support" },
  { icon: "🇯🇵", title: "Anime Library", desc: "Full anime catalog with Hindi & English dub support" },
  { icon: "🔥", title: "New & Hot", desc: "Trending content, coming-soon releases & inline trailers" },
  { icon: "🌙", title: "Dark Cinema UI", desc: "Crafted for late-night watching — pure dark aesthetic" },
  { icon: "⚡", title: "Fast Streaming", desc: "Multiple servers, smart buffering, zero lag playback" },
  { icon: "🎵", title: "Hindi Trailers", desc: "Auto-fetches Hindi trailers so you always see the vibe" },
];

const STEPS = [
  { n: "01", title: "Download the APK", desc: "Tap the button and save the APK file to your Android device." },
  { n: "02", title: "Allow Unknown Sources", desc: "Settings → Security → Enable 'Install from Unknown Sources'." },
  { n: "03", title: "Install & Watch", desc: "Open the APK, install, and start streaming instantly." },
];

export default function App() {
  const [scrollY, setScrollY] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const navOpaque = scrollY > 60;

  return (
    <div style={{ background: "#05091a", minHeight: "100vh", color: "#fff", fontFamily: "'Inter', system-ui, sans-serif", overflowX: "hidden" }}>

      {/* ─── Global styles injected ──────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #05091a; }
        ::selection { background: rgba(229,9,20,0.35); }
        .dl-btn {
          display: inline-flex; align-items: center; gap: 10px;
          background: linear-gradient(135deg, #E50914 0%, #b8070f 100%);
          color: #fff; text-decoration: none; border-radius: 50px;
          padding: 16px 36px; font-weight: 800; font-size: 16px;
          box-shadow: 0 8px 32px rgba(229,9,20,0.45), 0 0 0 0 rgba(229,9,20,0.4);
          transition: transform 0.2s, box-shadow 0.2s;
          letter-spacing: -0.2px;
        }
        .dl-btn:hover {
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 16px 48px rgba(229,9,20,0.55), 0 0 40px rgba(229,9,20,0.2);
        }
        .dl-btn:active { transform: translateY(0) scale(0.98); }
        .glass-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(16px);
          border-radius: 24px;
          transition: background 0.25s, border-color 0.25s, transform 0.25s;
        }
        .glass-card:hover {
          background: rgba(229,9,20,0.07);
          border-color: rgba(229,9,20,0.3);
          transform: translateY(-4px);
        }
        .glow-orb {
          position: absolute; border-radius: 50%;
          filter: blur(80px); pointer-events: none;
        }
        @keyframes float {
          0%,100% { transform: translateY(0px); }
          50% { transform: translateY(-14px); }
        }
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(229,9,20,0.5); }
          70% { box-shadow: 0 0 0 24px rgba(229,9,20,0); }
          100% { box-shadow: 0 0 0 0 rgba(229,9,20,0); }
        }
        .logo-float { animation: float 5s ease-in-out infinite; }
        .logo-pulse { animation: pulse-ring 2.8s ease-out infinite; }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .shimmer-text {
          background: linear-gradient(90deg, #fff 30%, #E50914 50%, #fff 70%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }
        .step-line::after {
          content: ''; position: absolute;
          left: 21px; top: 100%; width: 2px; height: 100%;
          background: linear-gradient(to bottom, rgba(229,9,20,0.4), transparent);
        }
      `}</style>

      {/* ─── Navbar ──────────────────────────────────────────────────────── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
        padding: "14px 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: navOpaque ? "rgba(5,9,26,0.88)" : "transparent",
        backdropFilter: navOpaque ? "blur(24px) saturate(180%)" : "none",
        borderBottom: navOpaque ? "1px solid rgba(255,255,255,0.06)" : "none",
        transition: "all 0.4s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, overflow: "hidden", border: "1.5px solid rgba(229,9,20,0.5)", flexShrink: 0 }}>
            <img src={`${BASE}app-logo.png`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.4px" }}>
            S-Movie <span style={{ color: "#E50914" }}>Original</span>
          </span>
        </div>
        {/* Three-dot menu */}
        <div ref={menuRef} style={{ position: "relative" }}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            style={{
              width: 38, height: 38, borderRadius: "50%",
              background: menuOpen ? "rgba(229,9,20,0.15)" : "rgba(255,255,255,0.07)",
              border: `1px solid ${menuOpen ? "rgba(229,9,20,0.4)" : "rgba(255,255,255,0.12)"}`,
              cursor: "pointer", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 4,
              transition: "all 0.2s",
            }}
          >
            {[0,1,2].map((i) => (
              <span key={i} style={{
                width: 4, height: 4, borderRadius: "50%",
                background: menuOpen ? "#E50914" : "rgba(255,255,255,0.75)",
                display: "block", transition: "background 0.2s",
              }} />
            ))}
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 10px)", right: 0,
              background: "rgba(10,14,30,0.96)", backdropFilter: "blur(24px)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16,
              minWidth: 200, padding: "8px 0", boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
              zIndex: 999,
            }}>
              <a
                href={BUILD_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 18px", color: "#fff", textDecoration: "none",
                  fontSize: 14, fontWeight: 600, transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(229,9,20,0.12)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="#E50914"><path d="M12 16l-5-5h3V4h4v7h3l-5 5zm-7 4v-2h14v2H5z"/></svg>
                Download APK
              </a>
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />
              <a
                href="#features"
                onClick={() => setMenuOpen(false)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 18px", color: "rgba(255,255,255,0.7)", textDecoration: "none",
                  fontSize: 14, fontWeight: 500, transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Features
              </a>
              <a
                href="#install"
                onClick={() => setMenuOpen(false)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 18px", color: "rgba(255,255,255,0.7)", textDecoration: "none",
                  fontSize: 14, fontWeight: 500, transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8 21 12 17 16 21"/></svg>
                How to Install
              </a>
            </div>
          )}
        </div>
      </nav>

      {/* ─── Hero ────────────────────────────────────────────────────────── */}
      <section ref={heroRef} style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "130px 24px 90px", overflow: "hidden" }}>

        {/* Background orbs */}
        <div className="glow-orb" style={{ width: 700, height: 700, background: "rgba(229,9,20,0.12)", top: "-200px", left: "50%", transform: "translateX(-50%)" }} />
        <div className="glow-orb" style={{ width: 400, height: 400, background: "rgba(11,79,212,0.1)", bottom: "0", left: "-100px" }} />
        <div className="glow-orb" style={{ width: 350, height: 350, background: "rgba(229,9,20,0.08)", bottom: "-50px", right: "-50px" }} />

        {/* Noise grain overlay */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")", opacity: 0.4, pointerEvents: "none" }} />

        {/* Grid lines */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize: "60px 60px", pointerEvents: "none" }} />

        {/* Logo */}
        <div className="logo-float" style={{ position: "relative", zIndex: 1, marginBottom: 36 }}>
          <div style={{ width: 130, height: 130, borderRadius: 34, overflow: "hidden" }}>
            <img src={`${BASE}app-logo.png`} alt="S-Movie Original" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </div>

        {/* Badge */}
        <div style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(229,9,20,0.12)", border: "1px solid rgba(229,9,20,0.25)", borderRadius: 100, padding: "5px 16px 5px 12px", marginBottom: 24, fontSize: 11, fontWeight: 700, color: "#ff6b6b", letterSpacing: "1px", textTransform: "uppercase" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#E50914", boxShadow: "0 0 8px #E50914", display: "inline-block", animation: "pulse-ring 2s ease-out infinite" }} />
          Free · Android APK
        </div>

        {/* Headline */}
        <h1 style={{ position: "relative", zIndex: 1, fontSize: "clamp(2.6rem, 7vw, 5rem)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-2px", marginBottom: 22, maxWidth: 820 }}>
          Watch Movies, Series
          <br />
          <span className="shimmer-text">&amp; Anime</span>
          {" "}— Anywhere
        </h1>

        {/* Subtext */}
        <p style={{ position: "relative", zIndex: 1, fontSize: "clamp(1rem, 2vw, 1.18rem)", color: "rgba(255,255,255,0.48)", maxWidth: 500, lineHeight: 1.7, marginBottom: 48 }}>
          S-Movie Original is your all-in-one streaming companion — HD quality, Hindi trailers, anime & a beautiful dark UI.
        </p>

        {/* Platform download buttons */}
        <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginBottom: 16 }}>

          {/* Android APK — Active */}
          <a href={BUILD_URL} target="_blank" rel="noopener noreferrer" className="dl-btn">
            {/* Android robot icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zm-2.5-1C2.67 17 2 17.67 2 18.5v-9C2 8.67 2.67 8 3.5 8S5 8.67 5 9.5v9c0 .83-.67 1.5-1.5 1.5zm17 0c-.83 0-1.5-.67-1.5-1.5v-9c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5zm-4.97-15.16l1.27-1.27c.19-.19.19-.51 0-.7-.19-.19-.51-.19-.7 0l-1.46 1.46C15.11 1.12 14.09.85 13 .85s-2.11.27-3.04.48L8.5 1.87c-.19-.19-.51-.19-.7 0-.19.19-.19.51 0 .7l1.27 1.27C7.69 4.72 6.5 6.67 6.5 8h13c0-1.33-1.19-3.28-3.97-4.16zM10 6H9V5h1v1zm5 0h-1V5h1v1z"/>
            </svg>
            Android APK — Free
          </a>

          {/* iOS — Coming Soon */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 50, padding: "16px 28px", fontWeight: 700, fontSize: 15,
            color: "rgba(255,255,255,0.35)", cursor: "not-allowed", userSelect: "none",
            position: "relative",
          }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.4 }}>
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            iOS
            <span style={{
              position: "absolute", top: -8, right: 12,
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 100, padding: "2px 8px", fontSize: 9, fontWeight: 700,
              color: "rgba(255,255,255,0.4)", letterSpacing: "0.8px",
            }}>SOON</span>
          </div>

          {/* PC / Windows — Coming Soon */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 50, padding: "16px 28px", fontWeight: 700, fontSize: 15,
            color: "rgba(255,255,255,0.35)", cursor: "not-allowed", userSelect: "none",
            position: "relative",
          }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.4 }}>
              <path d="M3 12V6.75l6-1.32v6.48L3 12m17-9v8.75l-10 .15V5.21L20 3M3 13l6 .09v6.81l-6-1.15V13m17 .25V22l-10-1.91V13.1L20 13.25z"/>
            </svg>
            PC / Windows
            <span style={{
              position: "absolute", top: -8, right: 12,
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 100, padding: "2px 8px", fontSize: 9, fontWeight: 700,
              color: "rgba(255,255,255,0.4)", letterSpacing: "0.8px",
            }}>SOON</span>
          </div>
        </div>

        <p style={{ position: "relative", zIndex: 1, fontSize: 11, color: "rgba(255,255,255,0.22)", letterSpacing: "0.5px" }}>
          NO SIGNUP · NO ADS · ALWAYS FREE
        </p>

        {/* Scroll indicator */}
        <div style={{ position: "absolute", bottom: 36, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: scrollY > 50 ? 0 : 1, transition: "opacity 0.4s" }}>
          <div style={{ width: 1, height: 40, background: "linear-gradient(to bottom, rgba(229,9,20,0.8), transparent)" }} />
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#E50914" }} />
        </div>
      </section>

      {/* ─── Stats strip ────────────────────────────────────────────────── */}
      <section style={{ padding: "0 24px 96px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {[
            { value: "10K+", label: "Movies & Series", icon: "🎬" },
            { value: "HD", label: "Stream Quality", icon: "✨" },
            { value: "हिन्दी", label: "Trailer Support", icon: "🎙️" },
            { value: "Free", label: "Always & Forever", icon: "❤️" },
          ].map((s) => (
            <div key={s.label} className="glass-card" style={{ textAlign: "center", padding: "28px 16px" }}>
              <div style={{ fontSize: 26, marginBottom: 10 }}>{s.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 900, background: "linear-gradient(135deg, #fff, #ccc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-1px" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4, fontWeight: 500, letterSpacing: "0.3px" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features ───────────────────────────────────────────────────── */}
      <section id="features" style={{ padding: "20px 24px 96px", maxWidth: 1060, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ display: "inline-block", background: "rgba(229,9,20,0.1)", border: "1px solid rgba(229,9,20,0.2)", borderRadius: 100, padding: "4px 16px", marginBottom: 16, fontSize: 11, fontWeight: 700, color: "#ff6b6b", letterSpacing: "1px", textTransform: "uppercase" }}>
            What's Inside
          </div>
          <h2 style={{ fontSize: "clamp(1.9rem, 4vw, 3rem)", fontWeight: 900, letterSpacing: "-1px", lineHeight: 1.1 }}>
            Everything you need to{" "}
            <span style={{ color: "#E50914" }}>stream</span>
          </h2>
          <p style={{ color: "rgba(255,255,255,0.38)", marginTop: 12, fontSize: 16 }}>Built for serious movie lovers</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          {FEATURES.map((f, i) => (
            <div key={f.title} className="glass-card" style={{ padding: "28px 26px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -20, right: -20, fontSize: 80, opacity: 0.05, lineHeight: 1, pointerEvents: "none" }}>{f.icon}</div>
              <div style={{ fontSize: 34, marginBottom: 16, display: "inline-block" }}>{f.icon}</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.3px" }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How to Install ─────────────────────────────────────────────── */}
      <section style={{ padding: "20px 24px 96px", maxWidth: 680, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <div style={{ display: "inline-block", background: "rgba(229,9,20,0.1)", border: "1px solid rgba(229,9,20,0.2)", borderRadius: 100, padding: "4px 16px", marginBottom: 16, fontSize: 11, fontWeight: 700, color: "#ff6b6b", letterSpacing: "1px", textTransform: "uppercase" }}>
            Quick Install
          </div>
          <h2 style={{ fontSize: "clamp(1.9rem, 4vw, 2.8rem)", fontWeight: 900, letterSpacing: "-1px" }}>
            Up & running in{" "}
            <span style={{ color: "#E50914" }}>3 steps</span>
          </h2>
          <p style={{ color: "rgba(255,255,255,0.38)", marginTop: 12, fontSize: 15 }}>No Play Store. No account.</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {STEPS.map((s, i) => (
            <div key={s.n} style={{ display: "flex", gap: 20, alignItems: "flex-start", position: "relative", paddingBottom: i < STEPS.length - 1 ? 0 : 0 }}>
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div style={{ position: "absolute", left: 21, top: 44, width: 2, height: "calc(100% - 20px)", background: "linear-gradient(to bottom, rgba(229,9,20,0.4), rgba(229,9,20,0.05))", zIndex: 0 }} />
              )}
              <div style={{ position: "relative", zIndex: 1, flexShrink: 0, marginTop: 4, marginBottom: 28 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg, rgba(229,9,20,0.25), rgba(229,9,20,0.1))", border: "1px solid rgba(229,9,20,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, color: "#E50914", letterSpacing: "0.5px" }}>
                  {s.n}
                </div>
              </div>
              <div className="glass-card" style={{ flex: 1, padding: "20px 22px", marginBottom: 16, borderRadius: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, letterSpacing: "-0.2px" }}>{s.title}</div>
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, lineHeight: 1.65 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Final CTA ──────────────────────────────────────────────────── */}
      <section style={{ position: "relative", padding: "80px 24px 110px", textAlign: "center", overflow: "hidden" }}>
        <div className="glow-orb" style={{ width: 600, height: 400, background: "rgba(229,9,20,0.13)", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 600, margin: "0 auto" }}>
          <div style={{ width: 80, height: 80, borderRadius: 22, overflow: "hidden", margin: "0 auto 24px", border: "2px solid rgba(229,9,20,0.5)", boxShadow: "0 0 40px rgba(229,9,20,0.3)" }}>
            <img src={`${BASE}app-logo.png`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <h2 style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", fontWeight: 900, letterSpacing: "-1.5px", lineHeight: 1.1, marginBottom: 14 }}>
            Ready to start watching?
          </h2>
          <p style={{ color: "rgba(255,255,255,0.42)", marginBottom: 40, fontSize: 16, lineHeight: 1.6 }}>
            Download S-Movie Original now — free, always. No subscriptions, no limits.
          </p>
          <a href={BUILD_URL} target="_blank" rel="noopener noreferrer" className="dl-btn" style={{ fontSize: 18, padding: "18px 44px" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 16l-5-5h3V4h4v7h3l-5 5zm-7 4v-2h14v2H5z"/></svg>
            Download APK — Free
          </a>
          <p style={{ marginTop: 18, fontSize: 11, color: "rgba(255,255,255,0.2)", letterSpacing: "0.8px", textTransform: "uppercase" }}>
            Android · APK · Version 2.0 · No Ads
          </p>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "28px 24px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, marginBottom: 10 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, overflow: "hidden", border: "1px solid rgba(229,9,20,0.4)" }}>
            <img src={`${BASE}app-logo.png`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 14, color: "rgba(255,255,255,0.45)" }}>S-Movie Original</span>
        </div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.18)", letterSpacing: "0.3px" }}>
          © {new Date().getFullYear()} S-Movie Original. Made with ❤️ for movie lovers.
        </p>
      </footer>
    </div>
  );
}
