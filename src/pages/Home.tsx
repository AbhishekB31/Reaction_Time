import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Timer, TrendingUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { createPlayerOrError } from "@/lib/data";

const Home = () => {
  const base = import.meta.env.BASE_URL || "/";
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Ensure both GIFs start playing at the same time
  useEffect(() => {
    const reverseFlashImg = document.querySelector('img[src="/Reverse-Flash.gif"]') as HTMLImageElement;
    const flashyFlashImg = document.querySelector('img[src="/flashyflash.gif"]') as HTMLImageElement;
    
    if (reverseFlashImg && flashyFlashImg) {
      // Force reload both images to restart animations
      reverseFlashImg.src = reverseFlashImg.src;
      flashyFlashImg.src = flashyFlashImg.src;
    }
  }, []);

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
      await createPlayerOrError(trimmedName);
      navigate(`/consent?name=${encodeURIComponent(trimmedName)}`);
    } catch (error) {
      console.error("Error creating player:", error);
      toast({
        title: "Error",
        description: (error as any)?.message || "Failed to save player. Check Supabase setup.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="h-screen flex items-center justify-center relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: `url(${base}BG.png)` }}
    >
      {/* Reverse Flash Background Image */}
      <div className="absolute -left-28 top-32 w-1/2 h-full opacity-100 pointer-events-none">
        <img 
          src={`${base}Reverse-Flash.gif`} 
          alt="Reverse Flash" 
          className="w-full h-full object-cover object-left-bottom"
        />
      </div>
      
      {/* FlashyFlash Background Image */}
      <div className="absolute -right-28 top-32 w-1/2 h-full opacity-100 pointer-events-none">
        <img 
          src={`${base}flashyflash.gif`} 
          alt="FlashyFlash" 
          className="w-full h-full object-cover object-right-bottom scale-125"
        />
      </div>
      
      <div className="w-full max-w-md space-y-6 relative z-10">
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
