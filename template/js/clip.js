// 帧序列：把视频拆成图片逐帧画在画布上。比直接拖 <video>.currentTime 稳定，
// 滚动和追视都能瞬间跳到任意一帧，不会卡在关键帧上。

//
// map（可选）：时间轴第 i 帧用第 map[i] 个文件（从 0 数）。追视"星形"素材用它：
// 转向某方向的帧只存一份，回正时倒着复用，文件量减半（frames.py gaze-star 会生成 map）。
export class Clip {
  constructor({ src, count, start = 1, pad = 4, map = null }) {
    this.map = map;
    this.count = map ? map.length : count;
    const files = map ? Math.max(...map) + 1 : count;
    this.urls = Array.from({ length: files }, (_, i) => src.replace('{n}', String(start + i).padStart(pad, '0')));
    this.frames = new Array(files).fill(null);
    this.loaded = 0;
    this.started = false;
  }

  // 先隔帧加载（很快就能整体可用），再补齐中间帧
  load(onProgress) {
    if (this.started) return this.ready;
    this.started = true;
    const order = [];
    const files = this.urls.length;
    for (let step = 8; step >= 1; step = step >> 1) {
      for (let i = 0; i < files; i += step) if (!order.includes(i)) order.push(i);
    }
    let firstPass = Math.ceil(files / 8);
    this.ready = new Promise((resolve) => {
      let done = 0;
      const next = () => {
        const i = order.shift();
        if (i === undefined) return;
        const img = new Image();
        img.decoding = 'async';
        img.onload = img.onerror = () => {
          if (img.naturalWidth) { this.frames[i] = img; this.loaded++; }
          done++;
          onProgress?.(done / files);
          if (done === firstPass) resolve(this);
          if (done === files) resolve(this);
          next();
        };
        img.src = this.urls[i];
      };
      for (let k = 0; k < 6; k++) next(); // 6 路并发
    });
    return this.ready;
  }

  // 取第 i 帧；还没加载到就用最近的已加载帧
  frame(i) {
    i = Math.max(0, Math.min(this.count - 1, Math.round(i)));
    if (this.map) i = this.map[i];
    if (this.frames[i]) return this.frames[i];
    for (let d = 1; d < this.frames.length; d++) {
      if (this.frames[i - d]) return this.frames[i - d];
      if (this.frames[i + d]) return this.frames[i + d];
    }
    return null;
  }
}
