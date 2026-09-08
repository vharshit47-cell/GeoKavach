from __future__ import annotations

import collections
from pathlib import Path

import pdfplumber


FILES = [
    Path(r"C:\Users\Harshit\Desktop\Ground water data\August_WL_1994-2025.pdf"),
    Path(r"C:\Users\Harshit\Desktop\Ground water data\January_WL_1994-2025.pdf"),
    Path(r"C:\Users\Harshit\Desktop\Ground water data\Pre-monsoon_WL_1994-2025.pdf"),
]


for path in FILES:
    print(f"\n=== {path.name} ===")
    with pdfplumber.open(path) as pdf:
        for page_index in sorted({0, 1, len(pdf.pages) // 2, len(pdf.pages) - 1}):
            page = pdf.pages[page_index]
            words = page.extract_words(x_tolerance=1, y_tolerance=2, keep_blank_chars=False)
            lines: dict[float, list[dict]] = collections.defaultdict(list)
            for word in words:
                lines[round(float(word["top"]), 1)].append(word)
            print(f"-- page {page_index + 1}, size={page.width}x{page.height}, words={len(words)}")
            for y, row in list(sorted(lines.items()))[:8]:
                print(f"{y:6.1f} " + " | ".join(f"{w['x0']:.1f}:{w['text']}" for w in row))
