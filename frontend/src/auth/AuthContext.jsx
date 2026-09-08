import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  // Use sessionStorage — isolated per browser tab, so logging out in one tab
  // does NOT affect other tabs (admin vs user testing simultaneously)
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("user");
      return saved ? JSON.parse(saved) : null;
    } catch (_) { return null; }
  });

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
    // Also store token if present
    if (userData.token) localStorage.setItem("token", userData.token);
  };

  const logout = () => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        }).catch(() => {});
      }
    } catch (_) {}

    // Disconnect global socket if initialized on window
    try {
      if (window.__crmSocket && typeof window.__crmSocket.disconnect === "function") {
        window.__crmSocket.disconnect();
      }
    } catch (_) {}

    // Clear all client storage completely
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    }

    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
