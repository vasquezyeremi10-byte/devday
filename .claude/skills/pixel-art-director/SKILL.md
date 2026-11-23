---
name: pixel-art-director
description: Dirigir el estilo pixel art 16-bit moderno de MINA CERO (dirección V6), revisar la paleta V6, PNG, spritesheets, el proyecto Pixelorama del minero, recursos de terceros normalizados, tipografía bitmap y parallax.
---

Usar docs/ASSET_SPEC.md como contrato y docs/ASSET_CREDITS.md como inventario. Dirección obligatoria V6: pixel art 16-bit moderno, colorido y detallado, original: no un filtro sobre arte moderno. 480 × 270, tiles 16 × 16 y personajes 16 × 24. Fondos todavía provisionales; esperar los PNG del usuario antes de producir arte definitivo.

- Revisar cada asset a escala 1× y 3×, sin suavizado. No corregir un sprite borroso aumentando su resolución.
- Tomar colores de config/palette.ts (24 máximos); limitar cada objeto a 3–6 colores más alfa. Nada de gradientes, glow, blur, antialiasing, sombras difusas o transparencias parciales. Sombras mediante grupos; dithering localizado, sin ruido general.
- Dibujar solo en coordenadas enteras, contornos deliberados y diagonales escalonadas. Usar patrones distintos para tierra (grano), roca (masas/grietas), estrato profundo (tonos fríos), lecho (bandas), menas (vetas de color), madera (veta) y metal (remaches), no solo variantes de tono.
- Minero: editar `scripts/art/build-miner.mjs` (poses por partes) o el .pxo en Pixelorama, y exportar con `npm run art:miner`. Pies apoyados en y=23 sin cambiar la hitbox. En la marcha, brazo opuesto a la pierna; el flip solo cambia la dirección. Animaciones solo visuales, nunca demoran la excavación ni bloquean controles.
- Recursos de terceros: solo gratuitos, de canal oficial y con licencia verificada (preferir CC0). Recortar e importar con `npm run art:import`, que normaliza a la paleta y al alfa binario sin reescalar. Descartar packs con otra perspectiva (vista superior, LPC 3/4), escala que obligue a deformar, licencia no comercial o no declarada. No reducir íconos de 32 px a 16 px si se pierden trazos de 1 px.
- Exportar RGBA PNG con alfa binario 0/255. Evitar halos y dameros pintados.
- Usar PixelFont/BitmapText dentro del canvas, a tamaño nativo 6 o múltiplo entero: glifos 5 × 7, celda 6 × 8. No teñir sprites de color (el tinte multiplica y saca colores de la paleta); teñir solo glifos blancos.
- Mantener escala entera con nearest-neighbor y roundPixels. Ventana menor que 480 px: 1× con contenedor desplazable, no reducir fraccionalmente. No redondear la física.
- Mantener fondos decorativos sin bloques excavables integrados. Decoración apoyada en un bloque excavable: anclarla a su celda en Scenery.
- Registrar clave y URL en data/assets.ts y verificar dimensiones, transparencia y orden de profundidad. No introducir rutas directas a imágenes dispersas por escenas.
- Para parallax, declarar scrollFactor, scrollFactorY, order y repetición en IMAGE_LAYERS. Desactivar USE_PLACEHOLDER_BACKGROUNDS cuando se entreguen todos los PNG de fondo.
- No copiar sprites, interfaz, símbolos ni personajes de juegos comerciales. Entregar lista de frames, dimensiones, ancla, origen y licencia de cada recurso nuevo.
