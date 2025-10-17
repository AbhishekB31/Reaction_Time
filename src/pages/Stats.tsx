import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Pen, Home, Trophy, Medal, Award } from "lucide-react";
import {
  fetchLeaderboard,
  deletePlayer,
  LeaderboardRow,
  fetchLB_RT60_Overview,
  fetchLB_CPS_Overview,
} from "@/lib/data";

type LeaderboardEntry = LeaderboardRow;

export default function Stats() {
  const navigate = useNavigate();

  // Panel 1 (existing single-reaction)
  const [single, setSingle] = useState<LeaderboardEntry[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);

  // Panel 2 (rt60)
  const [rt60, setRt60] = useState<
    { player_id: string; name: string; total_clicks: number; best_ms: number | null; avg_ms: number | null }[]
  >([]);
  const [isEditModeRT60, setIsEditModeRT60] = useState(false);

  // Panel 3 (cps)
  const [cps, setCps] = useState<
    { player_id: string; name: string; best_cps: number | null; avg_cps: number | null }[]
  >([]);
  const [isEditModeCPS, setIsEditModeCPS] = useState(false);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [a, b, c] = await Promise.all([
          fetchLeaderboard(),          // existing single-reaction view/data
          fetchLB_RT60_Overview(),     // new view
          fetchLB_CPS_Overview(),      // new view
        ]);
        setSingle(a);
        setRt60(b ?? []);
        setCps(c ?? []);
      } catch (e) {
        console.error("Error loading leaderboard:", e);
        // Try to load at least the single reaction data
        try {
          const singleData = await fetchLeaderboard();
          setSingle(singleData);
        } catch (singleError) {
          console.error("Failed to load single reaction data:", singleError);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function removePerson(player_id: string, name: string) {
    if (!confirm(`Permanently delete ${name} from the leaderboard? This cannot be undone.`)) return;
    try {
      await deletePlayer(player_id, { soft: false });
      setSingle((prev) => prev.filter((x) => x.player_id !== player_id));
      alert(`${name} has been permanently deleted.`);
    } catch (e) {
      console.error("Delete failed:", e);
      alert("Failed to remove. Check admin token/function.");
    }
  }

  async function removePersonRT60(player_id: string, name: string) {
    if (!confirm(`Permanently delete ${name} from the RT60 leaderboard? This cannot be undone.`)) return;
    try {
      await deletePlayer(player_id, { soft: false });
      setRt60((prev) => prev.filter((x) => x.player_id !== player_id));
      alert(`${name} has been permanently deleted from RT60 leaderboard.`);
    } catch (e) {
      console.error("Delete failed:", e);
      alert("Failed to remove. Check admin token/function.");
    }
  }

  async function removePersonCPS(player_id: string, name: string) {
    if (!confirm(`Permanently delete ${name} from the CPS leaderboard? This cannot be undone.`)) return;
    try {
      await deletePlayer(player_id, { soft: false });
      setCps((prev) => prev.filter((x) => x.player_id !== player_id));
      alert(`${name} has been permanently deleted from CPS leaderboard.`);
    } catch (e) {
      console.error("Delete failed:", e);
      alert("Failed to remove. Check admin token/function.");
    }
  }

  const getMedalIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="w-4 h-4 text-yellow-500" />;
      case 1:
        return <Medal className="w-4 h-4 text-gray-400" />;
      case 2:
        return <Award className="w-4 h-4 text-amber-700" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-[1600px]">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Leaderboard</h1>
          <p className="text-xl opacity-80">Top results across all modes</p>
        </div>

        {loading ? (
          <div className="text-center py-16 opacity-70">Loading…</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {/* PANEL 1: Single Reaction (existing) */}
            <div className="rounded-2xl border-2 p-8 bg-card hover:shadow-lg transition-all duration-200 min-h-[500px]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Single Reaction</h2>
                <Button
                  variant={isEditMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsEditMode(!isEditMode)}
                  className="flex items-center gap-2"
                >
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <Pen className="w-3 h-3" />
                  </div>
                  Edit
                </Button>
              </div>

              {single.length ? (
                <div className={`space-y-2 ${single.length > 5 ? "max-h-80 overflow-y-auto pr-2" : ""}`}>
                  {single.map((row, i) => (
                    <div
                      key={row.player_id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 flex justify-center">
                          {getMedalIcon(i) || (
                            <span className="text-muted-foreground font-semibold text-sm">
                              {i + 1}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold">{row.name}</div>
                          <div className="text-xs opacity-70">
                            mean {row.mean_ms} ms · {row.tries} {row.tries === 1 ? "try" : "tries"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-xl font-bold text-primary">{row.best_ms}</div>
                          <div className="text-xs text-muted-foreground">ms</div>
                        </div>
                        {isEditMode && (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="w-8 h-8 rounded-full p-0"
                            onClick={() => removePerson(row.player_id, row.name)}
                          >
                            ×
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No data yet
                </div>
              )}
            </div>

            {/* PANEL 2: Reaction — 60 seconds */}
            <div className="rounded-2xl border-2 p-8 bg-card hover:shadow-lg transition-all duration-200 min-h-[500px]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Reaction — 60 seconds</h2>
                <Button
                  variant={isEditModeRT60 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsEditModeRT60(!isEditModeRT60)}
                  className="flex items-center gap-2"
                >
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <Pen className="w-3 h-3" />
                  </div>
                  Edit
                </Button>
              </div>
              {rt60.length ? (
                <div className={`space-y-2 ${rt60.length > 5 ? "max-h-80 overflow-y-auto pr-2" : ""}`}>
                  {rt60.map((row, i) => (
                    <div
                      key={row.player_id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 flex justify-center">
                          {getMedalIcon(i) || (
                            <span className="text-muted-foreground font-semibold text-sm">
                              {i + 1}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold">{row.name}</div>
                          <div className="text-xs opacity-70">
                            {row.total_clicks ?? 0} clicks
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-lg font-bold text-primary">{row.best_ms ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">best ms</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-primary">{row.avg_ms ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">avg ms</div>
                        </div>
                        {isEditModeRT60 && (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="w-8 h-8 rounded-full p-0"
                            onClick={() => removePersonRT60(row.player_id, row.name)}
                          >
                            ×
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No RT60 data yet<br />
                  <span className="text-xs">Play Reaction (60s) mode to see results</span>
                </div>
              )}
            </div>

            {/* PANEL 3: CPS */}
            <div className="rounded-2xl border-2 p-8 bg-card hover:shadow-lg transition-all duration-200 min-h-[500px]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">CPS — 4 × 10s</h2>
                <Button
                  variant={isEditModeCPS ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsEditModeCPS(!isEditModeCPS)}
                  className="flex items-center gap-2"
                >
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <Pen className="w-3 h-3" />
                  </div>
                  Edit
                </Button>
              </div>
              {cps.length ? (
                <div className={`space-y-2 ${cps.length > 5 ? "max-h-80 overflow-y-auto pr-2" : ""}`}>
                  {cps.map((row, i) => (
                    <div
                      key={row.player_id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 flex justify-center">
                          {getMedalIcon(i) || (
                            <span className="text-muted-foreground font-semibold text-sm">
                              {i + 1}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold">{row.name}</div>
                          <div className="text-xs opacity-70">
                            CPS player
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-lg font-bold text-primary">{row.best_cps ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">best CPS</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-primary">{row.avg_cps ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">avg CPS</div>
                        </div>
                        {isEditModeCPS && (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="w-8 h-8 rounded-full p-0"
                            onClick={() => removePersonCPS(row.player_id, row.name)}
                          >
                            ×
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No CPS data yet<br />
                  <span className="text-xs">Play CPS mode to see results</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="text-center mt-8">
          <button
            className="px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
            onClick={() => navigate("/")}
          >
            <Home className="w-4 h-4" />
            Go to Main Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}