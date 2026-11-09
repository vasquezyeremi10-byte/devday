# MINA CERO — visión y prototipo 0.1

Juego original de gestión minera 2D en vista lateral. El jugador pasa de una entrada rudimentaria, un minero, un pico, una pala y un carrito a una empresa minera. La estructura de construcción y progresión de Fallout Shelter es una referencia conceptual; no se reutilizan sprites, nombres, interfaz ni identidad visual.

## Visión futura

Excavar → descubrir → transportar → vender → reinvertir. La expansión incorporará herramientas, contratación, galerías, transporte, maquinaria, automatización, instalaciones, investigación, experiencia y habilidades de forma gradual. Estas ideas no están implementadas ni tienen balance definitivo.

## Alcance aprobado de la primera versión

Una escena MiningScene con superficie, entrada, tierra, roca, carrito decorativo y un minero controlable. A/D o flechas para caminar; Espacio/W/arriba para salto; mouse para seleccionar y clic izquierdo para excavar un bloque. R y botón de reinicio restauran el estado inicial.

La selección indica si el bloque está alcanzable. El pico actúa a un máximo de 36 px del centro físico al centro del bloque, exige una cara expuesta y línea libre. Tierra y roca se eliminan instantáneamente; los bordes profundos de lecho son protegidos. Se actualizan colisiones y caras adyacentes al excavar. El minero puede caer por sus propios túneles y saltar para volver a subir; si se encierra, puede reiniciar.

Mundo de 1280 × 576 px y pantalla de 480 × 270. La cámara sigue al minero y respeta límites. Los píxeles se escalan sin suavizado. Los gráficos son provisionales, originales y generados por código para poder reemplazarlos después.

## Fuera del alcance

No hay economía, inventario, extracción con duración, minerales recolectables, transporte funcional, trabajadores automáticos, habilidades, maquinaria, daño, combate, audio, guardado ni soporte táctil jugable. El carrito, pico y pala representan el equipo inicial sin sistemas adicionales.

## Criterios de aceptación

- Moverse en ambas direcciones, saltar con soporte y aterrizar sin atravesar bloques.
- Seguir al personaje con cámara y seleccionar correctamente tras desplazamiento.
- Excavar solo un bloque válido por clic, sin alcanzar bloques lejanos ni atravesar paredes.
- Eliminar bloque visible y colisión juntos; regenerar todo al reiniciar.
- Cargar sin errores; typecheck, lint, pruebas y build aprobados.
- Fondos intercambiables sin afectar el terreno ni la física.
