"use client";

import { useState } from "react";
import type { LocationPoint } from "@/types/intelligence";
import { usePreferences } from "./AppPreferences";

export function GoogleLocationMap({ location }: { location: LocationPoint | null }) {
  const { language } = usePreferences();
  const hi = language === "hi";
  const [maptype, setMaptype] = useState<"roadmap" | "satellite">("satellite");
  const [expanded, setExpanded] = useState(false);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY?.trim();
  const center = location ? `${location.latitude},${location.longitude}` : "22.5937,78.9629";
  const params = new URLSearchParams({ key: key || "", center, zoom: location ? "13" : "5", maptype, language, region: "IN" });
  const external = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location ? center : "India")}`;

  return <div className="google-location-map">
    <div className="live-map-heading">
      <div><h3>Google Maps</h3><p>{hi ? "चुने गए स्थान की सड़कें और उपग्रह दृश्य। आपदा परतें ऊपर के मानचित्र पर देखें।" : "Explore roads and satellite imagery at the selected location. Hazard layers remain on the map above."}</p></div>
      <a className="secondary-button" href={external} target="_blank" rel="noopener noreferrer">{hi ? "Google Maps में खोलें" : "Open in Google Maps"} ↗</a>
    </div>
    {key ? <>
      <div className="live-layer-controls">
        <button type="button" className="secondary-button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? (hi ? "मानचित्र छिपाएँ" : "Hide map") : (hi ? "मानचित्र दिखाएँ" : "Show map")}</button>
        {expanded && <label>{hi ? "दृश्य" : "View"} <select value={maptype} onChange={event => setMaptype(event.target.value === "roadmap" ? "roadmap" : "satellite")}><option value="satellite">{hi ? "उपग्रह" : "Satellite"}</option><option value="roadmap">{hi ? "सड़कें" : "Roads"}</option></select></label>}
      </div>
      {expanded && <iframe title={hi ? "Google Maps पर चयनित स्थान" : "Selected location on Google Maps"} src={`https://www.google.com/maps/embed/v1/view?${params}`} width="100%" height="400" style={{ border: 0, display: "block", minWidth: 200 }} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
    </> : <p className="live-map-notes">{hi ? "ऐप में Google Maps अभी उपलब्ध नहीं है। इस स्थान को Google Maps में खोलें।" : "The in-app Google map is not configured yet. You can open this location in Google Maps."}</p>}
  </div>;
}
