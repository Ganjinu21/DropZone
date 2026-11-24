"""Retarget each operator's original uniform to eight contact, down, passing and up poses.

Run this file directly after updating bodies.png. The same source rig and poses
are shared by the fitted trouser and boot artwork.
"""
from math import atan2, cos, hypot, radians, sin, sqrt
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
CELL = (192, 128)

# Each leg lists hip, knee center and boot collar. The first leg is nearest the
# camera and appears on the left of the original wide stance. The waist line
# retains the silhouette of individual belts, backpack hems and Lynx's cloak.
RIGS = [
    dict(legs=(((55,75),(51,94),(40,108)),((66,76),(85,88),(82,103))),
         waist=((0,85),(38,85),(41,75),(63,76),(73,75),(110,74)), split=((70,61),(85,65),(98,66)), reach=17),
    dict(legs=(((54,76),(49,97),(39,109)),((65,77),(78,95),(81,108))),
         waist=((0,94),(35,93),(38,81),(43,77),(64,79),(84,77)), split=((74,61),(89,63),(102,64)), reach=20),
    dict(legs=(((52,76),(49,95),(38,108)),((64,76),(79,89),(76,103))),
         waist=((0,95),(29,96),(38,92),(41,82),(45,77),(68,79),(85,76)), split=((73,60),(87,63),(103,62)), reach=17),
    dict(legs=(((49,77),(45,92),(36,108)),((66,79),(84,92),(86,108))),
         waist=((0,83),(36,83),(46,80),(59,82),(70,82),(81,79),(106,77)), split=((74,62),(92,64),(104,65)), reach=18),
    dict(legs=(((51,79),(47,95),(39,108)),((67,79),(85,95),(82,108))),
         waist=((0,84),(41,84),(46,81),(63,82),(74,82),(81,80),(102,79)), split=((74,63),(88,64),(104,63)), reach=18)
]

# A planted foot travels backwards an equal distance on each contact frame.
# During the return it passes the grounded ankle with a clear toe and knee lift.
TRAVEL = (1, .54, .08, -.38, -.84, -.98, -.31, .58)
LIFT = (0, 0, 0, 0, 0, 7, 12, 6)
PITCH = (-10, 0, 0, 2, 19, 28, 12, -7)
BODY_Y = (0, 2, 0, -2, 0, 2, 0, -2)


def interpolate(points, position):
    if position <= points[0][0]:
        return points[0][1]
    for (a, x), (b, y) in zip(points, points[1:]):
        if position <= b:
            return x + (y-x) * (position-a)/(b-a)
    return points[-1][1]


def bone_angle(a,b):
    return atan2(b[1]-a[1], b[0]-a[0])


def legs_and_coat(body, rig):
    upper = body.copy()
    legs = [Image.new('RGBA', CELL), Image.new('RGBA', CELL)]
    center = sum(leg[0][0] for leg in rig['legs'])/2
    for y in range(CELL[1]):
        divider = interpolate(rig['split'], y)
        for x in range(CELL[0]):
            color = body.getpixel((x,y))
            if not color[3]:
                continue
            waist = interpolate(rig['waist'], x)
            if y >= waist-2:  # overlap under the original belt
                legs[int(x >= divider)].putpixel((x,y), color)
            pelvis_depth=max(0,5-abs(x-center)*.3)
            if y >= waist+pelvis_depth:
                upper.putpixel((x,y),(0,0,0,0))
    return upper, legs


def knee_position(hip, ankle, upper_length, lower_length):
    dx,dy = ankle[0]-hip[0],ankle[1]-hip[1]
    distance = hypot(dx,dy)
    along = min(distance, (upper_length**2-lower_length**2+distance**2)/(2*distance))
    height = sqrt(max(0,upper_length**2-along**2))
    return (hip[0]+(dx*along+dy*height)/distance,hip[1]+(dy*along-dx*height)/distance)


def pose(leg, rig, frame, is_far, sole):
    hip,knee,ankle = leg
    phase=(frame+4*is_far)%8
    # Both knees aim forward. Slight camera-depth separation keeps the far sole
    # visible at contact and stops it falling below the nearer foot's plane.
    pitch=radians(PITCH[phase])
    depth=max(dx*sin(pitch)+dy*cos(pitch) for dx,dy in sole)
    planted_y = 119 - 2*is_far - round(depth)
    lane = (rig['legs'][0][0][0]+rig['legs'][1][0][0])/2 + (1 if is_far else -1)
    foot = (round(lane+rig['reach']*TRAVEL[phase]), planted_y-LIFT[phase])
    pelvis = (hip[0], hip[1]+BODY_Y[frame])
    knee = knee_position(pelvis, foot, hypot(knee[0]-hip[0],knee[1]-hip[1]),
                         hypot(ankle[0]-knee[0], ankle[1]-knee[1]))
    return (pelvis,knee,foot),pitch


def band(layer, top, bottom):
    """Isolate a horizontal strip while retaining its position in the source cell."""
    result = Image.new('RGBA', CELL)
    result.paste(layer.crop((0,top,CELL[0],bottom)),(0,top))
    return result


def bone_pixels(layer, start, end, before, after, width):
    """Cut perpendicular to each sloping bone, keeping neighbouring joints out."""
    x0,y0=start
    x1,y1=end
    length=hypot(x1-x0,y1-y0)
    ux,uy=(x1-x0)/length,(y1-y0)/length
    result=Image.new('RGBA',CELL)
    source, target=layer.load(), result.load()
    for y in range(max(0,int(min(y0,y1)-width-before)),min(CELL[1],int(max(y0,y1)+width+after)+1)):
        for x in range(max(0,int(min(x0,x1)-width-before)),min(CELL[0],int(max(x0,x1)+width+after)+1)):
            dx,dy=x-x0,y-y0
            along, across=dx*ux+dy*uy,abs(dx*uy-dy*ux)
            if -before<=along<=length+after and across<=width:
                target[x,y]=source[x,y]
    return result


def place_piece(piece, source, target, angle, length_ratio=1, source_angle=0):
    """Rigid rotation about the painted joint, with length adjustment along the limb only."""
    c,s = cos(angle),sin(angle)
    u,v = cos(source_angle),sin(source_angle)
    change = 1/length_ratio-1
    # Inverse rotate target coordinates then unscale along the original bone axis.
    a,b = c*(1+change*u*u)-s*change*u*v, s*(1+change*u*u)+c*change*u*v
    d,e = c*change*u*v-s*(1+change*v*v), s*change*u*v+c*(1+change*v*v)
    tx,ty = target
    coeffs = (a,b,source[0]-a*tx-b*ty,d,e,source[1]-d*tx-e*ty)
    return piece.transform(CELL, Image.Transform.AFFINE, coeffs, Image.Resampling.NEAREST)


def dress_leg(layer, rest, moved, pitch):
    """Pose the original thigh, calf and boot, then cap the knee with its intact pad."""
    hip,knee,ankle=rest
    h,k,a=moved
    upper_angle=bone_angle(hip,knee)
    lower_angle=bone_angle(knee,ankle)
    upper_turn=bone_angle(h,k)-upper_angle
    lower_turn=bone_angle(k,a)-lower_angle
    upper_ratio=hypot(k[0]-h[0],k[1]-h[1])/hypot(knee[0]-hip[0],knee[1]-hip[1])
    lower_ratio=hypot(a[0]-k[0],a[1]-k[1])/hypot(ankle[0]-knee[0],ankle[1]-knee[1])
    thigh=bone_pixels(layer,hip,knee,7,3,12)
    shin=bone_pixels(layer,knee,ankle,4,2,10)
    boot=band(layer,ankle[1]-3,CELL[1])
    # The original pad must remain readable even when the calf folds past horizontal.
    kneepad=Image.new('RGBA',CELL)
    pad_mask=Image.new('L',CELL)
    x,y=knee
    ImageDraw.Draw(pad_mask).ellipse((x-8,y-7,x+8,y+7),fill=255)
    kneepad.paste(layer,mask=pad_mask)
    result=place_piece(shin,knee,k,lower_turn,lower_ratio,lower_angle)
    result.alpha_composite(place_piece(thigh,hip,h,upper_turn,upper_ratio,upper_angle))
    result.alpha_composite(place_piece(kneepad,knee,k,(upper_turn+lower_turn)*.5))
    result.alpha_composite(place_piece(boot,ankle,a,pitch))
    return result


def walk_targets(body, role, legs=None):
    """Return near/far (hip, knee, ankle) coordinates and boot pitch per frame.
    Source sole pixels determine the ankle height for each tipped boot. Use this
    pose from the original body even when rendering a fitted equipment layer.
    """
    rig=RIGS[role]
    if legs is None:
        _,legs=legs_and_coat(body,rig)
    soles=[]
    for leg,(_,_,ankle) in zip(legs,rig['legs']):
        ax,ay=ankle
        soles.append([(x-ax,y-ay) for y in range(ay-3,CELL[1]) for x in range(CELL[0])
                      if leg.getpixel((x,y))[3]>64])
    return [[pose(rest,rig,frame,bool(i),soles[i]) for i,rest in enumerate(rig['legs'])]
            for frame in range(8)]


def stride_sheet(path):
    path=Path(path)
    bodies=Image.open(path.parent/'bodies.png').convert('RGBA')
    atlas=Image.new('RGBA',(8*CELL[0],len(RIGS)*CELL[1]))
    for role,rig in enumerate(RIGS):
        body=bodies.crop((role*CELL[0],0,(role+1)*CELL[0],CELL[1]))
        coat,legs=legs_and_coat(body,rig)
        for frame,targets in enumerate(walk_targets(body,role,legs)):
            cel=Image.new('RGBA',CELL)
            for i in [1,0]:
                rest=rig['legs'][i]
                moved,pitch=targets[i]
                cel.alpha_composite(dress_leg(legs[i],rest,moved,pitch))
            cel.alpha_composite(coat,(0,BODY_Y[frame]))
            if role<3:
                # These legacy operators are authored on the original 96×64 grid.
                cel=cel.resize((96,64),Image.Resampling.NEAREST).resize(CELL,Image.Resampling.NEAREST)
            atlas.alpha_composite(cel,(frame*CELL[0],role*CELL[1]))
    atlas.save(path,optimize=True)


if __name__=='__main__':
    stride_sheet(ROOT/'game/art/armory/crew-stride.png')
