---
title: "Miks kursi - 8-qism: Pluginlar uchun dasturxon (Gain Staging)"
date: 2025-11-19
author: "Studio NOL"
category: "lesson"
tags: ["Mixing", "Dars", "GainStaging", "Headroom", "InputLevel"]
---
![Analog VU meter](/images/hardware5.webp)

“Plugin qo'ydim, ovoz g'alati buzilib ketdi.”
“Kompressori ishlamayapti.” (Ha? Nima bo'lyapti?)

Pluginlaringiz buzilmagan.
Siz ularga **juda ko'p ovqat (input level)** tiqayapsiz. (To'lib ketdi!)

## 1. Gain staging nima?

Sodda qilib aytganda, **“keyingi bosqichdan oldin to'g'ri darajani sozlash.”**
Audio bir nechta bosqichdan o'tadi (birma‑bir!):
`Mic preamp` -> `EQ` -> `Compressor` -> `Master bus`

Gain staging — har bir bosqichda daraja juda baland yoki juda past bo'lib ketmasligini nazorat qiladigan “bouncer”.

## 2. -18 dBFS siri (nega muhim)

Digitalda 0 dBFS — shift, to'g'rimi? (Boshingizni urib olmang!)
Unda nega ko'p pro injyenerlar **-18 dBFS**ni ta'kidlaydi?

Sababi — biz sevgan **analog‑modelled pluginlar**.
LA‑2A, 1176, Pultec kabi klassiklarni taqlid qiladigan pluginlar analog xulq‑atvorga moslab qurilgan.
Analog uskunadagi 0 VU mos ravishda digitalda taxminan **-18 dBFS**ga teng.

* **Input -18 dBFS atrofida bo'lsa**: plugin eng shirin, eng iliq va musiqiy eshitiladi. (**Sweet spot**.)
* **Input 0 dBFS'ga yaqin bo'lsa**: plugin ortiqcha yuklanadi, yoqimsiz distortion paydo bo'ladi yoki kompressor haddan tashqari ishlaydi. (Voy!)

## 3. Amaliy gain staging bosqichlari

Miksdan oldin (yoki yozishda) har bir track darajasini tekshiring. (Ehtiyot!)

1. **Meterni tekshiring**: O'rtacha daraja (RMS) -18 dBFS atrofida bo'lsin. (Peak'lar -10 dan -6 dB gacha bo'lishi mumkin.)
2. **Clip gain'ni sozlang**: Faderga tegmang. Waveform darajasini o'zgartiring (**Clip Gain** yoki **Input Gain**).
   * Juda katta waveformni pasaytiring, juda kichigini ko'taring.
3. **Plugin chiqishini moslashtiring**: Plugin qo'shgach ovoz sakrab ketsa, **Output Gain**ni pasaytirib bypass signaliga tenglashtiring.

**“Volume kirishi = Volume chiqishi”**
Shu qoidaga amal qilsangiz, miksingiz toza va xotirjam eshitiladi.

## 4. Kichik tovushlarning go'zalligi

“Past bo'lsa, kuchi yo'qolmaydimi?”
Yo'q. Miks jarayonida toza va boshqariladigan bo'lishi kerak.
Balandlik oxirida — **mastering**da limiter orqali keladi. (Boom!)

Miks paytida darajani tiqib yuborsangiz, mastering injyeneriga ishlash uchun joy qolmaydi. (Uf…)
**Headroom** qoldiring. Bo'sh joy keyin punch va impact uchun kerak bo'ladi.

Pluginlaringizga mazali taom bering (-18 dBFS).
Ular sizni eng yaxshi ovoz bilan mukofotlaydi. (Nom‑nom!)

---

### [Boshlovchilar qiladigan xatolar] 🍱
* **“Faqat fader bilan balanslash”**: Waveform juda katta bo'lgani uchun faderni pastga tortasiz. Fader rezolyutsiyasini isrof qilasiz. Avval clip gain'ni to'g'rilab, faderni 0 atrofida ushlang.
* **“Qancha baland bo'lsa, shuncha yaxshi”**: Qulog'imiz baland ovozni yaxshi ko'radi. “Vau, plugin ovozni katta qildi!” Yo'q — u faqat balandlashdi. Bypass qilib, darajalarni moslab keyin baholang.
* **“Manfiy gain staging”**: Juda past yozib, shovqin “shhh” bo'ladi, keyin ustiga pluginlar qatlaysiz. Bu changli linzadan suratga olishdek. Balans muhim!
