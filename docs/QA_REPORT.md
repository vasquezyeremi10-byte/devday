# Informe de comprobación — MINA CERO

> Las comprobaciones del audio figuran en «Música y ambiente de partida» y «Sonidos de acciones». Las secciones anteriores se conservan como historial.

Informe de la base anterior al rediseño, preservada en el commit `06c1cd9`. Las capturas de esta carpeta ahora muestran la versión actual. Para resultados de la dirección 8-bit, consultar [ART_REVIEW.md](ART_REVIEW.md).

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

## Verificación V2 vigente — 9 de noviembre de 2026

Las secciones anteriores documentan el prototipo 0.1. Esta sección corresponde al sistema de interacción, herramientas, transporte, economía y guardado solicitado posteriormente.

### Resultado final

| Comando / comprobación         | Resultado ejecutado                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `npm run art:miner`            | Exportación Pixelorama de 54 cuadros y variantes sin herramienta/pala; generación de iconos, NPC y variantes de metal    |
| `npm run art:interactions`     | PNG originales V2 regenerados, incluida previsualización en damero                                                       |
| `npm run typecheck`            | Aprobado                                                                                                                 |
| `npm run lint`                 | Aprobado                                                                                                                 |
| `npm run test`                 | **45/45** Vitest, 2 archivos                                                                                             |
| `npm run build`                | Aprobado, Phaser 4.2.1 y juego compilados                                                                                |
| `npm run test:e2e`             | **11/11**, 0 omitidas, 0 fallidas, 0 flaky; **103,37 s**                                                                 |
| `npm run format:check`         | Aprobado                                                                                                                 |
| `git diff --check`             | Sin errores de espacios; avisos de conversión LF/CRLF de Windows                                                         |
| Producción en `127.0.0.1:4173` | Canvas 480×270, tienda abierta con teclado real, cero errores JS/consola o solicitudes fallidas; `__MINA_GAME__` ausente |

Navegador: Microsoft Edge **157.0.4341.42**, Playwright **1.65.0**, headless. Pruebas a escala 2× y ventana estrecha 390 px (canvas conserva 1×). Producción inspeccionada a escala nativa 1×. El servidor temporal de producción se detuvo al terminar. No se instalaron dependencias ni aplicaciones; `package-lock.json` se conserva.

### Cobertura de las condiciones solicitadas

| Condición                                               | Evidencia                                                                                                                                                                                                         |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Z abre tienda solo cerca y elige una acción             | Edge: pulsación lejos no abre; al caminar hasta NPC abre. Unitarias: proximidad, orientación, invisibilidad/obstrucción y acción única                                                                            |
| Comprar, descontar dinero y rechazar saldo insuficiente | Edge: hierro 30→15, pala 15→5; tungsteno rechazado sin saldo. Test adicional compra tungsteno 150→105 y diamante 105→15 con saldo de fixture                                                                      |
| Hierro 10 s, tungsteno 5 s, diamante 2,5 s              | Tres pruebas Edge con mouse mantenido y reloj real: bloque todavía presente antes del plazo y una sola extracción después; tolerancia de observación hasta 1,5 s. Unitarias de frontera exacta a 15/30/60/144 FPS |
| Grietas, impactos y ciclo de picota                     | Edge muestrea más de dos cuadros distintos durante el trabajo; estado de progreso real. Sprites y partículas conectados al reloj de acción                                                                        |
| Durabilidad y rotura                                    | Edge: una extracción descuenta una unidad; picota con una unidad se rompe y rechaza otra extracción. Unitarias cubren umbrales 50%, 20% y cero                                                                    |
| Cancelación segura                                      | Edge: soltar, cambiar herramienta, alejarse y Escape; no entrega recursos ni consume durabilidad por trabajo incompleto                                                                                           |
| Máximo personal de cuatro                               | Edge: 4/4 bloquea minería y conserva terreno. Unitarias prueban conservación en transferencias parciales y rechazo por capacidad                                                                                  |
| Carro recibe material real                              | Edge: mochila baja y carro sube tras 1500 ms; cancelación conserva ambas cantidades. Unitarias: pila finita, capacidad y transacciones atómicas                                                                   |
| Carro solo sobre vía                                    | Edge: empuje con A/D y límite x≤386 en la red inicial. Unitarias: aceleración, frenado, extremo, segmento desconectado y obstrucción                                                                              |
| Comprar y construir vías                                | Circuito Edge compra riel, inicia vista previa y confirma Z: 15→16 segmentos y stock 1→0. Unitarias rechazan duplicados, paredes, huecos, falta de stock y desconexión                                            |
| Pala real animada                                       | Edge toma al menos cinco cuadros distintos de las siete fases. Volumen y desgaste solo cambian al completar. Pala rechaza roca dura                                                                               |
| Carga visual y NPC                                      | Inspección de capturas y proyección por carga en LogisticsView; NPC con distintos cuadros idle/conversación/entrega y diálogo completo                                                                            |
| Venta sin duplicación                                   | Circuito Edge mueve el carro, vende y verifica dinero y carro vacío. Unitarias rechazan monetizar el lote una segunda vez                                                                                         |
| Guardar y recuperar                                     | Edge recarga y conserva terreno, vías, dinero, herramientas, herramienta equipada y durabilidad. Unitarias incluyen carga del carro, pila suelta, materiales inválidos y versiones desconocidas                   |
| Mejora alcanzable y continuidad                         | Unitarias simulan compra de tungsteno tras 15 bloques de tierra, diamante tras otros 34 y pala de repuesto; auxilio condicionado ante insolvencia                                                                 |
| Regresión de movimiento/cámara                          | Edge verifica movimiento, salto sin repetición al mantener tecla, aterrizaje, pared, cámara desplazada y minería con coordenadas de mundo                                                                         |
| Recursos y resolución                                   | Edge recorre píxeles de hojas nuevas: paleta válida, alfa 0/255, 54 cuadros, ningún Text de fuente del sistema. Captura estrecha y compilado 1×                                                                   |

El circuito principal usa desplazamientos, teclas y mouse reales desde la primera compra hasta venta, construcción y recarga. Las pruebas aisladas de tiempos preparan la herramienta directamente para no repetir compras; el test de mejoras prepara el saldo y ejecuta las compras reales. No se presenta ese saldo de fixture como dinero ganado durante una sesión humana. La prueba unitaria económica usa lotes de tierra y transacciones reales para comprobar el cálculo.

### Revisión visual y correcciones

Se inspeccionaron la escena, la tienda 2×, el carro cargado y producción a 1×. Se ajustaron glifos de Z, porcentaje, moneda y separadores; se corrigió la descripción del producto seleccionado para que aparezca dentro de la tienda. Se eliminaron vías decorativas y la carga ficticia automática del carro. La hoja del minero se regeneró con poses y variantes que conservan tamaño y cuerpo físico. Una ejecución intermedia coincidió con regeneración/HMR de recursos y falló; se repitió con todos los PNG terminados. El resultado final de 11/11 corresponde al código y recursos definitivos.

Capturas actuales:

- [Escena V2](screenshots/v2-game.png)
- [Tienda y herramientas](screenshots/v2-shop.png)
- [Carro con carga real](screenshots/v2-cart.png)
- [Venta y partida recuperada](screenshots/v2-delivery.png)
- [Ventana estrecha](screenshots/v2-narrow.png)
- [Producción a 480×270](screenshots/v2-production-1x.png)

Muestra de rendimiento local: **120 frames en 828,7 ms ≈144,8 FPS** de render. Medición corta en Edge headless en este equipo, no garantía para otros dispositivos ni prueba de estrés prolongada. La duración de minería se verifica aparte con reloj absoluto. No se hizo evaluación auditiva humana: se comprobó carga de audio, ejecución sin errores y conexión de sonidos a las acciones; se reutilizan impactos CC0 ajustados en volumen/velocidad.

### Límites pendientes

- Un carro y vías horizontales en la fila inicial; curvas/rampas/cambios quedan preparados por tipo de segmento, sin implementación funcional.
- VENTA entrega y vende inmediatamente. No existe almacén separado, trabajadores autónomos, experiencia ni automatización.
- Guardado local de una partida por origen/navegador, sin nube ni coordinación entre pestañas. R rescata conservando progreso; recargar restaura la partida.
- Equilibrio inicial centralizado y calculado; la estimación de 8–12 minutos hasta diamante requiere validación con jugadores, no es una sesión humana cronometrada.
- Fondos provisionales y soporte de teclado/mouse; el canvas estrecho se desplaza horizontalmente, no añade controles táctiles.
- Sin commit ni publicación. El árbol ya contenía cambios de la dirección artística anterior; se conservaron.

## Verificación de iluminación y carro — 9 de noviembre de 2026

Carro artesanal reducido y oscuridad subterránea dinámica con lámpara del casco. Diseño en [GAME_DESIGN.md](GAME_DESIGN.md#iluminación-subterránea-y-carro-artesanal).

| Comando                | Resultado ejecutado                                            |
| ---------------------- | -------------------------------------------------------------- |
| `npm run typecheck`    | Aprobado                                                       |
| `npm run lint`         | Aprobado                                                       |
| `npm run test`         | **56/56** Vitest, 3 archivos (11 nuevas de iluminación)        |
| `npm run build`        | Aprobado                                                       |
| `npm run test:e2e`     | **14/14**, 0 omitidas, 0 fallidas, 0 flaky; 2,4 min (3 nuevas) |
| `npm run format:check` | Aprobado                                                       |

Edge 157 headless vía Playwright 1.65.0, escala 2×. Muestra local de rendimiento con la iluminación activa: **120 frames en 948 ms ≈126 FPS** (medición corta, no benchmark).

| Condición pedida          | Evidencia                                                                                                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Carro ≈ mitad del minero  | Edge mide el cuadro del minero (21 px visibles): carro 11 px = 52 %; ancho 20 px dentro de 1,3–1,8 veces el del minero; escala del sprite 1:1 (no deformado)                                          |
| Ruedas sobre el riel      | Última fila de ruedas en y = 154, fila superior de `rail_segment`; inspección ampliada de la captura                                                                                                  |
| Empuje, vías, Z y carga   | Edge: Z junto al carro inicia empuje, avanza >15 px con D, minero a 16 px del centro, Z suelta. Pruebas previas de carga con pala, carro lleno 20/20, retirada, venta y tope x ≤ 390 siguen aprobadas |
| Superficie iluminada      | Edge: zona A, lámpara apagada, luz 100 % en cabeza y cielo                                                                                                                                            |
| Transición en la bocamina | Edge: en x≈316 zona B con luz natural parcial; en x≈376 zona C y lámpara encendida al 100 %. Unitaria: bocamina > interior > fondo = 0                                                                |
| Solo la linterna revela   | Edge: delante >60 %, detrás <35 %, roca bajo la galería <10 %                                                                                                                                         |
| Giro izquierda/derecha    | Edge: tras pulsar A el haz se invierte (delante >60 %, detrás <35 %)                                                                                                                                  |
| La luz no atraviesa muros | Edge frente al muro: cara 4 px dentro >30 %, bloque de detrás <10 %. Unitarias: DDA, esquina diagonal cerrada, techo del túnel oscuro y losa de un bloque                                             |
| Excavar revela el hueco   | Edge con picota de diamante y mouse real: hueco >60 %, nueva cara >15 %                                                                                                                               |
| Alejarse oscurece         | Edge: al volver a x≈330 el hueco queda <10 %                                                                                                                                                          |
| Menús legibles            | Edge: profundidad del HUD > `DEPTH.lighting`; captura de la guía abierta bajo tierra                                                                                                                  |
| Sin parpadeos de cámara   | Edge: durante 60 cuadros caminando, la textura de oscuridad cubre siempre la vista; cero errores JS                                                                                                   |
| Zona profunda             | Edge con galería de fixture en fila 23: zona D, galería delante >20 %, detrás y roca lejana <5 %                                                                                                      |

Correcciones durante la inspección visual: el ambiente se veía como una malla de puntos regular (se pasó a Bayer 8 × 8, ambiente graduado por profundidad y punto negro de 2/64); el haz revelaba un fondo casi tinta (se dio textura de piedra a la pared subterránea y a la de la galería, sin luz pintada); el minero quedaba demasiado tramado (halo cercano 90 %, 20 px); la ventana de luz se amplió a 8 px de margen y se calcula tras la física para que siga al casco sin retraso; el carro de 12 px resultaba 57 % del minero y se asentó 1 px.

Capturas: [superficie](screenshots/v3-surface.png), [galería mirando a la derecha](screenshots/v3-gallery-right.png), [a la izquierda](screenshots/v3-gallery-left.png), [cara excavada](screenshots/v3-dug-face.png), [guía bajo tierra](screenshots/v3-help-underground.png), [zona profunda](screenshots/v3-deep.png), [empuje del carro](screenshots/v3-cart-push.png).

Límites: la penumbra cálida y el destello de menas usan colores de la paleta (no hay tinte aditivo, por la regla de alfa 0/255); el 4 % de ambiente en la galería se representa como un punteado apenas perceptible y el 2 % profundo como negro. Las capturas V2 previas (`v2-*.png`) se regeneraron con la nueva oscuridad. No se evaluó en otros navegadores ni con sesiones humanas largas.

## Verificación V3 — 9 de noviembre de 2026

Prompt maestro V3: sistemas de exploración, geología, vías con rampas, sostenimiento, ventilación, tronadura, salud, Luis, progresión y secreto. Respaldo previo del estado funcional en `.tools/backups/pre-v3-2026-11-09` (141 archivos; Git no está en el PATH, sin commit).

| Comando                              | Resultado ejecutado                                                |
| ------------------------------------ | ------------------------------------------------------------------ |
| `npm run format:check`               | Aprobado                                                           |
| `npm run typecheck`                  | Aprobado                                                           |
| `npm run lint`                       | Aprobado                                                           |
| `npm run test`                       | **79/79** Vitest, 4 archivos (23 nuevas en `V3.test.ts`)           |
| `npm run build`                      | Aprobado                                                           |
| `MINA_PORT=5174 npx playwright test` | **22/22**, 0 fallidas, 0 flaky; 3,4 min (8 nuevas en `v3.spec.ts`) |

Edge 157 headless, Playwright 1.65.0. Las e2e se ejecutaron contra un servidor de desarrollo propio en el puerto 5174 porque el servidor ya abierto en 5173 (ajeno a esta sesión) devolvía «504 Outdated Optimize Dep»; `playwright.config.ts` acepta ahora `MINA_PORT`. Muestra local: **120 frames en 961 ms ≈125 FPS** con todos los sistemas activos (medición corta, no benchmark).

### Estado por sistema

| Sistema                                                | Estado                        | Evidencia                                                                                                                                                              |
| ------------------------------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subsuelo oculto y descubrimiento                       | Terminado                     | e2e: 0 menas visibles de >40 enterradas desde la superficie, luz 0 en profundidad. Unitaria: menas y cavernas no descubiertas, mapa codificado                         |
| Antorchas, faros, luminarias                           | Terminado (sin red eléctrica) | Unitaria de instalación y consumo; captura con antorcha instalada; persistencia tras recargar                                                                          |
| Geología por semilla, 9 minerales                      | Terminado                     | Unitarias: reproducible, orden de abundancia en 9 semillas, un único mineral desconocido (fila ≥30), cinco tipos de yacimiento, zonas reservadas                       |
| Vías con rampas                                        | Terminado                     | Unitarias de perfil continuo, rechazo de 2 bloques, sin soporte y en roca; e2e con empuje real subiendo el escalón                                                     |
| Carro pequeño en rampa                                 | Terminado                     | e2e de proporción (11 px ≈52 %) y ruedas sobre el riel; e2e de rampa con ángulo y altura reales                                                                        |
| Sostenimiento y derrumbes                              | Terminado                     | Unitarias de estado, cuenta regresiva, cancelación con vigas y derrumbe localizado; e2e con alarma «DERRUMBE EN», vigas con clic derecho y escombro solo bajo el tramo |
| Ventilación                                            | Terminado (sin red eléctrica) | Unitaria: entrada > fondo, ventilador principal + ductos mejoran el frente, contaminación y disipación; e2e: aire peligroso → aviso, daño y lentitud; R recupera       |
| Herramientas y perforadora                             | Terminado                     | Unitarias de tiempos 5/3,5/2,5/5/2,5 s y una sola pala; e2e de picotas con reloj real; e2e de perforación con mouse mantenido                                          |
| Tronadura                                              | Terminado                     | Unitarias: barreno obligatorio, una carga, ≤3×3, nunca 9 en 60 semillas, un material por bloque; e2e con Q, clic derecho, mecha de 6 s y pila resultante               |
| Salud y muerte                                         | Terminado                     | Unitarias de protección, aire continuo y penalización; e2e de daño por aire                                                                                            |
| Luis                                                   | Terminado                     | Unitarias de prioridad, no repetición y lugar alcanzable/seguro; e2e de aparición y consejo con Z                                                                      |
| Etapas y bodega por categorías                         | Terminado                     | Unitaria y e2e: tungsteno, diamante y ventilación bloqueados hasta su etapa                                                                                            |
| Mineral desconocido y logro                            | Terminado                     | e2e: evento una vez, logro guardado y recuperado                                                                                                                       |
| Guardado V3 y migración V2                             | Terminado                     | Unitarias: roundtrip, mechas apagadas al cargar, rechazo de mena creada, migración con plata/cuarzo liquidados                                                         |
| Trabajadores contratados                               | **Pendiente**                 | No existían en el proyecto; no se implementaron contratación, rutas ni tareas                                                                                          |
| Red eléctrica, automatización, mejoras de ventiladores | **Pendiente**                 | Faros con batería y luminarias sin consumo; no hay generador ni cableado                                                                                               |

### Correcciones durante QA

- Las cavernas naturales selladas se evaluaban como galerías y habrían iniciado derrumbes ocultos: ahora solo cuenta lo excavado y la galería original.
- Los marcos recibían ids nuevos al cargar; la reconstrucción es ahora estable.
- El carro se soltaba en el escalón de una rampa: la línea de visión desde el cuerpo cruzaba la esquina y la comprobación de espacio solo probaba una altura. Se aceptan la visión desde la cabeza y la altura de un escalón; el minero sube el escalón al empujar.
- Varias pulsaciones dentro de un mismo cuadro se perdían en la bodega: se cuentan las repeticiones.
- Pruebas e2e ajustadas a los tiempos V3 (pala 5 s) y a la bodega por categorías.

Capturas: [subsuelo oculto](screenshots/v3-hidden-subsoil.png), [rampa](screenshots/v3-ramp.png), [aviso de derrumbe](screenshots/v3-collapse-warning.png), [mecha encendida](screenshots/v3-fuse.png), [después de la tronadura](screenshots/v3-after-blast.png), [aire peligroso](screenshots/v3-bad-air.png), [Luis](screenshots/v3-luis.png), [evento secreto](screenshots/v3-secret.png).

### Límites

- Arte nuevo generado por código con la paleta de 24 colores (íconos, gemas, marcos, luces, ductos, ventiladores animados, dinamita, Luis). No se descargaron recursos de terceros en esta etapa: la búsqueda en los sitios indicados no se realizó; se optó por originales para mantener la estética NES y la paleta.
- El balance (etapas, precios, cargas y aire) es inicial y requiere sesiones humanas; no se cronometró una partida completa.
- Sonidos de crujido, mecha y explosión reutilizan muestras CC0 existentes con otra velocidad y volumen; no hay un sonido de explosión dedicado.
- La rampa es de 45°: el carro gira con el perfil (sin antialiasing) y el minero sube el escalón al empujar; no camina sobre el riel.

### Ajuste de luz — antorcha 5×5 y casco 3×3

A pedido del usuario la antorcha ilumina un cuadro de 5 × 5 bloques y el casco uno de 3 × 3, ambos con desvanecido gradual. Medido en Edge: antorcha 100 % hasta 40 px del centro y luego 75 % → 43 % → 10 % → 0; casco 100 % dentro del cuadro y luego 88 % → 39 % → 0. El casco deja de ser un cono direccional. Verificación: format, typecheck, lint, **78/78** Vitest, build y **22/22** e2e (`MINA_PORT=5174`).

Las dos antorchas fijas de la galería de la bocamina pasan de emisión mínima a la misma luz de antorcha (5 × 5 bloques con desvanecido, ocluida y en caché). En Edge la galería queda iluminada al 100 % entre x = 330 y 410 y la roca siguiente a 3 %. La prueba de alejarse verifica ahora que la luz del casco deja la zona. Verificación: format, typecheck, lint, 78/78 Vitest, build y 22/22 e2e.

## Verificación V4 + V5 — 10 de noviembre de 2026

V4: inventario por casillas y niveles, panel de equipo, EPP obligatorio con control de acceso, aplastamiento en derrumbes, modos Normal/Hardcore y logros. V5: kit de EPP gratuito, Tab para el inventario, inventario visual con tooltips, cinco corazones y modo desmontar. Respaldo previo en `.tools/backups/pre-v4-2026-11-09` (sin commit; Git no está en el PATH).

| Comando                              | Resultado ejecutado                                             |
| ------------------------------------ | --------------------------------------------------------------- |
| `npm run format:check`               | Aprobado                                                        |
| `npm run typecheck`                  | Aprobado                                                        |
| `npm run lint`                       | Aprobado                                                        |
| `npm run test`                       | **97/97** Vitest, 5 archivos (`V4.test.ts` nuevo, 19)           |
| `npm run build`                      | Aprobado                                                        |
| `MINA_PORT=5174 npx playwright test` | **29/29**, 0 fallidas; 5,4 min (`v4.spec.ts` 4, `v5.spec.ts` 3) |

Edge headless, Playwright 1.65.0, servidor de desarrollo propio en el puerto 5174. Muestra local: 120 frames en 2,2 s ≈55 FPS durante la suite (antes ≈125 en una corrida sin carga; en una medición aislada el juego llega al límite de 60 FPS del navegador y la iluminación usa ~3 ms por cuadro).

| Condición                                            | Evidencia                                                                                                                                                                                                                  |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6 casillas, resto con candado y desbloqueo por nivel | Unitarias de tabla y desbloqueo; e2e: aviso «SE DESBLOQUEA EN EL NIVEL N» al pasar el cursor                                                                                                                               |
| Mover sin duplicar, equipar, persistir               | e2e con arrastre real y doble clic; recarga conserva casillas, herramienta y EPP                                                                                                                                           |
| Carga de 4 bloques independiente                     | Unitaria con 12 casillas y carga 4/4                                                                                                                                                                                       |
| EPP visible sobre el minero                          | e2e: textura derivada con las cinco piezas; capturas del panel y del sprite                                                                                                                                                |
| Sin EPP no se entra                                  | e2e: bloqueo en el portal y al aparecer dentro; panel con ✓/✕                                                                                                                                                              |
| Kit gratuito una vez                                 | Unitarias: gratis, una vez, sin duplicar piezas; e2e: se reclama en la bodega sin gastar                                                                                                                                   |
| Derrumbe letal solo si aplasta                       | e2e: galería lejana sin daño; minero bajo la columna que siempre cae → muerte y reaparición Normal (−10 % y carga perdida)                                                                                                 |
| Hardcore definitivo                                  | e2e: muerte → «FIN DE LA EXPEDICIÓN»; recargar no reanuda; nueva mina archiva e historial                                                                                                                                  |
| Tab / Esc                                            | e2e: Tab abre, cierra y reabre; el foco no salta a botones; Esc cierra                                                                                                                                                     |
| Tooltip con datos reales                             | e2e: nombre y durabilidad de la herramienta bajo el cursor                                                                                                                                                                 |
| Cinco corazones                                      | Unitaria de medios corazones; e2e: 30 de daño → 3½ corazones; 0 HP → muerte                                                                                                                                                |
| Desmontar con X                                      | e2e: antorcha retirada y luz apagada; viga crítica pide confirmación, Esc cancela, Enter retira y el techo deja de estar estable; riel bajo el carro bloqueado; riel libre vuelve al inventario; todo persiste al recargar |
| Recuperación sin duplicar                            | Unitaria: ciclos de colocar/desmontar no aumentan las vigas; riel devuelve exactamente 1                                                                                                                                   |
| Aire y luz al desmontar                              | Unitarias: ducto y ventilador retirados actualizan la red; luz retirada invalida su caché                                                                                                                                  |
| Migraciones                                          | Unitarias: V3→V4 entrega EPP básico; V4→V5 conserva EPP, marca el kit y compensa $75 una sola vez                                                                                                                          |

### Correcciones durante QA

- Retirar un riel del medio dejaba una vía en dos tramos y el validador de guardado rechazaba la partida entera al cargar; ahora acepta vías cortadas.
- El clic del modo desmontar se perdía en cuadros lentos (se leía el estado del botón); ahora se registra por evento.
- Un riel bajo el entibado fijo de la bocamina quedaba tapado por la viga permanente; ahora se elige lo desmontable.
- Varias pruebas dependían de la semilla aleatoria del mundo (techo de roca dura o mena) o del orden de logros; se fijaron a la zona reservada sin yacimientos y a comprobaciones específicas.
- En corridas largas bajo carga, dos pruebas de V3/V4 fallaron de forma intermitente por cuadros de más de 500 ms (regla existente que cancela el trabajo) y pasaron aisladas; se amplió su muestreo.

### Límites

- No hay menú de ajustes dentro del juego: los controles se cambian con `localStorage['mina-cero.controls']`.
- Los navegadores no distinguen Tab izquierda de derecha; cualquier Tab abre el inventario.
- Trabajadores contratados, red eléctrica y automatización siguen sin implementar (las estadísticas de Hardcore muestran 0 trabajadores).
- Arte nuevo (EPP, kit, corazones, llave, martillo, candado) original por código con la paleta; no se buscaron ni descargaron recursos externos.
- Retirar carga del carro pasó de X a V para liberar X al modo desmontar.

## Verificación V6 — 10 de noviembre de 2026

Rediseño artístico V6, antorchas en la muralla, rieles con clic derecho, nombre de la mina, letrero con luz propia y exposición real a la luz. Respaldo previo en `.tools/backups/pre-v6-2026-11-10`.

| Comando                              | Resultado ejecutado                                               |
| ------------------------------------ | ----------------------------------------------------------------- |
| `npm run format:check`               | Aprobado                                                          |
| `npm run typecheck`                  | Aprobado                                                          |
| `npm run lint`                       | Aprobado                                                          |
| `npm run test`                       | **114/114** Vitest, 9 archivos                                    |
| `npm run build`                      | Aprobado                                                          |
| `MINA_PORT=5174 npx playwright test` | **38/38**, 0 fallidas; 5,4 min (Edge headless, Playwright 1.65.0) |

Pruebas nuevas: `palette.test.ts` (40 colores, sucesores V6), `Placement.test.ts` (antorcha en la muralla, rieles), `mineName.test.ts` (máx. 10, caracteres, guardado y migración), `ExposureMap.test.ts` (silueta, roca, galería oscura, reconstrucción); e2e `v6-visual.spec.ts` (7 vistas), `placement.spec.ts` (clic derecho real), `mine-name.spec.ts` (escritura con atajos M/H/F/R/Z sin efectos, límite de 10, persistencia) y `exposure.spec.ts` (antes/después y oscuridad interior).

### Evidencia visual (capturas reales del renderizador)

`docs/screenshots/`: `v6-surface`, `v6-entrance`, `v6-tunnel`, `v6-helmet`, `v6-torches`, `v6-inventory`, `v6-shop`, `v6-cart`, `v6-mine-name`, `v6-mine-name-sign`, `v6-entrance-before` y `v6-entrance-after`. En «before» la mitad derecha del letrero, el dintel y la franja de seguridad quedan tapados por el punteado de la roca de la ladera; en «after» conservan sus colores y el interior de la montaña sigue negro.

### Comprobaciones de iluminación (exposure.spec.ts)

Al sol y sin oscuridad: letrero, dintel, bodega y punto de venta. Oscuro: roca maciza de la ladera, roca sobre una galería y una viga lejos del casco. Iluminado: el entorno del casco. El resultado no cambia tras desplazar la cámara y volver.

### Rendimiento

Costo de LightingSystem por cuadro en el navegador del panel (Chromium, 120 cuadros): 0,98 ms sin exposición y 1,25 ms con ella; el cuadro que reconstruye el mapa tras excavar, 3,7 ms. No se midieron FPS en esta etapa: el panel estaba oculto y el navegador frena `requestAnimationFrame`; la última medición de FPS es la de V5 (≈55 FPS bajo carga de la suite).

### Límites

- La imagen de referencia del encargo V6 no llegó adjunta: se siguió su descripción escrita y su paleta.
- No se descargaron recursos de terceros; todo el arte nuevo es original por código.
- Los trabajadores contratados no existen todavía, por eso no se rediseñaron.
- Las partículas y la vista previa de vías no participan en la exposición (no son estructuras).
- El nombre no admite dígitos porque 1 y 2 eligen la modalidad en la misma pantalla.

### Ajuste de tiempos (10 de noviembre de 2026)

Picota de hierro 2 s por bloque (antes 5 s); pala y carga del carro 2 s por bloque (`BALANCE.shovelMs`, antes 5 s). Ejecutado: 114/114 Vitest, build, y 37/38 Playwright en la corrida completa; la prueba de capturas `v6-visual` superó su límite de 60 s porque el equipo estaba más lento (la suite tardó 8,5 min en vez de 5,4) y pasó al repetirla con límite de 150 s. Nota de balance: el hierro (2 s) queda más rápido que el tungsteno (3,5 s) y el diamante (2,5 s), que conservan su mejor durabilidad y su capacidad de romper roca dura y gemas.

## Consola de desarrolladores — 10 de noviembre de 2026

Consola pixel art con `|` / Escape, escritura capturada antes de Phaser y Enter para ejecutar `money` o `fullstacks`. Activación exclusiva con servidor de desarrollo y `?dev=1`. Guardado, archivo e historial separados de las minas normales; flags opcionales en V5, ignorados fuera de desarrollo. La tienda y las transacciones consultan la misma regla de desbloqueo.

| Comprobación                                                         | Resultado ejecutado                                                  |
| -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `npm run typecheck`                                                  | Aprobado                                                             |
| `npm run lint`                                                       | Aprobado                                                             |
| `npm run test`                                                       | **119/119**, 10 archivos                                             |
| `npm run build`                                                      | Aprobado                                                             |
| `MINA_PORT=5175 npm run test:e2e`                                    | **39/39**, 5,5 min, Edge headless                                    |
| `MINA_PORT=5175 npm run test:e2e -- tests/developer-console.spec.ts` | **2/2**, 27,5 s, tras el ajuste final de pausa y cursor              |
| Producción con `vite preview`, Edge y `?dev=1`                       | Sin consola, flags ni guardado de desarrollo; sin errores JavaScript |
| Prettier sobre los archivos de esta tarea                            | Aprobado                                                             |

Las cinco pruebas unitarias nuevas cubren la doble condición de habilitación, dinero infinito con saldo cero y retorno al cobro normal, todo el catálogo disponible sin subir XP ni etapas, kit único y capacidad intactos, comandos desconocidos, persistencia, compatibilidad con saves sin flags y rechazo de valores no booleanos.

Las pruebas de navegador comprueban apertura mediante el carácter `|` con Ctrl+Alt (AltGr), apertura/cierre normal, Escape, escritura sin disparar movimiento/salto/atajos, clics de compra y construcción bloqueados, compras reales por Z con saldo cero, recarga, reinicio sin listeners duplicados y partida normal intacta. La prueba adicional mantiene una mecha encendida durante la pausa y verifica que conserva tiempo para alejarse al cerrar; también simula almacenamiento fallido, comprueba el aviso y reintenta con F.

Evidencia visual revisada: `docs/screenshots/developer-console.png`, marco industrial y BitmapText V6, sin fuentes del sistema ni transparencia parcial. El cursor utiliza un glifo existente de la fuente. No se añadieron dependencias ni recursos externos.

Limitaciones: la combinación española se simula con eventos de navegador; no se probó un teclado físico con distribución española. No se midió rendimiento nuevo. Durante la suite completa apareció el aviso preexistente de frame `14` ausente en `mineral-items` en la prueba del mineral desconocido; esa prueba pasó. Después del último ajuste exclusivo de consola se repitieron sus dos pruebas, typecheck, lint, Vitest y build; no se repitió toda la suite de 40 casos.

### Comando mochila — 10 de noviembre de 2026

`mochila` desbloquea permanentemente las 24 casillas en desarrollo y muestra confirmación; repetirlo no lo desactiva. Se persiste como `developer.fullBackpack`, validado como booleano y sin efecto en partidas normales. La capacidad se restaura antes de reconciliar las casillas para conservar la posición de los objetos; subir de nivel tampoco vuelve a bloquearlas. Nivel, XP, carga mineral (4), carro (20), dinero y acceso a la tienda mantienen sus reglas.

Comprobaciones ejecutadas: typecheck, lint, build y **121/121 pruebas Vitest** aprobados; Prettier aprobado en todos los archivos modificados. Dos pruebas unitarias nuevas verifican desbloqueo, repetición, última casilla, subida de nivel, aislamiento de partidas normales, flags inválidos y saves anteriores sin el campo. La nueva e2e escribe el comando en la consola, comprueba la confirmación, guarda tres antorchas en la casilla 24 y las recupera en esa misma posición después de recargar. Evidencia revisada: `docs/screenshots/developer-mochila.png` (24 casillas sin candados, nivel 1, antorchas en la última casilla).

## HUD, acceso rápido y subida de nivel — 10 de noviembre de 2026

Typecheck, lint y build aprobados; **136/136 pruebas Vitest**. Primera corrida de regresión: **41/44 en Edge** (7,9 min). Los tres casos fallidos se corrigieron en las pruebas: coordenadas de cámara para el cobre, asignación explícita de la picota comprada en el circuito comercial y espera por el segundo marco de sostenimiento. Corrida focalizada final: **9/9 en Edge** (1,5 min), incluidos esos tres casos, el ascenso en galería añadido después de la primera corrida, la última antorcha y ambas revisiones visuales V6. No se volvió a ejecutar toda la suite después del ajuste final de presentación.

Verificación en Edge headless con Playwright. La suite unitaria incluye referencias por ID, repuestos del mismo tipo, descarte, agotamiento y migración de una barra antigua. Para XP cubre las nueve menas, premio único por yacimiento y anclaje, umbrales, excedente, múltiples premios, límite de tiempo de trabajo, nuevas casillas y migración sin oro duplicado.

En navegador se verifica el arrastre real desde mochila y equipamiento, teclas 1–5, Tab, tooltip, selección vacía, guardado y las vistas de 390×650, 1280×800, 1920×540 y 1920×1080. El canvas sigue siendo de 480×270; a 390 px se desplaza horizontalmente y conserva píxeles enteros. La extracción real de cobre completa la barra, enciende un haz de 96 px en superficie, muestra estrellas y entrega oro y velocidad; se comprueba que el control sigue respondiendo y que recargar conserva el excedente sin repetir el premio. En galería, se verifica el recorte del haz en el techo mientras se mueve el carro y que no se añadan luces ni se revele una celda oculta.

Muestra de rendimiento local: 120 callbacks de `requestAnimationFrame` en 1.020 ms (≈118/s, Edge headless, prueba de escalado estrecho). Es una medida de la cadencia del navegador en esa ventana, no una garantía de FPS del juego ni una medición de hardware móvil.

Capturas revisadas: [HUD](screenshots/hud-acceso-rapido.png), [inventario](screenshots/inventario-acceso-rapido.png), [ventana estrecha](screenshots/hud-acceso-rapido-estrecho.png), [escala 3×](screenshots/hud-acceso-rapido-3x.png), [haz](screenshots/ascenso-haz.png), [premios](screenshots/ascenso-premios.png) y [galería](screenshots/ascenso-galeria.png). No se probó en un dispositivo móvil físico. La regresión reprodujo el aviso preexistente de frame 14 ausente de `mineral-items`; el caso del mineral desconocido pasó.

### Aviso flotante de XP

Typecheck, lint, build y **136/136 pruebas Vitest** aprobados. `npm run test:e2e -- tests/level-up.spec.ts`: **2/2 en Edge headless** (18,6 s), con ascenso, premios y persistencia. La comprobación visual directa de `+2 XP` confirmó que el atlas tiene alfa 0/255, que el aviso no emite comandos para dibujar cajas y que sube antes de ocultarse (701 ms observados). Capturas: [1×](screenshots/xp-popup-1x.png) y [3×](screenshots/xp-popup-3x.png). No se repitió la suite de navegador completa para este ajuste visual.

### Bocamina sin cartel

Retirados del código el tablero, sus dos cuadros animados, texto, emblema, patas, halo y tres luces propias. Se conserva el atlas compartido `mine` con sus demás piezas; el encamado queda directamente sobre el dintel. Farol exterior, lámpara interior, antorchas, vigas, señales de seguridad, terreno e interacciones permanecen. El nombre sigue guardándose como identificación de la partida.

Typecheck, lint, build y **136/136 pruebas Vitest** aprobados. **7/7 pruebas focalizadas en Edge headless** (50,6 s): ausencia de piezas/animación/luces del cartel, nombre persistente, exposición solar, oclusión subterránea, movimiento, salto, cámara y acceso con EPP. Las pruebas conservan cuatro luces decorativas y dos antorchas. No se repitió toda la suite de navegador.

Capturas revisadas: [escena 1×](screenshots/entrada-sin-cartel-1x.png) y [entrada 3×](screenshots/entrada-sin-cartel-3x.png), sin restos ni soportes flotantes. Muestra local: 120 callbacks de `requestAnimationFrame` en 831 ms (≈144/s), Edge headless; mide la cadencia del navegador, no garantiza FPS en otros equipos.

## Verificación V7 — bioma del Atacama y ciclo día/noche (10 de noviembre de 2026)

Edge con Playwright 1.65.0 (WebGL), servidor de desarrollo en 127.0.0.1:5173.

| Comprobación | Resultado |
| --- | --- |
| npm run typecheck | Aprobado |
| npm run lint | Aprobado, sin errores |
| npm run test | **146/146** Vitest (13 archivos; nuevos: `DayNightCycle.test.ts`, silueta en `ExposureMap.test.ts`, 7 tonos V7 en `palette.test.ts`) |
| npm run build | Aprobado |
| npm run test:e2e | **48/48**, 0 fallidas, 7,5 min (incluye `tests/v7-desert.spec.ts`, 3 pruebas nuevas) |

### Cobertura de lo pedido

1. Estética desértica: capturas `v7-dawn`, `v7-noon`, `v7-sunset`, `v7-night`, `v7-birds`, `v7-night-warehouse`, `v7-night-entrance`, `v7-noon-tunnel` en docs/screenshots (cuadro real ×3, vecino más cercano), revisadas una por una.
2. Instalaciones: toda la batería anterior (tienda, venta, carro, rieles, minería, inventario, EPP, Luis, ventilación, sostenimiento, tronadura, desmontaje, guardado) sigue aprobada.
3. Nubes: la posición en pantalla cambia en 1,5 s sin mover al jugador.
4. Aves: el cuadro de la hoja cambia mientras vuelan (aleteo real, no una imagen deslizada).
5–6. Sol y cielo: el sol sube del amanecer al mediodía, baja y avanza hacia la derecha al atardecer; los cuatro momentos muestran cielos distintos.
7–8. Duración: a los 300 s empieza la noche y a los 600 s vuelve el amanecer (Vitest a 30 y 144 FPS da el mismo reloj).
9. Luna visible de noche; estrellas presentes (`stars` = 1).
10. Luminarias: de noche la luz junto a la ventana de la bodega supera la del aire abierto, que queda oscura pero no negra (> 0,15).
11. Subsuelo: a mediodía la roca enterrada sigue < 0,1 de luz y el casco funciona en el túnel; la prueba de iluminación V3 y la de exposición siguen aprobadas.
12. Guardado: reloj en 420 s → guardar → recargar → fase noche, mismo instante (± 5 s de juego).
13. HUD: una sola máscara de oscuridad, bajo `DEPTH.worldUi`; con el inventario abierto el reloj no avanza.
14. Sin errores de compilación ni de página en las pruebas.

### Correcciones durante QA

- La oscuridad nocturna tramaba también el cielo (parecía un filtro): ahora el cielo abierto queda libre y el fondo pinta su propia hora; solo se oscurecen los objetos.
- Las transiciones del cielo usaban tableros entre colores lejanos: se cambiaron por rampas de cinco colores de la paleta.
- Dunas y lomas mostraban bloques de sombra con bordes verticales: la sombra solo baja unos píxeles bajo la cresta, con borde ondulado.
- Una partida nueva empezaba al inicio del amanecer (a oscuras) y rompía la prueba de iluminación de superficie: ahora empieza de mañana (60 s).
- La prueba del cartel de la bocamina esperaba 4 luces decorativas; V7 añade la ventana de la bodega (5).

### Límites

- No se midieron FPS en una sesión jugada de 10 minutos reales; las pruebas fijan el reloj. El costo añadido por cuadro es la silueta de los objetos móviles y la comparación por píxel del cielo abierto, solo de noche o en el crepúsculo.
- El sonido del viento se generó y se conectó, pero no se escuchó en las pruebas headless.
- La rotación del carro en rampas no se aplica a su silueta nocturna (desvío de 1–2 px de noche).

## Verificación HUD V8 (10 de noviembre de 2026)

| Comprobación | Resultado |
| --- | --- |
| npm run typecheck | Aprobado |
| npm run lint | Aprobado, sin errores |
| npm run test | **146/146** Vitest |
| npm run build | Aprobado |
| npm run test:e2e | **50/50**, 0 fallidas, 7,9 min (nueva `tests/v8-hud.spec.ts`, 2 pruebas) |

- Capturas revisadas (×3, vecino más cercano): `v8-hud-surface`, `v8-hud-tooltip`, `v8-hud-xp`, `v8-hud-gallery`, y las V6/V7 regeneradas (tienda, inventario, túnel, noche).
- Lógica conservada: cinco corazones y su parpadeo, XP y su animación (`xpFill`), dinero, EPP, carga, teclas 1–5, arrastre al acceso rápido, tooltips de casilla y de experiencia, Tab, tienda y guía siguen aprobados en hotbar, level-up, v4, v5 y mining.
- Clics: los tres módulos y la bandeja bloquean el mundo; el hueco bajo la barra superior y los lados de la bandeja no (prueba V8 y la de escala entera en cuatro ventanas).
- Correcciones durante la revisión: módulos laterales igualados (un tubo de unión a un solo lado desequilibraba la barra), insignia sin el rótulo «NV» ilegible, logro y diálogo de Luis elevados para no tocar la bandeja, corazones vacíos visibles sobre el panel y detalle de experiencia centrado.
- Prueba ajustada: `v4.spec.ts` esperaba el texto «EPP 5/5»; ahora el rótulo EPP es fijo y el valor es «5/5».
- Límite: el bloque de la tienda, la guía y el inventario conservan su diseño V6; solo comparten la casilla nueva de la barra rápida.

## Corrección de la noche (10 de noviembre de 2026)

Problema reportado: de noche el exterior se veía mal. Causa: el oscurecimiento por trama Bayer azul marino sobre todos los objetos parecía ruido a tamaño real, y sin casco (EPP 0/5) el minero quedaba tramado y casi invisible; el fondo usaba además cuadros intermedios con tablero 50 %.

- La noche exterior es ahora un tinte parejo (`systems/NightTint.ts`): mundo azul luna, personajes más claros, antorchas/faroles/lámparas/ventana sin tinte. La trama queda solo para la luz natural del subsuelo.
- El fondo usa solo los colores planos de sus rampas.
- Se retiró el código que solo servía a la trama exterior (siluetas dinámicas, rieles marcados, tono exterior y cobertura de ExposureMap).
- Se reparó la codificación de `tests/v7-desert.spec.ts` (tildes dañadas por un reemplazo con PowerShell).

| Comprobación | Resultado |
| --- | --- |
| typecheck / lint | Aprobados |
| Vitest | **146/146** (tinte nuevo en `DayNightCycle.test.ts`) |
| build | Aprobado |
| e2e | **50/50**, 9,0 min; la prueba de noche verifica exterior sin trama (luz 1), muro de la bodega #6C7BBD, minero #A3B0E4, ventana y antorchas blancas |

Capturas revisadas: `v7-night-warehouse`, `v7-night-entrance`, `v7-sunset`, `v7-dawn`.

## Verificación V8 — campamento, mundo ampliado, energía, hambre y descanso (11 de noviembre de 2026)

| Comprobación | Resultado |
| --- | --- |
| typecheck / lint | Aprobados |
| Vitest | **159/159** (nuevo `V8Survival.test.ts`: unidades, consumo por bloque, caminar, hambre y desnutrición, dormir, alimentos, salto de fase, mundo 140 columnas, campamento, guardado V6 y migración V5) |
| build | Aprobado |
| e2e | Suite completa **55/57** en la primera pasada (14,3 min); tras los dos ajustes de abajo, `mine-name` y `level-up` **5/5** en una nueva pasada. Nuevo `v8-survival.spec.ts` **7/7**: mundo a ambos lados y cámara, pabellón con Z (entrar, caminar, salir), dormir día→noche y noche→día con energía completa sin tocar dinero/inventario/XP, HUD 5 + 5 y consumo al picar, daño por agotamiento y desnutrición que se detiene al comer, tienda de alimentos con compra, barra rápida e inventario, y guardado/recarga dentro del pabellón |

- Pruebas ajustadas: `mine-name.spec.ts` listaba exactamente las luces del escenario; ahora incluye las 7 del campamento. `level-up.spec.ts` sondeaba ventanas de ~200 ms (barra llena, haz y estrellas) y perdía el instante según la carga del equipo; ahora un observador por cuadro registra que ocurrieron. Se midió el costo por cuadro en Edge sin interfaz (~20 ms, sin cuadros largos al subir de nivel): no se encontró una regresión de rendimiento.
- Capturas revisadas (×3, vecino más cercano): `v8-camp-day`, `v8-camp-night`, `v8-cabin-interior`, `v8-sleeping`, `v8-cabin-night`, `v8-hud-survival`, `v8-eating`, `v8-world-right`.
- Límites: el suelo del campamento no se excava (es el campamento, no la concesión). Dormir no avanza el desgaste de antorchas, vigas ni el tiempo de las estadísticas (para no alterar el progreso). La carga inicial tarda unos segundos más por las texturas de parallax más anchas.

## Verificación de la corrección de iluminación (11 de noviembre de 2026)

| Comprobación | Resultado |
| --- | --- |
| typecheck / lint | Aprobados |
| Vitest | **163/163** (nuevo `lighting/Quantize.test.ts`: 4 niveles, bandas limpias sin trama, trama Bayer 4 × 4 opcional solo en el borde de banda, ambiente azul en lo descubierto) |
| build | Aprobado |
| e2e | **57/57**, 14,2 min (incluye exposición, galería con casco y antorchas, noche V7, zona profunda, subsuelo oculto y V8) |

- Prueba ajustada: `UndergroundDarkness.covered` considera luz plena tanto el blanco como el ámbar del nivel 3 (antes solo «sin oscuridad»); `exposure.spec.ts` no cambió.
- Revisión visual en el navegador: galería de la bocamina con antorchas (muros ámbar en bandas, la roca corta la luz, sin puntos), zona profunda con solo el casco (haz en bandas, ambiente azul en lo descubierto, negro en lo desconocido) y campamento de noche (charcos ámbar en suelo, muros y minero; sin halo sobre el cielo ni los cerros).
- Límites: celdas de 4 px dan bordes escalonados (intencional, retro). La trama queda desactivada por defecto; se activa con `LIGHTING.dither.enabled`.


## Verificación del menú principal (11 de noviembre de 2026)

| Comprobación | Resultado |
| --- | --- |
| typecheck | Aprobado |
| lint | Los archivos nuevos pasan. El comando `eslint .` sigue fallando por `debug-lamp.tmp.mjs` (9 errores `no-undef` en un script temporal ajeno al menú, que ya estaba en la raíz) |
| Vitest | **189/189** (`MenuData.test.ts`: 16 pruebas de arranque, resumen y migración del guardado, respaldo, tiempo de juego y ajustes) |
| build | Aprobado |
| e2e | **67/73** en 10,4 min. Las **13 pruebas nuevas de `menu.spec.ts` aprueban**; fallan 6 que no tocan el menú (ver abajo) |

**Cobertura de `menu.spec.ts`.** Cuatro botones y marco de la página oculto; navegación por teclado que salta Continuar desactivado y da la vuelta; selección con el cursor y clic; sonido que se alterna, silencia Phaser y se recuerda tras recargar; efectos reducibles y `prefers-reduced-motion`; Nueva partida sin guardado (entra a nombre y modalidad y devuelve el marco); Continuar que recupera nombre, modalidad y partida; Nueva partida con guardado (pide confirmación, cancelar no toca nada, confirmar crea una sola copia en `mina-cero.archive.<ts>` y deja intacto el guardado hasta elegir modo); guardado ilegible (Continuar desactivado y respaldo al empezar); Salir (confirmación y aviso de que el navegador no cierra la pestaña); escala entera y centrado a 1920 × 1080 (4×), 1280 × 800 (2×), 1366 × 600 (2×), 800 × 600 (1×) y 3840 × 2160 (5×); y 360 px de ancho con 1× y desplazamiento.

**Revisión visual en el navegador integrado.** Menú a 2× en 1024 × 768 (lienzo 960 × 540 centrado, ~56 fps con efectos): título, botones con piqueta y destello, panel de partida guardada, diálogo de confirmación, panel de configuración y la persiana de entrada y salida. Ambiente: niebla tramada, halos de farolas, brasas, humo y destellos visibles.

**Las 6 pruebas que fallan** no dependen del menú (la ruta de arranque de las pruebas es la de siempre: `navigator.webdriver` entra directo a la mina):
- `lamp.spec.ts` ×3: `ReferenceError: LIGHTING is not defined` dentro de `page.evaluate` (la prueba serializa una función que usa un import) y un haz que no vuelve a 1 al reequipar el casco.
- `mining.spec.ts:160` y `:570`: esperan saldos de la tienda (35 y 155) que difieren de los precios actuales (25 y 190).
- `v8-survival.spec.ts:310`: el saldo tras comprar comida no coincide con el esperado.

No se comprobó contra una versión anterior del árbol (no hay Git en el PATH), así que quedan como pendientes de revisar aparte.

**Límites del menú.**
- Salir no puede cerrar una pestaña normal del navegador; el menú lo informa.
- No existen: reasignar teclas desde el menú, volumen o música, y volver al menú desde la partida (se recarga la página).
- El silencio elegido en el menú se recuerda, pero la tecla M durante la partida solo cambia esa sesión.
- La ilustración de fondo está fuera de la paleta de 49 colores y su licencia está sin verificar (docs/ASSET_CREDITS.md).
- Phaser entregó a veces dos veces un mismo evento de teclado cuando dos teclas caían en el mismo fotograma; el menú atiende cada evento una sola vez (WeakSet). No se llegó a la causa dentro de Phaser.
- Con el navegador ocupado (e2e en paralelo) la persiana de entrada tarda varios segundos; en reposo dura 0,5 s.


## Verificación de «La herencia del abuelo» (11 de noviembre de 2026)

| Comprobación | Resultado |
| --- | --- |
| typecheck | Aprobado |
| lint | Los archivos nuevos pasan; `eslint .` sigue fallando solo por `debug-lamp.tmp.mjs` (script temporal previo, 9 errores `no-undef`) |
| Vitest | **203/203** (`IntroProgress.test.ts`: 14 pruebas de arranque, pasos, orden, guardado y partidas anteriores) |
| build | Aprobado |
| e2e | **76/80** en 10,6 min. Las **7 pruebas nuevas de `intro.spec.ts` aprueban** (y las 13 del menú) |

**Cobertura de `intro.spec.ts`.** Inicio en la cabaña tras elegir modo y diálogo omitible con Esc; E completa la línea y pasa de página sin mover la figura; caminar con D y E sobre calendario, estufa, ventana y repisa (indicaciones `[E]` y frase breve); secuencia completa con acciones reales (puerta, cajón de la bodega con picota equipada, kit, inspección de la entrada con prioridad sobre la pila de material, primera extracción con clic mantenido, regreso, tabla suelta, libro y relectura); progreso y guía oculta que se guardan y se retoman al recargar; recarga durante el diálogo inicial; y partida sin secuencia (navegador automatizado) sin cambios. Capturas reales en `docs/screenshots/intro-*.png`.

**Revisión visual.** Cabaña con el diálogo en la franja inferior, tabla suelta con destello y flecha, libro con su primera página, hueco abierto con el libro y la tabla apartada, y el diálogo del cajón en la bodega. Se corrigió durante la revisión: la guía se solapaba con el mensaje del HUD (ahora un solo panel de dos líneas bajo él), las indicaciones largas se cortaban en la placa del HUD (ahora ≤ 21 caracteres) y el diálogo tapaba las piernas de la figura (ahora más abajo).

**Cambios que tocan lo existente.** E pasa a ser la tecla de interactuar y Z queda como alias (se actualizaron las 4 aserciones de texto `[Z]` → `[E]` en `hotbar.spec.ts` y `v8-survival.spec.ts`); la zona de «descansar» empieza en x ≈ 323 (antes 302) por la repisa; `InteractionSystem` admite `priority` (solo lo usan el cajón y la entrada durante la secuencia).

**Fallos de la suite completa.**
- `lamp.spec.ts` ×3 (V9, ya fallaban antes): `LIGHTING is not defined` dentro de `page.evaluate` y un haz que no vuelve a 1 al reequipar el casco. No dependen de esta secuencia.
- `mining.spec.ts:328` («circuito real») falló una vez en la suite completa y aprueba en solitario y con todo `mining.spec.ts` (14/14): parece intermitente bajo carga; no se encontró causa en los cambios.
- Las pruebas de saldos de tienda (`mining.spec.ts:160` y `:570`, `v8-survival.spec.ts:310`) que fallaban en la revisión del menú aprobaron esta vez.

**Límites.**
- La secuencia solo se activa en partidas nuevas; no hay forma de repetirla desde el menú.
- E se ignora 250 ms tras cerrar un diálogo o el libro (evita doble activación); el HUD y las pruebas lo respetan.
- Phaser a veces entrega dos veces un mismo evento de teclado si dos teclas caen en el mismo fotograma; las pruebas separan las pulsaciones.
- El interior sigue rotulado «PABELLÓN 7» y la zona del HUD dice «PABELLÓN»; los textos de la secuencia lo llaman «cabaña del abuelo».
- Las páginas siguientes del libro no existen (el texto dice que están pegadas): es insinuación, no mecánica.


### Corrección de `lamp.spec.ts` (11 de noviembre de 2026)

Las 3 pruebas V9 de la linterna fallaban por defectos de la propia prueba, no del juego; ahora aprueban (3/3) y el juego no se tocó:
- `LIGHTING`, `BALANCE` y `SPAWN` se usaban dentro de `page.evaluate`, donde no existen: ahora se pasan como argumento.
- Sin casco, el control de acceso saca al minero de la mina (comportamiento V4): la prueba lo devuelve a la galería antes de comprobar que el haz regresa.
- La compra de la batería se hace en la bodega (superficie): la prueba vuelve a la galería antes de reemplazarla, y espera a que la tienda termine de cerrarse (sus teclas no rigen durante esa animación).
- Tras reemplazar la batería, la carga se comprueba como `> 99,9 %` (el haz ya gastó una fracción mínima al volver).

Con esto, la suite completa queda sin fallos conocidos salvo la intermitencia aislada de `mining.spec.ts:328` bajo carga (aprueba en solitario).


## Verificación de la exploración subterránea, fase 1 (11 de noviembre de 2026)

| Comprobación | Resultado |
| --- | --- |
| typecheck / lint | Aprobados para los archivos nuevos; `eslint .` sigue fallando solo por `debug-lamp.tmp.mjs` (script temporal previo) |
| Vitest | **434/434** (`Caves.test.ts`: 31 semillas × cavernas, conexión, aire, minerales, roca dura, cámara secreta y red sin descubrir al inicio, más guardado y mejora de partidas anteriores; `DepthAmbient.test.ts`: franjas de oscuridad) |
| build | Aprobado |
| e2e | **87/88** en 11,0 min; los **8 nuevos de `explore.spec.ts` aprueban**. Otra pasada completa del mismo día dio 88/88 |

**Cobertura de `explore.spec.ts`** (mundo rev. 2 con `?world=2`): la red nace en el fondo de la galería, nada lejos de la boca está descubierto y se entra caminando; una sala honda y una somera con su oscuridad; el cristal violeta tiñe de violeta lo que alumbra, suelta partículas y se excava con la picota de hierro hasta el inventario (aviso «NUEVO MINERAL», XP y descubrimiento); cobre y hierro a la vista; la roca dura no la rompe el hierro (el trabajo ni empieza) y el tungsteno sí; la cámara secreta está sellada, se abre, la página se lee y se guarda tras recargar; una partida anterior (sin `worldRev`) gana las cavernas conservando su pozo; y el rendimiento con cristales en pantalla (> 25 fps). Capturas reales en `docs/screenshots/explore-*.png` y el plano de la red en `explore-map.png`.

**Revisión visual.** Entrada a oscuras con el brillo violeta de un cristal que asoma al fondo; salas con paredes descubiertas y su ambiente; sala honda casi negra con racimos que tiñen la roca; cámara secreta con la página. La luz violeta se ve en bloques cuantizados de 4 px, sin alfa parcial.

**Hallazgo durante la verificación.** Con las cavernas conectadas a la galería (abierta al cielo), `VisibilitySystem.initialize` las daba todas por descubiertas desde el primer fotograma (25 celdas «filtradas» en `v3.spec.ts:101`, y los cristales brillaban sin haber entrado). Corregido: `grid.caveAir` las excluye del descubrimiento inicial; ahora solo se ve la boca. Cubierto por Vitest y por el primer e2e de exploración.

**Prueba de regresión con el mundo rev. 2 en todo el e2e** (cambio temporal, ya revertido): 74/88. Los 14 fallos dependen de coordenadas fijas del mundo original, no del juego: excavar la celda (26, 9) o caminar hasta el muro del fondo de la galería (ahora es la boca de la red), puntos de luz y de sostenimiento en ese extremo, tronadura y rampas ahí, y la secuencia completa de la introducción (que excava en ese punto). Esa pasada se hizo antes de corregir la fuga de descubrimiento y no se repitió. Por eso las pruebas anteriores siguen en la rev. 1 y solo `explore.spec.ts` usa la 2.

**Límites.**
- Las partidas de producción son siempre rev. 2 (también las anteriores al cambio): el extremo de la galería ya no es un muro, y los rieles y soportes ya colocados ahí siguen donde estaban.
- `mining.spec.ts:328` («circuito real») falla de forma intermitente dentro del archivo completo (compra del riel: saldo 30 en vez de 20) y aprueba sola; es una carrera de teclas de la tienda, ya vista antes de esta fase.
- No hay enemigos, biomas nuevos ni más minerales; el cristal se vende a $35 aunque el diario diga «no los vendas» (es solo texto).
- Las corrientes naturales de aire son una regla nueva de `VentilationSystem` (fuente fija en las salas y la cámara); un jugador con ventiladores propios no nota diferencia.
- El rendimiento se midió en Edge de escritorio: la luz de cristales cuesta una caché por cristal descubierto en pantalla y las partículas un Graphics de ≤ 36 rectángulos.

## Auditoría y corrección visual previa a la migración (11 de noviembre de 2026)

La solicitud mencionaba una captura, pero no llegó ninguna imagen adjunta: la auditoría se hizo con capturas reales del renderizador (bodega, bocamina, galería, cerro, campamento, ampliación derecha, caverna y noche, mundos rev. 1 y 2) y con la consola del navegador.

| Error observado | Causa real | Corrección |
| --- | --- | --- |
| Rectángulos verdes con una diagonal en cajas, barriles, antorchas y el minero | Textura `__MISSING` de Phaser. Los registros de consola de sesiones anteriores muestran `ERR_CONNECTION_REFUSED` al pedir `props.png`, `torch.png`, etc. (servidor de desarrollo reiniciado durante la carga); la escena construía el mundo igual. **No** era depuración de colisiones: Arcade tiene `debug: false` | `missingAssets()` en `AssetLoader`; `MiningScene.create` no construye el mundo sin todas las texturas: 3 reintentos con espera creciente y luego un aviso en lienzo, `#game-status` y consola. `update`/R no actúan mientras tanto. Las colisiones no se tocaron |
| Cerro y suelo negros a un bloque de la superficie (corte duro arena → negro) | La luz natural perdía 16/64 por celda de 4 px dentro del sólido: solo la cara expuesta quedaba iluminada | Mapa suave solo para dibujar (`SkyLightMap.soft`, `softStep` 5): ≈ 3 bloques en franjas cuantizadas. Descubrimiento, zonas y caras siguen en el mapa estricto (lo oculto no se revela) |
| Bloques gris azulados sobre la arena en las cimas y laderas | Los afloramientos (`isOutcrop`) son `Block.Rock` y tomaban la macrotextura de la roca del subsuelo | Material visual `outcrop` (arenisca rojiza, paleta del desierto). Bloque, dureza y colisión iguales |
| Pixel art borroso o con columnas desiguales con escala de Windows 125 % / 150 % | Zoom entero en píxeles CSS = 2,5 píxeles físicos por píxel del juego | `systems/IntegerZoom.ts`: múltiplo entero de píxeles físicos. Con DPR 1 no cambia nada |

**Revisado sin encontrar error.** Posiciones y escalas de estructuras en píxeles enteros; atlas del terreno de 8 columnas con todos los frames dentro de la textura (ahora 36 filas con el material nuevo); orden de capas de `config/layers.ts` respetado por bodega, punto de venta, bocamina y pabellón; ningún aviso de frame inexistente en consola; los marcos amarillos en puertas y bocamina son el resaltado de interacción (E), no un error.

**Pruebas nuevas.**
- `tests/render.spec.ts` (3): carga sana en rev. 1 y 2 sin objetos `__MISSING`/`__DEFAULT`, con `drawDebug` apagado y cuerpos físicos presentes, lienzo en múltiplos de 480 y consola sin avisos ni errores; `props.png` que falla una vez → reintento y mina lista; `props.png` que nunca llega → aviso con la clave y sin mundo construido.
- `TerrainAtlas.test.ts`: todo frame (visible, oculto, borde, transición) dentro del atlas en ambas geologías; los afloramientos usan `outcrop`.
- `IntegerZoom.test.ts`: con DPR 1 los zoom de siempre; con DPR 1,25–3 cada píxel del juego mide un entero de píxeles físicos y cabe en la ventana.
- `MiningSystem.test.ts`: la aserción que esperaba roca del subsuelo en el afloramiento (26, 2) ahora espera `outcrop` y comprueba que el bloque sigue siendo `Block.Rock`.

## QA V11 — recolección, construcción y tala (11 de noviembre de 2026)

**Qué se comprobó.** Las ocho pruebas pedidas con entrada real en Edge (`tests/building.spec.ts`, clic izquierdo y derecho, teclas 1–9, D y espacio; solo la posición del minero y las menas de roca son fixture): 1) excavar 10 bloques de tierra con la pala y recuperarlos (la carga minera sigue vacía y la barra muestra ícono y «10»); 2) colocarlos como escalera 1+2+3+4; 3) subirla con D y espacio sin que el cuerpo atraviese un bloque y llegar a la cima (mismo nivel que el cuarto escalón); 4) picar 6 piedras con la picota y levantar un muro; 5) talar un árbol (8 madera, no da más con el clic mantenido, queda tocón); 6) casa de 9 bloques con tierra, piedra y madera; 7) desarmarla entera: vuelven exactamente los materiales, la picota no se desgasta y no hay XP; 8) guardar con G, recargar y verificar construcciones, excavaciones, árbol talado, cantidades y posición. Además: vista previa y rechazo (lejos, sobre el minero, zona protegida), F/L/G y las nueve teclas.

**Pruebas unitarias nuevas** (`Building.test.ts`, 22): materiales y tile de madera, apilado con máximo, colocar/consumir, rechazos, zonas protegidas, objetos instalados, árbol en pie, escalera, casa y desarme sin pérdida, 40 ciclos de colocar y retirar sin generar recursos ni XP, tiempo del bloque colocado, hacha y madera, árboles (golpes exactos, una sola madera, ubicación), guardado (ida y vuelta idempotente, bloque no declarado y mena colocada rechazados, partida anterior sin `build`) y barra de nueve casillas.

**Errores hallados y corregidos.**

| Síntoma | Causa | Corrección |
|---|---|---|
| El minero se veía como un cuadro verde con diagonal tras equipar el hacha | `skin` = `miner-${kind}` buscaba la hoja `miner-axe`, que no existe (textura `__MISSING`) | `skinOf()` en `MinerLook.ts` (el hacha usa la hoja del pico), compartida por escena e inventario; el test comprueba que la textura no sea de reemplazo |
| Al recargar tras guardar de pie sobre el techo de la casa, el minero reaparecía en la entrada (x = 208) | El cuerpo había quedado unos 4 px dentro del techo recién colocado (y = 104 en vez de 100); `freeBody` rechazaba esa posición. Con el minero en reposo en el suelo (y = 148) la restauración siempre funcionó; no se determinó por qué quedó 4 px dentro | `freeSpot`: sube desde la posición guardada hasta el primer lugar libre (hasta tres bloques) |
| Contorno superior ausente en bloques colocados sobre la superficie | `edgeFrame` trataba como «pasto natural» todo lo que está sobre la superficie | Solo la fila `surfaceRow` omite el contorno superior |
| (Preventivo, no observado) el aviso `[E] INTERACTUAR` (x = 12, ≈ 90 px) tocaría la bandeja, que ahora ocupa de x = 96 a 386 | Cálculo de geometría al ensanchar la barra | El aviso de interacción sube a y = 211, sobre la línea de acción |

**Cambios de comportamiento en pruebas existentes (deliberados).** Tierra y piedra ya no van a la carga minera: `Operations.test.ts` y `mining.spec.ts` esperan ahora `mat_dirt`/`mat_stone` (la carga de 4 se comprueba con carbón); las pruebas de la barra rápida (`LoadoutQuickbar`, `V4`, `hotbar.spec`, `v8-hud.spec`) pasan de 5 a 9 casillas con la geometría nueva (HUD: casillas de 28 px desde x = 102; inventario: compactas de 20 px desde x = 162); el guardado manual en las pruebas pasa de F a G.

**Resultados.** `typecheck` y `vitest` (463) pasan. En la primera pasada de la suite e2e completa (94 pruebas) fallaron 6: tres por el cambio de comportamiento (tierra a material) y una por el desplazamiento del HUD (corregidas); otras dos (`mining.spec` «circuito real» y «comprar mejoras») eran intermitentes; la causa se halló después (ver QA V12, «Pulsaciones duplicadas»). `npm run lint` falla solo por un archivo ajeno al proyecto, `debug-lamp.tmp.mjs` (depuración temporal en la raíz, de otra sesión), que no se tocó.

**No verificado.** Rendimiento sostenido al modificar miles de bloques (cada colocación reevalúa estabilidad y ventilación de todo el mundo, como ya hacía cada excavación; no se midió); arte definitivo; el comportamiento con teclado distinto del estándar (las teclas se leen por `KeyboardEvent.code`).

## QA V12 — carga por peso y luz radial del casco (11 de noviembre de 2026)

**Carga por peso.** 50 kg encima y 100 kg en el carro, ≈ 1 kg por bloque (`MATERIAL_KG`). `Weight.test.ts` (5): capacidades, llenado por peso, transferencia al carro, rechazo de mena con 50 kg («CARGA LLENA - 50/50 KG») y límites del guardado. Pruebas existentes ajustadas de 4/20 bloques a 50/100 kg (`Operations`, `V4`, `DeveloperCommands`, `mining.spec`, `v8-hud.spec`).

**Luz radial del casco.** El haz direccional se cambió por un resplandor redondo tipo antorcha en la mano (`LIGHTING.headlamp.radial`). `Lighting.test.ts`: luz plena a ≤ 1 bloque en cualquier dirección, simetría delante/detrás/arriba/abajo, decaimiento continuo, 0 más allá de 6,5 bloques, mismo resultado mirando a izquierda o derecha. `lamp.spec.ts` y las dos pruebas de iluminación de `mining.spec.ts` (galería y zona profunda) esperan ahora luz detrás del minero. Captura: `docs/screenshots/v12-luz-casco.png`. No medí el costo por cuadro del nuevo recorte de oclusión (≈ 54 × 54 celdas de 4 px alrededor del casco, un trazado de rayo por celda); la prueba de rendimiento local existente (`mining.spec`) pasa.

**Errores hallados y corregidos.**

| Síntoma | Causa | Corrección |
|---|---|---|
| «comprar mejoras» (`mining.spec`) fallaba ~75 % de las veces con el saldo equivocado; la fila de la bodega saltaba tres lugares con una sola pulsación | Con el cuadro retrasado la cola de teclado de Phaser se procesa más de una vez en el mismo cuadro y un mismo toque (tecla abajo y arriba dentro del cuadro) emite «down» varias veces. Se vio con un oyente directo: tres «keydown» para un solo evento del navegador | `MiningScene` cuenta cada evento del navegador una sola vez (`WeakSet` de eventos). Sin cambiar la prueba pasa 8/8 |
| La bodega no mostraba la fila «AUXILIO» | Al añadir el hacha, la categoría HERRAMIENTAS quedó con 7 filas y la bodega dibuja 6 | «AUXILIO» pasó a SEGURIDAD |

**Protagonista «azulito».** Sprite 32 × 32 en lugar del minero (reemplazo simple). Cuerpo físico, posiciones de reposo y pruebas de coordenadas intactos; el origen del sprite y el desplazamiento del cuerpo compensan el cuadro mayor. Pruebas ajustadas: la paleta de 49 colores excluye las hojas del protagonista (colores propios), la proporción carro/personaje usa el cuadro de 32 × 32 (el azulito mide 17 × 26), `v4.spec` ya no espera la textura derivada con EPP, la luz detrás del minero y el ajuste de `building.spec` (el cuerpo ya queda centrado, se quitó el recentrado). Captura en el juego: `docs/screenshots/v12-heroe-*.png`. **No verificado:** que el azulito mire hacia donde camina (la hoja se usa tal cual, sin voltear: depende de cómo esté dibujada); procedencia y licencia de las hojas.

**Pruebas intermitentes halladas.** `explore.spec` «cobre y hierro» depende de la semilla aleatoria (en ~la mitad de los mundos no hay cobre o hierro junto a aire con piso): ahora sortea otro mundo borrando el guardado entre intentos (8/8). `lamp.spec` se colgaba ~44 s porque la prueba devolvía el sprite de Phaser desde `page.evaluate` y Playwright intentaba serializar todo su grafo; ahora no se devuelve (igual en `intro.spec` y `v8-survival.spec`).

**Resultado final.** typecheck, lint de `src`/`tests`/`scripts`, 468 pruebas unitarias y las 94 e2e pasan (19,2 min). `npm run lint` sigue fallando solo por `debug-lamp.tmp.mjs`, ajeno al proyecto.

## QA — cabaña minera animada (11 de noviembre de 2026)

**Qué se comprobó** (lista de 12 puntos del pedido): 1) el letrero PABELLÓN desapareció (sin texto sobre la cabaña; el letrero del camino dice «CABAÑAS»); 2) la cabaña sigue la referencia (madera cálida, techo violeta a dos aguas con musgo, frontón con ventanuco, chimenea de ladrillos a la derecha, ventanas encendidas, puerta con bandas metálicas, farol, porche con escalones, silla mecedora, barril, caja con cristales, picota, rocas, flores e hiedra), por piezas y sin imagen única; 3–4) el humo nace de la boca real de la chimenea, sube, deriva a la izquierda (viento de las nubes), crece y se disipa con trama (emisor verificado en navegador: bocanadas en vuelo y bocanada gris violeta visible junto a la chimenea); 5) ventanas con vidrio cálido y dos variantes de interior; 6) farol colgante del gancho con vaivén de 1 px; 7) de día las ventanas se ven discretas y de noche destacan (halo ámbar con titileo cuantizado 0,8–1,0 cada 260 ms, oclusión intacta); capturas `docs/screenshots/v8-camp-day.png` y `v8-camp-night.png` regeneradas; 8) entrar con E/Z verificado en e2e; 9) dormir y avance del reloj intactos (e2e V8 de descanso pasa); 10) colisiones sin cambio de conducta: la cabaña sigue siendo escenografía sin cuerpos, el minero camina delante de la fachada, la zona de interacción coincide con la puerta dibujada (centro en −299) y la entrada real es el interior superpuesto (hacerla sólida bloquearía la puerta); 11) sin bordes blancos ni recortes (todo dibujado por código, alfa 0/255); 12) calidad al escalar: render por código con zoom entero, sin filtros.

**Errores hallados y corregidos durante la verificación visual.**

| Síntoma | Causa | Corrección |
|---|---|---|
| Solo el sombrerete de la chimenea asomaba como barra flotante; el fuste quedaba tapado | El techo se dibujaba después de la chimenea y su falda cubría todo el alto del cuadro | La chimenea pasa a dibujarse tras el techo, con la base metida en la falda (x 104, base −70) y la boca sobre la línea del agua |
| El ventanuco del frontón no se veía | Las tablas del frontón (parte del techo) lo pintaban encima | El ventanuco también va tras el techo |
| Mitad derecha de la ventana trasera cubierta por los cristales de la caja | Ventana demasiado baja (base 20) frente a la caja (base 14) | Ventanas subidas a base 30 (media pared, como la referencia) |

**Cambios de comportamiento en pruebas (deliberados).** `v8-survival.spec` e `intro.spec` esperan ahora «[E] ENTRAR A LA CABAÑA», «[E] SALIR DE LA CABAÑA» y zona «CABAÑA»; `mine-name.spec` sigue contando 7 luces del campamento (farol + 2 ventanas de la cabaña reemplazan al farol y las 2 ventanas del pabellón).

**Resultados.** typecheck, lint y 468 pruebas unitarias pasan. Suite e2e completa: 94/94 (11,7 min), incluidas las 9 de V8 y las 7 de la introducción. `npm run lint` pasó tras mover fuera del proyecto `debug-lamp.tmp.mjs` (depuración temporal de otra sesión, avisado en QA V12) y silenciar dos parámetros sin uso de `MinerLook.ts` heredados de V12 (`void mask`). Sin `git` en PATH: cambios sin commit (último commit verificado `06c1cd9`).

**No verificado.** El humo queda oculto tras el HUD cuando la cámara enfoca la cabaña desde x ≥ −180 (posicionamiento del panel, no del humo; en juego se ve al acercarse); rendimiento del emisor (5 sprites, despreciable) no se midió.

<!-- RESULTADOS-E2E -->

## Verificación de códigos (12 de noviembre de 2026)

Tecla | con `money` y `fly` en toda partida; usar un código desactiva los logros. Ejecutado: `typecheck`, `lint`, `test` (26 archivos, 490 pruebas, incluye `CheatCodes.test.ts`) y `build` sin errores. E2E: `tests/cheat-codes.spec.ts` (dinero infinito, doble espacio sin y con código, subir, quedar suspendido, aterrizar con S, persistencia tras recargar) y las 3 de `tests/developer-console.spec.ts` pasan en Edge. Captura: `docs/screenshots/cheat-fly.png`. Limitación: no se corrió la batería e2e completa, solo esas dos.

## Migración top-down · Fase 1 (12 de noviembre de 2026)

Para abrir el patio de prueba, ejecutar `npm run dev` y añadir `?view=top-down` a la URL. WASD y las flechas mueven al minero. El botón «Volver al juego lateral» abre la entrada habitual.

En la vista lateral, `Miner` aplica velocidad en X y usa gravedad y suelo para el salto y las animaciones aéreas. `MiningScene` colisiona su cuerpo de 10 × 18 con tres capas del terreno y lo sigue con una zona muerta. Varios sistemas interpretan Y como profundidad y `blocked.down` como apoyo. El patio de prueba usa un controlador propio con gravedad desactivada en su cuerpo, velocidad de 90 px/s en ocho rumbos, huella de 10 × 6 y orden de dibujo por los pies. La cámara sigue en ambos ejes dentro del patio de 960 × 640 con el lienzo de 480 × 270.

El sprite temporal es original y se genera en `TopDownMiner.ts` con la paleta del proyecto. Tiene 12 cuadros de 16 × 24, con ancla inferior centrada, un cuadro de reposo y dos pasos por dirección. Revisado en Edge a 1× y 3× con muestreo nearest-neighbor.

La mina, las interacciones, la barra rápida y el guardado siguen disponibles en la vista lateral. El patio de Fase 1 solo prueba movimiento, cámara y colisión. El terreno jugable y sus interacciones quedan pendientes de adaptación a la nueva perspectiva.

El punto de restauración previo es `a18da5d` (`codex/restore-pre-top-down`).

`typecheck`, `lint`, `build` y las 490 pruebas unitarias pasaron. Las tres pruebas top-down pasaron en Edge, incluida la repetición sin trazas. Verifican WASD y flechas, marcha y reposo en las cuatro direcciones, velocidad diagonal, seguimiento y límites de cámara, y colisión y profundidad visual al rodear un muro.

La primera ejecución E2E completa aprobó 65 de 104 casos. Vite dejó de responder y 32 casos de la vista lateral fallaron por conexión rechazada. Con Vite reiniciado pasaron 17 de los 35 casos reintentados, con lo que 82 de los 104 pasaron al menos una vez. Los 22 restantes fueron casos laterales. «Nueva partida entra a la mina» y «mineral desconocido» también fallaron sirviendo el punto de entrada anterior desde el commit de restauración. La verificación completa de regresión lateral sigue pendiente.

## Migración top-down · Fase 2 (12 de noviembre de 2026)

El campamento se abre con `?view=top-down`. El mapa de 60 × 40 tiles usa el mismo controlador de la Fase 1 y el mismo lienzo de 480 × 270. El punto de restauración es `fc61d10` en `codex/restore-pre-top-down-phase-2`.

`TopDownCamp.ts` dibuja el suelo, los caminos, edificios en proyección 3/4 y vegetación con arte original de la paleta compartida. El suelo se genera a 960 × 640 y las estructuras se componen por piezas con orden de dibujo por la base. Las huellas sólidas se limitan a edificios, troncos, piedras y carga apilada. `TopDownScene` aplica el reloj existente al exterior y anima humo, sombras de nubes, aves y luces nocturnas. La hora se lee del guardado al abrir el campamento y se transfiere al abrir la escena lateral.

Z cerca de la cabaña abre su interior existente. La tienda y la bodega abren el comercio del bodeguero, compartiendo catálogo, existencias y precios. El acceso minero deja al personaje un tile antes del portal lateral, en el lado de superficie del control de EPP. El botón «Volver al campamento» guarda por la ruta existente antes de regresar. Los interiores y las galerías siguen en la escena lateral. Los rieles del exterior top-down son decorativos.

Edge headless mostró el campamento diurno a 1× y 3× y la vista nocturna, con 480 px de ancho lógico, cero texturas de reemplazo y cero excepciones de página en esas capturas. La muestra local del campamento quieto contó 721 cuadros del navegador en 5 s a 1×.

`typecheck`, `lint`, `build` y las 490 pruebas unitarias pasaron. La suite E2E completa, con tres trabajadores y trazas desactivadas, aprobó 92 de 108 casos. Hubo 15 fallos en la vista lateral y un fallo intermitente en la comprobación de marcha. La prueba de marcha ahora parte desde un claro y comprueba el desplazamiento y la animación en el mismo cuadro. Pasaron los siete casos del campamento al repetirlos en Edge con un trabajador. La regresión lateral completa sigue pendiente.

## Migración top-down · Fase 3 (12 de noviembre de 2026)

El respaldo previo es `53a295b` en `codex/restore-pre-top-down-phase-3`. En `?view=top-down`, el portal abre con Z la explotación del nivel −1 (36 × 24 tiles). Una expedición nueva pasa por la elección de modo existente. El portal exige EPP completo y la galería usa las picotas que el jugador ya posee. Z junto a la trampilla devuelve al exterior, junto a la bocamina. Clic mantenido inicia el trabajo y F controla la linterna.

La planta fija distingue aire, roca, lecho y vetas de carbón, hierro y cobre. La extracción usa el alcance, los tiempos vigentes de las herramientas (2 s hierro, 3,5 s tungsteno, 2,5 s diamante, con modificadores de progresión), el desgaste, los límites de carga, la energía y la XP existentes. El guardado V6 añade un campo opcional `gallery` versión 1 con nivel, celdas retiradas, mapa descubierto y posición subterránea. La carga, el desgaste y la galería quedan en la misma escritura de la partida. La posición lateral se conserva en su campo original.

El HUD y la barra rápida son los existentes. La vista aplica la oclusión y la composición de oscuridad del juego a un haz direccional. Los bloques encerrados conservan su mena oculta. Inspección visual en Edge headless a 1× y 3× (480 px lógicos, 480 y 1440 CSS). En una muestra quieta de 5 s a 1× el navegador contó 721 cuadros.

La galería cubre extracción con picota y supervivencia básica. Carrito, vías, sostenimiento, derrumbes, ventilación, tronaduras y perforadora siguen disponibles donde estaban implementados en la vista lateral. Luis, la tienda, la cabaña y su descanso siguen usando sus escenas y sistemas existentes. Los niveles profundos y la integración industrial quedan pendientes.

Pasaron `typecheck`, `lint`, `build`, las 493 pruebas unitarias y los nueve casos focalizados de Playwright en Edge con un trabajador. En navegador se verificaron EPP, inventario y barra rápida, bloqueo físico, excavación en cuatro rumbos con progreso, luz y memoria de exploración, tránsito por una celda excavada y persistencia tras volver y recargar. Las unitarias verificaron alcance, oclusión, tiempos de las tres picotas, rechazo con carga llena y ausencia de recolección duplicada. No se repitió la suite E2E lateral completa en esta fase.

## Migración top-down · Fase 4 (12 de noviembre de 2026)

Respaldo previo `fd9eeb4` en `codex/restore-pre-top-down-phase-4`. En el nivel −1, el riel se elige en la barra rápida y se instala con clic derecho. X y clic izquierdo retiran un tramo libre. Z carga, inicia o detiene el empuje, o descarga al llegar a la estación. La carga entregada se vende con Z en el punto «VENTA» frente a la bodega del campamento, con los precios existentes.

Los límites top-down son 4 bloques personales y 20 en el carro. Las cargas anteriores se conservan y pueden transferirse por tandas. El guardado V6 añade los tramos, el carro y la entrega dentro de `gallery`; el carro se recupera detenido en su posición exacta. La validación acepta como máximo un bloque de desnivel y el nivel −1 usa elevación plana.

Inspección visual en Edge headless a 1× y 3× con 480 px lógicos. El navegador contó 721 cuadros en 5 s a 1× con el carro detenido. El catálogo actual de audio carece de un efecto de ruedas.

Pasaron `typecheck`, `lint`, `build`, 498 pruebas unitarias y los diez casos focalizados de Playwright en Edge. Se probó extracción, colocación, curva en ambos sentidos, bloqueo de tramo ocupado, descarga, venta y guardado compatible con Fase 3. La regresión E2E lateral completa queda sin repetir.

## Migración top-down · Fase 5A (12 de noviembre de 2026)

Respaldo `6c58caf` en `codex/restore-pre-top-down-phase-5a`. Clic derecho con una viga equipada instala un marco. X y clic izquierdo lo desmontan, con confirmación mediante Enter si aumentaría el riesgo. El ancho excavado, la roca y los marcos determinan el estado por sectores. El modelo reutiliza los umbrales y la cuenta regresiva del juego lateral. Los escombros se retiran con pala o picota, sin premios, y pueden bloquear temporalmente un riel. R permite volver al campamento si se pierde la ruta de salida.

V6 añade un campo opcional `gallery.stability` con marcos, durabilidad, derrumbes, escombros y tiempo restante. La prueba de navegador acorta el tramo final de una cuenta ya visible para verificar el derrumbe sin esperar todo el intervalo. Las unitarias comprueban la cuenta original y su restauración exacta.

Pasaron `typecheck`, `lint`, `build`, 502 pruebas unitarias y los 11 casos focalizados de Edge. Se verificaron construcción, confirmación de desmontaje, daño con casco, colisión de escombros, reapertura de la vía, conservación de carga y guardado. Revisión visual a 1× y 3×. La muestra local en Edge headless a 1× contó 718 cuadros en 5 s. La regresión E2E lateral completa queda sin repetir.

## Migración top-down · Fase 5B (12 de noviembre de 2026)

Respaldo `4692dde` en `codex/restore-pre-top-down-phase-5b`. La toma y el ventilador fijo alimentan la red del nivel −1. Clic derecho instala equipos de etapa 3 con sus precios vigentes. La orientación del minero define la salida del ventilador. Z alterna el equipo, J inspecciona durante 6,5 s, X y clic retiran equipos y M silencia el audio. Colocar un ducto sobre un tramo dañado lo repara usando una unidad. El guardado V6 añade `gallery.ventilation` con equipos, orientación, estado e integridad.

El indicador 0–100 es un parámetro de juego. La red se calcula cuando cambian equipos o terreno. La muestra local en Edge headless a 1× registró 301 cuadros en 5 s y cero recálculos con la topología quieta. Se inspeccionó el dibujo a 1× y 3×. La progresión hasta etapa 3 sigue usando los requisitos de la expedición existente. El sonido de ventilador es original.

Pasaron typecheck, lint, build y 506 pruebas unitarias. De los 12 casos focalizados en Edge, 11 pasaron en la corrida conjunta. El caso de derrumbe pasó al repetirlo tras ajustar su preparación para instalar el ducto después del desmontaje del soporte. Se verificó la advertencia y el daño a 0%, el cese del daño al volver a la toma, la instalación y el desmontaje, la persistencia y la reapertura tras despejar. No se repitió la suite E2E lateral completa.

## Migración top-down · Fase 6A (12 de noviembre de 2026)

Respaldo `198b215` en `codex/restore-pre-top-down-phase-6a`. Z en el porche abre la cabaña cenital y Z en la puerta devuelve al campamento. La cama usa el descanso existente: restaura energía, conserva salud y consume el hambre correspondiente al tiempo adelantado. El guardado V6 añade `topDownCabin` para restaurar la ubicación. Las pruebas visuales en Edge headless cubrieron 1× y 3×. La muestra a 1× contó 300 cuadros en 5 s.

Pasaron `typecheck`, `lint`, `build`, 506 pruebas unitarias y 13 casos focalizados de Edge. Se verificaron ambas fases de descanso, colisión de la cama, recarga dentro y fuera, primera visita sin partida, comercio y regresiones de minería, transporte, derrumbes y ventilación. La regresión E2E lateral completa queda sin repetir.

## Migración top-down · Fase 6B (12 de noviembre de 2026)

Respaldo `8cca6c5` en `codex/restore-pre-top-down-phase-6b`. El vendedor y el encargado de bodega atienden con Z desde el campamento si hay una expedición activa. Comparten catálogo, precios e inventario de la partida. El cajón de la introducción y la elección inicial de modo conservan su acceso lateral. La estación exterior de venta conserva su interacción.

Luis aparece de forma temporal en una celda accesible y segura. La búsqueda cardinal se limita a 10 pasos al aparecer o regresar y a 3 durante un paseo. Las excavaciones, derrumbes y cambios de estructuras invalidan las rutas afectadas. Luis usa la luz y visibilidad del jugador y entrega consejos a partir del aire, el sostenimiento, la luz, la carga y los minerales visibles. Las apariciones se reconstruyen al entrar a la galería; el formato V6 sigue vigente. El proyecto aún carece de trabajadores contratables y tareas de trabajadores.

Pasaron typecheck, lint, build, 507 pruebas unitarias y los 15 casos focalizados de Edge. Se comprobó compra y kit persistentes, aparición y diálogo de Luis según el aire, bloqueo de ruta por escombros, movimiento, cámara, cabaña, excavación, transporte, sostenimiento y ventilación. Las tres láminas de NPC tienen 16 cuadros cada una. La revisión visual a 1× en Edge encontró cero texturas faltantes y cero excepciones de página; el campamento registró 301 cuadros en 5 segundos. La suite E2E lateral completa queda sin repetir.

## Migración top-down · Fase 7A (12 de noviembre de 2026)

Respaldo `88627b2` en `codex/restore-pre-top-down-phase-7a`. El minero cenital usa 56 cuadros originales de 16 × 24. La marcha alterna brazos y botas, y el reposo conserva la dirección. Picota y pala toman sus poses del progreso de extracción; la herramienta se compone delante o detrás del cuerpo según el rumbo. Los golpes mueven la grieta y el brillo local, y la rotura emite polvo y fragmentos del color de la mena. Se incorporaron gestos de construcción confirmada, fatiga, daño y consumo. La cabaña conserva la secuencia de descanso de la Fase 6A. La perforadora, los barrenos y la colocación de antorchas siguen disponibles en la vista lateral.

Pasaron typecheck, lint, build, 507 pruebas unitarias y los 16 casos cenitales en Edge. También pasaron 9 de los 10 casos laterales focalizados tras repetir los fallos de la primera corrida. La prueba lateral del mineral desconocido completó el evento y falló al consultar el cuerpo del minero inmediatamente después de recargar; registró además el aviso ya documentado del cuadro 14 de `mineral-items`. El caso de barreno y tronadura y el de antorchas laterales pasaron.

Revisión visual en Edge headless a 1× y 3×, con 480 px lógicos, cero texturas de reemplazo y cero excepciones en esa muestra. La galería quieta registró 151 cuadros del navegador en 5 s mientras se ejecutaban otras comprobaciones. La medición corresponde a ese entorno local.

## Optimización visual · 15 de noviembre de 2026

Auditoría, cambios y capturas comparativas: [VISUAL_OPTIMIZATION.md](VISUAL_OPTIMIZATION.md). El campamento cenital ganó detalle de suelo, rodadas y sombras duras; la galería cenital distingue las menas por silueta; el canvas conserva nearest-neighbor.

Ejecutados tras los cambios: `typecheck`, `lint`, `test` (507/507) y `build`, todos aprobados. La suite E2E completa en Edge headless aprobó 115/117 en una corrida de 18,8 minutos. Los dos fallos fueron expectativas de cámara antiguas o demasiado rígidas; se actualizaron las aserciones sin modificar física ni cámara y ambas pasaron al repetirlas de forma aislada. No se repitió toda la suite después de editar esas pruebas. La expectativa unitaria de supervivencia se corrigió para incluir el tiempo de consumo de la fracción de alimento que la propia prueba establece.

Se comprobó el lienzo a 480 × 270 lógicos en ventanas de 400, 960 y 1280 px, y con DPR 1,25: escala física entera, `image-rendering: pixelated` y desplazamiento horizontal bajo 480 px. Las capturas prueban apariencia; las pruebas E2E verifican reglas, colisiones e interacciones. No se midió FPS en esta entrega.

Al cerrar la primera suite aparecieron avisos de cuadros 14 y 15 inexistentes en `mineral-items`. Se corrigió el icono de recolección con un mapa de cuadros reales y los iconos originales para las demás menas. Se repitieron typecheck, lint, 507 unitarias y build (aprobados). En Edge se activó la recolección visual de los diez minerales sin avisos ni excepciones, y pasó el caso E2E del mineral desconocido. La suite completa no se repitió después de este ajuste puntual.

## Entrada de la bocamina sin derrumbes · 15 de noviembre de 2026

La galería original (columnas 18–25, filas 7–9) quedó fuera de la evaluación geotécnica de tramos excavados. Los dos marcos fijos de su entrada ya no se desgastan ni reciben daño por sacudidas. Una prueba unitaria rompe los marcos como en una partida antigua: la entrada no genera cuenta regresiva; al excavar un tramo vecino, ese tramo sí se derrumba y sus escombros quedan fuera de la entrada. Otra carga una partida con una cuenta antigua en la boca y comprueba que se descarte. La prueba en Edge comprueba `TECHO ESTABLE` y la galería original abierta; el caso E2E existente de sostenimiento y derrumbe fuera de ella también pasa.

Ejecutados: `typecheck`, `lint`, `test` (509/509) y `build`, todos aprobados. La suite E2E completa en Edge headless aprobó 116/118 en 18,5 minutos. Fallaron una aserción de ascenso de escalera construida y una expectativa de salud por aire en la galería cenital; ambas pasaron al repetirlas aisladamente. No se cambió código de esas áreas ni se repitió la suite completa después. No se midió FPS en esta entrega.

## NPC más detallados · 15 de noviembre de 2026

El vendedor, el encargado y Luis cenital usan cuadros de 32×32 con siluetas y vestuario diferenciados. Luis lateral y el bodeguero lateral también usan cuadros de 32×32; se conservaron sus secuencias, anclas inferiores y huellas de interacción. El retrato de bodega y el de diálogo de Luis se ajustaron a los nuevos cuadros. Las capturas [1×](screenshots/npc-camp-1x.png), [3×](screenshots/npc-camp-3x.png) y [tienda](screenshots/npc-shop-after.png) a 480×270 lógicos confirmaron que los personajes no se recortan en las ventanillas ni en el HUD. La hoja PNG y las hojas canvas inspeccionadas tienen solo alfa 0/255 y colores de la paleta V6/V7.

Pasaron `typecheck`, `lint`, `test` (509/509) y `build`. Siete pruebas focalizadas de Edge pasaron: texturas, tienda, Luis y escena lateral. En doce pruebas adicionales de movimiento y galería, once pasaron en conjunto; la conexión de la bodega cambió de escena antes de la aserción en una ejecución y pasó al repetirla aisladamente. La suite E2E completa no se repitió tras este cambio exclusivamente visual. No se midió FPS.

## Bodega de almacenamiento · 16 de noviembre de 2026

La bodega abre un cofre desde el campamento cenital y desde la vista lateral. El peso se suma en gramos con los datos de cada objeto y se muestra en kg. Las pilas del cofre tienen un máximo de 999 unidades; las herramientas conservan su desgaste. Los retiros respetan las casillas disponibles, el tope de materiales y la capacidad de carga minera de cada vista.

La primera apertura deja casco, chaleco y botas en el cofre. El guardado V6 conserva el contenido y registra si se preparó el kit; una partida que ya había recibido el kit anterior no lo vuelve a recibir. La tienda ofrece gratis guantes y gafas para completar el EPP requerido. El puesto de venta cenital se trasladó junto a la tienda y el puesto lateral conserva la venta de minerales.

Pasaron `typecheck`, `lint`, las 512 pruebas unitarias y `build`. Las unitarias de bodega verifican el límite exacto de 1.000 kg, el rechazo de excedentes sin mover objetos, el apilado, los límites de retiro, el desgaste y la persistencia. En Edge se comprobó la compra en la tienda, el depósito, el retiro y equipamiento del casco, y la recarga sin duplicados. También pasaron las conexiones del campamento, la venta de la carga entregada, el acceso con EPP y las compras de comida y batería. No se ejecutó la suite E2E completa de todo el juego.

En la selección ampliada de 42 pruebas E2E pasaron 37 en la primera corrida. Los cinco casos restantes pasaron en repeticiones focalizadas. Durante la corrida hubo recargas del servidor de desarrollo y un conflicto entre directorios de trazas. En las pruebas de compras se esperó a que cada pulsación surtiera efecto. El circuito lateral se volvió determinista al fijar una mena de cobre en la celda que se excava para cargar el carro. La selección ampliada no se repitió de principio a fin.

## Minero V13, picota de diamante, sprint y celular · 16 de noviembre de 2026

Cambios: minero dibujado por código con EPP visible por capas y hoja por herramienta; picota de diamante retirada (las partidas antiguas la descartan al cargar; el mineral de diamante y el desconocido exigen picota de tungsteno); sprint con Shift izquierdo (×1,6); celular con la tienda minera (tecla U) cuyo pedido no se cobra ni entrega hasta que existan los drones.

Pasaron `typecheck`, `lint`, las 526 pruebas unitarias (incluidas las de `MinerCompose`, `PhoneCart` y la carga de una partida con picota de diamante equipada) y `build`. En Edge pasaron `phone.spec` (2/2) y `hero.spec` (4/4, con el sprint medido por la velocidad del cuerpo: 1,6 exacto). Las pruebas de tienda que compraban la pala por posición se corrigieron (la fila de la picota de diamante ya no existe).

En la corrida conjunta de minero, minería, V3, construcción, barra rápida, consola, V4 y celular fallaron ocho casos. Dos eran pruebas desactualizadas (fila de la tienda en `v4.spec` y la medida del sprint) y se corrigieron. Los otros seis eran esperas de 5 s tras cargar o recargar la página, cuando la construcción del mundo bloquea la página unos 5 s (medido: 4,9 s), con un `build` y el juego del panel del navegador corriendo a la vez. Repetidos aislados y sin esa carga, pasaron todos. `building.spec` «F enciende y apaga…» es intermitente y pasa aislado. Los cuatro casos de `menu.spec` que entran por «Nueva partida» fallan porque la pantalla de modalidad tarda unos 6,5 s frente a 5 s de espera; un experimento con todas las hojas del minero apuntando a una sola imagen dio el mismo tiempo, así que no lo causan las hojas nuevas. No se corrigió ese tiempo de carga. La suite E2E completa no se repitió de principio a fin después de estos cambios.

## Pedidos por dron · 16 de noviembre de 2026

El celular cobra y la entrega llega por dron a una caja junto a la cabaña. Botiquín, completo, suavecilla y terremoto pasaron a ser suministros reales (`SUPPLIES`/`FOODS`).

Pasaron `typecheck`, `lint`, las 541 pruebas unitarias y `build`. Las unitarias nuevas cubren la cola (`DroneOrders`, 9): espera de 20 s exactos, un dron a la vez, orden de pago, puntos ocupados, recogida parcial, guardar en vuelo sin duplicar y restauración con datos dañados. Cubren también la integración (6): botiquín y comidas nuevas, `receive` con el inventario lleno, guardar y cargar con pedidos y cajas, y partidas sin el dato.

En Edge pasaron `drone.spec` (4/4) y `phone.spec` (2/2):
- Pedido de varios productos por la interfaz, cobro y guardado inmediato. El despegue se midió a 20 s del pago, con el reloj de la página y una tolerancia de 400 ms.
- Animación muestreada: llega alta desde la izquierda con la caja, baja, la suelta, sube y desaparece, y las hélices pasan por al menos tres cuadros.
- Recogida con E; inventario lleno (los productos quedan en la caja y se recogen al liberar casillas); cola de dos pedidos con dos cajas en puntos distintos; cola llena sin cobro.
- Guardar y cargar durante la cuenta regresiva (conserva el cobro y la hora de despegue) y en pleno vuelo: lo guardado es el pedido y no la caja, y al cargar hay una sola entrega.

En la regresión (supervivencia V8, barra rápida, V4, minería, vista cenital y minero) pasaron 33 de 38. Tres casos (`mining.spec` 128 y 331, `v4.spec` 141) esperan 5 s a que el minero toque el suelo tras cargar, sin esperar a «Mina lista». Hoy la carga tardó 7,5–8 s: los PNG llegan antes de 2 s y el resto es la construcción del mundo, con Edge a 46 fps. El dron y el celular cuestan 0,002 ms por cuadro. `top-down-cabin.spec` falló por 20 ms sobre un margen de 500 ms. `v8-survival.spec` (comida de la bodega) leyó la tienda antes de procesar la flecha y pasó al repetirla. No se cambiaron esas pruebas ni el tiempo de carga.

## Retirada del comercio presencial

**16 de noviembre de 2026, America/Santiago.** Typecheck, lint y build aprobados. Vitest aprobó 566 pruebas. El guardado V6 se comprobó con un kit antiguo incompleto, carga descargada en galería y un fallo de escritura durante la venta. En el fallo se conservaron la carga, el saldo y la experiencia.

En Edge 157.0.4341.60 headless, la cámara cubrió el ancho lateral completo con vistas solapadas, de los monolitos a la costa. El minero atravesó caminando la huella de VENTAS y siguió apoyado en el suelo natural. En el campamento cenital se cruzó la huella de la tienda y se depositaron y retiraron objetos, se equipó el casco y se comprobó el almacén tras recargar. También se comprobó la introducción completa con el kit del almacén.

El celular abrió con U, recibió pedidos y vendió carga desde la superficie. Un pedido despegó 20 004 ms después de pagarlo, llegó en vuelo y se recogió con E. Pasaron la comprobación de cola, la recarga durante la espera y el vuelo, y la recogida parcial con inventario lleno. La muestra de rendimiento en la superficie lateral dio 56,2 FPS de media durante 120 cuadros (2,13 s) en este equipo.

**Playwright.** Se completaron las 127 pruebas distintas de Edge headless entre la pasada completa y las repeticiones. La primera pasada con tres trabajadores dio 106/127 en 16,8 min. Se repitieron los fallos con un trabajador tras ajustar aserciones a los nuevos textos y accesos, esperar la carga efectiva de la escena en las pruebas de persistencia y preparar el guardado del refrigerador después de la navegación. Las repeticiones también confirmaron el cruce lateral, la venta del carro, el menú principal y la carga de partidas.

## Pantalla de muerte

**16 de noviembre de 2026, America/Santiago.** Typecheck, lint, build y 566 pruebas Vitest aprobados. En Edge 157.0.4341.60 headless pasaron las 15 pruebas seleccionadas de Playwright. La primera ejecución dio 13/15. Después pasaron los dos casos repetidos con esperas al cambio de modalidad y al final de la apertura del celular. La suite completa de navegador queda fuera de esta verificación.

Se probó daño directo, desnutrición real y aplastamiento por derrumbe. La vista lateral, el campamento, la cabaña y la galería cenitales mostraron la misma pantalla. Se comprobó el bloqueo del mundo, dos reintentos consecutivos, el doble clic sin efecto duplicado, el retorno al menú, la recarga de Hardcore y el archivo único al crear otra mina. Normal conservó la carga del carro, el equipo y el tiempo restante de una mecha encendida.

Se revisaron capturas de 480 × 270 y 1440 × 810. La pantalla abierta dio 60,7 FPS en una muestra local de 60 cuadros durante 0,99 s.

## Corrección de cajas del dron y destino de entrega

**16 de noviembre de 2026, America/Santiago.** La interacción E abría la caja y llamaba inmediatamente a la transferencia de todas sus líneas. Una pila de un suministro que ya estaba en el inventario podía aceptar unidades aun con todas las casillas ocupadas; las demás unidades permanecían en la caja. Esto hacía que la bodega mostrara las unidades transferidas sin que el jugador hubiera elegido retirarlas. El carrito, los pedidos y las cajas no compartían referencias de líneas; se verificó con una prueba de mutación de sus copias. Ahora E solo abre el inventario de la caja y la transferencia ocurre al confirmar la línea y cantidad. La bodega sigue consultando exclusivamente los objetos del personaje.

El pago guarda el punto del personaje en `MiningScene`. El despegue, después de los mismos 20 s reales, busca suelo accesible cerca de ese punto; descarta terreno sólido, cajas ocupadas y las huellas visibles de la cabaña y la bodega. El pedido guarda el destino y la caja guarda el sitio efectivo. Los guardados antiguos sin estas coordenadas siguen usando sus puntos originales.

Pasaron en Edge headless las cinco pruebas de `tests/drone.spec.ts` y tres de `tests/phone.spec.ts` y `tests/top-down-warehouse.spec.ts` en una corrida conjunta (8/8, 4,3 min). Tras añadir la prueba de retirada parcial y recarga, esta pasó aislada (1/1). Los casos cubren inventario lleno, ausencia de objetos pendientes en la bodega, liberación de espacio, retirada de una unidad, entrega en la posición original aunque el minero se aleje, y guardado/carga durante espera, vuelo y caja pendiente. La suite E2E completa del juego no se ejecutó en esta corrección. No se midió FPS.

La verificación final aprobó `npm run typecheck`, `npm run lint`, `npm run test` (571/571) y `npm run build`.

## Música en la pantalla de inicio

**16 de noviembre de 2026, America/Santiago.** `MenuScene` carga en segundo plano «Carta de Descoberta» (`music-menu`, MP3 aportado por el usuario) y la reproduce en bucle a volumen 0,5; al entrar a la partida baja a cero en 600 ms y se detiene al cerrar la escena. En la vista previa (Edge, `?menu=on`) tras un clic el audio quedó desbloqueado, la pista en caché, sonando en bucle y avanzando (≈5 s); al pulsar Enter se abrió `MiningScene`, la pista quedó detenida y el gestor de sonido ya no la conservaba. Sin errores en la consola. No se comprobó a oído.

Aprobados `npm run typecheck`, `npm run lint`, `npm run test` y `npm run build` (el MP3 llega a `dist/assets/audio/`). E2E: `tests/menu.spec.ts` en Edge headless, 18/18 (3,4 min). La suite E2E completa no se ejecutó en este cambio. Autoría y licencia de la canción sin confirmar (ver ASSET_CREDITS.md).

## Introducción del estudio THE MINERS CL

**16 de noviembre de 2026, America/Santiago.** Nueva `StudioIntroScene` antes del menú (texto de apertura, logotipo con golpe de picota, patrocinadores configurables y hoy vacíos, negro con ambiente), entrada continua de `MenuScene` y opción de omitir con Esc, Espacio o clic.

Aprobados `npm run typecheck`, `npm run lint`, `npm run test` (581/581, incluidas 10 nuevas de `SplashTimeline.test.ts`: orden, duraciones, sonidos que se lanzan una sola vez, sin patrocinadores no hay etapa, orden cambiable, visibilidad, zoom monótono y cortina tramada sin parpadeo) y `npm run build`.

E2E en Edge headless, corrida conjunta de `tests/splash.spec.ts`, `tests/menu.spec.ts` y `tests/death.spec.ts`: 24/24 (4,2 min). `splash.spec.ts` cubre:
- la secuencia completa con orden de eventos; el logo visible a 212 × 212 sin deformar; el golpe dentro de los 100 ms desde la primera trama del logo; la música que sube hasta 0,5; el ambiente apagado; `localStorage` idéntico antes y después;
- omitir en apertura (Esc), logotipo (Espacio) y negro final (clic): sin sonidos colgados, sin eventos tras omitir, música sonando y menú utilizable (Configuración abre);
- tres inicios seguidos sin errores de página;
- ventanas de 480 × 270, 800 × 600, 1280 × 720 y 1920 × 1080 con zoom entero y logo cuadrado.

Capturas: `docs/screenshots/splash-studio-logo.png` y `splash-menu.png`.

En la vista previa (Edge, `?menu=on&splash=on`) se revisaron a ojo el texto de apertura, el logo con el zoom en curso, la entrada del menú a mitad de camino y la pantalla «PULSA UNA TECLA O HAZ CLIC», forzando `sound.locked`. En e2e el audio no estaba bloqueado, así que esa pantalla no se cubrió ahí. La sincronización del sonido se midió por la traza de la escena, no a oído. La suite E2E completa no se ejecutó (supera el límite de 10 minutos de la herramienta).

## Música y ambiente de partida

**16 de noviembre de 2026, America/Santiago.** Aprobados `npm run typecheck`, `npm run lint`, `npm run test` (604/604) y `npm run build`. Los siete MP3 se incluyeron en `dist/assets/audio/world/`.

`npm run test:e2e -- tests/world-audio.spec.ts` pasó en Edge headless (1/1, 24 s). Verifica la música inicial, el viento de superficie, las aves en el bosque, el oleaje de costa, el silencio de las aves de noche, el fundido al entrar a la mina y la reproducción al pausar, reanudar y volver al menú. La prueba comprueba estados y ganancias de Web Audio. La mezcla queda pendiente de revisión a oído.

La suite E2E general se detuvo tras cuatro pruebas aprobadas. Las pruebas generales regeneraron capturas de construcción y vuelo.

## Sonidos de acciones

**16 de noviembre de 2026, America/Santiago.** Aprobados typecheck, lint, Vitest (604/604) y build. Se incluyeron los nueve clips en `dist/assets/audio/actions/`.

Edge headless aprobó cuatro pruebas dirigidas. `action-audio.spec.ts` verificó pasos al caminar y correr, efectos distintos al consumir comida y bebida, silencio ante un consumo rechazado y rodadura solo con avance. También pasaron la prueba de ambiente y las de transporte y consumo de la galería cenital. Esta corrida fue selectiva. Las comprobaciones se hicieron por eventos y estados de reproducción, con una revisión a oído pendiente.

## Auditoría técnica y derrumbes con física

**16–17 de noviembre de 2026, America/Santiago.** Punto de restauración previo: `.tools/backups/deepkin-pre-auditoria-20261116.zip` (434 archivos; Git no está instalado en este equipo).

| Comprobación | Antes | Después |
| --- | --- | --- |
| typecheck, lint, build | Aprobados | Aprobados |
| Vitest | 604/604 | 658/658 (54 pruebas nuevas) |
| Playwright completo (Edge headless) | 160: 145 pasan, 13 fallan, 2 omitidas | 165: 153 pasan, 10 fallan, 2 omitidas |

**Fallos e2e anteriores a estos cambios** (fallan igual sobre el código original, repetidos dos veces; no se tocaron): `hotbar.spec.ts:204` (espera 1440 px y el modo inmersivo da 1920), `lamp.spec.ts:124` (no encuentra batería de repuesto), `mining.spec.ts:280` y `:404` (circuito de carga y venta), y las cinco de `splash.spec.ts` (esperan que el viento de la introducción se apague al llegar al menú). Parecen pruebas desactualizadas frente a cambios posteriores del juego; conviene revisarlas una por una.

**Intermitentes** (fallan a veces y pasan al repetirlas, antes y después): `building.spec.ts:520`, `menu-redesign.spec.ts:182`, `menu.spec.ts:176`, `mining.spec.ts:745` y `building.spec.ts:229` (subir la escalera con teclado real; pasó 2 de 2 al repetirla).

**Mediciones** (Edge headless, semilla fija, mismo equipo; banco propio fuera del repositorio):

| Medida | Antes | Después |
| --- | --- | --- |
| Guardar la partida | 2,89 ms | 0,85 ms |
| Luz natural completa (`SkyLightMap.compute`) | 10,5 ms | 7,7 ms |
| Luz tras cambiar un bloque | 18,3 ms | 14,5 ms |
| CPU por cuadro, superficie de día | 4,33 ms | 3,94 ms |
| CPU por cuadro, galería con casco | 5,05 ms | 4,52 ms |
| CPU por cuadro, superficie de noche | 6,61 ms | 6,31 ms |
| Oyentes de pausa tras 3 reinicios de escena | 4 → 7 | 5 → 5 |
| Viento procedural con la escena en pausa | Seguía sonando | Silencio |
| Derrumbe de 91 bloques a la vez | — | Mediana 7,6 ms por cuadro, p95 14,8 ms |

**Derrumbes, en navegador real (`collapse.spec.ts`, 5/5):** advertencia medida con reloj real entre 9,7 y 10,9 s; el bloque seguido se afloja y luego avanza cada cuadro con velocidad creciente, sin saltos de un bloque; diez escombros con colisión bajo un techo que subió un bloque; el escombro se retira con pala y rinde una unidad; soporte de acero a los 4 s cancela el derrumbe y retirarlo abre otra advertencia de 10 s; un bloque a ~190 px/s deja al minero con 35–60 de salud, sin enterrarlo; guardar con bloques en el aire y recargar los deja asentados.

**Limitaciones.** Los sonidos y la sensación del derrumbe no se revisaron a oído ni jugando a mano: solo por estado y capturas. La galería cenital de desarrollo recibió la advertencia de 10 s pero no la caída física. El costo de luz al cambiar un bloque (14,5 ms) sigue siendo el mayor tirón pendiente; se propone recalcular solo la zona afectada.

## Configuración de skills de Codex — 17 de noviembre de 2026

Instaladas ocho skills de gamedev mediante el instalador oficial con destino Codex y alcance de proyecto. `skills list -a codex` y el método `skills/list` del ejecutable Codex, con recarga forzada, detectan las 24 skills locales habilitadas y sin errores. Perfil de rutas en `docs/SKILLS_ROUTING.md`; procedencia y revisión de seguridad en `docs/SKILLS.md`.

Comparados hashes de código, recursos, scripts del juego, package.json, package-lock.json y todas las skills previas contra una instantánea anterior a la instalación: sin modificaciones. También se comparó el contenido instalado con el commit revisado del proveedor. No se ejecutaron typecheck, lint, test, build ni test:e2e porque este cambio solo configura instrucciones y documentación; no se afirma una nueva validación funcional del juego. La revisión estática del instalador no equivale a una auditoría completa de sus dependencias transitivas.

## Mina sólida para partidas nuevas — 17 de noviembre de 2026

**Punto de restauración previo:** `.tools/restore-solid-mine-2026-11-17.tar.gz` (22.869.134 bytes, SHA-256 `413D37D460A441F8D487210D6CFC7B77572FC8F85E6A9532796F5EA783006AA9`), fuera del contenido editado e ignorado por Git. Contiene el árbol de trabajo, incluido el trabajo sin commit, y excluye `.git`, dependencias, builds y temporales. Se puede extraer sobre una copia limpia del proyecto; los archivos existentes no se deben borrar antes de comparar. La instantánea se creó antes de modificar código.

**Pruebas de la revisión 3:** `src/game/world/SolidMine.test.ts`, cuatro semillas (1, 42, 20261109, 987654321): todas las celdas subterráneas son sólidas salvo las 18 de la entrada; conserva los minerales de la revisión 2, no deja aire de cavernas ni corrientes, y el terreno intacto no inicia advertencias de derrumbe. Una excavación real con `GameSession.mine` desde la entrada entrega recursos, aumenta estadísticas, descubre la celda y persiste tras recargar. Se verificó también en Edge con `tests/solid-mine.spec.ts`; capturas en `docs/screenshots/solid-mine-entrance.png` y `docs/screenshots/solid-mine-first-gallery.png`.

**Compatibilidad:** `Caves.test.ts` y `SaveFormat.test.ts` mantienen las revisiones 1 y 2 y sus guardados. Las partidas sin `worldRev` se cargan con rev. 2 en el juego, como antes; el nuevo terreno requiere rev. 3 explícita en el guardado.

**Comprobaciones:** typecheck, lint y build pasan. La suite Vitest completa ejecutó 670 pruebas: 669 pasaron y falló una prueba sintética de luz natural (`SkyLightReference.test.ts`, «túneles ciegos de cada largo»). Construye `TerrainGrid` directamente y no usa la nueva generación; la discrepancia afecta `face` en el índice 5504 y es independiente de la revisión 3. `test:e2e` se ejecutó con 166 pruebas programadas: las primeras 12 pasaron (incluidos construcción y los cinco casos de derrumbes); se detuvo manualmente por duración. Una ejecución anterior se invalidó por recarga de Vite mientras se editaban archivos y no se cuenta como falla del juego. La prueba nueva de Edge, ejecutada por separado, pasó. No se afirma que ambas suites completas pasen.

**Seguimiento de la mina sólida:** pasaron `typecheck`, `lint`, `build`, las 17 pruebas de terreno, galería y formato de guardado seleccionadas, y `tests/solid-mine.spec.ts` en Edge con 60 s de límite. Esta prueba arranca con la revisión por defecto, sin forzar `world=3`. En Vitest completo se reprodujo la discrepancia previa de luz natural y el resto de fallas observadas fueron de tiempo o rendimiento. La ejecución general de Playwright se detuvo por un error de archivos de traza al coincidir con otra ejecución; el caso focalizado pasó con su propio directorio de resultados.

**Entrada de 10 × 3, revisión 4 (17 de noviembre de 2026):** cuatro semillas verificadas en `SolidMine.test.ts`: exactamente 30 celdas abiertas (columnas 18..27, filas 7..9), sin otras cavidades subterráneas, con minerales conservados y sin derrumbes espontáneos. La revisión 3 guardada conserva sus seis columnas originales. `typecheck`, `lint` y `build` pasaron. Pasaron 245 pruebas focalizadas de terreno, cavernas, galería y formato de guardado. `tests/solid-mine.spec.ts` pasó en Edge y verificó la revisión por defecto, la pared excavable de la columna 28, el guardado y la carga; actualizó `docs/screenshots/solid-mine-entrance.png` y `docs/screenshots/solid-mine-first-gallery.png`. Vitest completo ejecutó 672 casos: 671 pasaron y falló el mismo caso previo de `SkyLightReference.test.ts` (diferencia `face: 5504`). La ejecución general de Playwright se detuvo tras tres casos aprobados por su duración; no se afirma que la suite completa haya pasado.

**Pared rocosa de la entrada (17 de noviembre de 2026):** se reemplazó el dibujo rectangular del fondo por caras de roca angulosas y fracturas discontinuas. La revisión 4 dibuja el fondo hasta el final de sus diez bloques; las anteriores conservan la longitud visual de ocho bloques. Se revisó la captura de `tests/solid-mine.spec.ts` en Edge, incluida la iluminación de las antorchas. El cambio es gráfico y no modifica la cuadrícula ni las reglas de iluminación.

## Pasos por superficie y salto — 17 de noviembre de 2026

Se sustituyó la reproducción de una sola toma de pasos por tres variantes para tierra, grava, piedra, metal, madera y vegetación, con cadencia ligada al desplazamiento. La vista lateral detecta vías y terreno bajo los pies; campamento, cabaña y galería cenital usan sus superficies respectivas. El salto lateral reproduce una exclamación breve. Pasos y salto dentro de la mina reciben reflexiones cortas por Web Audio. Las fuentes y licencias están en `docs/ASSET_CREDITS.md`.

**Comprobaciones ejecutadas:** `typecheck`, `lint` y `build` pasaron. `tests/action-audio.spec.ts` pasó en Edge: pasos de tierra al caminar y correr, metal sobre vías dentro de la mina, bus de eco presente y sonido de salto; comida, bebida y carro conservaron su reproducción. Vitest completo ejecutó 672 casos: 671 pasaron y volvió a fallar el caso previo de `SkyLightReference.test.ts` (`face: 5504`), ajeno a estos cambios. Playwright completo se inició con 166 casos y se detuvo tras varios casos lentos de construcción y derrumbes; no hay resultado global para esa corrida. No se hizo una escucha humana de la mezcla, por lo que la apreciación subjetiva de realismo y volumen queda pendiente.

**Cadencia ajustada:** los pasos se separaron a 44 px al caminar y 52 px al correr; `tests/action-audio.spec.ts` volvió a pasar en Edge. `typecheck`, `lint` y `build` pasaron; Vitest mantuvo la misma discrepancia previa de luz natural (671/672).

## Roca excavable continua — 17 de noviembre de 2026

Se eliminaron los contornos repetidos de las macrotexturas de roca y los marcos rectangulares de la galería cenital. La roca alterada, competente, fracturada, profunda y de montaña se pinta en masas grandes con fisuras parciales. El atlas se inspeccionó a 4× en `docs/screenshots/natural-rock-atlas.png` y no muestra juntas por cada bloque; la captura de la entrada se revisó en Edge. `tests/solid-mine.spec.ts` pasó y verificó que la pared siga siendo excavable, con guardado y carga. `tests/gallery.spec.ts` pasó en el caso de excavación en cuatro rumbos y conservación del progreso. La iluminación oscura de la mina limita la inspección visual de los estratos profundos en esa captura.

**Validación final de audio y roca:** typecheck, lint y build pasaron. Las dos pruebas de Edge `action-audio.spec.ts` y `solid-mine.spec.ts` pasaron juntas. Vitest volvió a ejecutar 672 casos: 671 pasaron y falló la discrepancia previa de luz natural `SkyLightReference.test.ts` (`face: 5504`).

**Corrección de la pared visible al excavar (17 de noviembre de 2026):** la captura del usuario mostró hiladas rectangulares detrás del minero. La causa estaba en `MineEntrance.rockWall`: los centros de sus piedras seguían una malla de filas escalonadas. Se sustituyó por bandas rocosas irregulares sin unidades repetidas; las fracturas discontinuas y la luz existente permanecen. `tests/solid-mine.spec.ts` pasó en Edge tras el cambio y actualizó `docs/screenshots/solid-mine-first-gallery.png`. No se cambiaron celdas de terreno, colisiones ni guardados.

## Combate con gnomo minero — 17 de noviembre de 2026

Se agregó el ataque J con la herramienta equipada y un gnomo minero invocable con el código `gnomo`. Su salud y daño son independientes del terreno y no añaden campos al guardado. `tests/gnome-combat.spec.ts` verificó en Edge la invocación, desactivación de logros, daño al minero y derrota con el hacha. Captura en `docs/screenshots/gnome-combat.png`. Pruebas puras de fuerza de herramientas y alcance en `Combat.test.ts`.

Typecheck, lint y build pasaron. Vitest ejecutó 675 casos: 674 pasaron y falló el caso previo de `SkyLightReference.test.ts` (`face: 5504`), sin relación con el combate. La prueba dirigida de Edge pasó; no se completó una nueva ejecución de toda la suite de navegador.

Tras verificar que el gnomo tampoco golpee a través de roca, pasaron juntas en Edge `gnome-combat.spec.ts` y `cheat-codes.spec.ts` (2/2).

## Golpe del minero (18 de noviembre de 2026)

Se agregaron la animación de golpe con J, chispas, sonido y temblor al conectar, el destello y el empuje al recibir daño y la pulsación guardada de J. No cambian el daño, el alcance ni la cadencia, y no hay pausa de impacto.

**Comprobaciones ejecutadas:** typecheck, lint y build pasaron. Vitest ejecutó 707 casos: 706 pasaron y falló el caso previo de `SkyLightReference.test.ts` (`face: 5504`), sin relación con el combate. `Combat.test.ts` suma pruebas de `AttackTimer` (cadencia, pulsación guardada y reinicio) y de `knockbackVelocity`. En Edge pasaron juntas `gnome-combat.spec.ts` y `cheat-codes.spec.ts` (2/2).

**Prueba manual en el servidor de desarrollo** (panel del navegador oculto, por lo que no hay captura; el estado se leyó del juego):

- Golpe al aire: cuadros 16–21 durante ~300 ms; el gnomo conserva 90 de salud y la cámara no tiembla.
- Golpe que conecta sin herramienta: el gnomo baja de 90 a 83 y la cámara tiembla.
- Golpe del gnomo: −12 de salud, tinte FILL crema durante el destello, empuje de −150 px/s que se apaga en ~200 ms (separa al minero 18 px) y regreso al tinte multiplicativo original.
- Pulsación guardada: una J hecha a los 300 ms se ejecutó a los 400 ms, apenas terminó la espera de 360 ms (a ~20 FPS).

**Sin comprobar:** la batería e2e completa (~35 min) y el aspecto visual con el panel visible.

**Guardia del gnomo (18 de noviembre de 2026):** se confirmó que golpes cada 360 ms dejaban al gnomo en HURT (400 ms) sin poder responder. Una prueba en `GnomeBrain.test.ts` simuló 6 s de golpes seguidos: 0 ataques del gnomo con el código anterior. Con `GNOME_AI.poise` (2 aturdimientos en 1,2 s dan 1,2 s de guardia) la misma prueba exige al menos 2 ataques y al menos 4 aturdimientos, y pasa. Otras pruebas nuevas: un golpe suelto lo sigue interrumpiendo, con guardia el daño no corta su ataque, la guardia no impide enfurecerse ni morir, y se apaga a tiempo. Lint y build pasaron. Vitest: 709 de 710 (solo falla el caso previo de `SkyLightReference.test.ts`). Edge: `gnome-combat.spec.ts` y `cheat-codes.spec.ts`, 2/2. La medición en tiempo real en el panel del navegador no fue posible: con la pestaña oculta el juego casi no avanza.

## Desierto de Antofagasta, luz más nítida, sombra y chinchillas (18 de noviembre de 2026)

Solo desierto (siete zonas con columnas, relieve y geología de V9), fondos por código con La Portada, cuatro monumentos, luz local en celdas de 2 px, luz que usa el suelo real del oeste, sombra de contacto del minero, bordes de sombra de 2 px y doce chinchillas. Respaldo previo en `.tools/backups/deepkin-antes-desierto-antofagasta-20261118-1129.zip`.

**Comprobaciones ejecutadas:**

- Typecheck, lint y build pasaron.
- Vitest: 723 de 725. Fallan el caso previo de `SkyLightReference.test.ts` (`face: 5504`) y «excavar, rellenar y construir» (también en `SkyLightReference.test.ts`), que supera los 5 s de límite solo cuando corre la suite completa; sola pasa tres veces seguidas.
- Pruebas nuevas: `Biomes.test.ts` (solo desierto, mismas columnas que V9, ids de V9 mapeados, sin fondos de terceros, un solo cruce de fondo, monumentos dentro de su zona y sobre suelo parejo, suelo real del oeste), `GroundShadow.test.ts` (5) y `CritterBrain.test.ts` (6).
- Edge: pasaron las 7 pruebas de `v9-biomes.spec.ts` actualizadas (incluida la nueva de chinchillas y sombra) y `gnome-combat.spec.ts`. `exposure.spec.ts` pasó 4 de 4 al repetirla. `lamp.spec.ts:88` pasó en su repetición.

**Fallos de navegador que no son regresiones:**

- `lamp.spec.ts:124` (batería): ya estaba en la lista de fallos previos.
- Arranque y recarga: `v7-desert.spec.ts:146`, `v9-biomes.spec.ts:343` y a veces la primera prueba de un archivo esperan «Mina lista» solo 5 s después de cargar. En este equipo el juego tarda 12–13 s sin partida y unos 10 s al recargar. La misma prueba sobre una copia del respaldo previo dio 12,1 s y 9,8 s (ahora 13,3 s y 9,8 s), y `v7-desert.spec.ts:146` falla igual en esa copia.

**Mediciones:**

- `LightingSystem.update` con el casco encendido, a la entrada de la galería: 4,1 ms (4 px) → 7,0 ms (2 px, sin optimizar) → 4,9 ms (ambiente por bloque de 4 px, oclusión compartida, tabla de caída). En una galería profunda, con los bordes finos: 4,0 ms de mediana y 4,2 ms en el percentil 90.
- Crear la escena: 242 ms sin generar texturas; las cordilleras y el mar suman 485 ms. La Portada, los monumentos y la chinchilla no suman un tiempo medible: los tonos se calculan una vez y no en cada uno de los 18 cuadros de la hora.
- Suelo real del oeste: en 22 columnas, la cuadrícula principal daba suelo en la fila 10 donde hay aire (franja de luz flotante), y en 12 ignoraba el suelo real de la fila 9.

**Prueba visual en el panel del navegador:** Mano del Desierto, salitrera, locomotora del FCAB, Ruinas de Huanchaca, La Portada en la costa, el cruce de los cerros al mar, la luz del casco de noche junto a un escalón del oeste, la sombra bajo los pies y una chinchilla que huye escalón por escalón y se calma a 160 px.

**Sin comprobar:** la batería e2e completa (~35 min).

## Transiciones entre zonas (18 de noviembre de 2026)

El cruce de Cerros de la Costa a La Portada sustituye el tramado del fondo por cuatro laderas que descienden hacia el mar. Cada ladera empalma con la cordillera de su plano de parallax. La revisión visual en Edge cubrió las zonas de día y de noche y el [cruce hacia La Portada](screenshots/v9-cross-hills-portada.png) a 2×.

Typecheck, lint y build pasaron. En Vitest pasaron las 28 pruebas de biomas e introducción. La batería completa registró 721 de 723 pruebas aprobadas, con los dos fallos de luz natural documentados arriba (`face: 5504` y el límite de 5 s de «excavar, rellenar y construir»).

Edge en modo headless aprobó las 8 pruebas de `v9-biomes.spec.ts` en 3,2 min. El recorrido comprobó la continuidad de la cámara al cruzar de Desierto a Pampa y de Cerros a La Portada en ambos sentidos. Registró 494 intervalos de `requestAnimationFrame` durante 5,0 s de muestras, con mediana de 10,1 ms. Se verificaron los seis cruces y la coincidencia de cada empalme en cinco cuadros de iluminación. La validación de navegador se limitó a esa suite.

### Relieve continuo en las siete zonas

Se revisaron las seis transiciones a 1× y la costa a 3×. La prueba de Edge comprobó la continuidad de las texturas en tres cuadros de iluminación. El paisaje conserva crestas y laderas al cambiar de región, y mezcla los estratos claros de la Pampa con los relieves vecinos. [Captura del cruce a La Portada](screenshots/v9-cross-hills-portada.png)

Typecheck, lint y build pasaron. En Vitest pasaron las tres pruebas nuevas del paisaje y 724 de 726 pruebas en total. Los dos fallos corresponden a la referencia de luz natural ya documentada. En Edge headless pasaron las 8 pruebas de `v9-biomes.spec.ts` en 3,5 min. Durante los recorridos por la Pampa y la costa se muestrearon 399 intervalos de cámara en 5,0 s, con mediana de 12,3 ms entre callbacks. La comprobación de navegador se limitó a esa suite.

### Línea de costa de noche

La captura del usuario mostraba huecos bajo las laderas, producidos por el ascenso del borde inferior. La cresta ahora desciende hacia una base que conserva el relleno de roca. El horizonte se dibuja detrás de las laderas a lo ancho de la vista. En Edge se inspeccionó el cruce de noche a 1× y 3×. La prueba comprueba el alfa de las columnas visibles y la cobertura horizontal del mar. [Captura nocturna del cruce](screenshots/v9-cross-hills-portada-night.png)

Typecheck, lint y build pasaron. Vitest registró 724 de 726 pruebas aprobadas, con los dos fallos previos de luz natural. Pasaron las tres pruebas de Edge headless seleccionadas para el cambio, que cubren las uniones de las texturas, el parallax y los recorridos por la Pampa y la costa en ambos sentidos. En esos recorridos se muestrearon 399 intervalos en 5,3 s, con mediana de 13,0 ms entre callbacks.

### Flora del norte de Chile

Se inspeccionaron los sprites dentro del juego a 1× y 3× y la vista cenital a 2×. La prueba de Edge verificó los cuadros del atlas, el alfa binario y el uso de cinco o seis colores en las muestras de algarrobo, copao, cojín atacameño y nolana. Las dos variantes del algarrobo usan ocres y grises cálidos. [Interior](screenshots/flora-atacama-interior.png) · [Cerros costeros](screenshots/flora-atacama-costa.png)

Typecheck, lint y build pasaron. Vitest registró 724 de 726 pruebas aprobadas, con los dos fallos anteriores de luz natural. En Edge headless pasaron seis casos del conjunto de biomas, campamento cenital y tala con guardado. Después del ajuste final de color pasaron los tres casos seleccionados de arte, campamento y cámara. La caminata por la Pampa y la costa registró 418 intervalos de `requestAnimationFrame` en 4,8 s, con mediana de 11,3 ms. La comprobación de navegador se limitó a esos casos.


## Mundo abierto: mapa más largo, excavar y construir en cualquier lado (18 de noviembre de 2026)

El mundo pasa a 1 232 columnas (−760..471) y una sola `TerrainGrid` con columnas negativas cubre todo: se excava y se construye en el campamento, la Mano del Desierto y las cuatro zonas nuevas del oeste. Respaldo previo en `.tools/backups/deepkin-antes-mundo-abierto-20261118-1841.zip`.

- **Estático.** Typecheck, lint y build pasaron.
- **Vitest.** 726 de 728. Los dos fallos son los de luz natural ya documentados (`face: 5504`, que falla igual en el respaldo, y el límite de 5 s de «excavar, rellenar y construir», que pasa solo). Nuevas: una sola cuadrícula, excavación en el oeste, bordes de lecho, yacimientos del oeste, este idéntico, luz natural idéntica en todo el mundo. Las huellas de `SaveFormat.test.ts` cambiaron a propósito (campo `left`); cargar y volver a guardar reproduce el guardado.
- **Nueva prueba en Edge.** `tests/open-world.spec.ts` pasó: excavación con el ratón en el campamento (−25), la Mano del Desierto (−70) y el Salar de Atacama (−720), construcción con clic derecho en el salar, región nueva registrada, cordilleras del oeste a la vista y guardar y recargar con todo en su lugar. [Campamento](screenshots/open-world-camp-dig.png) · [Salar](screenshots/open-world-west-build.png)
- **Rendimiento.** Excavar cuesta lo mismo que antes (efecto de terreno 4,9 ms frente a 4,7 ms, tras sembrar la ventilación solo en el cielo que toca aire bajo la superficie y descartar sin llamadas en la estabilidad). Cuadros en una galería profunda: mediana 13,9 ms en ambas versiones. El fondo de cordilleras del oeste nuevo se dibuja a demanda (un tramo por cuadro, a dos vistas de entrar); el arranque en caliente quedó ≈ 0,5 s sobre el anterior (≈ 11,6–12,4 s frente a 11,2–11,5 s en el perfil). La primera carga en frío del servidor de desarrollo varía mucho (14–18 s) y salió más lenta en las mediciones.
- **Batería e2e completa (Edge, 1,1 h, con perfiles corriendo en paralelo).** 136 aprobadas, 32 fallidas, 2 omitidas. Se volvieron a correr en el respaldo los archivos con fallos nuevos: fallan igual `collapse:292`, `developer-console` (2), `hotbar:53`, `intro:210`, `lamp:173`, todo `mining.spec.ts` salvo dos (apunta a la columna 26, que desde la entrada de 10 × 3 es aire), `v3:158` y `world-audio:14`; `gnome-combat:29` es intermitente en ambas versiones. Además de las conocidas (`hotbar:204`, `lamp:124`, `splash` ×5, `menu:176`, `menu-redesign:182`, `building:229`, `v7-desert:146`).
- **Pruebas corregidas.** `v4:306` (Hardcore) mantenía D pulsada en la pantalla de muerte: si su animación ya había terminado, D enfocaba «MENÚ PRINCIPAL» y Enter iba al menú (también en el respaldo al reproducirlo); ahora usa A y tiene 60 s (dos cargas completas; ya tardaba 26–28 s de 30). `v3:371` (ventilación) tomaba la captura entre la lectura de la vida y la tecla R, con un margen de 1 punto; la captura va antes. Ambas pasaron 2 de 2 (la de ventilación falló una vez más solo por la espera de 5 s del arranque en frío). `collapse`, `mining`, `v3:123`, `v9-biomes:411` y `solid-mine` leen los tiles con la columna del mundo (`TerrainView.tileAt`) y los índices con `grid.index`.
- **No verificado.** No se repitió la batería e2e completa después del fondo a demanda y de las correcciones de prueba; solo los archivos afectados. Varias pruebas siguen esperando 5 s a «Mina lista» y son sensibles al arranque.
## Código `desbloquear` (18 de noviembre de 2026)

Pasa a la etapa 3 sin experiencia ni logros, desactiva los logros como los demás códigos y no hace nada si ya estaban todas. Typecheck, lint y build pasaron; Vitest 728 de 730 (los dos fallos de luz natural ya documentados), con dos pruebas nuevas en `CheatCodes.test.ts`. En Edge pasó la prueba nueva de `tests/cheat-codes.spec.ts` (consola real, aviso del HUD, recarga). [Captura](screenshots/cheat-desbloquear.png). En esa corrida la prueba de `money` y `fly` falló solo en la espera de 5 s a «Mina lista» tras recargar (arranque lento ya registrado), después de pasar sus comprobaciones de códigos.
## Bocamina lateral y galería cenital (22 de noviembre de 2026)

- TypeScript, ESLint y la compilación de producción pasaron con las dependencias locales.
- Vitest aprobó 732 de 734 pruebas, incluidas las cuatro variantes de conectividad y restauración de la planta nueva. Siguen los dos fallos anteriores de `SkyLightReference.test.ts` sobre la luz natural lateral.
- Edge aprobó 12 casos de galería, muerte y cruce entre modos. Al ampliar el halo se detectó que la iluminación llegaba demasiado lejos con el casco apagado. Tras corregir su radio, se repitieron y pasaron los dos recorridos afectados, tanto el cenital anterior como el de la bocamina. La verificación de navegador se concentró en esos tres archivos de pruebas.
- El recorrido nuevo comprueba el límite físico de la entrada y su aviso, E para cruzar, orientación y colisión contra la pared norte, luz sobre el bloque seleccionado, extracción de carbón con Espacio, inventario con Tab, recarga dentro y dos ciclos adicionales. Compara carga, XP, desgaste, vida, dinero y excavación guardada. [Entrada](screenshots/mine-modes-entrance.png) y [galería](screenshots/mine-modes-gallery.png).

Archivos de la implementación

- Registro, menú y escenas en `src/main.ts`, `src/game/scenes/MenuScene.ts`, `src/game/scenes/MiningScene.ts` y `src/game/scenes/GalleryScene.ts`.
- Transiciones y estado en `src/game/systems/MineModes.ts` y `src/game/systems/GameSession.ts`.
- Movimiento, planta, luz y bocamina en `src/game/entities/TopDownMiner.ts`, `src/game/world/TopDownGallery.ts`, `src/game/world/TopDownGalleryView.ts` y `src/game/world/structures/MineEntrance.ts`.
- Pruebas en `src/game/world/TopDownGallery.test.ts` y `tests/mine-modes.spec.ts`. Controles y diseño en `README.md` y `docs/GAME_DESIGN.md`. Resultados y capturas en este informe.

## Logotipo animado del menú (23 de noviembre de 2026)

- Pasaron `npm run typecheck`, `npm run lint` y `npm run build`. Vitest aprobó 733 de 734 casos. Sigue la discrepancia de luz natural ya registrada en `SkyLightReference.test.ts` (`face: 5504`).
- Edge headless aprobó 17 casos seleccionados de `menu.spec.ts` y `menu-redesign.spec.ts`. Verificó el título completo, el subtítulo, el destello, el modo de movimiento reducido, los cuatro botones y la carga de partidas. Se revisaron capturas del lienzo a 2× y 3× y el menú abierto en el navegador integrado. La verificación se concentró en el menú.
- En una corrida anterior de esta tarea reaparecieron cuatro fallos de `splash.spec.ts` por el recuento del sonido de ambiente al omitir la introducción, ya documentados en el historial. La prueba de escala del logotipo del estudio pasó.

## Portal de niebla y Las Profundidades Olvidadas (23 de noviembre de 2026)

La bocamina lateral ya no contiene el cuerpo físico invisible que detenía al minero ni deriva al flujo cenital. El extremo del túnel muestra una niebla en capas opacas, con motas violetas y cian, y el aviso `[E] ATRAVESAR LA NIEBLA`. La secuencia bloquea temporalmente entrada y física, desplaza la cámara, concentra motas sobre el minero y usa un fundido tramado antes de abrir una escena lateral independiente.

`ExpeditionScene` carga el Mundo 1, **Las Profundidades Olvidadas**: cámara segura, dos cavidades a distinta altura, roca, carbón, cobre, hierro, oro y cristal violeta. Comparte minero, controles, herramientas, EPP, inventario y capacidad de carga con la partida. Sus bloques retirados se guardan como diferencias de `ExpeditionState`, separadas de la geología de superficie; el portal inicial permite volver y conserva la carga. La corta galería de transición no permite picar ni extraer.

**Comprobaciones ejecutadas:**

- `npm run typecheck`, `npm run lint` y `npm run build` pasaron.
- `src/game/systems/Expeditions.test.ts`: 3/3. Fija semilla y spawn seguro, persistencia de excavación y validación del guardado.
- Edge: `tests/expedition.spec.ts` pasó dos veces (1/1; 20,9 s y 9,9 s tras el ajuste final de niebla). Recorrió portal de ida, entrada lateral, extracción de carbón y regreso; comprobó que la carga se conserva y la expedición queda inactiva al volver.
- Vitest completo: 736/737. Persiste el fallo previo ajeno en `SkyLightReference.test.ts` (`face: 5504` frente a `-1`).
- La batería E2E completa se inició y alcanzó 8 casos aprobados (audio, construcción, códigos y derrumbes), pero se interrumpió antes de terminar por su duración histórica de decenas de minutos. No se presenta como resultado global.
- Revisión visual manual en el navegador integrado: la mina y el mundo principal permanecen en perspectiva lateral, con escalado entero y sin arte suavizado. La transición concreta se verificó en la prueba Edge dedicada.

## Fondo de portal y promesa del menú (23 de noviembre de 2026)

Se sustituyó la ilustración activa del menú por una bocamina de madera y roca con rieles que entran a una barrera de niebla violeta/cian. La izquierda queda despejada para el logotipo, subtítulo, botones y la placa contextual. La capa ambiental se simplificó: conserva faroles, cristales, tres densidades de portal y motas; retira nubes, humo y vegetación del antiguo paisaje para no recargar la nueva composición. Un pequeño medallón de cobre con dos facetas unidas por una veta agrietada late en el marco de la mina, como señal visual de la persona que el minero busca salvar.

- `npm run typecheck`, `npm run lint` y `npm run build` pasaron.
- Vitest: 736 de 737. Persiste únicamente el fallo histórico de `SkyLightReference.test.ts` (`face: 5504` frente a `-1`); no toca menú ni recursos visuales.
- Edge: `tests/menu.spec.ts` y `tests/menu-redesign.spec.ts` pasaron 19 de 19. Cubre título, subtítulo, botones, sonido, efectos reducidos, animación de cristales/portal/motas, nueva partida, continuación, F11, escalado entero y tamaños estrechos.
- Se inspeccionó la captura de la escena a escala entera (`docs/screenshots/menu-redesign-focus.png`): la UI queda legible sobre la zona vacía izquierda y el portal concentra los efectos a la derecha.

## Preparación del repositorio GitHub (23 de noviembre de 2026)

Se actualizaron `.gitignore` y `README.md` antes de publicar el estado de desarrollo. No hubo cambios de comportamiento del juego en esta tarea.

- `npm run typecheck`, `npm run lint` y `npm run build` pasaron.
- Vitest completo: 736 de 737. Persiste el fallo histórico de `SkyLightReference.test.ts` (`face: 5504` frente a `-1`), confirmado también al ejecutar ese archivo de forma aislada.
- Playwright completo en Microsoft Edge: 144 aprobadas, 27 fallidas y 2 omitidas en 28,5 minutos, con un trabajador. Los fallos se concentraron en la entrada antigua a la galería (`gallery.spec.ts`), recorridos de minería que dependen de posiciones anteriores, introducción y sonidos, más casos aislados de muerte en galería, HUD, tutorial, batería, cambio de modos, rampas y mineral desconocido. Las pruebas del mundo abierto, expedición, cavernas, menú, nitidez, construcción, derrumbes, supervivencia, biomas y guardado principal pasaron. Los artefactos temporales quedaron en `test-results/`, ignorado por Git.
