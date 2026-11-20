// 'reactbits' 模式：用 React Bits 的 Ripple Distortion 着色器（鼠标划过人物的旋转波纹扭曲），
// 把人物舞台画布当作被扭曲的图片。着色器在建站时由 scripts/fetch-reactbits.mjs 下载到 vendor/reactbits/，
// 本文件只是驱动：管理"波纹印章"的生成、扩散、褪去，并把舞台画面送进着色器。
//
// 参数名和 React Bits 网页上的调节面板一一对应（面板显示的中文名在括号里），在官网调好直接抄数：
//   brushSize 刷子尺寸(px)  strength 力量  swirl 漩涡  rings 戒指/圈数  spread 传播  fade 褪色(秒)
//   spacing 间距(px)  dispersion 分散  glint 闪烁  tint/tintAmount 着色/着色量  grayscale 灰度
//   highlightColor 强调  trigger 触发方式(hover/click/both)  clickStrength 点击强度  quality 质量(low/medium/high)

export async function createReactBitsRipple(canvas, cfg) {
  const V = await import(new URL('../vendor/reactbits/ripple-shaders.js', import.meta.url).href);
  const P = { ...V.DEFAULTS, ...cfg };
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, alpha: false });
  if (!gl) throw new Error('WebGL2 不可用');

  const compile = (vs, fs) => {
    const p = gl.createProgram();
    for (const [type, code] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type);
      gl.shaderSource(s, code); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  };
  const waveP = compile(V.waveVertex, V.waveFragment);
  const compP = compile(V.screenVertex, V.compositeFragment);
  const U = (p, n) => gl.getUniformLocation(p, n);

  const N = V.MAX_WAVES;
  const offsets = new Float32Array(N * 2), scales = new Float32Array(N * 2), opac = new Float32Array(N);
  const waves = Array.from({ length: N }, () => ({ x: 0, y: 0, scale: 1, target: 1, size: 1, o: 0 }));
  let cur = 0;

  // 波纹印章：每个是一个实例化的小方块
  const waveVao = gl.createVertexArray();
  gl.bindVertexArray(waveVao);
  const attr = (p, name, data, size, divisor, usage = gl.STATIC_DRAW) => {
    const loc = gl.getAttribLocation(p, name);
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    if (loc >= 0) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(loc, divisor); }
    return b;
  };
  attr(waveP, 'position', new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), 2, 0);
  attr(waveP, 'uv', new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), 2, 0);
  const bOff = attr(waveP, 'iOffset', offsets, 2, 1, gl.DYNAMIC_DRAW);
  const bScl = attr(waveP, 'iScale', scales, 2, 1, gl.DYNAMIC_DRAW);
  const bOpa = attr(waveP, 'iOpacity', opac, 1, 1, gl.DYNAMIC_DRAW);

  // 全屏三角形
  const compVao = gl.createVertexArray();
  gl.bindVertexArray(compVao);
  attr(compP, 'position', new Float32Array([-1, -1, 3, -1, -1, 3]), 2, 0);
  attr(compP, 'uv', new Float32Array([0, 0, 2, 0, 0, 2]), 2, 0);
  gl.bindVertexArray(null);

  const tex = () => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t;
  };
  const imgTex = tex(), dispTex = tex();
  const fb = gl.createFramebuffer();
  let W = 1, H = 1, fw = 2, fh = 2, last = performance.now(), prev = null;

  const hex = (h) => { const n = parseInt(String(h).replace('#', '').replace(/^(.)(.)(.)$/, '$1$1$2$2$3$3'), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

  function resize(w, h) {
    canvas.width = W = w; canvas.height = H = h;
    const q = V.QUALITY_SCALE[P.quality] || V.QUALITY_SCALE.high;
    fw = Math.max(2, Math.round(innerWidth * q)); fh = Math.max(2, Math.round(innerHeight * q));
    gl.bindTexture(gl.TEXTURE_2D, dispTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fw, fh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, dispTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // x, y：CSS 像素，y 向上（与原组件一致）
  const spawn = (x, y, power) => {
    const w = waves[cur]; cur = (cur + 1) % N;
    Object.assign(w, { x, y, scale: V.START_SCALE * power, target: V.START_SCALE * Math.max(1, P.spread) * power, size: Math.max(1, P.brushSize), o: 1 });
  };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  return {
    mode: 'reactbits',
    params: P,
    waves, // 调试用
    resize,
    move(x, y) { // 0–1 屏幕坐标，y 向下
      if (reduce || P.trigger === 'click') return;
      const px = x * innerWidth, py = (1 - y) * innerHeight, step = Math.max(1, P.spacing);
      if (!prev || Math.abs(px - prev[0]) > step || Math.abs(py - prev[1]) > step) { spawn(px, py, 1); prev = [px, py]; }
    },
    click(x, y) {
      if (reduce || P.trigger === 'hover') return;
      spawn(x * innerWidth, (1 - y) * innerHeight, Math.max(1, P.clickStrength));
    },
    render(source) {
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
      const grow = reduce ? 0 : 1 - Math.exp(-dt * V.GROWTH);
      const decay = reduce ? 1 : Math.exp((-dt * V.LIFE_CONSTANT) / Math.max(0.15, P.fade));
      const cw = innerWidth, ch = innerHeight;
      for (let i = 0; i < N; i++) {
        const w = waves[i];
        if (w.o > 0) { w.o *= decay; w.scale += (w.target - w.scale) * grow; if (w.o < 0.002) w.o = 0; }
        opac[i] = w.o;
        if (!w.o) continue;
        const half = (w.scale * w.size) / 2;
        offsets[i * 2] = (w.x / cw) * 2 - 1; offsets[i * 2 + 1] = (w.y / ch) * 2 - 1;
        scales[i * 2] = (half / cw) * 2; scales[i * 2 + 1] = (half / ch) * 2;
      }
      for (const [b, d] of [[bOff, offsets], [bScl, scales], [bOpa, opac]]) { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferSubData(gl.ARRAY_BUFFER, 0, d); }

      // 1) 波纹叠加到位移场
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.viewport(0, 0, fw, fh);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(waveP);
      gl.uniform1f(U(waveP, 'uRings'), P.rings);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.bindVertexArray(waveVao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, N);
      gl.disable(gl.BLEND);

      // 2) 用位移场扭曲舞台画面
      gl.bindTexture(gl.TEXTURE_2D, imgTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.useProgram(compP);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, imgTex);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, dispTex);
      gl.uniform1i(U(compP, 'uTexture'), 0); gl.uniform1i(U(compP, 'uDisplacement'), 1);
      gl.uniform2f(U(compP, 'uResolution'), W, H);
      gl.uniform2f(U(compP, 'uTextureSize'), W, H);
      gl.uniform2f(U(compP, 'uTexel'), 1 / fw, 1 / fh);
      gl.uniform3f(U(compP, 'uTint'), ...hex(P.tint));
      gl.uniform3f(U(compP, 'uHighlight'), ...hex(P.highlightColor));
      gl.uniform1f(U(compP, 'uStrength'), P.strength);
      gl.uniform1f(U(compP, 'uSwirl'), P.swirl);
      gl.uniform1f(U(compP, 'uDispersion'), P.dispersion);
      gl.uniform1f(U(compP, 'uGlint'), P.glint);
      gl.uniform1f(U(compP, 'uTintAmount'), P.tintAmount);
      gl.uniform1f(U(compP, 'uGrayscale'), P.grayscale ? 1 : 0);
      gl.bindVertexArray(compVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
      gl.activeTexture(gl.TEXTURE0);
    },
  };
}
