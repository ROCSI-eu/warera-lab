/**
 * Reveal an existing destination only after the user explicitly requests it.
 * Never change the URL hash (portable scenarios use #wl=) or animate scrolling.
 * Destinations have tabIndex={-1}, so keyboard focus can follow the action.
 */
export function focusLabSection(id: string): void {
  const heading = document.getElementById(id);
  if (!heading) return;
  heading.focus({ preventScroll: true });
  heading.scrollIntoView({ behavior: "auto", block: "start" });
}
