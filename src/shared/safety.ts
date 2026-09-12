import type { Snapshot } from "./workflow/model";
import { capacity, distance, fresh, reservedStatuses } from "./workflow/model";
import type { LocationPoint } from "./types/intelligence";

export function nearbyRelocationSites(location: LocationPoint, snapshot: Snapshot, radiusKm = 50) {
  return snapshot.sites.map(site => ({
    site, distanceKm: distance(location, site),
    available: Math.max(0, capacity(site) - site.occupied - snapshot.plans.filter(p => p.siteId === site.id && reservedStatuses.includes(p.status)).reduce((n, p) => n + p.population, 0)),
  })).filter(item => item.site.verified && fresh(item.site.assessedAt) && item.site.hazard <= 1 && item.available > 0 && item.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
