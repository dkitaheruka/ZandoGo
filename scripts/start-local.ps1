param(
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$environmentFile = Join-Path $projectRoot '.env'
$apiPort = 3001
$webPort = 3002
$webUrl = "http://localhost:$webPort"

function Test-TcpPort([string]$HostName, [int]$Port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $connection = $client.BeginConnect($HostName, $Port, $null, $null)
    if (-not $connection.AsyncWaitHandle.WaitOne(1000)) {
      return $false
    }

    $client.EndConnect($connection)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Test-HttpEndpoint([string]$Url) {
  try {
    $response = Invoke-WebRequest -Uri $Url -TimeoutSec 4 -UseBasicParsing
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

try {
  if (-not (Test-Path -LiteralPath $environmentFile)) {
    throw 'Missing .env file. Copy .env.example to .env and configure PostgreSQL.'
  }

  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules'))) {
    throw 'Dependencies are missing. Open a terminal in the project root and run npm ci.'
  }

  $settings = @{}
  foreach ($line in [System.IO.File]::ReadLines($environmentFile)) {
    if ($line -match '^\s*([^#=\s]+)\s*=(.*)$') {
      $settings[$Matches[1].Trim()] = $Matches[2].Trim()
    }
  }

  if ($settings.ContainsKey('PORT') -and $settings['PORT'] -match '^\d{1,5}$') {
    $apiPort = [int]$settings['PORT']
  }

  $databaseUrl = $settings['DATABASE_URL']
  if (-not $databaseUrl) {
    $databaseUrl = 'postgresql://postgres:postgres@localhost:5433/zandogo?schema=public'
  }

  $databaseUri = $null
  if (-not [Uri]::TryCreate($databaseUrl, [UriKind]::Absolute, [ref]$databaseUri)) {
    throw 'DATABASE_URL in .env is not a valid PostgreSQL URL.'
  }

  if (-not (Test-TcpPort $databaseUri.Host $databaseUri.Port)) {
    throw "PostgreSQL is not reachable on port $($databaseUri.Port). Start PostgreSQL and try again."
  }

  $apiUrl = "http://localhost:$apiPort"
  $apiHealthUrl = "$apiUrl/api/categories"
  if (-not (Test-HttpEndpoint $apiHealthUrl)) {
    if (Test-TcpPort 'localhost' $apiPort) {
      throw "API port $apiPort is occupied, but the API is not responding correctly. Check the process using it."
    }

    Start-Process -FilePath $env:ComSpec `
      -ArgumentList @('/k', 'npm run dev:api') `
      -WorkingDirectory $projectRoot | Out-Null

    $apiReady = $false
    $apiDeadline = (Get-Date).AddSeconds(90)
    while ((Get-Date) -lt $apiDeadline) {
      if (Test-HttpEndpoint $apiHealthUrl) {
        $apiReady = $true
        break
      }
      Start-Sleep -Seconds 2
    }

    if (-not $apiReady) {
      throw 'The API did not start. Check the API window and DATABASE_URL.'
    }
  }

  $webHealthUrl = "$webUrl/api/categories"
  if (-not ((Test-HttpEndpoint $webUrl) -and (Test-HttpEndpoint $webHealthUrl))) {
    if (Test-TcpPort 'localhost' $webPort) {
      throw "Frontend port $webPort is occupied, but the site or its API proxy is not responding correctly."
    }

    $webCommand = 'set "VITE_API_URL=/api" && set "VITE_API_PROXY_TARGET=http://localhost:' +
      $apiPort +
      '" && npm run dev --workspace=@ecommerce/web -- --port ' +
      $webPort +
      ' --strictPort --bypass-lock --force'

    Start-Process -FilePath $env:ComSpec `
      -ArgumentList @('/k', $webCommand) `
      -WorkingDirectory $projectRoot | Out-Null

    $webReady = $false
    $webDeadline = (Get-Date).AddSeconds(60)
    while ((Get-Date) -lt $webDeadline) {
      if ((Test-HttpEndpoint $webUrl) -and (Test-HttpEndpoint $webHealthUrl)) {
        $webReady = $true
        break
      }
      Start-Sleep -Seconds 2
    }

    if (-not $webReady) {
      throw 'The frontend did not start correctly. Check the Vite window.'
    }
  }

  Write-Host "ZandoGo is ready: $webUrl" -ForegroundColor Green
  Write-Host 'PostgreSQL, API, and frontend proxy are reachable.'

  if (-not $NoBrowser) {
    Start-Process $webUrl
  }
} catch {
  Write-Host "Could not start ZandoGo: $($_.Exception.Message)" -ForegroundColor Red
  Read-Host 'Press Enter to close'
  exit 1
}
