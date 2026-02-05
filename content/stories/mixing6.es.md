---
title: "Curso de Mezcla - Parte 6: Leer el sonido con los ojos (todo sobre el metering)"
date: 2025-11-17
author: "Studio NOL"
category: "lesson"
tags: ["Mezcla", "Clase", "Metering", "Metering", "Loudness"]
---
![Varios medidores de nivel](/images/console.jpg)

“No puedo confiar en mis oídos.”
Entonces necesitas un amigo confiable: el **medidor de nivel**.
Los medidores no mienten. Pero hay que entender lo que dicen. (¡Atento!)

## 1. Medidor de picos: el instante fugaz

Esa barra que sube y baja en el DAW es el medidor de picos.
Muestra el **valor máximo instantáneo**. Si un instante (0.001 s) supera 0 dB, se pone rojo. (¡Uy, rojo!)

* **Función**: “Evitar clipping”
* **Limitación**: no te dice la sonoridad.
  * Un golpe de caja puede marcar pico de ‑3 dB.
  * Un pad gigante puede marcar ‑10 dB. (Wooo)
  * El medidor muestra la caja más “alta”, pero **al oído el pad suena más fuerte**.

Si confías solo en el medidor de picos, acabarás preguntando: “¿Por qué mi canción suena baja?”

## 2. RMS y LUFS: escuchar como humanos

Nuestros oídos perciben la sonoridad según la **energía promedio a lo largo del tiempo**, no según picos breves.

### RMS (Root Mean Square)
* Calcula la energía promedio (voltaje). (¡Sólido!)
* Mucho más cercano a lo que sentimos que el medidor de picos.
* Similar al rol del viejo medidor VU analógico.

### LUFS (Loudness Units Full Scale)
* El **estándar actual**. Más avanzado que RMS.
* Refleja la percepción humana (curva Fletcher‑Munson), mostrando con mayor precisión la **sonoridad percibida**. (¡Exacto!)
* YouTube, Spotify, Apple Music y demás normalizan el volumen con LUFS.

## 3. Guía práctica de metering

Olvida los términos complicados. Haz esto.

### (1) Balance por pista: confía en picos y oído
Para pistas individuales (kick, voz), mantén picos alrededor de **‑6 dB a ‑10 dB**. (¡Seguro!)

### (2) Bus de mezcla: mira LUFS
Inserta un medidor LUFS gratuito (Youlean Loudness Meter, etc.) en el master.

* **Short‑term LUFS**: promedio de unos 3 s. En el estribillo, ¿estás alrededor de **‑10 a ‑8 LUFS**? (¡Boom!)
  * Muy bajo (‑14 LUFS): suena pequeño; necesitarás subir mucho en master.
  * Muy alto (‑6 LUFS): demasiado fuerte; probablemente has destruido la dinámica.
* **Integrated LUFS**: promedio del tema completo. Ten en mente las referencias (YouTube ‑14, Apple ‑16), pero no las fuerces. (Muchos lanzamientos comerciales van mucho más fuertes, ‑9 a ‑7 LUFS.)

## 4. Rango dinámico (pico – RMS/LUFS)

Este es un tip de nivel pro.
Mira la **diferencia entre pico y RMS/LUFS**.

* Diferencia grande (10 dB+): sonido con punch y dinámica viva. (¡Pam!)
* Diferencia pequeña (menos de 3 dB): sonido aplastado y fatigante. (¡Cuidado con la compresión/limitación excesiva!)

Los medidores son como el velocímetro.
Si conduces mirando solo el velocímetro, te accidentas. Mira adelante (la música) y mira el medidor de reojo.
El medidor más preciso sigue siendo tu **oído**. (¡Escucha!)

---

### [Errores comunes de principiantes] 👁️
* **“Mezclar con los ojos.”** No escuchas, solo te obsesionas con la forma de onda o con que el medidor diga ‑14. Si los números fueran la verdad, la IA ya habría conquistado el mundo. (¡Ding!)
* **“Obsesión con el integrado.”** Recortas toda la dinámica para cuadrar el LUFS integrado, matando el clímax. El estribillo debe explotar; no lo mates por un promedio.
* **“Fe ciega en el pico.”** “No hay rojo, está bien.” Pero si el RMS es alto, el oído se fatiga y la gente apaga la canción en 30 segundos.
