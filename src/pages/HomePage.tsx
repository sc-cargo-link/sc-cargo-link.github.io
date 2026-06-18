import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function HomePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">CargoLink</h1>
        <p className="text-sm text-muted-foreground">Star Citizen hauling mission planner</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Home — TBD</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Dashboard and quick-start workflows coming soon. Use Map to browse locations or Contracts
          to scan missions and plan routes.
        </CardContent>
      </Card>
    </div>
  );
}
