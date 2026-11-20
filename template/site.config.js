/*
 * 整站唯一的内容与素材配置。改文字、换素材、调手感都在这里，不用动 js/。
 * 素材路径里的 {n} 会替换成 0001、0002…（scripts/frames.py 的输出格式）。
 * 坐标约定：画面坐标 0–1，x 向右、y 向下；视线方向 x 右正、y 下正。
 * 装饰 decor 的 x / y 是所在版块宽高的百分比；color 可写 accent / accent2 / accent3 / accent4 / fg 或 #色值。
 * 标题里用 {{词}} 会给这个词加一个手绘圈。
 */
window.SITE = {
  meta: {
    title: 'NOVA — Illustration & Motion Portfolio',
    description: 'A homepage that looks back at you.',
    lang: 'en',
  },

  theme: {
    bg: '#0d0d12',        // 页面底色：取素材背景的四角平均色（frames.py 会打印），页面和视频才能无缝相接
    panel: '#16161e',     // 卡片/面板底色
    fg: '#ffffff',
    muted: '#9a9aab',
    accent: '#d6ff3a',    // 荧光黄绿：主按钮、下划线、高亮、光标
    accent2: '#7b3fe8',   // 紫：色块、描边按钮
    accent3: '#3d9bff',   // 蓝：色块、涂鸦、对话气泡
    accent4: '#ff5a2e',   // 橙红：色块、点缀
    fontDisplay: '"Permanent Marker", "ZCOOL QingKe HuangYou", sans-serif',  // 手写马克笔大标题（英文在前，中文兜底）
    fontHand: '"Gochi Hand", "ZCOOL KuaiLe", cursive',                         // 小号手写注释
    fontBody: '"Poppins", "Noto Sans SC", system-ui, sans-serif',
    fontMono: '"JetBrains Mono", "Noto Sans SC", monospace',
    fontsHref: 'https://fonts.googleapis.com/css2?family=Permanent+Marker&family=Gochi+Hand&family=Poppins:wght@400;500;600;700&family=JetBrains+Mono:wght@500&family=Noto+Sans+SC:wght@400;500;700&family=ZCOOL+KuaiLe&family=ZCOOL+QingKe+HuangYou&display=swap',
  },

  brand: 'NOVA.',
  // 界面固定文字（默认英文）。中文站可改成：{ cta: '联系我', top: '回到顶部 ↑', close: '关闭', viewWorks: '查看作品 →', all: '全部', viewProject: '查看项目' }
  ui: { cta: "Let's talk" },
  order: ['hero', 'about', 'folder', 'works', 'outro'],

  // 人物舞台：一张全屏画布，首屏追视 + 段落之间播放衔接片段（滚动驱动）
  stage: {
    background: 'assets/demo/bg.webp',
    focusX: 0.62,          // 竖屏裁切时保留的横向焦点（人物所在位置）
    ripple: {              // 鼠标划过舞台的扭曲（WebGL）。不支持时自动退回 2D 光标拖尾
      enabled: true,
      // reactbits：React Bits「Ripple Distortion」（需先运行 scripts/fetch-reactbits.mjs 下载，没下载时自动用 liquid）
      // liquid：液体推开 + 彩虹色散；ripple：水波纹
      mode: 'reactbits',
      // 以下参数与 React Bits 官网调节面板同名，可在官网调好后照抄（括号里是面板中文名）
      brushSize: 70,       // 刷子尺寸 px：影响范围，原组件默认 150 太大，调小更精致
      strength: 0.05,      // 力量：画面被推开多少
      swirl: 2,            // 漩涡：扭曲方向随波纹旋转的程度
      rings: 3.75,         // 戒指：每个波纹里的圈数，越多纹路越细
      spread: 4,           // 传播：波纹扩散到刷子的几倍大
      fade: 1.2,           // 褪色：秒
      spacing: 12,         // 间距 px：鼠标每移动多少生成一个波纹
      dispersion: 0.5,     // 分散：彩虹色散，0 = 关
      glint: 0,            // 闪烁：高光
      tint: '#a855f7', tintAmount: 0.1,  // 着色 / 着色量
      grayscale: false,    // 灰度：原组件默认开（整张图变灰），这里关掉
      highlightColor: '#ffffff',
      trigger: 'both',     // hover 划过 / click 点击 / both 都有（推荐 both：划过留波纹，点击向外扩散）
      clickStrength: 2,    // 点击强度
      quality: 'medium',   // 位移场分辨率 low / medium / high
      // liquid / ripple 模式用的参数（改用这两种模式时 strength 改成 1 左右）
      radius: 0.05, damping: 0.955, clickBoost: 3, highlight: 0.1,
    },
    gaze: {
      // 追视闭环：从正面出发，依次看向 8 个方向，最后回到正面
      src: 'assets/demo/gaze/{n}.webp',
      count: 121,
      // 关键方向落在第几帧（f 从 0 开始）：正面→左→左上→上→右上→右→右下→下→左下→左→正面。
      // 真实视频用 tools/calibrate.html 标定，或用 frames.py gaze-join 自动生成
      keys: [
        { f: 0, x: 0, y: 0 }, { f: 12, x: -1, y: 0 }, { f: 24, x: -0.7, y: -0.7 },
        { f: 36, x: 0, y: -1 }, { f: 48, x: 0.7, y: -0.7 }, { f: 60, x: 1, y: 0 },
        { f: 72, x: 0.7, y: 0.7 }, { f: 84, x: 0, y: 1 }, { f: 96, x: -0.7, y: 0.7 },
        { f: 108, x: -1, y: 0 }, { f: 120, x: 0, y: 0 },
      ],
      head: { x: 0.66, y: 0.42 },  // 头部在画面中的位置，鼠标方向从这里算
      radius: 0.3,                 // 鼠标离头多远算"看满"（相对屏幕短边）
      deadzone: 0.16,              // 离头太近时回到正面
      speed: 90,                   // 沿时间轴追帧的速度（帧/秒）
      maxWalk: 30,                 // 目标帧太远时不逐帧走，改为快速溶解
      idleReturn: 3.5,             // 鼠标静止几秒后回正
    },
    // 段落衔接：to 段进入视口的过程中播放（从屏幕底到顶）。只有两张姿态图时加 blend: true
    transitions: [
      { from: 'hero', to: 'about', src: 'assets/demo/t1/{n}.webp', count: 72 },
      { from: 'about', to: 'folder', src: 'assets/demo/t2/{n}.webp', count: 72 },
      { from: 'folder', to: 'works', src: 'assets/demo/t3/{n}.webp', count: 60 },
      { from: 'works', to: 'outro', src: 'assets/demo/t4/{n}.webp', count: 72 },
    ],
  },

  sections: {
    hero: {
      nav: 'Home',
      greeting: "Hey, I'm",
      title: ['NOVA'],
      // titleScale: 0.6,             // 名字长（如 ANTENNA KID）时把大标题缩小，避免折行
      roles: ['Illustrator', 'Motion Designer', 'Visual Designer'],
      sub: 'I turn weird little ideas into stories that move.',
      ctas: [
        { label: 'See my work', href: '#works', icon: 'play' },
        { label: 'Say hi', href: '#outro', icon: 'arrow' },
      ],
      bubble: {                       // 角色头边的对话气泡：轮播几句，悬停按钮时换成 hover
        lines: ["Hi! Let's make\nsomething fun!", "Move your mouse —\nI'm watching you", 'Scroll down,\nI\'ll show you around'],
        hover: 'Click it!',
        offset: { x: -0.2, y: -0.27 }, // 气泡左上角相对头部的位置（屏幕宽/高的比例）
        every: 4.5,
      },
      scrollText: 'Scroll Down',
      // scrollX: 40,                // 底部滚动提示的横向位置（%），角色下半身挡住正中时往文字一侧挪
      side: 'left',
      decor: [
        { type: 'blob', color: 'accent2', x: -9, y: -16, size: 24 },
        { type: 'blob', color: 'accent3', x: -10, y: 72, size: 19 },
        { type: 'blob', color: 'accent4', x: 88, y: 20, size: 16 },
        { type: 'crown', color: 'accent', x: 31, y: 17, size: 54, rot: 12 },
        { type: 'arrow', color: 'fg', x: 2, y: 55, size: 56, rot: -12, mobile: false },  // mobile: false = 手机上隐藏；m: {x, y} = 手机上换位置
        { type: 'star', color: '#ffc83d', x: 84, y: 12, size: 34, fill: true },
        { type: 'squiggle', color: 'accent3', x: 74, y: 7, size: 62, rot: -8 },
        { type: 'smiley', color: 'accent', x: 47, y: 66, size: 50, rot: -12 },
        { type: 'bolt', color: 'accent', x: 55, y: 82, size: 34, rot: 10, fill: true },
        { type: 'sparkle', color: 'accent3', x: 45, y: 36, size: 22, fill: true },
        { type: 'dash', color: 'accent2', x: 86, y: 62, size: 40 },
      ],
    },
    about: {
      nav: 'About',
      eyebrow: '02 · About me',
      title: ['MY', 'STORY.'],
      side: 'right',
      timeline: [
        { year: '2014', range: '2014 — 2018', title: 'BA, Visual Communication', text: 'Covered every wall on campus with posters.' },
        { year: '2018', range: '2018 — 2021', title: 'Visual Designer, Tech Startup', text: 'Brand campaigns and launch visuals — 20+ projects end to end.' },
        { year: '2021', range: '2021 — 2024', title: 'Design Lead', text: 'Built the design system, led a team of 8, got hooked on motion and 3D.' },
        { year: '2024', range: '2024 — NOW', title: 'Independent Designer & Teacher', text: 'Brand and character projects, and sharing what I learn online.' },
      ],
      decor: [
        { type: 'blob', color: 'accent2', x: -10, y: -14, size: 18 },
        { type: 'squiggle', color: 'accent2', x: 58, y: 10, size: 78 },
        { type: 'star', color: 'accent', x: 93, y: 14, size: 28, fill: true },
        { type: 'zigzag', color: 'accent3', x: 47, y: 86, size: 70 },
      ],
    },
    folder: {
      nav: 'Folder',
      eyebrow: '03 · The folder',
      title: ['OPEN THE', '{{FOLDER}}!'],   // 数组 = 多行；人物在同侧时拆行避免压到
      folderLabel: 'Portfolio',
      hint: 'Click to open the folder',
      side: 'left',
      categories: [
        { key: 'brand', name: 'Branding', cover: 'assets/demo/works/w1.webp', text: 'Logos, identities and visual systems.' },
        { key: 'ui', name: 'UI Design', cover: 'assets/demo/works/w2.webp', text: 'Apps, websites and in-car screens.' },
        { key: 'ip', name: 'Characters', cover: 'assets/demo/works/w3.webp', text: 'Mascots, sticker packs and merch.' },
      ],
      decor: [
        { type: 'note', text: 'Open me!', color: 'accent', x: 42, y: 47, size: 30, rot: -8 },
        { type: 'arrow', color: 'accent', x: 39, y: 53, size: 58, rot: 100 },
        { type: 'spiral', color: 'accent3', x: 58, y: 24, size: 56 },
        { type: 'sparkle', color: 'accent', x: 47, y: 72, size: 26, fill: true },
        { type: 'blob', color: 'accent4', x: 90, y: -12, size: 15 },
      ],
    },
    works: {
      nav: 'Works',
      eyebrow: '04 · Selected works',
      title: 'SELECTED WORKS',
      items: [
        { title: 'Neon Night Market', cat: 'brand', year: '2025', cover: 'assets/demo/works/w1.webp', role: 'Brand strategy / Visuals', desc: 'New logo, wayfinding and campaign visuals for a night market.' },
        { title: 'Orbit In-Car UI', cat: 'ui', year: '2025', cover: 'assets/demo/works/w2.webp', role: 'UI / Motion', desc: 'Information architecture and motion for a car dashboard.' },
        { title: 'Little Monsters', cat: 'ip', year: '2024', cover: 'assets/demo/works/w3.webp', role: 'Character design', desc: 'A 24-sticker character pack.' },
        { title: 'Summer Fest Key Visual', cat: 'brand', year: '2024', cover: 'assets/demo/works/w4.webp', role: 'Key visual', desc: 'Posters, tickets and motion for the stage screens.' },
        { title: 'Pulse Fitness App', cat: 'ui', year: '2023', cover: 'assets/demo/works/w5.webp', role: 'UI design', desc: 'A workout tracker, from zero to launch.' },
        { title: 'City Wanderer', cat: 'ip', year: '2023', cover: 'assets/demo/works/w6.webp', role: 'Illustration', desc: '12 illustrations of hidden city corners.' },
      ],
      decor: [
        { type: 'squiggle', color: 'accent2', x: 44, y: 18, size: 64 },
        { type: 'star', color: 'accent', x: 90, y: 13, size: 30, fill: true },
        { type: 'heart', color: 'accent4', x: 5, y: 86, size: 32, rot: -10 },
      ],
    },
    outro: {
      nav: 'Contact',
      eyebrow: "05 · LET'S TALK",
      title: ['GOT AN IDEA?', "LET'S {{PLAY}}!"],
      sub: "Projects, commissions, or just a chat — my inbox is open.",
      contacts: [
        { icon: 'mail', label: 'Email', value: 'hello@example.com', href: 'mailto:hello@example.com' },
        { icon: 'pin', label: 'Based in', value: 'Shanghai', href: '#' },
        { label: 'Instagram', value: '@nova', href: '#' },
      ],
      // 角色周围漂浮的技能图标
      skills: [
        { abbr: 'Ps', name: 'Photoshop', color: '#31a8ff' },
        { abbr: 'Ai', name: 'Illustrator', color: '#ff9a00' },
        { abbr: 'Ae', name: 'After Effects', color: '#9999ff' },
        { abbr: 'Fg', name: 'Figma', color: '#a259ff' },
        { abbr: 'Bl', name: 'Blender', color: '#ff7a1a' },
        { abbr: 'C4', name: 'Cinema 4D', color: '#3d9bff' },
        { abbr: 'AI', name: 'AIGC', color: '#d6ff3a' },
      ],
      decor: [
        { type: 'blob', color: 'accent3', x: 86, y: 52, size: 18 },
        { type: 'blob', color: 'accent2', x: -9, y: -8, size: 15 },
        { type: 'sparkle', color: 'accent', x: 22, y: 12, size: 30, fill: true },
        { type: 'heart', color: 'accent4', x: 76, y: 10, size: 30, rot: 12 },
        { type: 'loop', color: 'accent2', x: 40, y: 6, size: 70 },
      ],
    },
  },

  cursor: { dot: true, trail: 'auto' },  // trail: 'auto' = 鼠标扭曲不可用时才画荧光笔拖尾（和扭曲叠在一起会太乱）；true = 总是画
};
