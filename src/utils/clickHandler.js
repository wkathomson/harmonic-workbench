// Single-click vs double-click disambiguator.
//
// Browsers fire `click` for both single AND each click of a double. To
// distinguish them properly we delay the single-click action briefly and
// cancel that timer if a second click arrives within the threshold.
//
// 220ms is right around the OS-default double-click interval — fast enough
// to feel responsive, slow enough that a deliberate double registers.
//
// Usage:
//   const onClick = makeClickHandler(
//     () => toggleSelection(ci, si),    // single
//     () => toggleNote(ci, si),         // double
//   );
//   <div onClick={onClick} />

export function makeClickHandler(onSingle, onDouble, delayMs = 220) {
  let timer = null;
  return (e) => {
    // Stop the synthetic event from bubbling so a second click doesn't
    // get re-interpreted by ancestor handlers.
    e?.stopPropagation?.();
    if (timer) {
      clearTimeout(timer);
      timer = null;
      onDouble?.(e);
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      onSingle?.(e);
    }, delayMs);
  };
}
