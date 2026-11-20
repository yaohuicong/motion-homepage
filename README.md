# motion-homepage · 会动的个人主页

一个给 AI 助手用的 Skill（Claude Code 等支持 Skill 的工具）：让助手一步步带你做一个"会动"的个人主页——

- **鼠标追视**：首屏的 3D 角色跟着鼠标转头，每个方向一个不同的表情；
- **鼠标划过的波纹扭曲**：划过角色留下旋转的波纹，点击向外扩散；
- **滚动衔接**：往下滚，角色在各个版块之间连续表演（走过去、坐下、躲起来、跳出来）；
- **手绘涂鸦风**：涂鸦一笔画出再抖动、颜料色块慢慢变形、对话气泡、浮动的小贴纸；
- **作品区**：能点开的文件夹作品目录 + 横向作品轮播；
- 纯静态网站，最后拖进 Netlify 就能得到公开链接。

> 角色、动作视频由你自己的 AI 生图/生视频工具生成；Skill 负责告诉助手怎么规划、怎么写提示词、怎么检查、怎么拼进网页。

*English: A skill for AI coding assistants to build an animated portfolio site — a 3D character whose head follows your mouse, scroll-driven transitions between sections, a ripple-distortion cursor and a hand-drawn doodle style. Bring your own image/video generator.*

## 安装

```bash
git clone https://github.com/yaohuicong/motion-homepage ~/.claude/skills/motion-homepage
```

其他支持 Skill 的工具：把整个文件夹放到它读取 Skill 的目录。

装好后直接对助手说：**"帮我做一个会动的个人主页"**。准备好这些会更快：

- 你的照片或角色形象（已有 IP 也行）；
- 一两张喜欢的网站风格参考图；
- 履历、作品图、联系方式（没有也能先用占位）。

## 先看看模板

```bash
cd ~/.claude/skills/motion-homepage/template
python3 ../scripts/serve.py 8000
```

浏览器打开 http://localhost:8000 。模板自带一个简笔占位角色，所有交互都能直接体验；做你自己的主页时，助手会带你换成 AI 生成的 3D 角色和视频。

> 必须用本地服务器打开，直接双击 `index.html` 时浏览器会拦截脚本。

## 需要的工具

| 工具 | 用途 |
| --- | --- |
| Python 3 + ffmpeg | 把视频拆成网页用的帧（必需） |
| Pillow（`pip install pillow`） | 抠贴纸、检查背景色 |
| Node.js 18+ | 检查配置、下载鼠标波纹组件、自动截图验收 |
| Chrome / Chromium | 自动截图验收（可选） |
| 生图工具 | 角色定稿图、姿态图、贴纸 |
| 图生视频工具 | 追视和衔接动画。能传"首帧 + 尾帧"最好；只能传首帧也行，Skill 里有实测做法（星形追视、链式生成、倒放法） |

没有视频工具时也能做：追视用几张方向图，衔接用两张姿态图溶解过渡，效果弱一些。

## 目录

```
SKILL.md          给助手看的工作流程
references/       规划、提示词、建站与排错、部署、设计参考
scripts/          frames.py（视频→帧）、check-site.mjs（检查）、cutout.py（抠贴纸）、
                  fetch-reactbits.mjs（下载鼠标波纹组件）、serve.py（本地预览）、shoot.mjs（截图验收）
template/         可直接运行的网站模板，内容都在 site.config.js
```

## 许可

- 本仓库的代码与文档：MIT（见 [LICENSE](LICENSE)）。
- 鼠标波纹效果来自 [React Bits](https://reactbits.dev) 的「Ripple Distortion」（MIT + Commons Clause）。它的许可允许用在你自己的网站里，但不允许再分发组件本身，所以**本仓库不包含它的代码**；建站时 `scripts/fetch-reactbits.mjs` 会从官方仓库下载到你的站点目录。详见 [THIRD_PARTY.md](THIRD_PARTY.md)。
- 你用 Skill 做出来的网站、生成的角色和素材归你自己。
