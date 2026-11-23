"""Lay out the six transparent equipment candidates in two Korean comparison sheets."""
from pathlib import Path
import argparse
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "design" / "equipment-concepts"
FONTS = Path("C:/Windows/Fonts")
WIDTH, HEIGHT = 1800, 824
PAPER = "#f2efe7"
TEXT = "#24282a"
MUTED = "#555b5b"
RULE = "#a8aca5"
SHEETS = {
    "bunker": {
        "title": "벌크의 벙커",
        "file": "bunkers.png",
        "accent": "#31647a",
        "labels": [
            ("B-01", "원형 돔형", "낮은 돔 · 둥근 외벽"),
            ("B-02", "전면 경사형", "넓은 전면 셔터 · 쐐기형 장갑"),
            ("B-03", "방사 장갑형", "방사형 버팀벽 · 분할 덮개"),
        ],
    },
    "mortar": {
        "title": "설치형 박격포",
        "file": "mortars.png",
        "accent": "#875034",
        "labels": [
            ("M-01", "쐐기 받침형", "넓은 삽날형 받침"),
            ("M-02", "야전 상자형", "열린 장비 상자"),
            ("M-03", "중장갑 포가형", "양옆 장갑판"),
        ],
    },
}


def typeface(size, weight):
    font_path = FONTS / "NotoSansKR-VF.ttf"
    if not font_path.exists():
        return ImageFont.truetype(str(FONTS / ("malgunbd.ttf" if weight >= 600 else "malgun.ttf")), size)
    font = ImageFont.truetype(str(font_path), size)
    font.set_variation_by_axes([weight])
    return font


def crop_art(image):
    alpha = image.getchannel("A")
    # Exclude isolated matte noise when fitting, while retaining soft perimeter pixels.
    mask = alpha.point(lambda a: 255 if a > 50 else 0)
    clean = mask.filter(ImageFilter.MedianFilter(3))
    bounds = clean.getbbox() or mask.getbbox()
    if bounds is None:
        raise ValueError("Candidate image is empty")
    left, top, right, bottom = bounds
    bleed = max(2, round(max(right-left, bottom-top)*.018))
    return image.crop((max(0,left-bleed),max(0,top-bleed),
                       min(image.width,right+bleed),min(image.height,bottom+bleed)))


def place_art(sheet, source, center):
    art = crop_art(Image.open(source).convert("RGBA"))
    target_width, target_height = 525, 415
    scale = min(target_width/art.width, target_height/art.height)
    size = (round(art.width*scale),round(art.height*scale))
    sampler = Image.Resampling.NEAREST if max(art.size) <= 180 else Image.Resampling.LANCZOS
    art = art.resize(size, sampler)
    # A barrel can overhang far from its carriage; split the difference between the
    # silhouette's bounds and its center of mass so the row still feels balanced.
    profile = art.getchannel("A").resize((80,1),Image.Resampling.BOX)
    weights = profile.tobytes()
    mass_x = sum((i+.5)*a for i,a in enumerate(weights))/max(1,sum(weights))/80*art.width
    anchor = .72*art.width/2+.28*mass_x
    x = round(center-anchor)
    min_x, max_x = center-272, center+272-art.width
    x = int(max(min_x,min(max_x,x)))
    # All three pieces stand on the same plane. A shallow piece sits slightly
    # above the literal baseline to avoid excessive blank space above it.
    y = round(590-art.height-(target_height-art.height)*.30)
    sheet.alpha_composite(art, (x,y))


def render(group):
    spec = SHEETS[group]
    sheet = Image.new("RGBA",(WIDTH,HEIGHT),PAPER)
    draw = ImageDraw.Draw(sheet)
    title_font = typeface(68,780)
    label_font = typeface(42,720)
    cue_font = typeface(30,455)
    code_path = FONTS / "consolab.ttf"
    code_font = ImageFont.truetype(str(code_path),28) if code_path.exists() else typeface(28,690)
    draw.text((61,111),spec["title"],font=title_font,fill=TEXT,anchor="ls",stroke_width=0)
    draw.line((64,145,WIDTH-64,145),fill=RULE,width=2)
    for i,(code,name,cue) in enumerate(spec["labels"]):
        left = 64+i*570
        center = left+265
        place_art(sheet, ART/f"{group}-{i+1:02}.png", center)
        draw.line((left,617,left+531,617),fill=RULE,width=2)
        draw.line((left,617,left+57,617),fill=spec["accent"],width=4)
        draw.text((left,662),code,font=code_font,fill=spec["accent"],anchor="ls")
        draw.text((left,721),name,font=label_font,fill=TEXT,anchor="ls")
        draw.text((left,771),cue,font=cue_font,fill=MUTED,anchor="ls")
    sheet.convert("RGB").save(ART/spec["file"],optimize=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("groups",nargs="*",help="bunker, mortar, or both if omitted")
    for group in parser.parse_args().groups or SHEETS:
        render(group)
