---
title: 'Mixing Course - Part 8: Setting the Table for Plugins (Gain Staging)'
date: 2025-11-19T00:00:00.000Z
author: Studio NOL
category: lesson
tags:
  - Mixing
  - Lesson
  - GainStaging
  - Headroom
  - InputLevel
summary: >-
  "I inserted a plug-in and the sound is weirdly distorted." "My compressor
  isn’t working." (Huh? What’s going on?) Your plug-ins aren’t broken. You’re
thumbnail: /images/recording3.webp
---
![Analog VU meter](/images/hardware5.webp)

"I inserted a plug-in and the sound is weirdly distorted."
"My compressor isn’t working." (Huh? What’s going on?)

Your plug-ins aren’t broken.
You’re force‑feeding them **too much food (input level)**. (Ack—too full!)

## 1. What is gain staging?

Simply put, it means **"setting the right level before the next stage."**
Audio passes through multiple stages (one by one!):
`Mic preamp` -> `EQ` -> `Compressor` -> `Master bus`

Gain staging is the "bouncer" that makes sure the level doesn’t get too loud or too quiet at each step.

## 2. The secret of -18 dBFS (why it matters)

In digital, 0 dBFS is the ceiling, right? (Watch your head!)
So why do so many pro engineers emphasize **-18 dBFS**?

Because of the **analog‑modeled plug‑ins** we love.
Plug‑ins that emulate classics like LA‑2A, 1176, or Pultec are built around analog behavior.
Analog gear’s reference level (0 VU) translates to roughly **-18 dBFS** in digital.

* **When input is around -18 dBFS**: the plug‑in sounds sweetest, warmest, and most musical. (The **sweet spot**.)
* **When input is near 0 dBFS**: the plug‑in overloads, distorts unpleasantly, or the compressor overreacts. (Yikes!)

## 3. Practical gain staging steps

Before you mix (or while recording), check the level of every track. (Carefully!)

1. **Check the meter**: Make sure the average level (RMS) hovers around -18 dBFS. (Peaks hitting -10 to -6 dB are fine.)
2. **Adjust clip gain**: Don’t touch the fader yet. Adjust the waveform level itself (**Clip Gain** or **Input Gain**).
   * Reduce overly large waveforms and boost tiny ones.
3. **Match plug‑in output**: If the volume jumps after inserting a plug‑in, lower the plug‑in’s **Output Gain** so the level matches the bypassed signal.

**"Volume in = Volume out"**

Follow this, and your mix will sound cleaner and more relaxed.

## 4. The beauty of small sounds

"If it’s quiet, doesn’t it lose power?"
Nope. During mixing, you want it clean and controlled.
The loudness comes at the very end—in **mastering**, with a limiter. (Boom!)

If you cram the level during mixing, the mastering engineer has no room to work. (Sigh...)
Leave **headroom**. That empty space is where punch and impact will land later.

Feed your plug‑ins a tasty meal (-18 dBFS).
They’ll reward you with their best sound. (Nom‑nom!)

---

### [Common Beginner Mistakes] 🍱

* **"Balancing with faders only"**: The waveform is huge, so you pull the fader way down. You waste all the fader resolution. Fix clip gain first so your fader lives near 0.
* **"Thinking louder = better"**: Our ears love louder sounds. "Wow, the plug‑in made it huge!" Nope—it just got louder. Use bypass and match levels before judging.
* **"Negative gain staging"**: You record too quietly so noise goes "shhh," then pile on plug‑ins. It’s like shooting through a dusty lens. Balance matters!
