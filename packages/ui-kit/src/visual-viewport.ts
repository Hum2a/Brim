import { useEffect, useState } from "react";

/** Extra bottom inset when the virtual keyboard occludes the layout viewport. */
export function useVisualViewportBottomInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const apply = () => {
      const occluded = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setInset(Math.round(occluded));
    };
    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
    };
  }, []);

  return inset;
}
