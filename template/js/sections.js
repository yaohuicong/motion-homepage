// 五个版块的 HTML 与交互。内容全部来自 site.config.js。
// 想加新版块：在 RENDER 里加一个函数，在 SITE.order 里写上它的 id。

import { decorHTML, DOODLES } from './decor.js';

const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// 大标题逐字拆开，进场时逐字弹出；{{词}} 会被手绘圈圈住
const lines = (arr) => arr.map((l, i) => {
  let k = 0;
  const chars = (t) => [...t].map((ch) => `<span class="ch" style="--i:${k++}">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('');
  const html = l.split(/(\{\{.+?\}\})/).map((part) => {
    const m = part.match(/^\{\{(.+)\}\}$/);
    if (!m) return chars(part);
    return `<span class="circled">${chars(m[1])}<svg class="ring" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${DOODLES.circle}" pathLength="1"/></svg></span>`;
  }).join('');
  return `<span class="line" style="--l:${i}">${html}</span>`;
}).join('');
const brush = `<svg class="brush" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true">
  <path d="M6 26 C90 14 220 8 394 16" pathLength="1"/><path d="M40 34 C140 26 260 22 360 26" pathLength="1"/></svg>`;
// 界面上的固定文字（默认英文），在 site.config.js 的 ui 里可改成别的语言
const UI = () => ({ top: 'Back to top ↑', close: 'Close', viewWorks: 'View works →', all: 'All', viewProject: 'View project', ...(window.SITE.ui || {}) });
const icon = { play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>', arrow: '↗', down: '↓', mail: '✉', pin: '⌖' };

const RENDER = {
  hero: (s) => `
    <section id="hero" class="sec sec-hero side-${s.side || 'left'}" data-nav="${esc(s.nav)}">
      ${decorHTML(s.decor)}
      <div class="hero-copy">
        ${s.greeting ? `<p class="greet" data-reveal>${esc(s.greeting)}</p>` : ''}
        <h1 class="display" data-reveal${s.titleScale ? ` style="--ts:${+s.titleScale}"` : ''}>${lines(s.title)}${s.underline === false ? '' : brush}</h1>
        ${s.roles ? `<p class="roles" data-reveal>${s.roles.map((r) => `<span>${esc(r)}</span>`).join('<i></i>')}</p>` : ''}
        ${s.sub ? `<p class="lead" data-reveal>${s.sub}</p>` : ''}
        <div class="ctas" data-reveal>${(s.ctas || []).map((c, i) => `
          <a class="btn ${i ? 'btn-ghost' : ''}" href="${esc(c.href)}" data-magnetic>
            ${c.icon === 'play' ? `<i class="ico">${icon.play}</i>` : ''}<span>${esc(c.label)}</span>${c.icon === 'arrow' ? `<i>${icon.arrow}</i>` : ''}</a>`).join('')}
        </div>
      </div>
      <div class="scroll-hint"${s.scrollX != null ? ` style="left:${+s.scrollX}%"` : ''}><i class="mouse"></i><span>${esc(s.scrollText || 'Scroll Down')}</span></div>
    </section>`,

  about: (s) => `
    <section id="about" class="sec sec-about side-${s.side || 'right'}" data-nav="${esc(s.nav)}" style="--steps:${s.timeline.length}">
      <div class="pin">
        ${decorHTML(s.decor)}
        <div class="about-year" aria-hidden="true">${s.timeline.map((t, i) => `<b data-i="${i}">${esc(t.year)}</b>`).join('')}</div>
        <div class="about-copy panel">
          <p class="eyebrow" data-reveal>${esc(s.eyebrow)}</p>
          <h2 class="display sm" data-reveal>${lines(s.title)}</h2>
          <ol class="timeline">
            ${s.timeline.map((t, i) => `<li data-i="${i}"><span class="range">${esc(t.range)}</span><h4>${esc(t.title)}</h4><p>${esc(t.text)}</p></li>`).join('')}
          </ol>
          <div class="about-bar"><i></i></div>
        </div>
      </div>
    </section>`,

  folder: (s) => `
    <section id="folder" class="sec sec-folder side-${s.side || 'left'}" data-nav="${esc(s.nav)}">
      ${decorHTML(s.decor)}
      <div class="folder-head">
        <p class="eyebrow" data-reveal>${esc(s.eyebrow)}</p>
        <h2 class="display sm" data-reveal>${lines([].concat(s.title))}</h2>
      </div>
      <button class="folder" type="button" aria-label="${esc(s.hint)}" data-magnetic>
        <span class="folder-back"></span>
        <span class="folder-papers">${s.categories.map((c, i) => `<i style="--k:${i}">${esc(c.name)}</i>`).join('')}</span>
        <span class="folder-front"><b>${esc(s.folderLabel)}</b><em>→</em></span>
      </button>
      <p class="folder-hint" data-reveal>${esc(s.hint)}</p>
    </section>`,

  works: (s) => `
    <section id="works" class="sec sec-works" data-nav="${esc(s.nav)}" style="--n:${s.items.length}">
      <div class="pin">
        ${decorHTML(s.decor)}
        <div class="works-head">
          <p class="eyebrow" data-reveal>${esc(s.eyebrow)}</p>
          <h2 class="display sm" data-reveal>${lines([].concat(s.title))}</h2>
          <div class="works-tabs"></div>
        </div>
        <div class="works-track"></div>
        <div class="works-foot"><span class="works-cat"></span><span class="works-count"></span></div>
      </div>
    </section>`,

  outro: (s) => `
    <section id="outro" class="sec sec-outro" data-nav="${esc(s.nav)}">
      ${decorHTML(s.decor)}
      <div class="floaters" aria-hidden="true">${(s.skills || []).map((k, i) => `
        <span class="app" style="--i:${i};--c:${k.color || 'var(--accent)'}"><b>${esc(k.abbr)}</b><small>${esc(k.name || '')}</small></span>`).join('')}</div>
      <div class="outro-bar panel">
        <div class="outro-copy">
          <p class="eyebrow" data-reveal>${esc(s.eyebrow)}</p>
          <h2 class="display md" data-reveal>${lines(s.title)}</h2>
          ${s.sub ? `<p class="lead" data-reveal>${esc(s.sub)}</p>` : ''}
        </div>
        <ul class="contacts" data-reveal>${s.contacts.map((c) => `
          <li><a href="${esc(c.href)}" data-magnetic><i>${icon[c.icon] || '•'}</i><span><small>${esc(c.label)}</small><b>${esc(c.value)}</b></span></a></li>`).join('')}</ul>
      </div>
      <footer class="foot"><span>© ${new Date().getFullYear()} ${esc(window.SITE.brand)}</span><a href="#hero">${esc(UI().top)}</a></footer>
    </section>`,
};

export function renderSections(root, site) {
  root.innerHTML = site.order.map((id) => RENDER[id]?.(site.sections[id]) ?? '').join('');
}

// ———————————————— 交互 ————————————————

export function setupReveal() {
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('in')), { threshold: 0.2 });
  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
}

// 履历：钉住一屏，滚动切换年份
export function setupAbout(site) {
  const sec = document.getElementById('about');
  if (!sec) return () => {};
  const n = site.sections.about.timeline.length;
  const items = sec.querySelectorAll('.timeline li');
  const years = sec.querySelectorAll('.about-year b');
  const bar = sec.querySelector('.about-bar i');
  let last = -1;
  return () => {
    const r = sec.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
    bar.style.transform = `scaleX(${p})`;
    const i = Math.min(n - 1, Math.floor(p * n * 0.999));
    if (i !== last) {
      items.forEach((el, k) => el.classList.toggle('on', k === i));
      years.forEach((el, k) => el.classList.toggle('on', k === i));
      last = i;
    }
  };
}

// 作品目录：点击文件夹展开三张类目卡，背景与人物虚化，ESC/关闭收起
export function setupFolder(site, onPick) {
  const s = site.sections.folder;
  const btn = document.querySelector('.folder');
  const ov = document.getElementById('folder-overlay');
  if (!btn) return;
  ov.innerHTML = `
    <div class="ov-bg"></div>
    <button class="ov-close" type="button" aria-label="${esc(UI().close)}">ESC ✕</button>
    <div class="ov-cards">${s.categories.map((c, i) => `
      <button class="cat-card" type="button" style="--k:${i};--n:${s.categories.length}" data-cat="${c.key}">
        <span class="cat-img" style="background-image:url('${c.cover}')"></span>
        <b>${c.name}</b><small>${c.text}</small><em>${esc(UI().viewWorks)}</em>
      </button>`).join('')}</div>`;
  const open = () => { ov.hidden = false; requestAnimationFrame(() => document.body.classList.add('folder-open')); };
  const close = () => {
    document.body.classList.remove('folder-open');
    setTimeout(() => { if (!document.body.classList.contains('folder-open')) ov.hidden = true; }, 600);
  };
  btn.addEventListener('click', open);
  ov.querySelector('.ov-bg').addEventListener('click', close);
  ov.querySelector('.ov-close').addEventListener('click', close);
  addEventListener('keydown', (e) => e.key === 'Escape' && close());
  ov.querySelectorAll('.cat-card').forEach((b) => b.addEventListener('click', () => { close(); onPick?.(b.dataset.cat); }));
}

// 精选作品：竖向滚动驱动横向轮播，中间那张放大；点击打开详情
export function setupWorks(site) {
  const s = site.sections.works;
  const sec = document.getElementById('works');
  if (!sec) return { tick() {}, filter() {} };
  const track = sec.querySelector('.works-track');
  const tabs = sec.querySelector('.works-tabs');
  const count = sec.querySelector('.works-count');
  const catEl = sec.querySelector('.works-cat');
  const cats = site.sections.folder?.categories || [];
  const catName = (k) => cats.find((c) => c.key === k)?.name || k;
  let list = s.items;

  tabs.innerHTML = [`<button data-cat="" class="on">${esc(UI().all)}</button>`, ...cats.map((c) => `<button data-cat="${c.key}">${c.name}</button>`)].join('');
  const draw = () => {
    track.innerHTML = list.map((w, i) => `
      <button class="work" type="button" data-i="${i}">
        <span class="work-img" style="background-image:url('${w.cover}')"></span>
        <span class="work-meta"><span><b>${w.title}</b><small>${catName(w.cat)} · ${w.year}</small></span><i>↗</i></span>
      </button>`).join('');
    track.querySelectorAll('.work').forEach((el) => el.addEventListener('click', () => openWork(list[+el.dataset.i])));
    sec.style.setProperty('--n', list.length);
  };
  const filter = (cat) => {
    list = cat ? s.items.filter((w) => w.cat === cat) : s.items;
    tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.cat === (cat || '')));
    draw();
    dispatchEvent(new Event('resize')); // 版块高度变了，舞台要重新量
  };
  tabs.addEventListener('click', (e) => e.target.dataset && 'cat' in e.target.dataset && filter(e.target.dataset.cat));
  draw();

  const modal = document.getElementById('work-modal');
  function openWork(w) {
    modal.innerHTML = `
      <div class="m-bg"></div>
      <article class="m-card">
        <button class="m-close" type="button" aria-label="${esc(UI().close)}">✕</button>
        ${w.video ? `<video src="${w.video}" autoplay muted loop playsinline></video>` : `<img src="${w.cover}" alt="">`}
        <div class="m-body"><small>${catName(w.cat)} · ${w.year}${w.role ? ' · ' + w.role : ''}</small><h3>${w.title}</h3><p>${w.desc || ''}</p>
        ${w.link ? `<a class="btn" href="${w.link}" target="_blank" rel="noopener"><span>${esc(UI().viewProject)}</span><i>↗</i></a>` : ''}</div>
      </article>`;
    modal.hidden = false;
    requestAnimationFrame(() => document.body.classList.add('modal-open'));
    const shut = () => { document.body.classList.remove('modal-open'); setTimeout(() => (modal.hidden = true), 400); };
    modal.querySelector('.m-bg').onclick = shut;
    modal.querySelector('.m-close').onclick = shut;
    addEventListener('keydown', function k(e) { if (e.key === 'Escape') { shut(); removeEventListener('keydown', k); } });
  }

  // 方向键 ←/→：作品版块在屏幕里时，按一下滚到上一张/下一张
  addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    if (document.body.classList.contains('modal-open')) return;
    const r = sec.getBoundingClientRect(), n = track.querySelectorAll('.work').length;
    if (r.top > 1 || r.bottom < innerHeight - 1 || n < 2) return;
    e.preventDefault();
    scrollBy({ top: ((r.height - innerHeight) / (n - 1)) * (e.key === 'ArrowRight' ? 1 : -1), behavior: 'smooth' });
  });

  return {
    filter,
    tick() {
      const r = sec.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
      const cards = track.querySelectorAll('.work');
      if (!cards.length) return;
      const cw = cards[0].offsetWidth + parseFloat(getComputedStyle(track).columnGap || 0);
      const pos = p * (cards.length - 1);
      track.style.transform = `translate3d(${innerWidth / 2 - cards[0].offsetWidth / 2 - pos * cw}px,0,0)`;
      cards.forEach((el, i) => {
        const d = Math.min(1, Math.abs(i - pos));
        el.style.setProperty('--d', d.toFixed(3));
      });
      const cur = Math.round(pos);
      count.textContent = `${String(cur + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
      catEl.textContent = catName(list[cur]?.cat || '');
    },
  };
}

// 结尾：漂浮的工具标签跟鼠标轻微视差
export function setupOutro() {
  const fl = document.querySelectorAll('.floaters .app');
  addEventListener('pointermove', (e) => {
    const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
    fl.forEach((el, i) => { const k = ((i % 3) + 1) * 14; el.style.translate = `${x * k}px ${y * k}px`; });
  });
}
