from __future__ import annotations

import csv
import hashlib
import json
import math
import re
import sys
import time
from collections import Counter
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Iterable

import pypdfium2 as pdfium


SOURCE_DIR = Path(r"C:\Users\Harshit\Desktop\Ground water data")
OUTPUT_DIR = Path(r"D:\JalDrishti\groundwater_csv")
RAW_DIR = OUTPUT_DIR / "raw_extracted"
CLEAN_DIR = OUTPUT_DIR / "cleaned"

SOURCES = [
    (SOURCE_DIR / "August_WL_1994-2025.pdf", "August"),
    (SOURCE_DIR / "January_WL_1994-2025.pdf", "January"),
    (SOURCE_DIR / "Pre-monsoon_WL_1994-2025.pdf", "Pre-monsoon"),
]

RAW_COLUMNS = [
    "state_raw",
    "district_raw",
    "block_raw",
    "village_raw",
    "latitude_raw",
    "longitude_raw",
    "date_raw",
    "wl_mbgl_raw",
    "source_file",
    "source_page",
    "extraction_status",
    "raw_text",
]

CLEAN_COLUMNS = [
    "state",
    "district",
    "block",
    "village",
    "latitude",
    "longitude",
    "measurement_date",
    "depth_to_water_m_bgl",
    "measurement_campaign",
    "aquifer_type",
    "source_file",
    "source_page",
    "data_quality_flags",
]

AMBIGUOUS_COLUMNS = ["source_file", "source_page", "raw_text", "reason"]

HEADER_PATTERNS = [
    re.compile(r"(?:STATE_UT|State)", re.I),
    re.compile(r"District", re.I),
    re.compile(r"Block", re.I),
    re.compile(r"Village(?:_NA)?", re.I),
    re.compile(r"Latitute|Latitude", re.I),
    re.compile(r"Longitude", re.I),
    re.compile(r"Date", re.I),
    re.compile(r"WL", re.I),
]

NUMBER = r"[-+]?\d{1,3}(?:\.\d+)?"
ROW_RE = re.compile(
    rf"^(?P<location>.*?)(?P<lat>{NUMBER})\s+(?P<lon>{NUMBER})\s+"
    r"(?P<date>\d{1,2}[-/]\d{1,2}[-/]\d{2,4})"
    r"(?:\s+(?P<wl>[-+]?\d+(?:\.\d+)?))?\s*$"
)
DATE_TOKEN_RE = re.compile(r"\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b")


def collapse_space(value: str) -> str:
    return " ".join(value.replace("\u00a0", " ").split())


def stable_digest(parts: Iterable[str]) -> bytes:
    payload = "\x1f".join(parts).encode("utf-8", errors="replace")
    return hashlib.blake2b(payload, digest_size=16).digest()


def normalize_number(raw: str) -> tuple[str, float | None, str | None]:
    text = collapse_space(raw)
    if not text or text.lower() in {"na", "n/a", "nil", "null", "-", "--"}:
        return "", None, None
    candidate = text.replace(",", "")
    try:
        value = float(candidate)
    except ValueError:
        return "", None, "malformed_numeric"
    if not math.isfinite(value):
        return "", None, "malformed_numeric"
    return format(value, ".15g"), value, None


def normalize_date(raw: str) -> tuple[str, str | None]:
    text = collapse_space(raw)
    if not text:
        return "", None
    match = re.fullmatch(r"(\d{1,2})[-/](\d{1,2})[-/](\d{2}|\d{4})", text)
    if not match:
        return "", "malformed_date"
    day, month, year_text = (int(part) for part in match.groups())
    if len(match.group(3)) == 2:
        year = 1900 + year_text if year_text >= 90 else 2000 + year_text
    else:
        year = year_text
    try:
        parsed = date(year, month, day)
    except ValueError:
        return "", "malformed_date"
    if not 1994 <= parsed.year <= 2025:
        return parsed.isoformat(), "date_outside_document_range"
    return parsed.isoformat(), None


def find_header_indices(text: str) -> list[int] | None:
    search_text = text[:800]
    indices: list[int] = []
    cursor = 0
    for pattern in HEADER_PATTERNS:
        match = pattern.search(search_text, cursor)
        if not match:
            return None
        indices.append(match.start())
        cursor = match.end()
    return indices


def first_valid_row_match(text: str) -> re.Match[str] | None:
    for line_match in re.finditer(r"[^\r\n]+", text):
        match = ROW_RE.match(line_match.group(0).strip())
        if match:
            # Convert line-relative spans to text-page character offsets.
            shifted = _ShiftedMatch(match, line_match.start() + (len(line_match.group(0)) - len(line_match.group(0).lstrip())))
            return shifted  # type: ignore[return-value]
    return None


class _ShiftedMatch:
    def __init__(self, match: re.Match[str], shift: int):
        self.match = match
        self.shift = shift

    def start(self, group: str | int = 0) -> int:
        return self.shift + self.match.start(group)

    def group(self, group: str | int = 0) -> str:
        return self.match.group(group)


def page_columns(page, textpage, text: str) -> tuple[list[list[str]], list[float], float] | None:
    header_indices = find_header_indices(text)
    row_match = first_valid_row_match(text)
    if not header_indices or not row_match:
        return None
    try:
        header_boxes = [textpage.get_charbox(index) for index in header_indices]
        numeric_starts = [textpage.get_charbox(row_match.start(name))[0] for name in ("lat", "lon", "date")]
    except Exception:
        return None
    starts = [box[0] for box in header_boxes[:4]] + numeric_starts + [header_boxes[7][0]]
    if any(starts[i] >= starts[i + 1] for i in range(7)):
        return None
    header_bottom = min(box[1] for box in header_boxes)
    data_top = header_bottom - 3.0
    columns: list[list[str]] = []
    for i in range(8):
        left = 0.0 if i == 0 else starts[i] - 1.0
        right = page.get_width() if i == 7 else starts[i + 1] - 1.0
        bounded = textpage.get_text_bounded(left, 0.0, right, data_top)
        values = [line.strip() for line in bounded.splitlines() if line.strip()]
        columns.append(values)
    return columns, starts, data_top


def fallback_rows(textpage, text: str, header_starts: list[float] | None) -> tuple[list[list[str]], list[tuple[str, str]]]:
    parsed: list[list[str]] = []
    ambiguous: list[tuple[str, str]] = []
    for line_match in re.finditer(r"[^\r\n]+", text):
        raw_line = line_match.group(0).strip()
        if not raw_line:
            continue
        row_match = ROW_RE.match(raw_line)
        if not row_match:
            if DATE_TOKEN_RE.search(raw_line):
                ambiguous.append((raw_line, "date-like row did not match the expected eight-field structure"))
            continue
        if not header_starts:
            ambiguous.append((raw_line, "table header positions could not be resolved"))
            continue
        shift = line_match.start() + (len(line_match.group(0)) - len(line_match.group(0).lstrip()))
        location_text = row_match.group("location")
        location_start = shift + row_match.start("location")
        fields = [[], [], [], []]
        boundaries = header_starts[1:4]
        try:
            for token in re.finditer(r"\S+", location_text):
                x = textpage.get_charbox(location_start + token.start())[0]
                col = sum(x >= boundary - 1.0 for boundary in boundaries)
                fields[min(col, 3)].append(token.group(0))
        except Exception:
            ambiguous.append((raw_line, "character positions could not be read"))
            continue
        parsed.append([
            " ".join(fields[0]),
            " ".join(fields[1]),
            " ".join(fields[2]),
            " ".join(fields[3]),
            row_match.group("lat"),
            row_match.group("lon"),
            row_match.group("date"),
            row_match.group("wl") or "",
        ])
    return parsed, ambiguous


def text_line_rows(text: str) -> list[re.Match[str]]:
    rows: list[re.Match[str]] = []
    for line_match in re.finditer(r"[^\r\n]+", text):
        raw_line = line_match.group(0).strip()
        match = ROW_RE.match(raw_line)
        if match:
            rows.append(match)
    return rows


def hybrid_rows(columns: list[list[str]], line_rows: list[re.Match[str]]) -> list[list[str]] | None:
    if not line_rows:
        return None
    first_counts = [len(column) for column in columns[:4]]
    if len(set(first_counts)) != 1 or first_counts[0] != len(line_rows):
        return None
    rows: list[list[str]] = []
    for index, match in enumerate(line_rows):
        state, district, block = (columns[col][index] for col in range(3))
        bounded_village = columns[3][index]
        location = collapse_space(match.group("location"))
        prefix = collapse_space(" ".join([state, district, block]))
        if prefix and location.startswith(prefix):
            village = location[len(prefix):].strip()
        elif location and not location.startswith(collapse_space(state)):
            # PDFium occasionally starts a logical line at the village when a long row overlaps.
            village = location
        else:
            village = bounded_village
        rows.append([
            state,
            district,
            block,
            village,
            match.group("lat"),
            match.group("lon"),
            match.group("date"),
            match.group("wl") or "",
        ])
    return rows


@dataclass
class Stats:
    pdfs_processed: int = 0
    pages_processed: int = 0
    rows_extracted: int = 0
    parsed_records: int = 0
    valid_records: int = 0
    ambiguous_rows: int = 0
    duplicate_rows_found: int = 0
    rows_removed: int = 0
    missing_coordinates: int = 0
    missing_dates: int = 0
    missing_groundwater_values: int = 0
    malformed_numeric_values: int = 0
    malformed_dates: int = 0
    invalid_latitudes: int = 0
    invalid_longitudes: int = 0
    suspicious_negative_groundwater_values: int = 0
    suspicious_high_groundwater_values: int = 0
    fallback_pages: int = 0
    failed_pages: int = 0
    states: set[str] = field(default_factory=set)
    districts: set[tuple[str, str]] = field(default_factory=set)
    station_hashes: set[bytes] = field(default_factory=set)
    seen_observations: set[bytes] = field(default_factory=set)
    flags: Counter[str] = field(default_factory=Counter)
    per_file: dict[str, dict] = field(default_factory=dict)


def clean_record(raw: list[str], campaign: str, source_file: str, source_page: int, stats: Stats) -> dict[str, str]:
    state, district, block, village = (collapse_space(value) for value in raw[:4])
    lat_text, lat_value, lat_error = normalize_number(raw[4])
    lon_text, lon_value, lon_error = normalize_number(raw[5])
    date_text, date_error = normalize_date(raw[6])
    depth_text, depth_value, depth_error = normalize_number(raw[7])
    flags: list[str] = []

    if not lat_text or not lon_text:
        stats.missing_coordinates += 1
        flags.append("missing_coordinates")
    if lat_error or lon_error or depth_error:
        malformed_count = sum(error == "malformed_numeric" for error in (lat_error, lon_error, depth_error))
        stats.malformed_numeric_values += malformed_count
        flags.append("malformed_numeric")
    if not date_text:
        stats.missing_dates += 1
        flags.append("missing_date")
    if date_error:
        stats.malformed_dates += 1
        flags.append(date_error)
    if not depth_text:
        stats.missing_groundwater_values += 1
        flags.append("missing_groundwater_value")
    if lat_value is not None and not -90 <= lat_value <= 90:
        stats.invalid_latitudes += 1
        flags.append("latitude_out_of_range")
    if lon_value is not None and not -180 <= lon_value <= 180:
        stats.invalid_longitudes += 1
        flags.append("longitude_out_of_range")
    if depth_value is not None and depth_value < 0:
        stats.suspicious_negative_groundwater_values += 1
        flags.append("negative_depth_review")
    if depth_value is not None and depth_value > 300:
        stats.suspicious_high_groundwater_values += 1
        flags.append("depth_over_300m_review")

    semantic = [state, district, block, village, lat_text, lon_text, date_text, depth_text]
    digest = stable_digest(semantic)
    if digest in stats.seen_observations:
        stats.duplicate_rows_found += 1
        flags.append("exact_duplicate_observation")
    else:
        stats.seen_observations.add(digest)

    if state:
        stats.states.add(state)
    if state or district:
        stats.districts.add((state, district))
    stats.station_hashes.add(stable_digest([state, district, block, village, lat_text, lon_text]))

    for flag in set(flags):
        stats.flags[flag] += 1
    if lat_text and lon_text and date_text and depth_text and not lat_error and not lon_error and not date_error and not depth_error:
        stats.valid_records += 1

    return {
        "state": state,
        "district": district,
        "block": block,
        "village": village,
        "latitude": lat_text,
        "longitude": lon_text,
        "measurement_date": date_text,
        "depth_to_water_m_bgl": depth_text,
        "measurement_campaign": campaign,
        "aquifer_type": "Unconfined",
        "source_file": source_file,
        "source_page": str(source_page),
        "data_quality_flags": ";".join(dict.fromkeys(flags)),
    }


def raw_record(values: list[str], source_file: str, source_page: int, status: str, raw_text: str = "") -> dict[str, str]:
    padded = values[:8] + [""] * max(0, 8 - len(values))
    return {
        **dict(zip(RAW_COLUMNS[:8], padded[:8])),
        "source_file": source_file,
        "source_page": str(source_page),
        "extraction_status": status,
        "raw_text": raw_text,
    }


def process_pdf(path: Path, campaign: str, stats: Stats, master_writer: csv.DictWriter, ambiguous_writer: csv.DictWriter) -> None:
    started = time.time()
    raw_path = RAW_DIR / f"{path.stem}_raw.csv"
    clean_path = CLEAN_DIR / f"{path.stem}_clean.csv"
    pdf = pdfium.PdfDocument(path)
    file_stats = Counter()

    with raw_path.open("w", encoding="utf-8", newline="") as raw_stream, clean_path.open("w", encoding="utf-8", newline="") as clean_stream:
        raw_writer = csv.DictWriter(raw_stream, fieldnames=RAW_COLUMNS, extrasaction="ignore")
        clean_writer = csv.DictWriter(clean_stream, fieldnames=CLEAN_COLUMNS, extrasaction="ignore")
        raw_writer.writeheader()
        clean_writer.writeheader()

        for page_index in range(len(pdf)):
            page_number = page_index + 1
            stats.pages_processed += 1
            file_stats["pages"] += 1
            page = pdf[page_index]
            textpage = page.get_textpage()
            text = textpage.get_text_range()
            resolved = page_columns(page, textpage, text)
            rows: list[list[str]] = []
            page_ambiguous: list[tuple[str, str]] = []
            status = "column_aligned"

            if resolved:
                columns, starts, _ = resolved
                rows = hybrid_rows(columns, text_line_rows(text)) or []
                if rows:
                    status = "hybrid_position_and_line"
                else:
                    stats.fallback_pages += 1
                    file_stats["fallback_pages"] += 1
                    status = "line_position_fallback"
                    header_starts = starts[:4]
                    rows, page_ambiguous = fallback_rows(textpage, text, header_starts)
            else:
                stats.fallback_pages += 1
                file_stats["fallback_pages"] += 1
                status = "line_position_fallback"
                header_indices = find_header_indices(text)
                header_starts = None
                if header_indices:
                    try:
                        header_starts = [textpage.get_charbox(index)[0] for index in header_indices[:4]]
                    except Exception:
                        header_starts = None
                rows, page_ambiguous = fallback_rows(textpage, text, header_starts)

            # Filter residual headers/titles conservatively and preserve unresolved date-like lines.
            for values in rows:
                if len(values) != 8:
                    page_ambiguous.append((" | ".join(values), "row did not contain eight extracted cells"))
                    continue
                if not DATE_TOKEN_RE.fullmatch(collapse_space(values[6])):
                    raw_line = " | ".join(values)
                    if DATE_TOKEN_RE.search(raw_line):
                        page_ambiguous.append((raw_line, "date was not isolated in the expected date column"))
                    continue
                raw_writer.writerow(raw_record(values, path.name, page_number, status))
                cleaned = clean_record(values, campaign, path.name, page_number, stats)
                clean_writer.writerow(cleaned)
                master_writer.writerow(cleaned)
                stats.parsed_records += 1
                stats.rows_extracted += 1
                file_stats["parsed_records"] += 1

            for raw_line, reason in page_ambiguous:
                raw_writer.writerow(raw_record([], path.name, page_number, "ambiguous", raw_line))
                ambiguous_writer.writerow({
                    "source_file": path.name,
                    "source_page": str(page_number),
                    "raw_text": raw_line,
                    "reason": reason,
                })
                stats.ambiguous_rows += 1
                stats.rows_extracted += 1
                file_stats["ambiguous_rows"] += 1

            if not rows and not page_ambiguous:
                stats.failed_pages += 1
                file_stats["failed_pages"] += 1

            if page_number % 250 == 0 or page_number == len(pdf):
                elapsed = time.time() - started
                print(
                    f"[{path.name}] {page_number}/{len(pdf)} pages, "
                    f"parsed={file_stats['parsed_records']:,}, ambiguous={file_stats['ambiguous_rows']:,}, "
                    f"elapsed={elapsed:.1f}s",
                    flush=True,
                )

    stats.pdfs_processed += 1
    stats.per_file[path.name] = dict(file_stats)


def write_dictionary() -> None:
    rows = [
        ("state", "State or Union Territory name", "string", "", "State / STATE_UT"),
        ("district", "District name", "string", "", "District / DISTRICT"),
        ("block", "Administrative block name", "string", "", "Block / BLOCK"),
        ("village", "Village or locality name", "string", "", "Village / VILLAGE / VILLAGE_NA"),
        ("latitude", "Latitude in decimal degrees", "numeric", "decimal degrees", "Latitute / Latitude / LATITUDE"),
        ("longitude", "Longitude in decimal degrees", "numeric", "decimal degrees", "Longitude / LONGITUDE"),
        ("measurement_date", "Groundwater measurement date", "date", "YYYY-MM-DD", "Date"),
        ("depth_to_water_m_bgl", "Depth from ground surface to groundwater", "numeric", "metres below ground level (m bgl)", "WL(mbgl) / WL (in mbgl)"),
        ("measurement_campaign", "Seasonal reporting campaign represented by the source PDF", "string", "", "PDF title"),
        ("aquifer_type", "Aquifer confinement class reported by the source table", "string", "", "Table title (Unconfined Aquifer)"),
        ("source_file", "Original PDF filename", "string", "", "Generated traceability field"),
        ("source_page", "One-based page number in the original PDF", "integer", "page", "Generated traceability field"),
        ("data_quality_flags", "Semicolon-separated review flags; blank means no detected issue", "string", "", "Generated quality-control field"),
    ]
    with (OUTPUT_DIR / "data_dictionary.csv").open("w", encoding="utf-8", newline="") as stream:
        writer = csv.writer(stream)
        writer.writerow(["column_name", "description", "data_type", "unit", "source_field"])
        writer.writerows(rows)


def write_report(stats: Stats, elapsed: float) -> None:
    per_file_lines = []
    for source, campaign in SOURCES:
        file_stats = stats.per_file.get(source.name, {})
        per_file_lines.append(
            f"| {source.name} | {campaign} | {file_stats.get('pages', 0):,} | "
            f"{file_stats.get('parsed_records', 0):,} | {file_stats.get('ambiguous_rows', 0):,} | "
            f"{file_stats.get('fallback_pages', 0):,} |"
        )

    report = f"""# Groundwater PDF conversion report

## Summary

Three groundwater-level PDFs were processed as digitally generated, multi-page tables. The tables contain eight source fields: state/UT, district, block, village/locality, latitude, longitude, date, and depth to water in metres below ground level (m bgl). No station or well identifier is present in the source tables.

| Source PDF | Campaign | Pages | Parsed records | Ambiguous rows | Fallback pages |
|---|---:|---:|---:|---:|---:|
{chr(10).join(per_file_lines)}

## Data-quality results

- PDFs processed: {stats.pdfs_processed:,}
- Pages processed: {stats.pages_processed:,}
- Rows extracted (parsed plus ambiguous): {stats.rows_extracted:,}
- Parsed groundwater records: {stats.parsed_records:,}
- Fully valid groundwater records: {stats.valid_records:,}
- Exact duplicate observations found: {stats.duplicate_rows_found:,}
- Rows removed: {stats.rows_removed:,} (duplicates and possible outliers were retained conservatively)
- Missing coordinates: {stats.missing_coordinates:,}
- Missing dates: {stats.missing_dates:,}
- Missing groundwater values: {stats.missing_groundwater_values:,}
- Malformed numeric values: {stats.malformed_numeric_values:,}
- Malformed dates: {stats.malformed_dates:,}
- Ambiguous rows: {stats.ambiguous_rows:,}
- Pages requiring line/position fallback: {stats.fallback_pages:,}
- Pages with no recoverable rows: {stats.failed_pages:,}
- Latitude values outside -90 to 90: {stats.invalid_latitudes:,}
- Longitude values outside -180 to 180: {stats.invalid_longitudes:,}
- Negative depth-to-water values flagged for review: {stats.suspicious_negative_groundwater_values:,}
- Depth-to-water values over 300 m flagged for review: {stats.suspicious_high_groundwater_values:,}
- Unique station-like locations: {len(stats.station_hashes):,} (state + district + block + village + coordinates; source has no station IDs)
- Unique states/UT names: {len(stats.states):,}
- Unique state-district pairs: {len(stats.districts):,}

## Extraction and cleaning

The PDFs are text-based rather than scanned, so OCR was not used. Column positions were resolved from each page's header and numeric field coordinates. Pages whose eight column streams did not align were re-parsed line-by-line using the text coordinates. Repeated titles and column headings were excluded. Source strings were retained in the raw CSVs; cleaned files collapse unnecessary whitespace, normalize dates to `YYYY-MM-DD`, and store coordinates and depth as numeric-compatible CSV values. Exact duplicates and scientifically possible outliers were retained and flagged rather than silently removed.

The three PDFs use the same scientific measurement: depth to water for an unconfined aquifer in metres below ground level. They were therefore combined into one master CSV. `measurement_campaign` distinguishes January, August, and pre-monsoon observations.

## Station consistency

The source tables do not contain station/well IDs or station codes, so ID-based name/coordinate conflict testing is not possible. A location-plus-coordinate combination is used only for the unique-location count; records are not merged on village name because multiple wells can legitimately occur in one village.

## Files created

- `raw_extracted/*_raw.csv`: source cell strings plus page traceability; these files were not subsequently modified.
- `cleaned/*_clean.csv`: normalized per-PDF tables.
- `groundwater_master.csv`: combined analysis-ready table.
- `data_dictionary.csv`: field definitions, types, units, and source mappings.
- `ambiguous_rows.csv`: unresolved date-like rows, if any.
- `quality_summary.json`: machine-readable extraction statistics.

## Limitations

The PDFs provide village/locality names and coordinates but no station identifier, well depth, well type, or station name. Exact duplicate observations are reported but retained because identical values may represent distinct wells or repeated valid source records. Values below 0 m bgl or above 300 m bgl are review flags only; they are not discarded. Normalization does not silently correct official place-name spelling.

Conversion runtime: {elapsed / 60:.1f} minutes.
"""
    (OUTPUT_DIR / "conversion_report.md").write_text(report, encoding="utf-8")


def public_stats(stats: Stats, elapsed: float) -> dict:
    return {
        "pdfs_processed": stats.pdfs_processed,
        "pages_processed": stats.pages_processed,
        "rows_extracted": stats.rows_extracted,
        "parsed_records": stats.parsed_records,
        "valid_records": stats.valid_records,
        "duplicate_rows_found": stats.duplicate_rows_found,
        "rows_removed": stats.rows_removed,
        "missing_coordinates": stats.missing_coordinates,
        "missing_dates": stats.missing_dates,
        "missing_groundwater_values": stats.missing_groundwater_values,
        "malformed_numeric_values": stats.malformed_numeric_values,
        "malformed_dates": stats.malformed_dates,
        "ambiguous_rows": stats.ambiguous_rows,
        "fallback_pages": stats.fallback_pages,
        "failed_pages": stats.failed_pages,
        "invalid_latitudes": stats.invalid_latitudes,
        "invalid_longitudes": stats.invalid_longitudes,
        "suspicious_negative_groundwater_values": stats.suspicious_negative_groundwater_values,
        "suspicious_high_groundwater_values": stats.suspicious_high_groundwater_values,
        "unique_station_like_locations": len(stats.station_hashes),
        "unique_states_or_uts": len(stats.states),
        "unique_state_district_pairs": len(stats.districts),
        "flag_counts": dict(stats.flags),
        "per_file": stats.per_file,
        "runtime_seconds": round(elapsed, 2),
    }


def main() -> int:
    for source, _ in SOURCES:
        if not source.exists():
            print(f"Missing source: {source}", file=sys.stderr)
            return 2
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    CLEAN_DIR.mkdir(parents=True, exist_ok=True)
    stats = Stats()
    started = time.time()

    with (OUTPUT_DIR / "groundwater_master.csv").open("w", encoding="utf-8", newline="") as master_stream, (OUTPUT_DIR / "ambiguous_rows.csv").open("w", encoding="utf-8", newline="") as ambiguous_stream:
        master_writer = csv.DictWriter(master_stream, fieldnames=CLEAN_COLUMNS, extrasaction="ignore")
        ambiguous_writer = csv.DictWriter(ambiguous_stream, fieldnames=AMBIGUOUS_COLUMNS, extrasaction="ignore")
        master_writer.writeheader()
        ambiguous_writer.writeheader()
        for path, campaign in SOURCES:
            process_pdf(path, campaign, stats, master_writer, ambiguous_writer)

    elapsed = time.time() - started
    write_dictionary()
    write_report(stats, elapsed)
    summary = public_stats(stats, elapsed)
    (OUTPUT_DIR / "quality_summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(summary, indent=2), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
