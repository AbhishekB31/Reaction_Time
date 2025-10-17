import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { submitRT60Session } from "@/lib/data";
import { toast } from "sonner";

const DURATION_MS = 60_000;

function computeMedian(values: number[]) {
  if (!values.length) return 0;
  const a = [...values].sort((x,y) => x-y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m-1] + a[m]) / 2);
}

export default function RT60() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const name = (search.get("name") ?? "").trim();

  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<"idle"|"wait"|"green"|"too-soon">("idle");
  const [remainingMs, setRemainingMs] = useState(DURATION_MS);
  const [results, setResults] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [finalStats, setFinalStats] = useState<{best: number, median: number, mean: number, tries: number} | null>(null);
  const waitTimerRef = useRef<number | null>(null);
  const greenStartRef = useRef<number | null>(null);
  const endAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const resultsRef = useRef<number[]>([]);

  useEffect(() => { if (!name) navigate("/"); }, [name, navigate]);

  // countdown ticker
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const left = Math.max(0, (endAtRef.current ?? 0) - Date.now());
      setRemainingMs(left);
      if (left <= 0) return finish();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function startSession() {
    // Initialize audio context on user interaction
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    } catch (_) {
      // Ignore audio errors; gameplay should continue even if audio fails
    }
    
    setResults([]);
    setRemainingMs(DURATION_MS);
    endAtRef.current = Date.now() + DURATION_MS;
    setRunning(true);
    nextWait();
  }

  function nextWait() {
    setPhase("wait");
    if (waitTimerRef.current) window.clearTimeout(waitTimerRef.current);
    const delay = 800 + Math.floor(Math.random() * 4200); // 0.8–5.0s
    waitTimerRef.current = window.setTimeout(() => {
      setPhase("green");
      greenStartRef.current = performance.now();
      // Play beep sound when green appears
      playBeep();
    }, delay) as unknown as number;
  }

  function playBeep() {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx) {
        const durationMs = 150;
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, ctx.currentTime); // 880 Hz beep
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + durationMs / 1000 + 0.01);
      }
    } catch (_) {
      // Ignore audio errors to avoid impacting gameplay
    }
  }

  function onAreaClick() {
    if (!running) return;
    if (phase === "wait") {
      // false start → show too soon message and restart this round
      setPhase("too-soon");
      if (waitTimerRef.current) window.clearTimeout(waitTimerRef.current);
      setTimeout(() => {
        nextWait(); // Restart the wait cycle
      }, 1000);
      return;
    }
    if (phase === "green" && greenStartRef.current) {
      const rt = Math.round(performance.now() - greenStartRef.current);
      setResults(prev => {
        const newResults = [...prev, rt];
        resultsRef.current = newResults;
        return newResults;
      });
      nextWait();
    }
  }

  async function finish() {
    setRunning(false);
    setPhase("idle");
    if (waitTimerRef.current) window.clearTimeout(waitTimerRef.current);
    
    // Use ref to get current results (avoid stale closure)
    const currentResults = resultsRef.current;
    
    // Always show results, even if no valid reactions recorded
    const best = currentResults.length > 0 ? Math.min(...currentResults) : 0;
    const median = currentResults.length > 0 ? computeMedian(currentResults) : 0;
    const mean = currentResults.length > 0 ? Math.round(currentResults.reduce((a,b)=>a+b, 0) / currentResults.length) : 0;

    // Save session data to Supabase
    try {
      await submitRT60Session(name, {
        totalClicks: currentResults.length,
        bestMs: best > 0 ? best : null,
        avgMs: mean > 0 ? mean : null
      });
      console.log("RT60 session saved successfully");
    } catch (error) {
      console.error("Failed to save RT60 session:", error);
      // Don't show error toast to user
    }

    setFinalStats({ best, median, mean, tries: currentResults.length });
    setShowResults(true);
  }

  const secondsLeft = useMemo(() => Math.ceil(remainingMs / 1000), [remainingMs]);

  function restartTest() {
    setShowResults(false);
    setFinalStats(null);
    setResults([]);
    resultsRef.current = [];
    setPhase("idle");
    setRunning(false);
    if (waitTimerRef.current) window.clearTimeout(waitTimerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }

  function exitToModes() {
    navigate(`/modes?name=${encodeURIComponent(name)}`);
  }

  const getStateColor = () => {
    switch (phase) {
      case "wait":
        return "bg-red-500 text-white";
      case "green":
        return "bg-green-500 text-white";
      case "too-soon":
        return "bg-red-500 text-white";
      default:
        return "bg-gray-700 text-gray-300";
    }
  };

  const getStateText = () => {
    switch (phase) {
      case "wait":
        return "Wait for GREEN…";
      case "green":
        return "CLICK!";
      case "too-soon":
        return "Too soon!";
      default:
        return "Click to start";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <Card className="border-border/50 shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Reaction (60 seconds)</CardTitle>
            <CardDescription className="text-base">
              Player: <b>{name}</b> • Press <kbd className="px-2 py-1 bg-muted rounded text-xs">SPACE</kbd> or click/tap when the box turns green
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {running && (
              <div className="text-center text-lg font-semibold">
                Time left: {secondsLeft}s
              </div>
            )}
            
            <button
              onClick={onAreaClick}
              disabled={showResults}
              className={`
                w-full min-h-[360px] rounded-2xl flex items-center justify-center
                text-4xl font-bold transition-all duration-200
                ${getStateColor()}
                ${showResults ? "cursor-default" : "cursor-pointer hover:brightness-110"}
                focus:outline-none focus:ring-4 focus:ring-primary/50
              `}
            >
              {getStateText()}
            </button>

            <div className="text-center text-sm text-muted-foreground space-y-2">
              {running && (
                <p>Recorded tries: {results.length}</p>
              )}
              {!running && !showResults && (
                <p>Click the panel above to begin the 60-second test</p>
              )}
            </div>

            {!running && !showResults && (
              <div className="text-center">
                <Button onClick={startSession} size="lg" className="w-full">
                  Start 60s Test
                </Button>
              </div>
            )}

            <div className="flex gap-4">
              <Button onClick={restartTest} variant="outline" className="flex-1">
                Restart
              </Button>
              <Button onClick={exitToModes} className="flex-1">
                Exit
              </Button>
            </div>

            {showResults && finalStats && (
              <div className="space-y-4">
                <div className="text-center p-6 bg-gray-800 rounded-lg text-white">
                  <h3 className="text-xl font-semibold mb-4">Test Complete!</h3>
                  {finalStats.tries > 0 ? (
                    <div className="space-y-2 text-lg">
                      <p><strong>Total Clicks:</strong> {finalStats.tries}</p>
                      <p><strong>Best Reaction:</strong> {finalStats.best} ms</p>
                      <p><strong>Average Reaction:</strong> {finalStats.mean} ms</p>
                      <p><strong>Median Reaction:</strong> {finalStats.median} ms</p>
                    </div>
                  ) : (
                    <div className="space-y-2 text-lg">
                      <p className="text-yellow-300">No valid reactions recorded</p>
                      <p className="text-sm opacity-80">Try clicking when the box turns green!</p>
                    </div>
                  )}
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
