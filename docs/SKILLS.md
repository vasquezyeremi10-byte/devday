# Skills de Codex

Ubicación de proyecto: `.agents/skills/`. Codex las descubre dentro de este repositorio; estarán disponibles a partir del siguiente turno. AGENTS.md documenta alcance y uso. No se modifica configuración global.

## Oficiales

Origen: https://github.com/phaserjs/phaser/tree/02d8931b626d9764c133cbb3fbf99966c03c757c/skills

Commit fijado: `02d8931b626d9764c133cbb3fbf99966c03c757c`. Consultado el 9 de noviembre de 2026. Se descargaron solo SKILL.md, referencias de las skills seleccionadas y licencia MIT; no se clonó el repositorio. Se evitó el instalador genérico porque descarga el ZIP completo, contrario al alcance solicitado.

Skills: game-setup-and-config, scenes, physics-arcade, tilemaps, cameras, input-keyboard-mouse-touch, loading-assets, scale-and-responsive, sprites-and-images y v3-to-v4-migration. Sus encabezados declaran Phaser 4. Se usa TilemapLayer convencional, ya que el GPULayer requiere regenerar textura al editar. No se incorporan pipelines de Phaser 3.

Las rutas `src/...` citadas en estas skills corresponden al código fuente de Phaser. Los enlaces a skills no instaladas son referencias opcionales: consultar en origen solo si surge una necesidad. No se instalaron audio, Matter, shaders, partículas ni otros subsistemas ajenos al prototipo. Licencia conservada en `.agents/skills/PHASER-LICENSE.md`.

## Personalizadas

pixel-art-director, mining-gameplay, economy-balancer, worker-ai, progression-designer y game-qa. Instrucciones concretas de tamaños, invariantes, fórmulas y pruebas. Las tres skills de etapas futuras no autorizan implementarlas. Validadas con `skill-creator/scripts/quick_validate.py` (6/6).
