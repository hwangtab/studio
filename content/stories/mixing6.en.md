---
title: 'Mixing Course - Part 6: Reading Sound with Your Eyes (All About Metering)'
date: 2025-11-17T00:00:00.000Z
author: Studio NOL
category: lesson
tags:
  - Mixing
  - Lesson
  - Metering
  - Loudness
summary: >-
  “I can’t trust my ears.” Then you need a reliable friend: the level meter.
  Meters don’t lie. But we need to understand what they’re saying. (Listen cl
thumbnail: /images/recording1.webp
---
![Various level meters](/images/console.webp)

“I can’t trust my ears.”
Then you need a reliable friend: the **level meter**.
Meters don’t lie. But we need to understand what they’re saying. (Listen closely!)

## 1. Peak meter: the instant moment

That bar dancing up and down in your DAW is the peak meter.
It shows the **instantaneous maximum**. Even if only 0.001 seconds exceed 0 dB, it flashes red. (Uh‑oh, red!)

* **Role**: “Prevent clipping”
* **Limitation**: It doesn’t tell you loudness.
  * A quick snare hit might peak at ‑3 dB.
  * A huge synth pad might peak at ‑10 dB. (Woooom)
  * On the meter, the snare looks louder, but **to your ears the pad feels louder**.

So if you trust only the peak meter, you’ll wonder: “Why does my song feel quiet?”

## 2. RMS and LUFS: hearing like humans

Our ears perceive loudness based on **average energy over time**, not tiny peaks.

### RMS (Root Mean Square)

* Calculates average energy (voltage). (Solid!)
* Much closer to perceived loudness than peak meters.
* Similar role to the old analog VU meter.

### LUFS (Loudness Units Full Scale)

* Today’s **standard**. More advanced than RMS.
* Reflects human hearing (Fletcher‑Munson curve, etc.), giving the most accurate **perceived loudness** in numbers. (Crisp!)
* YouTube, Spotify, Apple Music—all streaming platforms normalize volume based on LUFS.

## 3. Practical metering guide

Forget the hard terms. Just follow this.

### (1) Track balancing: trust peaks and your ears

For individual tracks like kick and vocal, keep peaks around **‑6 dB to ‑10 dB**. (Safe!)

### (2) Mix bus: look at LUFS

Insert a free LUFS meter plugin (Youlean Loudness Meter, etc.) on the master.

* **Short‑term LUFS**: average over ~3 seconds. When the chorus hits, are you around **‑10 to ‑8 LUFS**? (Boom!)
  * Too low (‑14 LUFS): feels quiet. You’ll need a lot of mastering gain.
  * Too high (‑6 LUFS): too loud; dynamics are likely crushed.
* **Integrated LUFS**: average for the entire song. Be aware of streaming targets (YouTube ‑14, Apple ‑16), but don’t force them. (Commercial releases are often mastered much louder at ‑9 to ‑7 LUFS.)

## 4. Dynamic range (Peak – RMS/LUFS)

This is a real pro tip.
Look at the **difference between peak and RMS/LUFS**.

* Big difference (10 dB+): punchy sound with healthy dynamics. (Smack!)
* Small difference (under 3 dB): overly squashed and fatiguing. (Beware over‑compression/limiting!)

Meters are like a speedometer.
If you drive by staring only at the speedometer, you’ll crash. Look ahead (music), and glance at the meter occasionally.
The most accurate meter is still your **ears**. (Listen!)

---

### [Common Beginner Mistakes] 👁️

* **“Mixing with your eyes.”** You stop listening and obsess over waveforms or whether the meter says ‑14. If numbers were everything, AI would have already taken over. (Ding!)
* **“Living for the integrated value.”** You crush the whole song just to match integrated LUFS, killing the buildup and release. A chorus should explode—don’t commit that crime.
* **“Blind trust in peak meters.”** “No red, so it’s fine.” But if RMS is too high, ears fatigue and people stop listening in 30 seconds.
