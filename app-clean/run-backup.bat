@echo off
setlocal
cd /d "%~dp0"
echo Iniciando proceso de copia de seguridad...
npm run backup
if %errorlevel% neq 0 (
    echo [ERROR] La copia de seguridad ha fallado.
    pause
) else (
    echo [EXITO] Copia de seguridad completada.
)
endlocal
