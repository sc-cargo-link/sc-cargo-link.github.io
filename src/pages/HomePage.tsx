import { Link } from "react-router-dom";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";

const haulSteps = [
  {
    id: "jobs",
    label: "Take jobs",
    hint: "Off the board",
    detail: "Pull contracts in and get them on the sheet.",
    image: "/home/take-jobs.jpg",
  },
  {
    id: "manifest",
    label: "Manifest",
    hint: "Scan & fix",
    detail: "Confirm cargo, yards, and payout before you spool.",
    image: "/home/manifest.jpg",
  },
  {
    id: "fly",
    label: "Fly",
    hint: "Work the stops",
    detail: "Run the route and clear each pickup and dropoff.",
    image: "/home/fly.jpg",
  },
] as const;

export function HomePage() {
  return (
    <div className="-m-[50px] h-[calc(100dvh-3rem)] snap-y snap-mandatory overflow-y-auto scroll-smooth">
      <section className="relative flex h-[calc(100dvh-3rem)] snap-start flex-col overflow-hidden">
        <nav aria-label="Haul path" className="relative min-h-0 flex-1">
          <ol className="flex h-full flex-col md:flex-row">
            {haulSteps.map((step, i) => (
              <li
                key={step.id}
                className="group relative flex min-h-0 flex-1 basis-0 flex-col border-border bg-background md:border-r md:last:border-r-0"
              >
                <img
                  src={step.image}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 h-full w-full object-cover opacity-35 grayscale-[30%] dark:opacity-25"
                />
                <div
                  className="absolute inset-0 bg-background/55 dark:bg-background/70"
                  aria-hidden
                />
                <div className="absolute inset-0 bg-atmosphere opacity-40" aria-hidden />


                <div className="relative z-10 h-1/2 shrink-0" aria-hidden />

                <Link
                  to="/contracts"
                  className="relative z-10 flex h-1/2 flex-col items-center justify-center px-5 pb-10 text-center outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-7"
                >
                  <span className="font-display text-xs font-semibold tracking-[0.2em] text-primary/45 transition-colors duration-500 group-hover:text-primary group-focus-within:text-primary">
                    0{i + 1}
                  </span>
                  <span className="mt-3 font-display text-xl font-semibold tracking-tight text-muted-foreground/50 transition-colors duration-500 group-hover:text-foreground group-focus-within:text-foreground sm:text-2xl">
                    {step.label}
                  </span>
                  <span className="mt-2 text-sm text-muted-foreground/40 transition-colors duration-500 group-hover:text-muted-foreground group-focus-within:text-muted-foreground">
                    {step.hint}
                  </span>
                  <span className="mt-3 max-h-0 max-w-[14rem] overflow-hidden text-sm leading-relaxed text-muted-foreground opacity-0 transition-all duration-500 ease-out group-hover:max-h-24 group-hover:opacity-100 group-focus-within:max-h-24 group-focus-within:opacity-100">
                    {step.detail}
                  </span>
                </Link>
                {i < haulSteps.length - 1 && (
                  <div
                    className="absolute inset-x-0 bottom-0 h-px bg-border md:hidden"
                    aria-hidden
                  />
                )}
              </li>
            ))}
          </ol>
        </nav>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-1/2 items-end justify-center px-5 pb-4 sm:pb-6">
          <div className="pointer-events-auto flex translate-y-6 flex-col items-center text-center sm:translate-y-10">
            <p className="font-display text-6xl font-semibold tracking-tight sm:text-7xl md:text-8xl lg:text-9xl">
              CargoLink
            </p>
            <p className="mx-auto mt-4 max-w-md text-base text-muted-foreground sm:text-lg">
              For space truckers who treat the haul like a job.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="h-11 px-5">
                <Link to="/contracts">Start the shift</Link>
              </Button>
              <Link
                to="/help"
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                How a haul works
              </Link>
            </div>
          </div>
        </div>

        <a
          href="#why"
          className="absolute bottom-3 left-1/2 z-20 inline-flex -translate-x-1/2 flex-col items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Scroll the brief
          <ArrowDown className="h-4 w-4 animate-bounce" />
        </a>
      </section>

      <section
        id="why"
        className="flex h-[calc(100dvh-3rem)] snap-start flex-col justify-center bg-atmosphere px-6 sm:px-12"
      >
        <div className="mx-auto max-w-2xl">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Why this exists
          </p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Realistic ops. A little role-play.
          </h2>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Day-to-day handling of the job — board the contracts, plan the freight, fly the
            stops. Structure that accompanies the gameplay instead of replacing it.
          </p>
        </div>
      </section>

      <section className="flex h-[calc(100dvh-3rem)] snap-start flex-col items-center justify-center gap-8 px-6 text-center">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Ready when you are.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Open Contracts and work the shift: Manifest → Flight plan → On the road.
          </p>
        </div>
        <Button asChild size="lg" className="h-12 px-8 text-base">
          <Link to="/contracts">Start the shift</Link>
        </Button>
        <Link
          to="/help"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Or read the handbook first
        </Link>
      </section>
    </div>
  );
}
