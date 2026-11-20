#!/usr/bin/env python3
"""生成模板自带的占位素材（一个简笔"人台机器人"），让模板不依赖任何 AI 素材也能完整跑起来。

产物写到 <out>/（默认 template/assets/demo/）：
  bg.webp                 背景底图（与所有片段共用，避免背景闪）
  gaze/0001.webp…         追视闭环：正面→左→左上→上→右上→右→右下→下→左下→左→正面
  t1…t4/0001.webp…        段落衔接：首屏→履历→作品目录→作品展示→结尾
  works/w1.webp…          作品封面占位
真实项目会用 AI 生成的视频帧替换这些文件，引擎和配置格式不变。

用法：python3 make-demo-assets.py [out_dir]
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, SS = 1280, 720, 2  # 输出尺寸与超采样倍数
BG_COLOR = (13, 13, 18)      # 与 site.config.js 的 theme.bg 一致，页面和画布无缝相接
ACCENT = (214, 255, 58)       # 荧光黄绿
PURPLE = (123, 63, 232)       # 卫衣紫
INK = (12, 12, 16)            # 粗描边
SKIN = (255, 222, 196)
HAIR = (248, 248, 252)

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "template", "assets", "demo")


def ease(t):
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def make_bg():
    """纯色底板：手绘涂鸦风的背景是平的，色块和涂鸦由网页叠加（会动）。"""
    return Image.new("RGB", (W * SS, H * SS), BG_COLOR)


BG = None


def draw_char(look=(0.0, 0.0), cx=0.66, cy=0.58, scale=1.0, rot=0.0, arm=0.0, blink=0.0):
    """画一帧 2D 粗描边卡通人台。look=视线方向（x 右正、y 下正，模长≤1）；arm=抬手程度 0..1。
    每个形状先画一遍加粗的黑色，再画填色，得到统一的粗描边。"""
    im = BG.copy()
    layer = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    s = scale * SS
    X, Y = cx * W * SS, cy * H * SS
    lx, ly = look
    R = 92 * s          # 头半径
    o = 7 * s           # 描边宽度

    def ell(cx_, cy_, r, fill, rx=None):
        rx = rx or r
        d.ellipse([cx_ - rx - o, cy_ - r - o, cx_ + rx + o, cy_ + r + o], fill=INK)
        d.ellipse([cx_ - rx, cy_ - r, cx_ + rx, cy_ + r], fill=fill)

    # 身体（紫色卫衣）
    bw, bh = 250 * s, 260 * s
    bx, by = X - bw / 2 + lx * 6 * s, Y + R * 0.78
    d.rounded_rectangle([bx - o, by - o, bx + bw + o, by + bh + o], radius=80 * s + o, fill=INK)
    d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=80 * s, fill=PURPLE)
    # 卫衣抽绳与口袋
    for side in (-1, 1):
        sx = X + lx * 6 * s + side * 34 * s
        d.line([(sx, by + 18 * s), (sx + side * 4 * s, by + 92 * s)], fill=ACCENT, width=int(8 * s))
    d.rounded_rectangle([bx + bw * 0.22, by + bh * 0.55, bx + bw * 0.78, by + bh * 0.82], radius=26 * s, outline=INK, width=int(6 * s))
    # 手臂：arm 控制从下垂到抬起挥手
    ax0, ay0 = bx + bw - 20 * s, by + 60 * s
    ang = lerp(80, -40, arm)
    ax1 = ax0 + math.cos(math.radians(ang)) * 150 * s
    ay1 = ay0 + math.sin(math.radians(ang)) * 150 * s
    d.line([(ax0, ay0), (ax1, ay1)], fill=INK, width=int(46 * s + 2 * o))
    d.line([(ax0, ay0), (ax1, ay1)], fill=PURPLE, width=int(46 * s))
    ell(ax1, ay1, 28 * s, SKIN)

    # 头随视线略微平移
    hx, hy = X + lx * 10 * s, Y + ly * 8 * s
    # 天线
    tx, ty = hx + lx * 30 * s, hy - R - 74 * s + ly * 10 * s
    d.line([(hx, hy - R * 0.9), (tx, ty)], fill=INK, width=int(8 * s + 2 * o))
    d.line([(hx, hy - R * 0.9), (tx, ty)], fill=(225, 225, 235), width=int(8 * s))
    ell(tx, ty, 15 * s, ACCENT)
    # 头发外轮廓（先整体描黑）
    puffs = []
    for i in range(9):
        a = math.radians(196 + i * 18.5)
        puffs.append((hx + math.cos(a) * R * 0.92 + lx * 6 * s, hy + math.sin(a) * R * 0.9, 36 * s))
    for px_, py_, r in puffs:
        d.ellipse([px_ - r - o, py_ - r - o, px_ + r + o, py_ + r + o], fill=INK)
    ell(hx, hy, R, SKIN)
    for px_, py_, r in puffs:
        d.ellipse([px_ - r, py_ - r, px_ + r, py_ + r], fill=HAIR)
    # 腮红
    for side in (-1, 1):
        cx_ = hx + lx * R * 0.3 + side * R * 0.55
        d.ellipse([cx_ - 16 * s, hy + R * 0.32 - 8 * s, cx_ + 16 * s, hy + R * 0.32 + 8 * s], fill=(255, 150, 150))
    # 五官整体沿视线平移，模拟转头
    fx, fy = hx + lx * R * 0.38, hy + ly * R * 0.32 + R * 0.08
    for side in (-1, 1):
        ex = fx + side * R * 0.36 * (1 - abs(lx) * 0.18)
        ey = fy
        er = R * 0.27
        d.ellipse([ex - er * 0.7, ey - er * 0.7, ex + er * 0.7, ey + er * 0.7], fill=(255, 255, 255))
        if blink < 0.8:
            pr = er * 0.36
            px_, py_ = ex + lx * er * 0.32, ey + ly * er * 0.28
            d.ellipse([px_ - pr, py_ - pr, px_ + pr, py_ + pr], fill=INK)
            d.ellipse([px_ - pr * 0.2 + pr * 0.3, py_ - pr * 0.6, px_ + pr * 0.3 + pr * 0.25, py_ - pr * 0.1], fill=(255, 255, 255))
        # 黑框眼镜
        d.rounded_rectangle([ex - er * 1.2, ey - er, ex + er * 1.2, ey + er], radius=er * 0.5, outline=INK, width=int(9 * s))
    d.line([(fx - R * 0.1, fy), (fx + R * 0.1, fy)], fill=INK, width=int(9 * s))
    # 咧嘴笑
    d.chord([fx - R * 0.22, fy + R * 0.26, fx + R * 0.22, fy + R * 0.62], 0, 180, fill=INK)
    d.chord([fx - R * 0.15, fy + R * 0.42, fx + R * 0.15, fy + R * 0.6], 0, 180, fill=(255, 110, 120))

    if rot:
        layer = layer.rotate(rot, center=(X, Y), resample=Image.BICUBIC)
    # 落地阴影
    sh = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([X - 160 * s, by + bh - 20 * s, X + 160 * s, by + bh + 30 * s], fill=(0, 0, 0, 70))
    sh = sh.filter(ImageFilter.GaussianBlur(18 * SS))
    im = im.convert("RGBA")
    im.alpha_composite(sh)
    im.alpha_composite(layer)
    return im.convert("RGB").resize((W, H), Image.LANCZOS)


def save_seq(name, frames_fn, n):
    folder = os.path.join(OUT, name)
    os.makedirs(folder, exist_ok=True)
    for i in range(n):
        frames_fn(i / (n - 1)).save(os.path.join(folder, f"{i + 1:04d}.webp"), quality=72, method=4)
    print(f"{name}: {n} 帧")


# 追视闭环关键方向（与 site.config.js 里 gaze.keys 对应）
# 先绕满一圈（左→…→左下→再回到左），再回正面，8 个方向之间都有真实的转头帧
DIRS = [(0, 0), (-1, 0), (-.707, -.707), (0, -1), (.707, -.707), (1, 0), (.707, .707), (0, 1), (-.707, .707), (-1, 0), (0, 0)]
GAZE_N = 121


def gaze_frame(t):
    seg = t * (len(DIRS) - 1)
    i = min(int(seg), len(DIRS) - 2)
    k = ease(seg - i)
    a, b = DIRS[i], DIRS[i + 1]
    look = (lerp(a[0], b[0], k), lerp(a[1], b[1], k))
    return draw_char(look=look)


# 段落姿态：位置、大小、视线、抬手、旋转
POSES = {
    "hero": dict(cx=0.66, cy=0.58, scale=1.0, look=(0, 0), arm=0, rot=0),
    "about": dict(cx=0.24, cy=0.58, scale=0.9, look=(0.8, -0.2), arm=1, rot=0),
    "folder": dict(cx=0.8, cy=0.66, scale=0.62, look=(-0.8, 0.3), arm=0.2, rot=0),
    "works": dict(cx=0.86, cy=1.45, scale=0.5, look=(0, -1), arm=0, rot=0),
    "outro_start": dict(cx=0.5, cy=-0.5, scale=0.55, look=(0, 1), arm=1, rot=0),
    "outro": dict(cx=0.5, cy=0.3, scale=0.55, look=(0, -0.6), arm=1, rot=-28),
}


def tween(a, b):
    A, B = POSES[a], POSES[b]

    def f(t):
        k = ease(t)
        arc = math.sin(math.pi * k) * -0.08  # 走一段弧线，不走直线
        return draw_char(
            look=(lerp(A["look"][0], B["look"][0], k), lerp(A["look"][1], B["look"][1], k)),
            cx=lerp(A["cx"], B["cx"], k), cy=lerp(A["cy"], B["cy"], k) + arc,
            scale=lerp(A["scale"], B["scale"], k), arm=lerp(A["arm"], B["arm"], k),
            rot=lerp(A["rot"], B["rot"], k))
    return f


def works_covers():
    folder = os.path.join(OUT, "works")
    os.makedirs(folder, exist_ok=True)
    palette = [((255, 94, 58), (139, 92, 246)), ((40, 220, 190), (20, 40, 120)), ((198, 255, 61), (20, 90, 60)),
               ((255, 200, 60), (200, 40, 90)), ((90, 160, 255), (30, 20, 80)), ((240, 240, 240), (60, 60, 70))]
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 96)
    except OSError:
        font = ImageFont.load_default()
    for n, (c1, c2) in enumerate(palette, 1):
        sw, sh = 64, 40
        im = Image.new("RGB", (sw, sh))
        px = im.load()
        for y in range(sh):
            for x in range(sw):
                t = (x / sw * 0.6 + y / sh * 0.4)
                px[x, y] = tuple(int(lerp(c1[i], c2[i], t)) for i in range(3))
        im = im.resize((1200, 750), Image.BICUBIC)
        d = ImageDraw.Draw(im)
        d.ellipse([700, -120, 1300, 480], outline=(255, 255, 255), width=3)
        d.text((60, 600), f"WORK 0{n}", font=font, fill=(255, 255, 255))
        im.save(os.path.join(folder, f"w{n}.webp"), quality=78)
    print("works: 6 张")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    BG = make_bg()
    BG.resize((W, H), Image.LANCZOS).save(os.path.join(OUT, "bg.webp"), quality=80)
    save_seq("gaze", gaze_frame, GAZE_N)
    save_seq("t1", tween("hero", "about"), 72)
    save_seq("t2", tween("about", "folder"), 72)
    save_seq("t3", tween("folder", "works"), 60)
    save_seq("t4", tween("outro_start", "outro"), 72)
    works_covers()
