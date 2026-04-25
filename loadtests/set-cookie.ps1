# Helper pra configurar o cookie do Clerk no .env.loadtest sem confusão.
# Uso:
#   .\loadtests\set-cookie.ps1
# (depois cole o header Cookie quando pedir, e Enter)

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "=== Configurar Cookie Clerk para load tests ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Como capturar o header Cookie (Chrome/Edge):"
Write-Host "  1. Login em https://crialook.com.br"
Write-Host "  2. F12 -> aba Network"
Write-Host "  3. Recarregue a pagina (F5)"
Write-Host "  4. Clique na PRIMEIRA request da lista"
Write-Host "  5. Aba 'Headers' -> 'Request Headers' -> linha 'cookie:'"
Write-Host "  6. Clique direito no VALOR -> Copy value"
Write-Host ""
Write-Host "Cole o valor abaixo (vai aparecer como '*' por seguranca) e tecle Enter:"
Write-Host ""

$secure = Read-Host "Cookie" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$cookie = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

if ([string]::IsNullOrWhiteSpace($cookie)) {
    Write-Host "Erro: nada foi colado." -ForegroundColor Red
    exit 1
}

# Sanity checks (sem revelar conteudo)
$hasSession = $cookie.Contains('__session=')
$hasClient  = $cookie.Contains('__client=')
$hasUat     = $cookie.Contains('__client_uat=')
$len = $cookie.Length

Write-Host ""
Write-Host "Validando cookie..." -ForegroundColor Cyan
Write-Host "  Tamanho: $len caracteres"
Write-Host "  Tem __session?     $hasSession"
Write-Host "  Tem __client?      $hasClient"
Write-Host "  Tem __client_uat?  $hasUat"

if (-not $hasSession) {
    Write-Host ""
    Write-Host "AVISO: __session nao encontrado. Auth pode nao funcionar." -ForegroundColor Yellow
}

# Escreve no arquivo
$out = "loadtests\.env.loadtest"
"COOKIE_HEADER=$cookie" | Out-File -FilePath $out -Encoding ASCII -NoNewline

Write-Host ""
Write-Host "OK -> escrito em $out" -ForegroundColor Green
Write-Host ""
Write-Host "Proximo passo:" -ForegroundColor Cyan
Write-Host "  `$line = (Get-Content .\loadtests\.env.loadtest -Raw).Trim()"
Write-Host "  `$env:COOKIE_HEADER = `$line.Substring(`$line.IndexOf('=') + 1)"
Write-Host "  k6 run loadtests/scenarios/03-smoke-authenticated.js"
Write-Host ""
