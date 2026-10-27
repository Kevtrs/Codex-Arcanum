"""Importe des illustrations de cartes : python tools/art-import.py <dossier-des-images>

Les fichiers peuvent s'appeler par l'identifiant de la carte (A02.png, a02_v2.jpg) ou par son nom (Lancier Royal.png, lancier-royal.jpg).
Chaque image est recadrée au format de l'arche de la carte (1,6 : 1), réduite à 1280 x 800 au maximum, enregistrée en WebP dans art/,
puis art/manifest.js est mis à jour (le jeu n'affiche que les images listées dans ce fichier).
"""
import json, os, re, subprocess, sys, unicodedata
from PIL import Image

SRC = sys.argv[1]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
ART = os.path.join(ROOT, "art")
cards = json.load(open(os.path.join(ART, "prompts.json"), encoding="utf-8"))


def norm(s):
    s = unicodedata.normalize("NFD", s)
    return re.sub(r"[^a-z0-9]+", "", "".join(c for c in s if unicodedata.category(c) != "Mn").lower())


by_id = {c["id"].lower(): c["id"] for c in cards}
by_name = {norm(c["name"]): c["id"] for c in cards}
RATIO, W, H = 1.6, 1280, 800
done, unknown = [], []
for f in sorted(os.listdir(SRC)):
    stem, ext = os.path.splitext(f)
    if ext.lower() not in (".png", ".jpg", ".jpeg", ".webp"):
        continue
    m = re.match(r"^([a-z]\d{2})(?![0-9])", stem.lower())
    cid = by_id.get(m.group(1)) if m else None
    cid = cid or by_name.get(norm(stem))
    if not cid:
        unknown.append(f)
        continue
    im = Image.open(os.path.join(SRC, f)).convert("RGB")
    w, h = im.size
    if w / h > RATIO:                                   # trop large : on rogne les côtés
        nw = int(h * RATIO); im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:                                               # trop haut : on rogne en haut et en bas (un peu plus en haut)
        nh = int(w / RATIO); top = int((h - nh) * 0.4); im = im.crop((0, top, w, top + nh))
    if im.width > W:
        im = im.resize((W, H), Image.LANCZOS)
    im.save(os.path.join(ART, cid + ".webp"), "WEBP", quality=86, method=6)
    done.append(cid)
print(f"{len(done)} illustration(s) importée(s) :", " ".join(done) or "aucune")
if unknown:
    print("Noms non reconnus (renommez par identifiant ou nom exact de la carte) :", ", ".join(unknown))
try:
    subprocess.run(["node", os.path.join(ROOT, "tools", "art-manifest.js")], check=True)
except Exception as e:  # node absent : le message dit quoi faire
    print("Lancez ensuite : node tools/art-manifest.js  (", e, ")")
