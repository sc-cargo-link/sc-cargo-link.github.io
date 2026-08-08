import { HelpGuide } from "@/components/help/HelpGuide";

export function HelpPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-1 py-2">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Help
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          Manifest → Flight plan → On the road. Same cadence every haul.
        </p>
      </header>

      <HelpGuide />
    </div>
  );
}
