---
title: "Miks kursi - 5-qism: Raqamli dushmanlar (xatolar va shovqin)"
date: 2025-11-16
author: "Studio NOL"
category: "lesson"
tags: ["Mixing", "Dars", "DigitalError", "Clipping"]
---
![Raqamli glitch tasviri](/images/pcw.webp)

“Digital mukammal emasmi? Faqat 0 va 1-ku — nega xato bo'ladi?”
Ko'pchilik raqamli audio toza va o'zgarmas deb o'ylaydi. Ammo raqamli dunyoda qo'rqinchli dushmanlar bor.
Ular qimmatli yozuvlarimizni buzib, natijani noprofessional qilib qo'yishi mumkin. (Ding—error!)

Keling, ikki asosiy yovuz bilan tanishaylik: **jitter** va **clipping**.

## 1. Clipping: boshi kesilgan tovush

Eng keng tarqalgan va eng xavfli xato.
4‑qismda bit depth haqida o'rgandik. Raqamli konteynerning **maksimal chegarasi (0 dBFS)** bor.

Suv stakandan toshsa pol ho'l bo'ladi. Ovoz 0 dBFS'dan oshsa nima bo'ladi?
To'lqinning tepa qismi kesiladi — **clipped**. (Chop!)
Silliq to'lqin kvadratga aylanib, kuchli distortion va yoqimsiz “zzzz!” shovqinini keltirib chiqaradi.

* **Analog distortion**: lampalar yoki lenta siqilganda yumshoq va iliq tarzda buziladi. (Musiqiy)
* **Digital clipping**: sovuq, o'tkir, quloqni teshuvchi. (Musiqiy emas)

**Yechim**:
Hech qachon 0 dB'dan oshirmang. Yozishda eng baland peak'larni **‑6 dB dan ‑10 dB** atrofida saqlang.
“Juda past bo'lib qolmaydimi?” Xavotir olmang. Past yozuvni keyin ko'tarish mumkin. Clip bo'lgan ovozni esa tuzatib bo'lmaydi. (Avval xavfsizlik!)

## 2. Jitter: qaltiragan soat

Bu biroz murakkab, shuning uchun o'xshatish qilaylik.
Tasavvur qiling, arqon sakrayapsiz va do'stingiz arqonni aylantiryapti.
Agar u barqaror aylantirsa (tik‑tok‑tik‑tok), siz osongina sakraysiz. (Yaxshi ritm!)
Lekin u mast bo'lib tez‑sekin qilib yuborsa (tik—tok—tik—‑tok), albatta qoqilasiz.

**Jitter** — raqamli sample olishdagi **soat vaqti**ning tebranishi.
44.1 kHz'da soniyasiga 44,100 marta aniq oraliqda sample olish kerak, ammo juda kichik vaqt xatolari bo'ladi.

* Jitter yomon bo'lsa:
  * Ovoz fokusini yo'qotadi (xiralashadi)
  * Stereo tasvir torayadi
  * Yuqori chastotalar g'ijim va sovuq eshitiladi (donador)

**Yechim**:
~100,000 KRWdan yuqori interfeyslarda jitter jiddiy muammo emas.
Ammo **word clock** ulanishlari bo'lgan murakkab pro setupda “master clock”ni to'g'ri sozlash kerak.
Uyda yozishda shuni yodda tuting: **Yaxshi interfeys ishlating va drayverlarni yangilang.** (Tez-tez tekshiring!)

## 3. Pop shovqini va click shovqini

* **Pop shovqini**: “puh, tuh, ts” kabi havo portlashlari mikrofonga urilishi (“puh!”).
  * → Har doim **pop filter** ishlating. (Poplar miksda azob beradi.)
* **Click shovqini**: kompyuter qotganda “tik! tik!”
  * → **Buffer size**ni oshiring. (Yozishda: 128 yoki pastroq, miksda: 1024 yoki yuqoriroq)

---

**Raqamli audioning uch amri**
1. **Qizil chiroq — o'lik chiroq.** (Meterda qizil yonsa — o'lim. Hech qachon 0 dB'dan oshmang.)
2. Pastroq yozing. Clipping shovqindan ham qo'rqinchli.
3. Kompyuter quvvatidan qismang. CPU qiynalsa, ovoz ham qiynaladi. (Qot‑qot!)

---

### [Boshlovchilar qiladigan xatolar] 💥
* **“Qizil yonsa, shundagina yaxshi.”** Ba'zilar meter qizilga (0 dB) kirganda zavqlanadi. Bu zavq emas — yirtilayotgan tovushning qichqirig'i. (Zzzzt!)
* **“Gain staging'ni e'tiborsiz qoldirish.”** Juda baland yozib, allaqachon clip qilib qo'yasiz, keyin plugin volume'ni pasaytirib “endi yaxshi” deysiz. Bosh kesilgan bo'lsa, qalpoq kiyish bilan qayta o'smaydi.
* **“Pop filter faqat ko'rinish uchunmi?”** Yo'q. U “p, t, ts”dagi havo portlashidan mikrofonni himoya qiladi. Ishlatmasangiz, miksda “puh‑puh” bilan qiynalasiz.
