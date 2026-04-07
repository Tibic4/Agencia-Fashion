"use client";

import { useState } from "react";

interface MobilePreviewProps {
  /** The creative element to display inside the phone mockup */
  children: React.ReactNode;
  /** Format: "feed" (1:1) or "stories" (9:16) */
  format?: "feed" | "stories";
}

export default function MobilePreview({
  children,
  format = "feed",
}: MobilePreviewProps) {
  const [activeFormat, setActiveFormat] = useState(format);

  const isFeed = activeFormat === "feed";

  // Phone dimensions scaled for preview — responsive
  const phoneWidth = isFeed ? 280 : 230;
  const phoneHeight = isFeed ? 520 : 480;
  const contentHeight = isFeed ? 256 : 374;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
          📲 Preview Mobile
        </span>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
          style={{ background: "var(--brand-100)", color: "var(--brand-600)" }}
        >
          Instagram
        </span>
      </div>

      {/* Format selector */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveFormat("feed")}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium transition-all min-h-[44px]"
          style={{
            background: activeFormat === "feed" ? "var(--gradient-brand)" : "var(--surface)",
            color: activeFormat === "feed" ? "white" : "var(--muted)",
            border: activeFormat === "feed" ? "none" : "1px solid var(--border)",
          }}
        >
          📸 Feed 1:1
        </button>
        <button
          onClick={() => setActiveFormat("stories")}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium transition-all min-h-[44px]"
          style={{
            background: activeFormat === "stories" ? "var(--gradient-brand)" : "var(--surface)",
            color: activeFormat === "stories" ? "white" : "var(--muted)",
            border: activeFormat === "stories" ? "none" : "1px solid var(--border)",
          }}
        >
          📱 Stories 9:16
        </button>
      </div>

      {/* Phone mockup */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid var(--border)" }}
      >
        <div
          className="flex items-center justify-center py-8"
          style={{ background: "var(--surface)" }}
        >
          <div
            style={{
              width: phoneWidth,
              maxWidth: "90vw",
              height: phoneHeight,
              background: "#000",
              borderRadius: 36,
              padding: "12px 10px",
              position: "relative",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3), inset 0 0 0 2px rgba(255,255,255,0.1)",
              margin: "0 auto",
            }}
          >
            {/* Notch / Dynamic Island */}
            <div
              style={{
                position: "absolute",
                top: 8,
                left: "50%",
                transform: "translateX(-50%)",
                width: 80,
                height: 22,
                borderRadius: 14,
                background: "#000",
                zIndex: 10,
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            />

            {/* Screen */}
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 26,
                overflow: "hidden",
                background: "#fafafa",
                position: "relative",
              }}
            >
              {/* Status bar */}
              <div
                style={{
                  height: 36,
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 16px",
                  paddingTop: 12,
                }}
              >
                <span style={{ fontSize: 9, fontWeight: 700, color: "#000" }}>9:41</span>
                <div className="flex items-center gap-1">
                  {/* Signal */}
                  <svg width="12" height="8" viewBox="0 0 16 11">
                    <rect x="0" y="7" width="3" height="4" rx="0.5" fill="#000" />
                    <rect x="4.5" y="4.5" width="3" height="6.5" rx="0.5" fill="#000" />
                    <rect x="9" y="2" width="3" height="9" rx="0.5" fill="#000" />
                    <rect x="13" y="0" width="3" height="11" rx="0.5" fill="#000" />
                  </svg>
                  {/* Battery */}
                  <svg width="18" height="9" viewBox="0 0 25 12">
                    <rect x="0" y="0.5" width="21" height="11" rx="2" stroke="#000" strokeWidth="1" fill="none" />
                    <rect x="2" y="2.5" width="16" height="7" rx="1" fill="#000" />
                    <rect x="22" y="3.5" width="3" height="5" rx="1" fill="#000" />
                  </svg>
                </div>
              </div>

              {/* Instagram header */}
              <div
                style={{
                  height: isFeed ? 38 : 32,
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  padding: "0 10px",
                  borderBottom: isFeed ? "1px solid #eee" : "none",
                  gap: 8,
                }}
              >
                {isFeed ? (
                  <>
                    {/* Profile pic */}
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #ec4899, #a855f7)",
                        border: "1.5px solid #fff",
                        boxShadow: "0 0 0 1.5px #ec4899",
                      }}
                    />
                    <div>
                      <div style={{ fontSize: 8, fontWeight: 700, color: "#000" }}>
                        minha.loja
                      </div>
                      <div style={{ fontSize: 6, color: "#888" }}>Patrocinado</div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Stories profile */}
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #ec4899, #a855f7)",
                        border: "1.5px solid #fff",
                      }}
                    />
                    <div style={{ fontSize: 8, fontWeight: 700, color: "#fff" }}>
                      minha.loja
                    </div>
                  </>
                )}
              </div>

              {/* Content area */}
              <div
                style={{
                  width: "100%",
                  height: contentHeight,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: isFeed ? "#f0f0f0" : "#000",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: contentHeight,
                    overflow: "hidden",
                  }}
                >
                  {children}
                </div>
              </div>

              {/* Instagram footer (feed only) */}
              {isFeed && (
                <div style={{ background: "#fff", padding: "8px 10px" }}>
                  {/* Action icons */}
                  <div className="flex items-center gap-3 mb-1.5">
                    {/* Heart */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    {/* Comment */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    {/* Share */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: "#000" }}>
                    237 curtidas
                  </div>
                  <div style={{ fontSize: 7, color: "#000", marginTop: 2 }}>
                    <strong>minha.loja</strong>{" "}
                    <span style={{ color: "#555" }}>✨ Acabou de chegar e já é sucesso!</span>
                  </div>
                  <div style={{ fontSize: 6, color: "#888", marginTop: 3 }}>
                    Ver todos os 14 comentários
                  </div>
                </div>
              )}

              {/* Stories bottom (stories only) */}
              {!isFeed && (
                <div style={{ padding: "8px 10px", background: "transparent", position: "absolute", bottom: 30, left: 0, right: 0 }}>
                  <div
                    style={{
                      width: "100%",
                      height: 28,
                      borderRadius: 20,
                      border: "1px solid rgba(255,255,255,0.4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span style={{ fontSize: 8, color: "rgba(255,255,255,0.7)" }}>
                      Enviar mensagem
                    </span>
                  </div>
                </div>
              )}

              {/* Home bar */}
              <div
                style={{
                  position: "absolute",
                  bottom: 4,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 100,
                  height: 4,
                  borderRadius: 2,
                  background: isFeed ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.3)",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
