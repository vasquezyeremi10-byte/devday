# Contrato de recursos — MINA CERO

## Lienzo y píxel

- Resolución lógica: **480 × 270 px**, perspectiva lateral, corte transversal.
- Tiles: **16 × 16 px**. Mundo del prototipo: 80 × 36 tiles (1280 × 576 px).
- Escala de pantalla entera 1×, 2×, 3× según espacio; por debajo de 480 px se reduce para caber. Nearest-neighbor, sin suavizado, sin rotaciones fraccionarias.
- Paleta provisional: cielo #d9ae76, tierra #745044, roca #493e43, sombras #292936, madera #ac744a, lámparas #ffd580, ropa #4b8790. No es arte definitivo.

## Personajes y animación

- Minero recomendado: frame de **16 × 24 px**, silueta de 12 × 20 aproximadamente. Cuerpo físico independiente de **10 × 18 px**, centrado abajo con offset (3, 6).
- Pies alineados en y=23. Ancla visual (0.5, 0.5). Spritesheets en PNG RGBA, celdas uniformes, sin padding ni separación, sin reescalado posterior.
- Hoja futura sugerida: 6 columnas × 4 filas = 96 × 96 px. Filas: idle, walk, jump, dig. Registrar frame inicial/final y FPS; usar 6–8 FPS para walk/dig. Las filas pueden repetir frames para igualar longitud.
- Carrito: 32 × 24 px. Pico/pala separados: 16 × 16 px o integrados coherentemente en animaciones, nunca cambiar el tamaño de la celda entre frames.

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

Fondos por panel: 480 × 270 px; repetibles horizontalmente sin costuras. Fondo de mundo completo opcional: 1280 × 576 px, origen (0, 0), scrollFactor=1. Parallax separado del terreno: especificar scrollFactor por imagen. Cielo puede ser RGB opaco; montañas, decoraciones, personajes y primer plano deben usar alfa real. No usar blanco ni un damero como falsa transparencia.

**Los fondos no deben incluir bloques interactivos, minerales recolectables, mineros, carrito ni interfaz integrados en la imagen.** Las paredes lejanas pueden sugerir roca, pero deben ser más oscuras y menos contrastadas que el terreno sólido.

## Importación

1. Conservar el original generado fuera de public. Revisar manualmente que el resultado de ChatGPT tenga la resolución y cuadrícula acordadas; una imagen con apariencia pixel art no garantiza una cuadrícula real.
2. Preparar PNG sRGB, sin desenfoque, filtros ni compresión JPEG. Si requiere reducir resolución, hacerlo con vecino más cercano y revisar a 1×; no estirar proporciones.
3. Guardar en public/assets/{backgrounds,characters,terrain,machines,ui}. Estructuras provisionales pueden ir en terrain con prefijo structure_; mapas JSON en terrain/maps.
4. Nombre: `categoria_nombre_estado_v01.png`, minúsculas ASCII y guiones bajos; ejemplo `character_miner_walk_v01.png`. Claves estables semánticas distintas de versiones de archivo.
5. Registrar en src/game/data/assets.ts: image, spritesheet con frameWidth/frameHeight, o tilemap con URL Tiled JSON. AssetLoader encola la carga; SceneLayers aplica la profundidad.
6. Para reemplazar placeholders, usar las claves `terrain` y `miner` manteniendo dimensiones/índices, o adaptar explícitamente el mapeo. Terrain: tira de 48 × 16, índices 0 tierra, 1 roca, 2 lecho protegido. Miner: cuatro frames 16 × 24 en la versión provisional.
7. Tiled: mapa ortogonal finito, tiles de 16, tilesets embebidos que referencian un PNG único, sin collection-of-images. Nombrar capas por función. `mountDecorativeMap` monta solo capas decorativas; las colisiones siguen controladas por TerrainGrid. Para importar una grilla jugable futura habrá que validar y convertir IDs a Block, no activar automáticamente colisiones del fondo.
8. Probar transparencia, ancla de pies, lectura sobre tierra/roca, animación, carga sin 404 y escalado 1×/2×/3×. Mantener origen y atribución en un inventario de assets.

## Recursos por generar posteriormente

- Cielo y cordillera cálida en capas independientes (480 × 270 cada panel).
- Paredes lejanas de mina repetibles, sin bloques excavables (480 × 270).
- Tileset tierra/roca/lecho y variantes de borde (16 × 16 por tile).
- Minero idle/walk/jump/dig con pico y pala (frames 16 × 24).
- Entrada de madera y soportes de galería (múltiplos de 16).
- Carrito (32 × 24), raíles y herramientas (16 × 16).
- Iconos de interfaz (8 × 8 o 16 × 16) y fuente bitmap original si se desea.

La maquinaria avanzada y nuevos trabajadores quedan para etapas futuras.
