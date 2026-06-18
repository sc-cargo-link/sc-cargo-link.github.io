import { NavLink, Outlet } from "react-router-dom";
import { Map, Package, HelpCircle, Home } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Home", icon: Home },
  { to: "/contracts", label: "Contracts", icon: Package },
  { to: "/map", label: "Map", icon: Map },
  { to: "/help", label: "Help", icon: HelpCircle },
];

export function AppLayout() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="flex h-12 w-full items-center justify-between gap-4 px-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              CL
            </div>
            <span className="text-sm font-semibold tracking-wide">CargoLink</span>
          </div>
          <div className="flex items-center gap-1">
          <nav className="flex items-center gap-1">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )
                }
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>
          <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="min-w-0 flex-1 m-[50px]">
        <Outlet />
      </main>
    </div>
  );
}
