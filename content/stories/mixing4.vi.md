---
title: 'Khóa học Mixing - Phần 4: Độ phân giải âm thanh số (Sample Rate & Bit Depth)'
date: 2025-11-15T00:00:00.000Z
lastmod: 2026-04-20
author: Studio NOL
category: lesson
tags:
  - Mixing
  - Bài học
  - Digital
  - SampleRate
  - BitDepth
summary: >-
  “Nên thu ở 44.1 kHz hay 48 kHz?” “Khác nhau giữa 16‑bit và 24‑bit là gì?” Nhìn
  số là đau đầu? Đừng lo. Nó giống như hình ảnh. Ghi âm vào máy tính (chu
thumbnail: /images/hardware4.webp
---
![Dạng sóng âm thanh số](/images/recording8.webp)

“Nên thu ở 44.1 kHz hay 48 kHz?”
“Khác nhau giữa 16‑bit và 24‑bit là gì?”

Nhìn số là đau đầu? Đừng lo. Nó giống như hình ảnh.
Ghi âm vào máy tính (chuyển đổi AD) cũng giống như chụp ảnh những gì bạn thấy—hiểu ý tưởng là dễ.

## 1. Sample rate: số khung hình mỗi giây

Sample rate là **độ phân giải theo thời gian**—mỗi giây lấy bao nhiêu lát. (Click‑click!)

* **Ví dụ video**:
  * Phim (24 fps): mượt và tự nhiên.
  * Game (60 fps): rất mượt và chân thực. (Mịn!)
  * Slow motion (120 fps): bắt được cả khoảnh khắc nhanh.
* **Âm thanh**:
  * **44.1 kHz**: 44,100 mẫu mỗi giây. Chuẩn CD và tối thiểu để ghi đủ dải nghe của con người (20 kHz).
  * **48 kHz**: 48,000 mẫu mỗi giây. Chuẩn phát sóng video/film. Chi tiết dải cao nhỉnh hơn 44.1 kHz.
  * **96 kHz**: cực kỳ chi tiết, nhưng dung lượng gấp đôi và máy sẽ mệt. (Nghe quạt chưa?)

**Mẹo thực tế**:
* **Cho phát hành nhạc**: 44.1 kHz hoặc 48 kHz là đủ. Kể cả thu 96 kHz, nền tảng streaming cũng sẽ chuyển về 44.1/16‑bit.
* **Cho video/YouTube**: luôn dùng **48 kHz**. Tránh lỗi lệch sync trong phần mềm dựng. (Môi mấp máy mà không có tiếng—rất rắc rối.)

## 2. Bit depth: độ sâu màu trong ảnh

Bit depth là **độ phân giải của âm lượng**—mức độ chi tiết từ nhỏ nhất đến lớn nhất.

* **Ví dụ ảnh**:
  * **16‑bit (256 màu)**: màu bị dải như đồ họa game cũ. Gradient bị bậc thang.
  * **24‑bit (true color)**: màu tự nhiên như mắt người, kể cả vùng tối. (Đậm đà!)
* **Âm thanh**:
  * **16‑bit**: chất lượng CD. Đủ dùng, nhưng âm rất nhỏ dễ bị chôn trong nhiễu. Dải động khoảng 96 dB.
  * **24‑bit**: chuẩn studio. Bắt từ tiếng thì thầm đến bùng nổ. Dải động ~144 dB—gần như toàn bộ thực tế.
  * **32‑bit float**: định dạng “ma thuật” gần như không clip. Hay dùng cho máy ghi hiện trường. (Bất bại!)

**Mẹo thực tế**:
* Luôn thu ở **24‑bit**.
* Chỉ chuyển về 16‑bit ở mastering cuối (kèm dither) cho CD. Trong quá trình sản xuất, giữ 24‑bit (hoặc 32‑bit) xuyên suốt.

## 3. Vậy nên đặt thế nào?

Đừng nghĩ quá nhiều. Đây là câu trả lời.

* **Nhạc (pop, v.v.)**: **48 kHz / 24‑bit** (48 kHz hiện rất phổ biến)
* **Video (YouTube, film)**: **48 kHz / 24‑bit**
* **Hi‑fi (cổ điển, jazz)**: **96 kHz / 24‑bit** (nếu bồi âm quan trọng)

Bạn chỉ thiết lập một lần khi tạo dự án.
Nếu đổi giữa chừng, tốc độ và cao độ sẽ loạn. (Oops!)
(Nghe như sóc chuột hoặc giọng quái vật bị kéo.)

Lý thuyết số không quá khó, đúng không?
Máy ảnh có độ sâu màu tốt (24‑bit) chụp đủ khung hình mỗi giây (48 kHz) là khởi đầu của bản thu chất lượng cao. (Click!)

---

### [Lỗi người mới hay gặp] 🔢

* **“Số càng cao càng tốt!”** Thu tất cả ở 192 kHz. File phình to, máy gào (vù vù), nhưng tai bạn cũng chẳng phân biệt nổi với 48 kHz.
* **“Bẫy 16‑bit.”** Bạn vô tình đặt 16‑bit khi làm. Về sau nghe tail reverb lạo xạo rồi muốn khóc. Luôn làm việc ở 24‑bit trở lên.
* **“Đổi giữa chừng.”** Bạn đổi sample rate từ 48 sang 44 khi đang làm. Bài hát bỗng kéo dài hoặc thành giọng sóc. Nguy hiểm như thay máu cho bệnh nhân giữa ca mổ.
