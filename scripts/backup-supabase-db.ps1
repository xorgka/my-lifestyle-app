param(
  [string]$BackupRoot = "C:\Users\xorgk\Backups\my-lifestyle-app-db",
  [int]$KeepLatest = 30
)

$ErrorActionPreference = "Stop"

function Resolve-PgDumpPath {
  $candidates = @(
    "C:\Tools\postgresql-bin\pgsql\pgsql\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"
  )
  foreach ($p in $candidates) {
    if (Test-Path $p) { return $p }
  }
  $cmd = Get-Command pg_dump.exe -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Path) { return $cmd.Path }
  throw "pg_dump.exe not found. Install PostgreSQL client tools first."
}

function Ensure-Directory([string]$path) {
  if (-not (Test-Path $path)) {
    New-Item -ItemType Directory -Path $path -Force | Out-Null
  }
}

function Get-ConnectionString {
  if (-not [string]::IsNullOrWhiteSpace($env:SUPABASE_DB_URL)) {
    return $env:SUPABASE_DB_URL
  }
  if (-not [string]::IsNullOrWhiteSpace($env:DATABASE_URL)) {
    return $env:DATABASE_URL
  }
  return $null
}

Ensure-Directory $BackupRoot
$logPath = Join-Path $BackupRoot "backup.log"

try {
  $pgDump = Resolve-PgDumpPath
  $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $dumpPath = Join-Path $BackupRoot ("supabase_" + $timestamp + ".dump")
  $conn = Get-ConnectionString

  if (-not $conn) {
    throw "Set SUPABASE_DB_URL or DATABASE_URL env var with your Postgres connection string."
  }

  & $pgDump --format=custom --no-owner --no-privileges --dbname="$conn" --file="$dumpPath"
  if ($LASTEXITCODE -ne 0) {
    throw "pg_dump failed with exit code $LASTEXITCODE"
  }

  $all = Get-ChildItem -Path $BackupRoot -Filter "supabase_*.dump" | Sort-Object LastWriteTime -Descending
  if ($all.Count -gt $KeepLatest) {
    $all | Select-Object -Skip $KeepLatest | Remove-Item -Force
  }

  Add-Content -Path $logPath -Value ("[" + (Get-Date).ToString("s") + "] OK  " + $dumpPath)
  Write-Output "Backup completed: $dumpPath"
} catch {
  Add-Content -Path $logPath -Value ("[" + (Get-Date).ToString("s") + "] ERR " + $_.Exception.Message)
  Write-Error $_.Exception.Message
  exit 1
}
