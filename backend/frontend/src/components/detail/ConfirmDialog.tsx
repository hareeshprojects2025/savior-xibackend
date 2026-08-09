import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  confirmVariant?: "default" | "destructive" | "success"
  onConfirm: () => void
  loading?: boolean
}

const colorMap: Record<string, string> = {
  default: "bg-blue-600 hover:bg-blue-700",
  destructive: "bg-red-500 hover:bg-red-600",
  success: "bg-green-500 hover:bg-green-600",
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, confirmVariant = "default", onConfirm, loading }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription className="text-sm">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="border-gray-200">
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className={`text-white shadow-sm ${colorMap[confirmVariant] || colorMap.default}`}
          >
            {loading ? "Processing..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}