import type { ScannedFields } from "@/types/contracts";

export function OcrRawPanel({ ocrRaw }: { ocrRaw: ScannedFields }) {
  const zones = [
    { label: "Name", text: ocrRaw.nameText },
    { label: "Primary objective", text: ocrRaw.objectiveText },
    { label: "Reward", text: ocrRaw.rewardText },
  ];

  return (
    <div className="mb-2 space-y-1 rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
        Raw OCR
      </div>
      {zones.map(({ label, text }) => (
        <div key={label}>
          <div className="text-[10px] font-medium text-muted-foreground">{label}</div>
          <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-background/80 p-1.5 font-mono text-[10px] leading-relaxed text-foreground">
            {text.trim() || "(empty)"}
          </pre>
        </div>
      ))}
    </div>
  );
}
