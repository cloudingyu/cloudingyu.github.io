"""Generate small WOFF2 font snapshots for the semester notes.

Usage: python scripts/subset-notebook-fonts.py --font-dir "path/to/installed/fonts"
Requires: pip install "fonttools[woff]"
The original font files and notes are read only.
"""
import argparse
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--font-dir", type=Path, required=True)
args = parser.parse_args()
output = ROOT / "public/fonts/notebook"
output.mkdir(parents=True, exist_ok=True)
text = "".join(note.read_text(encoding="utf-8") for note in (ROOT / "notebook/2026-autumn").rglob("*.md"))
# Include Latin, Greek, punctuation and symbols for ordinary new text as well.
codepoints = set(map(ord, text)) | set(range(0x20, 0x250)) | set(range(0x370, 0x400)) | set(range(0x2000, 0x2070))
fonts = [
    ("LXGWWenKaiMono-Regular.ttf", "wenkai.woff2", "CY Notebook WenKai", "Regular"),
    ("MapleMono-Regular.ttf", "mono-regular.woff2", "CY Notebook Mono", "Regular"),
    ("MapleMono-Bold.ttf", "mono-bold.woff2", "CY Notebook Mono", "Bold"),
]
for source, filename, family, style in fonts:
    font = TTFont(args.font_dir / source)
    options = subset.Options()
    options.flavor = "woff2"
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17]
    options.name_legacy = True
    options.name_languages = [0x409]
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)
    # Distinct family names identify these modified subsets; preserve license/credits.
    for record in font["name"].names:
        value = {
            1: family, 2: style, 3: f"{family} {style} subset", 4: f"{family} {style}",
            6: f"{family.replace(' ', '')}-{style}", 16: family, 17: style,
        }.get(record.nameID)
        if value is not None:
            record.string = value.encode(record.getEncoding())
    font.flavor = "woff2"
    font.save(output / filename)
    print(f"{filename}: {(output / filename).stat().st_size / 1024:.0f} KB")
