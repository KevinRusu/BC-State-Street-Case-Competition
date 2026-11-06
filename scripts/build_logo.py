"""Make the transparent State Street logo PNGs the dashboard shows.

The supplied source is pure white plus the brand blue (#001aff) plus anti-aliased edges between them. Red is 255 on
white and 0 on the blue, so 255 - red is how much logo each pixel holds. That becomes the alpha channel, and the
colour is set to a single value: brand blue for light mode, white for dark mode.

Run from the repo root: uv run python scripts/build_logo.py
"""
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "dashboard" / "brand" / "state-street-logo-source.png"
OUT_DIR = ROOT / "dashboard" / "public" / "brand"
BLUE = (0, 26, 255)
WHITE = (255, 255, 255)


def make_logo(source: Path, color: tuple[int, int, int]) -> Image.Image:
    """The source logo as an RGBA image in one colour, with the white background made transparent."""
    with Image.open(source) as opened:
        red = opened.convert("RGB").getchannel("R")
    alpha = ImageChops.invert(red)  # 255 - red
    logo = Image.new("RGBA", red.size, (*color, 0))
    logo.putalpha(alpha)
    return logo


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, color in (("state-street-blue.png", BLUE), ("state-street-white.png", WHITE)):
        make_logo(SOURCE, color).save(OUT_DIR / name, optimize=True)
        print(f"wrote {OUT_DIR / name}")


if __name__ == "__main__":
    main()
