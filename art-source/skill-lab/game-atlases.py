"""Export the approved attack frames with independently aimable hands for gameplay."""
import importlib.util
from pathlib import Path
from shutil import copyfile

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DESIGN = ROOT / "design/skill-lab"
GAME = ROOT / "game/art/skills"
GAME.mkdir(parents=True, exist_ok=True)


def load_artist(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + ".py"))
    artist = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(artist)
    return artist


def layered_strip(artist, factory_name, frame_fn, frames, cell, filename):
    original = getattr(artist, factory_name)
    layers = Image.new("RGBA", (frames * cell[0], 2 * cell[1]))
    for col in range(frames):
        def capture_body(*args, **kwargs):
            body = original(*args, **kwargs)
            layers.paste(body, (col * cell[0], 0))
            return Image.new("RGBA", cell)

        setattr(artist, factory_name, capture_body)
        hands, _ = frame_fn(col)
        layers.paste(hands, (col * cell[0], cell[1]))
    setattr(artist, factory_name, original)
    layers.save(GAME / filename, optimize=True)


lynx = load_artist("lynx")
layered_strip(lynx.crew, "operator", lynx.pose, 7, (96, 64), "lynx-aim.png")
raven = load_artist("raven")
layered_strip(raven, "shifted_body", lambda col: raven.side(col, True), 8,
              (112, 72), "raven-aim.png")
with Image.open(DESIGN / "raven/raven-smg.png") as strip:
    strip.crop((0, 144, strip.width, strip.height)).save(GAME / "raven-spin.png")

for source, dest in [
    ("bulk/ballistics.png", "bulk-ballistics.png"), ("bulk/deploy.png", "squad-board.png"),
    ("raven/spin-echo.png", "raven-echo.png"), ("raven/ballistics.png", "raven-ballistics.png"),
    ("lynx/pierce-fx.png", "lynx-pierce.png"), ("lynx/laser.png", "lynx-beam.png"),
    ("mortar/operator.png", "hammer-motion.png"), ("mortar/effects.png", "hammer-fx.png"),
    ("mortar/blast-layers.png", "hammer-blast.png"),
]:
    copyfile(DESIGN / source, GAME / dest)

with Image.open(DESIGN / "mortar/blast-layers.png") as sheet:
    # Compose the same ground, blast and debris frame shown on impact in combat.
    icon = Image.new("RGBA", (124, 108))
    for row in (3, 4, 5):
        icon.alpha_composite(sheet.crop((4 * 124, row * 108, 5 * 124, (row + 1) * 108)))
    icon.crop(icon.getbbox()).save(ROOT / "game/augment-7.png", optimize=True)

# Normalize with the scale of each reference's feet; both pairs of soles rest
# on the same baseline. The second pose deliberately occupies half the height.
mech = Image.new("RGBA", (224, 144))
for i, (pose, height) in enumerate([("standing", 132), ("crouched", 67)]):
    with Image.open(ROOT / f"design/equipment-concepts/bulk-mech-{pose}.png") as image:
        alpha = image.getchannel("A")
        bounds = alpha.point(lambda v: 255 if v >= 50 else 0).getbbox()
        cropped = image.crop(bounds)
        tile = cropped.resize((round(height*cropped.width/cropped.height), height),
                              Image.Resampling.LANCZOS)
        mech.alpha_composite(tile, (112*i+(112-tile.width)//2, 140-height))
mech.save(GAME / "bulk-fold.png", optimize=True)
