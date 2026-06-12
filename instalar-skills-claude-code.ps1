# Script para instalar as skills do Open Design no Claude Code
# Execute no PowerShell como Administrador ou usuario normal

$odSkills = "C:\Users\dark_\AppData\Local\Programs\Open Design release-stable-win\resources\open-design\skills"
$claudeSkills = "$env:USERPROFILE\.claude\skills"

# Verificar se o Open Design esta instalado
if (-not (Test-Path $odSkills)) {
    Write-Host "ERRO: Open Design nao encontrado em: $odSkills" -ForegroundColor Red
    Write-Host "Verifique o caminho de instalacao." -ForegroundColor Red
    exit 1
}

Write-Host "Open Design encontrado!" -ForegroundColor Green
Write-Host "Copiando skills para: $claudeSkills" -ForegroundColor Cyan
Write-Host ""

# Lista de skills para copiar
$skills = @(
    "taste-skill",
    "frontend-design",
    "redesign-skill",
    "design-brief",
    "brandkit",
    "soft-skill",
    "impeccable-design-polish",
    "emilkowalski-motion",
    "imagegen-frontend-web",
    "imagegen-frontend-mobile",
    "image-to-code-skill",
    "faq-page"
)

$copied = 0
foreach ($s in $skills) {
    $src = "$odSkills\$s\SKILL.md"
    $dest = "$claudeSkills\od-$s"

    if (Test-Path $src) {
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
        Copy-Item $src "$dest\SKILL.md" -Force
        Write-Host "  OK: od-$s" -ForegroundColor Green
        $copied++
    } else {
        Write-Host "  SKIP: $s (SKILL.md nao encontrado)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Pronto! $copied skills instaladas no Claude Code." -ForegroundColor Green
Write-Host "Reinicie o Claude Code para ativar." -ForegroundColor Cyan
