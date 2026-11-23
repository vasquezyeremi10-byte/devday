# MINA CERO — diseño y sistema V2

> Alcance vigente y controles: sección «Sistema V2» al final. Las secciones del prototipo 0.1 se conservan como registro histórico.

Juego original de gestión minera 2D en vista lateral. El jugador pasa de una entrada rudimentaria, un minero, un pico, una pala y un carrito a una empresa minera. La estructura de construcción y progresión de Fallout Shelter es una referencia conceptual; no se reutilizan sprites, nombres, interfaz ni identidad visual.

## Música y ambiente de partida

La partida abre con guitarra y acompañamiento suave. La cabaña baja su volumen y amortigua el exterior. Cada bioma tiene su propia mezcla de viento, aves y oleaje. Los cantos son más densos en el bosque y el pinar, esporádicos en el desierto y se apagan al anochecer. La cordillera tiene más viento y en la costa domina la rompiente.

Al bajar de la superficie natural, la guitarra se funde con piano espaciado y goteos de galería. El campamento, la cabaña y la galería cenitales usan la misma mezcla según su entorno. `WorldAudio` carga los recursos en segundo plano, espera el desbloqueo de sonido del navegador y usa las bandas de cruce de biomas. Los bucles se suspenden en pausa y se liberan al abandonar la escena. El volumen de cada capa vive en `config/worldAudio.ts` y el silencio global sigue disponible en los controles del juego.

## Sonidos de acciones

Las pisadas siguen la distancia recorrida y cambian entre grava, piedra, hojas y madera. Correr acelera la cadencia y acentúa cada paso. Comer y beber tienen efectos distintos, activados al descontar el alimento. La rodadura del carro cambia de volumen y tono con su velocidad real y se apaga cuando se detiene. Estos efectos se aplican en las vistas lateral y cenital y respetan el silencio global del juego.

## Visión futura

Excavar → descubrir → transportar → vender → reinvertir. La expansión incorporará herramientas, contratación, galerías, transporte, maquinaria, automatización, instalaciones, investigación, experiencia y habilidades de forma gradual. Estas ideas no están implementadas ni tienen balance definitivo.

## Alcance aprobado de la primera versión

Una escena MiningScene con superficie, entrada, tierra, roca, carrito decorativo y un minero controlable. A/D o flechas para caminar; Espacio/W/arriba para salto; mouse para seleccionar y clic izquierdo para excavar un bloque. R y botón de reinicio restauran el estado inicial.

La selección indica si el bloque está alcanzable. El pico actúa a un máximo de 36 px del centro físico al centro del bloque, exige una cara expuesta y línea libre. Tierra y roca se eliminan instantáneamente; los bordes profundos de lecho son protegidos. Se actualizan colisiones y caras adyacentes al excavar. El minero puede caer por sus propios túneles y saltar para volver a subir; si se encierra, puede reiniciar.

La mina se abre en la base de un cerro: ladera izquierda empinada sobre la bocamina, cumbre con afloramientos de roca y ladera derecha que baja de a una fila hasta el valle. La bocamina tiene poste con flejes, dintel saliente y encamado de troncos contra la ladera, señales de peligro y de casco obligatorio, farol y material suelto. La galería mide 8 × 3 tiles: marcos interiores con tornapuntas, encostillado, cable de alumbrado y antorchas. Su pared del fondo se oscurece hacia adentro. La vía empieza y termina en topes. En el valle está la bodega rústica de la operación recién fundada (nivel 1 de 3: tablones, calamina, puerta, ventana, letrero, farol, herramientas apoyadas y suministros), junto a álamos, matorrales, piedras sueltas, el letrero y el carro.

### Subsuelo

Estratos visuales sobre la misma grilla lógica: suelo superficial bajo el pasto, material meteorizado, roca alterada en el contacto, roca competente con zonas fracturadas y vetillas de cuarzo, y roca profunda desde la fila 24. Las caras expuestas reciben contorno (autotile). Al excavar, el bloque se agrieta y estalla en el cuadro de impacto de la herramienta.

### Minerales e inventario

Seis menas en yacimientos diseñados por estrato: carbón en la tierra; cobre y hierro en la roca alta; cuarzo y plata más abajo; oro cerca del lecho. Desde la fila 24 la roca cambia a un estrato más oscuro. Se excavan igual que la roca, sin dureza propia. Cada mena retirada suma 1 a su contador (máximo visible 99), con destello, «+1» y una pepita que vuela al panel del HUD. El primer hallazgo de cada mineral muestra «NUEVO MINERAL» y el minero festeja; moverse cancela el festejo. Desde el primer mineral el carro aparece cargado. No hay precios, ventas ni valores: el inventario solo cuenta.

### Respuesta de excavación

Pala para tierra (polvo y sonido blando) y pico para roca y mena (chispas y golpe metálico). La colisión desaparece al hacer clic; la imagen del bloque se agrieta y estalla en el cuadro de impacto (pala 67 ms, pico 167 ms), donde también suenan el golpe y la recolección. El minero proyecta una sombra sobre el suelo real y, bajo tierra, la lámpara del casco ilumina. El HUD muestra la herramienta que corresponde al material, el nombre del bloque señalado, la instrucción y avisos breves; no hay barra de progreso porque la excavación es instantánea. Los fragmentos usan los colores del material y desaparecen de golpe. M silencia el sonido. Ninguna animación demora el control.

Mundo de 1280 × 576 px y pantalla de 480 × 270. La cámara sigue al minero y respeta límites. Los píxeles se escalan sin suavizado. Los gráficos son provisionales, originales y generados por código para poder reemplazarlos después.

## Dirección artística

Desde V6 la dirección es pixel art 16-bit moderno con paleta de 40 colores (ver «Sistema V6»). Párrafo histórico de la etapa 8-bit: la presentación evocaba la era NES mediante diseño de píxeles enteros, formas escalonadas, colores planos y una paleta común de 24 colores. Se conserva la resolución de 480 × 270 solicitada: la referencia es estética, no una emulación de las restricciones físicas de la consola.

El minero se construye en Pixelorama: 47 cuadros de 16 × 24 con casco, lámpara, ropa de trabajo, botas y pico. Conectados al juego: idle (4), walk (8, con piernas y brazos alternados), salto en cuatro fases (subida, punto alto, caída, aterrizaje), mine con pico (6), dig con pala (5) y celebrate (4). Preparados sin activar, porque esas mecánicas no existen: run (6), push (4), carry (4) y tired (2). El flip horizontal solo cambia la dirección. La animación es respuesta visual: el bloque se elimina al instante y el jugador conserva el control.

La tierra usa grano, racimos y piedrecillas; la roca, masas angulares con grietas; el lecho, bandas trabadas. El pasto seco tiene esquinas escalonadas donde la ladera baja. Todo pertenece al tile y se elimina junto a él. La utilería importada (Kenney, Minery Icons, senmou, Treasure Hunter, pixelfx; ver ASSET_CREDITS.md) se normaliza a la paleta común. Los fondos temporales son capas geométricas de parallax, con cordillera nevada y cerros cercanos, independientes de la grilla.

HUD opaco con marcos rectangulares, iconos de pico/profundidad/bloque y fuente bitmap original 5 × 7. No hay suavizado, gradientes, desenfoque, filtros modernos ni alfa parcial. Escala entera; en ventanas estrechas el lienzo conserva 1× y se desplaza dentro de su contenedor.

Los futuros PNG de ChatGPT deberán respetar ASSET_SPEC.md. Los fondos definitivos siguen pendientes de entrega y revisión del usuario.

## Fuera del alcance

No hay economía (precios, venta, valores), extracción con duración, dureza por material, transporte funcional, trabajadores automáticos, habilidades, maquinaria funcional, daño, combate, música, guardado ni soporte táctil jugable. El carro no se mueve: solo muestra si ya hay mineral. Herramientas avanzadas, rieles, izaje, vigas, cinta transportadora y balizas están preparados en `machinery/equipment` (carga diferida) para etapas futuras.

## Criterios de aceptación

- Moverse en ambas direcciones, saltar con soporte y aterrizar sin atravesar bloques.
- Seguir al personaje con cámara y seleccionar correctamente tras desplazamiento.
- Excavar solo un bloque válido por clic, sin alcanzar bloques lejanos ni atravesar paredes.
- Eliminar bloque visible y colisión juntos; regenerar todo al reiniciar.
- Cargar sin errores; typecheck, lint, pruebas y build aprobados.
- Fondos intercambiables sin afectar el terreno ni la física.
- Extraer una mena suma exactamente 1 a su mineral; tierra y roca estéril no suman.
- Todo recurso externo con licencia verificada y registrada.

## Sistema V2 (vigente)

La instrucción del usuario del 9 de noviembre de 2026 amplía el prototipo: interacción Z, herramientas finitas, trabajo mantenido, carga personal 4, carro 20, vías horizontales, comercio y guardado local. Esta sección sustituye las referencias anteriores a minería instantánea, carro decorativo y ausencia de economía o persistencia. No autoriza trabajadores autónomos, salarios, habilidades, rampas ni maquinaria adicional.

### Circuito y controles

Comienza con 30 monedas y sin herramientas. La bodega a la izquierda vende hierro (15), tungsteno (45), diamante (90), pala (10) y riel (5). Z junto al bodeguero abre comercio; flechas arriba/abajo eligen, Z o el botón COMPRAR confirma, Escape cierra. Los ambientes y el NPC siguen animándose mientras el personaje queda inmóvil.

- A/D y flechas: caminar. Espacio/W/arriba: salto con soporte.
- 1/2/3/4: equipar hierro/tungsteno/diamante/pala; repetir recorre repuestos utilizables.
- Mantener clic: excavar el bloque seleccionado. Soltar, apuntar a otro, salir de alcance, cambiar herramienta o abrir interfaz reinicia el trabajo. No se cobra desgaste por cancelación.
- Z selecciona exclusivamente la acción válida más próxima, con alcance y línea visible. Nunca repite al mantener pulsado.
- Junto al carro: Z con carga inicia un traslado con pala; sin carga entra en empuje. C permite empujar aunque lleves material. Z suelta el carro. Colócate a un lado, no encima.
- Cada Z de carga completa un bloque en 1,5 s; repetir para los demás. Moverse, saltar, Z o Escape cancela sin transferir ni gastar durabilidad. X retira carga del carro hasta llenar los cuatro espacios personales.
- La pila suelta inicial tiene ocho unidades de tierra. Z la recoge con pala; si hay carro cercano se deposita allí, de lo contrario va a la mochila. La tierra del terreno también se recoge con pala; roca y menas requieren picota.
- En VENTA, Z vende la carga personal y también el carro si está a 36 px o menos del depósito. El resultado muestra el ingreso real y vacía solo los inventarios vendidos.
- En un extremo de vía: Z abre construcción; Z confirma el tramo vecino, Escape cancela. Flechas eligen extremos cercanos si hay más de uno. La previsualización usa damero de alfa binario para conservar el estilo.
- H: guía. M: silenciar. F: guardar. R o botón de la página: regresar a superficie conservando terreno y bienes; también rescata pozos sin salida. Recargar el navegador continúa la partida.

### Reglas y arquitectura

`config/balance.ts` concentra precios, venta, tiempos, durabilidades, capacidades y movimiento del carro. Picotas: 10000 / 5000 / 2500 ms por bloque, 20 / 50 / 90 acciones completas. La pala admite 30 cargas o bloques de tierra y tarda 1500 ms; no rompe roca. Herramientas, rieles y monedas no ocupan espacios minerales. El HUD identifica desgaste bueno (>50%), desgastado (>20%), próximo a romperse (>0%) o roto, mediante texto y barra.

`MiningSystem` conserva selección, oclusión y excavación sobre `TerrainGrid`. `WorkSystem` usa un reloj monotónico absoluto; no acumula fotogramas ni transfiere tiempo sobrante entre bloques. `GameSession` efectúa las transacciones de minería, comercio y transporte; `InventorySystem` y `ToolSystem` conservan cantidades y durabilidad. `InteractionSystem` arbitra acciones; `RailSystem` valida conectividad, espacio y soporte; `CartSystem` controla aceleración, frenado y límites. `NPCSystem`, `LogisticsView`, `OperationsHUD` y la escena proyectan el estado real.

La minería se bloquea con 4/4 antes de empezar y vuelve a comprobar capacidad al finalizar. Cada bloque da exactamente una unidad (incluye tierra y piedra). Las vías tienen soporte sólido y dos celdas de altura libre para carro y minero. No se permite extraer soportes de vías ni cimientos de la bodega/depósito. El carro no atraviesa huecos, paredes ni extremos; abandona empuje si pierde contacto o encuentra obstrucción. La física del jugador no cambia con las poses.

El guardado usa `localStorage`, clave `mina-cero.save.v2`, versión 2. Guarda terreno excavado, dinero, ventas, herramientas y durabilidad, selección equipada, inventario personal, carga y posición del carro, rieles, existencias, pila suelta y posición del personaje. Guarda tras transacciones, cada cinco segundos, al ocultar/cerrar y con F. No guarda trabajo parcial, interfaces ni empuje. Al volver de otra pestaña se cancela el trabajo: no hay producción fuera de pantalla. Se validan versión, límites, materiales, herramientas y vías antes de aplicar; si el archivo es inválido se conserva una copia en `.invalid` y se inicia una partida nueva. Si el navegador rechaza almacenamiento, aparece aviso. No hay sincronización de múltiples pestañas ni guardado en nube.

### Balance inicial y continuidad

| Recurso | Venta por bloque |
| ------- | ---------------: |
| Tierra  |                3 |
| Piedra  |                4 |
| Carbón  |                7 |
| Cobre   |               10 |
| Hierro  |               12 |
| Plata   |               18 |
| Oro     |               25 |
| Cuarzo  |               15 |

Ejemplo conservador con tierra: 30 iniciales −15 hierro −10 pala −5 riel = 0. Vender 15 bloques produce 45 y compra tungsteno, consumiendo 150 s de excavación y 22,5 s de carga. Otros 34 bloques producen 102: permiten una pala de recambio (10) y diamante (90). Esa fase consume 170 s de excavación y 51 s de carga. Total mecánico: 393,5 s, más caminatas, empuje y comercio; estimación inicial de 8–12 minutos, no medición de una sesión humana completa. Minerales valiosos aceleran la mejora. No se requieren horas. La capacidad de transporte limita el rendimiento real.

Coste por bloque solo por desgaste de picota: hierro 0,75; tungsteno 0,90; diamante 1,00. Carga con pala añade 0,333 monedas por bloque. Con tierra, margen operativo antes de otros gastos: 1,917 / 1,767 / 1,667 por bloque. La mejora compra velocidad, no mayor margen unitario. Considerando solo extracción+carga, rendimiento teórico: 5,22 / 9,23 / 15 bloques por minuto, antes de desplazamientos. Los parámetros son ajustables y requieren sesiones humanas de balance.

La opción AUXILIO entrega hierro o pala nuevos solamente si no queda una herramienta utilizable de esa clase y el saldo no alcanza su precio básico. Los repuestos siguen teniendo durabilidad finita; evita bloqueo por insolvencia, sin vender herramientas ni canjear el auxilio por moneda.

### Límites deliberados

Un único carro y red horizontal en la galería inicial. Sin curvas, pendientes, cambios de vía, almacén separado (VENTA realiza entrega inmediata), trabajadores autónomos, experiencia ni persistencia entre navegadores. La pala anima siete fases y cambia orientación hacia el carro; los sonidos reutilizan muestras CC0 de impactos suaves y metálicos. Los fondos siguen provisionales. No se han instalado dependencias ni aplicaciones.

## Iluminación subterránea y carro artesanal

Instrucción del usuario del 9 de noviembre de 2026: carro más pequeño y oscuridad real dentro de la mina, con la lámpara del casco como fuente principal.

**Carro.** Caja de madera 20 × 10 con fleje, esquineros e interior visible; ruedas de 5 px apoyadas en la cabeza del riel (fila y = 154). Alto total 11 px (≈52 % de los 21 px visibles del minero) y ancho ≈1,5–1,7 veces el suyo. `config/cart.ts` es la única fuente de medidas: dibujo, empuje (el minero a 16 px del centro), separación mínima (12 px) y topes de vía (10 px del extremo). Capacidad lógica: 100 kg (antes 20 bloques).

**Zonas** (`lighting/LightingZones.ts`), según la luz natural en la cabeza del minero:

| Zona         | Condición          | Resultado                                                             |
| ------------ | ------------------ | --------------------------------------------------------------------- |
| A Superficie | luz natural ≥ 80 % | escena normal, lámpara apagada                                        |
| B Bocamina   | 12–80 %            | la luz del día entra unos 5 tiles en aire excavado; lámpara encendida |
| C Galería    | < 12 % y fila < 17 | ambiente 4 % → 2 %, solo el casco revela                              |
| D Profunda   | < 12 % y fila ≥ 17 | oscuridad total fuera del haz                                         |

La luz natural se propaga por celdas de 4 px desde el aire sobre la superficie natural, pierde intensidad en aire subterráneo y dentro de la roca, y nunca sale de un sólido hacia aire. Se recalcula solo al excavar.

**Lámpara del casco** (`lighting/HeadlampLight.ts`): encendida, ilumina al 100 % un cuadro de 3 × 3 bloques centrado en el minero y se apaga de a poco durante un bloque más (`squareFalloff`, distancia de Chebyshev). La oclusión parte del píxel de la lámpara en el casco; el punto luminoso sigue la animación. Se enciende/apaga en 280 ms al cruzar la bocamina. Parámetros `areaTiles` y `fadeTiles` en `config/lighting.ts`.

**Oclusión** (`lighting/LightOcclusion.ts`): cada celda iluminada se comprueba con un rayo DDA contra los tiles sólidos de TerrainGrid; la luz entra 14 px en la cara de un bloque y no alcanza el de detrás. Las esquinas diagonales cerradas bloquean. Al excavar, la luz entra en el hueco nuevo; al alejarse, todo vuelve a oscurecerse (no hay memoria de zonas exploradas).

**Composición** (`lighting/UndergroundDarkness.ts`): una textura canvas reutilizada cubre la cámara; cada píxel es transparente o tinta opaca, con dithering Bayer 8 × 8 fijo al mundo y una franja de penumbra cálida (umber) en el borde del haz. Sin blur, gradientes ni alfa parcial. Profundidad 700, por debajo de la interfaz del mundo (800) y del HUD (1000+). Las menas alcanzadas por el haz destellan un píxel crema.

**Faroles y antorchas** del escenario (`Scenery.lights`): el farol de la bocamina (`decor`) tiene emisión mínima de 10 px; las antorchas de la galería (`torch`) iluminan 5 × 5 bloques como las que se compran. El tipo `industrial` queda reservado para lámparas que se puedan comprar e instalar más adelante; no hay electrificación ni compra de lámparas.

## Sistema V3 — minería con consecuencias

Instrucción del usuario del 9 de noviembre de 2026 (prompt maestro V3). Ciclo: EXCAVAR → EXTRAER → TRANSPORTAR → VENDER → CONSTRUIR → ASEGURAR → MEJORAR → EXPLORAR. Todos los parámetros están centralizados: `config/balance.ts` (precios, herramientas, suministros y etapas), `config/minerals.ts`, `config/lighting.ts`, y las constantes `GEOTECH`, `VENTILATION`, `BLAST`, `SUPPORT`, `LAMPS`, `HEALTH`, `UNLOCK` y `LUIS` en sus sistemas. Son modelos de juego, no predicciones geotécnicas, de ventilación ni de explosivos reales.

**Exploración y visibilidad** (`VisibilitySystem`, `LightingSystem`). Terreno no descubierto ≠ terreno oscuro: un bloque no descubierto se dibuja como su estrato (sin mena ni roca dura) y no recibe luz ambiental; se descubre al recibir luz ≥30 % o al excavarlo. La luz del día solo muestra la cara expuesta (≈1 bloque); desde la superficie no se ven capas, menas ni cavernas. Antorchas (cuadro de 5 × 5 bloques a plena luz que se apaga de a poco 1,5 bloques más, 6 min), faros (88 px, batería 20 min, etapa 2) y luminarias industriales (112 px, sin consumo, etapa 3) se instalan junto a una pared, piso o techo y se ocluyen por bloques.

**Geología por semilla** (`world/Geology.ts`). Cuatro sectores de 20 columnas (carbonífero fijo junto a la bocamina; cuprífero, aurífero y de gemas permutados por semilla). Yacimientos: mantos estratificados de carbón, vetas diagonales de hierro y oro, cobre diseminado, bolsadas de oro y gemas, chimenea especial de diamante y un único bloque de mineral desconocido junto a una cámara sellada cerca del lecho. Roca dura desde la fila 26. Cavernas selladas ocultas. La partida guarda la semilla y solo las diferencias (aire o escombro): no se puede regenerar un sector.

| Mineral             | Venta | Picota mínima |
| ------------------- | ----: | ------------- |
| Carbón              |     5 | hierro        |
| Hierro              |     8 | hierro        |
| Cobre               |    11 | hierro        |
| Oro                 |    30 | hierro        |
| Esmeralda           |    60 | tungsteno     |
| Rubí                |    65 | tungsteno     |
| Zafiro              |    85 | tungsteno     |
| Diamante            |   160 | diamante      |
| Mineral desconocido |   600 | diamante      |

**Herramientas.** Picota de hierro 5 s, tungsteno 3,5 s, diamante 2,5 s por bloque estándar; pala básica única 5 s por unidad. Roca dura ×1,4; escombro ×0,6; bloque fracturado ×0,5. Perforadora manual (etapa 2): 2,5 s por barreno, el bloque permanece perforado; al comprarla el bodeguero avisa que hacen falta dinamita y mechas.

**Vías con rampas** (`RailSystem`). Riel 4 px sobre el piso, durmientes y caballetes bajo las rampas. Entre tramos vecinos se admite ±1 bloque; la rampa ocupa la columna baja y sube 16 px en 16 px de forma continua. Se rechazan desniveles mayores, vías sin piso, dentro de roca sin excavar o un pozo de un bloque. El carro apoya ambas ruedas en el perfil y se inclina; sube a ×0,7 y baja a ×1,25 de su velocidad; el minero sube el escalón al empujar.

**Sostenimiento y derrumbes** (`SupportSystem`, `GeotechnicalSystem`). Cada tramo de techo excavado sin sostener recibe carga = luz libre / luz admisible (tierra 4, roca 6, roca dura 8; −1,2 % por fila de profundidad) + 0,15 por bloque de altura sobre 2 + daño de tronadura. Estados: ESTABLE <0,75, VIGILANCIA, PELIGRO ≥1,0, COLAPSO INMINENTE ≥1,3 (cuenta regresiva de 10–25 s según gravedad). Grietas de techo por estado, polvo y crujidos en PELIGRO, bloques marcados en rojo y alarma con segundos. Vigas de madera (reach 2, se desgastan 1 %/min y con golpes) y de acero (reach 4, etapa 2, reemplaza madera); instalarlas a tiempo cancela la cuenta. El derrumbe llena con escombro solo las celdas bajo el tramo (sin caer dentro del minero ni del carro, que reciben el golpe), daña marcos cercanos y puede obstruir vías. Las cavernas naturales no se evalúan: solo lo excavado.

**Entrada protegida.** La galería original de la bocamina (columnas 18–25, filas 7–9) nace abierta y no se evalúa para derrumbes, incluso en partidas antiguas con marcos rotos. Sus dos marcos fijos no se desgastan ni reciben daño estructural. Las galerías excavadas a continuación conservan el riesgo normal.

**Ventilación** (`VentilationSystem`). Calidad 0..1 que entra por el cielo abierto y pierde 0,012 por bloque recorrido más 0,0013 por fila de profundidad. Ventilador principal (en superficie, 30 ductos) y auxiliar (toma ≥0,45, +0,35, 12 ductos), etapa 3, con aspas animadas. Tronaduras contaminan (0,6, radio 6) y se disipa a 0,02/s. Estados ADECUADA ≥0,6, DEFICIENTE ≥0,4, AIRE PELIGROSO ≥0,2, EMERGENCIA. Jugador: aviso inmediato, 6 s de margen, luego movilidad ×0,8/×0,6 y 1,5/4 de daño por segundo; en aire adecuado recupera salud.

**Tronadura** (`BlastingSystem`). Barreno → Q dinamita + clic derecho (una carga por barreno) → clic derecho otra vez con mecha → 6 s con chispa, contador y alarma (no se congela con menús). Explosión: el bloque central siempre cae, vecinos ortogonales 62 % y diagonales 35 % con patrón determinista; nunca supera 3×3 ni forma un cuadrado perfecto; respeta lecho y soportes de vía/bodega. Cada bloque destruido rinde exactamente un material en una pila (se recoge con pala); los sobrevivientes quedan fracturados. Daño al jugador hasta 85 a menos de 56 px (×0,3 tras roca), golpe a marcos, daño al techo y aire viciado.

**Salud** (`HealthSystem`). 100 puntos, protección de 0,6 s tras un golpe con parpadeo, sin protección para el aire (daño continuo). Al morir reaparece en superficie, pierde 10 % del dinero y la carga personal salvo 2 bloques; conserva herramientas, terreno, vías y carro.

**Luis** (`LuisAdvisor`). Aparece bajo tierra a los 40 s y luego cada 110–170 s en una celda transitable, alcanzable por galerías, segura (techo no peligroso, aire adecuado) y a 3–10 pasos; se va a los 30 s. `[Z] HABLAR CON LUIS` da un consejo según el estado real (peligros primero, sin repetir antes de 4 min, sin revelar menas ocultas ni el secreto).

**Etapas** (`ProgressionSystem`). 1 Minería artesanal: hierro, pala, vías, vigas de madera, antorchas. 2 Mecanización (ventas $100 o primer oro): tungsteno, diamante, perforadora, dinamita, mechas, vigas de acero, faros. 3 Minería industrial (ventas $450 y fila 20): ventilación y luminarias. La bodega muestra los artículos bloqueados con la etapa requerida y la meta pendiente.

**Secreto.** Al extraer el mineral desconocido (con picota o tronadura) se dispara una vez por partida una animación de anillos, sonido y el logro «NO ESTAMOS SOLOS», guardado en la partida.

**Controles nuevos.** 5: perforadora. Q: elegir objeto. Clic derecho: instalar viga, luz, ducto o ventilador; cargar dinamita; encender mecha. Bodega: izquierda/derecha cambian de categoría.

**Guardado V3** (`mina-cero.save.v3`). Semilla, diferencias de terreno, mapa de descubrimiento, suministros, marcos, luces (combustible), ductos y ventiladores, barrenos, fracturas y cargas, cuentas de derrumbe, salud, etapa, minerales hallados y logros. Mecha encendida al guardar: al cargar queda apagada y la mecha vuelve al inventario. Derrumbe en curso: se reanuda con al menos 10 s. La partida V2 se migra (excavaciones conservadas sobre la nueva geología; plata y cuarzo liquidados a su precio V2) y la clave V2 se conserva.

**Fuera de esta entrega.** Trabajadores contratados (no existían en el proyecto): no hay contratación, rutas ni tareas; los sistemas exponen lo que necesitarán (`VENTILATION.occupant`, estados de techo y aire por celda, `findSpot` con rutas por galerías). Red eléctrica de faros y luminarias, automatización y mejoras de capacidad de ventiladores tampoco están implementadas.

## Sistema V4 — inventario, equipamiento y supervivencia

Instrucción del usuario del 9 de noviembre de 2026. Parámetros en `config/gear.ts`.

- **Inventario general** (`LoadoutSystem`): las 24 casillas están disponibles desde el inicio y no dependen del nivel. Cada herramienta no equipada ocupa una casilla; cada tipo de suministro, una pila; el EPP equipado no ocupa casillas. Lo que no cabe (partidas migradas, desmontajes) espera sin perderse y entra al liberar una casilla. Una compra sin casilla libre no se cobra.
- **Carga minera**: la carga por peso (50 kg; antes 4 bloques) sigue aparte e independiente de las casillas.
- **Experiencia**: bloque excavado 2 (una vez por celda), mineral nuevo 25 (una vez por tipo), 1 por cada $5 vendidos, riel 3 (una vez por columna), viga 5 (una vez por celda y tipo), tronadura 5, etapa 50, misión 30. Nivel L requiere 20·(L−1)·L de experiencia total.
- **Equipamiento**: ranuras cabeza, ojos, torso, manos, pies, herramienta y accesorio. El aspecto del minero se deriva de su hoja recoloreando todos los cuadros (casco, gafas, chaleco con franja, guantes, botas), así se mantiene en cada animación; sin casco no hay lámpara.
- **Acceso**: sin el EPP básico completo no se puede estar bajo la superficie (portal, pozo, salto o partida cargada): vuelve a la última posición segura y aparece «ACCESO RESTRINGIDO — EPP INCOMPLETO» con ✓/✕. Tampoco se excava sin EPP.
- **Derrumbes y salud**: si un bloque del derrumbe cae sobre el minero, muere aplastado aunque lleve casco; junto al tramo recibe 30 de roca (×0,7 con casco); lejos, nada. El daño se anuncia leve, grave o letal; el protector auditivo reduce un 20 % el daño de tronadura.
- **Modos**: Normal (reaparece en superficie, pierde la carga transportada y el 10 % del dinero; conserva nivel, tecnología e instalaciones; los daños de la mina quedan) y Hardcore (una vida; «FIN DE LA EXPEDICIÓN» con estadísticas; la partida queda marcada como terminada, se archiva en `mina-cero.archive.<fecha>` y en `mina-cero.history`, y no se puede reanudar). La modalidad se elige al crear la mina y no cambia.
- **Logros nuevos**: Primer día seguro, Minero preparado, Prevenir es vivir, Un susto bajo tierra, Ingeniero previsor (3 jornadas de 10 min sin derrumbes con 5+ marcos activos) y Hasta el final (etapa 3 en Hardcore).

## Sistema V5 — EPP gratuito, inventario visual, corazones y desmontaje

Instrucción del usuario del 10 de noviembre de 2026.

- **Kit de seguridad gratuito**: en la bodega, categoría SEGURIDAD, «RECLAMAR KIT DE SEGURIDAD | GRATIS». Entrega y equipa solo las piezas que falten (sin duplicar), una vez por partida. El EPP básico no se desgasta, no se descarta y no se pierde al morir, así que nunca hay que volver a pedirlo. El protector auditivo (etapa 2) se sigue comprando. Dinero inicial: 50 (antes 125, que incluía el EPP).
- **Controles** (`config/controls.ts`, ajustables con un JSON en `localStorage['mina-cero.controls']`): `Tab` abre y cierra el inventario (los navegadores no distinguen Tab izquierda de derecha), `X` modo desmontar, `V` retirar carga del carro (antes X). Tab no se captura si el foco está en un botón, enlace o formulario de la página. No hay aún un menú de ajustes dentro del juego.
- **Inventario visual**: íconos para todo (sin letras permanentes); cantidad en la esquina, barra de durabilidad en herramientas, marco de rareza o nivel, esquina dorada en lo equipado, siluetas en ranuras vacías y candados. Tooltip al pasar el cursor: nombre, descripción, cantidad, durabilidad, uso y valor.
- **Corazones**: 5 corazones arriba a la izquierda (20 HP cada uno, medio = 10 HP, redondeo hacia arriba); el que pierde vida parpadea; con un corazón o menos laten despacio y suena un aviso discreto. Los valores de daño existentes no cambian.
- **Modo desmontar** (`DismantleSystem`): vigas, antorchas, faros, luminarias, ventiladores, ductos y rieles colocados; nunca terreno ni estructuras permanentes (el entibado original de la bocamina está marcado como fijo). Alcance de 52 px y línea de visión. Marco verde (sin riesgo), amarillo (con consecuencias) o rojo (peligroso o bloqueado). Una viga cuya retirada dejaría el techo en PELIGRO o peor pide «CANCELAR / RETIRAR IGUAL», según una simulación real sin ese marco; después se recalcula la estabilidad y, si queda inminente, empieza la cuenta regresiva. Ventiladores y ductos recalculan la red; las luces se apagan al instante; un riel bajo el carro no se retira y quitar uno del medio corta la vía.
- **Recuperación**: madera 50 %, acero 75 %, antorcha 50 %, faro 75 %, luminaria 75 %, ventiladores 75 %, ductos 75 %, riel 100 %, multiplicado por el estado (durabilidad o combustible). La fracción se acumula por tipo y solo se entregan unidades enteras: colocar y desmontar nunca genera recursos. Lo destruido por derrumbe o tronadura ya no existe y no se recupera.
- **Guardado V5** (`mina-cero.save.v5`): kit reclamado, recuperación acumulada y todo lo anterior. Migración: las partidas V4 que compraron el EPP lo conservan, el kit queda reclamado y reciben una compensación única de su precio V4 ($75 por el conjunto); las V2/V3 lo recibieron gratis al migrar, sin compensación.

## Sistema V6 — rediseño artístico (10 de noviembre de 2026)

Rediseño solo visual: ninguna regla, colisión, coordenada de interacción ni sistema cambió. La referencia del encargo se describió por texto (no llegó una imagen adjunta); se siguieron sus colores y lenguaje sin copiar edificios ni personajes.

- **Paleta V6** (`config/palette.ts`, 40 colores): los 24 nombres históricos adoptan los tonos de la dirección (p. ej. `ink` #0D1020, `night` #15182B, `slate` #212C48, `steel` #71829A, `gold` #F4B341, `cream` #FFE29A, `sky` #2D63AC, `blue` #4693DD, `mist` #A8D8EB, `pine` #184D39, `moss` #8EAD39, `umber` #461F15, `earth` #5B362D) y se suman 16 tonos: `azure`, `violet` #5A69BB, `cobalt` #4979D2, `dusk`, `indigo`, `forest`, `lime`, `ochre` #BE7F1A, `soil`, `loam`, `ember`, `orange`, `plum`, `mauve`, `taupe`, `khaki`. Los PNG se migraron con un intercambio exacto color a color (`scripts/art/remap-palette-v6.mjs`).
- **Cielo y paisaje** (`world/Backdrop.ts`): cielo en cinco bandas con dithering Bayer 4 × 4, sol con halo punteado, cinco cúmulos que derivan y tres cordilleras con parallax horizontal (lejana azul con nieve ×0,2; media violeta ×0,4; lomas de bosque con pinos en silueta ×0,6). Texturas canvas creadas una vez.
- **Vegetación** (`structures/Flora.ts`): pinos de tres tamaños por pisos con luz arriba-izquierda, arbustos con bayas, matas de pasto, flores de cuatro colores y piedras con musgo. Siguen anclados a su celda: desaparecen al excavarla.
- **Bodega**: tablones de largo y tono variables con clavos, vetas y desgaste; techo de tejuelas azul acero con alero ocre; ventana con luz interior y jardinera; puerta entreabierta con interior iluminado; farol con halo; caja de herramientas. Misma posición y misma zona de interacción del bodeguero.
- **Punto de venta** (`structures/SalesPost.ts`): estructura de acero azul con franjas de seguridad, marquesina a rayas naranja y crema, mostrador de madera con cartel de precios, balanza, estantes con muestras, lámpara colgante y letrero VENTA con moneda. Centrado en `BALANCE.depotX`; la interacción «DESCARGAR Y VENDER» no cambió.
- **Bocamina**: poste más alto con flejes y zapata, marco interior, dintel con placas de acero y franja amarilla y negra, encamado de troncos contra la ladera, farol exterior con halo, rocas apiladas con musgo y pared del socavón que se oscurece hacia el fondo. La luz decorativa del farol tiene emisión mínima; dentro manda el casco.
- **Terreno**: pasto verde con mechones y flores, suelo pardo cálido, roca en tres familias (gris azulada, parda sedimentaria y violácea) elegidas por piedra, transiciones de suelo cálidas. Lo oculto sigue oculto: VisibilitySystem y la oclusión no cambiaron.
- **Iluminación**: la penumbra registra quién aporta la luz (casco: pardo; antorcha: brasa y anillo anaranjado disperso). Sin alfa parcial ni blur.
- **Interfaz** (`ui/Frame.ts`): marcos industriales con bisel metálico, placas remachadas, franja dorada y sombra discreta en tienda, ayuda, diálogo, logros, inventario y pantallas de seguridad; barras del HUD con filete metálico; ranuras hundidas; botones de la tienda con estado bloqueado/normal/elegido.
- **Estructuras**: vigas de madera cálida con vetas y zapatas, acero azul con placas, ductos con bridas, ventiladores con carcasa remachada y franja de aviso (el principal, ocre), durmientes de madera con canto, eclisas y balasto pardo, carro con tablas cálidas y flejes de acero azul.
- **Personajes**: minero, bodeguero, variantes con herramienta y Luis toman los tonos V6 por la migración de paleta; animaciones y cuadros sin cambios (54 cuadros del minero).
- **Página**: textos de controles actualizados (Tab, 1–6, V, X) y colores de la página en la paleta V6.

### Ajustes V6 posteriores (10 de noviembre de 2026)

- **Antorchas en la muralla de la mina**: bajo la superficie natural toda celda excavada tiene detrás la muralla de roca, así que una antorcha, faro o luminaria se puede fijar en el centro de una cámara amplia (`onMineWall` en PlacedLights). Al aire libre siguen necesitando pared, piso o techo.
- **Rieles con clic derecho**: los rieles entran en la selección de objetos (Q, barra rápida, inventario) y se colocan con clic derecho apuntando a la columna siguiente al extremo de la vía (al aire o al piso). Mismas reglas de RailSystem: conectados, con piso, un bloque de desnivel como máximo y sin pozos. Z junto al extremo sigue funcionando.

## HUD, acceso rápido y progresión por nivel

- **Acceso rápido**: cinco referencias a ejemplares de herramienta (ID) o pilas reales. Se asignan por arrastre desde la mochila o la ranura de herramienta; se intercambian entre sí, y se quitan por menú contextual. Las teclas 1–5 y el clic seleccionan; una casilla vacía deja las manos libres. Las herramientas rotas siguen visibles con barra agotada y tooltip. La última unidad consumida y los descartes limpian su acceso. La selección y la distribución se guardan; el sexto acceso de un guardado antiguo se recupera en un hueco disponible sin eliminar bienes. El inventario y el EPP siguen siendo independientes.
- **HUD**: indicadores compactos en 480 × 270; barra inferior centrada, ayuda en H y etiqueta Z solo si hay interacción cercana. Se conserva la escala entera 1×/2×/3×, con desplazamiento horizontal para ventanas de menos de 480 px.
- **XP**: carbón 5, hierro 8, cobre 10, oro 20, gemas y mineral desconocido 30; la primera extracción recuperable de cada yacimiento de la semilla da 25 XP adicionales. Tierra/roca/escombro conservan 2 XP por celda. El sostenimiento da 5 XP una sola vez por celda, incluso si se cambia madera por acero. Venta, rieles, hitos tecnológicos y misión conservan sus premios. Los costos, requisitos de herramientas y etapas tecnológicas no cambian.
- **Nivel**: el costo del paso L → L+1 es `round(100 × L^1.35)` hasta nivel 30. Se conserva el excedente. Cada nivel nuevo da 25 monedas al saldo (no a ventas acumuladas) y 1 punto de minado. El trabajo sobre bloques, incluida la perforación, usa sus tiempos base y modificadores originales, divididos por `1 + 0.02 × puntos`, con mínimo del 65 % del tiempo original. Cargar material suelto conserva su duración. El nivel no modifica las casillas del inventario.
- **Guardado**: sigue bajo V5; el marcador de curva distingue la nueva XP total. El nivel, umbral, puntos y capacidad normal se derivan de la XP. Los premios se aplican solo al cruzar umbrales al jugar y se guardan en el saldo; cargar no vuelve a pagarlos. La curva antigua se convierte conservando nivel y fracción de avance (redondeada hacia abajo); no se concede oro retroactivo. Se conservan las claves de acciones ya premiadas.
- **Efectos**: la barra anima el relleno y muestra XP real inmediatamente. El haz y 16 estrellas reutilizan gráficos de píxeles enteros, se recortan contra roca y celdas ocultas y no forman parte de LightingSystem. Los ascensos juntos suman sus premios en una sola presentación; un ascenso durante la animación espera a que termine. No hay pausa de controles.

Referencia de ritmo, no medición de balance: si el jugador recupera 4/8/12 menas por minuto con media de 8 XP por mena, sin misiones, descubrimientos ni otras bonificaciones, alcanzaría los niveles 2/3/4 en aproximadamente 3,1/11,1/24,9 min (bajo), 1,6/5,5/12,4 min (medio) y 1,0/3,7/8,3 min (alto). El tiempo real incluye traslados, carga, equipo y seguridad.

- **Nombre de la mina**: en la pantalla «Nueva expedición» se escribe el nombre (hasta 10 caracteres: letras, Ñ, tildes y espacio; Retroceso borra). 1 y 2 siguen eligiendo la modalidad; vacío = MINA CERO. Se guarda con la partida (campo `v4.mineName`; partidas anteriores conservan MINA CERO) y se usa en los avisos de inicio.
- **Entrada sin cartel** (instrucción posterior del 10 de noviembre): se retiraron el tablero, texto, emblema, patas, ampolletas y halo, junto con sus tres fuentes de luz. El encamado descansa directamente en el dintel; se conservan las señales de seguridad, faroles, antorchas y entibado. No cambian terreno, colisiones, acceso ni interacciones.
- **Exposición real a la luz** (`lighting/ExposureMap.ts`): cada píxel opaco de una estructura (capa de estructuras, también dentro de contenedores) que cae delante de una celda sólida toma la luz del aire que rodea a esa estructura en ese cuadro (sol, faroles, casco), no la de la roca de detrás. El dintel, el encamado y cualquier construcción futura apoyada en la ladera se ven con sus colores al sol; dentro de una galería oscura siguen oscuros; si algún día anochece, se oscurecen solos. Los píxeles sobre aire usan la luz de su propia celda y el interior de la montaña sigue a oscuras. Se reconstruye al excavar y cuando cambia la capa de estructuras; costo medido ≈0,3 ms por cuadro (3,7 ms el cuadro que reconstruye).

## Sistema V7 — bioma del Atacama y mundo dinámico (10 de noviembre de 2026)

Ampliación visual y ambiental: no cambia ninguna regla de minería, inventario, NPC, carro, rieles, herramientas, progresión, ventilación ni sostenimiento. Colisiones, coordenadas de interacción y guardado de bienes siguen iguales.

- **Paleta V7** (`config/palette.ts`, 49 colores): los 40 de V6 más `desertSand` #D8A66B, `desertSoil` #BA7148, `desertMountain` #98563F, `desertRock` #6B493D, `desertSky` #3989D6, `desertSunset` #F39A52, `desertNight` #101B38, `dawnPink` #E48A9A (amanecer) y `duskViolet` #6A4A8C (ocaso).
- **Reloj** (`systems/DayNightCycle.ts`, puro con Vitest): ciclo de 10 min = 5 min de día (amanecer 45 s, día pleno 3 min 30 s, atardecer 45 s) + 5 min de noche. Avanza solo con el tiempo de simulación (`tick` limita cada paso a 1 s y no depende de los FPS) y se detiene con las ventanas modales (inventario, tienda, ayuda, pantallas de seguridad), pestaña oculta, fin de partida o antes de elegir modalidad. Expone fase, luz exterior (0,42 de noche: oscura, nunca negra), fuerza del sol, tono cálido, estrellas, actividad de aves y posición de sol y luna. Se guarda como `dayNightMs` en la partida V5 y se recupera al cargar; una expedición nueva, o una partida anterior a V7 sin reloj, empieza de mañana (1 min después del amanecer) para no comenzar a oscuras.
- **Fondo vivo** (`world/Backdrop.ts`): cielo en cuatro bandas con rampas de cinco colores reales (noche, penumbra, hora dorada, tarde, día) distintas para amanecer (rosado y azul) y atardecer (naranja y violeta); el fondo usa solo los cinco colores planos de cada rampa (cambia en escalones; los cuadros intermedios con tablero 50 % se descartaron porque a tamaño real parecían ruido). Cuatro capas de parallax que cambian de tono con la hora: volcanes lejanos ×0,08, cerros rojos con estratos ×0,18, lomas con quebradas ×0,36 y dunas pequeñas ×0,58. Atlas generados una vez; el cielo es una franja de 8 px repetida (TileSprite).
- **Sol y luna**: el sol sale por la izquierda detrás de los cerros, sube hasta el mediodía y se oculta a la derecha al terminar el atardecer (cuadro anaranjado cerca del horizonte); la luna llena con cráteres cruza el cielo durante la noche.
- **Nubes**: cinco siluetas, dos capas de parallax (lejanas lentas tras los volcanes; cercanas más rápidas), velocidades y alturas distintas; se reciclan al salir de la vista con otra forma. Rosadas al amanecer, naranjas y violetas al atardecer, oscuras de noche.
- **Aves** (hoja `v7-birds`): seis poses de aleteo y una de planeo para las cercanas, cuatro para las siluetas lejanas. Alternan aleteo y planeo con un leve descenso y recuperación, vuelan solas o en grupos de 2–3, en ambos sentidos, algunas bajas cerca de los cerros. Una bandada cada 10–28 s de día; de noche casi ninguna. Están en el fondo de pantalla, detrás de la pared subterránea y del terreno: nunca aparecen en galerías ni dentro de edificios. Se reciclan nueve sprites.
- **Estrellas**: hasta 90 puntos que aparecen de a poco al anochecer y se van al amanecer; destellos lentos y escasos. Solo se redibujan cuando cambian.
- **Superficie desértica**: costra de arena clara con gravilla y piedrecillas en lugar del pasto, suelo anaranjado con caliche y raíces secas, cactus, arbustos secos y coirón que se mecen con la brisa (cuadro alternativo, quietos de noche), rocas sueltas, polvo arrastrado por el viento junto al suelo (solo de día y nunca en galerías) y sombras de los cactus que se corren al lado opuesto del sol y desaparecen de noche. Bodega, punto de venta, bocamina, carro y vía se conservan.
- **Viento**: ruido pardo original generado por código; más audible de día, casi silencioso de noche; M lo silencia y se detiene en pausa.
- **Luz exterior por tinte** (`systems/NightTint.ts`, color en `DayNightCycle.tint`): el exterior ya no se oscurece con trama (de noche se veía como ruido y el minero sin casco se perdía). Los objetos del mundo reciben un tinte multiplicativo parejo, en 16 escalones: blanco de día, cálido en el crepúsculo (`DUSK_TINT` / `DAWN_TINT`) y azul luna de noche (`MOON_TINT` #6C7BBD). Los personajes usan una versión más clara (`MOON_TINT_SOFT` #A3B0E4) para no perderse. Antorchas, faroles, lámparas, la ventana de la bodega y los halos no se tiñen y brillan de noche. Cielo, cordilleras e interfaz conservan sus colores. Los tiles se tiñen al cambiar de escalón y, de noche, en la ventana visible (los recién excavados nacen sin tinte). Excepción de paleta: el tinte multiplica colores y produce tonos intermedios fuera de la paleta, sin alfa parcial ni trama; es la única excepción y solo afecta a la luz de la hora.
- **Oscuridad** (`systems/LightingSystem.ts`, `lighting/UndergroundDarkness.ts`): una sola máscara, bajo la interfaz del mundo y el HUD, solo para la luz natural real (galerías, bocamina, caras de roca); el reloj no la modifica. Faroles y ventanas agrandan de noche un pequeño halo dorado de puntos fijos que no atraviesa la roca. El casco se enciende solo de noche al aire libre.
- **Subsuelo**: la luz solar solo entra por aberturas reales (SkyLightMap sin cambios), las galerías profundas siguen oscuras de día, la roca bloquea toda luz exterior y los minerales enterrados no se revelan.

## HUD V8 — rediseño de la interfaz (10 de noviembre de 2026)

Rediseño visual y de distribución; la lógica del HUD no cambia (corazones, XP con su animación, dinero, EPP, carga, barra rápida 1–5, tooltips, Tab, selección de herramientas, avisos, tienda y guía).

- **Barra superior en tres módulos** (`ui/OperationsHUD.ts`, constante `TOP`), con placas `hudPlate` de `ui/Frame.ts`: contorno de tinta, bisel acero (luz arriba-izquierda), interior azul marino con sombra interna, escuadras doradas arriba y remaches abajo. Los laterales miden lo mismo (136 px) y quedan a 2 px del central, más alto, que lleva la información principal.
  - **Izquierdo**: celda VIDA con los cinco corazones (los vacíos ahora en pizarra, visibles) y celda ZONA con picota y la zona de luz real: SUPERFICIE, BOCAMINA, GALERIA o PROFUNDO.
  - **Central**: insignia octogonal dorada con el número de nivel (destella al subir), estrella, rótulo EXPERIENCIA, valor `60 / 100 XP` alineado a la derecha y barra de 148 px con canal hundido, marcas cada 10 %, relleno dorado con brillo y borde de avance. Al pasar el cursor, el detalle de experiencia aparece centrado debajo.
  - **Derecho**: DINERO (moneda, valor en dorado; desde 100 000 en miles), EPP (casco; verde completo, naranja si falta) y CARGA (caja; dorada desde el 75 %, roja llena), separados por divisores con remache. Los fragmentos recogidos vuelan al ícono de la caja.
- **Rótulos pequeños**: la fuente 3 × 5 de los avisos de XP suma letras para las etiquetas (VIDA, ZONA, DINERO, EPP, CARGA, EXPERIENCIA); los valores siguen en la fuente 5 × 7.
- **Barra rápida** (`ui/QuickbarView.ts`): bandeja propia centrada (placa con topes laterales y riel), casillas hundidas con pestaña numerada, rombo tenue en las vacías, cantidad y barra de durabilidad con contorno y brillo. La casilla activa se ve dorada con interior índigo, escuadras crema, pestaña dorada e indicador bajo ella; al pasar el cursor el borde se aclara. Casillas en la misma geometría (28 px, paso 31) a 230 px de altura, con 4 px de margen inferior; el inventario usa la misma casilla sin bandeja.
- **Otros**: la indicación `[Z] INTERACTUAR` y los íconos de modo/herramienta manual usan placas pequeñas del mismo sistema; el diálogo de Luis y los logros suben para no tocar la bandeja; la franja de estado y las alarmas empiezan bajo los módulos.
- **Clics**: solo los módulos y la bandeja bloquean el clic al mundo; los huecos entre módulos y los lados de la barra inferior siguen libres.
- **Íconos** (`ui/HudArt.ts`, atlas `hud-icons`): moneda, casco, caja, estrella y picota, originales y con la paleta.

## Sistema V8 — campamento, mundo ampliado, energía, hambre y descanso (11 de noviembre de 2026)

Ampliación de mecánicas y mundo. Lo existente (minería, bodega, carro, vías, EPP, luces, ventilación, sostenimiento, progresión, Luis) sigue igual y en las mismas coordenadas.

- **Mundo ampliado** (`config/constants.ts`): el terreno excavable pasa de 80 a 140 columnas hacia la derecha (cerro rocoso con cumbre de roca viva en las columnas 94–116, meseta en 127–133 y llanos libres para futuras instalaciones). A la izquierda de la bodega se agregan 40 columnas de campamento en x negativas (`WORLD_LEFT` = −640), así ninguna coordenada del mundo original cambia. Física y cámara cubren de −640 a 2 240 px; el parallax (`Backdrop.ts`) se extiende muestreando el mismo patrón desplazado, sin estirar texturas.
- **Geología** (`world/Geology.ts`): las 80 columnas originales se generan exactamente como antes (misma semilla, mismos yacimientos: las partidas guardadas siguen calzando). La ampliación tiene sus propios sectores de 20 columnas (carbón, hierro, cobre, oro, gemas y una caverna sellada por sector) con un flujo aleatorio aparte. Los antiguos muros de lecho de las columnas 0 y 79 pasan a ser terreno normal: no hay barrera tras la mina.
- **Suelo del campamento** (`world/CampGround.ts`): mismos estratos y macrotexturas, dibujados con una segunda `TerrainView` desplazada (continúa sin corte con la columna 0) y con colisión propia. No se excava: para la lógica, bajo la superficie a la izquierda del mundo todo es sólido e indestructible y sobre ella hay cielo abierto (`TerrainGrid.get`). La luz natural del campamento usa el mismo perfil que un suelo llano intacto (`SkyLightMap.levelAt`).
- **Campamento — sector de pabellones** (`world/structures/Camp.ts`, por piezas): pabellón de tablas verticales con tapajuntas sobre pilotes, techo a dos aguas de zinc acanalado con óxido, frontón con rejilla, puerta con riostra, dos ventanas con cortinas (de noche cambian al cuadro encendido, que no se tiñe), escalones, letrero PABELLÓN, farol amarillo, chimenea con humo animado, casco y chaqueta colgados, botas y balón de gas; camino de acceso de tierra apisonada hasta la bodega; zona de reunión con dos bancas, mesa de carrete de cable con termo y tazones y brasero con llamas animadas; tres faroles en postes, estanque de agua en torre, cajas, barriles, cactus, arbustos, rocas y letrero PABELLONES junto a la bodega. Todas las luces se registran en `Scenery.lights` (ventanas solo de noche).
- **Interior** (`ui/CabinInterior.ts`): `[Z] ENTRAR AL PABELLÓN` junto a la puerta. Pieza de 480 × 270 sobre el mundo y bajo el HUD: muro de tablas, zócalo, vigas, piso, puerta, casillero metálico con candado, gancho con casco, estufa a leña, bandera chilena, calendario, foto familiar, repisa con radio, libros y termo, alfombra, velador con lámpara (encendida de noche, con halo punteado), cama de fierro con frazada a cuadros y una ventana que muestra el cielo real (sol, luna, estrellas, cerros). El minero entra como una figura con su mismo aspecto (EPP real) y camina con A/D. Z junto a la puerta: salir; junto al casillero: estado de energía, alimentación y último descanso; junto a la cama: `[Z] DESCANSAR`.
- **Dormir**: secuencia real (no se esconde al personaje): camina a la cama, se sienta, se acuesta bajo la frazada que respira, suben «Z», fundido a negro con trama Bayer 4 × 4 en 17 niveles (alfa 0/255), cambio de hora solo con la pantalla en negro, fundido de vuelta, se sienta, se estira y queda de pie. ESC cancela antes del fundido. `DayNightCycle.skipToNextPhase`: de día despierta al comenzar la noche (5:00 del ciclo); de noche, al amanecer (0:00). El ciclo sigue normal desde ahí; cielo, astros, estrellas, tinte, faroles y ventanas leen el mismo reloj. Dormir recupera toda la energía, no toca dinero, inventario, experiencia ni estadísticas, y gasta la alimentación del tiempo dormido; con alimentación en cero no se puede dormir.
- **Energía** (`systems/SurvivalSystem.ts` + `config/survival.ts`, lógica pura con Vitest): 100 puntos = 5 unidades de 20. Picar un bloque 4, palear/recoger/cargar el carro 3, perforar un barreno 5, colocar una estructura (riel, viga, luz, ducto, ventilador, carga) 2, caminar 0,08/s, empujar el carro con carga 0,25/s, quieto 0 (25 bloques picados por descanso). Estados: descansado, buen estado, cansancio moderado, cansado, agotado y agotamiento extremo. Con una unidad o menos: postura cansada (animación `miner-tired`) y 90 % de velocidad; en cero, 80 % y `⚠ AGOTAMIENTO EXTREMO - NECESITAS DESCANSAR`; cada punto de esfuerzo sin energía quita 1 de salud (gradual, nunca muerte inmediata).
- **Alimentación**: 100 puntos = 5 unidades. Baja una unidad cada 4 min de juego y un poco más con el esfuerzo (0,2 por punto de energía gastado). Estados: alimentado, suficiente, hambre leve, moderada, intensa y desnutrición extrema. En cero: `⚠ TIENES HAMBRE - NECESITAS COMER` y, tras 20 s, 0,5 de salud por segundo hasta volver a comer. Sin energía o sin alimento la salud no se regenera sola. Al morir en Normal se reaparece con al menos 2/5 de cada una.
- **Alimentos** (`SUPPLIES` en `config/balance.ts`, categoría y pestaña ALIMENTOS Y BEBIDAS de la bodega, efectos en `FOODS`): bebida cola 5 monedas +1 energía (lata roja ficticia), sándwich de potito 12 monedas +3 alimentación, empanada de pino 8 monedas +2 alimentación. Se compran varios, ocupan una casilla por tipo, van a la barra rápida (la tecla 1–5 los come sin cambiar lo equipado) o se usan desde el inventario (USAR o doble clic). Nunca superan el máximo; si no servirían, no se gastan. Al comer o beber, el alimento sube de la mano a la boca (no bloquea controles), suena un aviso breve y aparece un texto flotante sin fondo (`+2 ALIMENTACION`). Íconos originales en `ui/SurvivalArt.ts` (atlas `v8-items`).
- **HUD**: placa bajo los corazones con dos filas alineadas a ellos: cinco rayos (energía) y cinco presas (alimentación), cada uno lleno, a medias o vacío. El que se vacía parpadea; con una unidad o menos, los restantes laten despacio. Al pasar el cursor se ve el detalle con el estado. Los avisos y la franja de estado empiezan bajo la placa. Las indicaciones del campamento muestran su texto (`[Z] ENTRAR AL PABELLÓN`, `[Z] DESCANSAR`, `[Z] SALIR DEL PABELLÓN`).
- **Guardado** (`mina-cero.save.v6`, formato 6): índices de terreno y mapa de descubrimiento con 140 columnas; bloque `v8` con energía, alimentación, tiempo de desnutrición, cantidad de descansos, último descanso (tiempo jugado, hora y fase al despertar) y si el minero está dentro del pabellón (al cargar se retoma ahí). La posición acepta x negativas. Las partidas V5 (y V2–V4 por su cadena) se migran: índices de 80 columnas convertidos, descubrimiento conservado, energía y alimentación completas y un aviso de mundo ampliado; la clave anterior se conserva.

## Corrección de iluminación — luz retro limpia (11 de noviembre de 2026)

Problema reportado: las luces generaban puntos amarillos y naranjos dispersos, como ruido; los halos eran inconsistentes y los objetos no recibían luz natural.

**Auditoría (causas reales).** No hay shaders, filtros ni modos de mezcla: la luz era una capa canvas por CPU con alfa 0/255.
1. `UndergroundDarkness.compose` traducía toda la caída de luz a 64 niveles con trama Bayer 8 × 8: cada degradado se veía como puntos.
2. La franja «fuego» de las antorchas pintaba píxeles `rust` sueltos (`(t & 3) === 0`) y una franja `ember`; el casco, otra franja punteada `umber`.
3. `LightingSystem.halos()` esparcía píxeles crema y dorados alrededor de faroles y ventanas de noche, y la pieza `halo_small` (anillo punteado) estaba pegada a los faroles de bodega, punto de venta, bocamina y campamento.
4. La capa solo podía oscurecer: de noche, al aire libre, los faroles no iluminaban nada a su alrededor.

**Solución.**
- **Cuantización** (`lighting/Quantize.ts`, puro con Vitest): la luz de cada celda de 4 px se reduce a 4 niveles (0 oscuridad, 1 ambiente azul, 2 penumbra, 3 luz plena) con umbrales `LIGHTING.quantize.thresholds` = 0,10 / 0,38 / 0,70. Bandas limpias; resolución nativa con NEAREST, sin suavizado.
- **Trama opcional**: `LIGHTING.dither` (`enabled`, `intensity` 0..1) activa una trama Bayer 4 × 4 ordenada solo en el tramo superior de cada banda. Desactivada por defecto.
- **Capa de sombra** (mezcla multiplicativa, píxeles opacos): rampa azul fría para luz natural y ambiente (`ramp.neutral`, nivel 3 = blanco: lo iluminado por el sol no cambia) y rampa ámbar donde domina una luz local (`ramp.warm`). Lo descubierto bajo tierra conserva el ambiente azul oscuro (nivel 1); lo no descubierto queda casi negro, así que las cavernas selladas no se delatan.
- **Capa de brillo** (mezcla aditiva): ámbar cuantizado (`LIGHTING.glow`) donde alumbran el casco, las antorchas, los faros y los faroles. Bajo tierra siempre; al aire libre crece con la noche y cae solo sobre terreno, estructuras (silueta real, incluido el campamento) y personajes o máquinas: no tiñe el cielo ni los cerros lejanos. Los faroles alcanzan de noche `radio × 1,7`.
- **Sombras**: cada luz sigue recortada por `transmittance` contra el terreno real (la roca bloquea; la cara expuesta recibe luz hasta 14 px).
- **Sin partículas de luz**: se retiraron `halos()`, las franjas punteadas de fuego y casco, y todas las piezas `halo_small`. La lámpara del interior del pabellón usa bandas ámbar de 4 px en vez de su anillo punteado. Se conservan el punto de la lámpara del casco y los destellos de mena (indican mineral, no son luz).
- **Rendimiento**: celdas uniformes se rellenan por bloque (sin cálculo por píxel) salvo donde hay piezas con exposición propia o brillo con máscara; la capa de sombra se oculta y no se sube cuando todo está iluminado (superficie de día) y la de brillo solo cuando hay luz local; la máscara de estructuras se reconstruye solo cuando cambian los objetos (mismo disparador que ExposureMap, con un índice de celdas con dueño).
- Excepción de paleta: multiplicar y sumar color producen tonos intermedios fuera de la paleta (como el tinte de la hora); no hay alfa parcial ni filtros.


## Logotipo «Hasta que la veta nos separe» (23 de noviembre de 2026)

El menú jugable usa un logotipo de 154 × 59 px nativos con tres líneas y alfa binario (`ui/MenuTitle.ts`). Debajo aparece el subtítulo «PARA SALVAR SU AMOR, DEBERÁ OLVIDARLO.» en la fuente bitmap. El fondo y los botones conservan su composición. Con efectos activos, un destello diagonal ilumina el filo de «LA VETA» y despierta chispas violetas y azules en los cristales (`ui/MenuTitleShine.ts`). Los ajustes de efectos reducidos y de movimiento reducido muestran el logotipo quieto.

## Fondo de portal del menú (23 de noviembre de 2026)

La ilustración activa del menú es `public/assets/ui/menu-bg-portal.png`: una bocamina de madera vieja ocupa la derecha, con rieles que desembocan en una barrera de niebla violeta y cian. Tiene herramientas abandonadas, cristales, marcas antiguas y dos fuentes de luz cálida; la mitad izquierda queda intencionalmente oscura y poco cargada para el logotipo, subtítulo, botones y placa de información. La entrada anuncia visualmente la expedición roguelike sin modificar las acciones del menú.

`MenuAmbience` reutiliza una sola capa `Graphics` y texturas opacas pequeñas: los faroles parpadean, el medallón de cobre con dos facetas unidas por una veta agrietada late como recuerdo de la persona que el minero busca salvar, los cristales laten, y el portal cambia entre tres densidades de píxeles y libera motas violetas/cian. Todo ocurre a la derecha de la columna de UI, con coordenadas enteras, sin alfa parcial ni filtros. Al desactivar efectos ambientales o pedir movimiento reducido, no se instancia esa capa.

## Rediseño del menú principal (16 de noviembre de 2026)

Esta revisión histórica mejoró la UI existente. El fondo de bocamina y portal vigente se documenta arriba; la nitidez (fondo, botones, título y ambiente) se corrigió después. Todo respeta las reglas de pixel art del proyecto: sin alfa parcial, blur ni interpolación.

- **Título** (`ui/MenuTitle.ts`, tipografía pura en `ui/TitleFont.ts` con Vitest):
  - Letras talladas de 18 × 22 px sobre la rejilla de 1 px del juego, con trazo de 5 px y esquinas recortadas, como piezas cortadas en roca. Cara dorada en dos tonos de lingote, luz arriba a la izquierda, relieve rojizo de 3 px y contorno de tinta.
  - Mide 138 px y queda alineado con la columna de botones (144). Sin halo de puntos sueltos.
  - Aparece letra por letra: cada una cae 6 px en escalones enteros. Luego se escribe «TODO EMPIEZA BAJO TIERRA.», se dibuja el filete y un destello cruza la cara de las letras; el destello se repite cada 8 s. Con efectos reducidos aparece completo y quieto.
- **Botones** (`ui/MenuButton.ts`, comunes al menú, la pausa, la muerte y los diálogos):
  - Cuerpo oscuro sólido, marco metálico de 1 px con esquinas recortadas y un solo filete de luz; sin sombra ni remaches sueltos.
  - Al seleccionarlos: cuerpo de pizarra, borde dorado, piqueta y destello.
  - Al confirmar con teclado el botón se hunde 1 px durante 120 ms, como con el clic.
- **Descripción contextual**: el panel fijo bajo SALIR desaparece. La misma placa aparece solo 3,2 s después de navegar con teclado o cursor, y se oculta sola. Para Continuar muestra la mina guardada. La ayuda de teclas del pie usa la fuente pequeña.
- **Ambiente** (`ui/MenuAmbience.ts`), además del humo, los halos de faroles y ventanas, las brasas, las luciérnagas, los destellos, y las estrellas que ya había:
  - el brillo de cada cristal late cambiando de radio a saltos;
  - la boca del túnel «respira» entre tres densidades de puntos violetas y de ella salen motas violetas y cian;
  - vetas finas de nubes de ocaso cruzan despacio el cielo, detrás del título.
- **Profundidad**:
  - El puntero corre las partículas hasta 2 px y las nubes 1 px. La ilustración no se mueve.
  - Sin mover el puntero, las capas derivan solas muy despacio.
  - Con «Efectos ambientales: reducidos» (o el movimiento reducido del sistema) no hay ambiente ni parallax.
- **Sonido** (`MENU_FX` en `config/menu.ts`):
  - Navegar, confirmar y volver tienen sonidos propios y originales. Un mismo sonido no se repite antes de 70 ms, y confirmar o volver cortan el tic de navegar.
  - Bajo la música queda el viento de galería de la introducción a volumen 0,12; si viene de la introducción, solo baja a ese volumen.
  - La música mantiene su entrada progresiva. Todo respeta el silencio de Configuración.
- **Transiciones**:
  - Nueva partida y Continuar: sonido de confirmación, fundido tramado a negro en 0,48 s mientras se apagan la música y el viento, y la partida a ventana completa.
  - Configuración usa el mismo marco y los mismos botones.
  - Salir pide confirmación; si el navegador no deja cerrar la pestaña, un aviso de dos líneas.

## Nitidez del pixel art (16 de noviembre de 2026)

**Diagnóstico.** Se midió en capturas en píxeles físicos (`tests/pixel-integrity.spec.ts`), con DPR de 1 a 2 y ventanas de 960 × 540 a 1920 × 1080. Lo que se descartó y lo que sí era:

- **El escalado del lienzo era correcto.** El lienzo lógico es de 480 × 270, `image-rendering: pixelated` está activo, las texturas son NEAREST (`pixelArt` y `roundPixels`) y en todos los casos cada píxel del juego se pinta como un bloque uniforme de un factor entero de píxeles físicos (0 bloques irregulares). Ni el CSS ni el motor ni el DPR producían borrosidad.
- **Causa principal: el fondo del menú no era pixel art.** La ilustración (1672 × 941) es una pintura de 612 000 colores. Se reducía por promedio y quedaba con ~100 000 colores en 480 × 270 píxeles y el 57 % de sus bordes suavizados: una imagen blanda junto a una interfaz de colores planos. El logo del estudio tenía el mismo defecto (74 392 colores).
- **Píxeles «gruesos»:** cada píxel del título era una celda de 3 × 3 px, tres veces más gruesa que la de la ilustración, los botones y el texto.
- **Ruido de tramas:** el cuerpo de los botones (3 de 4 píxeles tramados), el damero de los halos y de los cristales, y las bandas de niebla del menú eran tramas de densidad alta; sobre una ilustración nítida se leían como ruido. La sombra de 1 px de los rótulos duplicaba el trazo de las letras de los botones.
- **Una pérdida de escalón por una fracción de píxel:** un monitor de 1920 × 1080 al 175 % ofrece 617 px CSS de alto, o sea 1079,75 px físicos. A 4× faltaban 0,25 px y el juego bajaba a 3×, usando el 75 % de la pantalla.

**Correcciones.**

- **Fondo y logo** (`scripts/art/pixelate.mjs`, `build-menu-bg.mjs`, `build-studio-logo.mjs`, sin dependencias): reducción por promedio de áreas, realce de bordes, paleta limitada sin tramado (corte por medianas más k-means) y limpieza de píxeles sueltos. El fondo queda con 112 colores y el logo con 56 (una paleta común a los siete cuadros del zoom). La composición no cambia y los degradados del cielo quedan en bandas, como en el pixel art. Medido en la captura del menú a 1920 × 1080: de 86 707 a 135 colores; la partida no cambia (178).
- **Título** (`ui/TitleFont.ts`): redibujado sobre la rejilla de 1 px, letras de 18 × 22 px con trazo de 5 px.
- **Botones** (`ui/MenuButton.ts`): cuerpo sólido, un solo marco de 1 px con esquinas recortadas, sin sombra ni remaches. El rótulo ya no lleva sombra sobre el panel (`ShadowText` con `shadow` en falso). El gris de «Continuar» desactivado se lee.
- **Ambiente** (`ui/MenuAmbience.ts`): se quitan las bandas de niebla (la ilustración ya trae su bruma), los halos pasan a un destello compacto de puntos sueltos y los brillos de cristales y los velos de diálogo y pausa usan un píxel de cada cuatro.
- **Tipografía** (`ui/PixelFont.ts`): la Ñ tenía solo cinco filas de letra y se veía achatada; ahora usa seis, como las vocales con tilde.
- **Escalado** (`systems/IntegerZoom.ts`): en modo inmersivo se admite hasta un píxel del juego de holgura al elegir el escalón. Con eso, 1920 × 1080 al 175 % usa 4× y el borde inferior se recorta en 0,25 px (invisible); el contenedor pasa a `overflow: hidden` para no ofrecer un desplazamiento por esa fracción (`overflowsSlightly`). Una diferencia mayor que un píxel del juego sigue bajando de escalón.

**No se cambió.** La oscuridad del subsuelo usa celdas de luz de 4 × 4 px (`LIGHTING.cell`), un parámetro de diseño documentado y sin suavizado; reducirla a 2 × 2 afinaría el borde de la sombra pero multiplicaría por cuatro el costo por fotograma, y queda como mejora posible.

**Cómo regenerar.** `npm run art:menu-bg` y `npm run art:studio-logo` (originales en `.tools/asset-downloads/`, ignorado por Git). `scripts/art/inspect-png.mjs` mide colores y bordes blandos de cualquier PNG; `scripts/art/compare-captures.mjs` compara las capturas de `docs/screenshots/pixel-before-*` y `pixel-after-*`.

## Modo inmersivo, pantalla completa y pausa (16 de noviembre de 2026)

**Solo el juego.** La clase `immersive` del `body` (`main.ts`, `style.css`) oculta la página web durante el menú y la partida: cabecera DEEPKIN, «EXPEDICIÓN 001», «TU PRIMER TÚNEL», rótulos, pies y el botón «Volver a superficie». La función de ese botón sigue en la tecla R. El estado accesible (`#game-status`) queda oculto a la vista, pero lo siguen leyendo los lectores de pantalla. La vista cenital de desarrollo (`?view=top-down`) conserva la página, porque su botón es la salida de esa vista.

**Ventana completa.** En la partida el lienzo se centra y usa la mayor escala entera que cabe en la ventana (`GAME_MAX_SCALE` = 12, en píxeles físicos con `systems/IntegerZoom.ts`), con fondo negro alrededor. La resolución lógica sigue en 480 × 270 con nearest-neighbor: si la ventana no es 16:9 sobran bandas negras, nunca se estira ni se recorta. No hay barras de desplazamiento salvo en ventanas de menos de 480 px, donde se conserva 1× con desplazamiento en vez de reducir la imagen. El menú no cambia: mismo fondo y tope `MENU_MAX_SCALE`.

**Pantalla completa** (`systems/DisplayMode.ts`, con Vitest). F11 pide o cierra la pantalla completa de la aplicación (Fullscreen API) cuando el navegador entrega la tecla. Si el navegador ya está en su propia pantalla completa, o no hay API, F11 se deja pasar sin tocarla. Cualquier cambio (F11, Esc del navegador, opción del juego) solo vuelve a calcular la escala: la escena sigue igual y no se recarga la partida. Configuración del menú y de la pausa tienen la opción «PANTALLA COMPLETA», que muestra el estado (SÍ, NO, NAVEGADOR (F11) o NO DISPONIBLE) y avisa si el navegador la rechaza.

**Pausa** (`scenes/PauseScene.ts`). Esc en la mina abre la pausa solo si no hay nada que cerrar o cancelar antes (inventario, celular, bodega, refrigerador, caja del dron, ayuda, diálogos, libro, confirmaciones, modo desmontar, construcción o descanso); en ese caso Esc hace lo de siempre. La mina se detiene (mundo, reloj y física quietos) y la pausa atrapa el teclado, como la pantalla de muerte. Opciones:
- REANUDAR;
- CONFIGURACIÓN: sonido, que es el mismo ajuste del menú, y pantalla completa;
- GUARDAR PARTIDA, desactivada sin modalidad elegida o con la expedición terminada;
- MENÚ PRINCIPAL, que guarda antes de salir; «Continuar» retoma la partida.

Al reanudar se sueltan las teclas que quedaron presionadas. Velo de damero de tinta y marco industrial, sin alfa parcial.

## Introducción del estudio (16 de noviembre de 2026)

Al abrir el juego, antes del menú, corre `StudioIntroScene` (primera escena cuando hay menú). Todo se configura en `config/splash.ts` (`SPLASH`): duraciones de aparición, permanencia y desaparición, sonidos, volúmenes, orden de etapas y logotipos adicionales. La secuencia la arma la lógica pura `systems/SplashTimeline.ts` (Vitest) y la escena solo dibuja lo que corresponde al tiempo transcurrido, así no depende de los FPS.

1. **Apertura**: negro (tinta de la paleta), pausa de 0,5 s y «DESARROLLADO POR» en la fuente 5 × 7 espaciada, con filetes dorados; aparece en 0,9 s, queda 0,9 s y se va en 0,7 s.
2. **THE MINERS CL**: el emblema aportado por el estudio (`public/assets/ui/studio-logo.png`, generado por `npm run art:studio-logo` desde el PNG original con su transparencia). Aparece en 1 s, queda 2,5 s y se va en 1 s. El zoom lento recorre siete cuadros de 200 a 212 px (2 px por paso): crece en píxeles enteros, sin escalar fraccionariamente ni deformar. Detrás, un resplandor ámbar muy tenue de píxeles sueltos. El golpe de picota (`intro-impact.wav`) suena en el paso en que empieza la primera trama del logotipo.
3. **Colaboradores y patrocinadores**: lista `SPLASH.sponsors`, vacía. Sin entradas, la etapa no existe. Solo se añaden marcas reales con permiso para mostrarlas; cada una lleva su PNG (`preload: false`), tiempos y un sonido (por defecto `intro-chime.wav`).
4. **Transición**: negro con viento de desierto y galería (`intro-ambience.wav`, en bucle). En el menú, el fondo se revela tramado desde el negro (1,4 s), el título aparece letra por letra con su subtítulo y destello (ver «Rediseño del menú principal»), los botones se deslizan uno a uno y la música sube de 0 a su volumen en 2 s mientras el ambiente se apaga en 3 s.

**Fundidos.** Ninguno usa alfa parcial: `ui/DitherCover.ts` tapa con una trama de 64 niveles (baldosa `cover` de `world/Dissolve.ts`, cada nivel conserva los píxeles del anterior). Es la misma regla de los cruces de bioma.

**Omitir.** Esc, Espacio, clic o toque, en cualquier fase. Se detienen los sonidos de la introducción, no se lanza nada pendiente, la pantalla funde a negro en 0,25 s y el menú entra en 0,4 s con la música subiendo en 0,9 s. Durante la entrada del menú, una tecla o un clic la completan sin activar botones. Las pulsaciones de los primeros 0,3 s no omiten, para que la misma tecla que habilita el sonido no salte la introducción.

**Audio bloqueado.** Si el navegador aún no deja sonar audio, antes de empezar aparece «PULSA UNA TECLA O HAZ CLIC / PARA EMPEZAR CON SONIDO» (Esc va directo al menú). El silencio de Configuración (`sound.mute`) vale también para la introducción.

**Carga.** La escena carga solo sus recursos (logo y tres WAV). Mientras corre, carga en segundo plano el resto del juego y la música del menú; si al terminar aún no acabó, muestra una barra de avance discreta y espera.

**Cuándo.** En cada inicio del juego con menú. En desarrollo, un navegador automatizado la salta (`?splash=on` / `?splash=off` la fuerzan), igual que el menú. Volver al menú desde la pantalla de muerte usa la entrada de persianas de siempre. No toca partidas guardadas, ajustes ni mecánicas.

## Menú principal (11 de noviembre de 2026)

El juego arranca en `MenuScene` (primera escena de `main.ts`). Solo cambia lo que ve el jugador antes de entrar: ninguna regla de la mina, del mapa ni de los personajes se tocó.

**Atmósfera.** Minería rural, misteriosa y fantástica: ocaso violeta, pabellón con luz cálida, bocamina con cristales y vagoneta. El fondo es la ilustración aportada por el usuario, convertida a pixel art de 480 × 270 (`scripts/art/build-menu-bg.mjs`, con 112 colores; ver «Nitidez del pixel art») para que un píxel del menú sea un píxel del juego. Esa ilustración tiene su propia gama de colores y queda fuera de la paleta de 49 colores; todo lo dibujado encima (título, botones, marcos, efectos) usa la paleta del juego.

**Disposición.** Título «MINA CERO» (fuente 5 × 7 a 3×, contorno de tinta, extrusión ámbar) y subtítulo a la izquierda sobre el cielo; cuatro botones en columna (`MENU_LAYOUT` en `config/menu.ts`); placa inferior con la partida guardada o la descripción del botón elegido; ayuda de teclas abajo.

**Botones** (`ui/MenuButton.ts`). Estados normal, seleccionado y desactivado. Al seleccionar (cursor o teclado): se desliza 4 px a la derecha en 150 ms (Cubic.easeOut), el borde pasa a dorado, el rótulo cede lugar a una piqueta que sube y baja 1 px, un destello blanco recorre el bisel y el texto se vuelve dorado. Al pulsar baja 1 px. Continuar sin partida válida queda en gris, legible, y no se puede elegir. Todo en píxeles enteros, sin alfa parcial.

**Ambiente** (`ui/MenuAmbience.ts`, opcional). Tres velos de niebla tramada (Bayer 4 × 4) que se desplazan en píxeles enteros; 22 brasas que suben de farolas, ventanas y chimenea; 6 luciérnagas junto al pasto; humo de la chimenea con disolución en damero; halos de damero en 4 farolas y 2 ventanas con parpadeo de ±1 px de radio; destellos de 9 cristales; pulso de 3 hongos; estrellas que titilan y una estrella fugaz cada 9–16 s. Costo: 3 TileSprites, 6 imágenes de halo estáticas y un solo Graphics con menos de 150 rectángulos por fotograma. Se apaga en Configuración y arranca apagado si el sistema pide menos movimiento (`prefers-reduced-motion`).

**Música (16 de noviembre de 2026).** La pantalla de inicio suena con «Carta de Descoberta», MP3 aportado por el usuario (`public/assets/audio/menu-theme.mp3`, recurso `music-menu` con `preload: false`). `MenuScene` la carga en segundo plano al abrirse (no alarga la barra de carga), la reproduce en bucle a volumen 0,5 (`MENU_MUSIC` en `config/menu.ts`) y, si el navegador aún bloquea el audio, empieza con el primer clic o tecla. Al entrar a la partida baja a cero en 600 ms y se detiene al cerrar el menú; la mina no tiene música. «Sonido» en Configuración la silencia junto con los efectos. Si el archivo no carga, el menú funciona igual sin música.

**Navegación.** Flechas o W/S/A/D mueven la selección saltando los botones desactivados; Enter, Espacio o Z aceptan; Esc o Retroceso cierran un diálogo. El cursor selecciona al pasar y activa al soltar dentro del botón. Los diálogos oscurecen el menú con un píxel de tinta de cada cuatro (no una veladura).

**Conexión con los sistemas existentes.**

| Botón | Qué hace |
| --- | --- |
| Nueva partida | Sin guardado: entra a `MiningScene` con `pendingNew`, que muestra nombre y modalidad. Con guardado (válido o ilegible): pide confirmación, copia la partida en `mina-cero.archive.<ts>` y recién entonces empieza; si el navegador no puede copiarla, no cambia nada. La partida anterior solo se reemplaza cuando la nueva guarda por primera vez. |
| Continuar partida | Activo solo si el guardado existe y pasa `decodeSave` (misma validación y migración V2–V6 de siempre). Muestra nombre, nivel, modalidad y tiempo de juego. Un Hardcore terminado abre su resumen final. |
| Configuración | Sonido (silencia todo el juego) y efectos ambientales del menú, guardados en `mina-cero.menu`; lista de controles leída de `loadControls()`. |
| Salir | Confirma y llama a `window.close()`. |

**No disponible todavía (y así se muestra, no se simula).**
- Reasignar teclas: no hay pantalla; los controles solo se cambian con el JSON de `mina-cero.controls`.
- Volumen, música, idioma o calidad gráfica: no existen.
- Volver al menú desde la partida: no hay botón ni tecla; hoy se hace recargando la página.
- Salir: un navegador solo deja cerrar pestañas abiertas por script. Si no se cierra, el menú lo avisa y pide cerrarla con Ctrl+W; el progreso ya está guardado.
- El sonido elegido en el menú se recuerda, pero la tecla M dentro de la partida solo lo cambia en esa sesión.

**Adaptación a la ventana.** El menú oculta el marco de la página (`body.in-menu`) y centra el lienzo con escala entera: 1× a `MENU_MAX_SCALE` = 5× (el juego conserva su límite de 3×). Por debajo de 480 px de ancho se mantiene 1× dentro de un contenedor desplazable. Toda la composición está en coordenadas nativas, así que escala sin deformarse.

**Arranque en pruebas.** En desarrollo, un navegador automatizado (`navigator.webdriver`) entra directo a la mina para no alterar las pruebas e2e previas; `?menu=on` fuerza el menú y `?menu=off` lo omite. En producción el menú siempre aparece.


## Primera secuencia: «La herencia del abuelo» (11 de noviembre de 2026)

Una secuencia corta que enseña lo que ya existe sin sustituirlo: el mapa, el minero, el inventario, las físicas, la bodega, la mina y el guardado son los de siempre. No hay enemigos ni biomas nuevos.

**Flujo.** Nueva partida → nombre y modalidad (pantalla de siempre) → el juego empieza **dentro de la cabaña del abuelo** (el interior del pabellón del campamento).

| Paso | Qué pasa | Cómo avanza |
| --- | --- | --- |
| `welcome` | Diálogo de 4 páginas: la cabaña vacía, la carta del abuelo, la herencia de la mina | E / Enter / clic; Esc lo omite |
| `tools` | Guía: «busca la picota y la pala en la bodega» | E sobre el cajón de herramientas de la bodega: entrega una picota de hierro y una pala básica (la picota queda equipada). También avanza sola si el jugador ya tiene ambas |
| `kit` | Guía: «reclama tu kit de seguridad» | El kit gratuito del bodeguero (sistema de siempre); avanza al tener el EPP completo |
| `mine` | Guía: «inspecciona la entrada de la mina» | E en la boca del túnel (gana a la pila de material suelto cercana) |
| `dig` | Guía: «entra y excava un bloque» | Una extracción real: `stats.mined` supera el valor del momento de inspeccionar |
| `home` | Guía: «vuelve a la cabaña» | Entrar a la cabaña por la puerta (E) |
| `board` | La tabla cruje y se suelta (diálogo de 2 páginas); un destello y un saltito la delatan | E sobre la tabla |
| `book` | Aparece el libro bajo la tabla (diálogo breve) y se abre su primera página | Leerla y cerrar |
| `done` | Aviso «El libro del abuelo»; la tabla queda abierta y el libro se puede releer con E | — |

**Libro.** Primera página del diario: la mina ya es del jugador; el abuelo creyó conocerla (carbón, hierro, cobre, oro), pero «hay minerales que no figuran en ningún catálogo, brillan sin luz y tibian la mano»; pide no venderlos ni nombrarlos. Las siguientes páginas «están pegadas por la humedad»: es una insinuación, no una mecánica; no se añadió ningún mineral nuevo (el mineral desconocido de V3 sigue como estaba).

**No invasivo.**
- Una sola línea de objetivo bajo la barra superior y una flecha dorada que rebota sobre el lugar de interés (mundo y cabaña). **T** oculta o muestra la guía y se recuerda en el guardado. Los diálogos siguen apareciendo.
- Diálogos de una a cuatro páginas, texto que se escribe de a poco, panel que sube 10 px y flecha parpadeante. **Esc omite** lo que queda; el paso avanza igual. E o el clic completan la línea y luego pasan de página.
- Mientras hay diálogo o libro abiertos la figura no se mueve y el entorno (reloj del día, luz de la linterna) se pausa, como con los demás menús. E se ignora 250 ms tras cerrar un diálogo para que la misma pulsación no active lo que hay debajo.
- Sin la secuencia, nada cambia: una partida guardada anterior, o una partida en el navegador automatizado de las pruebas, queda en `done` y sin tabla.

**Tecla E.** E es ahora la tecla de interactuar (HUD, menús e indicaciones muestran `[E]`); Z sigue funcionando como alias. En la cabaña se puede caminar con A/D e interactuar con puerta, casillero, calendario, estufa, ventana, repisa y cama (cada objeto da una frase breve). El rango de la repisa (x = 310 ± 12) acota el de la cama, que ahora empieza en x ≈ 323 en vez de 302.

**Guardado.** El campo `intro` de la partida V6 (`step`, `minedBase`, `hintsOff`, `completed`) no sube la versión: las partidas anteriores lo ignoran y las que no lo traen se leen como «sin secuencia». Recargar a mitad de secuencia la retoma; si se recarga durante el diálogo inicial, vuelve a mostrarse. Código: `systems/IntroProgress.ts` (puro, con Vitest), `config/intro.ts` (textos), `ui/DialogBox.ts`, `ui/BookView.ts`, `ui/IntroGuide.ts`, y la cabaña en `ui/CabinInterior.ts` (objetos, tabla, hueco y libro).

**Arranque en pruebas.** Como el menú, en desarrollo un navegador automatizado no inicia la secuencia; `?intro=on` / `?intro=off` lo fuerzan. En producción siempre está activa en las partidas nuevas.


## Exploración subterránea, fase 1 — cavernas y cristal violeta (11 de noviembre de 2026)

Primera fase de exploración bajo tierra, lista para sumar enemigos más adelante (no hay ninguno). No cambia el menú ni la introducción, y ningún sistema existente se reemplazó.

**Geología rev. 2.** `createInitialTerrain(seed, rev)`: la rev. 1 es el mundo de siempre, sin un solo bloque distinto; la rev. 2 le añade la red de cavernas con un flujo aleatorio propio (`world/Caves.ts`, puro y determinista, con Vitest sobre 31 semillas). La partida guarda `worldRev`; las que no lo traen (anteriores a V10) se cargan con la rev. 2 en producción, porque sus diferencias de terreno son solo aire o escombro: **conservan todo lo excavado y ganan las cavernas**. En desarrollo, un navegador automatizado conserva la rev. 1 (como el menú y la introducción); `?world=2` / `?world=1` lo fuerzan.

**Cavernas.** Una red que nace en el muro del fondo de la galería de la bocamina (columna 26, filas 8–9, sin tocar la galería ni los rieles): salas ancha, alta, redonda, en L y nichos, unidas por pasadizos de 2 × 2 (cabe el minero; los desniveles son de un bloque). Ninguna celda queda a más de 34 pasos de la boca. El aire es respirable sin ventilador: unas **corrientes naturales** (`grid.vents`, fisuras demasiado finas para pasar) le dan aire fresco a las salas lejanas y a la cámara secreta (`VentilationSystem` las trata como otra fuente; el resto del sistema no cambió). Las cavernas naturales no cuentan como galerías trabajadas, así que no hay derrumbes por sus techos.

**Minerales.** Cobre y hierro a la vista en las paredes (hierro arriba, cobre abajo) y **cristal violeta** (`Block.Crystal`, `violet_crystal`, pico 1, $35, +20 XP): una mena más del inventario, con su ícono, su aviso «NUEVO MINERAL» y su aporte a la carga y al carro. Racimos en cada sala, tres junto al sello de la cámara secreta (la pista) y una geoda de cristales encerrada en roca dura. Va al final de `MINERALS` para no mover el índice de ninguna otra mena.

**Rocas resistentes.** La roca dura existente (requiere picota de tungsteno, 1,4 × de tiempo): bolsillos en las paredes profundas, la cubierta de la geoda y el sello de la cámara. Con la picota de hierro el trabajo ni empieza (aviso de `toolProblem`).

**Luz y ambiente.**
- *Oscuridad progresiva:* el ambiente azul de lo descubierto se oscurece por franjas de 4 filas desde la fila 14, de azul marino a casi negro (`LIGHTING.depthAmbient`, `lighting/DepthAmbient.ts`), con el haz del casco y la batería de siempre. Vale también para el mundo original.
- *Cristales:* cada cristal descubierto con aire a su lado alumbra 34 px a la redonda (recortado por la roca) y **tiñe de violeta** lo que toca (rampa y brillo violeta en `UndergroundDarkness`); al revelar sus vecinos ayuda a explorar. Solo brillan los ya descubiertos: un cristal tras la roca no delata la caverna.
- *Partículas sutiles* (`ui/CrystalMotes.ts`): motas de 1 px que suben y titilan junto a cada cristal descubierto; un solo Graphics, a lo sumo 36 rectángulos por fotograma y solo en la vista. Opacas y de la paleta.

**Cámara secreta.** Un pasadizo ciego termina en un sello de roca dura de dos bloques, con destellos violeta en las paredes que lo anuncian; detrás, una cámara mínima sellada con la **página arrancada del abuelo** (E sobre ella: 3 páginas de diálogo omitibles). La pista, ligada al libro de la cabaña: el diario habla de minerales «que tibian la mano» y de páginas pegadas; esta hoja es la «página 2»: el cristal violeta *responde* a la roca dura y el abuelo selló la cámara por eso («sigue la luz violeta hacia el fondo, pero no bajes con la linterna vacía»). Leerla se guarda (`explore.pageRead`) y da un hallazgo. No hay mecánica nueva detrás de la pista.

**Guardado.** Campos nuevos de la partida V6, sin subir la versión: `worldRev` (las diferencias del terreno son contra esa geología) y `explore` (`pageRead`).

**Límites.** Sin enemigos, ni biomas nuevos, ni más minerales que el cristal. El cristal se vende a $35 con el resto de la carga (el diario dice «no los vendas»: es solo texto). Las partículas y la luz violeta de los cristales no cuentan como destello de mena de la lámpara.

## Corrección visual previa a la migración (11 de noviembre de 2026)

Solo corrige errores de dibujo; no cambia reglas, colisiones, menú ni narrativa. Detalle de la auditoría en docs/QA_REPORT.md.

- **Cuadros verdes con diagonal.** Son la textura `__MISSING` de Phaser, no cajas de colisión: la depuración de Arcade está apagada (`debug: false`) y los cuerpos siguen activos. Aparecían cuando un PNG (`props`, `torch`, `miner`…) no llegaba durante la carga —servidor de desarrollo reiniciado o caído— y la escena construía el mundo igual. Ahora `MiningScene.create` revisa `missingAssets()` antes de construir nada: hasta tres reintentos con espera creciente y, si siguen faltando, un aviso en el lienzo, en `#game-status` y en la consola con las claves que faltan. Nunca se juega con texturas de reemplazo.
- **Superficie cortada a negro.** La luz del día solo mostraba un bloque de suelo y debajo el cerro era negro: un corte duro entre la arena y el subsuelo. `SkyLightMap` calcula un segundo mapa solo para dibujar (`soft`, `LIGHTING.sky.softStep` = 5) donde la luz baja unos tres bloques en franjas (plena, penumbra, ambiente). El descubrimiento de bloques, las zonas y la lámpara siguen usando el mapa estricto: la penumbra no revela menas ocultas.
- **Afloramientos azules en el desierto.** Las rocas de la superficie (`isOutcrop`) usaban la roca gris azulada del subsuelo y se leían como bloques ajenos sobre la arena. Tienen su material visual `outcrop` (arenisca rojiza con la paleta del desierto) en `TerrainVisuals`/`TerrainArt`. El bloque sigue siendo `Block.Rock`: misma dureza y colisión.
- **Nitidez con escala de Windows.** Con 125 % y zoom 2× cada píxel del juego medía 2,5 píxeles físicos y el vecino más próximo alternaba columnas de 2 y 3. `systems/IntegerZoom.ts` elige un múltiplo entero de píxeles físicos y lo convierte a CSS; con `devicePixelRatio` 1 el resultado es el de siempre.


## Sistema V11 — recolección, construcción y tala (11 de noviembre de 2026)

Ampliación explícita: el jugador modifica el terreno a voluntad (excava, recoge, coloca y desarma bloques) y tala árboles. No cambia la historia ni el menú; no hay recetas de fabricación ni más materiales que tierra, piedra y madera. Código en `config/buildMaterials.ts`, `systems/BlockPlacement.ts`, `world/Trees.ts`, `world/TreeView.ts` y `GameSession` (`placed`, `trees`, `placeBlock`, `addMaterial`).

**Materiales.** Tres suministros apilables (`mat_dirt`, `mat_stone`, `mat_wood`, categoría MATERIALES, máximo 999 cada uno): ocupan casilla del inventario como cualquier suministro y, al juntarse por primera vez, se asignan solos a la primera casilla libre de la barra rápida (que conserva su lugar aun en cero). Cada uno se liga a un bloque (`Block.Dirt`, `Block.Rock`, `Block.Wood`, este último nuevo y con su tile en `TerrainArt`). Para añadir un material: entrada en `SUPPLIES`, otra en `BUILD_MATERIALS`, su bloque, tile e ícono.

**Cambio de economía (deliberado).** La tierra, la piedra (también roca dura y escombro) y la madera ya no ocupan la carga minera (50 kg) ni se venden: se apilan como material de construcción. Las menas y el cristal siguen yendo a la carga y a la venta; la pila suelta de tierra inicial y el carro funcionan igual. Así «excavar 10 bloques y recuperarlos» es posible sin vaciar la carga.

**Colocar (clic derecho).** Elegir un material con su tecla (1–9) o con Q; el clic derecho coloca un bloque en la celda apuntada y consume exactamente una unidad. Reglas (`placementProblem`, lógica pura con Vitest): dentro del mundo; alcance de 3 bloques (48 px, `BUILD_REACH`); celda vacía; apoyo en al menos un bloque vecino (suelo o construcción) para no dejar bloques flotando; sin objetos instalados (rieles, luces, vigas, ductos, cargas), sin árbol en pie, sin pilas sueltas y sin ninguna entidad encima (minero, bodeguero, Luis, carro). **Sin zonas protegidas** (se quitaron a pedido del usuario): se construye donde sea, también junto a la bodega o en la boca de la mina (se puede incluso tapar la galería; excavar los soportes de vía y la bodega sigue regulado por `protected()`). Un bloque colocado sobre un cactus o arbusto lo arranca (decoración anclada). Colocar cuesta 1 punto de energía.

**Vista previa.** La celda apuntada muestra un tablero de píxeles del color del material con borde verde si cabe o rojo si no (y el motivo en la línea de acción). Es la forma de dar translucidez sin alfa parcial, que la dirección artística prohíbe.

**Desarmar (clic izquierdo).** Un bloque colocado se retira en el 25 % del tiempo (`BLOCK_WORK.placed`), sin desgastar la herramienta, sin experiencia y sin sumar a las estadísticas: colocar y retirar en bucle no genera material ni XP. La roca colocada exige picota; la tierra, pala o picota; la madera, cualquier herramienta (hacha incluida). Se mantiene la herramienta en mano al elegir un bloque: clic izquierdo rompe con ella y clic derecho coloca el bloque; el HUD marca la herramienta (placa inferior derecha) y rotula 1,6 s el objeto elegido.

**Hacha y árboles.** Hacha básica en la bodega ($8, etapa 1, 60 usos, categoría HERRAMIENTAS): solo corta madera y árboles (usa la hoja del pico del minero, sin arte propio todavía). Siete algarrobos provisionales sobre terreno llano de la superficie (columnas 48, 56, 62, 70, 78, 87 y 122; `TREE_COLUMNS`). Mantener el clic sobre un árbol, con el hacha en mano y a ≤ 44 px, da un hachazo cada 420 ms (1 punto de energía y 1 de desgaste cada uno); con 6 hachazos el árbol se sacude, cae hacia el lado opuesto en 480 ms, deja un tocón y rinde 8 madera (+XP una sola vez). Un árbol talado no vuelve a dar madera ni reaparece; si se excava su suelo desaparece sin madera.

**Controles.** 1–9 eligen casilla (la barra rápida pasa de 5 a 9; en el inventario se dibuja compacta). Conflicto resuelto: **F** ahora enciende y apaga la linterna del casco (antes L, que sigue como alias) y el guardado manual pasa de F a **G** (el guardado automático no cambia). E interactúa como siempre.

**Guardado.** Campo nuevo `build` de la partida V6, sin subir la versión: `placed` (índices de los bloques del jugador) y `felled` (árboles talados). El terreno colocado viaja en `terrain` (diferencias contra la geología); al cargar solo se aceptan tierra, roca o madera declaradas en `placed` —nunca menas— y una partida anterior carga sin `build`. La posición del jugador se restaura aun junto a lo construido (si el cuerpo queda unos píxeles dentro de un bloque, por ejemplo sobre un techo recién colocado, sube al primer lugar libre en vez de reaparecer en la entrada).

**Límites.** Sin recetas, sin más materiales, sin regeneración de árboles (la madera total es finita: 7 × 8), sin arte definitivo del árbol ni del hacha. Las estructuras construidas bajo tierra se evalúan como cualquier techo (`GeotechnicalSystem`): una cámara techada con bloques sin vigas puede entrar en vigilancia.

## Carga por peso (11 de noviembre de 2026)

Sustituye la carga por bloques de V2 (4 encima, 20 en el carro) por una carga **por peso en kg**: `BALANCE.personalCapacity` = 50 kg encima del minero y `BALANCE.cartCapacity` = 100 kg en el carro. Cada bloque pesa ≈ 1 kg (`MATERIAL_KG`, una tabla por material, hoy todas en 1; cambiarla basta para que un material pese distinto). `InventorySystem` calcula `weight`, `fits(item)` y `full` por peso, y `transferTo` mueve bloques mientras quepan. Con los pesos actuales cada bloque sigue siendo una entrada de la lista (venta, pilas y desarmado funcionan igual).

Interfaz: el módulo CARGA del HUD muestra `kg/50`; el inventario muestra hasta cuatro pilas por material (ícono y cantidad), la barra de peso (verde, ámbar al 75 %, roja llena) y «CARGA n/50 KG»; el montículo del carro crece con el peso; los avisos dicen «CARGA LLENA - 50/50 KG» y «CARRITO LLENO - 100/100 KG». El guardado acepta hasta 50 kg encima y 100 kg en el carro, así que las partidas anteriores (≤ 4 y ≤ 20 bloques) cargan sin cambios, y una partida con más peso que la capacidad se rechaza como corrupta.

Los materiales de construcción (tierra, piedra, madera de V11) siguen apilándose aparte, sin pesar en esta carga: no se acordó que pesen.

## Luz del casco radial, tipo antorcha en la mano (11 de noviembre de 2026)

La linterna direccional de V9 (haz hacia delante, nada detrás) se sustituye por un resplandor **radial** como el de una antorcha en la mano en Terraria: redondo, igual hacia todos lados y sin depender de hacia dónde mira el minero. `HeadlampLight.light` usa `radialFalloff`: luz plena a ≤ 1 bloque de la lámpara y decaimiento hasta 0 a 6,5 bloques (`LIGHTING.headlamp.radial`: `coreTiles` 1, `radiusTiles` 6,5, `curve` 1,3). La oclusión no cambia: `LightingSystem.lampPass` sigue cortando la luz contra `TerrainGrid` (la cara del muro se ve, el bloque de detrás no), de modo que la luz se recorta contra paredes y techos y se abre al excavar. Con la cuantización de 4 niveles y la capa ámbar aditiva se ve como anillos concéntricos limpios, sin trama ni alfa parcial.

Sin cambios: interruptor (F; L de alias), batería, encendido automático al dejar la luz del día, destellos de mena (ahora alrededor del minero), antorchas y faroles. Para ajustar el aspecto basta `LIGHTING.headlamp.radial` (radio, núcleo y curvatura).

## Protagonista «azulito» (11 de noviembre de 2026, sustituido en V13)

El minero de 16 × 24 se reemplaza por el personaje azul de 32 × 32 que aportó el usuario (opción «reemplazo simple»): solo cambia el sprite y sus animaciones; las reglas, la física y el EPP no cambian.

- **Hoja y animaciones.** `scripts/art/build-hero.mjs` (tabla `PLAN`) rellena los 54 cuadros de siempre: idle (4), caminar (6 reales; los cuadros 10–11 repiten), subida/cima/caída/aterrizaje a partir de la tira de salto, picar con la tira de golpe (6), palear con ataque 4 (5), festejo con ataque 1, correr, empujar el carro (inclinado), cargar y cansado. Para cambiar qué tira usa cada acción basta editar `PLAN` y repetir `npm run art:hero`.
- **Cuerpo físico intacto.** Sigue siendo 10 × 18 con los pies 12 px bajo la posición del sprite (reposo sobre el suelo en `y = suelo − 12`): el origen del sprite pasa a (0,5; 0,625) y el desplazamiento del cuerpo a (11, 14) para compensar el cuadro de 32 × 32. El dibujo mide unos 17 × 26 px (el minero, 16 × 21): la cabeza sobresale del cuerpo físico, sin cambiar túneles ni saltos.
- **EPP y herramientas.** Ya no se dibujan sobre el personaje (el EPP sigue exigiéndose para entrar a la mina y se ve en el inventario y la barra superior; la picota, la pala y el hacha no se ven en la mano). `MinerLook.ensureLook` devuelve la hoja sin recolorear.
- **Luz del casco.** Nace de la frente del personaje (`LightingSystem.lampOrigin`, fija: ya no se busca el píxel de la lámpara en la hoja).
- **Pendiente / límites.** Dirección: la hoja se usa tal cual (mirando a la derecha sin voltear); si se ve al revés basta invertir `flipX` en `Miner.step`. Faltan casco, herramientas y chaleco dibujados, y usar herido/muerte/ataques. La procedencia y licencia de las hojas están por confirmar (docs/ASSET_CREDITS.md).

## Protagonista minero con EPP visible (V13, 16 de noviembre de 2026)

El «azulito» se sustituye por un **minero original dibujado por código** con la paleta de 49 colores. Solo cambian los recursos visuales, las animaciones y las capas de equipo: `Miner.ts` (controlador, movimiento, salto, vuelo), el cuerpo físico, la minería y el EPP como regla de acceso no cambian.

- **Diseño.** Hombre de pelo castaño, bigote, camisa de trabajo azul arremangada, pantalón caqui, cinturón con hebilla y zapatos de trabajo; sin casco, chaleco ni botas de seguridad. Unos 9 × 24 px en reposo (16 × 24 con el pico) dentro del cuadro de 32 × 32; contorno de tinta de 1 px, luz arriba-izquierda, alfa 0/255. Gestos: normal, parpadeo, esfuerzo (al picar y palear), alegría (festejo) y cansancio.
- **Generador.** `npm run art:hero` (`scripts/art/build-hero.mjs`) arma cada cuadro con partes en orden de profundidad (brazo trasero, pierna trasera, torso, pierna delantera, cabeza, herramienta, brazo delantero). Las 54 poses conservan el orden de `MINER_ANIMATIONS`: reposo con respiración y parpadeo, caminar, subida/cima/caída/aterrizaje, picar a dos manos (el pico sube por detrás de la cabeza y golpea con chispas), palear, festejo, correr, empujar el carro, cargar una roca, cansado (manos en las rodillas, sudor) y las siete fases de pala para cargar. Con `-- --preview` deja una vista ampliada en `.tools/hero-preview.png`.
- **Herramientas en la mano.** Una hoja por herramienta: `miner` (pico de hierro), `miner-tungsten`, `miner-shovel`, `miner-axe` (nuevo: el hacha ya no usa la hoja del pico) y `miner-unarmed` (manos libres; la perforadora sigue siendo su sprite aparte). Los cuadros de palear (22–26 y 47–53) muestran la pala en todas. Talar y picar usan la hoja de la herramienta equipada (`skinOf`).
- **EPP visible por capas.** `hero_ppe.png` trae una capa por pieza (botas, guantes, chaleco, gafas, casco: `PPE_LAYERS`). `MinerLook.ensureLook` compone la hoja vestida (`<hoja>@<máscara>`, textura canvas cacheada) con `MinerCompose.composeLook`: estampa las capas equipadas y vuelve a poner la herramienta delante. Al quitar una pieza la máscara cambia y la pieza desaparece en el mismo fotograma. Casco amarillo con lámpara frontal, gafas con correa, chaleco naranja con franjas reflectantes, guantes de cuero y botas ocre con puntera de acero. El generador comprueba que la composición difiere del dibujo completo en ≤ 6 píxeles de contorno en el peor caso de las 192 combinaciones.
- **Linterna.** `LightingSystem.lampOrigin` nace ahora en el foco dibujado del casco (x ± 4,5, y − 11). Sin casco no hay lámpara (como antes); batería, interruptor y encendido automático no cambian.
- **Límites.** Las tiras del azulito en `art/hero/` ya no se usan (se conservan como aportes del usuario). Herido y muerte siguen sin animación propia. Las capas de EPP no siguen el cabeceo de la cabeza más allá de la pose del cuadro.

### Retirada de la picota de diamante y sprint (16 de noviembre de 2026)

- **Picota de diamante retirada.** Sale del catálogo (`TOOLS`), de la bodega, de la barra de iconos y de la hoja `hero_diamond.png`. Las partidas antiguas que la tengan la pierden al cargar (`SaveSystem.restoreTools` descarta `RETIRED_TOOLS` y libera la mano si era la equipada), sin error de carga. El progreso de hierro y tungsteno no cambia.
- **Mineral de diamante y mineral desconocido.** Ambos exigían la picota de diamante (nivel 3). Ahora exigen picota de tungsteno (`pick: 2` en `config/minerals.ts`); precios, geología y XP no cambian. El mensaje «REQUIERE PICOTA DE DIAMANTE» desaparece.
- **Sprint.** Mantener **Shift izquierdo** multiplica la velocidad horizontal por 1,6 (`config/sprint.ts`; Shift derecho no cuenta). Se aplica sobre la velocidad normal y sobre la reducción por aire o cansancio, que siguen mandando. Al soltar Shift se camina otra vez. En la mina usa la animación `miner-run`; en el campamento y la cabaña (`TopDownMiner`) el mismo sprite camina más deprisa. No hay consumo de energía propio. Mientras el minero empuja el carro no corre (`pushing` anula el avance en la galería).

## Retirada del comercio presencial (16 de noviembre de 2026)

Se retiraron los NPC, sus diálogos y los puestos de venta de la superficie lateral, el campamento cenital y la galería. El terreno lateral conserva su relieve y colisión. En el campamento cenital se retiraron el edificio de la tienda, su ramal de acceso, el cajón de venta y sus colisiones.

La bodega permite depositar y retirar bienes, alberga las cinco piezas del kit de seguridad gratuito y conserva el auxilio de emergencia. En partidas antiguas, al abrirla se completan los guantes y gafas si faltan tanto en la mochila como en el almacén. El protector auditivo y el ventilador principal se piden por celular con su precio y etapa.

En la superficie lateral, el botón **VENTA V** del celular permite vender la carga personal, la del carro a 36 px y la ya descargada en la galería cenital. La operación conserva precios, ingresos acumulados, experiencia y etapas. Los guardados V6 conservan el saldo, el inventario, las cajas y los pedidos por dron.

## Celular con tienda minera (tecla U, 16 de noviembre de 2026)

**U** abre y cierra un teléfono (152 × 258 px, pantalla de 140 × 226) con la aplicación «TIENDA MINERA»; **Esc** también lo cierra. Solo existe en la vista lateral (`MiningScene`). Mientras está abierto el minero no se mueve ni excava y las teclas del juego no actúan, pero el mundo sigue (reloj, hambre, luz). No se abre sobre otra ventana, diálogo, descanso ni pantalla de modalidad. La bodega funciona como almacén y entrega el kit gratuito. El comercio se concentra en el celular.

- **Catálogo** (`config/phoneShop.ts`): SALUD (botiquín), HERRAMIENTAS (picota de hierro, picota de tungsteno, pala, hacha, perforadora manual), ESTRUCTURAS (riel, viga de madera, viga de acero), ILUMINACIÓN (antorcha, faro minero, luminaria industrial, batería de casco), TRONADURA (dinamita, mecha), VENTILACIÓN (ducto, ventilador auxiliar) y ALIMENTOS Y BEBIDAS (bebida cola, sándwich de potito, empanada de pino, completo, suavecilla, terremoto). Sin picota de diamante. Los productos existentes reutilizan nombre, precio, peso, etapa y descripción de `TOOLS`/`SUPPLIES` (`TOOL_DESC` pasó a `balance.ts` y la comparte la bodega). La «Coca-Cola» pedida es la bebida cola que ya existía: el juego no usa marcas registradas.
- **Productos solo del celular** (`PHONE_ONLY`): botiquín ($25, 900 g, +2 corazones), completo ($10, 280 g, +2 alimentación), suavecilla ($3, 90 g, +1 energía) y terremoto ($9, 450 g, +1 energía). Desde los drones son suministros reales (`SUPPLIES` y `FOODS`, valores PROVISIONALES en la escala de la comida de la bodega): se comen o usan como la comida de siempre (inventario, barra rápida, bodega, guardado). El botiquín es un consumible de curación (`FOODS.medkit.heal`); no se gasta con la salud completa. Íconos y versión en mano en el atlas `v8-items` (`ui/SurvivalArt.ts`); en la vista cenital, `TopDownMinerArt` los dibuja en la mano.
- **Pantalla tienda**: barra de estado (día/noche, señal, batería), barra de la app con el carrito y sus unidades, saldo y total del carro, pestañas con flechas y puntos, seis filas (ícono, nombre, peso, precio y estado: etapa bloqueada, unidades en el carro o «SIN SALDO») y ficha del producto (descripción, peso, precio unitario, cantidad 1–99 con − y +, AGREGAR con el importe). Los productos de una etapa no alcanzada no entran al carrito.
- **Pantalla carrito**: líneas con ícono, nombre, − cantidad +, importe y quitar (X); subtotal, envío por dron (`PHONE_SHOP.deliveryFee`, provisional en 0: GRATIS), total, peso total y saldo que quedaría. CONFIRMAR PEDIDO.
- **Controles**: ← → categoría, ↑ ↓ producto, + / − cantidad, Enter agrega, C alterna tienda y carrito; en el carrito ↑ ↓ línea, ← → o + / − cantidad, Supr o Retroceso quita, Enter confirma. Ratón en todos los botones y rueda para recorrer filas.
- **Pedido y drones** (`systems/PhoneCart.ts`, lógica pura con Vitest): `confirmOrder` exige carrito no vacío, productos desbloqueados y saldo suficiente (el dinero infinito de los códigos no limita). Luego entrega un `PhoneOrder` (líneas con precio fijado, subtotal, envío, total y peso) al `OrderDispatcher` de la escena, que lo cobra y lo pone en la cola de drones (sección siguiente); si lo acepta, el carrito se vacía. `NO_DISPATCHER` (no cobra ni entrega) queda solo para pruebas.
- **Límites**: el carrito vive en la escena (se pierde al recargar o cambiar de escena; los pedidos pagados sí se guardan); la U no figura aún en la lista de teclas del menú.

## Pedidos por dron (16 de noviembre de 2026)

El celular paga el pedido y un dron (sin NPC) lo entrega en una caja junto a la cabaña.

1. **Pago** (`MiningScene.payDroneOrder`): solo se cobra si el pedido entra en la cola (`DRONE.maxPending` = 3 pedidos esperando o en vuelo; si no, «COLA LLENA») y la partida se guarda con el pedido. Si el guardado falla, se deshace el pedido y se devuelve el dinero. El dinero infinito de los códigos no cobra.
2. **Espera de 20 s reales** (`DRONE.waitMs`): cada pedido guarda `dueAt` con el reloj del sistema, así que recargar a mitad de la espera no la reinicia ni la alarga. Placa del HUD bajo el dinero: «PEDIDO 1 EN 0:14», «PEDIDO 1 EN VUELO» o «CAJAS EN CABAÑA X2».
3. **Vuelo** (`world/DroneView.ts`, ~8,9 s): aproximación desde la izquierda (3,6 s, con balanceo), descenso hasta apoyar la caja (1,6 s), suelta la caja y se eleva (0,7 s) y se retira hacia la derecha (3 s). Un solo dron en el aire: los pedidos vencidos salen por orden de pago (cola). Dron de 28 × 13 px con hélices en cuatro cuadros (20 fps), luces de navegación roja y verde que parpadean, franja de seguridad y garra; sombra en el suelo al acercarse.
4. **Caja** de suministros minera (16 × 13: tablones, flejes de acero, tapa con franja amarilla y negra y placa con una picota; se abre la tapa tras usarla). Puntos de entrega `DRONE.slots`, a la izquierda de la cabaña, en columnas negativas del campamento (suelo de roca madre fijo: no se excavan, no admiten bloques ni hay estructuras sólidas), así que ninguna caja queda inaccesible. Una caja por punto; con los seis ocupados el dron espera en tierra («ABRE TUS CAJAS»).
5. **Recoger con E** (`[E] ABRIR CAJA DEL DRON`): pasa al inventario todo lo que quepa con las reglas de la bodega (`GameSession.receive`: una casilla por tipo de suministro; una herramienta nueva se equipa como al comprarla). Lo que no cabe queda en la caja («INVENTARIO LLENO: QUEDAN N EN LA CAJA»); la caja vacía desaparece. Luego los productos se guardan en la bodega como cualquier otro.
6. **Indicador** sobre la oscuridad (`DEPTH.worldUi`): flecha dorada que rebota sobre cada caja y flecha verde en el punto de entrega mientras el dron vuela; fuera de pantalla, flecha en el borde con la distancia («CAJA 34 M»).
7. **Guardado** (campo `drones` de la partida V6, sin subir la versión; `systems/DroneOrders.ts`, lógica pura con Vitest): pedidos (`id`, productos, total, `dueAt`) y cajas (`id`, punto, contenido, abierta). Un pedido en vuelo se guarda como pedido, no como caja; al cargar vuelve a despegar enseguida. Soltar la caja la convierte en caja y quita el pedido en un solo paso (y se guarda), por lo que nunca hay entrega doble ni compra perdida. Los números de pedido no se reutilizan. Al restaurar se descartan entradas dañadas, ids repetidos y puntos ocupados dos veces.
- **Límites**: el dron solo existe en la vista lateral (`MiningScene`). Si el pedido vence mientras el minero está en el campamento cenital o la cabaña, despega al volver a la vista lateral. El vuelo avanza con el tiempo de la escena: si la página se bloquea al cargar, el dron puede llegar antes de que se vea.

## Cabaña minera (11 de noviembre de 2026)

El pabellón de tablas con letrero se reemplaza por una **cabaña minera habitada** (`world/structures/Cabin.ts`), fiel a la referencia del usuario (madera cálida marrón y anaranjada, techo a dos aguas de tejas violetas y azuladas con polvo de caliche, frontón de tablones con ventanuco, chimenea de ladrillos a la derecha con boca abierta, ventanas encendidas, puerta central con bandas metálicas, farol colgante, porche con escalones, silla mecedora con manta roja, barril, caja con cristales violeta, picota, rocas y cachiyuyos). El letrero de dirección «CABAÑAS» está en el camino.

- **Por piezas.** Porche, escalones, muro, puerta, ventanas, techo, chimenea, humo y accesorios se dibujan en la textura `cabin`. Los cachiyuyos junto al porche usan el atlas `flora`. Las piezas usan la paleta del proyecto, contorno de 1 px y alfa 0/255. Las ventanas y los faroles conservan la luz de noche (NightTint).
- **Humo real de la chimenea.** Emisor propio (máximo 5 bocanadas, vida 3,8–5,2 s con jitter): nace en la boca de la chimenea (113, −97 local), sube 46 px, deriva 12 px a la izquierda (el mismo viento que empuja las nubes del Backdrop), crece en cuatro cuadros y se disuelve con trama, sin alfa parcial. Tonos gris violeta (`plum`, `mauve`, `silver`).
- **Ventanas y farol vivos.** El farol (atlas `warehouse`) oscila 1 px a paso entero; las dos ventanas alternan entre dos variantes encendidas cada 3,4–6 s. Tres luces nuevas (`LightSource.flicker`): la del farol siempre y las de las ventanas solo de noche, con titileo cuantizado en `LightingSystem.decorPass` (intensidad que salta entre 0,8 y 1,0 en pasos de 260 ms, determinista por posición; sin alfa parcial). De día las ventanas se ven discretas; de noche destacan con halo ámbar sobre marco, muro y suelo cercano, sin atravesar la cabaña (la luz la recorta el mismo sistema de oclusión de siempre).
- **Ambiente ocasional.** Los cachiyuyos cambian de fase al viento (2,2–4,4 s) y la silla mecedora se mece sola 1,4 s cada 6,4–12,6 s.
- **Integración intacta.** La puerta sigue centrada en `CAMP_LAYOUT.doorX` (−299): el aviso `[E] ENTRAR A LA CABAÑA` (Z de alias), el interior `CabinInterior`, la cama, el descanso y el avance del reloj no cambian. `Camp.ts` conserva solo el resto del sector (bancas, carrete, brasero, faroles en postes, estanque, utilería y letrero); el total de luces del campamento sigue siendo 7. Textos y pruebas actualizados de «PABELLÓN» a «CABAÑA» (avisos, HUD, placa interior, letrero y `v8-survival.spec`).
- **Colisiones.** Igual que el pabellón antiguo, la cabaña es escenografía sin cuerpos físicos: el minero camina delante de la fachada (capa `structures` bajo `characters`) y nunca aparece dentro; la entrada es la superposición del interior y la zona de interacción coincide con la puerta dibujada (x 52–70 local, centro 61). Hacerla sólida dejaría la puerta inalcanzable por la izquierda y rompería el ingreso, además del acceso al estanque y las cajas traseras.
- **Límites.** Sin interiores nuevos, sin NPCs habitando, sin más animaciones que las listadas; la ilustración de referencia se interpretó con la paleta, no se importó como PNG.

## Mundo abierto: mapa más largo, excavar y construir en cualquier lado (18 de noviembre de 2026)

A pedido del usuario («amplía mucho más el mapa, que sea más largo y que puedas construir y cavar donde uno quiera, en cualquier lado»).

- **Más largo.** El mundo pasa de 592 columnas (−120..471) a 1 232 (−760..471): más del doble. Las cuatro zonas nuevas van al oeste de la Mano del Desierto, 160 columnas cada una: Salar de Atacama (−760..−601, llano, viento), Valle de la Luna (−600..−441, crestas recortadas, roca desde la fila 11), Sierra Gorda (−440..−281, lomas) y Cerro Paranal (−280..−121, cerros altos hasta la fila 6). Constantes en `config/constants.ts` (`FAR_WEST`, `WORLD_FIRST_COLUMN`, `WORLD_SPAN`); zonas en `config/biomes.ts`. Todo sigue siendo desierto: mismo fondo de cordilleras, decoración del norte de Chile y ambiente de polvo o viento. Las columnas 0..471 (y sus partidas guardadas) no cambian.
- **Excavar en cualquier lado.** Ya no hay suelo fijo: el campamento (−40..−1) y la Mano del Desierto dejaron de ser franjas aparte (`CampGround`, `WestGround`, retirados). Una sola `TerrainGrid` va del borde oeste al este; acepta columnas negativas con `first` (primera columna), `end`, `index` y `cellOf`. Solo siguen sin excavarse el lecho de roca (fondo y bordes del mundo), el piso de la bodega y el de las vías, como antes. Las reglas de siempre se mantienen: EPP completo, herramienta adecuada (roca dura con tungsteno), alcance y línea de vista.
- **Construir en cualquier lado.** La colocación con clic derecho funciona en todo el mundo con las reglas de V11 (apoyo en un bloque, sin objetos instalados ni personas en la celda).
- **Minerales en el oeste.** Bajo el campamento, la Mano del Desierto y las zonas nuevas hay yacimientos con su propio flujo aleatorio (`generateWorld`, sector `west`): Sierra Gorda tiende al cobre, el Valle de la Luna a las gemas, Paranal al oro y el salar al carbón. Antes esas columnas no tenían minerales. En las geologías rev. 3 y 4 sus cavernas se cierran como en el resto de la mina sólida.
- **Edificios sobre el suelo excavado.** La cabaña, la bodega del campamento, los monumentos y demás estructuras se dibujan sin colisión: si se cava debajo quedan donde estaban. La decoración apoyada en el suelo (plantas, rocas) sí desaparece con su bloque, como en la mina.
- **Guardado.** Sigue en `mina-cero.save.v6` sin subir la versión: suma `left` (primera columna de los índices de terreno, colocados y descubrimiento). Sin `left` (partidas anteriores) los índices empiezan en la columna 0 y se reasientan en el mundo nuevo, que agrega columnas solo al oeste. Las celdas en columnas negativas (vías, luces, marcos, cargas, barrenos) se aceptan al cargar.
- **Rendimiento.** La ventilación siembra solo las celdas de cielo que tocan aire bajo la superficie y la estabilidad descarta sin llamadas lo que no puede ser techo: excavar cuesta lo mismo que antes (≈ 4,9 ms frente a 4,7 ms). Las cordilleras del oeste nuevo se dibujan a demanda (`Backdrop.ts`, `EAGER_LEFT`; `BiomeBackdrop` prepara un tramo por cuadro cuando está a dos vistas de entrar), así el arranque queda ≈ 0,5 s sobre el anterior en vez de ≈ 2 s.
- **Pruebas.** `Biomes.test.ts` (una sola cuadrícula, excavación en el oeste, bordes de lecho, yacimientos del oeste y este intacto), `SkyLightReference.test.ts` (luz natural idéntica en todo el mundo y al excavar en el oeste), `V8Survival.test.ts`, `SaveFormat.test.ts` (huellas nuevas del formato con `left`) y `tests/open-world.spec.ts` (excavación con el ratón en el campamento, la Mano del Desierto y el salar; construcción en el oeste; guardar y recargar). Capturas: `docs/screenshots/open-world-camp-dig.png` y `open-world-west-build.png`. Respaldo previo: `.tools/backups/deepkin-antes-mundo-abierto-20261118-1841.zip`.

## Desierto de Antofagasta: solo desierto, monumentos y luz más nítida (18 de noviembre de 2026)

A pedido del usuario, el mundo deja de tener biomas verdes, montaña nevada y fondos CraftPix: todo es el Desierto de Atacama en la región de Antofagasta. Reemplaza el aspecto de la sección V9 siguiente; su geometría, su geología y su guardado siguen vigentes.

- **Zonas** (`config/biomes.ts`). Las siete conservan exactamente las columnas, el relieve (`profile`) y el contacto con la roca (`rockTop`) de los biomas a los que reemplazan, así el terreno de cada semilla, los yacimientos y lo excavado en partidas guardadas no cambian. De oeste a este: **Mano del Desierto** (−120..−41, antes monolitos, no excavable), **Desierto de Atacama** (−40..139), **Pampa Salitrera** (140..219, antes valle), **Estación del FCAB** (220..283, antes bosque), **Ruinas de Huanchaca** (284..347, antes pinar), **Cerros de la Costa** (348..415, antes cordillera; roca viva desde la fila 11) y **La Portada** (416..471, antes costa; arena de playa).
- **Suelo y flora.** Costra y tierra del desierto en todas partes, salvo la arena de La Portada. El interior combina cachiyuyo, brea, grama salada y cojines de cactus atacameño. Los cerros costeros presentan copao columnar y copiapoa, y en La Portada se ven nolanas de flor azulada entre matas bajas. Los siete algarrobos talables tienen corteza veteada, vainas y dos siluetas de copa rala en tonos ocre. La cabaña tiene cachiyuyos junto al porche y polvo de caliche sobre las tejas. El campamento cenital reutiliza los cuadros interiores del mismo atlas. Los materiales y cuadros verdes del terreno quedan en su atlas para conservar los índices.
- **Fondo continuo** (`world/Landscape.ts`, `world/Backdrop.ts`, `world/BiomeBackdrop.ts`). Las cuatro capas de parallax dibujan un relieve continuo desde la Mano del Desierto hasta La Portada. Cada zona tiene su propio perfil de altura, separación de cerros, mesetas, estratos y salitre. Las mesetas del oeste enlazan con las crestas de Atacama, las lomas bajas y claras de la Pampa continúan en las terrazas del FCAB y las quebradas de Huanchaca crecen hacia los Cerros de la Costa. Los perfiles se mezclan de forma gradual y centrada en cada frontera, con más espacio para las capas lejanas.
- **Cordilleras y costa.** Las texturas de las cordilleras contienen hasta 512 columnas de píxeles por tramo y 18 cuadros de iluminación. Cada una consulta las mismas coordenadas absolutas para la cresta, la sombra, los estratos y las quebradas, así el dibujo continúa entre texturas. Al llegar a la costa, la cresta baja hasta la base de cada ladera, que conserva su relleno de roca. El horizonte del mar abarca todo el ancho de la vista y se revela detrás de las laderas. Las olas tienen trazos distintos según la distancia y el arco de **La Portada** conserva su plano de parallax con factor 0,45. Arte original generado en el juego con la paleta del proyecto, píxeles enteros y alfa binario.
- **Monumentos** (`world/Landmarks.ts`, lugares en `world/LandmarkSites.ts`). **Mano del Desierto**, **oficina salitrera** (chimenea de ladrillo y galpón de calamina en ruinas), **locomotora a vapor del FCAB** con ténder y placa, sobre su vía, y **Ruinas de Huanchaca** (terrazas de sillares con arcos). Están dibujados a mano por código con la paleta, con contorno de tinta de 1 px y luz arriba-izquierda, sin alfa parcial ni fotos. Van en un plano justo detrás del suelo, delante de las dunas y detrás de la pared subterránea: no tienen colisión, no se excavan ni se destruyen, y sus cimientos (20 px) quedan tapados por el terreno. Cada uno se apoya en el suelo más bajo del tramo más parejo de su zona. NightTint les pone el tinte de la hora.
- **Ambiente y sonido.** Polvo en el desierto, ráfagas en los cerros y brisa salina en La Portada. Viento seco en todas las zonas, sin el coro de aves de los bosques; oleaje y gaviotas solo en la costa. Los pasos suenan a tierra, salvo en la roca de los cerros.
- **Luz más nítida** (`config/lighting.ts`, `renderCell`). La sombra y el brillo del casco, las antorchas, los faroles y los cristales se dibujan en celdas de 2 × 2 px (antes 4 × 4): sus anillos tienen bordes el doble de finos. La luz natural sigue en su mapa de 4 px (sus pruebas y pérdidas no cambian) y la oclusión del casco y los faroles se comparte por bloques de 4 px, así que el borde contra la roca queda donde estaba. La luz ambiente se calcula una vez por bloque de 4 px y la caída del casco sale de una tabla. Medido con el casco encendido en la galería: 4,9 ms de mediana por cuadro, contra 4,1 ms con celdas de 4 px.
- **Luz sobre los desniveles del suelo.** La luz usaba la cuadrícula principal para la oclusión y para decidir dónde cae el brillo al aire libre. Esa cuadrícula no conoce el suelo del campamento ni el de la Mano del Desierto: a la izquierda supone aire hasta la fila 10 y lecho debajo. Donde el suelo real del oeste era más bajo, el brillo flotaba en una franja recta en el aire; donde era más alto, no lo alumbraba. Ahora la luz usa el suelo real de todo el mundo (`WestGround`, que responde por oeste, campamento y mina) y se posa en cada escalón.
- **Sombra del minero sobre el suelo** (`world/GroundShadow.ts`, puro; `world/GroundShadowView.ts`). Sombra de contacto de 12 px bajo los pies: cada columna de píxeles busca su propio suelo hacia abajo y oscurece 1–2 px de su cara superior (mezcla multiplicativa con colores opacos, la misma excepción de la luz). Junto a un escalón baja al nivel inferior, sobre un pozo se corta, salta las esquinas redondeadas de los bloques y no se posa en paredes. En el aire se achica y desaparece a 48 px del suelo.
- **Sombra de la luz ceñida al relieve.** La oclusión del casco y los faroles se comparte por bloques de 4 px, salvo en los bordes: donde un bloque vecino tiene una oclusión distinta (la sombra que proyecta un escalón, la cara de un bloque), cada celda de 2 px traza su propio rayo. Medido en una galería profunda con el casco encendido: 4,0 ms de mediana por cuadro.
- **Chinchillas del desierto** (`systems/CritterBrain.ts`, puro; `world/Critters.ts`). Doce chinchillas, dos por zona desde la Mano del Desierto hasta los Cerros de la Costa (ninguna en la playa), dibujadas píxel a píxel con la paleta a partir de la referencia del usuario (`art/chinchilla/reference.webp`). Miden 16 × 12, con cuerpo físico de 8 × 6, más chicas que el minero. Hoja de 12 cuadros: reposo, oreja que se mueve, olfateo, saltitos y carrera. Tranquilas reposan, olfatean o dan saltitos cerca de su casa, suben escalones de un bloque y no bajan barrancos. Si el minero se acerca a 64 px en su mismo nivel, huyen a 150 px/s (más que su carrera de 144 px/s), saltando escalones. Ante una pared alta o un barranco dan media vuelta una vez; si vuelven a quedar acorraladas, o tras 3,2 s sin perderlo, se esconden con un poco de polvo y salen cuando el minero se alejó. Se calman a 160 px. Son decoración en movimiento: no se interactúa con ellas, no hacen daño, no se guardan y solo se simulan cerca de la cámara.
- **Partidas guardadas.** Sin cambios de formato. Las regiones visitadas con los nombres de V9 (`valley`, `forest`…) pasan a la zona que ocupa sus mismas columnas (`LEGACY_BIOME_IDS`).
- **Retirado.** Fondos CraftPix (`public/assets/biomes/`, `config/biomeLayers.ts`, `npm run art:biomes`, su informe de importación y su aviso de licencia), carga por región, cielo de aurora, robles, pinos, helechos, flores, polen, hojas y agujas. Copia de respaldo previa en `.tools/backups/deepkin-antes-desierto-antofagasta-20261118-1129.zip`.

## Sistema V9 — biomas y mundo expandido (12 de noviembre de 2026)

> Reemplazado en su aspecto por «Desierto de Antofagasta» (18 de noviembre de 2026): ya no hay biomas verdes ni fondos CraftPix. Columnas, relieve, geología y guardado siguen como se describe aquí.

Un solo mundo continuo, sin selector de mapas ni pantallas de carga: el campamento minero del desierto de Atacama sigue siendo el centro (bodega, punto de venta, bocamina y cabaña donde estaban) y al caminar hacia los lados aparecen regiones nuevas con sus propios fondos CraftPix (procedencia y licencia en docs/ASSET_CREDITS.md). El mundo pasa de 180 columnas (campamento + 140 excavables) a 592: monolitos (80, no excavables, como el campamento) + campamento (40) + 472 excavables.

- **Regiones** (`config/biomes.ts`, puro). De oeste a este: Llano de los monolitos (−120..−41), Desierto de Atacama (−40..139, el de siempre), Valle verde (140..219), Bosque de robles (220..283), Pinar de altura (284..347), Cordillera nevada (348..415) y Costa de los acantilados (416..471, fin del mundo en el mar). Cada región conoce su id, nombre, columnas, relieve, suelo (`EarthGroup`), fila de roca, reglas de decoración y tipo de ambiente; sus capas de fondo, factores de parallax y alturas están en `config/biomeLayers.ts`. Se eligieron seis de los ocho fondos del ZIP: los que aportan paisajes distintos; `nature_5` repetía el valle y el bosque.
- **Reproducible.** Relieve (senos deterministas que empalman sin escalones con el vecino), suelo, decoración (`world/BiomeDecor.ts`, ruido estable por columna) y fondos no usan azar al cargar; la geología de las columnas nuevas sale de la semilla con su propio flujo aleatorio. Una región nunca se regenera distinta al volver.
- **Parallax real** (`world/BiomeBackdrop.ts`). Cada capa tiene su factor: cielo fijo, nubes 0,02 (con deriva propia de 1,2–2 px/s), cumbres lejanas 0,03–0,07, cerros 0,06–0,1, árboles 0,13–0,17 y pradera cercana 0,16–0,24. Las capas del ZIP se repiten sin costura (se comprobó que sus bordes calzan); la costa, que es una imagen plana, se ancla y se mueve poco, como un telón, sin simular capas que no tiene. Nada se estira: capas nativas 576 × 324, nearest-neighbor.
- **Profundidades.** Cada bioma se compone en tres partes intercaladas con lo común del mundo: cielo (sobre el cielo del ciclo y bajo estrellas, sol y luna), lejos (tras las nubes cercanas animadas) y cerca (delante de ellas, detrás de las aves cercanas). Las cordilleras del desierto entran al mismo compositor, así se funden igual que el resto.
- **Transiciones sin cortes y sin alfa parcial.** El fondo cruza con una rampa tramada de 256 px anclada al mundo, sobre el cambio del suelo: cada columna de la pantalla muestra la mezcla de lo que tiene debajo y el paisaje nuevo entra píxel a píxel (grupos de 2 × 2, umbral de ruido de 16 × 16) por el lado hacia el que se camina. Junto al desierto la banda entera cae del lado del bioma nuevo: el campamento y la mina se ven siempre con su desierto puro. El suelo se mezcla por terrones de 2 × 2 bloques en 8 columnas (arena y pasto entremezclados, nunca una división vertical) y la decoración cambia de a poco en 32 columnas (los cactus ralean y aparecen los robles). Se descartó un fundido parejo en toda la pantalla: con trama se veía como estática.
- **Terreno propio.** Desierto: costra, tierra anaranjada, cactus, matorral seco y rocas rojizas (V7). Monolitos, valle, bosque y pinar: pasto verde y tierra de bosque, con robles, pinos, helechos, flores, arbustos y rocas con musgo; montaña: pasto alpino sobre suelo pedregoso, roca viva desde la fila 11 (granito) y cumbres de hasta la fila 7; costa: arena de playa, pasto de dunas y cantos. Todo es arte original con la paleta del juego; el fondo CraftPix nunca reemplaza bloques jugables.
- **Día y noche en todas partes.** El mismo reloj de 10 minutos (5 + 5). Las capas se tiñen con el tinte de la hora al componerse (cálido al atardecer, azul luna de noche); el cielo de cada bioma se borra desde arriba con una banda tramada que baja durante el crepúsculo y deja ver el cielo del ciclo, la luna y las estrellas; en los monolitos aparece en su lugar el cielo de aurora (sin tinte, brilla de noche) y unas cumbres nocturnas. La iluminación subterránea, la del casco y las luces locales no cambian.
- **Ambiente** (`world/BiomeAmbience.ts`). Hasta 16 partículas de 1–4 px, solo al aire libre, según el bioma que pisan: polvo (desierto, V7), vilanos (monolitos), polen de día y luciérnagas de noche (valle), hojas (bosque), agujas (pinar), ráfagas de viento (montaña) y brisa salina (costa). Nubes y aves del V7 siguen en todo el mundo.
- **Rendimiento y carga por región.** Las capas no se cargan al iniciar (`preload: false`): se piden las del bioma de la cámara y sus vecinos y se liberan las de biomas lejanos. Cada cuadro se estampan solo las capas de los dos biomas en pantalla en seis lienzos de 480 × 270, y solo se recomponen si cambió algo (cámara, hora, deriva). La decoración se crea una vez (imágenes estáticas, sin animación salvo el cuadro de brisa, que Phaser no dibuja fuera de cámara).
- **Minería intacta.** Excavación, galerías, rieles, carro, vigas, ventilación, perforación, tronadura, inventario, NPC, comercio, cabaña, hambre, cansancio, experiencia y guardado no cambian. Las columnas 0..138 se generan exactamente igual que en V8 (prueba que compara el mundo de 140 columnas con el nuevo); la 139 deja de ser el muro de lecho derecho. Los biomas del este tienen yacimientos con los mismos tipos, minerales y valores, siempre enterrados (nunca a la vista desde una ladera); el relieve solo inclina los sectores (cordillera: cobre y oro; valles y bosques: carbón y cobre). El subsuelo sigue oculto hasta explorarlo.
- **Guardado.** Sigue siendo `mina-cero.save.v6` sin subir la versión: suma `columns` (ancho con que se guardaron los índices; sin él se asumen 140) y `regions` (`current` y `visited`). Las partidas anteriores cargan con lo excavado y construido en su lugar y solo el desierto conocido. Al pisar un bioma por primera vez el HUD anuncia «NUEVA REGION: …» y se guarda.
- **Pruebas.** `src/game/world/Biomes.test.ts` (regiones, mezcla, suelo, relieve, geología V8 intacta, yacimientos enterrados, capas importadas, anclaje, trama, decoración, guardado y migración) y `tests/v9-biomes.spec.ts` (fondos puros de día y de noche, cruces, caminata continua con cámara sin saltos y ~60 fps, carga por región y parallax, luz subterránea, guardar/recargar y volver al campamento). Capturas en `docs/screenshots/v9-*.png`.
- **Límites.** Al oeste del campamento hay una sola región nueva (los monolitos): los fondos restantes encajaban mejor al este. Sin enemigos, minerales ni recetas nuevos. La costa no anima su mar (es una imagen plana); su vida viene de la brisa, las nubes y las aves.
## Códigos de la partida (tecla |)

Ampliación explícita del 12 de noviembre de 2026. La tecla **|** abre la consola de códigos en cualquier partida (antes solo existía con `?dev=1`). Enter ejecuta, | o Esc cierra; mientras está abierta la escena se pausa.

- **`money`** alterna el dinero infinito: las compras no descuentan saldo y el HUD muestra «INF». No desbloquea etapas de la tienda.
- **`fly`** alterna el vuelo: con el código activo, dos toques de Espacio en menos de 300 ms (`FLIGHT` en `config/constants.ts`) activan o apagan el vuelo. Volando no hay gravedad; Espacio/W/↑ sube, S/↓ baja y, al bajar hasta tocar suelo, se aterriza. La colisión y el cuerpo físico no cambian. Apagar el código o entrar al pabellón devuelve la gravedad.
- **`desbloquear`** (18 de noviembre de 2026, pedido del usuario) pasa de inmediato a la etapa 3 (Minería industrial): la tienda del celular ofrece todo lo que pedía etapa 2 o 3 (el dinero se sigue cobrando). El HUD avisa «ETAPA 3 DESBLOQUEADA». No da experiencia ni el logro de etapa, y las etapas no retroceden. Si ya estaban todas (ganadas jugando), no cambia nada ni desactiva logros. Lógica en `GameSession.unlockAllTiers`; la etapa se guarda como siempre (`progression.tier`).
- **Logros.** Activar cualquier código desactiva los logros de esa partida para siempre, aunque después se apague el código; los ya ganados se conservan. El evento secreto del mineral extraño se sigue viendo (una vez por sesión), sin logro.
- **Guardado.** Campo `cheats` (`money`, `fly`, `used`) en `mina-cero.save.v6`, sin subir la versión; solo aparece si se usó un código. Lógica pura en `systems/CheatCodes.ts`, con Vitest (`CheatCodes.test.ts`) y e2e (`tests/cheat-codes.spec.ts`).
- **Modo desarrollador.** Con `?dev=1` la misma consola suma `fullstacks`; ahí `money` sigue siendo el de desarrollo (partida aparte, no toca los logros) y `fly` es el código normal. El antiguo código `mochila` se retiró porque las 24 casillas ya están disponibles.

## Pantalla de muerte

Al llegar a cero de salud, `DeathScene` detiene la simulación y la entrada de la escena de juego. El cierre de 360 ms usa bandas escalonadas y una trama binaria de tinta sobre el último fotograma. El panel indica la causa y las pérdidas de Normal o los datos de la expedición Hardcore. Flechas y Tab eligen el botón. Enter o clic lo activan.

En Normal se descuentan una sola vez la carga personal y el 10 % de las monedas, con el redondeo habitual. REINTENTAR reconstruye la escena de superficie con la misma sesión y limpia trabajo, controles, poses y ventanas. El carro, el terreno, el equipo y los pedidos se conservan. Las mechas activas conservan el tiempo restante al reintentar en la vista lateral. En Hardcore, REINTENTAR registra y archiva la expedición, y abre la elección de modo para una mina nueva. MENÚ PRINCIPAL deja disponible el guardado ya actualizado. Una expedición Hardcore terminada vuelve a mostrar el resultado al cargar.

## Derrumbes con física (16 de noviembre de 2026)

Ampliación explícita del sistema de sostenimiento V3. Es un modelo de videojuego, no una simulación geomecánica. Sustituye el derrumbe instantáneo (escombro que aparecía bajo el techo) por el desprendimiento real del techo. No cambia precios, recetas, herramientas, controles ni el formato general del guardado.

**Estabilidad (sin cambios en la regla).** `GeotechnicalSystem` mide cada tramo de techo sin sostener sobre una galería excavada: carga = largo ÷ luz admisible (tierra 4, roca 6, roca dura 8, menos con la profundidad) + exceso de altura + daño de tronadura. Un bloque con aire debajo no cae por eso solo: una galería corta en roca es estable. Los marcos de madera sostienen 2 bloques a cada lado y los de acero 4; un marco roto o retirado deja de sostener. Las cavernas naturales y la bocamina son estables. Novedad: el piso de una vía y el de la bodega están reforzados y no forman un techo inestable.

**Advertencia de 10 segundos exactos.** Al pasar un tramo a colapso inminente empieza una cuenta de `GEOTECH.warningMs` = 10 000 ms de tiempo de simulación (antes, de 10 a 25 s según la gravedad). Durante ella siguen las señales que ya existían: grietas en el techo, contorno rojo intermitente, polvo y crujidos, y la alarma del HUD con los segundos. Corre solo con la partida en marcha: en pausa o con la pestaña oculta no avanza. No se reinicia por reevaluar: si la galería se ensancha, el tramo nuevo hereda el tiempo del que ya corría sobre el mismo techo. Sostener el tramo a tiempo cancela el derrumbe; retirar un soporte crítico abre una advertencia nueva y completa.

**Desprendimiento.** A los 10 s el techo del tramo se suelta (`release`): los bloques salen de la cuadrícula y pasan a `FallingBlocks`. Efecto arco: en un tramo de tres o más bloques los dos extremos quedan colgados de la roca firme, así que cada desprendimiento abarca menos que el anterior y la bóveda se cierra sola. El lecho y los bloques protegidos no se desprenden.

**Caída.** Cada bloque conserva su imagen del techo (`FallingBlocksView`, píxeles enteros). Primero se afloja 140–500 ms temblando un píxel (del centro del tramo hacia los costados); después cae recto por su columna con la gravedad del mundo (600 px/s²) hasta 360 px/s. Se detiene sobre el primer sólido que encuentra y se apila. Al asentarse vuelve a la cuadrícula como escombro, con colisión, fragmentos, polvo y un golpe grave. Un bloque desprendido es siempre un escombro asentado: nada se duplica. El escombro se retira con pala o picota y rinde una unidad de piedra, como siempre. Una mena del techo que cae queda como escombro: el mineral se pierde en el derrumbe.

**Golpes.** El bloque que toca al minero mientras cae lo golpea una vez y se parte (no lo deja enterrado). Daño = 20 + velocidad × 0,3, con tope 95, por 0,7 con casco: unos 41 puntos desde un techo a dos bloques y unos 54 desde tres. Bajo 60 px/s no daña. La protección breve tras un golpe evita daño repetido. Si la salud llega a cero se usa la muerte de siempre (causa «aplastado por un derrumbe»). El carro no queda enterrado: el bloque se parte sobre él. Una vía sí puede quedar obstruida.

**Cadena controlada.** Al asentarse todo, el golpe castiga a los marcos del tramo y tres bloques a cada lado (`shockZone`); uno ya gastado puede ceder y dejar inestable al vecino, que tiene su propia advertencia de 10 s. Lo mismo ocurre con la bóveda que queda sobre el derrumbe. Nunca hay derrumbes inmediatos en cadena.

**Rendimiento.** Solo los bloques desprendidos se simulan (máximo 96 a la vez; un derrumbe nuevo espera en cero si no hay lugar). La estabilidad se evalúa al cambiar el terreno y una vez por segundo, nunca por cuadro, y queda en suspenso mientras los bloques caen. La luz, el aire y la estabilidad se recalculan una vez al desprenderse y una vez al asentarse todo.

**Guardado.** Sin bloques cayendo el guardado es idéntico al de antes. Durante la advertencia se guarda el tiempo restante y al cargar la cuenta recomienza con 10 s completos (nunca se derrumba al abrir la partida). Si se guarda con bloques en el aire, el campo `falling` los registra y al cargar quedan asentados como escombro donde habrían caído. Lo mismo ocurre al reintentar tras morir en pleno derrumbe.

La galería cenital de desarrollo usa la misma advertencia de 10 s; su derrumbe sigue siendo el de esa vista (sin gravedad en planta).
## Mina sólida para partidas nuevas (rev. 3, 17 de noviembre de 2026)

Las partidas nuevas usan la revisión geológica 3. La misma semilla conserva los yacimientos y cristales de la revisión 2, pero sus espacios naturales y galerías generadas se rellenan con el estrato local (tierra, roca o roca dura). Solo queda un arranque de bocamina de seis columnas (18..23) por tres filas (7..9); la pared de la columna 24 se excava con la herramienta inicial. El resto del subsuelo empieza sólido. No se crean corrientes de aire ni se marca aire de cavernas en esta revisión.

Las revisiones 1 y 2 siguen generándose exactamente como antes para las partidas guardadas. La clave y el formato V6 se mantienen; el campo `worldRev` distingue la revisión 3 y las diferencias de terreno persisten como excavaciones. Los guardados sin `worldRev` siguen cargando con la revisión 2, sin convertirse a la 3. En desarrollo, `?world=1` y `?world=2` siguen disponibles para probar mundos antiguos; `?world=3` fuerza el nuevo.

Excavar llama a la transacción existente de `GameSession.mine`: recursos, desgaste, progreso, visibilidad, soportes, ventilación y estabilidad se actualizan allí. `MiningScene.terrainChanged` redibuja las celdas afectadas y solicita la actualización localizada de luz. `TerrainGrid` sigue siendo la fuente de colisión; no hay un cuerpo físico por bloque. La geotecnia considera únicamente aire excavado bajo un techo originalmente sólido, por lo que el terreno intacto no inicia derrumbes. El sostenimiento y la advertencia de 10 s se conservan. La página secreta permanece en su celda, pero en la revisión 3 solo se muestra e interactúa con ella después de descubrirla.

Al abrir por primera vez el nivel cenital −1 en una expedición rev. 3, queda libre solo el espacio de acceso, ventilador y vía inicial (15 celdas). El ramal nace cerrado y las vetas conservan su posición. El guardado de esa planta identifica su versión para que las galerías anteriores conserven su plano y excavaciones. En la vista lateral rev. 3, la textura sigue la paleta y pinta las juntas oscuras de los estratos de roca con el tono base, para que la roca intacta se vea continua.

### Entrada ampliada en partidas nuevas (rev. 4, 17 de noviembre de 2026)

La bocamina de una partida nueva abre diez columnas (18..27) por tres filas (7..9), exactamente 30 celdas. La primera pared excavable queda en la columna 28. El resto del subsuelo continúa sólido, con los mismos yacimientos y cristales de la revisión 2. La planta cenital, la iluminación, las colisiones, los soportes y el aspecto de los bloques sólidos siguen usando los sistemas de la revisión 3. La estructura visible de la bocamina conserva sus piezas actuales y la prolongación final queda como galería natural.

La nueva revisión 4 se guarda en `worldRev`. Una partida previa con revisión 3 conserva su entrada de seis columnas al cargar; las revisiones 1 y 2 tampoco cambian. En desarrollo, `?world=3` permite probar la entrada anterior y `?world=4` fuerza la nueva.

El fondo visible de la galería se dibuja como roca natural con caras angulosas, tonos de la paleta y fracturas discontinuas. No usa juntas rectas de mampostería. La pared cubre las ocho columnas originales en partidas anteriores y las diez de la revisión 4. Es solo decoración; la colisión y los recursos siguen saliendo de `TerrainGrid`.

La pared del fondo de la entrada ya no distribuye piedras sobre una malla escalonada. Sus tonos forman estratos torcidos continuos, con fisuras aisladas; al excavar el frente no aparecen hiladas que se lean como ladrillos.

## Combate de prueba: gnomo minero (17 de noviembre de 2026)

La tecla J golpea hacia el lado que mira el minero, sin sustituir el clic de excavación. El alcance es corto y la pared sólida bloquea el golpe. La herramienta equipada determina el daño (picota de hierro 18, tungsteno 24, hacha 20, pala 12, perforadora 16; sin herramienta útil 7). El ataque tiene 360 ms de intervalo y no consume durabilidad.

La consola de `|` acepta `gnomo`: invoca un gnomo minero en un espacio libre cercano, mirando al minero, y desactiva los logros de la partida como los demás códigos. El gnomo tiene 90 puntos de salud y barra visible (dorada cuando se enfurece), y golpea por 12 puntos. Puede ser derrotado con cualquier herramienta. Su presencia es temporal y no se agrega al guardado; al recargar puede invocarse de nuevo. No aparecen enemigos de forma natural en esta etapa.

### Gnomo minero animado (17 de noviembre de 2026)

**Aspecto.** El gnomo es el del PNG de 32 × 32 aportado por el usuario. A pedido del usuario (más pequeño) el juego usa una versión de 24 × 24: el mismo diseño al 75 %, unos 23 px de alto contra 30 del original, con el gorro a la altura de la cabeza del minero. Se dibujó en `art/gnome/small.png` a partir de una reducción del original, retocada a mano para que los ojos rojos, la nariz, la barba en punta y la picota sigan legibles. Una escala fraccionaria en el juego (`setScale`) saltaría píxeles en el lienzo de 480 × 270, así que no se usa. Tiene 20 colores y alfa binario. La hoja (`npm run art:gnome`) tiene 11 animaciones en cuadros de 64 × 48; el margen deja sitio a la picota levantada y al cuerpo caído. El primer cuadro del reposo es el maestro píxel por píxel. El esqueleto de 32 px sigue en el generador: con `GNOME_SHEET.size = 32` (y su origen) vuelve el tamaño original.

| Animación | Cuadros | FPS | Detalle |
|---|---:|---:|---|
| Reposo (`idle`) | 8 | 6 | Respira, la barba y la punta del gorro siguen el movimiento con retraso. |
| Reposo con parpadeo (`idleBlink`) | 8 | 6 | Igual, con parpadeo y lámpara que titila. Cada vuelta elige al azar una de las dos. |
| Caminar | 8 | 10 | Pasos cortos alternados, rebote de 1 px, brazo opuesto a la pierna, gorro arrastrado. |
| Correr | 8 | 12 | Zancadas de 2 px, cuerpo inclinado, picota en alto. |
| Atacar | 8 | 12 | Preparación, picota por detrás de la cabeza, descenso, **impacto en el cuadro 4**, temblor, recuperación. |
| Recibir daño | 4 | 10 | Sacudida hacia atrás con ojos cerrados y rebote, más un destello opaco de 70 ms. |
| Morir | 8 | 10 | Retroceso, pérdida de equilibrio, caída de espaldas con rebote, la picota cae suelta, el cuerpo queda 0,9 s y se disuelve con trama. |
| Detectar (`alert`) | 6 | 8 | Salto de sorpresa con «!» rojo, ojos encendidos, picota en guardia. |
| Enfurecerse (`rage`) | 6 | 10 | Temblor, ojos agrandados, lámpara que destella, pisotón. |
| Minar | 8 | 10 | Golpe horizontal contra la roca; esquirlas y sonido en el cuadro 4. |
| Mirar alrededor (`look`) | 6 | 6 | La cara gira a un lado y al otro y parpadea. |

Las piezas (punta y medio del gorro, cuerpo, cara, barba, brazo, pies y picota) se mueven en píxeles enteros. La picota y la caída se rotan con un RotSprite simplificado (EPX ×8 y vecino más cercano), sin mezclar colores. Al levantarse sobre el hombro, la picota pasa por detrás de la cabeza.

**Cuerpo y combate.** El cuerpo físico mide 10 × 17, está centrado en el cuadro (el volteo no lo desplaza) y se apoya en la línea de los pies. Con 17 px no cabe por huecos de un bloque, donde el gorro atravesaría la roca. El gorro es solo dibujo. La hurtbox mide 12 × 20 y la caja de golpe es la cabeza de la picota en el cuadro de impacto (`GNOME_STRIKE_BOX`, generada con la hoja). El daño se aplica solo en ese cuadro, una vez por golpe, si la caja toca el cuerpo del minero y ninguna roca se interpone entre el pecho del gnomo y el punto de contacto. El cuadro visible y el instante del golpe salen del mismo reloj del cerebro.

**Comportamiento** (`systems/GnomeBrain.ts`, puro; parámetros en `config/gnomeAI.ts`). Estados: IDLE → PATROL → ALERT → CHASE → ATTACK → RECOVER, más MINE, SEARCH, HURT, FLEE y DEATH, y dos de apoyo: LOOK y RAGE.

- **Sin ver al minero:** descansa, patrulla hasta 80 px de su casa, se da vuelta ante paredes y bordes (patrullando no baja ni un bloque), a veces examina la pared y la pica (solo efecto: no excava ni cambia el guardado) y mira a ambos lados. Si oye excavar al minero a menos de 176 px, va a inspeccionar el ruido.
- **Detección:** ve 128 px hacia delante y 40 px hacia atrás, hasta 72 px de altura. La roca bloquea la vista: la línea de visión recorre exactamente las celdas que cruza (`systems/GnomeSenses.ts`). Al ver al minero se alerta y luego persigue. Si lo vuelve a ver dentro de 2,5 s, no repite la alerta.
- **Persecución:** corre a 58 px/s, salta escalones de un bloque con espacio libre y no se lanza a caídas de más de 3 bloques. Ante una pared alta se detiene. Ataca solo si la picota alcanzaría al minero en ese momento. Si lo pierde de vista 0,7 s, camina a su última posición conocida, mira alrededor 2,6 s y vuelve a sus actividades en ese lugar.
- **Daño:** cada golpe lo empuja y lo vuelve hacia el agresor. **Guardia** (18 de noviembre de 2026, `GNOME_AI.poise`): tras 2 aturdimientos en 1,2 s, durante 1,2 s los golpes le quitan salud pero no lo interrumpen ni lo empujan, así que puede terminar un ataque. Antes, golpear cada 360 ms (su «hurt» dura 400 ms) lo dejaba aturdido hasta morir sin responder. La guardia no impide enfurecerse, huir ni morir. Con 60 % de salud o menos se enfurece una vez (25 % más rápido y menos pausa entre golpes). Con 30 % o menos huye 1,8 s; si queda acorralado o el tiempo se cumple, vuelve a pelear. Muerto ya no recibe golpes y se retira al terminar la animación.

La roca excavable de todos los estratos y revisiones geológicas usa ahora masas continuas de 32 px y fisuras cortas sin contornos de celda. Las variantes alterada, fracturada, profunda y de montaña conservan sus tonos; la tierra, las menas y los cristales mantienen sus materiales y posiciones. La galería cenital también elimina el marco rectangular que rodeaba cada bloque sólido. Son cambios de dibujo: el terreno, el guardado, la excavación y las colisiones siguen usando las mismas celdas.

### Golpe del minero (18 de noviembre de 2026)

Mejora la respuesta del combate sin cambiar el daño, el alcance ni la cadencia (`GNOME` en `systems/Combat.ts`). Los parámetros nuevos están en `STRIKE_FEEL`.

- **Movimiento de golpe.** J reproduce el picado (cuadros 16–21) o, con la pala, el paleo (22–26) de la hoja del minero, unos 330 ms. Es solo dibujo (`Miner.swing`): no frena ni bloquea el movimiento, y el daño se sigue aplicando al pulsar. Mientras se excava o se empuja el carro manda esa animación.
- **Al aire o conectando.** Un golpe al aire suena más suave y agudo. Uno que conecta suena más grave, suelta chispas doradas, crema y plata en el borde del gnomo (`DigEffects.sparks`) y hace temblar la cámara 90 ms con intensidad 0,003, más suave que la tronadura. No hay pausa de impacto: `AGENTS.md` prohíbe que las animaciones agreguen demoras.
- **Recibir daño.** Cualquier golpe puntual (gnomo, roca, derrumbe o tronadura) hace destellar al minero en crema opaca durante 70 ms. Al terminar vuelve el tinte de la hora (NightTint), sin alfa parcial. El golpe del gnomo además lo empuja 150 px/s en dirección contraria; el empuje se suma al control y se apaga en 200 ms (`knockbackVelocity`), así que el jugador nunca pierde el control. Siguen el salto hacia arriba y el parpadeo de la protección.
- **Pulsación guardada.** Si J llega hasta 120 ms antes de terminar la espera entre golpes, el golpe sale en cuanto termina en lugar de perderse (`AttackTimer`). La cadencia no cambia.

## Pasos por superficie y salto (17 de noviembre de 2026)

Los pasos alternan tres grabaciones por material. En la vista lateral se eligen según el bloque bajo los pies, la vía y el bioma: tierra, grava, piedra, metal, madera o vegetación. El campamento cenital usa tierra y la galería cenital usa piedra. La cadencia sigue la distancia recorrida y el volumen aumenta levemente al correr. Un salto real del minero lateral reproduce una de dos exclamaciones breves.

La separación entre pisadas es de 44 px al caminar y 52 px al correr. Con las velocidades laterales base de 90 y 144 px/s, esto da aproximadamente 0,49 y 0,36 s entre pasos. La frecuencia al correr sigue siendo mayor, pero evita la sucesión demasiado rápida de golpes.

Dentro de la mina, pasos y salto pasan también por tres reflexiones cortas de Web Audio filtradas para dar eco de galería. En superficie se oye únicamente la toma directa. La mezcla respeta el volumen y el silencio general del juego; las reglas de movimiento, colisión e iluminación no cambian. Procedencia y licencias en `docs/ASSET_CREDITS.md`.


## Bocamina lateral y portal de niebla

La bocamina conserva cámara, movimiento, salto y colisiones laterales. Ya no tiene un cuerpo invisible en el umbral ni abre la galería cenital: el minero puede recorrer el túnel abierto hasta el fondo. Esa zona es de transición; no permite picar, destruir bloques ni extraer recursos.

Al acercarse al extremo aparece `[E] ATRAVESAR LA NIEBLA`. El portal es una boca de niebla opaca por capas, con motas violetas y cian de píxel entero. Al activarlo, el juego bloquea temporalmente entrada y física, concentra la niebla sobre el minero, desplaza la cámara hacia el portal y aplica una cortina tramada antes de iniciar la nueva escena lateral. La llegada invierte la cortina antes de devolver el control.

El controlador entrega la misma sesión y guarda el punto de retorno de superficie. Si se cierra el juego dentro de una expedición activa, cargar el guardado vuelve al mundo de expedición correspondiente; al regresar por su portal, reaparece junto a la bocamina y la carga se conserva.

### Mundo 1 — Las Profundidades Olvidadas

Es el primer mundo de minería roguelike, lateral e independiente del terreno principal. Contiene una cámara inicial segura, un corredor, cavidades a distintas alturas, repisas naturales y roca con carbón, cobre, hierro, oro y cristal violeta. El borde y el suelo de aparición son lecho de roca; el resto de los bloques se puede trabajar con las herramientas, el EPP, la capacidad y el inventario existentes.

Cada expedición guarda solo su id, semilla, posición, actividad y diferencias de terreno. `ExpeditionState` y `ExpeditionScene` permiten registrar después otros mundos, biomas o niveles sin mezclar sus cuadrículas con la geología, visibilidad, ventilación o sostenimiento de superficie. No hay todavía penalización de inventario, muerte permanente, enemigos ni pisos procedurales encadenados.
