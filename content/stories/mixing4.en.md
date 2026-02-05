---
title: "Mixing Course - Part 4: Digital Audio Resolution (Sample Rate & Bit Depth)"
date: 2025-11-15
author: "Studio NOL"
category: "lesson"
tags: ["Mixing", "Lesson", "Digital", "SampleRate", "BitDepth"]
---
![Digital audio waveform](/images/recording8.png)

“Should I record at 44.1 kHz or 48 kHz?”
“What’s the difference between 16‑bit and 24‑bit?”

Do numbers make your head hurt? Don’t worry. It’s the same as images.
Just like taking a photo of what you see, recording sound into a computer (AD converting) becomes easy once you get the idea.

## 1. Sample rate: frames per second in video

Sample rate is the **resolution of time**—how many slices per second you take. (Click‑click!)

* **Video analogy**:
  * Film (24 fps): smooth and natural.
  * Games (60 fps): very fluid and realistic. (Silky!)
  * Slow motion (120 fps): captures even fast moments.
* **Audio**:
  * **44.1 kHz**: 44,100 samples per second. The CD standard and the minimum needed to fully capture the human hearing range (20 kHz).
  * **48 kHz**: 48,000 samples per second. The video/film broadcast standard. Slightly better high‑frequency detail than 44.1 kHz.
  * **96 kHz**: extremely detailed, but file size doubles and your computer struggles. (Hear that fan?)

**Practical tips**:
* **For music release**: 44.1 kHz or 48 kHz is enough. Even if you record at 96 kHz, streaming sites will convert to 44.1/16‑bit anyway.
* **For video/YouTube**: always use **48 kHz**. This avoids sync disasters in video editors. (If lips move but no sound—big trouble.)

## 2. Bit depth: color depth in photos

Bit depth is the **resolution of volume**—how finely you can represent sound from the quietest to the loudest.

* **Photo analogy**:
  * **16‑bit (256 colors)**: colors look banded like old game graphics. Gradients look stepped.
  * **24‑bit (true color)**: natural color like what our eyes see, even in dark shadows. (Rich!)
* **Audio**:
  * **16‑bit**: CD quality. Good enough, but very quiet sounds can get buried in noise. Dynamic range about 96 dB.
  * **24‑bit**: studio standard. Captures whispers to explosions vividly. Dynamic range about 144 dB—covering almost the entire real‑world range.
  * **32‑bit float**: a “magic” format that practically never clips. Often used in field recorders. (Invincible!)

**Practical tips**:
* Always record at **24‑bit**.
* Convert to 16‑bit only at final mastering (with dither) for CD. During production, keep 24‑bit (or 32‑bit) throughout.

## 3. So what should I set it to?

Don’t overthink it. Here’s the answer.

* **Music (pop, etc.)**: **48 kHz / 24‑bit** (48 kHz is common these days)
* **Video (YouTube, film)**: **48 kHz / 24‑bit**
* **High‑fidelity (classical, jazz)**: **96 kHz / 24‑bit** (if overtones matter)

You only set this once when creating a project.
If you change it mid‑project, audio speed and pitch will be a mess. (Whoops!)
(It’ll sound like chipmunks or a stretched monster voice.)

Digital theory isn’t that hard, right?
A camera with good color depth (24‑bit) shooting enough frames per second (48 kHz) is the start of high‑quality recording. (Click!)

---

### [Common Beginner Mistakes] 🔢
* **“Higher numbers are always better!”** Recording everything at 192 kHz. File size explodes and the computer screams (whirrr), but your ears can’t even tell the difference from 48 kHz.
* **“The 16‑bit trap.”** You accidentally set 16‑bit while working. Later you hear your reverb tail crackle and cry. Always work at 24‑bit or higher.
* **“Changing mid‑project.”** You switch sample rate from 48 to 44 mid‑work. Suddenly the song stretches or becomes chipmunk‑like. It’s as dangerous as changing a patient’s blood during surgery.
