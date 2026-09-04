$ErrorActionPreference = "Stop"

c:\Users\dark_\OneDrive\Documentos\FidesMoney\fides-money\.venv\Scripts\graphify.exe update .
if ($?) {
    mkdir -Force .planning/graphs | Out-Null
    Copy-Item graphify-out/graph.json .planning/graphs/graph.json -Force
    if (Test-Path graphify-out/graph.html) {
        Copy-Item graphify-out/graph.html .planning/graphs/graph.html -Force
    }
    if (Test-Path graphify-out/GRAPH_REPORT.md) {
        Copy-Item graphify-out/GRAPH_REPORT.md .planning/graphs/GRAPH_REPORT.md -Force
    }
    
    # Run snapshot and status
    node C:\Users\dark_\.claude\gsd-core\bin\gsd-tools.cjs graphify build snapshot
    node C:\Users\dark_\.claude\gsd-core\bin\gsd-tools.cjs graphify status
} else {
    Write-Host "graphify update falhou."
}
