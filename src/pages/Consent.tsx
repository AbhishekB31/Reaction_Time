import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const Consent = () => {
  const [searchParams] = useSearchParams();
  const [agreed, setAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionValid, setSessionValid] = useState(false);
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
        .select("completed")
        .eq("id", sessionId)
        .maybeSingle();

      if (error || !data) {
        toast({
          title: "Invalid session",
          description: "Session not found. Please start again.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      if (data.completed === 1) {
        toast({
          title: "Session already completed",
          description: "This session has already been completed.",
        });
        navigate("/");
        return;
      }

      setSessionValid(true);
    };

    validateSession();
  }, [sessionId, navigate]);

  const handleContinue = async () => {
    if (!agreed) {
      toast({
        title: "Agreement required",
        description: "Please agree to the terms to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from("sessions")
        .update({ consent_given: 1 })
        .eq("id", sessionId);

      if (error) throw error;

      navigate(`/play?session=${sessionId}`);
    } catch (error) {
      console.error("Error updating consent:", error);
      toast({
        title: "Error",
        description: "Failed to save consent. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!sessionValid) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card className="border-border/50 shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-primary/10">
                <ShieldCheck className="w-12 h-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Privacy & Consent</CardTitle>
            <CardDescription>
              Please review the following information before proceeding
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ScrollArea className="h-64 rounded-lg border border-border p-4">
              <div className="space-y-4 text-sm leading-relaxed">
                <section>
                  <h3 className="font-semibold text-base mb-2">Purpose</h3>
                  <p className="text-muted-foreground">
                    This test measures your reaction time in response to visual stimuli. The data
                    collected will be used for research purposes.
                  </p>
                </section>

                <section>
                  <h3 className="font-semibold text-base mb-2">Data We Collect</h3>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>
                      <strong>Name:</strong> Your name will be displayed publicly on the Stats page
                    </li>
                    <li>
                      <strong>Reaction time:</strong> Your reaction time in milliseconds (public)
                    </li>
                    <li>
                      <strong>Timestamp:</strong> When you completed the test
                    </li>
                    <li>
                      <strong>Device information:</strong> User-agent and screen size for quality
                      control (not displayed publicly)
                    </li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold text-base mb-2">Privacy Protection</h3>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>We do NOT collect IP addresses</li>
                    <li>We do NOT use third-party analytics or tracking scripts</li>
                    <li>Only your name and reaction time are visible on the public leaderboard</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold text-base mb-2">Your Rights</h3>
                  <p className="text-muted-foreground">
                    By agreeing below, you consent to having your name and reaction time displayed
                    on the public Stats page. You understand that this data will be visible to
                    anyone who visits the Stats page.
                  </p>
                </section>
              </div>
            </ScrollArea>

            <div className="flex items-start space-x-3 p-4 rounded-lg bg-muted/30">
              <Checkbox
                id="agree"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked as boolean)}
              />
              <label
                htmlFor="agree"
                className="text-sm font-medium leading-relaxed cursor-pointer"
              >
                I agree to the above and consent to having my name and reaction time displayed on
                the public Stats page
              </label>
            </div>

            <Button
              onClick={handleContinue}
              disabled={!agreed || isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? "Processing..." : "Continue to Test"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Consent;
