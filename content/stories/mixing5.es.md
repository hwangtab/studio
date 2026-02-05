---
title: "Curso de Mezcla - Parte 5: Enemigos de lo digital (errores y ruido)"
date: 2025-11-16
author: "Studio NOL"
category: "lesson"
tags: ["Mezcla", "Clase", "ErrorDigital", "DigitalError", "Clipping"]
---
![Imagen de glitch digital](/images/pcw.png)

“¿No es digital perfecto? Son 0 y 1, ¿por qué hay errores?”
Mucha gente cree que el audio digital es limpio e inmutable. Pero en el mundo digital también hay enemigos.
Pueden arruinar nuestras grabaciones y hacer que el resultado suene poco profesional. (¡Ding—error!)

Veamos a los dos villanos principales: **jitter** y **clipping**.

## 1. Clipping: sonido con la cabeza cortada

El error más común y más fatal.
En la Parte 4 vimos el bit depth: los contenedores digitales tienen un **máximo (0 dBFS)**.

Si el agua rebosa, el piso se moja. ¿Pero si el sonido supera 0 dBFS?
La parte superior de la onda se corta—**clipping**. (¡Chas!)
La onda redonda se convierte en una onda cuadrada, generando gran distorsión y un ruido “zzzz” desagradable.

* **Distorsión analógica**: válvulas o cinta se saturan de forma suave y cálida. (Musical)
* **Clipping digital**: frío, duro, y molesto al oído. (No musical)

**Solución**:
Nunca pases de 0 dB. Al grabar, mantén los picos más fuertes alrededor de **‑6 dB a ‑10 dB**.
“¿No queda muy bajo?” Tranquilo. Luego puedes subirlo. Lo clippeado no se recupera, pero lo bajo sí se puede subir. (¡Seguridad primero!)

## 2. Jitter: un reloj con temblor

Es un concepto algo complejo, así que usemos una analogía.
Imagina saltar la cuerda mientras un amigo la gira.
Si la gira con un tempo exacto (tic‑toc‑tic‑toc), puedes saltar bien. (¡Buen ritmo!)
Pero si está borracho y acelera y frena (tic—toc—tic—‑toc), te vas a enredar.

**Jitter** es cuando el **reloj** que marca el muestreo digital oscila.
A 44.1 kHz, hay que muestrear 44.100 veces por segundo con intervalos exactos, pero el timing se desvía un poco.

* Si el jitter es fuerte:
  * El sonido pierde foco (se vuelve borroso)
  * La imagen estéreo se estrecha
  * Los agudos suenan ásperos y fríos (granulado)

**Solución**:
Con interfaces de más de 100.000 KRW, el jitter ya no es un problema serio.
En entornos profesionales con **word clock**, hay que configurar bien el “master clock”.
Para home recording, solo recuerda esto: **usa una buena interfaz y mantén los drivers actualizados.** (¡Revisa seguido!)

## 3. Ruido de pops y clicks

* **Pop noise**: el “puh, tuh, ts” cuando el aire golpea el micrófono (“puh!”).
  * → Usa siempre **filtro antipop**. (Los pops hacen sufrir en la mezcla.)
* **Click noise**: “tic, tic” cuando el ordenador se traba.
  * → Aumenta el **buffer size**. (Grabación: 128 o menos, mezcla: 1024 o más)

---

**Los 3 mandamientos del audio digital**
1. **Red Light is Dead Light.** (La luz roja en el medidor significa muerte. No pases de 0 dB.)
2. Graba bajo. El clipping da más miedo que el ruido.
3. No escatimes en la computadora. Si el CPU sufre, el sonido también. (¡Lag‑lag!)

---

### [Errores comunes de principiantes] 💥
* **“Cuando se enciende la luz roja es lo mejor.”** Algunos sienten placer cuando el medidor se pone rojo. No es placer, es el grito de un sonido roto. (¡Zzzzt!)
* **“Ignorar el gain staging.”** Grabaste demasiado fuerte y ya clippeó, luego bajas el volumen en un plugin y dices “ya no clippea”. Si la cabeza ya se cortó, ponerle un sombrero no la devuelve.
* **“¿El pop filter es solo para verse cool?”** No. Protege el micrófono del aire en “p, t, ts”. Si no lo usas, sufrirás esos “puh‑puh” al mezclar.
