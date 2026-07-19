"""Render the promo's branded stills — intro card, outro card, and the
per-scene caption lower-thirds — in the site's indigo palette
(getbrainstorm.online: accent #6b73f0 on #161616).

Run via uv (Pillow replaces ffmpeg drawtext — Homebrew ffmpeg lacks freetype):
  uv run --with pillow python3 tools/promo/cards.py intro <icon.png|-> <out.png>
  uv run --with pillow python3 tools/promo/cards.py outro <icon.png|-> <out.png>
  uv run --with pillow python3 tools/promo/cards.py caption <text> <out.png>
"""

import sys

from PIL import Image, ImageDraw, ImageFont

FONT = "/System/Library/Fonts/HelveticaNeue.ttc"
W, H = 1920, 1080
BG = (22, 22, 22)  # site --paper / dark --bg-deep
INK = (255, 255, 255)
MUTED = (184, 190, 204)
INDIGO = (107, 115, 240)  # site --cyan-mid / --accent-rgb
INDIGO_DEEP = (91, 98, 224)


def text_centered(draw, text, size, color, y, weight_index=0):
    font = ImageFont.truetype(FONT, size, index=weight_index)
    box = draw.textbbox((0, 0), text, font=font)
    draw.text(((W - (box[2] - box[0])) / 2, y), text, font=font, fill=color)


def paste_icon(img, icon_path, size, y):
    if icon_path == "-":
        return
    icon = Image.open(icon_path).convert("RGBA").resize((size, size), Image.LANCZOS)
    img.paste(icon, ((W - size) // 2, y), icon)


def intro(icon_path, out_path):
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    paste_icon(img, icon_path, 176, H // 2 - 330)
    text_centered(draw, "brainstorm", 116, INK, H // 2 - 110)
    text_centered(draw, "An operating system for your mind", 44, MUTED, H // 2 + 40)
    # Indigo rule under the tagline — the site's accent, quietly.
    draw.rounded_rectangle(
        [(W / 2 - 90, H / 2 + 130), (W / 2 + 90, H / 2 + 136)], radius=3, fill=INDIGO
    )
    img.save(out_path)


def outro(icon_path, out_path):
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    paste_icon(img, icon_path, 160, H // 2 - 360)
    text_centered(draw, "brainstorm", 110, INK, H // 2 - 160)
    text_centered(draw, "Local-first · End-to-end encrypted · Open beta", 42, MUTED, H // 2 + 10)
    text_centered(draw, "getbrainstorm.online", 54, INDIGO, H // 2 + 110)
    img.save(out_path)


def caption(text, out_path):
    """Compact chapter chip, bottom-left. The render fades it in ~0.4s after
    the cut and out again ~3s in, so it labels the scene without squatting
    over the content."""
    font = ImageFont.truetype(FONT, 30)
    probe = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    box = probe.textbbox((0, 0), text, font=font)
    tw, th = box[2] - box[0], box[3] - box[1]
    pad_x, pad_y = 24, 13
    pw, ph = tw + pad_x * 2, th + pad_y * 2
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    x0, y0 = 44, H - ph - 44
    draw.rounded_rectangle(
        [(x0, y0), (x0 + pw, y0 + ph)],
        radius=ph / 2,
        fill=(22, 22, 22, 216),
    )
    # Indigo tick instead of a full outline — quieter against light footage.
    draw.rounded_rectangle(
        [(x0 + 14, y0 + ph / 2 - 8), (x0 + 19, y0 + ph / 2 + 8)], radius=2, fill=INDIGO
    )
    draw.text((x0 + pad_x + 8 - box[0], y0 + pad_y - box[1]), text, font=font, fill=INK)
    img.save(out_path)


mode = sys.argv[1]
if mode == "intro":
    intro(sys.argv[2], sys.argv[3])
elif mode == "outro":
    outro(sys.argv[2], sys.argv[3])
elif mode == "caption":
    caption(sys.argv[2], sys.argv[3])
else:
    raise SystemExit(f"unknown mode: {mode}")
print(f"{mode} → {sys.argv[-1]}")
