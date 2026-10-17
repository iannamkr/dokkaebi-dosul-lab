param([switch]$NoBrowser, [ValidateRange(1024,65535)][int]$Port = 5173)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$serverScript = Join-Path $PSScriptRoot 'serve.cjs'
$localDir = Join-Path $projectRoot '.local'
$url = 'http://127.0.0.1:' + $Port + '/'
$mutex = New-Object System.Threading.Mutex($false, ('Local\DokkaebiDosulLabLauncher' + $Port))
$locked = $false
$startedProcess = $null
try {
    try { $locked = $mutex.WaitOne(30000) } catch [System.Threading.AbandonedMutexException] { $locked = $true }
    if (-not $locked) { throw '다른 실행 작업이 끝나지 않았습니다. 잠시 후 다시 실행해 주세요.' }
    New-Item -ItemType Directory -Path $localDir -Force | Out-Null
    if (-not (Test-Path -LiteralPath $serverScript)) { throw '프로젝트 서버 파일을 찾을 수 없습니다.' }
    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    $nodePath = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
    if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Node.js를 찾을 수 없습니다. Node.js 20 이상을 설치해 주세요.' }

    # Match this project's absolute server path, never all Node processes.
    $scriptPattern = '(?i)(?:^|[\s"''])' + [regex]::Escape($serverScript) + '(?=[\s"'']|$)'
    $oldServers = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -match $scriptPattern })
    foreach ($oldServer in $oldServers) {
        $serverProcess = Get-Process -Id $oldServer.ProcessId -ErrorAction SilentlyContinue
        if ($serverProcess) {
            Stop-Process -InputObject $serverProcess -Force
            if (-not $serverProcess.WaitForExit(10000)) { throw '기존 서버가 종료되지 않았습니다.' }
        }
    }
    # An unrelated listener must not be stopped just because it uses this port.
    $probe = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
    try { $probe.Start() } catch { throw ($Port.ToString() + ' 포트를 다른 프로그램이 사용하고 있습니다. 해당 프로그램을 종료한 후 다시 실행해 주세요.') } finally { $probe.Stop() }
    $env:PORT = $Port.ToString()
    $startedProcess = Start-Process -FilePath $nodePath -ArgumentList ('"' + $serverScript + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $localDir 'server.log') -RedirectStandardError (Join-Path $localDir 'server-error.log') -PassThru
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        $startedProcess.Refresh()
        if ($startedProcess.HasExited) { throw '서버 시작에 실패했습니다. .local\server-error.log를 확인해 주세요.' }
        try {
            $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) { $ready = $true; break }
        } catch { Start-Sleep -Milliseconds 200 }
    }
    if (-not $ready) { throw '서버 준비 시간이 초과되었습니다.' }
    @{ pid = $startedProcess.Id; startedAt = (Get-Date).ToString('o'); url = $url; script = $serverScript } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $localDir 'server.json') -Encoding UTF8
    if (-not $NoBrowser) { Start-Process $url }
    Write-Output ('Started PID ' + $startedProcess.Id + ' at ' + $url)
} catch {
    if ($startedProcess -and -not $ready) { $startedProcess | Stop-Process -Force -ErrorAction SilentlyContinue }
    if ($NoBrowser) { throw }
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, '도술 연계도 실행 오류', 'OK', 'Error') | Out-Null
    exit 1
} finally {
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
