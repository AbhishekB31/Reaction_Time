import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Timer, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const Home = () => {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const validateName = (value: string): boolean => {
    const trimmed = value.trim();
    if (trimmed.length < 2 || trimmed.length > 80) return false;
    if (trimmed.includes("<") || trimmed.includes(">")) return false;
    return /^[\x20-\x7E]+$/.test(trimmed); // Printable ASCII only
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = name.trim();
    if (!validateName(trimmedName)) {
      toast({
        title: "Invalid name",
        description: "Name must be 2-80 characters, no HTML tags allowed.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Check if participant exists, or create new one
      let { data: existingParticipant, error: fetchError } = await supabase
        .from("participants")
        .select("id")
        .eq("name", trimmedName)
        .maybeSingle();

      if (fetchError) throw fetchError;

      let participantId: string;

      if (existingParticipant) {
        participantId = existingParticipant.id;
      } else {
        const { data: newParticipant, error: insertError } = await supabase
          .from("participants")
          .insert({ name: trimmedName })
          .select("id")
          .single();

        if (insertError) throw insertError;
        participantId = newParticipant.id;
      }

      // Create session
      const sessionId = crypto.randomUUID();
      const { error: sessionError } = await supabase
        .from("sessions")
        .insert({
          id: sessionId,
          participant_id: participantId,
          consent_given: 0,
          completed: 0,
        });

      if (sessionError) throw sessionError;

      navigate(`/consent?session=${sessionId}`);
    } catch (error) {
      console.error("Error starting session:", error);
      toast({
        title: "Error",
        description: "Failed to start session. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <Card className="border-border/50 shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-primary/10">
                <Timer className="w-12 h-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold">Reaction Time Test</CardTitle>
            <CardDescription className="text-base">
              Measure how fast you can react to a visual stimulus
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleStart} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Your Name
                </label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  minLength={2}
                  maxLength={80}
                  required
                  className="text-base"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={!name.trim() || isLoading}
              >
                {isLoading ? "Starting..." : "Play"}
              </Button>
            </form>
            <div className="mt-6 pt-6 border-t border-border">
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => navigate("/stats")}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                View Leaderboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Home;
