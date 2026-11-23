# Skills de Codex

Ubicación de proyecto: `.agents/skills/`. Codex las descubre dentro de este repositorio; estarán disponibles a partir del siguiente turno. AGENTS.md documenta alcance y uso. No se modifica configuración global.

## Oficiales

Origen: https://github.com/phaserjs/phaser/tree/02d8931b626d9764c133cbb3fbf99966c03c757c/skills

Commit fijado: `02d8931b626d9764c133cbb3fbf99966c03c757c`. Consultado el 9 de noviembre de 2026. Se descargaron solo SKILL.md, referencias de las skills seleccionadas y licencia MIT; no se clonó el repositorio. Se evitó el instalador genérico porque descarga el ZIP completo, contrario al alcance solicitado.

Skills: game-setup-and-config, scenes, physics-arcade, tilemaps, cameras, input-keyboard-mouse-touch, loading-assets, scale-and-responsive, sprites-and-images y v3-to-v4-migration. Sus encabezados declaran Phaser 4. Se usa TilemapLayer convencional, ya que el GPULayer requiere regenerar textura al editar. No se incorporan pipelines de Phaser 3.

Las rutas `src/...` citadas en estas skills corresponden al código fuente de Phaser. Los enlaces a skills no instaladas son referencias opcionales: consultar en origen solo si surge una necesidad. No se instalaron audio, Matter, shaders, partículas ni otros subsistemas ajenos al prototipo. Licencia conservada en `.agents/skills/PHASER-LICENSE.md`.

## Personalizadas

pixel-art-director, mining-gameplay, economy-balancer, worker-ai, progression-designer y game-qa. Instrucciones concretas de tamaños, invariantes, fórmulas y pruebas. Las tres skills de etapas futuras no autorizan implementarlas. Validadas con `skill-creator/scripts/quick_validate.py` (6/6).

## Catálogo gamedev: instalación del 17 de noviembre de 2026

Fuente: https://github.com/gamedev-skills/awesome-gamedev-agent-skills

Commit instalado y revisado: `c6ca6c41c839b68319ffc08430b99ab768debc32`. Instalador oficial recomendado por el repositorio: paquete npm `skills`, fijado a `1.9.0` para ejecutar la versión inspeccionada. Se consultaron README, docs/INSTALLATION.md, metadatos de npm, documentación y código del instalador, router y contenido de las skills seleccionadas. No se usó el marketplace ni comandos de Claude Code.

Comandos ejecutados desde la raíz del proyecto, con Node portátil:

```powershell
. ./activar-entorno.ps1
$env:DISABLE_TELEMETRY = '1'
$env:DO_NOT_TRACK = '1'
$env:npm_config_ignore_scripts = 'true'
npx.cmd --yes skills@1.9.0 add gamedev-skills/awesome-gamedev-agent-skills -a codex --list
npx.cmd --yes skills@1.9.0 add gamedev-skills/awesome-gamedev-agent-skills -a codex --skill router phaser-core phaser-arcade-physics procedural-gen save-systems audio-design create-game-assets performance-optimization --copy -y
npx.cmd --yes skills@1.9.0 list -a codex
```

El listado devolvió 80 entradas; se instalaron solo las ocho indicadas. Sin `-g`, sin `--all` y sin dependencias añadidas a package.json. La caché de npx puede quedar en la ubicación habitual de npm; las skills solo se escribieron en `.agents/skills/` de DEEPKIN. El instalador usó un clon temporal como parte de su funcionamiento; la inspección previa se hizo mediante descargas individuales, sin clonar para leer documentación.

`skills-lock.json` conserva origen, commit y hash de cada skill. Licencia Apache-2.0 y aviso del proveedor en `.agents/skills/GAMEDEV-LICENSE.txt` y `GAMEDEV-NOTICE.txt`. Las 16 skills anteriores se conservan sin modificaciones.

### Seguridad y compatibilidad

- Verificada la integridad SHA-512 del tarball de `skills@1.9.0` contra los metadatos npm antes de ejecutarlo. Revisión estática del punto de entrada, selección de agente, escritura de archivos, alcance y control de telemetría; no constituye una auditoría exhaustiva de todas las dependencias transitivas.
- Desactivados telemetría del instalador y scripts de ciclo de vida de npm solo para las consolas de estos comandos. No se cambió configuración global.
- Revisados `asset_report.py` y `build_preview_sheet.py`: inspección local de imágenes y escritura de una hoja de contacto a una ruta explícita, respectivamente. No se ejecutaron ni se instaló Pillow. Los ejemplos de otras herramientas no se ejecutaron.
- No se detectaron instrucciones de exfiltración ni ejecución automática en el contenido seleccionado. Los 29 archivos instalados coinciden con las copias revisadas del mismo commit al normalizar CRLF/LF (Git convirtió los finales de línea en Windows).
- Las skills de Phaser declaran 4.2.1. Las disciplinas contienen ejemplos de otros lenguajes y motores: se usan sus conceptos, adaptados a las APIs existentes. No autorizan cambiar motor, dependencias ni arquitectura.
- No se instaló `shader-programming`: el sistema de luz actual no utiliza ese flujo. La ruta de iluminación queda documentada en el perfil local.

### Detección y router

El instalador enumera las 24 skills del proyecto para Codex. Además, se consultó el ejecutable local de Codex mediante `app-server` y `skills/list` con `forceReload: true`: las 24 aparecen con `enabled: true`, `scope: repo` y sin errores. No se abrió otra conversación ni se ejecutó una tarea de generación de código.

El router queda conectado desde AGENTS.md al perfil [SKILLS_ROUTING.md](SKILLS_ROUTING.md), con selección mínima por tarea y resolución de las rutas planas de instalación. No se modificó el router del proveedor para conservar la integridad del lock. Las habilidades nuevas estarán disponibles a partir del siguiente turno; la comprobación del servidor ya confirma su detección en disco.

Evidencia local temporal en `.tools/skills-audit/` (ignorada por Git): lista previa, registro de instalación, lista instalada, respuesta de Codex y comparaciones de hashes. No se ejecutaron pruebas del videojuego: no hubo cambios de código, recursos ni comportamiento.

## Instalación para Claude Code del 18 de noviembre de 2026

Claude Code lee las skills de `.claude/skills/`, no de `.agents/skills/`. A pedido del usuario se instaló ahí el catálogo completo desde el ZIP `awesome-gamedev-agent-skills-main.zip` (versión 2.0.0 del 11 de noviembre de 2026): el router y las 79 skills, 80 en total, en carpetas planas `.claude/skills/<nombre>/`. Se copiaron también las 16 skills propias y oficiales de Phaser que ya estaban en `.agents/skills/`, para que Claude Code las vea: 96 en total y unos 2 MB.

- Copia sin cambios. Las 8 skills del catálogo que ya existían para Codex coinciden en contenido con las del ZIP; solo cambian los finales de línea.
- Licencias: `GAMEDEV-LICENSE.txt`, `GAMEDEV-NOTICE.txt` y `PHASER-LICENSE.md` en `.claude/skills/`.
- El ZIP no trae subagentes de Claude Code. Las carpetas `agents/` contienen solo `openai.yaml`, metadatos de interfaz para Codex que se conservan sin efecto.
- Revisión: se buscaron órdenes de descarga y ejecución, instrucciones de exfiltración o de ignorar instrucciones. Solo aparecen ejemplos de CI documentados (Steam, instalador de Unity). No se ejecutó ningún script del paquete.
- Presupuesto: las descripciones suman unos 34 500 caracteres. Las de motores ajenos a DEEPKIN (Godot, Unity, Unreal, Roblox, etc.) compiten con las relevantes; si alguna deja de elegirse, conviene borrar de `.claude/skills/` las carpetas de esos motores.
- `.agents/skills/` sigue igual para Codex. Las dos copias son independientes: un cambio en una skill propia debe repetirse en ambas.
