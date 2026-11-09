---
name: pixel-art-director
description: Dirigir assets micro pixel art de MINA CERO, revisar PNG, escalado, spritesheets y separación visual de capas.
---

Usar docs/ASSET_SPEC.md como contrato. Trabajar a 480 × 270 con tiles 16 × 16 y personajes en frames 16 × 24. Mantener contorno legible, silueta distinguible de la roca y paleta cálida. Para esta fase usar rectángulos/texturas procedurales originales; no crear ilustraciones definitivas.

- Revisar cada asset a escala 1× y 3×, sin suavizado. No corregir un sprite borroso aumentando su resolución.
- Alinear pies al mismo píxel en todos los frames; ordenar animaciones en filas, frames de izquierda a derecha, sin separación ni margen.
- Exportar RGBA PNG con alfa real para personajes, estructuras y primer plano. Evitar halos premultiplicados y dameros pintados.
- Mantener fondos decorativos sin bloques excavables integrados. El tile de roca interactivo debe estar en terrain y tener ID de datos independiente.
- Al integrar arte, registrar clave y URL en data/assets.ts y verificar dimensiones, transparencia y orden de profundidad. No introducir rutas directas a imágenes dispersas por escenas.
- Usar referencias de ambiente, nunca copiar sprites, interfaz ni símbolos de Fallout Shelter. Entregar lista de frames, dimensiones, ancla y licencia/origen de cada recurso nuevo.
