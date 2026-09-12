// Origin-tab tracking for truthful back-button labels (expo-mobile ticket
// 18). A pushed screen cannot know its origin from the router, so each tab
// records its label on focus; stack screens read it on mount for
// `headerBackTitle`. Focus ordering makes this exact: the origin tab is
// still focused when the push lands, tab switches re-record, and deep links
// fall back to the initial tab ("خانه") — which is also where Back lands.
// Pure module (no React) so the contract is unit-testable.

const INITIAL_TAB_LABEL = "خانه";

let currentLabel: string = INITIAL_TAB_LABEL;

/** Recorded by each tab screen on focus (ticket 18). */
export function setLastTabLabel(label: string): void {
  currentLabel = label;
}

/** The label Back will land on — read by stack screens on mount. */
export function getLastTabLabel(): string {
  return currentLabel;
}

/** Test seam: restore the launch state. */
export function resetLastTabLabel(): void {
  currentLabel = INITIAL_TAB_LABEL;
}
