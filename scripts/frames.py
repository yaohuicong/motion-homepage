#!/usr/bin/env python3
"""把 AI 生成的视频/图片整理成网页用的帧序列（只依赖 ffmpeg；装了 Pillow 会顺便报背景色）。

子命令
  extract   <视频> <输出目录>                    一段视频 → 0001.webp…（衔接片段、单条追视视频都用它）
  gaze-join <输出目录> <段1> <段2> …            追视分段视频首尾相接 → 帧序列 + 自动算好的 keys
  images    <输出目录> <图1> <图2> …            几张静态图 → 帧序列（没有视频模型时的追视九宫格/姿态图）
  gaze-star <输出目录> L=左.mp4 UL=左上.mp4 …   只能传首帧的视频工具：8 条"从正面转向某方向"的短视频 → 追视帧序列。
            每条只取前 --turn 秒（转头过程）；某条转得慢可单独写 R=右.mp4@2.2，回正时倒放复用同一批帧（配置里的 map），所有方向在正面帧处衔接

公共参数  --fps 24  --width 1280  --quality 78
gaze-join 额外参数  --order C,L,UL,U,UR,R,DR,D,DL,L,C   每段视频首尾对应的方向，段数 = 方向数 - 1
gaze-star 额外参数  --turn 1.6   每条视频取前几秒（转到位、表情做出来为止）

输出最后会打印一段可直接粘进 site.config.js 的配置。
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile

DIRS = {"C": (0, 0), "L": (-1, 0), "UL": (-0.7, -0.7), "U": (0, -1), "UR": (0.7, -0.7),
        "R": (1, 0), "DR": (0.7, 0.7), "D": (0, 1), "DL": (-0.7, 0.7)}


def ffmpeg_frames(src, out, fps, width, quality, still=False):
    vf = f"scale={width}:-2:flags=lanczos" if still else f"fps={fps},scale={width}:-2:flags=lanczos"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", vf, "-c:v", "libwebp",
                    "-quality", str(quality), "-compression_level", "4", os.path.join(out, "%04d.webp")], check=True)
    return sorted(f for f in os.listdir(out) if f.endswith(".webp"))


def fresh(out):
    os.makedirs(out, exist_ok=True)
    for f in os.listdir(out):
        if f.endswith(".webp"):
            os.remove(os.path.join(out, f))


def report(out, n, extra=""):
    size = sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out)) / 1e6
    color = ""
    try:
        from PIL import Image
        im = Image.open(os.path.join(out, "0001.webp")).convert("RGB")
        w, h = im.size
        px = [im.getpixel((x, y)) for x, y in [(4, 4), (w - 5, 4), (4, h - 5), (w - 5, h - 5)]]
        avg = tuple(sum(p[i] for p in px) // 4 for i in range(3))
        color = "  四角平均色 #%02x%02x%02x（可作 theme.bg）" % avg
    except Exception:
        pass
    print(f"{out}: {n} 帧, {size:.1f} MB{color}")
    rel = out.replace(os.sep, "/")
    print(f"配置：{{ src: '{rel}/{{n}}.webp', count: {n}{extra} }}")


def cmd_extract(a):
    fresh(a.out)
    n = len(ffmpeg_frames(a.video, a.out, a.fps, a.width, a.quality))
    report(a.out, n)


def cmd_gaze_join(a):
    order = a.order.split(",")
    if len(order) != len(a.segments) + 1:
        sys.exit(f"--order 有 {len(order)} 个方向，应比分段数（{len(a.segments)}）多 1")
    fresh(a.out)
    keys, idx = [], 0
    with tempfile.TemporaryDirectory() as tmp:
        for si, seg in enumerate(a.segments):
            d = os.path.join(tmp, str(si))
            os.makedirs(d)
            frames = ffmpeg_frames(seg, d, a.fps, a.width, a.quality)
            if si > 0:
                frames = frames[1:]  # 段首 = 上一段段尾，去掉重复帧
            if si == 0:
                keys.append({"f": 0, **dict(zip("xy", DIRS[order[0]]))})
            for f in frames:
                idx += 1
                shutil.move(os.path.join(d, f), os.path.join(a.out, f"{idx:04d}.webp"))
            keys.append({"f": idx - 1, **dict(zip("xy", DIRS[order[si + 1]]))})
    report(a.out, idx, ", keys: " + json.dumps(keys, ensure_ascii=False))


def cmd_images(a):
    fresh(a.out)
    for i, img in enumerate(a.images, 1):
        with tempfile.TemporaryDirectory() as tmp:
            ffmpeg_frames(img, tmp, a.fps, a.width, a.quality, still=True)
            shutil.move(os.path.join(tmp, "0001.webp"), os.path.join(a.out, f"{i:04d}.webp"))
    report(a.out, len(a.images))


def cmd_gaze_star(a):
    ring = ["L", "UL", "U", "UR", "R", "DR", "D", "DL"]
    clips = dict(x.split("=", 1) for x in a.clips)
    dirs = [d for d in ring if d in clips]
    if len(dirs) < len(clips):
        sys.exit(f"方向只能是 {','.join(ring)}")
    fresh(a.out)
    files, mp, keys = 0, [], []
    with tempfile.TemporaryDirectory() as tmp:
        for di, d in enumerate(dirs):
            t = os.path.join(tmp, d); os.makedirs(t)
            path, turn = (clips[d].rsplit("@", 1) + [a.turn])[:2] if "@" in clips[d] else (clips[d], a.turn)
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-t", str(turn), "-i", path, "-vf",
                            f"fps={a.fps},scale={a.width}:-2:flags=lanczos", "-c:v", "libwebp", "-quality", str(a.quality),
                            "-compression_level", "4", os.path.join(t, "%04d.webp")], check=True)
            fr = sorted(os.listdir(t))
            if di == 0:  # 正面帧：用第一条的首帧，所有方向共用
                shutil.move(os.path.join(t, fr[0]), os.path.join(a.out, "0001.webp")); files = 1
                mp.append(0); keys.append({"f": 0, "x": 0, "y": 0})
            ids = []
            for f in fr[1:]:
                files += 1
                shutil.move(os.path.join(t, f), os.path.join(a.out, f"{files:04d}.webp"))
                ids.append(files - 1)
            mp += ids                       # 正面 → 方向
            x, y = DIRS[d]
            keys.append({"f": len(mp) - 1, "x": x, "y": y})
            mp += ids[-2::-1] + [0]         # 方向 → 正面（倒放）
            keys.append({"f": len(mp) - 1, "x": 0, "y": 0})
    size = sum(os.path.getsize(os.path.join(a.out, f)) for f in os.listdir(a.out)) / 1e6
    print(f"{a.out}: {files} 个文件, 时间轴 {len(mp)} 帧, {size:.1f} MB")
    rel = a.out.replace(os.sep, "/")
    print(f"配置：{{ src: '{rel}/{{n}}.webp', map: {json.dumps(mp)}, count: {len(mp)}, loop: false, maxWalk: 9999,\n  keys: {json.dumps(keys)} }}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    def common(sp):
        sp.add_argument("--fps", type=int, default=24)
        sp.add_argument("--width", type=int, default=1280)
        sp.add_argument("--quality", type=int, default=78)

    e = sub.add_parser("extract"); e.add_argument("video"); e.add_argument("out"); common(e); e.set_defaults(fn=cmd_extract)
    g = sub.add_parser("gaze-join"); g.add_argument("out"); g.add_argument("segments", nargs="+")
    g.add_argument("--order", default="C,L,UL,U,UR,R,DR,D,DL,L,C"); common(g); g.set_defaults(fn=cmd_gaze_join)
    st = sub.add_parser("gaze-star"); st.add_argument("out"); st.add_argument("clips", nargs="+")
    st.add_argument("--turn", type=float, default=1.6); common(st); st.set_defaults(fn=cmd_gaze_star)
    i = sub.add_parser("images"); i.add_argument("out"); i.add_argument("images", nargs="+"); common(i); i.set_defaults(fn=cmd_images)
    a = p.parse_args()
    if not shutil.which("ffmpeg"):
        sys.exit("需要 ffmpeg：macOS `brew install ffmpeg`，Windows `winget install ffmpeg`，Ubuntu `sudo apt install ffmpeg`")
    a.fn(a)


if __name__ == "__main__":
    main()
