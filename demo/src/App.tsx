import { useState } from "react";
import { Dashboard } from "./dashboard/Dashboard";
import { DemoGallery } from "./DemoGallery";

type Tab = "gallery" | "dashboard";

export default function App() {
  const [tab, setTab] = useState<Tab>("gallery");

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-neutral-200 bg-white/90 px-6 py-3 backdrop-blur-sm">
        <span className="text-sm font-semibold tracking-tight text-neutral-900">DSLint demo</span>
        <div className="flex rounded-lg bg-neutral-100 p-0.5">
          <button
            type="button"
            onClick={() => setTab("gallery")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              tab === "gallery"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            Gallery
          </button>
          <button
            type="button"
            onClick={() => setTab("dashboard")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              tab === "dashboard"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            Dashboard
          </button>
        </div>
      </nav>

      {tab === "gallery" ? <DemoGallery /> : <Dashboard />}
    </div>
  );
}
