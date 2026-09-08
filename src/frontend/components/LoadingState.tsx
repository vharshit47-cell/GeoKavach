"use client";
import { usePreferences } from "./AppPreferences";
import { LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react";

export function LoadingState({ label = "Loading decision-support data" }: { label?: string }) {
  const { tr } = usePreferences();
  return <div className="state-card"><LoaderCircle className="spin" size={25} /><strong>{tr(label)}</strong><span>{tr("Preparing the latest modeled assessment…")}</span></div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { tr } = usePreferences();
  return <div className="state-card error"><TriangleAlert size={25} /><strong>{tr("Data could not be loaded")}</strong><span>{tr(message)}</span>{onRetry && <button className="secondary-button" onClick={onRetry}><RotateCcw size={14} />{tr("Retry")}</button>}</div>;
}
