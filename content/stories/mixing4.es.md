---
title: "Curso de Mezcla - Parte 4: Resolución del audio digital (Sample Rate & Bit Depth)"
date: 2025-11-15
author: "Studio NOL"
category: "lesson"
tags: ["Mezcla", "Clase", "Digital", "SampleRate", "BitDepth"]
---
![Forma de onda de audio digital](/images/recording8.webp)

“¿Debo grabar a 44.1 kHz o 48 kHz?”
“¿Qué diferencia hay entre 16‑bit y 24‑bit?”

¿Los números te marean? No te preocupes. Es igual que la imagen.
Así como tomas fotos del mundo con una cámara digital, entender cómo se guarda el sonido en el ordenador (conversión AD) lo hace muy simple.

## 1. Sample rate: los fotogramas por segundo del video

El sample rate es la **resolución del tiempo**: cuántas veces se “corta” un segundo. (¡clic‑clic!)

* **Analogía de video**:
  * Cine (24 fps): suave y natural.
  * Juegos (60 fps): movimiento muy fluido y real. (¡suave!)
  * Cámara lenta (120 fps): no se pierde ni un instante rápido.
* **Audio**:
  * **44.1 kHz**: 44.100 muestras por segundo. Estándar de CD y mínimo para cubrir el rango audible humano (20 kHz).
  * **48 kHz**: 48.000 muestras por segundo. Estándar en video/cine. Representa un poco mejor las altas frecuencias que 44.1 kHz.
  * **96 kHz**: extremadamente detallado, pero el tamaño se duplica y el ordenador sufre. (¿Oyes el ventilador?)

**Consejos prácticos**:
* **Para lanzar música**: 44.1 kHz o 48 kHz es suficiente. Aunque grabes a 96 kHz, las plataformas convertirán a 44.1/16‑bit.
* **Para video/YouTube**: usa siempre **48 kHz**. Evitas desastres de sincronía en editores. (Boca moviéndose sin sonido = desastre.)

## 2. Bit depth: profundidad de color en fotos

El bit depth es la **resolución del volumen**: qué tan fino puedes representar desde el sonido más pequeño hasta el más grande.

* **Analogía de foto**:
  * **16‑bit (256 colores)**: los colores se ven “cortados”, como en juegos antiguos. Los degradados parecen escalones.
  * **24‑bit (true color)**: colores naturales como los vemos. Se ven detalles incluso en sombras oscuras. (¡rico!)
* **Audio**:
  * **16‑bit**: calidad CD. Suficiente, pero sonidos muy bajos pueden perderse en el ruido. Rango dinámico aprox. 96 dB.
  * **24‑bit**: estándar de estudio. Captura desde susurros hasta explosiones. Rango dinámico aprox. 144 dB, casi todo el rango real.
  * **32‑bit float**: formato “mágico” que prácticamente no clipea. Usado en grabadoras de campo. (¡Invencible!)

**Consejos prácticos**:
* Graba siempre en **24‑bit**.
* Convierte a 16‑bit solo al final (con dither) para CD. Durante el trabajo, mantén 24‑bit (o 32‑bit).

## 3. Entonces, ¿qué configuro?

No lo pienses demasiado. Aquí va:

* **Música (pop, etc.)**: **48 kHz / 24‑bit** (hoy 48 kHz es lo común)
* **Video (YouTube, cine)**: **48 kHz / 24‑bit**
* **Alta fidelidad (clásica, jazz)**: **96 kHz / 24‑bit** (si los armónicos importan)

Esto se configura una sola vez al crear el proyecto.
Si cambias a mitad, la velocidad y el tono se arruinan. (¡ups!)
(Sonará como ardillas o una voz monstruosa estirada.)

¿Ves? La teoría digital no es tan difícil.
Una cámara con buen color (24‑bit) y suficientes “frames” por segundo (48 kHz) es el inicio de una grabación de alta calidad. (¡clic!)

---

### [Errores comunes de principiantes] 🔢
* **“¡Más alto = mejor!”** Grabar todo a 192 kHz. El tamaño se dispara y el ordenador grita (¡fiuuu!), pero tus oídos no distinguen de 48 kHz.
* **“La trampa de 16‑bit.”** Trabajas sin querer en 16‑bit. Luego tu cola de reverb cruje y lloras. Trabaja siempre en 24‑bit o más.
* **“Cambiar a mitad.”** Cambias el sample rate de 48 a 44 en medio del proyecto. De repente todo se estira o suena como ardilla. Es tan peligroso como cambiar la sangre de un paciente durante una cirugía.
