import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { Player } from "./Player.js";

const centered: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100vh",
  width: "100vw",
  background: "#000",
  fontFamily: "sans-serif",
  color: "#fff",
  gap: "1rem",
};

function ScreenSetup({
  onRegistered,
}: {
  onRegistered: (screenId: string, apiKey: string) => void;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const register = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/screens/auto-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error(`Registration failed (${res.status})`);
      const data = await res.json();
      if (!data.id || !data.api_key)
        throw new Error("Invalid response from server.");
      localStorage.setItem("screenId", data.id);
      localStorage.setItem("apiKey", data.api_key);
      onRegistered(data.id, data.api_key);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  return (
    <div style={centered}>
      <p style={{ fontSize: "1.1rem", color: "#aaa", margin: 0 }}>
        Name this screen
      </p>
      <input
        autoFocus
        placeholder="e.g. Lobby Screen"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && register()}
        disabled={loading}
        style={{
          background: "#111",
          border: "1px solid #444",
          borderRadius: "8px",
          color: "#fff",
          fontSize: "1.25rem",
          padding: "0.6rem 1rem",
          width: "280px",
          outline: "none",
          textAlign: "center",
        }}
      />
      <button
        onClick={register}
        disabled={loading || !name.trim()}
        style={{
          background: loading || !name.trim() ? "#333" : "#2563eb",
          color: loading || !name.trim() ? "#666" : "#fff",
          border: "none",
          borderRadius: "8px",
          padding: "0.6rem 2rem",
          fontSize: "1rem",
          cursor: loading || !name.trim() ? "not-allowed" : "pointer",
          transition: "background 0.15s",
        }}
      >
        {loading ? "Registering…" : "Register"}
      </button>
      {error && (
        <p style={{ color: "#f66", margin: 0, fontSize: "0.9rem" }}>{error}</p>
      )}
    </div>
  );
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const [screenId, setScreenId] = useState(
    params.get("screenId") ?? localStorage.getItem("screenId") ?? "",
  );
  const [apiKey, setApiKey] = useState(
    params.get("apiKey") ?? localStorage.getItem("apiKey") ?? "",
  );

  if (!screenId || !apiKey) {
    return (
      <ScreenSetup
        onRegistered={(id, key) => {
          setScreenId(id);
          setApiKey(key);
        }}
      />
    );
  }

  return <Player screenId={screenId} apiKey={apiKey} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
