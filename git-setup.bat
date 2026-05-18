@echo off
cd /d "%~dp0"
echo === Configurando git...
git config user.email "deyglisonfsouza@gmail.com"
git config user.name "Deyglison"
echo === Adicionando arquivos...
git add .
echo === Fazendo commit...
git commit -m "feat: Fides Money v2 — initial commit"
echo.
echo === Pronto! Verifique acima se o commit foi criado.
echo === Proxima etapa: adicionar remote e fazer push.
pause
