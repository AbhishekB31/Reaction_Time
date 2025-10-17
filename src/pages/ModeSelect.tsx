import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";

export default function ModeSelect() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const name = (search.get("name") ?? "").trim();

  useEffect(() => {
    if (!name) navigate("/");
  }, [name, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Select Mode</h1>
          <p className="text-xl opacity-80">Playing as <b>{name}</b></p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <button
            className="rounded-2xl border-2 p-8 text-left hover:shadow-lg hover:scale-105 transition-all duration-200 bg-card"
            onClick={() => navigate(`/play?name=${encodeURIComponent(name)}`)}
          >
            <h2 className="text-xl font-semibold mb-3">Single Reaction</h2>
            <p className="text-base opacity-70">One reaction try (existing mode)</p>
          </button>

          <button
            className="rounded-2xl border-2 p-8 text-left hover:shadow-lg hover:scale-105 transition-all duration-200 bg-card"
            onClick={() => navigate(`/rt60?name=${encodeURIComponent(name)}`)}
          >
            <h2 className="text-xl font-semibold mb-3">Reaction — 60 seconds</h2>
            <p className="text-base opacity-70">Multiple cycles for 1 minute</p>
          </button>

          <button
            className="rounded-2xl border-2 p-8 text-left hover:shadow-lg hover:scale-105 transition-all duration-200 bg-card"
            onClick={() => navigate(`/cps?name=${encodeURIComponent(name)}`)}
          >
            <h2 className="text-xl font-semibold mb-3">Clicks per Second (CPS)</h2>
            <p className="text-base opacity-70">4 sets × 10 seconds</p>
          </button>
        </div>

        <div className="text-center">
          <button
            className="px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            onClick={() => navigate("/")}
          >
            Go to Main Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
