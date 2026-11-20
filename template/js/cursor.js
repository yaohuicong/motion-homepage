// 自定义光标：小圆点 + 磁吸按钮 + 点击扩散环；没有 WebGL 水波时再画一条 2D 拖尾。

export function setupCursor(site, hasRipple) {
  const fine = matchMedia('(pointer: fine)').matches;
  const dot = document.getElementById('cursor');
  const fx = document.getElementById('fx');
  const ctx = fx.getContext('2d');
  const cfg = site.cursor || {};
  const trailOn = cfg.trail === true || (cfg.trail === 'auto' && !hasRipple);
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const pts = [], rings = [];
  let mx = -100, my = -100, cx = -100, cy = -100;

  const resize = () => { fx.width = innerWidth * dpr; fx.height = innerHeight * dpr; };
  resize(); addEventListener('resize', resize);
  if (fine && cfg.dot !== false) document.body.classList.add('has-cursor');

  addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; if (trailOn) pts.push({ x: mx, y: my, t: performance.now() }); });
  addEventListener('pointerdown', (e) => rings.push({ x: e.clientX, y: e.clientY, t: performance.now() }));

  // 磁吸：按钮被光标轻轻吸过去
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.translate = `${(e.clientX - r.left - r.width / 2) * 0.25}px ${(e.clientY - r.top - r.height / 2) * 0.3}px`;
    });
    el.addEventListener('pointerleave', () => (el.style.translate = ''));
    el.addEventListener('pointerenter', () => dot.classList.add('hover'));
    el.addEventListener('pointerleave', () => dot.classList.remove('hover'));
  });

  return function tick() {
    cx += (mx - cx) * 0.35; cy += (my - cy) * 0.35;
    dot.style.transform = `translate3d(${cx}px,${cy}px,0)`;
    const now = performance.now();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    while (pts.length && now - pts[0].t > 420) pts.shift();
    if (pts.length > 1) {
      ctx.lineCap = 'round';
      for (let i = 1; i < pts.length; i++) {
        const a = 1 - (now - pts[i].t) / 420;
        ctx.strokeStyle = accent; ctx.globalAlpha = a * 0.6; ctx.lineWidth = 1 + a * 5;
        ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
      }
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const k = (now - rings[i].t) / 700;
      if (k >= 1) { rings.splice(i, 1); continue; }
      const e = 1 - (1 - k) ** 3;
      ctx.globalAlpha = (1 - k) * 0.8; ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(rings[i].x, rings[i].y, 6 + e * 70, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
}
