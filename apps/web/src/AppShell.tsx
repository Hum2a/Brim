import { AnimatePresence, m } from "motion/react";
import { lazy, Suspense, useLayoutEffect, useRef, useState } from "react";
import { MotionRoot, fadeUp, motionSafe, stiff, usePrefersReducedMotion } from "@brim/ui-kit";
import { Link, usePathname } from "./router.js";
import { Skeleton } from "@brim/ui-kit/skeleton";
import { EstimatePage } from "./pages/EstimatePage.js";
import { HeraldDialog } from "./HeraldDialog.js";

const KitchenSink = lazy(() => import("./pages/KitchenSink.js").then((mod) => ({ default: mod.KitchenSink })));
const HistoryPage = lazy(() => import("./pages/HistoryPage.js").then((mod) => ({ default: mod.HistoryPage })));
const GaragePage = lazy(() => import("./pages/GaragePage.js").then((mod) => ({ default: mod.GaragePage })));
const AccountPage = lazy(() => import("./pages/AccountPage.js").then((mod) => ({ default: mod.AccountPage })));

function NavLink({ href, label, current }: { href: string; label: string; current: boolean }) {
  return (
    <Link
      href={href}
      data-current={current ? "true" : undefined}
      className={`relative z-10 px-2 py-1 text-sm ${current ? "text-pump" : "text-mist hover:text-pump"}`}
    >
      {label}
    </Link>
  );
}

function PrimaryNav({ path }: { path: string }) {
  const reduce = usePrefersReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [ink, setInk] = useState({ x: 0, width: 1 });

  useLayoutEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    const active = nav.querySelector("[data-current='true']");
    if (!(active instanceof HTMLElement)) return;
    setInk({ x: active.offsetLeft, width: Math.max(active.offsetWidth, 1) });
  }, [path]);

  const x = ink.x + 4;
  const scaleX = Math.max(ink.width - 8, 1);

  return (
    <nav ref={ref} className="relative flex items-center gap-1" aria-label="Primary">
      {reduce ? (
        <span
          className="pointer-events-none absolute bottom-0 left-0 h-px w-px bg-pump/50"
          style={{ transform: `translateX(${x}px) scaleX(${scaleX})`, transformOrigin: "left center" }}
        />
      ) : (
        <m.span
          className="pointer-events-none absolute bottom-0 left-0 h-px w-px bg-pump/50"
          style={{ originX: 0 }}
          animate={{ x, scaleX }}
          transition={stiff}
        />
      )}
      <NavLink href="/" label="Estimate" current={path === "/"} />
      <NavLink href="/garage" label="Garage" current={path.startsWith("/garage")} />
      <NavLink href="/history" label="History" current={path.startsWith("/history")} />
      <NavLink href="/account" label="Account" current={path.startsWith("/account")} />
    </nav>
  );
}

function RouteBody({ path }: { path: string }) {
  if (path.startsWith("/kitchen-sink")) return <KitchenSink />;
  if (path.startsWith("/history")) return <HistoryPage />;
  if (path.startsWith("/garage")) return <GaragePage />;
  if (path.startsWith("/account")) return <AccountPage />;
  return <EstimatePage />;
}

export function AppShell() {
  const path = usePathname();
  const reduce = usePrefersReducedMotion();
  const transition = motionSafe(reduce, fadeUp);

  return (
    <MotionRoot>
      <div className="relative min-h-dvh">
        <a
          href="#main"
          className="absolute left-4 top-4 z-[100] -translate-y-[200%] bg-forecourt px-3 py-2 text-pump focus:translate-y-0"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-40 mx-auto mt-3 w-[min(960px,calc(100%-1.5rem))] rounded-[2px] border border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="display text-2xl tracking-wide">
              Brim
            </Link>
            <PrimaryNav path={path} />
          </div>
        </header>
        <div id="main" tabIndex={-1} className="relative">
          <Suspense
            fallback={
              <div className="mx-auto w-[min(960px,calc(100%-1.5rem))] py-8" aria-busy="true">
                <Skeleton className="mb-3 h-10 w-48" />
                <Skeleton className="h-40 w-full" />
              </div>
            }
          >
            <AnimatePresence initial={false}>
              <m.div
                key={path}
                initial={transition.initial}
                animate={transition.animate}
                exit={{ ...transition.exit, position: "absolute", width: "100%" }}
                transition={transition.transition}
              >
                <RouteBody path={path} />
              </m.div>
            </AnimatePresence>
          </Suspense>
        </div>
        <HeraldDialog />
      </div>
    </MotionRoot>
  );
}
