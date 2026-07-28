---
title: 'Khóa học Mixing - Phần 6: Đọc âm thanh bằng mắt (Tất tần tật về metering)'
date: 2025-11-17T00:00:00.000Z
lastmod: 2026-04-20
author: Studio NOL
category: lesson
tags:
  - Mixing
  - Bài học
  - Metering
  - Loudness
summary: >-
  “Tôi không thể tin vào tai mình.” Vậy bạn cần một người bạn đáng tin: level
  meter. Meter không nói dối. Nhưng chúng ta phải hiểu nó nói gì. (Nghe kỹ!)
thumbnail: /images/recording1.webp
---
![Các loại meter mức](/images/console.webp)

“Tôi không thể tin vào tai mình.”
Vậy bạn cần một người bạn đáng tin: **level meter**.
Meter không nói dối. Nhưng chúng ta phải hiểu nó nói gì. (Nghe kỹ!)

## 1. Peak meter: khoảnh khắc tức thời

Cái thanh nhảy lên xuống trong DAW là peak meter.
Nó hiển thị **đỉnh tức thời**. Chỉ cần 0.001 giây vượt 0 dB là nó đỏ. (Ôi, đỏ!)

* **Vai trò**: “Ngăn clipping”
* **Hạn chế**: Nó không nói cho bạn biết độ to.
  * Một cú snare nhanh có thể peak ở ‑3 dB.
  * Một synth pad khổng lồ có thể peak ở ‑10 dB. (Woooom)
  * Trên meter, snare trông to hơn, nhưng **tai bạn thấy pad to hơn**.

Nên nếu chỉ tin peak meter, bạn sẽ tự hỏi: “Sao bài mình nghe nhỏ vậy?”

## 2. RMS và LUFS: nghe như con người

Tai chúng ta cảm nhận độ to dựa trên **năng lượng trung bình theo thời gian**, không phải đỉnh nhỏ.

### RMS (Root Mean Square)

* Tính năng lượng trung bình (điện áp). (Vững!)
* Gần với cảm nhận độ to hơn peak meter.
* Vai trò tương tự VU meter analog cũ.

### LUFS (Loudness Units Full Scale)

* **Chuẩn hiện nay**. Cao cấp hơn RMS.
* Phản ánh thính giác con người (đường Fletcher‑Munson, v.v.), cho số đo **độ to cảm nhận** chính xác nhất. (Rõ!)
* YouTube, Spotify, Apple Music—tất cả nền tảng streaming chuẩn hóa âm lượng theo LUFS.

## 3. Hướng dẫn metering thực tế

Quên thuật ngữ khó đi. Cứ theo đây.

### (1) Cân bằng từng track: tin peak và tai

Với kick, vocal… giữ peak quanh **‑6 dB đến ‑10 dB**. (An toàn!)

### (2) Mix bus: nhìn LUFS

Chèn plugin LUFS miễn phí (Youlean Loudness Meter, v.v.) vào master.

* **Short‑term LUFS**: trung bình ~3 giây. Khi chorus vào, bạn ở khoảng **‑10 đến ‑8 LUFS** chứ? (Boom!)
  * Quá thấp (‑14 LUFS): nghe nhỏ. Cần rất nhiều gain khi mastering.
  * Quá cao (‑6 LUFS): quá to; động học có thể bị nén nát.
* **Integrated LUFS**: trung bình toàn bài. Hãy biết mục tiêu streaming (YouTube ‑14, Apple ‑16), nhưng đừng ép. (Nhiều phát hành thương mại master to hơn ở ‑9 đến ‑7 LUFS.)

## 4. Dynamic range (Peak – RMS/LUFS)

Đây là mẹo pro thật sự.
Nhìn **chênh lệch giữa peak và RMS/LUFS**.

* Chênh lớn (10 dB+): âm punchy và động học khỏe. (Đập!)
* Chênh nhỏ (dưới 3 dB): quá nén, dễ mệt tai. (Cảnh giác over‑compression/limiting!)

Meter giống như đồng hồ tốc độ.
Nếu lái xe chỉ nhìn đồng hồ, bạn sẽ đâm. Nhìn đường (âm nhạc) và liếc meter thỉnh thoảng.
Meter chính xác nhất vẫn là **đôi tai**. (Hãy nghe!)

---

### [Lỗi người mới hay gặp] 👁️

* **“Mix bằng mắt.”** Bạn ngừng nghe và ám ảnh với waveform hay con số ‑14. Nếu số quyết định tất cả, AI đã làm hết rồi. (Ding!)
* **“Sống vì integrated value.”** Bạn bóp nát cả bài chỉ để khớp integrated LUFS, làm mất build‑up và release. Chorus phải nổ—đừng phạm tội đó.
* **“Tin tuyệt đối peak meter.”** “Không đỏ là ổn.” Nhưng nếu RMS quá cao, tai sẽ mệt và người nghe bỏ sau 30 giây.
