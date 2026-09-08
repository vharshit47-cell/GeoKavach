from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw
import pypdfium2 as pdfium


OUT = Path(r"D:\JalDrishti\tmp\pdfs\layout_samples.png")
SAMPLES = [
    (Path(r"C:\Users\Harshit\Desktop\Ground water data\August_WL_1994-2025.pdf"), 0),
    (Path(r"C:\Users\Harshit\Desktop\Ground water data\August_WL_1994-2025.pdf"), 4675),
    (Path(r"C:\Users\Harshit\Desktop\Ground water data\January_WL_1994-2025.pdf"), 0),
    (Path(r"C:\Users\Harshit\Desktop\Ground water data\January_WL_1994-2025.pdf"), 5287),
    (Path(r"C:\Users\Harshit\Desktop\Ground water data\Pre-monsoon_WL_1994-2025.pdf"), 0),
    (Path(r"C:\Users\Harshit\Desktop\Ground water data\Pre-monsoon_WL_1994-2025.pdf"), 5135),
]

cards = []
for path, page_index in SAMPLES:
    pdf = pdfium.PdfDocument(path)
    image = pdf[page_index].render(scale=1.25).to_pil().convert("RGB")
    image.thumbnail((1050, 760))
    card = Image.new("RGB", (1080, 810), "white")
    card.paste(image, ((1080 - image.width) // 2, 38))
    ImageDraw.Draw(card).text((15, 12), f"{path.name} - page {page_index + 1}", fill="black")
    cards.append(card)

sheet = Image.new("RGB", (2160, 2430), "#d9d9d9")
for index, card in enumerate(cards):
    sheet.paste(card, ((index % 2) * 1080, (index // 2) * 810))
sheet.save(OUT, optimize=True)
print(OUT)
