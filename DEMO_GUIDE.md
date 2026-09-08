# SurakshaSetu — end-to-end prototype

Start with `npm run dev` and open http://localhost:3000/relocation. Node.js 22.13 or newer is required for the native SQLite workflow store (verified with Node 24).

## Stakeholder demonstration

1. Select **Field officer** in the labelled local prototype session. Enter a habitation's population, vulnerable count, coordinates, four hazard intensities, disaster history and dated evidence. No mock values are preloaded.
2. Register two surveyed destinations. Enter supported person-capacities for land, water, sanitation and shelter, baseline occupants, maximum site hazard and inspection evidence. An OSM facility can supply coordinates, but never supplies invented capacity or safety.
3. Open **Recommend**. Show the risk explanation, GIS points, an excluded site and an eligible site. Submit the eligible option for approval.
4. Select **Administrator**, open **Monitor**, review the assessment and evidence, add a decision note and approve. Capacity is reserved in a transaction; competing proposals are checked against remaining capacity.
5. Select **Coordinator**, record departure, open Google Maps directions, then record arrival with a note. Refresh to demonstrate persistence. Export the decision record and show the audit trail.

For a rehearsal, use explicitly labelled test inputs supported by a test evidence note; do not present them as real surveyed sites. Test fixtures are confined to automated tests and are not loaded into the app.

## Core model

Exposure: maximum hazard intensity / 5 × 55. Vulnerability: vulnerable / population × 30. History: min(events, 5) / 5 × 15. The rounded sum uses Safe 0–25, Moderate 26–50, High 51–75 and Critical 76–100. Critical points are red-zone review candidates, not authoritative polygons or legal determinations.

Site carrying capacity is min(land, water, sanitation, shelter). Available capacity subtracts baseline occupants and approved/moving/completed commitments. Sites require officer-verified safety/access, hazard ≤1/5, assessments within 30 days and sufficient space for the full population. Eligible sites are ordered by straight-line distance. Google Maps provides road route comparison; shortest/safe routes are not guaranteed.

## Persistence, permissions and deployment

- Local SQLite database: `.local/relocation.sqlite` (ignored by Git). Keep the whole `.local` directory private. Use SQLite's backup API or stop writes before taking a backup; a live copy of only the main file can omit WAL data.
- One Node server with persistent storage is supported. Ephemeral/serverless or multiple-instance deployments require a shared transactional database.
- Local role sessions only work in development on localhost. They are explicitly a supervised role demonstration and can access only the `local-prototype` workspace.
- In production, use existing Supabase authentication. A trusted administrator must provision `app_metadata.workflow_role` (`officer`, `administrator`, `coordinator`) and `app_metadata.workflow_workspace` (district/workspace ID). Users cannot provision these through profile settings. The local rehearsal database is isolated from official workspaces.
- HTTP mutation guards enforce role permissions and workspace isolation. SQLite transactions prevent over-allocation. Optimistic record versions block outdated updates. Request IDs make retries safe. Plans preserve the submitted evidence snapshots.
- Device drafts are opt-in and not approvals. Provider outages do not create fabricated values. Changed/stale evidence blocks approval/departure.
- Full operational deployment still requires approved data sources, backups, monitoring, occupancy reconciliation and field validation. No trained AI model or labelled field evaluation dataset is included.

## Evidence of completion

- Production build and TypeScript pass.
- 36 tests pass, including invalid/missing inputs, stale and unsafe sites, role restrictions, cross-workspace isolation, over-allocation, duplicate requests and immutable evidence.
- Browser walkthrough: assessment → eligible recommendation → administrator approval → coordinator departure → arrival. Completed plan persisted across reload. Google Maps link contained the correct origin and destination.
- Responsive check at 390px: no horizontal page overflow. No browser console errors observed in the completed walkthrough.
- Domain metrics: people with committed capacity, people recorded relocated, pending decisions, average submission-to-approval time and completion percentage. No actual field effectiveness or predictive accuracy claim is made.

Website explanation and evaluation guidance: http://localhost:3000/resources.
