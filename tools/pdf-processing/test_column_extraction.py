from __future__ import annotations

import re
from pathlib import Path

import pypdfium2 as pdfium


path = Path(r"C:\Users\Harshit\Desktop\Ground water data\August_WL_1994-2025.pdf")
pdf = pdfium.PdfDocument(path)
for page_index in (0, 750, 4675, 9350):
    page = pdf[page_index]
    tp = page.get_textpage()
    text = tp.get_text_range()
    head = text[:400]
    patterns = [r"(?:STATE_UT|State)", r"DISTRICT|District", r"BLOCK|Block", r"VILLAGE(?:_NA)?|Village", r"LATITUTE|LATITUDE|Latitute|Latitude", r"LONGITUDE|Longitude", r"Date", r"WL"]
    indices = []
    cursor = 0
    for pattern in patterns:
        match = re.search(pattern, head[cursor:])
        if not match:
            raise RuntimeError((page_index + 1, pattern, repr(head)))
        index = cursor + match.start()
        indices.append(index)
        cursor = index + max(1, len(match.group(0)))
    boxes = [tp.get_charbox(i) for i in indices]
    header_starts = [box[0] for box in boxes]
    first_data = re.search(r"(?m)^.*?(?P<lat>-?\d{1,3}(?:\.\d+)?)\s+(?P<lon>-?\d{1,3}(?:\.\d+)?)\s+(?P<date>\d{2}-\d{2}-\d{2,4})\s+(?P<wl>-?\d+(?:\.\d+)?)\s*$", text)
    if not first_data:
        raise RuntimeError((page_index + 1, "no data row"))
    numeric_starts = [tp.get_charbox(first_data.start(name))[0] for name in ("lat", "lon", "date", "wl")]
    starts = header_starts[:4] + numeric_starts[:3] + [header_starts[7]]
    header_bottom = min(box[1] for box in boxes)
    bounds = [(0.0 if i == 0 else starts[i] - 1.0, (starts[i + 1] - 1.0 if i < 7 else page.get_width())) for i in range(8)]
    columns = [[line.strip() for line in tp.get_text_bounded(left, 0, right, header_bottom - 3.0).splitlines() if line.strip()] for left, right in bounds]
    print(f"\nPAGE {page_index + 1} starts={[round(x, 1) for x in starts]} counts={[len(c) for c in columns]}")
    for row in zip(*columns):
        print(row)
        if row[6].startswith("30-08-25") or page_index != 0:
            break
