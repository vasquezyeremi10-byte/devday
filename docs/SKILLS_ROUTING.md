# Enrutamiento de skills de DEEPKIN

Perfil local del router, configurado el 17 de noviembre de 2026. Leer primero las instrucciones vigentes de AGENTS.md. No modifica los archivos del proveedor; las actualizaciones conservan este perfil.

## Detección y arquitectura

- `package.json`, `package-lock.json` y `node_modules/phaser/package.json`: Phaser 4.2.1; TypeScript 6.0.3 y Vite 8.3.7.
- `src/main.ts`: Phaser.AUTO, 480 × 270, pixelArt, roundPixels, sin antialiasing y escalado entero propio. Escenas de introducción, menú, mina, pausa, muerte y vistas cenitales.
- `src/game/scenes/MiningScene.ts`: coordinación y conexión con Arcade Physics. Reglas puras en `systems`, `world` y `lighting`; configuración en `config`, representación en `world`, `entities` y `ui`.
- `Geology.ts` y `Caves.ts`: generación reproducible por semilla y revisión. `TerrainGrid` determina colisiones.
- `SaveSystem.ts`: localStorage versionado, migraciones y diferencias sobre el terreno inicial. Conservar claves `mina-cero.*` y compatibilidad.
- `LightingSystem.ts` y `lighting/`: iluminación propia cuantizada, exposición y oclusión; no es un sistema de materiales 3D.
- Verificación de cambios de comportamiento: typecheck, lint, Vitest, build y Playwright con Edge, según AGENTS.md.

## Selección por tarea

Tras leer `router`, seleccionar la fila pertinente. Las skills se resuelven en `.agents/skills/<nombre>/SKILL.md`. No es necesario leer todas las variantes de una fila.

| Tarea | Skills principales | Aplicación local |
| --- | --- | --- |
| Escenas, arranque, carga y errores de Phaser | `phaser-core` + la oficial pertinente (`scenes`, `loading-assets` o `game-setup-and-config`) | Mantener la versión fijada y verificar APIs en los tipos locales. |
| Movimiento, gravedad y colisiones | `phaser-arcade-physics` + `mining-gameplay` cuando toque terreno | `physics-arcade` para detalle de API. No modificar el cuerpo físico para acompañar animaciones. |
| Geología, cavernas, biomas y semillas | `procedural-gen` + `mining-gameplay` | Adaptar conceptos a TypeScript y conservar flujos aleatorios y revisiones compatibles. Añadir `save-systems` si cambia el mundo persistido. |
| Guardar, cargar, continuar y migrar | `save-systems` | Usar SaveSystem y sus pruebas; los ejemplos de archivos Python/Godot no sustituyen localStorage. |
| Música, mezcla y efectos sonoros | `audio-design` + `phaser-core` si se integra audio | Usar Phaser Sound y APIs verificadas; conservar silencio, pausa y limpieza de oyentes. No introducir FMOD/Wwise ni APIs de Godot. |
| Pixel art, sprites, tiles y coherencia visual | `pixel-art-director` + `create-game-assets` | Dirección V6/V7, paleta y excepciones documentadas, alfa binario, tamaños reales por recurso y nearest-neighbor. `loading-assets` solo al importar. |
| Luz natural, casco, oclusión y oscuridad | `pixel-art-director` + `phaser-core` si toca render | Leer LightingSystem, lighting, config/lighting.ts y pruebas pertinentes. Añadir `performance-optimization` solo si hay un problema medido. No hay skill específica de luz 2D en el catálogo. |
| FPS, tirones, memoria y coste de dibujo | `performance-optimization` + `game-qa` | Medir en navegador/Phaser antes y después; trasladar conceptos, no comandos de los profilers de otros motores. |
| Cámara, input o escalado | `cameras`, `input-keyboard-mouse-touch` o `scale-and-responsive` | Priorizar la skill oficial concreta, sin duplicar lecturas generales innecesarias. |

Para economía, progresión o trabajadores siguen rigiendo las skills locales y el alcance expresamente autorizado. El router no amplía ese alcance.

## Límites y mantenimiento

- La instalación contiene ocho skills nuevas, no todos los destinos mencionados por el router. Una referencia ausente no es un error de instalación: usar documentación local y señalar la carencia si resulta relevante.
- No se instalaron `shader-programming` ni skills de iluminación de three.js/Godot: no corresponden al render actual. Evaluarlas solo ante una tarea futura que realmente las necesite.
- Mantener las 16 skills previas. La nueva skill de física aporta patrones y comprobaciones; la oficial `physics-arcade` aporta detalle de API.
- Los ejemplos genéricos de instalación de Chromium o Pillow no autorizan instalar aplicaciones globales: usar Edge y herramientas existentes. Los dos scripts Python de `create-game-assets` son auxiliares opcionales; revisar entradas y destino antes de ejecutarlos y conservar las reglas de herramientas del entorno.
- No actualizar todas las skills indiscriminadamente. Revisar cambios del proveedor, instalar solo los nombres aprobados en el proyecto y volver a verificar `skills-lock.json`.
