import { AnimatePresence, LayoutGroup, m } from "motion/react";
import { lazy, Suspense } from "react";
import { MotionRoot, pageTransition, usePrefersReducedMotion } from "@brim/ui-kit";
import { Link, usePathname } from "./router.js";
import { Skeleton } from "@brim/ui-kit/skeleton";
import { EstimatePage } from "./pages/EstimatePage.js";

const KitchenSink = lazy(() => import("./pages/KitchenSink.js").then((mod) => ({ default: mod.KitchenSink })));
const HistoryPage = lazy(() => import("./pages/HistoryPage.js").then((mod) => ({ default: mod.HistoryPage })));
const AccountPage = lazy(() => import("./pages/AccountPage.js").then((mod) => ({ default: mod.AccountPage })));

function NavLink({ href, label, current }: { href: string; label: string; current: boolean }) {
  return (
    <Link
      href={href}
      className={`relative px-2 py-1 text-sm ${current ? "text-pump" : "text-mist hover:text-pump"}`}
    >
      {label}
      {current ? (
        <m.span layoutId="nav-ink" className="absolute inset-x-1 -bottom-0.5 h-px bg-pump/50" />
      ) : null}
    </Link>
  );
}

function RouteBody({ path }: { path: string }) {
  if (path.startsWith("/kitchen-sink")) return <KitchenSink />;
  if (path.startsWith("/history")) return <HistoryPage />;
  if (path.startsWith("/account")) return <AccountPage />;
  return <EstimatePage />;
}

export function AppShell() {
  const path = usePathname();
  const reduce = usePrefersReducedMotion();
  const transition = reduce
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : pageTransition;

  return (
    <MotionRoot>
      <LayoutGroup>
        <div className="relative min-h-dvh">
          <header className="sticky top-0 z-40 mx-auto mt-3 w-[min(960px,calc(100%-1.5rem))] rounded-[2px] border border-glass-border bg-[var(--glass)] px-4 py-3 shadow-glass backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <Link href="/" className="display text-2xl tracking-wide">
                <m.span layoutId="brim-wordmark">Brim</m.span>
              </Link>
              <nav className="flex items-center gap-1">
                <NavLink href="/" label="Estimate" current={path === "/"} />
                <NavLink href="/history" label="History" current={path.startsWith("/history")} />
                <NavLink href="/account" label="Account" current={path.startsWith("/account")} />
                <NavLink href="/kitchen-sink" label="Lab" current={path.startsWith("/kitchen-sink")} />
              </nav>
            </div>
          </header>
          <Suspense
            fallback={
              <div className="mx-auto w-[min(960px,calc(100%-1.5rem))] py-8" aria-busy="true">
                <Skeleton className="mb-3 h-10 w-48" />
                <Skeleton className="h-40 w-full" />
              </div>
            }
          >
            <AnimatePresence mode="wait">
              <m.div key={path} {...transition}>
                <RouteBody path={path} />
              </m.div>
            </AnimatePresence>
          </Suspense>
        </div>
      </LayoutGroup>
    </MotionRoot>
  );
}
