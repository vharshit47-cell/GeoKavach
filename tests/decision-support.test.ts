import test from "node:test";
import assert from "node:assert/strict";
import { getHabitations, getBaseSafeSites } from "../src/backend/services/data";
import { buildRelocationPlan, getSafeSitesWithAllocations } from "../src/backend/services/relocation";
import { riskCategory } from "../src/backend/services/risk-engine";
import { availableForHabitation, rankSafeSites, recommendationForHabitation, siteStatus } from "../src/shared/config/assessment";
import { getDashboardSummary } from "../src/backend/services/dashboard";
import { getHazardZones } from "../src/backend/services/hazard-zones";

test("risk thresholds include all category boundaries", () => {
  assert.deepEqual([0,25,26,50,51,75,76,100].map(riskCategory), ["SAFE","SAFE","MODERATE","MODERATE","HIGH","HIGH","RED","RED"]);
});
test("ranking excludes unsafe, insufficient and invalid-coordinate sites", () => {
  const h = getHabitations()[0], site = getBaseSafeSites()[0];
  for (const invalid of [{...site,remaining_capacity:h.population-1},{...site,hazard_score:90},{...site,latitude:NaN},{...site,water_score:0}]) assert.equal(rankSafeSites(h,[invalid]).length,0);
  assert.equal(rankSafeSites({...h,longitude:181},[site]).length,0);
  assert.equal(siteStatus({...site,remaining_capacity:0}, h.population),"Limited Capacity");
});
test("proposed allocations conserve capacity and the summary uses remaining places", () => {
  const plan=buildRelocationPlan(), sites=getSafeSitesWithAllocations();
  for (const site of sites) {
    const assigned=plan.filter(p=>p.site_id===site.id).reduce((n,p)=>n+p.population,0);
    assert.equal(site.remaining_capacity,site.capacity-assigned);
    assert.ok(site.remaining_capacity>=0);
  }
  assert.equal(getDashboardSummary().total_available_capacity,sites.reduce((n,s)=>n+s.remaining_capacity,0));
  assert.equal(getDashboardSummary().hazard_zones,getHazardZones().features.length);
});
test("detail recommendation and planner agree without double-counting the selected origin", () => {
  const plan=buildRelocationPlan(), sites=getSafeSitesWithAllocations();
  for (const h of getHabitations()) {
    const available=availableForHabitation(h.id,sites,plan);
    const previous=plan.find(p=>p.habitation_id===h.id);
    assert.equal(available.reduce((n,s)=>n+s.remaining_capacity,0), sites.reduce((n,s)=>n+s.remaining_capacity,0)+(previous?.population??0));
    const ranked=rankSafeSites(h,available), recommendation=recommendationForHabitation(h,sites,plan);
    assert.equal(recommendation?.site_id,ranked[0]?.site.id);
    if(recommendation) assert.ok(recommendation.remaining_capacity_after>=0);
    for(let i=1;i<ranked.length;i++) assert.ok(ranked[i-1].score>=ranked[i].score);
  }
});
