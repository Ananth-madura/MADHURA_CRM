import React, { useEffect, useState, useCallback } from "react";
import { Bell, BellRing, X, ChevronDown } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import {
  isPushSupported,
  requestPushPermission,
  savePushPreference,
} from "../utils/pushNotifications";

// Prompts the user to allow browser notifications so reminder alerts can reach
// the OS (the in-app center popup works regardless, but desktop/background push
// needs permission). Shows an "Enable" action when permission can still be
// requested, or manual steps when the browser has blocked it.
export default function EnableNotificationsBanner() {
  const { user } = useAuth();
  const [perm, setPerm] = useState(() =>
    isPushSupported() ? Notification.permission : "unsupported",
  );
  const [dismissed, setDismissed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // The browser permission can change from its own settings UI — re-check it.
  useEffect(() => {
    if (!isPushSupported()) return;
    const sync = () => setPerm(Notification.permission);
    const iv = setInterval(sync, 3000);
    window.addEventListener("focus", sync);
    return () => {
      clearInterval(iv);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const enable = useCallback(async () => {
    const granted = await requestPushPermission();
    setPerm(isPushSupported() ? Notification.permission : "unsupported");
    if (granted) {
      savePushPreference(true);
      // Reload so the PWA manager registers a background push subscription
      // now that we're allowed (foreground popups already work immediately).
      setTimeout(() => window.location.reload(), 700);
    } else if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      setShowHelp(true);
    }
  }, []);

  if (!user) return null;
  if (!isPushSupported()) return null;
  if (perm === "granted") return null;
  if (dismissed) return null;

  const blocked = perm === "denied";

  return (
    <div
      style={{
        position: "fixed",
        top: "14px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 99998,
        width: "min(560px, calc(100vw - 24px))",
        background: blocked
          ? "linear-gradient(135deg, #f43f5e 0%, #b91c1c 100%)"
          : "linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)",
        color: "#fff",
        borderRadius: "14px",
        boxShadow: "0 16px 40px rgba(0,0,0,0.28)",
        padding: "12px 14px",
        animation: "enb-drop 0.3s cubic-bezier(0.175,0.885,0.32,1.275)",
      }}
    >
      <style>{`
        @keyframes enb-drop { from { transform: translate(-50%, -16px); opacity: 0 } to { transform: translate(-50%, 0); opacity: 1 } }
      `}</style>

      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <div
          style={{
            width: "38px",
            height: "38px",
            flexShrink: 0,
            borderRadius: "10px",
            background: "rgba(255,255,255,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {blocked ? <BellRing size={20} /> : <Bell size={20} />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "14px" }}>
            {blocked ? "Notifications are blocked" : "Turn on reminder alerts"}
          </div>
          <div style={{ fontSize: "12.5px", opacity: 0.92, marginTop: "2px", lineHeight: 1.45 }}>
            {blocked
              ? "Your browser is blocking alerts, so reminders can't reach your desktop. Allow them to get notified even when this tab is in the background."
              : "Allow notifications so reminder pop-ups also alert you on your desktop — even when the app is in another tab."}
          </div>

          {blocked && showHelp && (
            <div
              style={{
                marginTop: "10px",
                background: "rgba(0,0,0,0.18)",
                borderRadius: "10px",
                padding: "10px 12px",
                fontSize: "12px",
                lineHeight: 1.6,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: "4px" }}>How to enable:</div>
              1. Click the <strong>🔒 lock / site icon</strong> in the address bar.
              <br />
              2. Open <strong>Site settings</strong> (or "Permissions").
              <br />
              3. Set <strong>Notifications</strong> to <strong>Allow</strong>.
              <br />
              4. <strong>Refresh</strong> this page.
            </div>
          )}

          <div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
            {blocked ? (
              <>
                <button
                  onClick={() => setShowHelp((s) => !s)}
                  style={btnStyle(true)}
                >
                  {showHelp ? "Hide steps" : "How to enable"}
                  <ChevronDown
                    size={14}
                    style={{
                      transform: showHelp ? "rotate(180deg)" : "none",
                      transition: "transform 0.2s",
                    }}
                  />
                </button>
                <button onClick={() => window.location.reload()} style={btnStyle(false)}>
                  I've allowed it — Refresh
                </button>
              </>
            ) : (
              <button onClick={enable} style={btnStyle(false)}>
                Enable notifications
              </button>
            )}
          </div>
        </div>

        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          style={{
            background: "rgba(255,255,255,0.16)",
            border: "none",
            borderRadius: "8px",
            width: "26px",
            height: "26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#fff",
            flexShrink: 0,
          }}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

const btnStyle = (subtle) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "8px 14px",
  borderRadius: "9px",
  border: subtle ? "1px solid rgba(255,255,255,0.5)" : "none",
  background: subtle ? "transparent" : "#ffffff",
  color: subtle ? "#fff" : "#4338ca",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
});
