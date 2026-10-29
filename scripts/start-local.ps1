$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

try {
    foreach ($command in @('docker', 'npm.cmd')) {
        if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
            throw "Required command not found: $command. Install Node.js and Docker Desktop first."
        }
    }

    docker info --format '{{.ServerVersion}}'
    if ($LASTEXITCODE -ne 0) {
        throw 'Start Docker Desktop, wait until the engine is running, then run npm run dev again.'
    }

    if (-not (Test-Path -LiteralPath '.env')) {
        Copy-Item -LiteralPath '.env.example' -Destination '.env'
    }

    if (-not (Test-Path -LiteralPath 'node_modules/next/package.json')) {
        npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw 'Node dependency installation failed.' }
    }

    # Read the resolved port without printing the environment or API credentials.
    $composeConfigJson = docker compose config --format json
    if ($LASTEXITCODE -ne 0) { throw 'Docker Compose configuration is invalid.' }
    $composeConfig = ($composeConfigJson -join "`n") | ConvertFrom-Json
    $apiPort = ($composeConfig.services.api.ports | Where-Object { $_.target -eq 8000 } | Select-Object -First 1).published
    if (-not $apiPort) { throw 'API port is missing in the Compose configuration.' }
    $env:NEXT_PUBLIC_API_BASE_URL = "http://localhost:$apiPort"

    docker compose up -d --build --wait --wait-timeout 180 api postgres
    if ($LASTEXITCODE -ne 0) { throw 'API or database startup failed. Check docker compose logs.' }

    Write-Host "API ready: $env:NEXT_PUBLIC_API_BASE_URL"
    Write-Host 'Web: http://localhost:3000'
    Write-Host 'Ctrl+C stops the web server. Use docker compose stop to stop the API and database.'
    npm.cmd run dev --workspace apps/web -- --port 3000
    exit $LASTEXITCODE
}
catch {
    Write-Error $_ -ErrorAction Continue
    exit 1
}
