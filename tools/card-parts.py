"""Extrait de « PSD Card Constructor.psd » (pack Mechanized Magic de Dumivid, CC0) les pièces de la carte et les range dans card/.

Usage : python tools/card-parts.py "<chemin du PSD>"
Dépendance : pip install psd-tools pillow
Les pièces sont enregistrées à 50 % de la taille d'origine ; card/parts.json garde leur position sur le plan d'origine (1062 x 1471),
que css/style.css reprend en pourcentages. Le centre des deux anneaux est percé pour laisser voir l'illustration.
"""
import json, os, sys
from PIL import Image, ImageDraw
from psd_tools import PSDImage

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "card")
os.makedirs(OUT, exist_ok=True)
psd = PSDImage.open(SRC)
W, H = psd.size
minion = [l for l in [l for l in psd if l.name == "Cards"][0] if l.name == "Minion"][0]


def find(group, name):
    for l in group:
        if l.name == name:
            return l
        if l.is_group():
            r = find(l, name)
            if r is not None:
                return r
    return None


WANT = {
    "back": ("decorations back", "back"), "downmark": ("decorations back", "down mark"), "stats": ("decorations back", "stats"),
    "ring_back": ("icon", "back circle"), "ring_front": ("icon", "front circle"),
    "desc": ("decorations front", "description"), "cost": ("decorations front", "cost"), "name": ("decorations front", "name"),
}
S = 0.5
meta = {"canvas": [W, H]}
imgs = {}
for key, (grp, nm) in WANT.items():
    l = find(find(minion, grp), nm)
    l.visible = True
    im = l.composite().convert("RGBA")
    b = l.bbox
    meta[key] = {"x": b[0], "y": b[1], "w": b[2] - b[0], "h": b[3] - b[1]}
    imgs[key] = im

# Fenêtre d'illustration : l'ellipse intérieure de l'anneau (boîte du calque « front circle », légèrement réduite)
fx, fy, fw, fh = meta["ring_front"]["x"], meta["ring_front"]["y"], meta["ring_front"]["w"], meta["ring_front"]["h"]
INSET = 0.955
win = {"x": fx + fw * (1 - INSET) / 2, "y": fy + fh * (1 - INSET) / 2, "w": fw * INSET, "h": fh * INSET}
meta["window"] = {k: round(v, 1) for k, v in win.items()}
for key in ("ring_back", "ring_front"):
    im, m = imgs[key], meta[key]
    mask = Image.new("L", im.size, 255)
    ImageDraw.Draw(mask).ellipse([win["x"] - m["x"], win["y"] - m["y"], win["x"] - m["x"] + win["w"], win["y"] - m["y"] + win["h"]], fill=0)
    a = im.getchannel("A")
    from PIL import ImageChops
    im.putalpha(ImageChops.multiply(a, mask))

for key, im in imgs.items():
    im = im.resize((max(1, int(im.width * S)), max(1, int(im.height * S))), Image.LANCZOS)
    im.save(os.path.join(OUT, key + ".png"), optimize=True)
    print(key, im.size, os.path.getsize(os.path.join(OUT, key + ".png")), "octets")
json.dump(meta, open(os.path.join(OUT, "parts.json"), "w"), indent=1)
print("fenêtre d'illustration :", meta["window"])
