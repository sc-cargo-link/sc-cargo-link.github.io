import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import type { ScannedFields } from "@/types/contracts";
import { Button } from "@/components/ui/button";

export function OcrRawPanel({ ocrRaw }: { ocrRaw: ScannedFields }) {
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  const zones = [
    { label: "Name", text: ocrRaw.nameText },
    { label: "Primary objective", text: ocrRaw.objectiveText },
    { label: "Reward", text: ocrRaw.rewardText },
  ];

  const copyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLabel(label);
      toast.success(`Copied ${label.toLowerCase()}`);
      window.setTimeout(() => setCopiedLabel((current) => (current === label ? null : current)), 1500);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="mb-2 space-y-1.5 rounded-lg border border-amber-500/25 bg-amber-500/5 p-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
        Raw OCR
      </div>
      {zones.map(({ label, text }) => {
        const copied = copiedLabel === label;

        return (
          <div key={label}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                onClick={() => copyText(label, text)}
                aria-label={`Copy ${label} OCR text`}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/70 bg-background/70 p-1.5 font-mono text-[11px] leading-relaxed text-foreground">
              {text.trim() || "(empty)"}
            </pre>
          </div>
        );
      })}
    </div>
  );
}
