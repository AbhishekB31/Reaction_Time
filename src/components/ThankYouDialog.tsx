import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PartyPopper } from "lucide-react";

interface ThankYouDialogProps {
  open: boolean;
  reactionTime: number;
  onClose: () => void;
}

const ThankYouDialog = ({ open, reactionTime, onClose }: ThankYouDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-primary/10">
              <PartyPopper className="w-12 h-12 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-2xl font-bold">Thank you for playing!</DialogTitle>
          <DialogDescription className="text-base">
            Your reaction time was{" "}
            <span className="font-bold text-2xl text-primary block mt-2">{reactionTime} ms</span>
          </DialogDescription>
        </DialogHeader>
        <Button onClick={onClose} size="lg" className="w-full mt-4">
          OK
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default ThankYouDialog;
