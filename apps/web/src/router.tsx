import { useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from "react";

const scrollMap = new Map<string, number>();
let pushNav = false;

export function usePathname(): string {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => {
      const next = window.location.pathname;
      setPath(next);
      if (pushNav) {
        pushNav = false;
        window.scrollTo(0, 0);
        return;
      }
      window.scrollTo(0, scrollMap.get(next) ?? 0);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return path;
}

export function navigate(to: string): void {
  if (to === window.location.pathname) return;
  scrollMap.set(window.location.pathname, window.scrollY);
  pushNav = true;
  window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function Link({
  href,
  children,
  className,
  ...rest
}: {
  href: string;
  children: ReactNode;
  className?: string;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <a
      href={href}
      className={className}
      {...rest}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        navigate(href);
      }}
    >
      {children}
    </a>
  );
}
