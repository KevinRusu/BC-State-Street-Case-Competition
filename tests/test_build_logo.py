"""The State Street logo PNGs are made from the supplied white-and-blue source.

Run from the repo root: uv run python -m unittest tests/test_build_logo.py -v
"""
from collections import Counter
from pathlib import Path
import sys
import unittest

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_logo

SOURCE = ROOT / "dashboard" / "brand" / "state-street-logo-source.png"
BLUE = (0, 26, 255)
WHITE = (255, 255, 255)


def most_common_opaque(image):
    raw = image.tobytes()
    counts = Counter(raw[i : i + 4] for i in range(0, len(raw), 4) if raw[i + 3] == 255)
    return tuple(counts.most_common(1)[0][0])


class MakeLogoTest(unittest.TestCase):
    def test_keeps_the_source_size(self):
        with Image.open(SOURCE) as source:
            size = source.size
        self.assertEqual(build_logo.make_logo(SOURCE, BLUE).size, size)

    def test_the_white_background_becomes_transparent(self):
        self.assertEqual(build_logo.make_logo(SOURCE, BLUE).getpixel((0, 0))[3], 0)

    def test_blue_variant_is_brand_blue(self):
        self.assertEqual(most_common_opaque(build_logo.make_logo(SOURCE, BLUE)), (*BLUE, 255))

    def test_white_variant_is_white(self):
        self.assertEqual(most_common_opaque(build_logo.make_logo(SOURCE, WHITE)), (*WHITE, 255))


if __name__ == "__main__":
    unittest.main()
