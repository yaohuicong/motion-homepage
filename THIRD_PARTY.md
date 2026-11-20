# 第三方组件与资源

| 名称 | 怎么用到 | 许可 | 是否包含在本仓库 |
| --- | --- | --- | --- |
| [React Bits](https://github.com/DavidHDev/react-bits)「Ripple Distortion」 | 鼠标划过人物的波纹扭曲（`stage.ripple.mode: 'reactbits'`） | MIT + Commons Clause | **不包含**。`scripts/fetch-reactbits.mjs` 在建站时把官方源码下载到你的站点 `vendor/reactbits/`，连同它的 LICENSE 一起随你的网站发布。该许可允许用在你自己的网站/产品里，但不允许单独出售或再分发组件本身（包括移植版）。 |
| Google Fonts（Permanent Marker、Gochi Hand、Poppins、Noto Sans SC、ZCOOL 系列、JetBrains Mono） | 页面字体，运行时从 Google Fonts 加载 | SIL Open Font License 1.1 | 不包含，只在 `site.config.js` 里引用链接 |
| ffmpeg | `frames.py` 拆帧 | LGPL/GPL | 不包含，需自行安装 |
| Pillow | `cutout.py`、`frames.py` 报背景色 | HPND | 不包含，需自行安装 |

`template/assets/demo/` 里的占位素材由 `scripts/make-demo-assets.py` 程序生成，随本仓库以 MIT 发布。
