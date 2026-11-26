"""Register whole drawings from the field model sheets, then use crew-frames/pack.py.

The supplied PNGs are the canonical A, S and S+ artwork. Generated motion
sheets are named ROLE-RANK-{move,aim}.png, with raised-RANK used for Hammer.
Pass the motion sheet directory as the first argument. Individual registered
drawings are committed so building the game does not require generation.
"""
import sys
import tempfile
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

REFERENCE = Path(__file__).resolve().parent
FRAMES = REFERENCE.parent / 'crew-frames'
sys.path.insert(0, str(FRAMES))
import pack

MOVES = ('guard', 'travel', 'toward', 'away', 'skill')
AIMS = ('zenith', 'up', 'level', 'down', 'nadir')


def source_cells(path, columns):
    sheet = Image.open(path).convert('RGBA')
    cells = []
    for row in range(4):
        for col in range(columns):
            cell = sheet.crop((round(col * sheet.width / columns), round(row * sheet.height / 4),
                               round((col + 1) * sheet.width / columns), round((row + 1) * sheet.height / 4)))
            cells.append(cell.crop(cell.getchannel('A').point(lambda a: 255 if a > 65 else 0).getbbox()))
    return cells


def grid(path, rows, cols):
    pixels=np.array(Image.open(path).convert('RGBA'))
    alpha=pixels[:,:,3]
    paper,ink=np.percentile(alpha,[35,95])
    if paper<=8 or ink-paper<=8:
        return split_grid(path,rows,cols)
    # The generator can export a spatially varying, partially opaque paper
    # matte. Isolate the opaque ink before labeling, including near cell edges.
    threshold=paper+.75*(ink-paper)
    width=max(2,(ink-paper)*.13)
    alpha[:]=np.uint8(np.clip((alpha.astype(float)-threshold)/width+.5,0,1)*255)
    edge=np.median(np.concatenate((pixels[0,:,:3],pixels[-1,:,:3])),axis=0)
    if edge.min()>225:
        rgb=pixels[:,:,:3].astype('int16')
        white=(rgb.min(axis=2)>220)&(np.ptp(rgb,axis=2)<24)
        _,labels=cv2.connectedComponents(white.astype('uint8'))
        border=np.unique(np.r_[labels[0],labels[-1],labels[:,0],labels[:,-1]])
        alpha[np.isin(labels,border[border!=0])]=0
    with tempfile.TemporaryDirectory() as temp:
        cleaned=Path(temp)/'sprites.png'
        Image.fromarray(pixels).save(cleaned,compress_level=1)
        return split_grid(cleaned,rows,cols)


def split_grid(path, rows, cols):
    try:
        return pack.cutouts(path, rows, cols)
    except ValueError:
        # Some inked equipment just touches its neighbour. Split at the thinnest
        # inter-cell gutters and keep the main connected illustration in each.
        pixels = np.array(Image.open(path).convert('RGBA'))
        alpha = pixels[:, :, 3]
        def cuts(profile, n):
            span = len(profile) / n
            edges = [0]
            for j in range(1, n):
                mid = round(j * span)
                left, right = max(0, mid - round(.22 * span)), min(len(profile), mid + round(.22 * span))
                weights = profile[left:right] + .025 * np.abs(np.arange(left, right) - mid)
                edges.append(left + int(np.argmin(weights)))
            return edges + [len(profile)]
        ys = cuts((alpha > 140).sum(axis=1), rows)
        result = []
        for y, bottom in zip(ys, ys[1:]):
            xs = cuts((alpha[y:bottom] > 140).sum(axis=0), cols)
            for x, right in zip(xs, xs[1:]):
                part = pixels[y:bottom, x:right].copy()
                mask = (part[:, :, 3] > 85).astype('uint8')
                _, labels, stats, _ = cv2.connectedComponentsWithStats(mask)
                if len(stats) < 2:
                    raise ValueError(f'Missing sprite in {path.name} at {x},{y}')
                i = int(np.argmax(stats[1:, 4])) + 1
                if stats[i, 4] < .055 * mask.size:
                    raise ValueError(f'Empty cell in {path.name} at {x},{y}')
                part[:, :, 3] *= cv2.dilate((labels == i).astype('uint8'), np.ones((5, 5),'uint8'))
                im = Image.fromarray(part)
                result.append(im.crop(im.getbbox()))
        return result


def crown_and_hip(im, role, action):
    """Measure feet, the legs' midline, and the crown away from the barrel."""
    alpha = np.asarray(im)[:, :, 3] > 105
    h, w = alpha.shape
    # The belt/upper thigh gives a repeatable body pivot even for a long launcher.
    centers = []
    for y in range(round(h * .65), round(h * .75)):
        xx = np.flatnonzero(alpha[y])
        if len(xx):
            centers.append(np.median(xx))
    hip = float(np.median(centers)) if centers else w / 2
    lo = max(0, round(hip - h * .13)); hi = min(w, round(hip + h * .13) + 1)
    top = np.flatnonzero(alpha[:, lo:hi].sum(axis=1) > max(3, round(h * .055)))
    return hip, int(top[0]) if len(top) else 0


def register(images, role, action):
    measures = [crown_and_hip(im, role, action) for im in images]
    heights = [im.height - top for im, (_, top) in zip(images, measures)]
    reference_height = np.percentile(heights, 80) if action == 'skill' else np.median(heights)
    output = []
    for im, (hip, top), stature in zip(images, measures, heights):
        # Register each painted camera view on common head/sole landmarks.
        # Kneeling or planting equipment intentionally changes the character's height.
        body_height = reference_height if action == 'skill' else stature
        scale = min(pack.HEIGHT / body_height, (pack.SOLE - 3) / im.height,
                    (pack.TILE - 5) / im.width)
        width, height = round(im.width * scale), round(im.height * scale)
        x = max(2, min(pack.TILE - width - 2, round(pack.PIVOT - hip * scale)))
        tile = Image.new('RGBA', (pack.TILE, pack.TILE))
        tile.paste(im.resize((width, height), pack.LANCZOS), (x, pack.SOLE - height))
        output.append(tile)
    return output


def save_cells(folder, name, cells):
    for idx, im in enumerate(cells, 1):
        im.save(folder / f'{name}-{idx}.webp', quality=97, method=4)


def import_uniform(raw, role, rank):
    source = ('raised' if role == 'hammer' else role) + '-' + rank
    folder = FRAMES / role / rank
    move = grid(raw / (source + '-move.png'), 5, 6)
    aim = grid(raw / (source + '-aim.png'), 5, 6)
    sequences = {}
    for names, sheet in ((MOVES, move), (AIMS, aim)):
        for row, name in enumerate(names):
            cells = register(sheet[row*6:row*6+6], role, name)
            save_cells(folder, name, cells)
            sequences[name] = cells
    for name in ('zenith','up','down','nadir'):
        bearing = raw / f'bearing-{role}-{name}.png'
        if bearing.exists():
            poses = grid(bearing,5,6)
            start = pack.RANKS.index(rank)*6
            sequences[name] = register(poses[start:start+6],role,name)
            save_cells(folder,name,sequences[name])
    if role != 'hammer' and rank in ('A','S','S-plus'):
        white = rank == 'S-plus'
        cols = 2 if white else 4
        ref = source_cells(REFERENCE / (role + ('-S-plus.png' if white else '-AS.png')), cols)
        col = 2 if rank == 'A' else 0
        walking = [ref[i*cols+col] for i in range(4)]
        sights = [ref[i*cols+col+1] for i in range(4)]
        keys = register(walking, role, 'travel')
        keys += [register([im], role, action)[0] for im, action in zip(sights, ('up','level','down','down'))]
    else:
        keys = [sequences['travel'][i] for i in (0,2,3,5)] + [sequences[n][0] for n in ('up','level','down','nadir')]
    save_cells(folder, 'key', keys)
    standing = keys[1] if role != 'hammer' else sequences['guard'][0]
    # Field HUD portraits are derived from the combat costume, independent of barracks.
    alpha = np.asarray(standing)[:, :, 3] > 125
    top = np.where(alpha)[0].min()
    crown_band = np.where(alpha[top+5:top+19])[1]
    head = int(np.median(crown_band)) if len(crown_band) else pack.PIVOT
    standing.crop((head-34,top-5,head+34,top+63)).resize((144,144),pack.LANCZOS).save(
        pack.DEST/role/(rank+'-battle-face.webp'),quality=96,method=4)
    print('Imported', role, rank, flush=True)


def import_raven_special(raw, rank):
    """Match the existing choreographed firing marks and the height of each leap."""
    original = pack.ART / 'raven-cels'
    main = Image.open(original/'base.png').convert('RGBA')
    follow = Image.open(original/'spin-follow.webp').convert('RGBA')
    bodies = grid(raw/('turn-'+rank+'.png'),4,8) + grid(raw/('recover-'+rank+'.png'),9,8)
    for i,body in enumerate(bodies):
        image,cel = (main,40+i) if i<32 else (follow,i-32)
        x,y = cel%8*288,cel//8*288
        frame = image.crop((x,y,x+288,y+288)).resize((224,224),pack.LANCZOS)
        left,top,right,base = frame.getchannel('A').point(lambda a:255 if a>95 else 0).getbbox()
        scale = min((base-top)/body.height, (224-4)/body.width)
        w,h = round(body.width*scale),round(body.height*scale)
        draw = Image.new('RGBA',(224,224))
        draw.paste(body.resize((w,h),pack.LANCZOS),(max(1,min(223-w,round((left+right-w)/2))),base-h))
        draw.save(FRAMES/'raven'/rank/f'special-{i+1:03}.webp',quality=97,method=4)
    print('Imported Raven skill',rank,flush=True)


if __name__ == '__main__':
    raw = Path(sys.argv[1])
    roles = sys.argv[2:3] or pack.ROLES
    ranks = sys.argv[3:4] or pack.RANKS
    for role in roles:
        for rank in ranks:
            import_uniform(raw,role,rank)
            if role=='raven':
                import_raven_special(raw,rank)
