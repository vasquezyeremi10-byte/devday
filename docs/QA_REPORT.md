# Informe de comprobación — prototipo 0.1

Fecha: **9 de noviembre de 2026**, America/Santiago. Carpeta: `C:\Users\josel\OneDrive\Desktop\minerito`.

## Resultado

Primera escena jugable verificada en Microsoft Edge **157.0.4341.42**, mediante Playwright **1.65.0** en modo headless, usando **WebGL** (renderer=2). Se inspeccionaron visualmente capturas iniciales, excavación, fondo de la mina y ventana estrecha. No se usaron sprites externos ni imágenes definitivas.

| Comprobación                                      | Resultado                                                                    |
| ------------------------------------------------- | ---------------------------------------------------------------------------- |
| npm install                                       | Dependencias locales instaladas sin conflicto de peers                       |
| npm run typecheck                                 | Aprobado, TypeScript 6.0.3                                                   |
| npm run lint                                      | Aprobado, sin errores                                                        |
| npm run test                                      | **10/10** pruebas Vitest                                                     |
| npm run build                                     | Aprobado; dist generado                                                      |
| npm run test:e2e                                  | **9/9**, 0 omitidas, 0 fallidas, 0 flaky; 34.4 s                             |
| npm run format:check                              | Aprobado                                                                     |
| Skills personalizadas                             | **6/6** válidas con quick_validate.py                                        |
| Node portátil                                     | SHA256 oficial verificado antes de extracción                                |
| activar-entorno.ps1 y setup.ps1 -SkipDependencies | Node 24.22.2 y npm 11.19.1 accesibles                                        |
| npm audit --omit=dev                              | **0 vulnerabilidades**                                                       |
| npm audit completo                                | 10 entradas moderadas de una vulnerabilidad transitiva de lint; ver SETUP.md |

## Comportamiento comprobado

1. Carga sin errores de JavaScript/consola ni solicitudes fallidas; canvas de 480 × 270 presentado a 960 × 540.
2. Movimiento a derecha con D y a izquierda con flecha; salto con Espacio, aterrizaje con pies en y=160, sin salto repetido al mantener pulsado. Pulsación breve de W registrada.
3. Excavación del suelo: datos vacíos, Tilemap sin tile y sin colisión; caída y aterrizaje en y=176 sobre el siguiente bloque.
4. Clic lejano y clic sobre el cielo no alteran el terreno.
5. Pared detiene al minero en x=411; cámara desplaza más de 100 px. Tras excavar dos bloques a través del mouse con cámara desplazada, el personaje avanza hasta la nueva pared.
6. Tres reinicios con R después de excavar restauran terreno, posición y contador. Permanece un solo listener pointerdown. También se prueba el botón de reinicio.
7. Excavación vertical de 25 bloques, atravesando tierra y roca: caída y colisión verificadas tras cada bloque. Cámara vertical dentro de límites, HUD no oculta pies. Lecho final permanece sólido y no excavable.
8. A 640 px de ventana, canvas a escala 1×; a 390 px se adapta sin desbordamiento horizontal. No implica soporte táctil: el control jugable requiere teclado y mouse.
9. Muestreo de 120 frames de navegador: 830.6 ms, aproximadamente 144.5 FPS de render en este equipo. Física a paso fijo de 60 Hz. Es una muestra local de menos de un segundo, no un benchmark prolongado ni garantía para otros equipos.

Las diez pruebas unitarias cubren generación del mundo, entrada, coordenadas negativas/bordes, escrituras inválidas, excavación única, alcance exacto, rechazo lejano, lecho protegido, oclusión, bloque rodeado y regeneración sin arrays compartidos.

## Correcciones realizadas durante QA

- Adaptación de manualChunks a función para Vite 8 y comprobación explícita de TilemapLayer CPU en Phaser 4.
- R y salto usan eventos DOWN consumidos una sola vez por frame: JustDown perdía una pulsación que comenzaba y terminaba entre frames.
- Margen de cámara inferior de 21 px para mantener accesible el lecho sin solapamiento con el HUD.
- Pruebas de posición sobre un bloque sincronizadas con coordenadas físicas, en vez de asumir que una pulsación de 100 ms siempre termina en el mismo píxel.

## Compilado y servidor

La versión de producción se sirvió en 127.0.0.1:4173 y se abrió con Edge: canvas presente, estado «Mina lista», cero errores de consola/JavaScript, y puente de pruebas `__MINA_GAME__` ausente. El servidor preview se detuvo después de verificarlo.

Salida aproximada: motor Phaser 1,367.07 kB (357.00 kB gzip), código del juego 11.42 kB (4.94 kB gzip), CSS 3.15 kB e index 2.67 kB. Motor separado del código del juego.

Servidor de desarrollo iniciado en **http://127.0.0.1:5173/**. Para volver a iniciarlo: `.\npm.cmd run dev` desde la carpeta del proyecto. Git inicializado en main; los archivos quedan preparados sin commit ni publicación remota.

## Evidencias

- [Vista inicial completa](screenshots/prototype.png)
- [Canvas inicial](screenshots/game.png)
- [Excavación con cámara horizontal](screenshots/excavation.png)
- [Descenso y lecho protegido](screenshots/depth.png)
- [Resolución lógica 1×](screenshots/logical-resolution.png)
- [Ventana estrecha](screenshots/narrow.png)
- [Compilación de producción](screenshots/production.png)
- Resultado completo de Playwright en `test-results/results.json` (artefacto local ignorado por Git).

## Pendientes y límites

- Aviso real de minimatch en dependencias de desarrollo; no hay vulnerabilidades reportadas en dependencias de ejecución. Detalle y motivo de no forzar versiones mayores en SETUP.md.
- Assets definitivos aún no generados, conforme al alcance. El manifiesto de PNG/spritesheets/mapas está preparado pero vacío; no se puede validar la calidad ni las dimensiones de imágenes futuras que todavía no existen.
- Sin guardado: reiniciar o recargar restaura la mina. Si se excava un pozo sin salida, usar R.
- No se han implementado economía, trabajadores, habilidades ni maquinaria funcional.
- No se comprobaron otros navegadores, equipos ni sesiones largas; no hubo pruebas obligatorias bloqueadas por falta de herramientas.
