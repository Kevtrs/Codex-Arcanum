"""Assemble les feuilles d'animation de Cethiel (OpenGameArt, CC0) dans fx/ et complète le registre.

Usage : python tools/fx-build.py <dossier-des-téléchargements>
Le dossier doit contenir, chacun décompressé dans son sous-dossier : slashpack (Weapon Slash), cethiel/{light,blood,nature,
projectile,wings,cosmic,shield,...}. Voir ANIMATIONS.md pour les liens. Chaque animation d'images séparées devient une
feuille PNG (8 colonnes, fond transparent) et une entrée de fx/effects.json lue par le jeu (js/vfx.js).
"""
import json, os, re, sys
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else "."
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "fx")
CREDIT = "Effects by Cethiel (opengameart.org/users/cethiel) - CC0"


def frames(path, limit=600):
    """Images d'un dossier, triées par numéro, sans les aperçus géants."""
    names = sorted((f for f in os.listdir(path) if f.lower().endswith(".png")),
                   key=lambda s: [int(x) if x.isdigit() else x for x in re.split(r"(\d+)", s)])
    return [os.path.join(path, f) for f in names if max(Image.open(os.path.join(path, f)).size) < limit]


def chunk(path, i, n=5):
    return frames(path)[i * n:(i + 1) * n]


def build(name, files, fps, loop=False, anchor=(0.5, 0.5), mirror=False, **extra):
    ims = [Image.open(f).convert("RGBA") for f in files]
    if mirror:
        ims = [im.transpose(Image.FLIP_LEFT_RIGHT) for im in ims]
    w, h = max(i.width for i in ims), max(i.height for i in ims)
    cols = min(len(ims), 8)
    rows = -(-len(ims) // cols)
    sheet = Image.new("RGBA", (w * cols, h * rows), (0, 0, 0, 0))
    for k, im in enumerate(ims):
        sheet.paste(im, ((k % cols) * w + (w - im.width) // 2, (k // cols) * h + (h - im.height) // 2), im)
    sheet.save(os.path.join(OUT, name + ".png"), optimize=True)
    entry = dict(frames=len(ims), fps=fps, loop=loop, cols=cols, rows=rows, w=w, h=h, ax=anchor[0], ay=anchor[1], credit=CREDIT)
    entry.update(extra)
    return entry


def alias(of, **extra):
    return dict(file=of, **extra)


reg_path = os.path.join(OUT, "effects.json")
reg = json.load(open(reg_path, encoding="utf-8")) if os.path.exists(reg_path) else {}
J = lambda *p: os.path.join(SRC, *p)

# Filtres de teinte : les effets blancs (lumière, projectiles) prennent la couleur de la faction au moment du jeu (tint = true)
GOLD = "sepia(1) saturate(3.2) hue-rotate(-8deg) brightness(1.25)"
GREEN = "sepia(1) saturate(3) hue-rotate(62deg) brightness(1.1)"
DARK = "hue-rotate(255deg) saturate(.7) brightness(.85)"      # rouge sang → violet sombre

spec = {}
# — Coups de mêlée (entailles) : 4 couleurs d'origine, vert et sombre par teinte
for var, d in (("gold", "Classic"), ("purple", "Alternative 1"), ("blue", "Alternative 2"), ("fire", "Alternative 3")):
    spec["slash_" + var] = lambda d=d: build("slash_" + d.replace(" ", ""), frames(J("slashpack", d, "1")), 18, anchor=(0.5, 0.5))
# — Éléments de sorts (projectile + impact)
spec["holy_bolt"] = lambda: build("holy_bolt", chunk(J("cethiel", "light"), 4), 16, True, (0.82, 0.5), filter=GOLD)
spec["holy_impact"] = lambda: build("holy_impact", chunk(J("cethiel", "light"), 1), 14, filter=GOLD)
spec["shadow_bolt"] = lambda: build("shadow_bolt", chunk(J("cethiel", "blood"), 4), 16, True, (0.82, 0.5), filter=DARK)
spec["shadow_impact"] = lambda: build("shadow_impact", chunk(J("cethiel", "blood"), 3), 14, filter=DARK)
spec["nature_bolt"] = lambda: build("nature_bolt", chunk(J("cethiel", "projectile", "Files"), 3), 16, True, (0.82, 0.5), filter=GREEN)
spec["nature_impact"] = lambda: build("nature_impact", chunk(J("cethiel", "nature"), 3), 12)
# — Soins et renforts : ailes de lumière en couleurs, vignes pour Sylve
for col, idx in (("white", 0), ("gold", 1), ("green", 2), ("blue", 4), ("red", 5), ("purple", 7)):
    spec["heal_" + col] = lambda col=col, idx=idx: build("heal_" + col, frames(J("cethiel", "wings", str(idx))), 12, anchor=(0.5, 0.55))
spec["heal_nature"] = lambda: build("heal_nature", chunk(J("cethiel", "nature"), 1), 10)
# — États et événements
spec["stun_rune"] = lambda: build("stun_rune", frames(J("cethiel", "cosmic", "2")), 9)
spec["summon_vortex"] = lambda: build("summon_vortex", frames(J("cethiel", "cosmic", "5")), 10)
spec["death_burst"] = lambda: build("death_burst", chunk(J("cethiel", "projectile", "Files"), 4), 14, tint=True)
spec["hit_spark"] = lambda: build("hit_spark", chunk(J("cethiel", "light"), 2), 16, tint=True)
spec["crit_star"] = lambda: build("crit_star", chunk(J("cethiel", "light"), 1), 14, tint=True)
spec["shield_pop"] = lambda: build("shield_pop", [frames(J("cethiel", "shield"))[8]], 1, anim="pop", ms=950)

for name, fn in spec.items():
    reg[name] = fn()
    print(f"  {name}: {reg[name]['frames']} images {reg[name]['w']}x{reg[name]['h']}")
# Variantes obtenues par teinte (même feuille, autre filtre)
reg["slash_green"] = alias("slash_Alternative2", filter="hue-rotate(-78deg) saturate(1.25)") | {k: reg["slash_blue"][k] for k in ("frames", "fps", "loop", "cols", "rows", "w", "h", "ax", "ay", "credit")}
reg["slash_dark"] = alias("slash_Alternative1", filter="saturate(.45) brightness(.7)") | {k: reg["slash_purple"][k] for k in ("frames", "fps", "loop", "cols", "rows", "w", "h", "ax", "ay", "credit")}
# Les feuilles de slash sont enregistrées sous le nom du dossier d'origine ; on aligne les noms du registre sur les fichiers
for var, d in (("gold", "Classic"), ("purple", "Alternative1"), ("blue", "Alternative2"), ("fire", "Alternative3")):
    reg["slash_" + var]["file"] = "slash_" + d

json.dump(reg, open(reg_path, "w", encoding="utf-8"), indent=1)
with open(os.path.join(OUT, "effects.js"), "w", encoding="utf-8") as f:
    f.write("/* Registre des animations (généré par tools/fx-import.js et tools/fx-build.py : ne pas modifier à la main). */\n")
    f.write("window.CA = window.CA || {}; window.CA.FX = " + json.dumps(reg, ensure_ascii=False) + ";\n")
print("Registre :", len(reg), "animations")
