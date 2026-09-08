from __future__ import annotations

import csv
import json
import re
from collections import Counter
from pathlib import Path

import pandas as pd


ROOT = Path(r"D:\JalDrishti\groundwater_csv")
MASTER = ROOT / "groundwater_master.csv"
EXPECTED_COLUMNS = [
    "state", "district", "block", "village", "latitude", "longitude",
    "measurement_date", "depth_to_water_m_bgl", "measurement_campaign",
    "aquifer_type", "source_file", "source_page", "data_quality_flags",
]

summary = json.loads((ROOT / "quality_summary.json").read_text(encoding="utf-8"))
totals = Counter()
mins = {"latitude": float("inf"), "longitude": float("inf"), "depth": float("inf"), "date": "9999-99-99"}
maxs = {"latitude": float("-inf"), "longitude": float("-inf"), "depth": float("-inf"), "date": "0000-00-00"}
source_counts = Counter()
campaign_counts = Counter()
max_pages = Counter()

for chunk in pd.read_csv(MASTER, chunksize=150_000, low_memory=False):
    assert list(chunk.columns) == EXPECTED_COLUMNS
    totals["rows"] += len(chunk)
    totals["missing_coordinates"] += int((chunk["latitude"].isna() | chunk["longitude"].isna()).sum())
    totals["missing_dates"] += int(chunk["measurement_date"].isna().sum())
    totals["missing_groundwater"] += int(chunk["depth_to_water_m_bgl"].isna().sum())
    assert chunk["measurement_date"].dropna().astype(str).str.fullmatch(r"\d{4}-\d{2}-\d{2}").all()
    for col, key in (("latitude", "latitude"), ("longitude", "longitude"), ("depth_to_water_m_bgl", "depth")):
        values = chunk[col].dropna()
        if len(values):
            mins[key] = min(mins[key], float(values.min()))
            maxs[key] = max(maxs[key], float(values.max()))
    dates = chunk["measurement_date"].dropna().astype(str)
    if len(dates):
        mins["date"] = min(mins["date"], dates.min())
        maxs["date"] = max(maxs["date"], dates.max())
    source_counts.update(chunk["source_file"].value_counts().to_dict())
    campaign_counts.update(chunk["measurement_campaign"].value_counts().to_dict())
    for source, page in chunk.groupby("source_file")["source_page"].max().items():
        max_pages[source] = max(max_pages[source], int(page))

assert totals["rows"] == summary["parsed_records"]
assert totals["missing_coordinates"] == summary["missing_coordinates"]
assert totals["missing_dates"] == summary["missing_dates"]
assert totals["missing_groundwater"] == summary["missing_groundwater_values"]
assert mins["latitude"] >= -90 and maxs["latitude"] <= 90
assert mins["longitude"] >= -180 and maxs["longitude"] <= 180
assert set(campaign_counts) == {"August", "January", "Pre-monsoon"}

per_file_rows = {}
for raw_path in sorted((ROOT / "raw_extracted").glob("*_raw.csv")):
    clean_path = ROOT / "cleaned" / raw_path.name.replace("_raw.csv", "_clean.csv")
    raw_count = sum(1 for _ in raw_path.open("r", encoding="utf-8", newline="")) - 1
    clean_count = sum(1 for _ in clean_path.open("r", encoding="utf-8", newline="")) - 1
    assert raw_count == clean_count
    per_file_rows[raw_path.name] = raw_count

with (ROOT / "ambiguous_rows.csv").open("r", encoding="utf-8", newline="") as stream:
    ambiguous_count = sum(1 for _ in csv.DictReader(stream))
assert ambiguous_count == summary["ambiguous_rows"]

result = {
    "rows": totals["rows"],
    "source_counts": dict(source_counts),
    "campaign_counts": dict(campaign_counts),
    "max_source_pages": dict(max_pages),
    "missing_coordinates": totals["missing_coordinates"],
    "missing_dates": totals["missing_dates"],
    "missing_groundwater": totals["missing_groundwater"],
    "minimums": mins,
    "maximums": maxs,
    "raw_clean_row_counts": per_file_rows,
    "ambiguous_rows": ambiguous_count,
    "status": "PASS",
}
print(json.dumps(result, indent=2))
