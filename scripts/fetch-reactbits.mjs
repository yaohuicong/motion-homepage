#!/usr/bin/env node
// 把 React Bits 的 Ripple Distortion（鼠标划过人物时的旋转波纹扭曲）下载进"你自己的站点"。
//
// 为什么不直接打包在模板里：React Bits 是 MIT + Commons Clause 许可，允许把组件用在自己的网站/产品里，
// 但不允许把组件本身（包括移植版）再分发。所以 Skill 只带这个下载脚本和自己写的驱动（js/ripple-rb.js），
// 组件源码在建站时从官方仓库下载到 <站点>/vendor/reactbits/，随你的网站一起发布（属于"用在网站里"）。
//
// 用法：node scripts/fetch-reactbits.mjs <站点目录>
// 产物：vendor/reactbits/RippleDistortion.jsx（原文件，留作对照）、ripple-shaders.js（从原文件抽出的着色器与常量）、LICENSE.md
import fs from 'node:fs';
import path from 'node:path';

const site = process.argv[2];
if (!site || !fs.existsSync(path.join(site, 'site.config.js'))) {
  console.error('用法：node fetch-reactbits.mjs <站点目录>（目录里要有 site.config.js）');
  process.exit(1);
}
const RAW = 'https://raw.githubusercontent.com/DavidHDev/react-bits/main';
const get = async (u) => {
  const r = await fetch(u);
  if (!r.ok) throw new Error(`${r.status} ${u}`);
  return r.text();
};

const reg = JSON.parse(await get(`${RAW}/public/r/RippleDistortion-JS-CSS.json`));
const src = reg.files.find((f) => f.path.endsWith('.jsx'))?.content;
if (!src) throw new Error('registry 里没找到 RippleDistortion.jsx');
const license = await get(`${RAW}/LICENSE.md`);

// 从原文件里抽出着色器字符串和几个常量；抽不到就报错，不自己"猜"一个版本
const str = (name) => {
  const m = src.match(new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`));
  if (!m) throw new Error(`原文件结构变了：找不到 ${name}`);
  return m[1];
};
const num = (re, name) => {
  const m = src.match(re);
  if (!m) throw new Error(`原文件结构变了：找不到 ${name}`);
  return m[1];
};
const out = {
  waveVertex: str('waveVertex'),
  waveFragment: str('waveFragment'),
  screenVertex: str('screenVertex'),
  compositeFragment: str('compositeFragment'),
  MAX_WAVES: +num(/const MAX_WAVES = (\d+);/, 'MAX_WAVES'),
  START_SCALE: +num(/const START_SCALE = ([\d.]+);/, 'START_SCALE'),
  LIFE: num(/const LIFE_CONSTANT = (Math\.log\([\d.]+\));/, 'LIFE_CONSTANT'),
  GROWTH: +num(/1 - Math\.exp\(-delta \* ([\d.]+)\)/, 'growth'),
  QUALITY_SCALE: num(/const QUALITY_SCALE = (\{[^}]*\});/, 'QUALITY_SCALE'),
};
const defaults = {};
for (const m of src.matchAll(/^\s{2}(\w+) = ('[^']*'|[\d.]+|true|false),?$/gm)) if (m[1] !== 'src' && m[1] !== 'className') defaults[m[1]] = eval(m[2]);

const dir = path.join(site, 'vendor', 'reactbits');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'RippleDistortion.jsx'), src);
fs.writeFileSync(path.join(dir, 'LICENSE.md'), license);
fs.writeFileSync(path.join(dir, 'ripple-shaders.js'), `// 自动生成：scripts/fetch-reactbits.mjs 从 React Bits 的 RippleDistortion.jsx 抽出。
// Ripple Distortion © David Haz, React Bits — MIT + Commons Clause（见同目录 LICENSE.md）。
// 只用于本网站；不要把这个文件单独拿去分发或出售。
export const waveVertex = \`${out.waveVertex}\`;
export const waveFragment = \`${out.waveFragment}\`;
export const screenVertex = \`${out.screenVertex}\`;
export const compositeFragment = \`${out.compositeFragment}\`;
export const MAX_WAVES = ${out.MAX_WAVES};
export const START_SCALE = ${out.START_SCALE};
export const LIFE_CONSTANT = ${out.LIFE};
export const GROWTH = ${out.GROWTH};
export const QUALITY_SCALE = ${out.QUALITY_SCALE};
export const DEFAULTS = ${JSON.stringify(defaults)};
`);
console.log(`已下载到 ${dir}`);
console.log('原组件默认参数：', defaults);
console.log("在 site.config.js 里设 stage.ripple.mode = 'reactbits' 启用。");
