import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Monitor, Image, ListVideo, Calendar, LogOut } from "lucide-react";
import { useState } from "react";
import { Screens } from "./pages/Screens.js";
import { ScreenDetail } from "./pages/ScreenDetail.js";
import { Media } from "./pages/Media.js";
import { Playlists } from "./pages/Playlists.js";
import { Schedules } from "./pages/Schedules.js";
import { Login } from "./pages/Login.js";

const qc = new QueryClient();
const nav = [
  { to: "/screens", icon: Monitor, label: "Screens" },
  { to: "/media", icon: Image, label: "Media" },
  { to: "/playlists", icon: ListVideo, label: "Playlists" },
  { to: "/schedules", icon: Calendar, label: "Schedules" },
];

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem("adminToken") ?? "");

  if (!token) return <Login onLogin={setToken} />;

  const logout = () => { localStorage.removeItem("adminToken"); setToken(""); };

  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <div className="flex h-screen">
          <nav className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col py-6 gap-1 shrink-0">
            <div className="px-4 mb-6 text-lg font-bold text-blue-400">
              Hackathon Tools
            </div>
            {nav.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 text-sm rounded-lg mx-2 transition-colors ` +
                  (isActive
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white")
                }
              >
                <Icon size={18} /> {label}
              </NavLink>
            ))}
            <button
              onClick={logout}
              className="flex items-center gap-3 px-4 py-2.5 text-sm rounded-lg mx-2 mt-auto text-gray-500 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <LogOut size={18} /> Logout
            </button>
          </nav>
          <main className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/screens" replace />} />
              <Route path="/screens" element={<Screens />} />
              <Route path="/screens/:id" element={<ScreenDetail />} />
              <Route path="/media" element={<Media />} />
              <Route path="/playlists" element={<Playlists />} />
              <Route path="/schedules" element={<Schedules />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
