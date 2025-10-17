import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { submitCPSSession } from "@/lib/data";
import { toast } from "sonner";

const SETS = 4;
const WINDOW_MS = 10_000;

export default function CPS() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const name = (search.get("name") ?? "").trim();

  useEffect(() => { if (!name) navigate("/"); }, [name, navigate]);

  const [setIndex, setSetIndex] = useState(0); // 0-3
  const [running, setRunning] = useState(false);
  const [clicks, setClicks] = useState(0);
  const [results, setResults] = useState<number[]>([]);
  const [clickCounts, setClickCounts] = useState<number[]>([]); // Track actual click counts
  const [remainingMs, setRemainingMs] = useState(WINDOW_MS);
  const [showResults, setShowResults] = useState(false);
  const [finalStats, setFinalStats] = useState<{best: number, avg: number, series: number[]} | null>(null);
  const [gameState, setGameState] = useState<"idle"|"running"|"results">("idle");
  
  const rafRef = useRef<number | null>(null);
  const endAtRef = useRef<number | null>(null);
  const lastClickTimeRef = useRef<number>(0);
  const keyPressedRef = useRef<boolean>(false);

  function startSet() {
    setClicks(0);
    setRemainingMs(WINDOW_MS);
    endAtRef.current = Date.now() + WINDOW_MS;
    setRunning(true);
    setGameState("running");
    tick();
  }

  function tick() {
    const now = Date.now();
    const remaining = Math.max(0, (endAtRef.current ?? 0) - now);
    setRemainingMs(remaining);
    
    if (remaining <= 0) {
      finishSet(); // This will be handled asynchronously
    } else {
      rafRef.current = requestAnimationFrame(tick);
    }
  }

  function onClickArea() {
    if (!running) return;
    
    const now = Date.now();
    // Prevent rapid clicks (minimum 50ms between clicks)
    if (now - lastClickTimeRef.current < 50) return;
    
    lastClickTimeRef.current = now;
    setClicks(prev => prev + 1);
  }

  function finishSet() {
    setRunning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    const cps = Number((clicks / 10).toFixed(2));
    const newResults = [...results, cps];
    const newClickCounts = [...clickCounts, clicks];
    setResults(newResults);
    setClickCounts(newClickCounts);

    if (setIndex < 3) {
      // Move to next set and wait for manual start
      setSetIndex(prev => prev + 1);
      setGameState("idle");
    } else {
      finishAll(newResults, newClickCounts);
    }
  }

  async function finishAll(series: number[], clickCounts: number[]) {
    const best = Math.max(...series);
    const avg = Number((series.reduce((a,b)=>a+b,0) / series.length).toFixed(2));
    
    // Save session data to Supabase
    try {
      await submitCPSSession(name, {
        set1: clickCounts[0] || 0,
        set2: clickCounts[1] || 0,
        set3: clickCounts[2] || 0,
        set4: clickCounts[3] || 0,
        durationSec: 10
      });
      console.log("CPS session saved successfully");
    } catch (error) {
      console.error("Failed to save CPS session:", error);
      // Don't show error toast to user
    }

    setFinalStats({ best, avg, series });
    setShowResults(true);
    setGameState("results");
  }

  function restartTest() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setSetIndex(0);
    setRunning(false);
    setClicks(0);
    setResults([]);
    setClickCounts([]);
    setRemainingMs(WINDOW_MS);
    setShowResults(false);
    setFinalStats(null);
    setGameState("idle");
    endAtRef.current = null;
    lastClickTimeRef.current = 0;
  }

  function exitToModes() {
    navigate(`/modes?name=${encodeURIComponent(name)}`);
  }

  const secondsLeft = useMemo(() => Math.ceil(remainingMs / 1000), [remainingMs]);
  const minutesLeft = Math.floor(secondsLeft / 60);
  const displayTime = minutesLeft > 0 ? `${minutesLeft}:${(secondsLeft % 60).toString().padStart(2, '0')}` : secondsLeft.toString();

  // Handle keyboard clicks with proper debouncing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.code === "Enter") && running && !keyPressedRef.current) {
        e.preventDefault();
        keyPressedRef.current = true;
        onClickArea();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        keyPressedRef.current = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [running]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <Card className="border-border/50 shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Clicks per Second (CPS)</CardTitle>
            <CardDescription className="text-base">
              Player: <b>{name}</b> • Press <kbd className="px-2 py-1 bg-muted rounded text-xs">SPACE</kbd> or click/tap as fast as possible
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Set Progress and Timer */}
            <div className="text-center text-lg font-semibold">
              Set {setIndex + 1}/4
            </div>
            {running && (
              <div className="text-center text-lg">
                Time left: {displayTime}s
              </div>
            )}

            {/* Main Click Area */}
            <button
              onPointerDown={onClickArea}
              disabled={!running}
              tabIndex={0}
              role="button"
              className={`
                w-full min-h-[320px] rounded-2xl flex items-center justify-center
                text-5xl font-bold transition-all duration-200
                ${running ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-gray-700 text-gray-300"}
                ${running ? "cursor-pointer active:scale-[.995]" : "cursor-default"}
                focus:outline-none focus:ring-4 focus:ring-primary/50
                select-none touch-manipulation
              `}
              style={{ touchAction: 'manipulation' }}
              onContextMenu={(e) => e.preventDefault()}
            >
              {running ? clicks : "Click to start"}
            </button>

            {/* Instructions */}
            <div className="text-center text-sm text-muted-foreground space-y-2">
              {running && (
                <p>Click as fast as you can!</p>
              )}
              {!running && gameState === "idle" && (
                <p>Click the panel above to begin Set {setIndex + 1}</p>
              )}
              {results.length > 0 && (
                <p>Completed sets: {results.map((cps, i) => `Set ${i + 1}: ${cps}`).join(", ")} CPS</p>
              )}
            </div>

            {/* Start Button (only when idle) */}
            {!running && gameState === "idle" && (
              <div className="text-center">
                <Button onClick={startSet} size="lg" className="w-full">
                  Start Set {setIndex + 1}
                </Button>
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-4">
              <Button 
                onClick={restartTest} 
                variant="outline" 
                className="flex-1"
              >
                Restart
              </Button>
              <Button onClick={exitToModes} className="flex-1">
                Exit
              </Button>
            </div>

            {/* Results Modal */}
            {showResults && finalStats && (
              <div className="space-y-4">
                <div className="text-center p-6 bg-gray-800 rounded-lg text-white">
                  <h3 className="text-xl font-semibold mb-4">Test Complete!</h3>
                  <div className="space-y-2 text-lg">
                    <p><strong>Sets:</strong> {finalStats.series.join(", ")} CPS</p>
                    <p><strong>Best:</strong> {finalStats.best} CPS</p>
                    <p><strong>Average:</strong> {finalStats.avg} CPS</p>
                  </div>
                </div>
                
                <div className="text-center">
                  <Button onClick={exitToModes} size="lg" className="w-full">
                    Finish
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}