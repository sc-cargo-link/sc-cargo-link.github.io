import { HelpGuide } from "@/components/help/HelpGuide";
import { Badge } from "@/components/ui/badge";

export function HelpPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold sm:text-2xl">Help</h1>
          <Badge variant="outline">Step-by-step guide</Badge>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Learn how to scan contracts, plan optimal hauling routes, and track cargo across Pyro,
          Stanton, and Nyx.
        </p>
      </div>

      <HelpGuide />
    </div>
  );
}
