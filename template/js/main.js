// 入口：应用主题 → 渲染版块 → 预加载人物帧 → 启动每帧循环。

import { Stage } from './stage.js';
import { renderSections, setupReveal, setupAbout, setupFolder, setupWorks, setupOutro } from './sections.js';
import { setupCursor } from './cursor.js';
import { setupDecor, setupBubble, BOIL_SVG } from './decor.js';

const site = window.SITE;
const root = document.documentElement;

// 主题
const th = site.theme || {};
const vars = { bg: th.bg, panel: th.panel, fg: th.fg, muted: th.muted, accent: th.accent, accent2: th.accent2, accent3: th.accent3, accent4: th.accent4,
  'font-display': th.fontDisplay, 'font-body': th.fontBody, 'font-mono': th.fontMono, 'font-hand': th.fontHand };
Object.entries(vars).forEach(([k, v]) => v && root.style.setProperty(`--${k}`, v));
if (th.fontsHref) document.head.insertAdjacentHTML('beforeend', `<link rel="stylesheet" href="${th.fontsHref}">`);
document.title = site.meta?.title || document.title;
document.documentElement.lang = site.meta?.lang || 'en';
if (site.ui?.cta) document.querySelector('.header-cta').textContent = site.ui.cta;
document.querySelector('meta[name=description]').content = site.meta?.description || '';

// 版块与导航
renderSections(document.getElementById('sections'), site);
document.body.insertAdjacentHTML('afterbegin', BOIL_SVG);
const brand = site.brand || '';
document.querySelector('.brand').innerHTML = brand.endsWith('.') ? `${brand.slice(0, -1)}<i>.</i>` : brand;
const navIds = site.order.filter((id) => id !== 'hero');
document.querySelector('.site-nav').innerHTML = navIds.map((id) => `<a href="#${id}">${site.sections[id].nav}</a>`).join('');
document.querySelector('.section-index span').textContent = `/ ${String(site.order.length).padStart(2, '0')}`;

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage = new Stage(document.getElementById('stage'), site.stage);
window.__stage = stage; // 调试用：控制台里可以看 __stage.gaze.cur、__stage.ranges
const aboutTick = setupAbout(site);
const works = setupWorks(site);
setupFolder(site, (cat) => { works.filter(cat); document.getElementById('works').scrollIntoView({ behavior: 'smooth' }); });
setupOutro();
const cursorTick = setupCursor(site, !!stage.ripple);
const decorTick = setupDecor();
const bubbleTick = setupBubble(site, stage);
let ready = false;

// 预加载
const num = document.getElementById('loader-num'), bar = document.getElementById('loader-bar');
let shown = 0, target = 0;
stage.preload((p) => (target = p)).then(() => {
  target = 1;
  setTimeout(() => {
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-ready');
    ready = true;
    setupReveal();
    stage.measure();
  }, 350);
});

// 事件
addEventListener('resize', () => stage.resize());
addEventListener('load', () => stage.measure());
document.fonts?.ready.then(() => stage.measure());
addEventListener('pointermove', (e) => stage.pointer(e.clientX, e.clientY, performance.now()));
addEventListener('pointerdown', (e) => stage.click(e.clientX, e.clientY));

const progress = document.querySelector('.scroll-progress i');
const idx = document.querySelector('.section-index b');
const secs = site.order.map((id) => document.getElementById(id));
const navLinks = document.querySelectorAll('.site-nav a');

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (shown < target) { shown = Math.min(target, shown + dt * 1.5); num.textContent = Math.round(shown * 100); bar.style.transform = `scaleX(${shown})`; }
  stage.tick(reduce ? 0 : dt, now);
  aboutTick(); works.tick(); cursorTick();
  if (!reduce) decorTick(now / 1000);
  bubbleTick(now / 1000, ready);
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
  let cur = 0;
  secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top < innerHeight * 0.5) cur = i; });
  idx.textContent = String(cur + 1).padStart(2, '0');
  navLinks.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${site.order[cur]}`));
  document.body.dataset.section = site.order[cur];
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
