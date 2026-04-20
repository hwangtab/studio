---
title: 'Curso de Mezcla - Parte 8: Poner la mesa para los plugins (Gain Staging)'
date: 2025-11-19T00:00:00.000Z
author: Studio NOL
category: lesson
tags:
  - Mezcla
  - Clase
  - GainStaging
  - Headroom
  - InputLevel
summary: >-
  "Puse un plug‑in y el sonido se distorsiona raro." "El compresor no hace
  nada." (¿Eh? ¿Qué pasa?) Tus plug‑ins no están rotos. El problema es que les
thumbnail: /images/recording3.webp
---
![Medidor VU analógico](/images/hardware5.webp)

"Puse un plug‑in y el sonido se distorsiona raro."
"El compresor no hace nada." (¿Eh? ¿Qué pasa?)

Tus plug‑ins no están rotos.
El problema es que les estás dando **demasiada comida (nivel de entrada)**. (¡Uf, estoy lleno!)

## 1. ¿Qué es el gain staging?

En simple: **"ajustar el volumen correcto antes de pasar al siguiente paso."**
La señal de audio pasa por varias etapas (una por una):
`Preamp de micro` -> `EQ` -> `Compresor` -> `Bus master`

El gain staging es el "portero" que evita que el nivel se dispare o se quede demasiado bajo en cada etapa.

## 2. El secreto de -18 dBFS (por qué importa)

En digital, 0 dBFS es el techo, ¿no? (¡Cuidado con la cabeza!)
Entonces, ¿por qué tantos pros insisten en **-18 dBFS**?

Por los **plug‑ins que emulan hardware analógico**.
Compresores clásicos (LA‑2A, 1176) o EQs (Pultec) se diseñan con ese comportamiento.
El nivel de referencia analógico (0 VU) equivale aproximadamente a **-18 dBFS** en digital.

* **Con entrada a -18 dBFS**: el plug‑in suena más bonito, cálido y musical. (El **sweet spot**.)
* **Cerca de 0 dBFS**: el plug‑in se sobrecarga, distorsiona feo o el compresor reacciona de más. (¡Ay!)

## 3. Cómo hacer gain staging en la práctica

Antes de mezclar (o al grabar), revisa el nivel de cada pista. (¡Con lupa!)

1. **Mira el medidor**: Que el nivel medio (RMS) ronde -18 dBFS. (Los picos en -10 a -6 dB están bien.)
2. **Ajusta el clip gain**: No toques el fader todavía. Ajusta el tamaño de la onda (**Clip Gain** o **Input Gain**).
   * Baja ondas enormes y sube las demasiado pequeñas.
3. **Iguala la salida del plug‑in**: Si al insertar el plug‑in sube el volumen, baja el **Output Gain** hasta que suene igual que en bypass.

**"Volume in = Volume out"**

Si cumples eso, tu mezcla será mucho más limpia y relajada.

## 4. La estética del sonido pequeño

"Si está bajo, ¿no pierde fuerza?"
No. En mezcla, debe estar limpio y controlado.
El volumen grande se consigue al final, en **mastering**, con un limiter. (¡Boom!)

Si aprietas el nivel durante la mezcla, el ingeniero de mastering no tendrá margen. (Qué pena...)
Deja **headroom**. Ese espacio vacío es donde después entran el punch y el impacto.

Dale a tus plug‑ins una buena comida (-18 dBFS).
Te devolverán su mejor sonido. (¡Ñam ñam!)

---

### [Errores comunes de principiantes] 🍱

* **"Equilibrar solo con faders"**: La forma de onda está enorme y bajas el fader al mínimo. Estás desperdiciando la resolución del fader. Ajusta primero el clip gain.
* **"Más fuerte = mejor"**: Nuestro oído ama lo más fuerte. "¡Wow, el plug‑in lo hizo gigante!" No, solo está más alto. Compara con bypass al mismo nivel.
* **"Gain staging demasiado bajo"**: Grabas muy bajo, aparece ruido "ssss" y luego llenas de plug‑ins. Es como fotografiar con un lente sucio. Todo es cuestión de equilibrio.
