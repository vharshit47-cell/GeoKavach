from __future__ import annotations

from pathlib import Path
from collections import Counter

import pypdfium2 as pdfium


FILES = [
    Path(r"C:\Users\Harshit\Desktop\Ground water data\August_WL_1994-2025.pdf"),
    Path(r"C:\Users\Harshit\Desktop\Ground water data\January_WL_1994-2025.pdf"),
    Path(r"C:\Users\Harshit\Desktop\Ground water data\Pre-monsoon_WL_1994-2025.pdf"),
]


for path in FILES:
    pdf = pdfium.PdfDocument(path)
    indices = sorted({round(i * (len(pdf) - 1) / 199) for i in range(200)})
    signatures: Counter[tuple] = Counter()
    failures = []
    for page_index in indices:
        page = pdf[page_index]
        textpage = page.get_textpage()
        count = textpage.count_rects()
        if count < 8:
            failures.append((page_index + 1, count))
            continue
        cells = []
        starts = []
        for i in range(8):
            box = textpage.get_rect(i)
            starts.append(round(box[0], 1))
            cells.append(textpage.get_text_bounded(*box).strip())
        signatures[(tuple(cells), tuple(starts), round(page.get_width(), 1))] += 1
    print(f"\n{path.name}: pages={len(pdf)}, sampled={len(indices)}, failures={failures[:10]}")
    for sig, count in signatures.most_common():
        print(count, sig)
