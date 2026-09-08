"use client";

import { ErrorState } from "@/components/LoadingState";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div style={{ padding: 24 }}><ErrorState message={"An unexpected interface error occurred"} onRetry={reset} /></div>;
}

