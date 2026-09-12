import assert from "node:assert/strict";
import test from "node:test";

import { hazardFromText } from "../src/backend/providers/core";
import { parseEonetEvents } from "../src/backend/providers/occurrences";

test("cloudbursts are classified separately from generic rain alerts", () => {
  assert.equal(hazardFromText("Cloudburst triggers a flash flood in Uttarkashi"), "cloudburst");
  assert.equal(hazardFromText("Very heavy rain warning"), "extreme-weather");
});

test("EONET flood points become mappable occurrence records", () => {
  const events = parseEonetEvents({ events: [{
    id: "EONET_TEST",
    title: "Flood in India",
    closed: "2026-08-12T00:00:00Z",
    categories: [{ id: "floods", title: "Floods" }],
    sources: [{ id: "GDACS", url: "https://www.gdacs.org/report.aspx?eventtype=FL&eventid=1" }],
    geometry: [{ date: "2026-08-10T00:00:00Z", type: "Point", coordinates: [77.6, 12.98] }],
  }] });
  assert.equal(events.length, 1);
  assert.equal(events[0].hazardType, "flood");
  assert.equal(events[0].longitude, 77.6);
  assert.equal(events[0].latitude, 12.98);
  assert.equal(events[0].status, "ended");
});

test("EONET area geometry is reduced to an explicitly approximate map centroid", () => {
  const events = parseEonetEvents({ events: [{
    id: "EONET_SLIDE",
    title: "Karnataka floods and landslides",
    categories: [{ id: "landslides", title: "Landslides" }],
    sources: [{ id: "EO", url: "https://eonet.gsfc.nasa.gov/" }],
    geometry: [{ date: "2018-08-14T00:00:00Z", type: "Polygon", coordinates: [[[12.9, 75.4], [13.1, 75.8], [12.9, 75.4]]] }],
  }] });
  assert.equal(events.length, 1);
  assert.equal(events[0].hazardType, "landslide");
  assert.equal(events[0].locationPrecision, "area-centroid");
  assert.ok(events[0].latitude > 12.8 && events[0].latitude < 13.2);
  assert.ok(events[0].longitude > 75.3 && events[0].longitude < 75.9);
});
