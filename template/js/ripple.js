// 鼠标划过舞台时的扭曲特效（只扭曲人物舞台，不碰文字），两种模式：
//   liquid（默认）：低分辨率速度场，鼠标把画面像液体一样推开，带 RGB 色散的彩虹边，约半秒褪去；
//                   点击向外扩散。思路同 React Bits 的液态光标（刷子尺寸 / 力量 / 褪色 / 分散）。
//   ripple：波动方程水波纹，适合有纹理的背景。
// 浏览器不支持浮点渲染目标时返回 null，由调用方退回 2D。

const VS = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

// 水波：r = 当前高度, g = 上一帧高度
const SIM_RIPPLE = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D s; uniform vec2 px; uniform float damp, aspect, dt;
uniform vec4 drop; uniform vec2 force; uniform float radial;
void main(){
  vec4 c = texture(s, uv);
  float sum = texture(s, uv + vec2(px.x, 0.)).r + texture(s, uv - vec2(px.x, 0.)).r
            + texture(s, uv + vec2(0., px.y)).r + texture(s, uv - vec2(0., px.y)).r;
  float h = (sum * 0.5 - c.g) * damp;
  if (drop.w != 0.) {
    vec2 d = (uv - drop.xy) * vec2(aspect, 1.);
    h += drop.w * exp(-dot(d, d) / (drop.z * drop.z));
  }
  o = vec4(h, c.r, 0., 1.);
}`;

// 液态：rg = 速度（每秒移动的 uv 距离）。半拉格朗日自平流 + 衰减；鼠标按移动方向注入速度，点击注入向外的速度
const SIM_LIQUID = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D s; uniform vec2 px; uniform float damp, aspect, dt;
uniform vec4 drop; uniform vec2 force; uniform float radial;
void main(){
  vec2 v = texture(s, uv).xy;
  vec2 nv = texture(s, uv - v * dt).xy * damp;
  if (drop.w != 0.) {
    vec2 d = (uv - drop.xy) * vec2(aspect, 1.);
    float k = exp(-dot(d, d) / (drop.z * drop.z)) * drop.w;
    if (radial > 0.5) nv += normalize(d + 1e-5) / vec2(aspect, 1.) * 0.6 * k; // 点击：向外推一圈
    else nv = mix(nv, force, clamp(k, 0., 1.));                               // 移动：拉向笔刷速度，不会越叠越大
  }
  o = vec4(clamp(nv, -4., 4.), 0., 1.);
}`;

const DRAW_RIPPLE = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D img, sim; uniform vec2 px; uniform float strength, highlight, dispersion;
void main(){
  float hx = texture(sim, uv + vec2(px.x, 0.)).r - texture(sim, uv - vec2(px.x, 0.)).r;
  float hy = texture(sim, uv + vec2(0., px.y)).r - texture(sim, uv - vec2(0., px.y)).r;
  vec2 off = vec2(hx, hy) * strength * 0.02;
  vec3 col = vec3(texture(img, uv + off * (1. + dispersion)).r, texture(img, uv + off).g, texture(img, uv + off * (1. - dispersion)).b);
  vec3 n = normalize(vec3(-hx, -hy, 0.08));
  col += pow(max(dot(n, normalize(vec3(-0.4, 0.6, 1.0))), 0.), 40.) * highlight;
  o = vec4(col, 1.);
}`;

const DRAW_LIQUID = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D img, sim; uniform vec2 px; uniform float strength, highlight, dispersion;
void main(){
  vec2 v = texture(sim, uv).xy;
  vec2 off = v * strength * 0.025;
  // 三个通道各自偏移不同距离 → 彩虹色散边
  vec3 col = vec3(texture(img, uv - off * (1. + dispersion)).r,
                  texture(img, uv - off).g,
                  texture(img, uv - off * (1. - dispersion)).b);
  col += length(v) * highlight * 0.15; // 只提亮不压暗：避免出现"大片黑色拖尾"
  o = vec4(col, 1.);
}`;

function program(gl, fs) {
  const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
  return { p, u };
}

export function createRipple(canvas, cfg) {
  if (cfg.mode === 'reactbits') return reactBits(canvas, cfg);
  const liquid = (cfg.mode || 'liquid') === 'liquid';
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) return null;
  let sim, draw;
  try { sim = program(gl, liquid ? SIM_LIQUID : SIM_RIPPLE); draw = program(gl, liquid ? DRAW_LIQUID : DRAW_RIPPLE); }
  catch (e) { console.warn('[ripple]', e); return null; }

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const tex = (w, h, float) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    return t;
  };
  const imgTex = tex(1, 1, false);
  let A, B, fbA, fbB, sw = 0, sh = 0, last = performance.now();
  const drops = [];

  function resize(w, h) {
    canvas.width = w; canvas.height = h;
    sw = Math.max(64, Math.round(w / 4)); sh = Math.max(64, Math.round(h / 4));
    [A, B].forEach((t) => t && gl.deleteTexture(t));
    A = tex(sw, sh, true); B = tex(sw, sh, true);
    fbA = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbA);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, A, 0);
    fbB = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, B, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function step(d, dt) {
    gl.useProgram(sim.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbB);
    gl.viewport(0, 0, sw, sh);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, A);
    gl.uniform1i(sim.u.s, 0);
    gl.uniform2f(sim.u.px, 1 / sw, 1 / sh);
    // 衰减按真实时间换算，帧率高低手感一致（liquid 的 damping 是"每 1/60 秒保留多少"）
    gl.uniform1f(sim.u.damp, Math.pow(cfg.damping ?? (liquid ? 0.95 : 0.968), dt * 60));
    gl.uniform1f(sim.u.aspect, sw / sh);
    gl.uniform1f(sim.u.dt, dt);
    gl.uniform4f(sim.u.drop, ...(d ? d.slice(0, 4) : [0, 0, 0, 0]));
    gl.uniform2f(sim.u.force, d ? d[4] : 0, d ? d[5] : 0);
    gl.uniform1f(sim.u.radial, d && d[6] ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    [A, B] = [B, A]; [fbA, fbB] = [fbB, fbA];
  }

  return {
    mode: liquid ? 'liquid' : 'ripple',
    resize,
    // x, y 为 0–1 屏幕坐标（y 向下）。vx, vy 为鼠标速度（屏幕宽高/秒），liquid 用它决定推动方向
    move(x, y, vx, vy) {
      if (liquid) {
        const sp = Math.hypot(vx, vy); if (sp < 0.02) return;
        const k = Math.min(1, sp / 1.2); // 速度上限，甩得再快也不会糊成一片
        drops.push([x, 1 - y, cfg.radius ?? 0.05, 1, vx / sp * k * 1.8, -vy / sp * k * 1.8, 0]);
      } else {
        const sp = Math.hypot(vx, vy); if (sp < 0.02) return;
        drops.push([x, 1 - y, cfg.radius ?? 0.022, Math.min(0.25, sp * 0.06) * 0.5, 0, 0, 0]);
      }
    },
    click(x, y) {
      const boost = cfg.clickBoost ?? 3, r = (cfg.radius ?? 0.03) * 1.8;
      drops.push(liquid ? [x, 1 - y, r, boost, 0, 0, 1] : [x, 1 - y, r, boost * 0.5, 0, 0, 0]);
    },
    render(source) {
      const now = performance.now(), dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000)); last = now;
      gl.bindTexture(gl.TEXTURE_2D, imgTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      if (!drops.length) step(null, dt);
      else { const n = drops.length; while (drops.length) step(drops.shift(), dt / n); }
      gl.useProgram(draw.p);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, imgTex);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, A);
      gl.uniform1i(draw.u.img, 0); gl.uniform1i(draw.u.sim, 1);
      gl.uniform2f(draw.u.px, 1 / sw, 1 / sh);
      gl.uniform1f(draw.u.strength, cfg.strength ?? 1);
      gl.uniform1f(draw.u.highlight, cfg.highlight ?? 0.1);
      gl.uniform1f(draw.u.dispersion, cfg.dispersion ?? (liquid ? 0.35 : 0));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  };
}

// 'reactbits'：React Bits Ripple Distortion。着色器要先用 scripts/fetch-reactbits.mjs 下载；
// 加载完成前先用 liquid 顶着（没有鼠标输入时就是原画面），下载缺失或出错时一直用 liquid，并在控制台提示。
function reactBits(canvas, cfg) {
  // 浏览器不支持 WebGL2 时直接返回 null，舞台改用 2D 画布（人物照常显示，只是没有扭曲效果）
  if (!document.createElement('canvas').getContext('webgl2')) return null;
  let impl = createRipple(canvas, { ...cfg, mode: 'liquid', strength: 1, dispersion: 0.35 }), size = null;
  const api = {
    mode: 'reactbits',
    resize(w, h) { size = [w, h]; impl?.resize(w, h); },
    move(...a) { if (api.ready) impl.move(...a); },
    click(...a) { if (api.ready) impl.click(...a); },
    render(src) { impl?.render(src); },
    ready: false,
  };
  import('./ripple-rb.js')
    .then((m) => m.createReactBitsRipple(canvas, cfg))
    .then((r) => { impl = r; if (size) r.resize(...size); api.ready = true; api.params = r.params; api.impl = r; })
    .catch((e) => {
      console.warn('[ripple] reactbits 模式没加载成功，改用 liquid。先运行 node scripts/fetch-reactbits.mjs <站点>。', e.message);
      api.ready = true; api.mode = 'liquid';
    });
  return api;
}
