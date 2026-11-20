#!/usr/bin/env node
// 检查一个主页目录：配置能否解析、素材文件是否都在、追视关键帧是否合理、总体积多大。
// 用法：node check-site.mjs <站点目录>
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const dir = path.resolve(process.argv[2] || '.');
const cfgPath = path.join(dir, 'site.config.js');
const errors = [], warns = [];
let site;
try {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(cfgPath, 'utf8'), ctx, { filename: cfgPath });
  site = ctx.window.SITE;
  if (!site) throw new Error('没有找到 window.SITE');
} catch (e) {
  console.error(`✗ site.config.js 解析失败：${e.message}`);
  process.exit(1);
}

let bytes = 0;
const exists = (rel, what) => {
  const p = path.join(dir, rel);
  if (!fs.existsSync(p)) { errors.push(`${what} 缺文件：${rel}`); return false; }
  bytes += fs.statSync(p).size;
  return true;
};
const checkClip = (c, what) => {
  if (!c?.src || !c.count) { errors.push(`${what} 缺 src 或 count`); return; }
  let missing = 0;
  if (c.map && c.map.length !== c.count) errors.push(`${what}：map 长度 ${c.map.length} 与 count ${c.count} 不一致`);
  const files = c.map ? Math.max(...c.map) + 1 : c.count; // 星形追视：时间轴复用文件
  for (let i = 0; i < files; i++) {
    const rel = c.src.replace('{n}', String((c.start ?? 1) + i).padStart(c.pad ?? 4, '0'));
    if (!fs.existsSync(path.join(dir, rel))) missing++; else bytes += fs.statSync(path.join(dir, rel)).size;
  }
  if (missing) errors.push(`${what}：${missing}/${files} 帧不存在（${c.src}）`);
};

const st = site.stage || {};
if (st.background) exists(st.background, '舞台背景');
checkClip(st.gaze, '追视');
const g = st.gaze || {};
if (g.keys) {
  const bad = g.keys.filter((k) => k.f < 0 || k.f >= g.count);
  if (bad.length) errors.push(`追视 keys 有帧号越界：${JSON.stringify(bad)}`);
  if (!g.keys.some((k) => Math.hypot(k.x, k.y) < 0.05)) warns.push('追视 keys 里没有正面（x:0,y:0），离开首屏时无法回正');
  const dirs = new Set(g.keys.filter((k) => Math.hypot(k.x, k.y) > 0.5).map((k) => Math.round(Math.atan2(k.y, k.x) / (Math.PI / 4))));
  if (dirs.size < 8) warns.push(`追视只覆盖了 ${dirs.size}/8 个方向，鼠标移到缺的方向会跳帧或卡顿`);
  if (g.loop !== false) {
    const first = g.keys.find((k) => k.f === 0), last = g.keys.find((k) => k.f === g.count - 1);
    if (!first || !last || Math.hypot(first.x - last.x, first.y - last.y) > 0.05) warns.push('追视设为闭环（loop），但首尾帧方向不同；视频要回到正面，或设 loop:false');
  }
}
if (!g.head) warns.push('追视没写 head（头在画面中的位置），鼠标方向会算偏');

const order = site.order || [];
(st.transitions || []).forEach((t, i) => {
  checkClip(t, `衔接 ${t.from}→${t.to}`);
  if (!order.includes(t.to)) errors.push(`衔接 ${i + 1} 的 to「${t.to}」不在 order 里`);
  if (order.indexOf(t.to) - order.indexOf(t.from) !== 1) warns.push(`衔接 ${t.from}→${t.to} 不是相邻段落`);
});
for (const id of order) if (!site.sections?.[id]) errors.push(`order 里的「${id}」在 sections 中没有内容`);

const s = site.sections || {};
(s.folder?.categories || []).forEach((c) => c.cover && exists(c.cover, `类目「${c.name}」封面`));
(s.works?.items || []).forEach((w) => { w.cover && exists(w.cover, `作品「${w.title}」封面`); w.video && exists(w.video, `作品「${w.title}」视频`); });
const cats = new Set((s.folder?.categories || []).map((c) => c.key));
(s.works?.items || []).forEach((w) => cats.size && !cats.has(w.cat) && warns.push(`作品「${w.title}」的 cat「${w.cat}」不在作品目录的类目里`));
// 占位素材：分开报舞台（角色）和作品封面，方便告诉用户具体哪些还没换
if (JSON.stringify(st).includes('assets/demo/')) warns.push('人物舞台还在用模板自带的占位角色（assets/demo/）');
const demoCovers = [...(s.folder?.categories || []), ...(s.works?.items || [])].filter((c) => String(c.cover || '').includes('assets/demo/'));
if (demoCovers.length) warns.push(`${demoCovers.length} 张作品/类目封面还是模板占位图（assets/demo/works/）`);
// 装饰里的贴纸图片
for (const [id, sec] of Object.entries(s)) (sec?.decor || []).forEach((d) => d.type === 'img' && d.src && exists(d.src, `版块「${id}」的贴纸`));
// 模板里的占位文字
const txt = JSON.stringify(s) + JSON.stringify(site.meta || {}) + String(site.brand || '');
for (const [needle, what] of [['example.com', '示例邮箱'], ['NOVA', '模板名字 NOVA'], ['@nova', '示例账号 @nova']]) {
  if (txt.includes(needle)) warns.push(`文案里还有模板占位内容：${what}（${needle}）`);
}

const mb = bytes / 1e6;
if (mb > 40) warns.push(`素材共 ${mb.toFixed(1)} MB，偏大：衔接片段可降到 --width 960 --fps 20`);
errors.forEach((e) => console.log('✗ ' + e));
warns.forEach((w) => console.log('! ' + w));
console.log(`${errors.length ? '✗' : '✓'} ${errors.length} 个错误，${warns.length} 个提醒；素材合计 ${mb.toFixed(1)} MB`);
process.exit(errors.length ? 1 : 0);
