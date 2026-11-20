// 手绘装饰层：涂鸦（进场时一笔画出来，之后像手绘动画一样微微"沸腾"抖动）、
// 颜料色块（边缘缓慢变形，带飞溅点）、手写注释、对话气泡。
// 全部由 site.config.js 里各版块的 decor 数组决定，位置用版块宽高的百分比。

// 涂鸦路径都画在 100×100 的格子里，描边绘制；fill:true 的会填色
export const DOODLES = {
  star: 'M50 7 L61 37 L93 38 L68 58 L77 91 L50 72 L23 91 L32 58 L7 38 L39 37 Z',
  sparkle: 'M50 4 C53 36 64 47 96 50 C64 53 53 64 50 96 C47 64 36 53 4 50 C36 47 47 36 50 4 Z',
  crown: 'M12 78 L8 30 L33 52 L50 16 L67 52 L92 30 L88 78 Z M14 90 L86 90',
  bolt: 'M60 3 L20 55 L47 55 L37 97 L82 38 L54 38 Z',
  squiggle: 'M3 55 C11 25 21 25 27 52 C33 80 45 80 51 52 C57 25 69 25 75 52 C81 80 92 78 97 50',
  zigzag: 'M3 62 L18 34 L33 62 L48 34 L63 62 L78 34 L95 62',
  loop: 'M3 72 C28 74 40 22 26 18 C12 14 18 72 50 72 C82 72 90 20 74 18 C58 16 66 74 97 70',
  arrow: 'M14 12 C10 52 36 82 82 80 M64 66 L83 80 L66 94',
  smiley: 'M50 9 C76 9 92 27 91 51 C90 76 72 92 49 91 C24 90 8 72 9 49 C10 25 26 9 50 9 Z M36 38 L36 46 M64 38 L64 46 M30 60 C40 76 62 76 71 59',
  heart: 'M50 86 C20 63 7 46 17 28 C27 11 46 17 50 33 C54 17 73 11 83 28 C93 46 80 63 50 86 Z',
  spiral: 'M52 50 C52 44 61 44 61 52 C61 61 45 63 43 52 C41 39 63 33 69 48 C75 64 57 78 41 71 C23 64 24 35 42 27 C60 19 84 30 86 52',
  rays: 'M24 26 L36 44 M50 12 L51 38 M77 25 L64 44',
  dash: 'M12 30 L44 38 M8 52 L40 54 M12 74 L44 66',
  circle: 'M70 12 C40 4 6 20 7 48 C8 78 46 94 76 84 C98 76 99 40 82 24 C70 12 52 10 40 14',
  underline: 'M4 62 C30 50 66 44 96 48 M14 76 C40 66 70 62 92 64',
  plus: 'M50 14 L50 86 M14 50 L86 50',
};

// 手绘"沸腾"滤镜：三组不同噪点轮流切换，线条像逐帧手绘一样微微抖动
export const BOIL_SVG = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
${[1, 2, 3].map((s) => `<filter id="boil${s - 1}"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="1" seed="${s * 7}"/><feDisplacementMap in="SourceGraphic" scale="3.2"/></filter>`).join('')}
</defs></svg>`;

const COLOR = (c = 'fg') => (c.startsWith('#') ? c : `var(--${c})`);
const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// 一个版块的装饰层 HTML
export function decorHTML(items = []) {
  if (!items.length) return '';
  return `<div class="decor" aria-hidden="true">${items.map((d, i) => {
    // 手机竖屏：m: { x, y } 单独指定位置；mobile: false 在手机上隐藏
    const m = d.m ? `;--mx:${d.m.x ?? d.x}%;--my:${d.m.y ?? d.y}%` : '';
    const pos = `left:${d.x}%;top:${d.y}%;--rot:${d.rot || 0}deg;--c:${COLOR(d.color)};--i:${i}${m}${d.mobile === false ? ';--hide-m:1' : ''}`;
    if (d.type === 'blob') {
      return `<svg class="blob" viewBox="-60 -60 120 120" style="${pos};width:${d.size || 24}vw" data-seed="${d.seed ?? i + 1}">
        <path fill="${COLOR(d.color)}"/>${d.splat === false ? '' : '<g class="splat"></g>'}</svg>`;
    }
    if (d.type === 'img') { // 贴纸：抠好透明底的小卡通角色 / 手绘配饰（scripts/cutout.py）
      return `<img class="sticker${d.still ? ' still' : ''}" src="${esc(d.src)}" alt="" style="${pos};width:${d.size || 120}px">`;
    }
    if (d.type === 'note') {
      return `<span class="note" style="${pos};font-size:${d.size || 22}px">${esc(d.text).replace(/\n/g, '<br>')}</span>`;
    }
    const path = DOODLES[d.type];
    if (!path) return '';
    const sw = (360 / (d.size || 44)).toFixed(2); // 不管涂鸦多大，线宽都约 3.6px，像同一支马克笔
    return `<svg class="doodle${d.fill ? ' fill' : ''}${d.still ? ' still' : ''}" viewBox="0 0 100 100" style="${pos};width:${d.size || 44}px;--sw:${sw}">
      <path d="${path}" pathLength="1"/></svg>`;
  }).join('')}</div>`;
}

// 颜料色块：N 个控制点的半径随时间起伏，用 Catmull-Rom 连成光滑闭合曲线
function rng(seed) { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }
function blobPath(base, t, phase) {
  const n = base.length, pts = base.map((r, i) => {
    const a = (i / n) * Math.PI * 2;
    const rr = 50 * r * (1 + 0.06 * Math.sin(t * 0.7 + i * 1.7 + phase) + 0.04 * Math.sin(t * 1.3 + i * 2.9));
    return [Math.cos(a) * rr, Math.sin(a) * rr];
  });
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}

export function setupDecor() {
  const blobs = [...document.querySelectorAll('.blob')].map((svg) => {
    const r = rng(+svg.dataset.seed);
    const base = Array.from({ length: 9 }, () => 0.78 + r() * 0.3);
    const g = svg.querySelector('.splat');
    if (g) { // 几颗飞溅的小颜料点
      g.innerHTML = Array.from({ length: 4 }, () => {
        const a = r() * Math.PI * 2, d = 52 + r() * 8;
        return `<circle cx="${(Math.cos(a) * d).toFixed(1)}" cy="${(Math.sin(a) * d).toFixed(1)}" r="${(1.5 + r() * 3).toFixed(1)}" fill="currentColor"/>`;
      }).join('');
      svg.style.color = svg.querySelector('path').getAttribute('fill');
    }
    return { svg, path: svg.querySelector('path'), base, phase: r() * 6, visible: true };
  });
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    const b = blobs.find((x) => x.svg === e.target); if (b) b.visible = e.isIntersecting;
  }));
  blobs.forEach((b) => io.observe(b.svg));

  // 涂鸦随所在版块进入视口时"画出来"
  const io2 = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('in')), { threshold: 0.15 });
  document.querySelectorAll('.decor').forEach((el) => io2.observe(el));

  return (t) => blobs.forEach((b) => b.visible && b.path.setAttribute('d', blobPath(b.base, t, b.phase)));
}

// 对话气泡：跟着角色头部走，只在首屏出现；文字轮播，悬停按钮时换成提示语
export function setupBubble(site, stage) {
  const cfg = site.sections.hero?.bubble;
  if (!cfg) return () => {};
  const el = document.createElement('div');
  el.className = 'bubble';
  el.innerHTML = '<span></span>';
  document.body.appendChild(el);
  const span = el.querySelector('span');
  const lines = cfg.lines || [];
  let idx = -1, hold = '', timer = 0;
  const show = (txt) => {
    span.innerHTML = esc(txt).replace(/\n/g, '<br>');
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  };
  const next = () => { if (hold) return; idx = (idx + 1) % lines.length; show(lines[idx]); };
  document.querySelectorAll('.sec-hero .btn').forEach((b) => {
    b.addEventListener('pointerenter', () => { if (cfg.hover) { hold = cfg.hover; show(hold); } });
    b.addEventListener('pointerleave', () => { if (hold) { hold = ''; idx = Math.max(0, idx - 1); next(); } });
  });
  return (t, ready) => {
    const on = ready && stage.gaze.active && scrollY < innerHeight * 0.12;
    el.classList.toggle('on', on);
    if (on && (idx < 0 || t - timer > (cfg.every || 4.5))) { timer = t; next(); }
    const h = stage.headScreen();
    if (stage.portrait) { // 手机竖屏：放在头顶正上方偏右，避开页头
      const bw = span.offsetWidth, bh = span.offsetHeight;
      el.style.transform = `translate3d(${Math.min(innerWidth - bw - 12, Math.max(12, h.x - bw * 0.15))}px, ${Math.max(64, h.y - innerHeight * 0.13 - bh)}px, 0)`;
      return;
    }
    const o = cfg.offset || { x: -0.16, y: -0.2 };
    el.classList.toggle('flip', o.x > 0); // 气泡在头右边时，尾巴改到左下角指向头
    el.style.transform = `translate3d(${h.x + o.x * innerWidth}px, ${h.y + o.y * innerHeight}px, 0)`;
  };
}
