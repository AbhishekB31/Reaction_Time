import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { submitScore } from "@/lib/data";

type GameState = "idle" | "wait" | "go" | "too-soon" | "result";

const Play = () => {
  const [searchParams] = useSearchParams();
  const [sessionValid, setSessionValid] = useState(false);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [goTime, setGoTime] = useState<number>(0);
  const [showResults, setShowResults] = useState(false);
  const waitTimeoutRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const navigate = useNavigate();
  const name = searchParams.get("name");

  useEffect(() => {
    const validateSession = async () => {
      if (!name) {
        navigate("/");
        return;
      }
      setSessionValid(true);
    };

    validateSession();
  }, [name, navigate]);

  const startTest = useCallback(() => {
    // Clear any existing wait timeout before starting a new one
    if (waitTimeoutRef.current) {
      clearTimeout(waitTimeoutRef.current);
      waitTimeoutRef.current = null;
    }
    setGameState("wait");
    const delay = 800 + Math.random() * 4200; // 800-5000ms
    
    const timeoutId = window.setTimeout(() => {
      setGoTime(performance.now());
      setGameState("go");
      // Play a short beep when the green state appears, if enabled
      try {
        const beepEnabled = (localStorage.getItem("beepEnabled") ?? "true") !== "false";
        const ctx = audioCtxRef.current;
        if (beepEnabled && ctx) {
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
    }, delay);
    waitTimeoutRef.current = timeoutId;
  }, []);

  const handleAction = useCallback(async () => {
    if (gameState === "idle" || gameState === "too-soon") {
      // Ensure AudioContext is created/resumed during a user gesture
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;
        if (ctx && ctx.state === "suspended") {
          await ctx.resume().catch(() => {});
        }
      } catch (_) {
        // Ignore audio errors; gameplay should continue even if audio fails
      }
      startTest();
    } else if (gameState === "wait") {
      // Clicked too early: show message briefly, then restart wait cycle
      if (waitTimeoutRef.current) {
        clearTimeout(waitTimeoutRef.current);
        waitTimeoutRef.current = null;
      }
      setGameState("too-soon");
      window.setTimeout(() => {
        startTest(); // Restart the wait cycle
      }, 1000);
    } else if (gameState === "go") {
      const rt = Math.round(performance.now() - goTime);
      setReactionTime(rt);
      setGameState("result");

      // Submit to database
      try {
        await submitScore(name!, rt);
        setShowResults(true);
      } catch (error) {
        console.error("Error submitting result:", error);
        toast({
          title: "Error",
          description: "Failed to save your result.",
          variant: "destructive",
        });
      }
    }
  }, [gameState, goTime, name, startTest]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        handleAction();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handleAction]);

  // Cleanup any pending timeouts on unmount
  useEffect(() => {
    return () => {
      if (waitTimeoutRef.current) {
        clearTimeout(waitTimeoutRef.current);
        waitTimeoutRef.current = null;
      }
    };
  }, []);

  if (!sessionValid) {
    return null;
  }

  function restartTest() {
    setShowResults(false);
    setReactionTime(null);
    setGameState("idle");
    if (waitTimeoutRef.current) {
      clearTimeout(waitTimeoutRef.current);
      waitTimeoutRef.current = null;
    }
  }

  function exitToModes() {
    navigate(`/modes?name=${encodeURIComponent(name!)}`);
  }

  const getStateColor = () => {
    switch (gameState) {
      case "idle":
        return "bg-gray-700 text-gray-300";
      case "wait":
        return "bg-red-500 text-white";
      case "go":
        return "bg-green-500 text-white";
      case "too-soon":
        return "bg-red-500 text-white";
      case "result":
        return "bg-gray-700 text-gray-300";
      default:
        return "bg-gray-700 text-gray-300";
    }
  };

  const getStateText = () => {
    switch (gameState) {
      case "idle":
        return "Click to start";
      case "wait":
        return "Wait...";
      case "go":
        return "GO!";
      case "too-soon":
        return "Too soon! Click to try again";
      case "result":
        return `${reactionTime} ms`;
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <Card className="border-border/50 shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Reaction Test — 1 try</CardTitle>
            <CardDescription className="text-base">
              Player: <b>{name}</b> • Press <kbd className="px-2 py-1 bg-muted rounded text-xs">SPACE</kbd> or click/tap when the box turns green
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <button
              onClick={handleAction}
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
            {!showResults && (
              <p>
                {gameState === "idle" && "Click the panel above to begin"}
                {gameState === "wait" && "Wait for green..."}
                {gameState === "go" && "React now!"}
                {gameState === "too-soon" && "You clicked too early"}
                {gameState === "result" && "Test complete"}
              </p>
            )}
          </div>

          <div className="flex gap-4">
            <Button onClick={restartTest} variant="outline" className="flex-1">
              Restart
            </Button>
            <Button onClick={exitToModes} className="flex-1">
              Exit
            </Button>
          </div>

          {showResults && reactionTime && (
            <div className="space-y-4">
              <div className="text-center p-6 bg-muted/30 rounded-lg">
                <h3 className="text-xl font-semibold mb-4">Test Complete!</h3>
                <div className="text-lg">
                  <p><strong>Reaction Time:</strong> {reactionTime} ms</p>
                </div>
              </div>
            </div>
          )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Play;
