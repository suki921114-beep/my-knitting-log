#!/usr/bin/env python3
"""
인스타용 정사각형 카드 (1080x1080)
================================================================================
스토어 이미지와 같은 소재를 인스타 피드 비율로 다시 만든다.

    python3 design/store/make_insta.py
    → design/store/out/insta/

세로로 긴 앱 화면을 정사각형에 통째로 넣으면 손톱만 해진다.
그래서 화면 위쪽만 크게 보여주고 아래는 화면 밖으로 흘려보낸다.
피드에서는 앱이 커 보이는 게 훨씬 중요하다.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

S = 1080

IVORY = (251, 249, 245)
LILAC = (168, 139, 199)
INK = (59, 49, 71)
MUTED = (138, 128, 150)

# 단추 장식 색 — 뜨개 부자재 느낌의 파스텔
BUTTONS = [(197, 226, 219), (247, 214, 219), (250, 236, 205), (219, 214, 240)]

FONT_BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
FONT_REG = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
KR = 2

BASE = Path(__file__).parent
RAW = BASE / "raw"
OUT = BASE / "out" / "insta"
ICON = BASE.resolve().parents[1] / "public" / "icon-192.png"

# 카드 정의 — (원본 이름들, 윗줄, 아랫줄 강조, 보조)
CARDS = [
    (["01-home"], "뜨개인을 위한", "프로젝트 관리 앱", "혹시 나는 전생에 문어였을까!?"),
    (["02-01-project"], "문어발 모여라!", "프로젝트 관리", "어떤 실로 떴는지 나중에도 알 수 있어요"),
    (["02-counter", "02-02-counter-gauge"], "내가 어디까지 떴더라?", "단수도 게이지도 걱정 NO!",
     "프로젝트 안에서 세고, 내 게이지로 다시 계산해요"),
    (["03-diary"], "매일 한 줄씩 남기면", "완성한 날 한눈에",
     "어떤 마음으로 떴는지까지 다시 볼 수 있어요"),
    (["04-01-library-yarn"], "또 샀다, 또 샀어…", "실창고 비우기", "(이번엔 진짜…)"),
    (["04-02.library-pattern", "04-03.library-nedlee", "04-04-library-notion"],
     "도안·바늘·부자재까지", "한 서랍에 정리", "한 번 넣어두면 프로젝트마다 꺼내 써요"),
]


def font(path, size):
    return ImageFont.truetype(path, size, index=KR)


def fit(text, path, size, max_w):
    f = font(path, size)
    while size > 18 and f.getbbox(text)[2] > max_w:
        size -= 2
        f = font(path, size)
    return f


def center(draw, y, text, f, fill):
    w = draw.textbbox((0, 0), text, font=f)[2]
    draw.text(((S - w) // 2, y), text, font=f, fill=fill)
    return draw.textbbox((0, 0), text, font=f)[3]


def backdrop() -> Image.Image:
    canvas = Image.new("RGBA", (S, S), IVORY + (255,))
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse((-240, -380, S + 240, 420), fill=LILAC + (26,))
    canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(40)))
    return canvas


def button(size: int, color, alpha=255) -> Image.Image:
    """뜨개 단추 — 원 안에 구멍 네 개"""
    P = size * 4
    img = Image.new("RGBA", (P, P), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((0, 0, P, P), fill=color + (alpha,))
    d.ellipse((P * 0.14, P * 0.14, P * 0.86, P * 0.86),
              outline=(255, 255, 255, alpha // 3), width=P // 40)
    r = P * 0.055
    for cx, cy in ((0.38, 0.38), (0.62, 0.38), (0.38, 0.62), (0.62, 0.62)):
        d.ellipse((P * cx - r, P * cy - r, P * cx + r, P * cy + r), fill=(255, 255, 255, alpha))
    return img.resize((size, size), Image.LANCZOS)


def screens(stems: list[str], top: int, canvas: Image.Image):
    """앱 화면을 아래로 흘려보내며 놓는다"""
    paths = [find_raw(n) for n in stems]
    paths = [p for p in paths if p]
    if not paths:
        return

    if len(paths) == 1:
        places = [(S // 2, 0, 640)]
    elif len(paths) == 2:
        places = [(700, 5, 470), (410, -3, 500)]
        paths = [paths[1], paths[0]]          # 첫 번째가 앞
    else:
        places = [(250, -6, 400), (830, 6, 400), (540, 0, 440)]
        paths = [paths[1], paths[2], paths[0]]

    for path, (cx, angle, w) in zip(paths, places):
        shot = Image.open(path).convert("RGB")
        scale = w / shot.width
        shot = shot.resize((w, round(shot.height * scale)), Image.LANCZOS)
        shot = shot.crop((0, 0, w, min(shot.height, S - top + 120)))

        card = Image.new("RGBA", shot.size, (0, 0, 0, 0))
        mask = Image.new("L", shot.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, *shot.size), radius=34, fill=255)
        card.paste(shot, (0, 0))
        card.putalpha(mask)

        if angle:
            card = card.rotate(angle, expand=True, resample=Image.BICUBIC)

        x = cx - card.width // 2
        shadow = Image.new("RGBA", (card.width + 80, card.height + 80), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle(
            (40, 40, card.width + 40, card.height + 40), radius=34, fill=(80, 60, 100, 55))
        canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(24)), (x - 40, top - 30))
        canvas.alpha_composite(card, (x, top))


def find_raw(stem: str):
    for ext in (".png", ".jpg", ".jpeg"):
        p = RAW / f"{stem}{ext}"
        if p.exists():
            return p
    return None


def build_card(stems, line1, line2, sub, out_path: Path):
    canvas = backdrop()
    draw = ImageDraw.Draw(canvas)

    y = 78
    if line1:
        y += center(draw, y, line1, fit(line1, FONT_REG, 44, S - 160), MUTED) + 14
    y += center(draw, y, line2, fit(line2, FONT_BOLD, 72, S - 120), INK) + 18
    if sub:
        y += center(draw, y, sub, fit(sub, FONT_REG, 30, S - 180), MUTED)
    y += 46

    screens(stems, y, canvas)

    OUT.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out_path, "PNG")
    print(f"  {out_path.name}  ({line2})")


def build_cover(out_path: Path):
    """1장 — 모집 표지.

    피드에서 스크롤을 멈추게 하는 게 전부인 장이다.
    이름 · 무슨 앱인지 · 무엇을 부탁하는지 넷만 두고 크게 키운다.
    조건과 혜택은 다음 장과 본문에서 말하면 된다.
    """
    canvas = backdrop()
    draw = ImageDraw.Draw(canvas)

    # 단추 장식 — (x, y, 크기, 색 번호, 투명도)
    for x, yy, size, ci, a in [
        (44, 66, 146, 0, 255), (196, 168, 82, 1, 232), (892, 82, 108, 3, 238),
        (24, 442, 74, 2, 205), (988, 396, 64, 1, 195), (856, 878, 128, 2, 238),
        (96, 906, 96, 3, 228), (470, 966, 62, 1, 190),
    ]:
        canvas.alpha_composite(button(size, BUTTONS[ci], a), (x, yy))

    if ICON.exists():
        icon = Image.open(ICON).convert("RGBA").resize((232, 232), Image.LANCZOS)
        canvas.alpha_composite(icon, ((S - 232) // 2, 176))

    y = 452
    y += center(draw, y, "뜨개일기", font(FONT_BOLD, 116), INK) + 18
    y += center(draw, y, "뜨개 프로젝트 관리 앱", font(FONT_REG, 46), MUTED) + 62

    # 배지
    f = font(FONT_BOLD, 52)
    label = "BETA TESTER CALL"
    tw = draw.textbbox((0, 0), label, font=f)[2]
    th = draw.textbbox((0, 0), label, font=f)[3]
    bw, bh = tw + 104, th + 52
    bx = (S - bw) // 2
    draw.rounded_rectangle((bx, y, bx + bw, y + bh), radius=bh // 2, fill=LILAC)
    draw.text((bx + 52, y + 22), label, font=f, fill=(255, 255, 255))

    OUT.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out_path, "PNG")
    print(f"  {out_path.name}  (표지)")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    print("인스타용 정사각형 카드를 만듭니다.")
    build_cover(OUT / "01-cover.png")
    for i, (stems, *copy) in enumerate(CARDS, start=2):
        build_card(stems, *copy, OUT / f"{i:02d}.png")
    print(f"\n완료 → {OUT}")


if __name__ == "__main__":
    main()
