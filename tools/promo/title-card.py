"""Render the S8 title card PNG (1920x1080) for the promo.

Run via: uv run --with pillow python3 tools/promo/title-card.py <icon.png|-> <out.png>
(Pillow replaces ffmpeg drawtext — the Homebrew ffmpeg build lacks freetype.)
"""

import sys

from PIL import Image, ImageDraw, ImageFont

FONT = "/System/Library/Fonts/HelveticaNeue.ttc"
W, H = 1920, 1080
BG = (13, 17, 23)

icon_path, out_path = sys.argv[1], sys.argv[2]

img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img)

if icon_path != "-":
    icon = Image.open(icon_path).convert("RGBA").resize((176, 176), Image.LANCZOS)
    img.paste(icon, ((W - 176) // 2, H // 2 - 380), icon)

lines = [
    ("brainstorm", 116, (255, 255, 255), -150),
    ("Local-first · End-to-end encrypted · Open beta", 42, (184, 192, 204), 20),
    ("github.com/brainstorm-os/shell", 46, (127, 180, 255), 120),
]
for text, size, color, dy in lines:
    font = ImageFont.truetype(FONT, size)
    box = draw.textbbox((0, 0), text, font=font)
    draw.text(((W - (box[2] - box[0])) / 2, H / 2 + dy), text, font=font, fill=color)

img.save(out_path)
print(f"title card → {out_path}")
