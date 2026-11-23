# Contrato de recursos — MINA CERO

## Lienzo y píxel

- Resolución lógica: **480 × 270 px**, perspectiva lateral, corte transversal.
- Tiles: **16 × 16 px**. Mundo del prototipo: 80 × 36 tiles (1280 × 576 px).
- Dirección obligatoria (V6): **pixel art 16-bit moderno**, original, construido píxel a píxel: superficie colorida y cálida, mina oscura y misteriosa. No basta aplicar un filtro pixelado ni de saturación a una ilustración.
- Escala de pantalla entera 1×, 2×, 3× según espacio. Por debajo de 480 px se conserva 1× con desplazamiento horizontal del contenedor. Nearest-neighbor, pixelArt, antialias=false, antialiasGL=false y roundPixels. No redondear la simulación física: solo la representación.
- Sin gradientes suaves, desenfoque, bloom, sombras difusas ni rotaciones/escalas fraccionarias. Dibujar diagonales con escalones de píxeles. Alfa exclusivamente 0 o 255. Dithering opcional y localizado; nunca como ruido sobre toda la escena.

## Paleta compartida

Fuente de verdad: `src/game/config/palette.ts`. Paleta V6 de 40 colores (cielo `#2D63AC`/`#4693DD`/`#A8D8EB`, montañas `#5A69BB`/`#4979D2`, vegetación `#184D39`/`#8EAD39`, madera `#461F15`/`#5B362D`/`#BE7F1A`, luminarias `#F4B341`/`#FFE29A`, metales `#212C48`/`#71829A`, oscuridad `#15182B`/`#0D1020`, más tonos intermedios). Usar subpaletas de 3–6 colores por objeto (minero actual: 6 + alfa; tierra/roca: 4; cubierta: 6). No generar colores intermedios mediante transparencias. La pantalla puede usar menos colores que la paleta completa.

| Grupo           | Colores hex                                 |
| --------------- | ------------------------------------------- |
| Oscuros         | #101426, #20243A, #343C54                   |
| Piedra/metal    | #586078, #8890A0, #B8C0C0                   |
| Luces           | #FFFFFF, #FFECB0, #F8C058                   |
| Tierra/madera   | #D89038, #B86838, #804830, #503028, #C8A070 |
| Acentos cálidos | #983C30, #D85040, #F89858                   |
| Cielo           | #385878, #587CA0, #88ACB8                   |
| Ropa/vegetación | #244C50, #388078, #70B890, #687848          |

Sombras por grupos de píxeles, no por oscurecimiento automático. Distinguir materiales por geometría: grano de tierra, masas y grietas de roca, bandas de lecho, veta de madera y remaches de metal.

## Guía artística (obligatoria para todo recurso nuevo)

| Aspecto                | Regla                                                                                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tile lógico            | 16 × 16. Recursos de 18 × 18 (Kenney) o 32 × 32 solo como utilería libre, nunca forzados a la grilla ni reescalados.                                                                      |
| Escala                 | Entera (1×/2×/3×), nearest-neighbor y roundPixels. Más detalle por píxel, no más resolución.                                                                                              |
| Paleta                 | Los 40 colores V6 de `palette.ts`; 3–6 por objeto. Todo recurso importado se normaliza con `npm run art:import`.                                                                          |
| Luz                    | Desde arriba a la izquierda: canto claro arriba-izquierda y sombra abajo-derecha. Las sombras proyectadas caen a la derecha, sobre el suelo.                                              |
| Contorno               | 1 px de tinta (#101426) en siluetas de personajes, estructuras y caras de bloque expuestas. Sin contornos de color ni de 2 px.                                                            |
| Contraste y saturación | Superficie cálida y saturada (pasto oro/ámbar, madera); subsuelo frío y desaturado que se oscurece con la profundidad. Las menas son los únicos acentos saturados bajo tierra.            |
| Oscuridad y luz        | Por bandas de dithering y halos de tablero, nunca con alfa parcial ni degradados.                                                                                                         |
| Proporción             | Minero 16 × 24 ≈ 1,75 m, por lo que 1 px ≈ 7 cm. Puerta de 26 px; muro de la bodega de 30 px; carro artesanal de 20 × 11 con ruedas (≈52 % del minero visible); galería de 48 px de alto. |
| Nivel de detalle       | Clavos, flejes, juntas y grietas de 1 px; sin ruido general. Cada estructura se arma por piezas intercambiables (`world/structures`).                                                     |

## Personajes y animación

- Minero cenital de la Fase 7A. Lámina original de DEEPKIN generada en `TopDownMinerArt.ts`. Tiene 56 cuadros de 16 × 24 px, 14 poses por dirección, con ancla inferior centrada. Incluye reposo, cuatro cuadros de marcha, preparación, elevación, alcance, inclinación, consumo, dos cuadros de fatiga y dos de reacción al daño. Los accesorios se dibujan con el ancla de la mano y reciben la misma luz que el cuerpo.

- Minero recomendado: frame de **16 × 24 px**, silueta de 12 × 20 aproximadamente. Cuerpo físico independiente de **10 × 18 px**, centrado abajo con offset (3, 6).
- Pies alineados en y=23. Ancla visual (0.5, 0.5). Spritesheets en PNG RGBA, celdas uniformes, sin padding ni separación, sin reescalado posterior.
- Contrato actual: `public/assets/characters/player/character_miner_v01.png`, tira de **752 × 24 px** (47 cuadros de 16 × 24) exportada por Pixelorama desde `art/pixelorama/character_miner_v01.pxo`. Capas del proyecto: contorno, pico_atras, cuerpo, pico, brazo. Etiquetas e índices (desde 0) y FPS: idle 0–3 (4), walk 4–11 (12), rise 12, apex 13, fall 14, land 15, mine 16–21 (18, pico), dig 22–26 (15, pala), celebrate 27–30 (8); preparadas sin mecánica: run 31–36 (14), push 37–40 (8), carry 41–44 (10), tired 45–46 (2). La fuente de verdad de índices es `MINER_ANIMATIONS` en Miner.ts.
- Marcha: cuando la pierna delantera avanza, el brazo trasero avanza y el delantero retrocede; en el paso opuesto se invierte. Nunca resolver la alternancia con flip: el flip solo cambia la dirección.
- Cada estado conserva el casco, lámpara, ropa y botas. Contorno de tinta de 1 px calculado alrededor de los rellenos claros. Las animaciones de herramienta no introducen duración de extracción ni cooldown.
- Carro: caja original 20 × 10 por código (`MineCart.ts`), ruedas de 5 px apoyadas en la cabeza del riel y cuatro estados de carga. Medidas en `config/cart.ts`. Herramientas sueltas en `machinery/equipment`; dentro de las animaciones van integradas en la celda, sin cambiar su tamaño.

## Recursos de terceros

Inventario y licencias: [ASSET_CREDITS.md](ASSET_CREDITS.md). Flujo obligatorio:

1. Verificar en la página oficial que el recurso es gratuito, su licencia y si permite uso comercial. Preferir CC0; aceptar MIT o CC-BY solo con su aviso o atribución. Descartar «solo no comercial», premium, capturas de vista previa y licencias no declaradas.
2. Descargar por el canal oficial a `.tools/asset-downloads/<fuente>/<pack>/` (ignorado). No redistribuir el pack completo.
3. Declarar los recortes en `scripts/art/import-assets.mjs` y ejecutar `npm run art:import`: recorte entero, alfa por umbral (0/255), cada color al más cercano de la paleta o de una subpaleta, sin reescalado. Los tiles de 18 × 18 de Kenney se usan como utilería libre, nunca forzados a la grilla de 16.
4. Copiar la licencia a `public/assets/licenses/` y registrar el pack en ASSET_CREDITS.md.
5. Registrar la clave en `data/assets.ts`. Usar `preload: false` para lo que todavía no aparece en escena y `loadDeferred` cuando se necesite.

Estructura en `public/assets/`: `characters/player`, `environments/{minerals,underground}`, `structures` (atlas `props`), `machinery` (atlas `equipment`, diferido), `effects` (pixelfx), `audio`, `licenses`, `backgrounds` y `ui` reservados para PNG futuros. Los atlas usan JSON hash de TexturePacker con 1 px de separación.

Efectos pixelfx: se renderizan con su herramienta (`render.mjs --sheet`), se toma un cuadro de cada dos (15 FPS), se recortan con una caja común y el pivote original se conserva como origen. Sus halos de alfa parcial se eliminan por umbral.

## Fondos y capas

Orden fijo de profundidad (config/layers.ts):

| Capa       | Profundidad | Contenido                                 | Colisión        |
| ---------- | ----------: | ----------------------------------------- | --------------- |
| Background |           0 | cielo, montañas, pared subterránea lejana | no              |
| Terrain    |         100 | tiles excavables y roca límite            | sí              |
| Structures |         200 | entrada, vigas, raíles                    | no en prototipo |
| Characters |         300 | minero                                    | cuerpo dinámico |
| Machines   |         400 | carrito provisional                       | no              |
| Foreground |         500 | detalles delanteros y selección           | no              |
| UI         |        1000 | indicadores fijos                         | no              |

Fondos por panel: 480 × 270 px; repetibles horizontalmente sin costuras. Fondo de mundo completo opcional: 1280 × 576 px, origen (0, 0), scrollFactor=1. Cielo puede ser RGB opaco; montañas, decoraciones, personajes y primer plano deben usar alfa binario real. No usar blanco ni un damero como falsa transparencia. Todos los fondos futuros respetan la paleta V6, grupos de píxeles enteros y ausencia de suavizado.

Parallax en `IMAGE_LAYERS`: `scrollFactor` horizontal, `scrollFactorY` vertical, `order` entre 0 y 99 dentro de la profundidad, y `repeatWidth`/`repeatHeight` opcionales para TileSprite. Valores iniciales sugeridos: cielo (0,0), montañas lejanas (0.25,0), cercanas (0.5,0), pared subterránea (1,1). Mantener cada capa separada del terreno. Cuando se entreguen todos los fondos, poner `USE_PLACEHOLDER_BACKGROUNDS=false`; esto conserva estructuras y carrito.

Ejemplo de capa PNG repetible, después de registrar su clave en ASSETS:

```ts
{ key: 'background_mountains', layer: 'background', x: 0, y: 0,
  scrollFactor: 0.25, scrollFactorY: 0, order: 1,
  repeatWidth: 1280, repeatHeight: 270 }
```

## Interfaz

Fuente original `PixelFont.ts`: glifos 5 × 7 en celdas de 6 × 8. Phaser RetroFont declara tamaño nativo 6; usar BitmapText con tamaño 6 o múltiplos enteros, para evitar escalado accidental. Los textos del HUD son mayúsculas ASCII; ampliar el atlas explícitamente si se necesitan tildes. Marcos de 1 px, rellenos opacos, iconos de 8 × 8. No rasterizar texto del sistema dentro del canvas. Verificar lectura a escala 1× además de 2×.

El aviso flotante de XP usa un alfabeto compacto propio: glifos de 3 × 5 en celdas de 4 × 6, BitmapText a tamaño nativo 4 y fondo transparente. La sombra replica solo los glifos con un desplazamiento de 1 px.

**Los fondos no deben incluir bloques interactivos, minerales recolectables, mineros, carrito ni interfaz integrados en la imagen.** Las paredes lejanas pueden sugerir roca, pero deben ser más oscuras y menos contrastadas que el terreno sólido.

## Importación

1. Conservar el original generado fuera de public. Revisar manualmente que el resultado de ChatGPT tenga la resolución y cuadrícula acordadas; una imagen con apariencia pixel art no garantiza una cuadrícula real.
2. Preparar PNG sRGB, sin desenfoque, filtros ni compresión JPEG. Si requiere reducir resolución, hacerlo con vecino más cercano y revisar a 1×; no estirar proporciones.
3. Guardar según la estructura de «Recursos de terceros»: fondos en `backgrounds`, personajes en `characters/<rol>`, terreno y menas en `environments`, estructuras en `structures`, maquinaria en `machinery`, interfaz en `ui`; mapas JSON en `environments/maps`.
4. Nombre: `categoria_nombre_estado_v01.png`, minúsculas ASCII y guiones bajos; ejemplo `character_miner_walk_v01.png`. Claves estables semánticas distintas de versiones de archivo.
5. Registrar en src/game/data/assets.ts: image, spritesheet con frameWidth/frameHeight, o tilemap con URL Tiled JSON. AssetLoader encola la carga; SceneLayers aplica la profundidad.
6. Para reemplazar placeholders, usar las claves `terrain` y `miner` manteniendo dimensiones/índices, o adaptar explícitamente el mapeo. Terrain: textura de **128 × 480** (8 columnas × 30 filas de tiles, 240 frames; `TerrainFrame` y `MATERIALS` en TerrainVisuals.ts). Frames 0–191: seis macrotexturas de 128 × 64 (suelo, meteorizado, roca alterada, roca, fracturada, profunda); cada bloque usa la ventana de su posición `(columna mod 8, fila mod 4)`, así que las piedras continúan entre bloques. 192–193 lecho; 194–197 pasto (plano, esquina izquierda, derecha, cumbre); 200–205 menas (carbón, cobre, hierro, plata, oro, cuarzo); 209–223 autotile de bordes (208 + máscara; arriba 1, derecha 2, abajo 4, izquierda 8); 224–231 franjas de transición; 232–235 grietas de impacto. Las capas `transitions` y `edges` son decorativas: la colisión vive solo en la capa base y en TerrainGrid. Una macrotextura de reemplazo debe ser continua en ambos ejes (toroidal). Los suelos (suelo y meteorizado) son matrices sin contorno con terrones y clastos redondeados. Las rocas usan celdas con canto claro arriba-izquierda y grietas de pizarra; la tinta se reserva para contornos de caras expuestas. El contacto alterado cambia de franja cada 8 bloques para no repetirse. Miner: según el contrato de 47 cuadros.
7. Tiled: mapa ortogonal finito, tiles de 16, tilesets embebidos que referencian un PNG único, sin collection-of-images. Nombrar capas por función. `mountDecorativeMap` monta solo capas decorativas; las colisiones siguen controladas por TerrainGrid. Para importar una grilla jugable futura habrá que validar y convertir IDs a Block, no activar automáticamente colisiones del fondo.
8. Probar transparencia, ancla de pies, lectura sobre tierra/roca, animación, carga sin 404 y escalado 1×/2×/3×. Mantener origen y atribución en un inventario de assets.

## Recursos por generar posteriormente

- Cielo y cordillera cálida en capas independientes (480 × 270 cada panel).
- Paredes lejanas de mina repetibles, sin bloques excavables (480 × 270).
- Tileset definitivo tierra/roca/lecho/menas con bordes (16 × 16), si se reemplaza el dibujado por código.
- Trabajadores secundarios (supervisor, operador, mecánico, geólogo) en 16 × 24 con el mismo contrato de animación y variaciones de casco, ropa y herramienta.
- Entrada definitiva y sostenimiento metálico (múltiplos de 16).
- Iconos de interfaz para herramientas (8 × 8 o 16 × 16). Los íconos Minery de 32 × 32 no se reducen: perderían los mangos de 1 px.

La maquinaria funcional y los trabajadores quedan para etapas futuras; sus recursos preparados están en `machinery/equipment`.

## Contrato V2 vigente

Sustituye las referencias anteriores a 47 cuadros y mecánicas preparadas: el minero tiene **54 cuadros, 864×24**, con poses de pala 47–53. Las animaciones de minería se repiten durante el trabajo real (10/5/2,5 s); los tiempos no proceden del FPS de los sprites. Las siete fases de carga corresponden a 1500 ms. Empuje utiliza cuadros 37–40. No cambia el cuerpo físico. Variantes sin herramienta, pala, tungsteno y diamante comparten los mismos índices, tamaños y ancla.

El carro usa una caja original más pequeña (antes, el cuerpo importado de Minery Icons), con posición e inventario lógico. Las vías son sprites originales 16×16 conectados a `RailSystem`; desaparecen los rieles y topes decorativos que contradecían su longitud real. La previsualización usa un damero de píxeles opacos/vacíos, sin alfa parcial. Marcos y botones de tienda usan BitmapText, nunca HTML dentro del juego.

Consultar la tabla V2 de ASSET_CREDITS para archivos, origen, cuadros y generadores. Los recursos nuevos están en el manifiesto `data/assets.ts` y se cargan por `AssetLoader`. Las capturas V2 y resultados actuales están en QA_REPORT; las capturas V1 se conservan como historial.
