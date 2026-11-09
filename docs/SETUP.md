# Preparación del entorno

Fecha de verificación: 9 de noviembre de 2026, America/Santiago.

## Estado inicial

- Windows x64, versión del sistema 10.0.26300.
- Carpeta actual vacía, sin repositorio Git ni archivos previos.
- Node 24.22.1 y Git 2.56.0.windows.4 suministrados por el entorno de Codex.
- npm y TypeScript no estaban en PATH. Python 3.10 y Winget estaban disponibles. Edge instalado.
- Escritura de archivos, descarga HTTPS e instalación local de dependencias verificadas con éxito.

## Instalación realizada

Node **24.22.2 LTS** y npm **11.19.1** portátiles en `.tools/node-v24.22.2-win-x64`, desde nodejs.org, con SHA256 comparado con SHASUMS256.txt antes de extraer. Sin instaladores del sistema, privilegios de administrador, paquetes npm globales ni cambios permanentes del PATH. Git inicializado en rama main; sin remoto y sin commit inicial.

El wrapper npm.cmd añade el Node portátil al PATH solo de su proceso. activar-entorno.ps1 habilita Node/npm solo durante la consola actual.

| Paquete           | Versión fijada | Uso                                            |
| ----------------- | -------------- | ---------------------------------------------- |
| phaser            | 4.2.1          | motor, física Arcade, cámaras, input y Tilemap |
| typescript        | 6.0.3          | tipos estrictos                                |
| vite              | 8.3.7          | servidor y compilación                         |
| eslint            | 10.14.0        | análisis estático                              |
| @eslint/js        | 10.0.1         | reglas JavaScript                              |
| typescript-eslint | 8.72.2         | reglas TypeScript                              |
| prettier          | 3.9.10         | formato                                        |
| vitest            | 5.1.0          | pruebas de lógica pura                         |
| @playwright/test  | 1.65.0         | pruebas reales de entrada, física y cámara     |

Versiones exactas y dependencias transitivas bloqueadas en package-lock.json. Phaser es la única dependencia directa de ejecución. Playwright es necesario para las comprobaciones obligatorias y usa Edge existente.

## Compatibilidad verificada

Se consultaron metadatos del registro oficial npm y archivos de los repositorios oficiales antes de instalar. Node 24 satisface los engines de Vite, ESLint, Vitest y Playwright. typescript-eslint declara TypeScript >=4.8.4 <6.1.0: por eso se eligió 6.0.3 y no 7.0.2. Vitest 5.1 admite Vite 8. La instalación se completó sin conflictos de peer dependencies.

La plantilla oficial https://github.com/phaserjs/template-vite-ts se usó como referencia de estructura, no se clonó: su package.json referencia Phaser 4.0.0 aunque conserva texto de Phaser 3. Se adaptó la configuración a Phaser 4.2.1/Vite 8.3.7; no se incorporó log.js ni su telemetría. Se verificó la API contra tipos y código del paquete Phaser instalado.

Vite 8 requiere manualChunks como función; createLayer de Phaser 4 puede devolver TilemapLayer o TilemapGPULayer. Se valida la capa CPU para permitir edición de terreno y recálculo inmediato de colisión.

## Uso y restauración

En la carpeta actual, `.\npm.cmd run dev` sirve http://127.0.0.1:5173. Ctrl+C detiene el servidor; strictPort evita cambiar de puerto silenciosamente. Alternativa: `. .\activar-entorno.ps1` y luego `npm run dev`.

Si se copia/clona el proyecto sin `.tools` o node_modules, ejecutar `./scripts/setup.ps1`. Descarga el runtime oficial verificado y usa npm ci. No elimina archivos del proyecto ni modifica configuración global. Con Node 24/npm 11 ya instalados, se puede usar directamente `npm ci`.

La compilación produce dist; `npm run preview` permite inspeccionarla en http://127.0.0.1:4173. El servidor de desarrollo solo escucha en loopback. No se desplegó el juego.

## Auditoría de dependencias

`npm audit --omit=dev`: **0 vulnerabilidades**. Auditoría completa: **10 entradas moderadas** derivadas de un único aviso de minimatch 10.2.6, dependencia transitiva de ESLint/typescript-eslint: https://github.com/advisories/GHSA-g3hv-75wg-m249 (amplificación mediante patrones glob).

La corrección publicada está en minimatch 11.0.1, fuera del rango declarado por esas herramientas. No se aplicó npm audit fix --force ni un override de versión mayor sin respaldo de los mantenedores. Pendiente actualizar la cadena de lint cuando incluya esa corrección. El paquete vulnerable no forma parte del juego compilado.

Fuentes: https://nodejs.org/dist/v24.22.2/ · https://registry.npmjs.org/ · https://github.com/phaserjs/phaser · https://github.com/phaserjs/template-vite-ts
