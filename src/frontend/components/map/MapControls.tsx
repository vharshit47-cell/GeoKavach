"use client";
import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, Focus, Layers3, LocateFixed, MapPin, Search, Users, Waves, X } from "lucide-react";
import type { CaseRecord, SiteRecord } from "@/shared/workflow/model";
import type { LocationPoint, SourceResult } from "@/types/intelligence";
import { HAZARD_OPTIONS, type MapHazard, type MapLayers, type MapMode, type Selection } from "@/frontend/lib/map/presentation";

export function MapControls({ mode, setMode, hazard, setHazard, layers, setLayers, opacity, setOpacity, cases, sites, onSelect, onLocation, onReset, onLocate, locating, onRegion, region }: {
  mode: MapMode; setMode: (mode: MapMode) => void; hazard: MapHazard; setHazard: (hazard: MapHazard) => void;
  layers: MapLayers; setLayers: (layers: MapLayers) => void; opacity: number; setOpacity: (opacity: number) => void;
  cases: CaseRecord[]; sites: SiteRecord[]; onSelect: (selection: Selection) => void;
  onLocation: (point: LocationPoint) => void; onReset: () => void; onLocate: () => void; locating: boolean; onRegion: () => void; region: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationPoint[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    setResults([]); setError(false);
    if (query.trim().length < 2) { setSearching(false); return; }
    let active = true;
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(() => {
      fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
        .then(async response => { if (!response.ok) throw new Error(); return response.json() as Promise<SourceResult<LocationPoint[]>>; })
        .then(value => { if (active) { setResults(value.data); setError(value.status === "unavailable"); } })
        .catch(() => { if (active) setError(true); })
        .finally(() => { if (active) setSearching(false); });
    }, 650);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [query]);
  const needle = query.trim().toLowerCase();
  const homes = needle.length >= 2 ? cases.filter(item => item.name.toLowerCase().includes(needle)).slice(0, 5) : [];
  const destinations = needle.length >= 2 ? sites.filter(item => item.name.toLowerCase().includes(needle)).slice(0, 4) : [];
  return <>
    <div className="atlas-topbar">
      <details className="atlas-mode-menu atlas-glass"><summary>Map view</summary><div className="atlas-modes" aria-label="Map mode">{([
        ["exposure", "Exposure", Users], ["hazard", "Hazard", Waves], ["impact", "Impact", Activity],
      ] as const).map(([key, label, Icon]) => <button key={key} aria-pressed={mode === key} className={mode === key ? "is-active" : ""} onClick={() => setMode(key)}><Icon size={14} />{label}</button>)}</div></details>
      <div className="atlas-filter-group">
        <label className="atlas-select atlas-glass"><span>Hazard</span><select aria-label="Hazard" value={hazard} onChange={event => setHazard(event.target.value as MapHazard)}>{HAZARD_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      <div className="atlas-search-wrap">
        <div className="atlas-search atlas-glass"><Search size={16} /><input aria-label="Search map" placeholder="Search a place or assessment" maxLength={100} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Escape") setQuery(""); }} />{query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={14} /></button>}</div>
        {needle.length >= 2 && <div className="atlas-search-results atlas-glass" aria-label="Search results">
          {homes.map(item => <button key={item.id} onClick={() => { onSelect({ kind: "habitation", id: item.id }); setQuery(""); }}><MapPin size={14} /><span>{item.name}<small>Assessed habitation</small></span><ArrowUpRight size={14} /></button>)}
          {destinations.map(item => <button key={item.id} onClick={() => { onSelect({ kind: "site", id: item.id }); setQuery(""); }}><MapPin size={14} /><span>{item.name}<small>Assessed site</small></span><ArrowUpRight size={14} /></button>)}
          {results.map((point, index) => <button key={index} onClick={() => { onLocation(point); setQuery(""); }}><MapPin size={14} /><span>{point.name || point.district || point.state}<small>{[point.district, point.state].filter(Boolean).join(" · ")}</small><ArrowUpRight size={14} /></span></button>)}
          <p role="status">{searching ? "Searching places…" : error ? "Place search unavailable. Saved records remain searchable." : !results.length && !homes.length && !destinations.length ? "No matching locations." : "Select a result to explore"}</p>
        </div>}
      </div>
    </div>
    <button className="atlas-region atlas-glass" onClick={onRegion}><MapPin size={13} /><span>{region}</span><span>⌄</span></button>
    <div className="atlas-tools">
      <button className="atlas-glass" title="Reset India view" aria-label="Reset India view" onClick={onReset}><Focus size={18} /></button>
      <button className="atlas-glass" title="Use current location" aria-label="Use current location" disabled={locating} onClick={onLocate}><LocateFixed size={18} /></button>
      <details className="atlas-layers atlas-glass"><summary aria-label="Map layers"><Layers3 size={18} /><span>Layers</span></summary><div>
        {([
          ["Hazard", [["alerts", "Official warnings & extents"], ["earthquakes", "Earthquake observations"], ["weather", "Weather at selected point"]]],
          ["Exposure", [["habitations", "Assessed habitations"], ["facilities", "Reported infrastructure"]]],
          ["Planning", [["redZones", "Red-zone review candidates"], ["sites", "Assessed relocation sites"]]],
          ["Boundaries", [["states", "States"], ["districts", "Districts in selected state"]]],
        ] as const).map(([heading, items]) => <fieldset key={heading}><legend>{heading}</legend>{items.map(([key, label]) => <label key={key}><input type="checkbox" checked={layers[key]} onChange={event => setLayers({ ...layers, [key]: event.target.checked })} />{label}</label>)}</fieldset>)}
        <label className="atlas-opacity">Layer opacity <span>{Math.round(opacity * 100)}%</span><input aria-label="Layer opacity" type="range" min="0.1" max="0.6" step="0.05" value={opacity} onChange={event => setOpacity(Number(event.target.value))} /></label>
        <p>Population density and declared red-zone boundaries are not connected.</p>
      </div></details>
    </div>
  </>;
}
