"use client";

import { useState } from "react";

// The one mutation voice of the manager islands (ticket 28): a pending
// gate and a single generic failure line that never swallows what the
// user typed. Every handler in a manager runs through run().

export function useRun() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>, failureMessage: string) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await action();
    } catch {
      setError(failureMessage);
    } finally {
      setPending(false);
    }
  }

  return { run, pending, error, setError };
}
