"use client";

import dynamic from "next/dynamic";
import { LoaderCircle } from "lucide-react";
import { usePreferences } from "./AppPreferences";
import type { Habitation, RelocationRecommendation, SafeSite } from "@/types/disaster";

const DynamicMap = dynamic(() => import("./MapCanvas").then((module) => module.MapCanvas), {
  ssr: false,
  loading: DemoMapLoading,
});

function DemoMapLoading() {
  const { tr } = usePreferences();
  return <div className="map-loading"><LoaderCircle className="spin" size={25} /><strong>{tr("Loading demo GIS layers")}</strong><span>{tr("Preparing habitation and safe-site markers…")}</span></div>;
}

export function SurakshaMap(props: {
  habitations: Habitation[];
  safeSites: SafeSite[];
  showSites: boolean;
  showZones?: boolean;
  showBoundary?: boolean;
  focusPoint?: { latitude: number; longitude: number } | null;
  basemap?: "street" | "satellite";
  activeHazards?: string[];
  selectedSite?: SafeSite | null;
  onSite?: (site: SafeSite) => void;
  hazard?: string;
  selectedHabitation?: Habitation | null;
  selectedPlan: RelocationRecommendation | null;
  onHabitation: (habitation: Habitation) => void;
  onRelocation: (habitation: Habitation) => void;
}) {
  return <DynamicMap {...props} />;
}
