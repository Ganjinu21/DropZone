"""Turn the strips rendered by export-clips.cjs into individually looping GIFs."""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2]
source = root / "work/skill-lab-bake"
target = root / "design/skill-lab/clips"
target.mkdir(parents=True, exist_ok=True)
for job in json.loads((source / "clips.json").read_text()):
    name = job["id"] + "-" + job["mode"]
    strip = Image.open(source / (name + ".png")).convert("RGB")
    count = (job["duration"] + 39) // 40
    frames = []
    for i in range(count):
        x, y = (i % 8) * 400, (i // 8) * 160
        frames.append(strip.crop((x, y, x+400, y+160)))
    swatches = Image.new("RGB", (400, 160*12))
    for i in range(12):
        swatches.paste(frames[i*(count-1)//11], (0, i*160))
    palette = swatches.quantize(colors=255)
    frames = [f.quantize(palette=palette, dither=Image.Dither.NONE) for f in frames]
    out = target / (name + ".gif")
    frames[0].save(out, save_all=True, append_images=frames[1:], duration=40, loop=0, optimize=True, disposal=1)
    with Image.open(out) as gif:
        assert gif.n_frames >= 16 and gif.info["loop"] == 0
        ms = 0
        for i in range(gif.n_frames):
            gif.seek(i)
            ms += gif.info["duration"]
        assert ms == count*40, name
    print(name, count, ms)
