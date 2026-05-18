@echo off
cd /d "%~dp0"
echo === STATUS DO REPOSITORIO ===
git log --oneline -5
echo.
echo === REMOTE CONFIGURADO ===
git remote -v
echo.
echo Se o commit aparecer acima, tudo certo!
echo Proxima etapa: configurar o remote do GitHub.
pause
