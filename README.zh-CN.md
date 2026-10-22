# song-mv

**English** · [简体中文](README.zh-CN.md)

**用代码渲染音乐视频。** 给它一首歌和一个 `.lrc`，它逐帧画出踩点的画面——不用素材库、不用 After Effects、不开浏览器、不占 GPU。歌词是可以编排的字体动画，背景是代码画出来的场景（凌晨两点的键盘、通知轰炸的工位、熄灯写字楼、打给 110 的电话、吃掉户型图的橡皮擦）。

两种用法：

- **DSH 插件**——装一次，之后直接在 DSH 里让 agent 根据一首歌生成 MV；
- **独立命令行**（`song-mv analyze|plan|preview|render|qa`）——不需要 agent。

```
song  ─▶ analyze ─▶ features.json ─┐
                                   ├─▶ render ─▶ 原始帧 ─(管道)─▶ ffmpeg ─▶ .mp4
storyboard.json ───────────────────┘                              ▲
lyrics.lrc ─────────────────────────────────────────────────────────┘
```

**[▶ 观看 54 秒 demo（webm，无声）](docs/demo/demo.webm)** · [九宫格预览](docs/demo/contact-sheet.png)

![九个场景](docs/demo/contact-sheet.png)

*上面每一帧都是代码画的：没有素材、没有图片、没有内置字体。demo 的音频由 ffmpeg 合成、歌词为本仓库原创——见 [`examples/synthetic-demo`](examples/synthetic-demo)。*

> **关于它是怎么做出来的。** 这套引擎是对着一首商业歌曲（我自己在网易云买的）和它的 `.lrc`
> 调出来的。那首歌的音频、它的歌词、以及由它渲染出来的任何视频，都不在本仓库、也不在提交历史里。
> 这里给的是引擎、分镜格式和上面的合成 demo。你拿自己拥有的歌去跑，成品是你自己的；
> 把那个成品发出去是否合规，由你当地的著作权规则决定，不是这个仓库能替你回答的。

渲染是**时间的纯函数**：`renderFrame(t)` 每次运行都画出完全相同的像素。所以它可以被脚本驱动、可以 diff、改一行就能放心重渲。

---

## 安装

### 前置条件（两个，都需要你自己装）

| 依赖 | 版本 | 怎么装 |
|---|---|---|
| **Node.js** | ≥ 20.10 | [nodejs.org](https://nodejs.org/) 下载 LTS 版，一路下一步 |
| **ffmpeg** | ≥ 6.0 | [ffmpeg.org/download.html](https://ffmpeg.org/download.html) 按你的系统下载，解压后把 `bin` 目录加进 `PATH` |

装完自检：

```bash
node -v          # v20.10 或更高
ffmpeg -version  # 能打印版本就行
```

ffmpeg 不随本插件分发，也不会自动下载——这是刻意的（原因见[授权](#授权)）。缺了它，`render` 会直接告诉你去哪个网址装。

### 作为 DSH 插件安装（推荐）

```bash
git clone <本仓库地址> dsh-song-mv
cd dsh-song-mv && npm install        # 拉取 canvas，顺便验证能装
dsh plugin --profile desktop add "link:/绝对/路径/dsh-song-mv"
# 重启 DSH 一次，bundle 层才会加载
```

重启后：

1. 技能列表里出现 `song-mv`；
2. 依赖 `canvas` 已就位（npm 上多数平台有预编译包，没有的系统会自动从源码编译）；
3. **直接用一句话开工**：把音频文件（和歌词 `.lrc`，如果有）丢给 agent，说「用这首歌做个 MV」。
   agent 会自己走完 分析 → 读懂这首歌 → 起草分镜 → 渲静帧自检 → 全片渲染 → 验收，
   中间只在需要你拍板风格时才回来问。

**没有 `dsh` 命令？** 桌面版并不把 CLI 暴露到 `PATH`，这很常见。两条等效路线：

- **让 agent 帮你装**——DSH 自带插件管理器，agent 也可以直接替你改下面这几个文件；
- **手动改 profile**——把 `"dsh-song-mv": "link:/绝对/路径"` 加进
  `~/.dsh/profiles/desktop/package.json` 的 `dependencies`，把 `"dsh-song-mv"`
  加进同文件的 `dsh.profile.bundles`，在该目录跑 `pnpm install`，重启 DSH。
  逐步说明见 [docs/publishing.md](docs/publishing.md#5-installing-into-dsh)。

### 作为纯命令行使用

```bash
git clone <本仓库地址> dsh-song-mv
cd dsh-song-mv
npm install
node tools/cli.mjs help
```

装上插件后下面的命令一样能跑——插件只是在它上面多注册了一个 agent 技能。

macOS / Linux 上如果 `canvas` 装不上，缺的是系统库：

```bash
# macOS
brew install pkg-config cairo pango libpng jpeg giflib librsvg
# Debian / Ubuntu
sudo apt install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

---

## 五分钟上手

```bash
# 1. 解码 + 分析音频（ffmpeg 能读的格式都行）
node tools/analyze.mjs song.flac --out features.json
#    tempo 106.67 BPM · 5445 frames · 181.5s

# 2. 自动起草分镜（切点落在小节线上，场景按能量轮换）
node tools/plan.mjs --features features.json --out storyboard.json --shots 9

# 3. 手改 storyboard.json：填 lyricsFile，把占位参数换成这首歌真正的故事
#    场景参数见 docs/scenes.md

# 4. 先看静帧再决定要不要花十分钟渲染
node tools/preview.mjs --storyboard storyboard.json --features features.json \
  --audio song.flac --out out/preview

# 5. 渲染
node tools/render.mjs --storyboard storyboard.json --features features.json \
  --audio song.flac --out out/mv.mp4 --crf 18

# 6. 验收
node tools/qa.mjs --file out/mv.mp4
```

3 分钟 1080p 的片子，普通笔记本上大约 **25 fps**（约 3.5 分钟出片，CRF 18 约 57 MB）。

### `analyze` 的参数

| 参数 | 含义 |
|---|---|
| `--fps 30` | 节拍网格的帧率（要能整除采样率） |
| `--bpm 106.67` | 你知道真实速度时直接给——能量投票分不清 80 和 160 |
| `--out features.json` | 分析结果写哪 |

速度检测对"半速/倍速"这件事是诚实的：它会给出胜出的网格，外加 `tempoCandidates`（次优的节拍层级）。如果你听着觉得是半速，那不是 bug，加 `--bpm` 就好。

---

## 分镜长什么样

```jsonc
{
  "title": "delete",
  "duration": 181.5,
  "lyricsFile": "lyrics.lrc",
  "post": { "scan": 0.03 },          // 扫描线
  "safety": { "maxFlash": 0.7 },     // 全屏闪白上限（防光敏）
  "shots": [
    {
      "id": "05_call110",
      "start": 95.1, "end": 119.8,
      "palette": "intense",          // still|tender|build|release|intense|peak|dawn|fade
      "enter": "cut",                // cut|dissolve|wipe|glitch
      "loud": true,                  // 踩拍时镜头推一下
      "scene": {
        "type": "call110",
        "params": {
          "number": "110",
          "caller": "你好，我需要帮助。",
          "reply": "请讲，我在听。",
          "tickerText": "deadline · deadline · nobody answers the mail"
        }
      }
    }
  ]
}
```

必须记住的几条：

- **镜头要无缝铺满时间轴**——不能有空档、不能重叠，最后一个 `end` 等于歌曲时长。
- **`palette` 是情绪状态，不是配色**——`still` 是凌晨空办公室，`peak` 是副歌炸点。场景只读 `p.accent`、`p.text` 这类字段，换调色板等于整体换气。
- **`enter`** 是这个镜头怎么进来；`glitch` 留给鼓点砸下来的地方。
- **故事在 params 里。** demo 里出现的每一句话都写在它自己的分镜里，不在引擎里——`examples/nine-shots/storyboard.json` 是一份完整的九镜示例，可以逐行改成你自己的。

完整 schema：[docs/storyboard.md](docs/storyboard.md)。
场景目录和每个参数：[docs/scenes.md](docs/scenes.md)。

---

## 歌词

`lyricsFile` 指向标准 `.lrc`：

```
[00:00.50]one step at a time
[00:05.80]walking through the queue
[00:18.40]delete the noise
```

引擎按当前时间找到这一行，交给场景决定**怎么出现**（砸入、逐词弹跳、橡皮章、RGB 错位、卡拉 OK 填充、回声墙……）。没有时间戳的行会被忽略，所以给一个纯文本歌词文件，出来的就是没有歌词的视频。
时间戳支持 1–3 位小数（不同编辑器写法不一样）。

歌词是文字作品。没有授权就别把 `.lrc` 传上公网——见下一节。

---

## 授权

本仓库是 **MIT**。有意思的是它**不含**什么：

- **没有音乐、没有歌词、没有字体、没有 ffmpeg。** 四样都由你在运行时提供，`.gitignore` 拦着不让误提交。
- **ffmpeg 是独立进程调用**，不链接、不捆绑。按 GPL FAQ，这叫 mere aggregation：你产出的视频归你，仓库不背 ffmpeg 的任何义务。
- **字体只按字体名引用**（`Inter`、`Microsoft YaHei`、`Noto Sans CJK`……），实际渲染由操作系统提供。

如果你**要分发打包产物**（zip、Docker 镜像、单文件二进制）并且把 `node_modules` 塞进去了，那你就成了发行者：`canvas` 内嵌 **Cairo（LGPL-2.1 / MPL-1.1）**，canvas v3 还有 **Pango（仅 LGPL）**。动手前请读 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。

这类项目真正的风险从来不是 MIT 依赖，而是**演示素材**：一首商业歌曲、一个抓来的 `.lrc`、一个"就为跑个例子"提交的字体文件。所以 `examples/` 放的是**分镜格式本身**——带原创占位文案的镜头表——外加一个**合成 demo**：音频由 ffmpeg 生成、歌词为本仓库原创。

说准确一点：本仓库不含任何已发行歌曲的音频、不含照抄来的 `.lrc`、也不含用它们渲染出的视频。`examples/` 里的分镜描述的是*镜头结构*（时间、配色、场景类型），里面的文字是为示例写的。分镜不是录音、也不是歌词本；但如果你把别人的歌词填进分镜再把成品发出去，那是你的选择，MIT 许可证不为此背书。

---

## 仓库结构

```
engine/
  core.mjs        调色板、Features（踩点采样）、Lyrics、画布上下文、后处理、createEngine
  scenes.mjs      9 个场景函数，签名统一 (ctx, tv, f, params)
  lyric_fx.mjs    歌词手法：slam / bounce / wall / sliced / karaoke / decode……
  story_fx.mjs    故事道具：印章、跑马灯、电话、楼群、厨房、户型图、黑洞……
  prng.mjs        带种子的随机（同种子 → 同一帧）
tools/
  analyze.mjs     ffmpeg 解码 → WAV → FFT → features.json
  plan.mjs        按能量曲线起草分镜
  preview.mjs     只渲几张静帧
  render.mjs      全片渲染，原始帧直接进 ffmpeg
  qa.mjs          亮度曲线 + 闪烁检测
  cli.mjs         统一入口
  lib/analyze.mjs 纯 JS 的 FFT / mel / 节拍网格（不用 Python，不用 librosa）
skills/song-mv/   给 agent 的工作流
examples/         分镜示例：nine-shots（完整九镜，占位文案）、synthetic-demo（全原创）
docs/
```

渲染模型为什么长这样，见 [docs/how-it-works.md](docs/how-it-works.md)。

---

## 常见问题

**为什么用 canvas 而不是浏览器？** 帧在无头环境生成，原始 RGBA 直接进 ffmpeg。没有页面加载、没有截图时序、没有 60fps 上限、不占 GPU，而且输出是确定的。

**能加自己的场景吗？** 能——在 `engine/scenes.mjs` 里写 `export function myscene(ctx, tv, f, P)`，用 `ctx.g` 画、从 `ctx.pal` 取色、从 `lyricsOf(ctx).activeAt(tv)` 取歌词，然后注册到 `SCENES`。分镜里写 `"type": "myscene"` 即可。

**第一帧为什么是黑的？** 入场转场（`dissolve` / `glitch`）是从黑场淡入的。第一个镜头用 `"enter": "cut"` 就好。

**我机器上渲染很慢。** canvas 是 CPU 渲染，1080p 本来就吃 CPU。迭代时用 `--fps 24`，或者 `--start 60 --end 90` 只渲一段。

**能放图片或照片吗？** 在场景里 `canvas.loadImage()` 载入即可，但要先确认你有那张图的使用权。

---

## 许可

MIT © 2026 dsh-song-mv contributors。见 [LICENSE](LICENSE) 与 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。
