@echo off
setlocal
set "PATH=%~dp0.tools\node-v24.22.2-win-x64;%PATH%"
call "%~dp0.tools\node-v24.22.2-win-x64\npm.cmd" %*
