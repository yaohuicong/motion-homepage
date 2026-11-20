#!/usr/bin/env python3
"""把纯色背景上的卡通贴纸抠成透明底 webp（小卡通角色、手绘配饰、贴纸用）。

出图时背景用品红 #FF00FF：和角色常用颜色都差得远，抠得干净。深色背景会把深色衣服、描边一起抠掉。

原理：从图片四边向内"泛洪"，和背景色足够接近的连通像素变透明；角色有粗黑描边或白色贴纸边时，
描边把内部和背景隔开，内部的同色区域不会被误抠。边缘一圈按"离背景色多远"算半透明，
并把混进来的背景色（品红溢色）减掉，避免贴到深色网页上出现一圈粉边。

用法：
  python3 cutout.py <输入图> <输出.webp> [--tol 38] [--bg #ff00ff] [--size 512]
  python3 cutout.py <贴纸合集图> <输出目录> --split [--min-area 0.004] [--join 0.04]
      --split：一张图里有多枚贴纸时，按互不相连的块拆开，输出 01.webp、02.webp…（从左到右、从上到下）；
               贴纸旁边的小碎块（颜料点、闪光）会并进离它最近的那枚
  --bg 不写时取四角平均色；--size 为输出长边像素
需要 Pillow：pip install pillow
"""
import argparse
import os
from collections import deque

from PIL import Image, ImageFilter


def parse_hex(s):
    s = s.lstrip("#")
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def key_out(im, bg, tol):
    """泛洪抠背景 + 边缘去溢色。返回 RGBA 图（原地修改）。"""
    w, h = im.size
    px = im.load()
    tol2 = tol ** 2
    d2 = lambda c: (c[0] - bg[0]) ** 2 + (c[1] - bg[1]) ** 2 + (c[2] - bg[2]) ** 2

    removed = Image.new("L", (w, h), 0)
    rp = removed.load()
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        if d2(px[x, y]) > tol2:
            continue
        px[x, y] = (0, 0, 0, 0)
        rp[x, y] = 255
        if x > 0: q.append((x - 1, y))
        if x < w - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < h - 1: q.append((x, y + 1))

    # 紧贴背景的一圈（约 3 像素）是前景色和背景色的混合：
    # 取最近的内部像素当前景色 f，按 c 在 bg→f 连线上的位置算透明度，颜色直接用 f，去掉品红溢色
    band = removed.filter(ImageFilter.MaxFilter(7))
    bp = band.load()
    inner = lambda x, y: 0 <= x < w and 0 <= y < h and not bp[x, y]
    for y in range(h):
        for x in range(w):
            if not bp[x, y] or rp[x, y]:
                continue
            c = px[x, y]
            f = None
            for r in range(1, 6):
                ring = [px[i, j] for i in range(x - r, x + r + 1) for j in (y - r, y + r) if inner(i, j)]
                ring += [px[i, j] for j in range(y - r + 1, y + r) for i in (x - r, x + r) if inner(i, j)]
                if ring:
                    f = tuple(sum(p[k] for p in ring) / len(ring) for k in range(3))
                    break
            a = None
            if f is not None:
                fb = [f[k] - bg[k] for k in range(3)]
                n2 = sum(v * v for v in fb)
                if n2 < 400:  # 前景和背景太像，分不出来，保持不透明
                    continue
                t = sum((c[k] - bg[k]) * fb[k] for k in range(3)) / n2
                res = sum((c[k] - bg[k] - t * fb[k]) ** 2 for k in range(3)) ** 0.5
                if res < 45:  # c 落在 bg→f 连线上，才认它是两者的混合
                    a = min(1.0, max(0.0, t))
            if a is None:
                # 否则沿 bg→c 方向延长到颜色立方体边缘，当作前景色（适合白边、黑描边、纯色涂鸦）
                d = [c[k] - bg[k] for k in range(3)]
                ts = [(255 - bg[k]) / d[k] if d[k] > 0 else bg[k] / -d[k] for k in range(3) if d[k]]
                if not ts:
                    px[x, y] = (0, 0, 0, 0)
                    continue
                t = max(1.0, min(ts))
                a = 1 / t
                f = [bg[k] + d[k] * t for k in range(3)]
            if a <= 0.03:
                px[x, y] = (0, 0, 0, 0)
            else:
                px[x, y] = (*(round(v) for v in f[:3]), round(255 * a))
    alpha = im.getchannel("A").filter(ImageFilter.GaussianBlur(0.5))
    im.putalpha(alpha)
    return im


def save(im, box, out, size, pad=10, keep=None):
    """裁出 box；keep=(标签图, 宽, 缩放, 本组标签) 时，把框里别的贴纸的像素清掉。"""
    w, h = im.size
    x0, y0 = max(0, box[0] - pad), max(0, box[1] - pad)
    part = im.crop((x0, y0, min(w, box[2] + pad), min(h, box[3] + pad)))
    if keep:
        lab, mw, s, mine = keep
        pp = part.load()
        for y in range(part.size[1]):
            row = ((y0 + y) // s) * mw
            for x in range(part.size[0]):
                l = lab[row + (x0 + x) // s]
                if l and l not in mine:
                    pp[x, y] = (0, 0, 0, 0)
    part.thumbnail((size, size), Image.LANCZOS)
    part.save(out, "WEBP", quality=88, method=5)
    return part.size


def components(alpha, min_frac, join):
    """在缩小 4 倍的不透明蒙版上找互不相连的块。
    大块各成一枚贴纸；小块（颜料点、闪光）并进离它最近的大块，离得太远才丢掉。
    返回 [(原图坐标包围盒, 标签集合)]（按行、再按列排序）和标签图。"""
    w, h = alpha.size
    s = 4
    # 先把蒙版收缩几像素，让贴纸边刚好碰在一起的两枚分开；再 reduce 缩小（块里过半不透明才算占用）。
    # 不用 resize NEAREST：部分 Pillow 版本对 L 图会报错
    m = alpha.point(lambda v: 255 if v > 128 else 0).filter(ImageFilter.MinFilter(7))
    m = m.reduce(s).point(lambda v: 255 if v > 127 else 0)
    mw, mh = m.size
    mp = m.load()
    lab = [0] * (mw * mh)
    comps = []
    for y0 in range(mh):
        for x0 in range(mw):
            if not mp[x0, y0] or lab[y0 * mw + x0]:
                continue
            n = len(comps) + 1
            q = deque([(x0, y0)]); lab[y0 * mw + x0] = n
            bx0, by0, bx1, by1, cnt = x0, y0, x0, y0, 0
            while q:
                x, y = q.popleft(); cnt += 1
                bx0, by0, bx1, by1 = min(bx0, x), min(by0, y), max(bx1, x), max(by1, y)
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < mw and 0 <= ny < mh and mp[nx, ny] and not lab[ny * mw + nx]:
                        lab[ny * mw + nx] = n; q.append((nx, ny))
            comps.append({"n": n, "cnt": cnt, "box": [bx0, by0, bx1 + 1, by1 + 1]})
    big = [c for c in comps if c["cnt"] >= min_frac * mw * mh]
    for c in big:
        c["labels"] = {c["n"]}
    gap = lambda a, b: max(0, a[0] - b[2], b[0] - a[2]) + max(0, a[1] - b[3], b[1] - a[3])
    for c in comps:
        if c in big or not big:
            continue
        near = min(big, key=lambda b: gap(c["box"], b["box"]))
        if gap(c["box"], near["box"]) <= join * mw:
            bb, cb = near["box"], c["box"]
            near["box"] = [min(bb[0], cb[0]), min(bb[1], cb[1]), max(bb[2], cb[2]), max(bb[3], cb[3])]
            near["labels"].add(c["n"])
    # 先按行分组（中心 y 相差超过上一枚高度一半算新的一行），行内从左到右
    cy = lambda c: (c["box"][1] + c["box"][3]) / 2
    big.sort(key=cy)
    rows, cur = [], []
    for c in big:
        if cur and cy(c) - cy(cur[-1]) > (cur[-1]["box"][3] - cur[-1]["box"][1]) / 2:
            rows.append(cur); cur = []
        cur.append(c)
    if cur:
        rows.append(cur)
    groups = [([v * s for v in c["box"]], c["labels"]) for r in rows for c in sorted(r, key=lambda c: c["box"][0])]
    # 收缩时被削掉的贴纸边归给最近的那一枚（向外扩 3 格，先到先得），裁图时才能把邻居的白边清干净
    q = deque((i, 0) for i, l in enumerate(lab) if l)
    while q:
        i, d = q.popleft()
        if d >= 3:
            continue
        x, y = i % mw, i // mw
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            j = ny * mw + nx
            if 0 <= nx < mw and 0 <= ny < mh and not lab[j]:
                lab[j] = lab[i]; q.append((j, d + 1))
    return groups, lab, mw, s


def main():
    p = argparse.ArgumentParser()
    p.add_argument("src"); p.add_argument("out")
    p.add_argument("--tol", type=float, default=38, help="与背景色的距离阈值（0–441）")
    p.add_argument("--bg", default=None)
    p.add_argument("--size", type=int, default=512)
    p.add_argument("--split", action="store_true", help="一张图里多枚贴纸时拆开输出到目录")
    p.add_argument("--min-area", type=float, default=0.004, help="--split 时小于整图这个比例的算碎块（颜料点、闪光）")
    p.add_argument("--join", type=float, default=0.04, help="--split 时碎块离最近贴纸不超过整图宽度的这个比例就并进去，否则丢掉")
    a = p.parse_args()

    im = Image.open(a.src).convert("RGBA")
    im.thumbnail((1400, 1400))
    w, h = im.size
    px = im.load()
    if a.bg:
        bg = parse_hex(a.bg)
    else:
        cs = [px[x, y] for x, y in [(2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3)]]
        bg = tuple(sum(c[i] for c in cs) // 4 for i in range(3))
    key_out(im, bg, a.tol)
    alpha = im.getchannel("A")
    bgs = "#%02x%02x%02x" % bg

    if a.split:
        os.makedirs(a.out, exist_ok=True)
        groups, lab, mw, s = components(alpha, a.min_area, a.join)
        for i, (box, mine) in enumerate(groups, 1):
            out = os.path.join(a.out, f"{i:02d}.webp")
            sz = save(im, box, out, a.size, keep=(lab, mw, s, mine))
            print(f"{out}: {sz[0]}×{sz[1]}")
        print(f"共 {len(groups)} 枚，背景色 {bgs}")
        return

    box = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()
    sz = save(im, box or (0, 0, w, h), a.out, a.size)
    print(f"{a.out}: {sz[0]}×{sz[1]}，背景色 {bgs}")


if __name__ == "__main__":
    main()
