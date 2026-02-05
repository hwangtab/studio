---
title: "Miks kursi - 6-qism: Ovozni ko'z bilan o'qish (metering haqida hamma narsa)"
date: 2025-11-17
author: "Studio NOL"
category: "lesson"
tags: ["Mixing", "Dars", "Metering", "Metering", "Loudness"]
---
![Turli daraja meterlari](/images/console.jpg)

“Qulog'imga ishonolmayman.”
Unda sizga ishonchli do'st kerak: **level meter**.
Meter yolg'on gapirmaydi. Lekin u nima deyayotganini tushunish kerak. (Diqqat bilan eshiting!)

## 1. Peak meter: lahzaviy cho'qqi

DAW'dagi yuqoriga‑pastga sakraydigan chiziq — peak meter.
U **lahzaviy maksimum**ni ko'rsatadi. 0.001 soniya 0 dB'dan oshsa ham qizil chaqnaydi. (Uh‑oh, qizil!)

* **Vazifasi**: “Clipping'ni oldini olish”
* **Cheklov**: U ovoz balandligini aytmaydi.
  * Tez snare urishi ‑3 dB'ga chiqishi mumkin.
  * Katta synth pad ‑10 dB bo'lishi mumkin. (Woooom)
  * Meterda snare baland ko'rinadi, lekin **quloq pad'ni balandroq deb his qiladi**.

Shuning uchun faqat peak meterga ishonsangiz: “Nega qo'shig'im past eshitilyapti?” deb qolasiz.

## 2. RMS va LUFS: inson qulog'iga o'xshab eshitish

Biz tovush balandligini **vaqt bo'yicha o'rtacha energiya**ga qarab his qilamiz, mayda cho'qqilarga emas.

### RMS (Root Mean Square)
* O'rtacha energiyani (kuchlanishni) hisoblaydi. (Barqaror!)
* Peak meterga qaraganda hissiy balandlikka yaqinroq.
* Eski analog VU meterlarga o'xshash vazifani bajaradi.

### LUFS (Loudness Units Full Scale)
* Bugungi **standart**. RMS'dan ham ilg'or.
* Inson eshitishini (Fletcher‑Munson egri chizig'i va h.k.) hisobga olib, **hissiy balandlik**ni eng aniq raqamlarda beradi. (Aniq!)
* YouTube, Spotify, Apple Music — barcha streaming platformalar LUFS bo'yicha ovozni normallashtiradi.

## 3. Amaliy metering qo'llanma

Qiyin terminlarni unuting. Shunga amal qiling.

### (1) Track balanslash: peak va quloqqa ishonish
Kick, vokal kabi individual treklar uchun peak'larni **‑6 dB dan ‑10 dB** atrofida saqlang. (Xavfsiz!)

### (2) Mix bus: LUFS'ga qarang
Masterga bepul LUFS meter pluginini qo'ying (Youlean Loudness Meter va h.k.).

* **Short‑term LUFS**: ~3 soniya o'rtacha. Refrenda **‑10 dan ‑8 LUFS** atrofidamisiz? (Boom!)
  * Juda past (‑14 LUFS): past eshitiladi. Masteringda ko'p gain kerak bo'ladi.
  * Juda yuqori (‑6 LUFS): juda baland; dinamikalar ezilgan bo'lishi mumkin.
* **Integrated LUFS**: butun qo'shiq bo'yicha o'rtacha. Streaming maqsadlarini (YouTube ‑14, Apple ‑16) biling, lekin majburlamang. (Ko'p tijoriy relizlar ‑9 dan ‑7 LUFS atrofida master qilinadi.)

## 4. Dynamic range (Peak – RMS/LUFS)

Bu haqiqiy pro maslahat.
**Peak va RMS/LUFS orasidagi farq**ga qarang.

* Katta farq (10 dB+): punchy va sog'lom dinamika. (Smack!)
* Kichik farq (3 dB dan kam): haddan tashqari siqilgan, quloqni charchatadi. (Over‑compression/limiting'dan ehtiyot bo'ling!)

Meterlar — tezlik o'lchagichga o'xshaydi.
Faqat spidometrga qarab haydasangiz, avariyaga uchraysiz. Oldinga (musiqa) qarang va vaqti‑vaqti bilan meterga ko'z tashlang.
Eng aniq meter baribir **quloq**dir. (Eshiting!)
