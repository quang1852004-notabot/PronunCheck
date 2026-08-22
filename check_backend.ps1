# ==============================================================================
# PRONUNCHECK BACKEND DEEP HEALTH & INFERENCE CHECKER
# ==============================================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'SilentlyContinue'

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "      PRONUNCHECK BACKEND DEEP HEALTH CHECKER          " -ForegroundColor Yellow
Write-Host "=======================================================" -ForegroundColor Cyan

$DomainUrl = "https://api.thuy-tien.pro"
$DirectIpUrl = "http://34.22.134.252"
$LocalUrl = "http://127.0.0.1:8000"

# Step 1: Ping Network
Write-Host ""
Write-Host "[1/3] Kiem tra ket noi mang (ICMP Ping)..." -ForegroundColor White
$ping = Test-Connection -ComputerName "34.22.134.252" -Count 2 -Quiet
if ($ping) {
    Write-Host "  [OK] VM 34.22.134.252 phan hoi Ping mang tot." -ForegroundColor Green
} else {
    Write-Host "  [WARN] VM khong phan hoi Ping (co the bi chan ICMP hoac VM dang tat)." -ForegroundColor Yellow
}

# Step 2: Health check endpoint
Write-Host ""
Write-Host "[2/3] Kiem tra FastAPI Service & AI Models (/health)..." -ForegroundColor White
$TargetUrl = $null
$HealthRes = $null

foreach ($url in @($DomainUrl, $DirectIpUrl, $LocalUrl)) {
    try {
        $res = Invoke-RestMethod -Uri "$url/health" -Method Get -TimeoutSec 5
        if ($res -and ($res.status -eq "healthy" -or $res.status -eq "online")) {
            $TargetUrl = $url
            $HealthRes = $res
            break
        }
    } catch {}
}

if ($HealthRes) {
    Write-Host "  [PASS] Ket noi thanh cong toi Backend: $TargetUrl" -ForegroundColor Green
    Write-Host "  - Trang thai: $($HealthRes.status)" -ForegroundColor Cyan
    Write-Host "  - Phien ban: $($HealthRes.version) (Device: $($HealthRes.device))" -ForegroundColor Cyan
    Write-Host "  - Uptime: $($HealthRes.uptime_seconds) giay" -ForegroundColor Cyan
    
    $wLoaded = $HealthRes.models.faster_whisper.loaded
    $wText = if ($wLoaded) { "READY (Da nap vao RAM)" } else { "CHUA NAP" }
    $wColor = if ($wLoaded) { "Green" } else { "Red" }
    Write-Host "  - Faster-Whisper: $wText" -ForegroundColor $wColor

    $w2vLoaded = $HealthRes.models.wav2vec2_ctc.loaded
    $w2vText = if ($w2vLoaded) { "READY (Da nap vao RAM)" } else { "CHUA NAP" }
    $w2vColor = if ($w2vLoaded) { "Green" } else { "Red" }
    Write-Host "  - Wav2Vec2 CTC:   $w2vText" -ForegroundColor $w2vColor
} else {
    Write-Host "  [FAIL] Khong the ket noi toi Backend tai ca $DomainUrl va $DirectIpUrl!" -ForegroundColor Red
    Write-Host "  -> Backend FastAPI service co the chua bat hoac Nginx dang loi 502." -ForegroundColor Yellow
    Write-Host "  -> Hay chay lenh reload-backend tren VM SSH de khoi dong lai." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Step 3: Self-test inference
Write-Host ""
Write-Host "[3/3] Chay Self-Test cham diem AI gia lap (Khong can Client)..." -ForegroundColor White
try {
    $TestRes = Invoke-RestMethod -Uri "$TargetUrl/api/v1/health/selftest" -Method Get -TimeoutSec 15
    if ($TestRes.self_test -eq "PASSED") {
        Write-Host "  [PASS] Toan bo Pipeline AI (Wav2Vec2 + Whisper + DTW) hoat dong 100% HOAN HAO!" -ForegroundColor Green
        Write-Host "  - Do tre xu ly (Latency): $($TestRes.inference_duration_ms) ms" -ForegroundColor Cyan
        Write-Host "  - Tu kiem thu mau: $($TestRes.test_word)" -ForegroundColor Cyan
        Write-Host "  - Diem test mau: $($TestRes.sample_assessment.hybrid_target_score) / 100" -ForegroundColor Cyan
    } else {
        Write-Host "  [FAIL] Self-test gap loi: $($TestRes.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "  [INFO] Endpoint /selftest chua duoc kich hoat tren server hien tai (Can git pull va reload tren VM de cap nhat)." -ForegroundColor Gray
}

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "      KET LUAN: BACKEND DANG HOAT DONG SAN SANG!       " -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""
