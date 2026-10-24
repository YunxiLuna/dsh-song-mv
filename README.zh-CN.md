# song-mv

[English](README.md) · **简体中文**

给它一首歌和一份 `.lrc`，它逐帧画出踩点的画面。歌词当字体动画来画，而不是塞在底部字幕条里。

片子长什么样是你定的，不是继承来的默认值。**look（色世界）**决定整片的气质，一组**元素**搭出这首歌需要的画面，而每个镜头都必须声明**运镜**和**事件**——所以它动起来像片子，不像一张会呼吸的海报。

唱纸船的歌拿到纸、雨，和一条横穿画面的纸船；不会拿到一间办公室。

![七种色世界](docs/demo/looks.png)

*同一个 `field`/`water` 镜头、同一句词，换不同的 look。变的只有色世界。*

两种用法：装成 DSH 插件，之后直接在 DSH 里让 agent 出片；或者当命令行用，自己敲。

```
song  ─▶ analyze ─▶ features.json ─┐
                                   ├─▶ render ─▶ 原始帧 ─(管道)─▶ ffmpeg ─▶ .mp4
storyboard.json ───────────────────┘                              ▲
lyrics.lrc ─────────────────────────────────────────────────────────┘
```

**[▶ 54 秒 demo（webm，无声）](docs/demo/demo.webm)** · [联系表](docs/demo/contact-sheet.png)

![demo 的帧](docs/demo/contact-sheet.png)

*上面的帧都来自 demo，每一个像素都是代码画的：没有素材、没有图片、没有内置字体。音频由 ffmpeg 合成，歌词是为这个仓库写的——见 [`examples/synthetic-demo`](examples/synthetic-demo)。*

关于那些测试曲：这套引擎是对着几首商业歌曲（我自己在网易云买的）和它们的 `.lrc` 调出来的。那些音频、歌词、以及由它们渲出来的视频都不在本仓库里。这里留下的是引擎、分镜格式和上面那份合成 demo。

一帧是时间的纯函数。`renderFrame(t)` 每次给你同样的像素，所以你能改一行、重渲、逐像素对比；也所以渲染能干净地铺到多核上。

## 一个镜头 = 运镜 + 事件

引擎给每个场景套一台摄影机，所以没有画面会"碰巧静止"。每个镜头在分镜里选一个运动：

```json
{ "id": "03_sink", "start": 43.4, "end": 72.0,
  "palette": "build", "camera": "push", "cameraAmount": 0.09,
  "scene": { "type": "field", "params": {
    "layer": "water", "horizon": 560,
    "motif": "boat", "motifAt": [1080, 600, 240],
    "travel": [-220, 0], "stage": "sink", "sinkAt": 0.5,
    "lyricStyle": "karaoke" } } }
```

可选 `push` `pull` `panL` `panR` `tiltUp` `tiltDown` `rollCW` `rollCCW` `arc` `driftUp` `driftDown` `none`。场景内部三层深度以不同速率移动形成视差，主体沿 `travel` 穿过画面，`stage` 给它一条弧线（`enter` / `drift` / `sink` / `return`）——于是一首歌可以用一个主体讲完，而不是六张互不相干的图。节拍事件（光环、踢腿、镜头冲击）来自音频分析，不是手打的 keyframe。详见 [docs/motion.md](docs/motion.md)。

## 用什么画

一个镜头要么是 `designed`（你列元素，引擎来画），要么是内置场景类型。`designed` 是默认路线，不用写 JavaScript：

```json
{ "type": "designed", "params": {
  "elements": [
    { "kind": "plane", "at": [0.5, 0.80], "size": [1.02, 0.42], "vp": [0.62, 0.6],
      "cols": 7, "rows": 6, "fill": "panel", "depth": 0.4 },
    { "kind": "rect", "at": [0.22, 0.34], "size": [0.26, 0.30], "fill": "bg",
      "stroke": "line", "lw": 4, "form": "box", "material": "fabric" },
    { "kind": "text", "at": [0.22, 0.31], "size": 34, "text": "面 馆",
      "fill": "text", "track": 8, "plate": "panel" },
    { "kind": "figure", "at": [0.44, 0.50], "size": [0.055, 0.25], "pose": "stand",
      "fill": "shadow", "rim": true }
  ],
  "camera": "panR", "cameraAmount": 0.08, "backlight": 0.5, "dof": 8 } }
```

十二种笔画（`rect` `ellipse` `line` `poly` `arc` `text` `dots` `band` `blob` `grid` `plane` `figure`）、九种跟随 look 的颜色角色、逐元素深度与景深、`form` 体积着色（方/柱/球）、材质（纸、颗粒、金属、玻璃、水、织物、木）、主光与可选轮廓光，还有需要"演"而不是"摆"时的关键帧轨。全部在 [docs/imagery.md](docs/imagery.md)。

如果元素怎么摆都不够，就写场景——三条路线，从便宜到贵，闸门两边都测：

```bash
song-mv new-scene gutter --out scenes/gutter.mjs   # 生成一个立刻能渲染的场景骨架
song-mv check-imagery --storyboard storyboard.json # 构图：三层深度、地平线、密度
song-mv check-frame   --storyboard storyboard.json --features features.json  # 画面
song-mv check-motion  --storyboard storyboard.json --features features.json  # 运动
```

最后一个最要紧，因为一张静帧可以很好看、同时什么都不做：

```
shot            type     len   score   pixels  shift  frames
03_sink         field   28.6s    0.48     0.16    6.4  0/7  ← static
```

给这个镜头加上推镜、下沉的船、近景的雨之后，分数到 `2.16`，七对帧全都在变。完整流程见 `docs/scene-pipeline.md`。

## 歌词是时间问题，不是文字问题

当 `.lrc` 是逐字计时（`[00:37.67]<00:37.67>把名字从手机里 <00:39.79>悄悄删掉了`）时，填充跟着人声走；否则退化成固定阅读速率。如果一行的标签明显早于它的第一个字标记，引擎按**字标记**显示，于是文字落在人声上。

大多数"歌词对不上"是文件的问题，不是渲染器。流媒体导出的目录里常同时有 `song.lrc` 和 `song.std.lrc`，而 `.std` 是用每行**最后一个**字标记生成的——所以每一行都迟到，而且迟到的量还各不相同：

```
行                        逐字计时   .std    滞后
把名字从手机里 悄悄删掉了      37.67    43.42   +5.75 s
聊天记录停在最底下             28.61    29.85   +1.24 s
```

```bash
song-mv check-lyrics song.std.lrc --duration 200.9
# 对比 song.lrc：49 行匹配，49 行整体偏晚，中位滞后 1.96 秒
# PROBLEM: derived using each line's LAST word mark
```

`docs/lyrics.md` 讲了 offset 标签、间隔列怎么读、以及什么样的长间隔是片源的问题。

## 两个决定

生成式 MV 出问题，基本都出在这两处，所以 skill 要求在任何 JSON 之前先把它们说清楚。

**一、look。** 整片一个色世界。

| look | 世界 | 适合唱什么 |
|---|---|---|
| `paper` | 暖白、墨、折痕 | 记忆、信件、温柔 |
| `rain` | 湿冷的蓝灰 | 失落、距离、夜里的城市 |
| `daylight` | 明亮中性、干净空气 | 希望、清晨、释然 |
| `ember` | 深红棕、低照度 | 愤怒、燥、执念 |
| `mono` | 黑白 | 档案感、停住的悲伤 |
| `night-shift` | 深蓝霓虹、屏幕 | 深夜加班、反讽、压抑 |
| `cafe` | 奶油与焦糖、暖灯 | 凌晨、安慰、冷的幽默 |

**二、意象。** 五到八个观众真会看见的具体东西，每一个都能追到一句歌词。"一只纸船顺着雨水沟走下去"是意象；"悲伤"不是。如果某一段没东西可拍，回去重读歌词——不要拿上一首歌的场景来凑。

`docs/looks.md` 讲配色、一个 look 必须满足的明度梯、以及怎么加新世界。`docs/art-direction.md` 是决定"画面里放什么"的十条规矩——写任何镜头 JSON 之前先读它。

---

## 安装

### 依赖（两个，都由你自己装）

| 依赖 | 版本 | 从哪拿 |
|---|---|---|
| **Node.js** | ≥ 20.10 | [nodejs.org](https://nodejs.org/) 的 LTS |
| **ffmpeg** | ≥ 6.0 | [ffmpeg.org/download.html](https://ffmpeg.org/download.html)，解压后把 `bin` 加进 `PATH` |

```bash
node -v          # v20.10 或更新
ffmpeg -version  # 能打印版本就行
```

ffmpeg 不打包、不替你下载，这是故意的（见[授权](#授权)）。缺了它 `render` 会停下并直接给出对应平台的下载链接，而不是猜。没有 postinstall，包里也没有二进制。

macOS/Linux 上如果 `npm install` 找不到 Cairo/Pango：

```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg
# 或者
apt install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

### 作为 DSH 插件

```bash
git clone <本仓库> dsh-song-mv
cd dsh-song-mv && npm install        # 装 canvas，跑一次确认能编译
dsh plugin --profile desktop add "link:$PWD/dsh-song-mv"
# 重启一次 DSH，让 bundle 层加载
```

这会往 agent 的技能列表里加一个 `song-mv`，同时带上命令行。skill 会把 agent 领过整条流程：读歌 → 定 look 和意象 → `new` 工作目录 → `doctor` → `preview` → 三道闸门 → `render` → `qa`。

如果机器上没有 `dsh` 命令（桌面版不一定把它放进 `PATH`），有两条等价的路：

- 让 agent 装——DSH 有插件管理器，下面的文件改动它也能代做；
- 手改 profile：把 `"dsh-song-mv": "link:/abs/path"` 加到 `~/.dsh/profiles/desktop/package.json` 的 `dependencies`，把 `"dsh-song-mv"` 加到同一个文件的 `dsh.profile.bundles`，在该目录跑 `pnpm install`，重启 DSH。逐步说明：[docs/publishing.md](docs/publishing.md#5-installing-into-dsh)。

### 只用命令行

```bash
git clone <本仓库> dsh-song-mv
cd dsh-song-mv
npm install          # 下载/编译 canvas 原生模块
node tools/cli.mjs help
```

下面所有命令在装有插件时同样可用；插件只是在上面多了一层 agent skill。

## 五分钟上手

```bash
# 1. 每首歌一条命令：拷音频、找同名 .lrc、分析、生成一个六镜头的分镜
node tools/new.mjs work/my-song --audio song.flac
#    work/my-song/{song.flac, lyrics.lrc, features.json, storyboard.json, notes.md}

# 2. 先静态检查（毫秒级），别把时间花在渲染错误上
node tools/doctor.mjs --storyboard work/my-song/storyboard.json \
  --features work/my-song/features.json

# 3. 重写镜头：look、意象、切点（读 docs/art-direction.md）

# 4. 先看：每个镜头一张静帧，排进一张 PNG
node tools/sheet.mjs --storyboard work/my-song/storyboard.json \
  --features work/my-song/features.json --out work/sheet.png

# 5. 三道闸门
node tools/check-imagery.mjs --storyboard work/my-song/storyboard.json
node tools/check-frame.mjs   --storyboard work/my-song/storyboard.json --features work/my-song/features.json
node tools/check-motion.mjs  --storyboard work/my-song/storyboard.json --features work/my-song/features.json

# 6. 渲染。workers 默认 cores-1（上限 8）
node tools/render.mjs --storyboard work/my-song/storyboard.json \
  --features work/my-song/features.json --audio work/my-song/song.flac \
  --out work/mv.mp4 --crf 18

# 7. 检查成片
node tools/qa.mjs --file work/mv.mp4 --storyboard work/my-song/storyboard.json
```

### 渲染速度

帧之间互不依赖，所以默认铺到 worker 池里（`--workers`，或 `-j 1` 回到单进程）。

| workers | 12 秒 `designed` 重负载片段 | 加速 |
|---|---|---|
| 1 | 97 s | 1× |
| 2 | 53 s | 1.8× |
| 4 | 29 s | 3.3× |
| 8 | 17 s | 5.7× |
| 12 | 15 s | 6.5× |

一部 3:20、17 个镜头的片子，8 workers 下 **2.5 分钟**渲完（6026 帧，约 40 fps）；单进程要 25 分钟。并行与单进程的输出逐字节一致——颗粒噪点板是定种子生成的，每个 worker 画的都是同一张。

耗时从大到小：带景深的 `designed`（每帧 346 ms）、不带景深的 `designed`（157 ms）、`field`（30 ms）；后期（暗角、颗粒、levels）约 17%。`song-mv bench` 可以量你自己的片子。

### `analyze` 选项

| 参数 | 含义 |
|---|---|
| `--fps 30` | 节拍网格的帧率（必须能整除采样率） |
| `--bpm 106.67` | 已知速度时强制指定；纯能量投票分不清 80 和 160 |
| `--out features.json` | 分析结果写到哪 |

速度检测会额外给出 `tempoCandidates`（次优的节拍层级）。如果脉搏听上去是一半速度，那属于正常，用 `--bpm` 指过去。

---

## 分镜长什么样

```jsonc
{
  "title": "demo",
  "duration": 181.5,
  "lyricsFile": "lyrics.lrc",
  "look": "paper",                   // 整片的色世界
  "post": { "grain": 0.02,           // 胶片颗粒
            "levels": { "black": 0.16, "white": 0.92, "gamma": 0.96 } },
  "safety": { "maxFlash": 0.7 },     // 整帧闪光的钳制
  "shots": [
    {
      "id": "05_water",
      "start": 95.1, "end": 119.8,
      "palette": "intense",          // still|tender|build|release|intense|peak|dawn|fade
      "enter": "cut",                // cut|dissolve|wipe|glitch
      "loud": true,                  // 鼓点上镜头冲击
      "scene": {
        "type": "field",
        "params": {
          "layer": "water",          // paper|water|rain|snow|ink|motes|thread|window
          "motif": "boat",           // boat|window|moon|lantern|chair|birds
          "motifAt": [980, 600, 180],
          "horizon": 640,
          "lyricY": 880
        }
      }
    }
  ]
}
```

几点值得知道：

- 镜头必须把时间轴铺满：不能有空隙、不能重叠，最后一个 `end` 等于歌曲时长。`doctor` 用毫秒级的速度检查这一切。
- `palette` 是情绪不是颜色。look 把 `still`、`peak`、`dawn` 翻译成具体数值：`peak` 是这个世界最响的颜色。场景读调色板字段（`p.accent`、`p.text`…），换调色板就等于换整张画面的色。
- `enter` 是入场方式。同一场景内的 `dissolve` 会被当成 `cut`——场景中间黑一下是 bug，不是转场。
- 把一个长镜头切成三段是常规操作：给后两段 `t0Offset`（相对乐段起点的偏移），道具的时间线就延续下去，而不是每次都重演入场。
- `params` 带的是文案。demo 里出现的每一句文字都来自它的分镜，不是引擎内置。

字段表：[docs/storyboard.md](docs/storyboard.md)。场景与参数：[docs/scenes.md](docs/scenes.md)。其余都在 [docs/GUIDE.md](docs/GUIDE.md)——那是第一个该读的文件。

---

## 歌词

`lyricsFile` 指向标准 `.lrc`：

```
[00:00.50]one step at a time
[00:05.80]walking through the queue
[00:18.40]delete the noise
```

每个时间戳对应一行，引擎把当前行交给场景，场景决定它怎么出现：砸入、逐词弹跳、橡皮图章、RGB 错位、卡拉 OK 填充、回声墙。没有时间戳的行会被忽略，所以纯文本歌词会得到一部没有歌词的片子。时间戳允许一到三位小数（各家编辑器不一样），`[offset:±ms]` 也认。

歌词是文字作品，只放你有权使用的 `.lrc`。

---

## 授权

代码是 MIT。仓库里**没有**什么，和仓库里有什么同样重要：

- 不含音乐、不含歌词、不含字体、不含 ffmpeg。四样都由你在运行时提供，`.gitignore` 保证它们不会被提交。
- ffmpeg 作为独立进程运行，不链接、不打包。按 GPL FAQ 这属于 mere aggregation：你的片子是你的，仓库不承担 ffmpeg 的义务。
- 字体只按家族名引用（`Inter`、`Microsoft YaHei`、`Noto Sans CJK`），由系统渲染。

如果你分发带 `node_modules` 的打包产物（zip、Docker 镜像、单文件二进制），你就算是分发者：`canvas` 会带进 **Cairo（LGPL-2.1 / MPL-1.1）**，canvas v3 还带 **Pango（仅 LGPL）**。先读 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。

这类项目真正的风险从来不是 MIT 依赖，而是示例素材：一首商业歌曲、一份抓来的 `.lrc`、"就为演示"提交的字体。所以 `examples/` 只放分镜格式——带占位文案的镜头表——加一个合成 demo，音频由 ffmpeg 生成、歌词为本仓库原创。

说准确一点：本仓库没有已发行歌曲的录音、没有从歌曲转写的 `.lrc`、也没有用它们渲染的视频。分镜既不是录音也不是歌词页，但如果你把别人的歌词填进去并发布渲染结果，那是你的选择，不在 MIT 许可范围内。

---

## 仓库结构

```
engine/
  core.mjs         Features、Lyrics、画布上下文、后期（levels/扫线/颗粒/暗角）、createEngine
  looks.mjs        七种色世界；由四组调色板插值出八种状态
  elements.mjs     声明层：十二种笔画、颜色角色、深度、运动、主光
  materials.mjs    纸、颗粒、金属、玻璃、水、织物、木
  motion.mjs       缓动、摄影机（推拉摇移/俯仰/滚转/弧线/漂移/手持）、揭示
  primitive_fx.mjs 与故事无关的意象：颗粒、折痕、水、雨、浮尘、墨、线、光、母题
  scenes.mjs       designed + field + typeOnly，外加九个 office 场景
  actors.mjs       `designed` 用的道具注册表
  lyric_fx.mjs     歌词手法：slam / bounce / wall / sliced / karaoke / decode
  story_fx.mjs     office 场景的道具：图章、跑马灯、报警电话、楼群、厨房、户型图
  prng.mjs         定种子随机（同种子 → 同帧）
tools/
  new.mjs         一首歌一条命令：音频 + 歌词 + 特征 + 分镜
  analyze.mjs     ffmpeg 解码 → WAV → FFT → features.json
  plan.mjs        按能量曲线草拟分镜
  doctor.mjs      毫秒级静态校验，渲染之前先查
  preview.mjs     出几张静帧
  sheet.mjs       每镜一张静帧，合成一张 PNG 并附索引
  check-imagery.mjs / check-frame.mjs / check-motion.mjs   三道闸门
  check-lyrics.mjs  歌词时间审计（.std 陷阱、偏移、间隔）
  render.mjs      整片渲染，worker 池，原始帧直接进 ffmpeg
  bench.mjs       毫秒花在哪
  qa.mjs          亮度曲线 + 分得清"切点"和"误闪"的检测器
  cli.mjs         所有命令的单一入口
  lib/analyze.mjs 纯 JS 的 FFT / mel / 节拍网格（不依赖 Python、librosa）
  lib/pool.mjs    带有序回写的 worker 线程池
skills/song-mv/   agent 用的工作流
examples/         synthetic-demo（中性 54 秒曲）和 scenes/（一个手写场景）
docs/             先读 GUIDE.md，然后是 imagery / looks / motion / lyrics / 场景编写
```

---

## 常见问题

**为什么用 canvas 而不是浏览器？** 帧在无头环境生成，作为原始 RGBA 直接管道给 ffmpeg。没有页面加载、没有截图时序、没有 60 fps 上限、不需要 GPU，而且输出可复现。

**我能加场景吗？** `song-mv new-scene <名字>` 会生成一个立刻能渲染的场景：用 `ctx.g` 画，调色板在 `ctx.pal`，歌词在 `lyricsOf(ctx).activeAt(tv)`，基础笔画在 `ctx.lib`，缓动在 `ctx.mo`，摄影机在 `ctx.cam`。在 `SCENES` 里注册，然后让镜头引用它。

**闸门和我意见不一致。** 那是有意的。`check-imagery` 不懂音乐，`check-frame` 不懂运动，`check-motion` 不懂构图。三个同时挂，是镜头错了，不是闸门错了。

**第一帧为什么是黑的？** `dissolve` 或 `glitch` 入场是从黑淡入。把第一个镜头从 0 开始、`"enter": "cut"` 就好。

**我这儿渲染很慢。** 提高 `--workers`；不需要景深的镜头别开 `dof`；大场景优先用 `field`；迭代时用 `--start 60 --end 90` 加 `song-mv preview`。90 帧就能告诉你几乎所有问题。

**能用照片吗？** 在场景里用 `canvas.loadImage()` 加载，并确认你有使用权。

---

## 许可

MIT © 2026 dsh-song-mv contributors。见 [LICENSE](LICENSE)。
