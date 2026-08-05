#!/usr/bin/env python3
"""
스토어 스크린샷 만들기
================================================================================
기기에서 찍은 앱 화면에 배경과 한 줄 카피를 얹어, Play 스토어에 올릴
1080x1920 이미지를 만든다.

쓰는 법
--------------------------------------------------------------------------------
1) 기기에서 찍은 원본을 design/store/raw/ 에 넣는다.
   파일 이름 앞의 숫자가 순서다.  예)  01-home.png  02-diary.png ...
2) 아래 SHOTS 의 카피를 원본 순서와 맞춘다.
3) python3 design/store/make_screenshots.py
   → design/store/out/ 에 결과가 생긴다.

원본은 비율이 달라도 된다. 화면 전체가 들어가도록 폭·높이에 맞춰 줄인다 (자르지 않음).
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# ── 출력 규격 ────────────────────────────────────────────────────────────────
W, H = 1080, 1920

# ── 색 (src/index.css 의 앱 팔레트와 맞춤) ──────────────────────────────────
IVORY = (251, 249, 245)      # 배경 — 앱 배경과 같은 밀키 아이보리
LILAC = (168, 139, 199)      # 포인트 — 앱 primary
INK = (59, 49, 71)           # 본문 — 앱 foreground
MUTED = (138, 128, 150)      # 보조 문구

FONT_BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
FONT_REG = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
KR_INDEX = 2  # ttc 안에서 한국어 자형

# 배지 왼쪽에 넣을 문어 아이콘.
# 아이콘 배경색(#A88BC7)이 배지 색과 같아 경계 없이 얹힌다.
ICON = Path(__file__).resolve().parents[2] / "public" / "icon-192.png"

# ── 화면별 카피 ──────────────────────────────────────────────────────────────
# 파일 이름(확장자 제외)으로 찾는다. 순서를 바꾸거나 장수를 늘려도
# 카피가 엉키지 않게 하기 위해서다.
#   값: (배지, 윗줄, 아랫줄 강조, 보조 설명)  — 배지와 보조는 비워도 된다
SHOTS = {
    "01-home": (
        "혹시 나는 전생에 문어였을까!?",
        "뜨개인을 위한",
        "프로젝트 관리 앱",
        "",
    ),
    "02-01-project": (
        "", "실·도안·바늘까지", "프로젝트 한 곳에",
        "무엇으로 떴는지 나중에도 알 수 있어요",
    ),
    "02-02-counter-gauge": (
        "", "내 게이지에 맞게", "코수를 다시 계산",
        "도안과 손이 달라도 사이즈가 맞아요",
    ),
    "02-counter": (
        "", "한 손으로 세는", "단수 카운터",
        "숫자를 눌러 바로 고칠 수도 있어요",
    ),
    "03-diary": (
        "", "매일 한 줄씩 남기면", "완성한 날 한눈에",
        "어떤 마음으로 떴는지까지 다시 볼 수 있어요",
    ),
    "04-library": (
        "", "실·도안·바늘·부자재", "내 뜨개 서랍",
        "한 번 넣어두면 계속 꺼내 써요",
    ),
    "04-01-library-yarn": (
        "", "남은 실이 얼마나", "실장 정리",
        "색·굵기·권장 게이지까지 적어둘 수 있어요",
    ),
    "04-02.library-pattern": (
        "", "사둔 도안을", "잊지 않게",
        "어떤 프로젝트에 썼는지 함께 봐요",
    ),
    "04-03.library-nedlee": (
        "", "있는 바늘, 없는 바늘", "한눈에",
        "같은 호수를 또 사지 않도록",
    ),
    "05-backup": (
        "", "사진까지 안전하게", "클라우드 백업",
        "폰과 태블릿에서 같은 기록을 봐요",
    ),
}

# 기분 아이콘을 배경에 흩뿌릴 화면
DECOR_MOOD = {"03-diary"}

# ── 여러 화면을 겹쳐 한 장으로 ──────────────────────────────────────────────
# 비슷한 화면을 따로 올리면 지루하다. 부채처럼 겹치면 "이런 것들이 다 있구나"가
# 한 장에 전해진다.
#   출력 이름: ([가운데, 왼쪽, 오른쪽] 원본 이름, 배지, 윗줄, 아랫줄, 보조)
#   맨 앞 화면이 가운데에 온다.
FANS = {
    "library-fan": (
        ["04-02.library-pattern", "04-03.library-nedlee", "04-01-library-yarn"],
        "",
        "도안·바늘·실까지",
        "한 서랍에 정리",
        "한 번 넣어두면 프로젝트마다 꺼내 써요",
    ),
}

# 이름이 목록에 없을 때 쓸 기본값
FALLBACK = ("", "", "뜨개일기", "뜨개하는 사람을 위한 기록장")

BASE = Path(__file__).parent
RAW = BASE / "raw"
OUT = BASE / "out"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size, index=KR_INDEX)


def fit_width(text: str, path: str, size: int, max_w: int) -> ImageFont.FreeTypeFont:
    """글자가 길면 들어갈 때까지 크기를 줄인다"""
    f = font(path, size)
    while size > 20 and f.getbbox(text)[2] > max_w:
        size -= 2
        f = font(path, size)
    return f


def center(draw: ImageDraw.ImageDraw, y: int, text: str, f, fill):
    w = draw.textbbox((0, 0), text, font=f)[2]
    draw.text(((W - w) // 2, y), text, font=f, fill=fill)
    return draw.textbbox((0, 0), text, font=f)[3]


def rounded_shadow(canvas: Image.Image, box, radius: int):
    """기기 화면 뒤에 은은한 그림자 — 배경에서 살짝 떠 보이게"""
    x, y, w, h = box
    pad = 40
    layer = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(
        (pad, pad, pad + w, pad + h), radius=radius, fill=(80, 60, 100, 60)
    )
    layer = layer.filter(ImageFilter.GaussianBlur(22))
    canvas.alpha_composite(layer, (x - pad, y - pad + 10))


def round_corners(img: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *img.size), radius=radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def draw_badge(canvas: Image.Image, draw: ImageDraw.ImageDraw, y: int, text: str) -> int:
    """라일락 알약 안에 문어 아이콘과 흰 글씨 — 눈이 가장 먼저 닿는 자리"""
    f = fit_width(text, FONT_BOLD, 38, W - 340)
    tw = draw.textbbox((0, 0), text, font=f)[2]
    th = draw.textbbox((0, 0), text, font=f)[3]

    pad_x, pad_y = 40, 22
    bh = th + pad_y * 2
    icon_size = bh - 18
    gap = 16
    has_icon = ICON.exists()

    bw = pad_x * 2 + tw + ((icon_size + gap) if has_icon else 0)
    x = (W - bw) // 2
    draw.rounded_rectangle((x, y, x + bw, y + bh), radius=bh // 2, fill=LILAC)

    cursor = x + pad_x
    if has_icon:
        icon = Image.open(ICON).convert("RGBA").resize((icon_size, icon_size), Image.LANCZOS)
        canvas.alpha_composite(icon, (cursor, y + (bh - icon_size) // 2))
        cursor += icon_size + gap

    draw.text((cursor, y + pad_y - 4), text, font=f, fill=(255, 255, 255))
    return bh


# ── 기분 아이콘 ──────────────────────────────────────────────────────────────
# 앱의 기분 선택지(🧶 😊 🔥 😮‍💨 😴 🎉)를 팔레트에 맞춰 단순한 도형으로 그린다.
# 컬러 이모지 폰트를 쓸 수 없기도 하고, 배경 장식으로는 이쪽이 더 차분하다.

def mood_mark(kind: str, size: int, alpha: int) -> Image.Image:
    """기분 하나를 그린 투명 이미지.

    작게, 흐리게 놓이는 장식이라 알아볼 수 있는 형태만 쓴다.
    복잡한 그림은 이 크기에서 그냥 얼룩으로 보인다.
    """
    S = size * 4  # 4배로 그린 뒤 줄여서 가장자리를 부드럽게
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    face = LILAC + (alpha,)
    ink = INK + (min(255, alpha + 70),)
    m = S // 8
    lw = max(2, S // 30)

    def circle():
        d.ellipse((m, m, S - m, S - m), fill=face)

    def eyes(closed=False):
        for ex in (S * 0.37, S * 0.63):
            if closed:
                d.arc((ex - S * 0.07, S * 0.38, ex + S * 0.07, S * 0.5), 200, 340, fill=ink, width=lw)
            else:
                d.ellipse((ex - S * 0.035, S * 0.40, ex + S * 0.035, S * 0.47), fill=ink)

    if kind == "yarn":                      # 실뭉치 — 원 안에 감긴 실
        circle()
        for dx in (-S * 0.16, 0, S * 0.16):
            d.arc((S * 0.2 + dx, m + S * 0.02, S * 0.8 + dx, S - m - S * 0.02),
                  260, 300, fill=ink, width=lw)
    elif kind == "smile":                   # 웃음
        circle()
        eyes()
        d.arc((S * 0.33, S * 0.44, S * 0.67, S * 0.72), 20, 160, fill=ink, width=lw)
    elif kind == "sleep":                   # 잠
        circle()
        eyes(closed=True)
        d.arc((S * 0.42, S * 0.56, S * 0.58, S * 0.70), 20, 160, fill=ink, width=lw)
    elif kind == "sigh":                    # 후우
        circle()
        for ex in (S * 0.37, S * 0.63):
            d.line((ex - S * 0.06, S * 0.44, ex + S * 0.06, S * 0.44), fill=ink, width=lw)
        d.ellipse((S * 0.45, S * 0.58, S * 0.57, S * 0.70), fill=ink)
    elif kind == "heart":                   # 애정
        r = S * 0.22
        d.ellipse((S * 0.5 - r * 1.7, S * 0.3, S * 0.5 - r * 1.7 + r * 2, S * 0.3 + r * 2), fill=face)
        d.ellipse((S * 0.5 - r * 0.3, S * 0.3, S * 0.5 - r * 0.3 + r * 2, S * 0.3 + r * 2), fill=face)
        d.polygon([(S * 0.5 - r * 1.7, S * 0.52), (S * 0.5 + r * 1.7, S * 0.52), (S * 0.5, S - m)],
                  fill=face)
    elif kind == "spark":                   # 완성의 반짝임
        cx = cy = S / 2
        arm, waist = S * 0.42, S * 0.10
        d.polygon(
            [(cx, cy - arm), (cx + waist, cy - waist), (cx + arm, cy),
             (cx + waist, cy + waist), (cx, cy + arm), (cx - waist, cy + waist),
             (cx - arm, cy), (cx - waist, cy - waist)],
            fill=face,
        )

    return img.resize((size, size), Image.LANCZOS)


# (종류, x, y, 크기, 진하기) — 글자와 기기 화면을 피해 여백에 흩뿌린다
MOOD_LAYOUT = [
    ("yarn", 58, 470, 104, 46),
    ("smile", 946, 430, 88, 40),
    ("heart", 46, 870, 84, 34),
    ("spark", 952, 900, 92, 40),
    ("sleep", 54, 1320, 92, 38),
    ("sigh", 950, 1380, 84, 34),
    ("spark", 68, 1710, 74, 30),
    ("yarn", 944, 1720, 88, 36),
]


def scatter_moods(canvas: Image.Image):
    for kind, x, y, size, alpha in MOOD_LAYOUT:
        canvas.alpha_composite(mood_mark(kind, size, alpha), (x, y))


def draw_copy(canvas: Image.Image, draw: ImageDraw.ImageDraw,
              badge: str, line1: str, line2: str, sub: str) -> int:
    """배지·윗줄·강조줄·보조를 그리고, 화면을 놓을 y 를 돌려준다"""
    y = 120
    if badge:
        y += draw_badge(canvas, draw, y, badge) + 34
    if line1:
        f1 = fit_width(line1, FONT_REG, 52, W - 180)
        y += center(draw, y, line1, f1, MUTED) + 18

    f2 = fit_width(line2, FONT_BOLD, 82, W - 150)
    y += center(draw, y, line2, f2, INK) + 26

    if sub:
        f3 = fit_width(sub, FONT_REG, 34, W - 200)
        y += center(draw, y, sub, f3, MUTED)
    return y + 56


def build(raw_path: Path, badge: str, line1: str, line2: str, sub: str,
          out_path: Path, decor: bool = False):
    canvas = Image.new("RGBA", (W, H), IVORY + (255,))
    draw = ImageDraw.Draw(canvas)

    # 위쪽에 아주 옅은 라일락 띠 — 밋밋함을 덜어 준다.
    # 경계가 또렷하면 인쇄물처럼 보여서 흐리게 풀어 준다.
    band = Image.new("RGBA", (W, 700), (0, 0, 0, 0))
    ImageDraw.Draw(band).ellipse((-260, -420, W + 260, 560), fill=LILAC + (24,))
    canvas.alpha_composite(band.filter(ImageFilter.GaussianBlur(30)), (0, 0))

    if decor:
        scatter_moods(canvas)

    y = draw_copy(canvas, draw, badge, line1, line2, sub)

    # ── 기기 화면 ────────────────────────────────────────────────────────
    # 화면은 절대 자르지 않는다. 아래 탭바(홈·다이어리·프로젝트…)가 잘리면
    # 앱이 어떻게 생겼는지 전달되지 않는다. 폭·높이 중 더 빡빡한 쪽에 맞춘다.
    shot = Image.open(raw_path).convert("RGB")
    max_w = 780
    max_h = H - y - 40
    scale = min(max_w / shot.width, max_h / shot.height)
    shot = shot.resize((round(shot.width * scale), round(shot.height * scale)), Image.LANCZOS)

    x = (W - shot.width) // 2
    rounded_shadow(canvas, (x, y, shot.width, shot.height), 36)
    canvas.alpha_composite(round_corners(shot, 36), (x, y))

    OUT.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out_path, "PNG")
    print(f"  {out_path.name}  ({line2})")


def build_fan(stems: list[str], badge: str, line1: str, line2: str, sub: str, out_path: Path):
    """화면 여러 장을 살짝 기울여 겹쳐 놓는다. 가운데가 맨 앞."""
    canvas = Image.new("RGBA", (W, H), IVORY + (255,))
    draw = ImageDraw.Draw(canvas)

    band = Image.new("RGBA", (W, 700), (0, 0, 0, 0))
    ImageDraw.Draw(band).ellipse((-260, -420, W + 260, 560), fill=LILAC + (24,))
    canvas.alpha_composite(band.filter(ImageFilter.GaussianBlur(30)), (0, 0))

    y = draw_copy(canvas, draw, badge, line1, line2, sub)

    shots = [find_raw(name) for name in stems]
    shots = [p for p in shots if p]
    if not shots:
        print(f"  건너뜀 — 원본을 찾지 못했습니다: {stems}")
        return

    card_w = 470
    max_h = H - y - 40

    # 중심 x 를 기준으로 놓는다. 회전하면 이미지가 커지는데, 왼쪽 좌표로 놓으면
    # 그만큼 오른쪽이 화면 밖으로 밀려 잘린다.
    #   (중심 x, 기울기, 세로 밀기)  — 가장자리는 뒤로, 가운데는 앞으로
    #   (중심 x, 기울기, 세로 밀기)  — 뒤에 깔리는 둘을 먼저, 가운데를 마지막에
    places = [(272, -5, 64), (808, 5, 64), (540, 0, 0)]
    order = [1, 2, 0] if len(shots) >= 3 else list(range(len(shots)))

    # 먼저 크기를 정해 블록 높이를 구하고, 남는 공간에 가운데 맞춤으로 놓는다
    sample = Image.open(shots[0])
    scale = min(card_w / sample.width, (max_h - 64) / sample.height)
    block_h = round(sample.height * scale) + 64
    top = y + max(0, (max_h - block_h) // 2)

    for slot, idx in enumerate(order):
        shot = Image.open(shots[idx]).convert("RGB")
        shot = shot.resize((round(shot.width * scale), round(shot.height * scale)), Image.LANCZOS)
        card = round_corners(shot, 28)

        cx, angle, drop = places[slot] if slot < len(places) else (540, 0, 0)
        if angle:
            card = card.rotate(angle, expand=True, resample=Image.BICUBIC)

        x = cx - card.width // 2
        rounded_shadow(canvas, (x + 20, top + drop + 20, card.width - 40, card.height - 40), 28)
        canvas.alpha_composite(card, (x, top + drop))

    OUT.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out_path, "PNG")
    print(f"  {out_path.name}  ({line2})")


def find_raw(stem: str):
    for ext in (".png", ".jpg", ".jpeg"):
        p = RAW / f"{stem}{ext}"
        if p.exists():
            return p
    return None


def main():
    if not RAW.exists():
        print(f"원본 폴더가 없습니다: {RAW}")
        print("기기에서 찍은 화면을 여기에 넣고 다시 실행하세요.")
        return

    raws = sorted(p for p in RAW.iterdir() if p.suffix.lower() in {".png", ".jpg", ".jpeg"})
    if not raws:
        print(f"{RAW} 안에 이미지가 없습니다.")
        return

    print(f"원본 {len(raws)}장으로 스토어 이미지를 만듭니다.")
    missing = []
    for i, raw in enumerate(raws):
        copy = SHOTS.get(raw.stem)
        if copy is None:
            missing.append(raw.stem)
            copy = FALLBACK
        build(raw, *copy, OUT / f"{i + 1:02d}-{raw.stem}.png", decor=raw.stem in DECOR_MOOD)

    if missing:
        print("\n카피가 없어 기본 문구를 쓴 파일:")
        for name in missing:
            print(f"  - {name}   (SHOTS 에 추가하세요)")

    # Play 스토어는 기기 유형당 최대 8장까지 올릴 수 있다
    if len(raws) > 8:
        print(f"\n⚠️ {len(raws)}장입니다. 스토어에는 8장까지만 올라가니 골라서 쓰세요.")

    for name, (stems, *copy) in FANS.items():
        build_fan(stems, *copy, OUT / f"{name}.png")

    print(f"\n완료 → {OUT}")


if __name__ == "__main__":
    main()
