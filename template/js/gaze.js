// 鼠标追视：一段"正面→八个方向→正面"的闭环视频，按鼠标方向找到对应帧，
// 再沿时间轴逐帧走过去（走的是真实的转头中间帧，所以自然）。
// 目标太远时不逐帧绕圈，改由舞台做一次快速溶解。

import { Clip } from './clip.js';

export class Gaze {
  constructor(cfg) {
    this.cfg = cfg;
    this.clip = new Clip(cfg);
    const n = cfg.count;
    // 每一帧对应的视线向量：在关键帧之间线性插值
    const keys = [...cfg.keys].sort((a, b) => a.f - b.f);
    this.vec = Array.from({ length: n }, (_, f) => {
      let a = keys[0], b = keys[keys.length - 1];
      for (let k = 0; k < keys.length - 1; k++) if (f >= keys[k].f && f <= keys[k + 1].f) { a = keys[k]; b = keys[k + 1]; break; }
      const t = b.f === a.f ? 0 : (f - a.f) / (b.f - a.f);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    });
    this.centers = keys.filter((k) => Math.hypot(k.x, k.y) < 0.05).map((k) => k.f);
    if (!this.centers.length) this.centers = [0];
    this.cur = this.centers[0];
    this.target = this.cur;
    this.active = true;
    this.lastMove = 0;
    this.pointer = null;
    this.onJump = null; // 舞台注入：需要溶解时调用
  }

  setPointer(nx, ny, now) { // 鼠标相对头部的方向，已按 radius 归一化
    this.pointer = { x: nx, y: ny };
    this.lastMove = now;
  }

  nearestCenter(from) {
    let best = this.centers[0], bd = Infinity;
    for (const c of this.centers) { const d = Math.abs(this.walk(from, c)); if (d < bd) { bd = d; best = c; } }
    return best;
  }

  // 闭环时走最短方向
  walk(from, to) {
    let d = to - from;
    if (this.cfg.loop !== false) {
      const n = this.cfg.count - 1; // 首尾两帧都是正面，算同一点
      if (d > n / 2) d -= n;
      if (d < -n / 2) d += n;
    }
    return d;
  }

  pickTarget() {
    const c = this.cfg, now = performance.now();
    if (!this.active || !this.pointer || now - this.lastMove > (c.idleReturn ?? 3.5) * 1000) return this.nearestCenter(this.cur);
    const { x, y } = this.pointer;
    const mag = Math.hypot(x, y);
    if (mag < (c.deadzone ?? 0.16)) return this.nearestCenter(this.cur);
    // 只在"看满"的环上按角度选帧；中间幅度交给逐帧走动的过程
    const ux = x / mag, uy = y / mag;
    let best = this.cur, bs = -Infinity;
    this.vec.forEach((v, f) => {
      const m = Math.hypot(v.x, v.y);
      if (m < 0.6) return;
      const s = (v.x * ux + v.y * uy) / m - Math.abs(this.walk(this.cur, f)) * 0.0008; // 同分时选近的
      if (s > bs) { bs = s; best = f; }
    });
    return best;
  }

  update(dt, now) {
    this.target = this.pickTarget();
    let goal = this.target;
    if (this.cfg.map) goal = this.starGoal();
    const d = this.walk(this.cur, goal);
    if (Math.abs(d) > (this.cfg.maxWalk ?? 30)) {
      this.cur = this.target;
      this.onJump?.();
      return;
    }
    const speed = Math.max(this.cfg.speed ?? 90, Math.abs(d) * 8);
    const step = Math.sign(d) * Math.min(Math.abs(d), speed * dt);
    const n = this.cfg.count - 1;
    this.cur = this.cfg.loop === false ? Math.max(0, Math.min(n, this.cur + step)) : (this.cur + step + n) % n;
  }

  // 星形素材（frames.py gaze-star）：时间轴是"正面→方向A→正面→方向B→正面…"，所有正面帧是同一张图。
  // 目标在别的方向段时，先沿当前段回到最近的正面帧，再瞬移到目标段起点（画面完全一样，看不出跳），然后转过去。
  starGoal() {
    const C = this.centers, t = this.target;
    if (C.includes(t)) return t;
    let st = 0;
    while (st < C.length - 1 && !(t > C[st] && t < C[st + 1])) st++;
    const lo = C[st], hi = C[st + 1];
    if (this.cur >= lo && this.cur <= hi && !(C.includes(this.cur) && this.cur !== lo)) return t;
    if (C.includes(this.cur)) { this.cur = lo; return t; }
    let k = 0;
    while (k < C.length - 1 && !(this.cur > C[k] && this.cur < C[k + 1])) k++;
    return this.cur - C[k] < C[k + 1] - this.cur ? C[k] : C[k + 1];
  }

  reset() { this.cur = this.centers[0]; this.target = this.cur; }
  image() { return this.clip.frame(this.cur); }
}
