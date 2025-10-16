import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import ThankYouDialog from "@/components/ThankYouDialog";

type GameState = "idle" | "wait" | "go" | "too-soon" | "result";

const Play = () => {
  const [searchParams] = useSearchParams();
  const [sessionValid, setSessionValid] = useState(false);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [goTime, setGoTime] = useState<number>(0);
  const [showDialog, setShowDialog] = useState(false);
  const navigate = useNavigate();
  const sessionId = searchParams.get("session");

  useEffect(() => {
    const validateSession = async () => {
      if (!sessionId) {
        navigate("/");
        return;
      }

      const { data, error } = await supabase
        .from("sessions")
        .select("consent_given, completed")
        .eq("id", sessionId)
        .maybeSingle();

      if (error || !data) {
        toast({
          title: "Invalid session",
          description: "Session not found.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      if (data.consent_given !== 1) {
        toast({
          title: "Consent required",
          description: "Please complete the consent form first.",
        });
        navigate(`/consent?session=${sessionId}`);
        return;
      }

      if (data.completed === 1) {
        toast({
          title: "Already completed",
          description: "This session has already been completed.",
        });
        navigate("/");
        return;
      }

      setSessionValid(true);
    };

    validateSession();
  }, [sessionId, navigate]);

  const startTest = useCallback(() => {
    setGameState("wait");
    const delay = 800 + Math.random() * 1200; // 800-2000ms
    
    setTimeout(() => {
      setGoTime(performance.now());
      setGameState("go");
    }, delay);
  }, []);

  const handleAction = useCallback(async () => {
    if (gameState === "idle" || gameState === "too-soon") {
      startTest();
    } else if (gameState === "wait") {
      setGameState("too-soon");
      setTimeout(() => {
        setGameState("idle");
      }, 1500);
    } else if (gameState === "go") {
      const rt = Math.round(performance.now() - goTime);
      setReactionTime(rt);
      setGameState("result");

      // Submit to database
      try {
        const ua = navigator.userAgent;
        const screenW = window.screen.width;
        const screenH = window.screen.height;
        const rtClean = rt < 80 || rt > 2000 ? null : rt;

        // Update session with device info
        await supabase
          .from("sessions")
          .update({
            user_agent: ua.substring(0, 300),
            screen_w: screenW,
            screen_h: screenH,
            completed: 1,
          })
          .eq("id", sessionId);

        // Insert trial
        await supabase
          .from("trials")
          .insert({
            session_id: sessionId!,
            trial_index: 1,
            rt_ms_raw: rt,
            rt_ms_clean: rtClean,
          });

        // Insert or update summary
        await supabase
          .from("summaries")
          .upsert({
            session_id: sessionId!,
            best_ms: rt,
            median_ms: rt,
            mean_ms: rt,
          });

        setShowDialog(true);
      } catch (error) {
        console.error("Error submitting result:", error);
        toast({
          title: "Error",
          description: "Failed to save your result.",
          variant: "destructive",
        });
      }
    }
  }, [gameState, goTime, sessionId, startTest]);

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

  if (!sessionValid) {
    return null;
  }

  const getStateColor = () => {
    switch (gameState) {
      case "idle":
        return "bg-[hsl(var(--state-idle))]";
      case "wait":
        return "bg-[hsl(var(--state-wait))]";
      case "go":
        return "bg-[hsl(var(--state-go))]";
      case "too-soon":
        return "bg-[hsl(var(--state-wait))]";
      case "result":
        return "bg-[hsl(var(--state-result))]";
      default:
        return "bg-muted";
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
    <>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-3xl">
          <Card className="border-border/50 shadow-2xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold">Reaction Test — 1 try</CardTitle>
              <CardDescription className="text-base">
                Press <kbd className="px-2 py-1 bg-muted rounded text-xs">SPACE</kbd> or click/tap
                when the box turns green
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <button
                onClick={handleAction}
                disabled={gameState === "result"}
                className={`
                  w-full min-h-[280px] rounded-xl flex items-center justify-center
                  text-3xl font-bold transition-all duration-200
                  ${getStateColor()}
                  ${gameState === "result" ? "cursor-default" : "cursor-pointer hover:brightness-110"}
                  focus:outline-none focus:ring-4 focus:ring-primary/50
                `}
              >
                {getStateText()}
              </button>

              <div className="text-center text-sm text-muted-foreground space-y-2">
                <p>
                  {gameState === "idle" && "Click the panel above to begin"}
                  {gameState === "wait" && "Wait for green..."}
                  {gameState === "go" && "React now!"}
                  {gameState === "too-soon" && "You clicked too early"}
                  {gameState === "result" && "Test complete"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ThankYouDialog
        open={showDialog}
        reactionTime={reactionTime || 0}
        onClose={() => navigate("/")}
      />
    </>
  );
};

export default Play;
