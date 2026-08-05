#!/usr/bin/env python3
"""
인스타 테스터 모집 카드 (1080x1080)
================================================================================
피드 첫 장에 쓸 이미지. 스크롤을 멈추게 하는 게 목적이라
글자를 크게 두고, 나머지는 비워 둔다.

    python3 design/store/make_recruit_card.py
    → design/store/out/recruit-01.png
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

S = 1080  # 정사각형

IVORY = (251, 249, 245)
LILAC = (168, 139, 199)
INK = (59, 49, 71)
MUTED = (138, 128, 150)

FONT_BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
FONT_REG = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
KR = 2

BASE = Path(__file__).parent
ICON = BASE.resolve().parents[1] / "public" / "icon-192.png"
OUT = BASE / "out"


def font(path, size):
    return ImageFont.truetype(path, size, index=KR)


def center(draw, y, text, f, fill):
    w = draw.textbbox((0, 0), text, font=f)[2]
    draw.text(((S - w) // 2, y), text, font=f, fill=fill)
    return draw.textbbox((0, 0), text, font=f)[3]


def pill(canvas, draw, y, text, size=40):
    f = font(FONT_BOLD, size)
    tw = draw.textbbox((0, 0), text, font=f)[2]
    th = draw.textbbox((0, 0), text, font=f)[3]
    pad_x, pad_y = 44, 24
    bh = th + pad_y * 2
    bw = tw + pad_x * 2
    x = (S - bw) // 2
    draw.rounded_rectangle((x, y, x + bw, y + bh), radius=bh // 2, fill=LILAC)
    draw.text((x + pad_x, y + pad_y - 4), text, font=f, fill=(255, 255, 255))
    return bh


def main():
    canvas = Image.new("RGBA", (S, S), IVORY + (255,))
    draw = ImageDraw.Draw(canvas)

    # 은은한 라일락 번짐 — 위아래로 하나씩
    for box, alpha in (((-200, -320, S + 200, 380), 30), ((-160, S - 260, S + 160, S + 300), 22)):
        layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(layer).ellipse(box, fill=LILAC + (alpha,))
        canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(40)))

    # 문어 아이콘
    if ICON.exists():
        icon = Image.open(ICON).convert("RGBA").resize((150, 150), Image.LANCZOS)
        canvas.alpha_composite(icon, ((S - 150) // 2, 96))

    y = 280
    y += pill(canvas, draw, y, "베타 테스터 모집") + 44

    y += center(draw, y, "뜨개하는 분들,", font(FONT_REG, 50), MUTED) + 20
    y += center(draw, y, "먼저 써 보실래요?", font(FONT_BOLD, 84), INK) + 46

    y += center(draw, y, "실·도안·바늘·부자재부터 단수 카운터,", font(FONT_REG, 36), MUTED) + 14
    y += center(draw, y, "게이지 계산, 뜨개 일기까지", font(FONT_REG, 36), MUTED) + 76

    # 아래 안내 줄
    draw.rounded_rectangle((90, y, S - 90, y + 132), radius=32, fill=(255, 255, 255, 210))
    inner = y + 30
    center(draw, inner, "2주간 테스트해 주시면", font(FONT_REG, 34), MUTED)
    center(draw, inner + 48, "커피 상품권을 드려요", font(FONT_BOLD, 42), LILAC)

    center(draw, S - 82, "안드로이드만 참여 가능 · 프로필 링크에서 신청", font(FONT_REG, 30), MUTED)

    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / "recruit-01.png"
    canvas.convert("RGB").save(path, "PNG")
    print(f"완료 → {path}")


if __name__ == "__main__":
    main()
