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

# ── 화면별 카피 ──────────────────────────────────────────────────────────────
# 파일 이름(확장자 제외)으로 찾는다. 순서를 바꾸거나 장수를 늘려도
# 카피가 엉키지 않게 하기 위해서다.
#   값: (배지, 윗줄, 아랫줄 강조, 보조 설명)  — 배지와 보조는 비워도 된다
SHOTS = {
    "01-home": (
        "혹시 나는 전생에 문어였을까!?",
        "마음만은 모터 손!",
        "뜨개인의 프로젝트 관리 앱",
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
        "", "오늘 뭘 떴는지", "일기처럼 기록",
        "달력으로 지나온 날들을 돌아봐요",
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
    """라일락 알약 안에 흰 글씨 — 눈이 가장 먼저 닿는 자리"""
    f = fit_width(text, FONT_BOLD, 38, W - 260)
    tw = draw.textbbox((0, 0), text, font=f)[2]
    th = draw.textbbox((0, 0), text, font=f)[3]
    pad_x, pad_y = 42, 22
    bw, bh = tw + pad_x * 2, th + pad_y * 2
    x = (W - bw) // 2
    draw.rounded_rectangle((x, y, x + bw, y + bh), radius=bh // 2, fill=LILAC)
    draw.text((x + pad_x, y + pad_y - 4), text, font=f, fill=(255, 255, 255))
    return bh


def build(raw_path: Path, badge: str, line1: str, line2: str, sub: str, out_path: Path):
    canvas = Image.new("RGBA", (W, H), IVORY + (255,))
    draw = ImageDraw.Draw(canvas)

    # 위쪽에 아주 옅은 라일락 띠 — 밋밋함을 덜어 준다.
    # 경계가 또렷하면 인쇄물처럼 보여서 흐리게 풀어 준다.
    band = Image.new("RGBA", (W, 700), (0, 0, 0, 0))
    ImageDraw.Draw(band).ellipse((-260, -420, W + 260, 560), fill=LILAC + (24,))
    canvas.alpha_composite(band.filter(ImageFilter.GaussianBlur(30)), (0, 0))

    # ── 카피 ────────────────────────────────────────────────────────────
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
    y += 56

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
        build(raw, *copy, OUT / f"{i + 1:02d}-{raw.stem}.png")

    if missing:
        print("\n카피가 없어 기본 문구를 쓴 파일:")
        for name in missing:
            print(f"  - {name}   (SHOTS 에 추가하세요)")

    # Play 스토어는 기기 유형당 최대 8장까지 올릴 수 있다
    if len(raws) > 8:
        print(f"\n⚠️ {len(raws)}장입니다. 스토어에는 8장까지만 올라가니 골라서 쓰세요.")

    print(f"\n완료 → {OUT}")


if __name__ == "__main__":
    main()
