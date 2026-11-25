"""Pack the painted laser cels at the renderer's nose and ground contact pivots."""
from pathlib import Path
from PIL import Image

source = Path(__file__).resolve().parent
out = source.parents[1] / 'game' / 'art' / 'skills'
resample = Image.Resampling.LANCZOS

flight = Image.open(source / 'raven-flight-laser.png').convert('RGBA')
strip = Image.new('RGBA', (224, 224))
for row, tip_y in enumerate((176, 489, 781, 1078)):
    tile = flight.crop((28, tip_y-150, 1228, tip_y+150))
    strip.paste(tile.resize((224, 56), resample), (0, 56*row))
strip.save(out / 'raven-flight.png', optimize=True)

contact = Image.open(source / 'raven-contact-laser.png').convert('RGBA')
strip = Image.new('RGBA', (576, 72))
edges = (0, 311, 693, 1067, 1450, 1820, contact.width)
for col, anchor in enumerate((140, 465, 818, 1195, 1541, 1913)):
    tile = contact.crop((edges[col], 0, edges[col+1], contact.height))
    x = anchor - edges[col]
    # Uniform scale keeps the billow growing and dispersing around one fixed point.
    box = (x-165, 480-319, x+363, 480+77)
    strip.paste(tile.crop(box).resize((96, 72), resample), (col*96, 0))
strip.save(out / 'raven-contact.png', optimize=True)

# Align the trailing edge and centerline so each family can travel along a shot.
drift = Image.open(source / 'raven-drift.png').convert('RGBA')
smoke = Image.new('RGBA', (112*4, 48*3))
for row, center_y in enumerate((156, 600, 797)):
    for col, left in enumerate((19, 428, 880, 1328)):
        tile = drift.crop((left, center_y-91, left+428, center_y+92))
        smoke.paste(tile.resize((112,48), resample), (col*112, row*48))
smoke.save(out / 'raven-drift.png', optimize=True)
