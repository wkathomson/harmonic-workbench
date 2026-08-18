// Module folding, as in the reference instrument: click a module head to
// collapse it, and the modulation tier starts folded so the panel opens at a
// workable density.
//
// This works on the DOM rather than through per-module React state on purpose.
// The eight panel modules each render their own <section class="module">, and
// threading a collapsed flag through all of them would mean touching every one
// for a behaviour that is purely presentational. Only `data-collapsed` and the
// aria attributes are set here — attributes React does not own, so they survive
// re-renders — and panel.css does the rest. The caret is a CSS pseudo-element
// rather than an injected node, so React never has a stray child to reconcile.

import { useEffect, useRef } from "react";

export function useModuleFold(collapsedByDefault = []) {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const cleanups = [];
    root.querySelectorAll(".module").forEach((module) => {
      const head = module.querySelector(".module-head");
      if (!head) return;

      head.setAttribute("role", "button");
      head.setAttribute("tabindex", "0");
      head.setAttribute("aria-expanded", "true");

      const toggle = () => {
        const collapsed = module.dataset.collapsed === "true";
        module.dataset.collapsed = String(!collapsed);
        head.setAttribute("aria-expanded", String(collapsed));
        // A canvas inside a hidden module has zero size, so its ResizeObserver
        // redraws it when the module opens again — no manual redraw needed.
      };
      const onKey = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      };

      head.addEventListener("click", toggle);
      head.addEventListener("keydown", onKey);
      cleanups.push(() => {
        head.removeEventListener("click", toggle);
        head.removeEventListener("keydown", onKey);
      });
    });

    for (const id of collapsedByDefault) {
      const module = root.querySelector(`#${id}`);
      if (!module) continue;
      module.dataset.collapsed = "true";
      module.querySelector(".module-head")?.setAttribute("aria-expanded", "false");
    }

    return () => cleanups.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return rootRef;
}
