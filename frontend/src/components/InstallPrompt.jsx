import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import appIcon from "../layout/Madhura-logo.png";

const STORAGE_KEY = "achme_install_dismissed_at";
const DAYS_3_MS = 3 * 24 * 60 * 60 * 1000;

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone
  );
}

function shouldRemind() {
  const val = localStorage.getItem(STORAGE_KEY);
  if (!val) return true;
  return Date.now() - Number(val) >= DAYS_3_MS;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const iOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (shouldRemind()) {
        setTimeout(() => setVisible(true), 2000);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);

    if (iOS && shouldRemind()) {
      setTimeout(() => setVisible(true), 2000);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setVisible(false);
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl"
          >
            <div className="flex items-center gap-4 mb-4">
              <img
                src={appIcon}
                alt=""
                className="w-14 h-14 rounded-xl object-cover shadow"
              />
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-gray-900 truncate">
                  Install Achme
                </h2>
                <p className="text-sm text-gray-500">
                  {isIOS ? "Add to Home Screen" : "App installation"}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              {isIOS
                ? "Tap the Share button in Safari and scroll down to Add to Home Screen."
                : "Install for quick access, offline support and a better experience."}
            </p>
            <div className="flex flex-col gap-2">
              {isIOS ? (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm p-3 rounded-xl text-center leading-relaxed">
                  1. Tap <strong>Share</strong> icon
                  <br />
                  2. Scroll down & tap{" "}
                  <strong>Add to Home Screen</strong>
                </div>
              ) : (
                <button
                  onClick={install}
                  disabled={!deferredPrompt}
                  className="w-full py-2.5 bg-[#1e3a5f] text-white font-semibold rounded-xl hover:bg-[#162d4a] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deferredPrompt ? "Install App" : "Not available on this browser"}
                </button>
              )}
              <button
                onClick={dismiss}
                className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Remind me later
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
