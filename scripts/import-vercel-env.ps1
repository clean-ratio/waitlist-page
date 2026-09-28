$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot '.env'
if (-not (Test-Path $envPath)) {
  throw 'Project .env file was not found.'
}

$localEnvPath = Join-Path $projectRoot '.env.local'
$values = @{}
foreach ($path in @($envPath, $localEnvPath)) {
  if (-not (Test-Path $path)) { continue }
  Get-Content $path | ForEach-Object {
    if ($_ -match '^\s*(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)\s*=(.*)$') {
      $values[$matches[1]] = $matches[2].Trim().Trim('"')
    }
  }
}

foreach ($name in @('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY')) {
  if ([string]::IsNullOrWhiteSpace($values[$name])) {
    throw "Missing $name in project .env file."
  }
}

foreach ($environment in @('development', 'preview', 'production')) {
  foreach ($name in @('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY')) {
    $arguments = @('env', 'add', $name, $environment, '--force')
    if ($name -eq 'SUPABASE_SERVICE_ROLE_KEY' -and $environment -ne 'development') {
      $arguments += '--sensitive'
    }

    $values[$name] | & vercel @arguments
    if ($LASTEXITCODE -ne 0) {
      throw "Vercel import failed for $name ($environment)."
    }
    Write-Host "Imported $name into $environment."
  }
}