---
name: mining-gameplay
description: Diseñar y modificar excavación, bloques, alcance y colisiones de MINA CERO; preparar minerales y transporte solo cuando se soliciten.
---

Leer world/TerrainGrid.ts y systems/MiningSystem.ts antes de cambiar excavación. La grilla de datos es la autoridad; el Tilemap de Phaser es su proyección. Un bloque eliminado debe dejar de colisionar en la misma operación.

- Convertir mouse a coordenadas de mundo con la cámara actual y luego a fila/columna mediante floor, incluso en bordes negativos.
- Permitir únicamente bloques sólidos, no protegidos, expuestos al aire, dentro del alcance y sin otro bloque entre el minero y el objetivo. Calcular desde el centro del cuerpo físico.
- Evaluar el objetivo al hacer clic, no confiar en un resaltado de un frame anterior. Un clic elimina como máximo un bloque.
- Probar alcance exacto, fuera de mapa, roca protegida, objetivo vacío y oclusión; verificar que quitar el suelo hace caer al minero y que se recalculan caras vecinas.
- La excavación actual es instantánea y temporal. No añadir inventario, daño, drops, ventas ni transporte funcional en esta fase.
- Cuando se soliciten minerales/transporte, definir unidades, capacidad y conservación de recursos en lógica pura antes de conectar entidades visuales. Nunca inferir minerales desde píxeles del fondo.
