// 验收截图：用 Chrome DevTools 协议驱动无头 Chrome，发真实鼠标事件、按真实时间等待、逐版块截图。
// （Chrome 自带的 --screenshot 只按需渲染，动画和溶解会停在半路，看到的不是用户看到的。）
// 用法：node shoot.mjs <url> <输出目录> '<步骤 JSON>' [宽=1280] [高=720]
// 步骤：{"wait":毫秒} {"scroll":y} {"sec":"版块id","dy":偏移} {"move":[x,y]} {"click":[x,y]} {"key":"Escape"} {"eval":"js"} {"shot":"文件名"}
// 例：node shoot.mjs http://localhost:8000 shots '[{"wait":4000},{"move":[1100,120]},{"shot":"hero"},{"sec":"about","dy":600},{"wait":1500},{"shot":"about"}]'
// Chrome 路径：环境变量 CHROME，否则依次找常见安装位置。
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';

const [url, outdir, stepsJson, W = '1280', H = '720'] = process.argv.slice(2);
const steps = JSON.parse(stepsJson);
const guess = () => {
  const c = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  for (const p of c) if (p && fs.existsSync(p)) return p;
  try { return execSync(`ls -d ${process.env.HOME}/.cache/ms-playwright/chromium-*/chrome-linux*/chrome 2>/dev/null | tail -1`).toString().trim(); } catch { return ''; }
};
const CH = guess();
if (!CH) { console.error('找不到 Chrome：请设置环境变量 CHROME=<chrome 可执行文件路径>'); process.exit(1); }
const port = 9300 + Math.floor(Math.random() * 500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const proc = spawn(CH, ['--headless=new', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars',
  `--remote-debugging-port=${port}`, `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
let list;
for (let i = 0; i < 40; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; } catch { await sleep(250); } }
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(); const logs = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
  if (d.method === 'Runtime.consoleAPICalled') logs.push(d.params.type + ': ' + d.params.args.map((a) => a.value ?? a.description).join(' '));
  if (d.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + d.params.exceptionDetails.exception?.description); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;

await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: 1, mobile: +W < 760 });
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate', { url });
// 先确认打开的真是本模板做的站（端口被别的服务占着时，最容易截到别人的网页），再等字体加载完
let isSite = false;
for (let i = 0; i < 60 && !isSite; i++) { await sleep(250); isSite = !!(await ev('!!(window.SITE && document.getElementById("stage"))')); }
if (!isSite) {
  console.error(`✗ ${url} 不是用 motion-homepage 模板做的页面（没有 window.SITE）。端口可能被别的服务占用了，请确认预览地址。`);
  ws.close(); proc.kill(); process.exit(2);
}
await ev('document.fonts.ready.then(() => true)');
fs.mkdirSync(outdir, { recursive: true });
let mx = 0, my = 0;
for (const s of steps) {
  if (s.wait) await sleep(s.wait);
  if (s.scroll !== undefined) await ev(`scrollTo({top:${s.scroll},behavior:'instant'})`);
  if (s.sec) await ev(`scrollTo({top:document.getElementById('${s.sec}').offsetTop+${s.dy || 0},behavior:'instant'})`);
  if (s.move) { // 分几步移动，像真实鼠标
    const [tx, ty] = s.move;
    for (let k = 1; k <= 8; k++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: mx + (tx - mx) * k / 8, y: my + (ty - my) * k / 8 }); await sleep(16); }
    mx = tx; my = ty;
  }
  if (s.click) { const [x, y] = s.click; mx = x; my = y;
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); }
  if (s.key) { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: s.key, code: s.key, windowsVirtualKeyCode: s.key === 'Escape' ? 27 : 0 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: s.key, code: s.key, windowsVirtualKeyCode: s.key === 'Escape' ? 27 : 0 }); }
  if (s.eval) console.log('eval:', JSON.stringify(await ev(s.eval)));
  if (s.shot) { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${outdir}/${s.shot}.png`, Buffer.from(r.result.data, 'base64')); console.log('shot', s.shot); }
}
if (logs.length) console.log(logs.slice(0, 20).join('\n'));
ws.close(); proc.kill();
process.exit(0);
