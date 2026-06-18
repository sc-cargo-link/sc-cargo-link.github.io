import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function HelpPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Help</h1>
        <p className="text-sm text-muted-foreground">Documentation and guides</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Help — TBD</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Quick tips:</p>
          <ul className="list-inside list-disc space-y-1">
            <li>Prep: upload contract screenshots for OCR scanning</li>
            <li>Routing: set ship SCU, max distance, and starting location</li>
            <li>Tracking: mark pickups, dropoffs, and contracts complete</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
