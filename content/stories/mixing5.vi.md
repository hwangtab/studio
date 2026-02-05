---
title: "Khóa học Mixing - Phần 5: Kẻ thù của digital (Lỗi và nhiễu)"
date: 2025-11-16
author: "Studio NOL"
category: "lesson"
tags: ["Mixing", "Bài học", "DigitalError", "DigitalError", "Clipping"]
---
![Hình ảnh glitch kỹ thuật số](/images/pcw.png)

“Digital chẳng phải hoàn hảo sao? Chỉ là 0 và 1—sao lại có lỗi?”
Nhiều người tin rằng âm thanh số sạch và không đổi. Nhưng thế giới số có những kẻ thù đáng sợ.
Chúng có thể phá hỏng bản thu quý giá và khiến kết quả nghe thiếu chuyên nghiệp. (Ding—error!)

Hãy gặp hai phản diện chính: **jitter** và **clipping**.

## 1. Clipping: âm thanh bị chặt đầu

Sai lầm phổ biến và tai hại nhất.
Ở phần 4 ta học về bit depth. Container số có **giới hạn tối đa (0 dBFS)**.

Nước tràn cốc thì sàn ướt. Nhưng nếu âm vượt quá 0 dBFS?
Đỉnh sóng bị cắt phẳng—**clipped**. (Chop!)
Sóng mượt trở thành sóng vuông, gây méo nặng và tiếng “zzzz!” khó chịu.

* **Méo analog**: đèn hoặc băng từ méo mềm và ấm khi đẩy. (Âm nhạc)
* **Clipping số**: lạnh, gắt, chói tai. (Không nhạc tính)

**Giải pháp**:
Không bao giờ vượt 0 dB. Khi thu, giữ đỉnh lớn nhất khoảng **‑6 dB đến ‑10 dB**.
“Có bị nhỏ quá không?” Đừng lo. Bạn có thể nâng bản thu nhỏ lên sau. Âm bị clip thì không cứu được, còn âm nhỏ thì tăng được. (An toàn trước!)

## 2. Jitter: chiếc đồng hồ rung lắc

Hơi phức tạp, nên dùng ẩn dụ nhé.
Tưởng tượng nhảy dây khi bạn của bạn quay dây.
Nếu họ quay đều (tick‑tock‑tick‑tock), bạn nhảy dễ dàng. (Nhịp đẹp!)
Nhưng nếu họ say và quay nhanh chậm thất thường (tick—tock—tick—‑tock), bạn sẽ vấp.

**Jitter** là khi **thời gian clock** của việc lấy mẫu bị rung.
Ở 44.1 kHz, ta phải lấy 44,100 mẫu/giây ở khoảng cách chính xác—nhưng có những sai lệch cực nhỏ.

* Khi jitter tệ:
  * Âm mất độ tập trung (cảm giác mờ)
  * Trường stereo hẹp lại
  * Dải cao gắt và lạnh (hạt)

**Giải pháp**:
Với interface từ ~100,000 KRW trở lên, jitter không còn là vấn đề lớn.
Tuy nhiên, trong hệ thống pro phức tạp có **word clock**, phải đặt “master clock” đúng.
Với thu tại nhà, chỉ cần nhớ: **Dùng interface tốt và cập nhật driver thường xuyên.** (Kiểm tra đều!)

## 3. Pop noise và click noise

* **Pop noise**: hơi bật “puh, tuh, ts” đập vào mic (“puh!”).
  * → Luôn dùng **pop filter**. (Pop rất đau khi mix.)
* **Click noise**: “tick! tick!” khi máy bị giật.
  * → Tăng **buffer size**. (Thu: 128 hoặc thấp hơn, mix: 1024 hoặc cao hơn)

---

**Ba điều răn của audio số**
1. **Đèn đỏ là đèn chết.** (Đỏ trên meter nghĩa là chết. Không bao giờ vượt 0 dB.)
2. Thu nhỏ hơn một chút. Clipping đáng sợ hơn noise.
3. Đừng tiếc cấu hình máy. CPU đuối là âm cũng đuối. (Giật—giật!)

---

### [Lỗi người mới hay gặp] 💥
* **“Chỉ khi đèn đỏ mới hay.”** Có người thấy meter đỏ (0 dB) là khoái. Không—đó là tiếng thét của âm thanh rách. (Zzzzt!)
* **“Bỏ qua gain staging.”** Bạn thu quá lớn đã clip, rồi giảm volume plugin và nói “Ổn rồi.” Đầu đã bị chặt, đội mũ lên cũng không mọc lại.
* **“Pop filter chỉ để đẹp?”** Không phải để trang trí. Nó bảo vệ mic khỏi hơi bật ở “p, t, ts.” Bỏ qua là bạn sẽ khổ với “puh‑puh” trong mix.
