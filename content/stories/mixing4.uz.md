---
title: "Miks kursi - 4-qism: Raqamli audio aniqligi (Sample Rate & Bit Depth)"
date: 2025-11-15
author: "Studio NOL"
category: "lesson"
tags: ["Mixing", "Dars", "Digital", "SampleRate", "BitDepth"]
---
![Raqamli audio to'lqin shakli](/images/recording8.webp)

“44.1 kHz'da yozaymi yoki 48 kHz'da?”
“16‑bit bilan 24‑bit nimasi bilan farq qiladi?”

Raqamlar boshingizni og'ritadimi? Xavotir olmang. Bu rasmga o'xshaydi.
Ko'rgan narsangizni suratga olish kabi, ovozni kompyuterga yozish (AD konvertatsiya) g'oyasini tushunsangiz oson.

## 1. Sample rate: videodagi fps kabi

Sample rate — **vaqt aniqligi**, ya'ni bir soniyada nechta bo'lak olishingiz. (Klik‑klik!)

* **Video analogiyasi**:
  * Film (24 fps): silliq va tabiiy.
  * O'yinlar (60 fps): juda silliq va realistik. (Ipakdek!)
  * Slow motion (120 fps): tez lahzalarni ham ushlaydi.
* **Audio**:
  * **44.1 kHz**: soniyasiga 44,100 sample. CD standarti va inson eshitish doirasini (20 kHz) to'liq qamrab oluvchi minimum.
  * **48 kHz**: soniyasiga 48,000 sample. Video/film standartidir. 44.1 kHz'dan biroz ko'proq yuqori detallar beradi.
  * **96 kHz**: juda batafsil, lekin fayl hajmi ikki baravar, kompyuter ham qiynaladi. (Ventilyator ovozi eshitilyaptimi?)

**Amaliy maslahatlar**:
* **Musiqa relizi uchun**: 44.1 kHz yoki 48 kHz yetarli. 96 kHz'da yozsangiz ham, streaming saytlar baribir 44.1/16‑bitga o'giradi.
* **Video/YouTube uchun**: doimo **48 kHz** ishlating. Bu video montajda sync muammolarini oldini oladi. (Lab qimirlaydi, ovoz yo'q — katta muammo.)

## 2. Bit depth: rasmdagi rang chuqurligi

Bit depth — **ovoz balandligining aniqligi**, ya'ni eng pastdan eng balandgacha qanchalik nozik ifodalanishi.

* **Foto analogiyasi**:
  * **16‑bit (256 rang)**: eski o'yin grafikasi kabi ranglar chiziqlanadi, gradientlar bosqichli.
  * **24‑bit (true color)**: ko'zimiz ko'radigan tabiiy rang, hatto soyalarda ham. (Boy!)
* **Audio**:
  * **16‑bit**: CD sifati. Yetarli, lekin juda past tovushlar shovqinga ko'milib qolishi mumkin. Dinamik diapazon taxminan 96 dB.
  * **24‑bit**: studio standarti. Pichirlashdan portlashgacha aniq ushlaydi. Dinamik diapazon ~144 dB — deyarli real hayot to'liq qamrovi.
  * **32‑bit float**: amalda clip bo'lmaydigan “sehrli” format. Odatda field recorderlarda ishlatiladi. (Yengilmas!)

**Amaliy maslahatlar**:
* Har doim **24‑bit**da yozing.
* Faqat yakuniy masteringda (dither bilan) CD uchun 16‑bitga o'tkazing. Ish jarayonida 24‑bit (yoki 32‑bit)ni saqlang.

## 3. Xo'sh, qaysini tanlaymiz?

Ko'p o'ylamang. Javob mana.

* **Musiqa (pop va h.k.)**: **48 kHz / 24‑bit** (hozir 48 kHz ko'proq ishlatiladi)
* **Video (YouTube, film)**: **48 kHz / 24‑bit**
* **Hi‑fi (klassik, jazz)**: **96 kHz / 24‑bit** (agar obertonlar muhim bo'lsa)

Buni faqat loyiha yaratayotganda bir marta sozlaysiz.
O'rtada o'zgartirsangiz, audio tezligi va pitch buziladi. (Voy!)
(Chivinli sincap yoki cho'zilgan maxluq ovozi kabi eshitiladi.)

Raqamli nazariya unchalik qiyin emas, to'g'rimi?
Rang chuqurligi yaxshi (24‑bit) va kadrlar yetarli (48 kHz) bo'lgan “kamera” — yuqori sifatli yozuvning boshlanishi. (Klik!)

---

### [Boshlovchilar qiladigan xatolar] 🔢
* **“Raqam qancha baland bo'lsa, shuncha yaxshi!”** Hammasini 192 kHz'da yozish. Fayl hajmi portlaydi, kompyuter baqiradi (vuu‑vuu), lekin quloq 48 kHz'dan farqni sezmaydi.
* **“16‑bit tuzog'i.”** Ish jarayonida tasodifan 16‑bitni qo'yasiz. Keyin reverb tail "qirt‑qirt" bo'lib eshitilib, yig'lagudek bo'lasiz. Har doim 24‑bit yoki undan yuqorida ishlang.
* **“O'rtada o'zgartirish.”** Ish vaqtida sample rate'ni 48 dan 44 ga almashtirasiz. Qo'shiq cho'zilib ketadi yoki sincapga o'xshaydi. Bu operatsiyada bemorning qonini almashtirishdek xavfli.
