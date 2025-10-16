import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Home, Medal, Award, Pen } from "lucide-react";
import { fetchLeaderboard, deletePlayer, LeaderboardRow } from "@/lib/data";

type LeaderboardEntry = LeaderboardRow;

const Stats = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const entries = await fetchLeaderboard();
        setLeaderboard(entries);
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const removePerson = async (player_id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from the leaderboard?`)) {
      return;
    }

    try {
      await deletePlayer(player_id, { soft: true });
      
      // Remove from local state
      setLeaderboard(prev => prev.filter(entry => entry.player_id !== player_id));
      alert(`${name} has been removed from the leaderboard.`);
    } catch (error) {
      console.error("Error removing person:", error);
      alert("Failed to remove person. Please try again.");
    }
  };

  const getMedalIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 1:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 2:
        return <Award className="w-5 h-5 text-amber-700" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen p-4 py-12">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="border-border/50 shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-primary/10">
                <Trophy className="w-12 h-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold">Leaderboard</CardTitle>
            <CardDescription className="text-base">
              Fastest reaction times from all participants
            </CardDescription>
            <div className="flex justify-center gap-4 mt-4">
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
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading stats...</div>
            ) : leaderboard.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No results yet. Be the first to play!
              </div>
            ) : (
              <div className={`space-y-3 ${leaderboard.length > 5 ? "max-h-96 overflow-y-auto pr-1" : ""}`}>
                {leaderboard.map((entry, index) => (
                  <div
                    key={`${entry.name}-${index}`}
                    className={`
                      p-4 rounded-lg border transition-colors
                      ${index === 0 ? "border-yellow-500/30 bg-yellow-500/5" : "border-border bg-card/50"}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 flex justify-center">
                          {getMedalIcon(index) || (
                            <span className="text-muted-foreground font-semibold">
                              {index + 1}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-lg">{entry.name}</div>
                          <div className="text-xs text-muted-foreground">
                            mean {entry.mean_ms} ms · {entry.tries} {entry.tries === 1 ? "try" : "tries"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">{entry.best_ms}</div>
                          <div className="text-xs text-muted-foreground">ms</div>
                        </div>
                        {isEditMode && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => removePerson(entry.player_id, entry.name)}
                            className="w-8 h-8 rounded-full p-0"
                          >
                            ×
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-border text-center text-sm text-muted-foreground">
              <p>
                You're seeing names and times only for players who consented to public display.
              </p>
            </div>

            <div className="mt-6">
              <Button onClick={() => navigate("/")} className="w-full" size="lg">
                <Home className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Stats;
