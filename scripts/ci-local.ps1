# Тот же набор проверок, что и в контуре выпуска, одной командой.
#
# Смысл — не в удобстве: расхождение между «у меня всё зелёное» и гейтом
# обнаруживается через полчаса после отправки, и каждый раз выясняется, что
# локально запускали не то. Здесь запускается ровно то.
#
#   pwsh scripts/ci-local.ps1

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

$steps = @(
    @{ Name = 'типы';    Command = { pnpm exec tsc --noEmit } },
    @{ Name = 'стиль';   Command = { pnpm exec biome check } },
    @{ Name = 'слои';    Command = { pnpm exec steiger ./src } },
    @{ Name = 'докстринги'; Command = { node scripts/check-docs.mjs } },
    @{ Name = 'классы';  Command = { node scripts/check-styles.mjs } },
    @{ Name = 'тесты';   Command = { pnpm exec vitest run } },
    @{ Name = 'сборка';  Command = { pnpm exec next build } }
)

$failed = @()
foreach ($step in $steps) {
    Write-Host "`n=== $($step.Name) ===" -ForegroundColor Cyan
    & $step.Command
    if ($LASTEXITCODE -ne 0) {
        # Не выходим на первом отказе: разработчик должен увидеть весь список за
        # один прогон, а не чинить их по одному, перезапуская всё каждый раз.
        $failed += $step.Name
    }
}

Write-Host ''
if ($failed.Count -gt 0) {
    Write-Host "ОТКАЗ: $($failed -join ', ')" -ForegroundColor Red
    exit 1
}
Write-Host 'Все проверки пройдены.' -ForegroundColor Green
