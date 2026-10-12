"""Adds the two simplified journey figures to the team deck, leaving slides 1-12 untouched.

Step by step:
1. Open the deck and find slide 13 ("End-to-end data journey"), which is still empty.
2. Put the trade journey on slide 13, at the same position and width as the picture on slide 11.
3. Make a new slide right after it, copying slide 13's logo and title, and put the security journey on it.
4. Add short speaker notes to both, then save under a new name.
"""
import copy, io, sys
from pptx import Presentation
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
prs = Presentation(src)
LEFT, TOP, WIDTH = 600213, 1888225, 10991574          # same box as the diagram on slide 11

s13 = prs.slides[12]
assert "End-to-end data journey" in s13.shapes[1].text_frame.text

def add_figure(slide, png):
    w, h = Image.open(png).size
    slide.shapes.add_picture(png, LEFT, TOP, WIDTH, int(WIDTH * h / w))

# step 2: journey 1 on slide 13
add_figure(s13, "06_journey_trade_simple.png")

# step 3: new slide with the same layout, logo and title as slide 13
new = prs.slides.add_slide(s13.slide_layout)
for ph in list(new.placeholders):                      # remove empty placeholders the layout adds
    ph._element.getparent().remove(ph._element)
for shp in s13.shapes:
    if shp.shape_type == 13 and shp.width < 4000000:   # the State Street logo
        new.shapes.add_picture(io.BytesIO(shp.image.blob), shp.left, shp.top, shp.width, shp.height)
    elif shp.has_text_frame:                           # the title text box
        new.shapes._spTree.append(copy.deepcopy(shp._element))
add_figure(new, "07_journey_security_simple.png")

# move the new slide (now last) to sit right after slide 13
ids = prs.slides._sldIdLst
el = ids[-1]; ids.remove(el); ids.insert(13, el)

# step 4: speaker notes
s13.notes_slide.notes_text_frame.text = (
    "One clean trade, followed through the tables. Every step is linked by matching IDs we saw in the data. "
    "It passes every check, and the custodian agrees with our 2,028 shares. "
    "The dashed arrow and the red box show where the evidence stops: no settlement proof and no cash data.")
new.notes_slide.notes_text_frame.text = (
    "One security record, set up correctly, feeds 94 funds. Its spin-off created a new security that was never set up, "
    "yet it was traded and held, and it has no price. Across the file this happened 15 times. "
    "A security check at the handoff would have held all 1,131 trades.")
prs.save(out)
print("slides:", len(prs.slides))
