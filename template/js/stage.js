// 人物舞台：决定每一帧该画什么——首屏是追视，段落之间是滚动驱动的衔接片段，
// 衔接播完就停在最后一帧，直到下一段进入。换来源时做一次短溶解，避免跳帧。

import { Clip } from './clip.js';
import { Gaze } from './gaze.js';
import { createRipple } from './ripple.js';

export class Stage {
  constructor(canvas, cfg) {
    this.cfg = cfg;
    this.view = canvas;
    this.buf = document.createElement('canvas'); // 先在 2D 画布上合成，再交给水波或直接显示
    this.ctx = this.buf.getContext('2d');
    this.gaze = new Gaze(cfg.gaze);
    this.gaze.onJump = () => this.fadeFrom(0.16);
    this.transitions = (cfg.transitions || []).map((t) => ({ ...t, clip: new Clip(t) }));
    this.bg = new Image();
    if (cfg.background) this.bg.src = cfg.background;
    this.prev = document.createElement('canvas');
    this.fade = 0; this.fadeDur = 0.2;
    this.lastKey = 'gaze';
    this.ripple = cfg.ripple?.enabled ? createRipple(canvas, cfg.ripple) : null;
    if (!this.ripple) this.vctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.ranges = [];
    this.resize();
  }

  // 预加载：追视和第一段衔接优先（影响首屏），其余在后台慢慢加载
  preload(onProgress) {
    const critical = [this.gaze.clip, this.transitions[0]?.clip].filter(Boolean);
    const prog = new Array(critical.length).fill(0);
    const report = () => onProgress?.(prog.reduce((a, b) => a + b, 0) / critical.length);
    const ready = Promise.all(critical.map((c, i) => c.load((p) => { prog[i] = p; report(); })));
    ready.then(() => this.transitions.slice(1).forEach((t) => t.clip.load()));
    return ready;
  }

  resize() {
    const w = Math.round(innerWidth * this.dpr), h = Math.round(innerHeight * this.dpr);
    for (const c of [this.buf, this.prev]) { c.width = w; c.height = h; }
    this.portrait = innerWidth / innerHeight < 0.85 && this.cfg.portraitZoom !== 0;
    if (this.ripple) this.ripple.resize(w, h); else { this.view.width = w; this.view.height = h; }
    const norm = document.createElement('canvas').getContext('2d'); // 统一成 #rrggbb，方便拼透明度
    norm.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#000';
    this.bgColor = norm.fillStyle;
    this.measure();
  }

  // 记下每段衔接在页面上的滚动区间：to 段从屏幕底进入到顶部对齐
  measure() {
    const vh = innerHeight;
    this.ranges = this.transitions.map((t) => {
      const el = document.getElementById(t.to);
      const top = el ? el.getBoundingClientRect().top + scrollY : 0;
      const span = vh * (t.span ?? 0.85);
      return { t, start: top - span, end: top };
    });
  }

  // 横屏：画面"cover"铺满。竖屏（手机）：放大后让人物头部落在屏幕上部 portraitHeadY 处，
  // 文字排在下半屏；画面下缘渐隐到底色（背景是纯色时完全看不出接缝）
  cover(img) {
    const W = this.buf.width, H = this.buf.height;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const fx = this.cfg.focusX ?? 0.5;
    if (this.portrait) {
      const s = (W / iw) * (this.cfg.portraitZoom ?? 1.7);
      const dw = iw * s, dh = ih * s;
      const dx = Math.min(0, Math.max(W - dw, W / 2 - fx * dw));
      const dy = H * (this.cfg.portraitHeadY ?? 0.27) - (this.cfg.gaze.head?.y ?? 0.4) * dh;
      return { s, dx, dy, dw, dh };
    }
    const s = Math.max(W / iw, H / ih);
    const dw = iw * s, dh = ih * s;
    const dx = Math.min(0, Math.max(W - dw, W / 2 - fx * dw));
    return { s, dx, dy: (H - dh) / 2, dw, dh };
  }

  // 屏幕坐标 → 画面坐标（0–1）的反变换，用于算鼠标相对头部的方向
  toImage(px, py) {
    const img = this.gaze.image();
    if (!img) return null;
    const { dx, dy, dw, dh } = this.cover(img);
    return { x: (px * this.dpr - dx) / dw, y: (py * this.dpr - dy) / dh };
  }

  headScreen() {
    const img = this.gaze.image();
    if (!img) return { x: innerWidth * 0.6, y: innerHeight * 0.4 };
    const { dx, dy, dw, dh } = this.cover(img);
    const h = this.cfg.gaze.head;
    return { x: (dx + h.x * dw) / this.dpr, y: (dy + h.y * dh) / this.dpr };
  }

  pointer(px, py, now) {
    const head = this.headScreen();
    const r = (this.cfg.gaze.radius ?? 0.3) * Math.min(innerWidth, innerHeight);
    this.gaze.setPointer((px - head.x) / r, (py - head.y) / r, now);
    if (this.ripple) {
      // 按鼠标速度（屏幕宽高/秒）注入：慢慢移只有细纹，甩得快才明显
      const lp = this.lastPt, t = performance.now();
      if (lp && t > lp.t) {
        const dt = Math.max(0.008, (t - lp.t) / 1000);
        this.ripple.move(px / innerWidth, py / innerHeight, (px - lp.x) / innerWidth / dt, (py - lp.y) / innerHeight / dt);
      }
      this.lastPt = { x: px, y: py, t };
    }
  }

  click(px, py) {
    if (this.ripple) this.ripple.click(px / innerWidth, py / innerHeight);
  }

  fadeFrom(dur = 0.2) {
    const p = this.prev.getContext('2d');
    p.clearRect(0, 0, this.prev.width, this.prev.height);
    p.drawImage(this.buf, 0, 0);
    this.fade = 1; this.fadeDur = dur;
  }

  // 当前滚动位置该显示哪一帧
  pick() {
    const y = scrollY;
    let cur = null;
    for (const r of this.ranges) if (y >= r.start) cur = r;
    if (!cur) return { key: 'gaze', img: this.gaze.image(), gaze: true };
    const p = Math.min(1, Math.max(0, (y - cur.start) / (cur.end - cur.start)));
    const k = p * p * (3 - 2 * p) * 0.35 + p * 0.65; // 起止略缓，中段跟手
    const f = k * (cur.t.count - 1);
    // blend：相邻两帧按小数部分叠化。只有几张姿态图（没有视频）时用它
    if (cur.t.blend) return { key: cur.t.to, img: cur.t.clip.frame(Math.floor(f)), img2: cur.t.clip.frame(Math.ceil(f)), a: f % 1, gaze: false };
    return { key: cur.t.to, img: cur.t.clip.frame(f), gaze: false };
  }

  tick(dt, now) {
    const shot = this.pick();
    this.gaze.active = shot.gaze;
    if (shot.gaze) this.gaze.update(dt, now); else this.gaze.reset();
    if (shot.key !== this.lastKey) { this.fadeFrom(0.22); this.lastKey = shot.key; }

    const c = this.ctx, W = this.buf.width, H = this.buf.height;
    c.fillStyle = this.bgColor;
    c.fillRect(0, 0, W, H);
    const base = shot.img || (this.bg.complete && this.bg.naturalWidth ? this.bg : null);
    if (base) { const t = this.cover(base); c.drawImage(base, t.dx, t.dy, t.dw, t.dh); }
    if (shot.img2 && shot.a > 0.001 && shot.img2 !== shot.img) {
      const t = this.cover(shot.img2);
      c.globalAlpha = shot.a; c.drawImage(shot.img2, t.dx, t.dy, t.dw, t.dh); c.globalAlpha = 1;
    }
    if (this.portrait && base) { // 竖屏：画面下缘渐隐
      const t = this.cover(base), y0 = t.dy + t.dh * 0.72, y1 = t.dy + t.dh;
      const g = c.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, this.bgColor + '00'); g.addColorStop(1, this.bgColor);
      c.fillStyle = g; c.fillRect(0, y0, W, y1 - y0);
      c.fillStyle = this.bgColor; c.fillRect(0, y1 - 1, W, H - y1 + 1);
    }
    if (this.fade > 0) {
      c.globalAlpha = this.fade; c.drawImage(this.prev, 0, 0); c.globalAlpha = 1;
      this.fade = Math.max(0, this.fade - dt / this.fadeDur);
    }
    if (this.ripple) this.ripple.render(this.buf);
    else { this.vctx.clearRect(0, 0, W, H); this.vctx.drawImage(this.buf, 0, 0); }
  }
}
