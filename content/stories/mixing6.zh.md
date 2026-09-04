---
title: 混音课程 - 第 6 部：用眼睛读声音（米特的全部）
date: 2025-11-17T00:00:00.000Z
lastmod: 2026-07-06
author: Studio NOL
category: lesson
tags:
  - 混音
  - 课程
  - 计量
  - Metering
  - Loudness
summary: >-
  “我不敢相信自己的耳朵。” 那你需要一个可靠的朋友：电平表（Level Meter）。 它们不会撒谎，但我们要听懂它们在说什么。（竖起耳朵！） 1.
  峰值表（Peak Meter）：一瞬的刹那 DAW 里上下跳动的那根柱子就是峰值表。 它显示 “最响瞬间的数值”。哪怕只有 0.001 秒超过 0 d
thumbnail: /images/recording1.webp
---
![多种电平表](/images/console.webp)

“我不敢相信自己的耳朵。”
那你需要一个可靠的朋友：**电平表（Level Meter）**。
它们不会撒谎，但我们要听懂它们在说什么。（竖起耳朵！）

## 1. 峰值表（Peak Meter）：一瞬的刹那

DAW 里上下跳动的那根柱子就是峰值表。
它显示 **“最响瞬间的数值”**。哪怕只有 0.001 秒超过 0 dB，也会立刻亮红灯。（哎呀红灯！）

* **作用**：防止削波（Clipping）
* **局限**：它不会告诉你“响度”。
  * 例如一个很短的军鼓“啪！”可能峰值到 ‑3 dB。
  * 但铺底的合成器 Pad 峰值可能只有 ‑10 dB。（呜——）
  * 峰值表看起来军鼓更大，但 **耳朵听起来 Pad 更响**。

所以只信峰值表混音，最后会疑惑：“为什么我的歌听起来这么小？”

## 2. RMS 与 LUFS：像人耳一样听

人耳感知的“响度”更多来自一段时间内的 **平均能量**，而不是短暂峰值。

### RMS（Root Mean Square）

* 计算平均电压（能量）。
* 比峰值表更接近我们耳朵感受到的大小。
* 类似过去模拟时代的 VU 表。

### LUFS（Loudness Units Full Scale）

* 现在的 **标准**，比 RMS 更先进。
* 反映人耳听觉特性（Fletcher‑Munson 曲线等），最准确地给出 **“人真正感受到的响度”**。（靠谱！）
* YouTube、Spotify、Apple Music 等平台都会按 LUFS 做音量归一化。

## 3. 实战计量指南

不用记复杂术语，照做就行。

### (1) 单轨平衡：看峰值也听耳朵

像踢鼓、人声这样的单轨，把峰值控制在 **‑6 dB ~ ‑10 dB** 左右。（安全！）

### (2) 混音总线：看 LUFS

在 Master 上挂一个免费的 LUFS 表插件（Youlean Loudness Meter 等）。

* **Short‑term LUFS**：约 3 秒平均值。副歌爆发时能到 **‑10 ~ ‑8 LUFS** 吗？（轰——）
  * 太低（‑14 LUFS）：声音小，后期要推很多。
  * 太高（‑6 LUFS）：过大，动态很可能被压扁。
* **Integrated LUFS**：整首歌的平均值。参考平台标准（YouTube ‑14、Apple ‑16），但不必强行对齐。（商业唱片通常更大，约 ‑9 ~ ‑7 LUFS。）

## 4. 动态范围（峰值 − RMS/LUFS）

高手的技巧就在这里。
看 **峰值和 RMS/LUFS 的差值**。

* 差值大（10 dB 以上）：有冲击力，动态活着。（啪！）
* 差值小（3 dB 以下）：太压扁、很闷。（小心过度压缩/限制！）

电平表就像车子的速度表。
只盯着速度表开车会出事故。看前方（音乐），偶尔瞄一下表（米特）。
最准确的米特依然是你的 **耳朵**。（竖起耳朵！）

---

### [初学者常见错误] 👁️

* **“用眼睛混音”**：不听，只盯波形漂不漂亮、数值是不是 ‑14。如果数字就是真理，AI 早就统治世界了。（叮！）
* **“为 Integrated 拼命”**：为了对齐整曲平均值，把起承转合全削掉。副歌应该炸开，不要为了平均值谋杀副歌。
* **“峰值表迷信”**：觉得“没亮红就安全”。但 RMS 过高会导致耳朵疲劳，人们 30 秒就关歌。

---

### 混音课程系列导航

* [第 1 部 混音是什么](/stories/mixing1) · [第 2 部 增益分段](/stories/mixing2) · [第 3 部 相位](/stories/mixing3) · [第 4 部 EQ 基础](/stories/mixing4) · [第 5 部 EQ 实战](/stories/mixing5) · **第 6 部 动态压缩** · [第 7 部 压缩实战](/stories/mixing7) · [第 8 部 多段压缩](/stories/mixing8) · [第 9 部 侧链](/stories/mixing9) · [第 10 部 限制器](/stories/mixing10)
* [第 11 部 扩展器·门](/stories/mixing11) · [第 12 部 饱和与真空管](/stories/mixing12) · [第 13 部 声像](/stories/mixing13) · [第 14 部 立体声成像](/stories/mixing14) · [第 15 部 参考曲](/stories/mixing15) · [第 16 部 增益检查](/stories/mixing16) · [第 17 部 总线处理](/stories/mixing17) · [第 18 部 混响](/stories/mixing18) · [第 19 部 延迟](/stories/mixing19) · [第 20 部 调制](/stories/mixing20)
* [第 21 部 饱和·失真](/stories/mixing21) · [第 22 部 自动化](/stories/mixing22) · [第 23 部 母带](/stories/mixing23)
* [📚 混音完全指南（全系路线图）](/stories/mixing-complete-guide)

### 关于 Studio NOL

Studio NOL 位于首尔恩平区，距连新内（Yeonsinnae）站步行 5 分钟，是一间面向独立音乐人、歌手和制作人的精品录音 · 混音工作室。R03 混音间配备 Genelec 监听链与经过声学处理的环境，帮助你对低频、混响尾音、立体声宽度做出不再靠“猜”的判断。除了这套混音课程，我们也提供专业的 [混音 · 母带服务](/pricing)，以及每周一次的 [Bulgwang Mixing Club](/stories/bulgwang-mixing-club) 线下交流聚会。

### 延伸学习与实战

* 想把课程内容带进作品？可直接提交作品到 [在线混音委托](/stories/onlinemix1)。
* 想边学边练？[一对一混音课程](/lesson) 按你的作品节奏定制学习进度。
* 想加入社群？关注我们每周一发布的 Bulgwang Mixing Club 名额公告。

对课程内容有疑问或想预约课程，可通过 KakaoTalk 频道 “连新内 Studio NOL” 联系，或发短信至 %%phone%%。每一集课程都会在开头的 summary 里标明重点；如果你是第一次接触混音，建议从 [第 1 部](/stories/mixing1) 顺序阅读，每集学完一个概念、回到 DAW 动手试一次，再看下一集——这是我们最推荐的节奏。
