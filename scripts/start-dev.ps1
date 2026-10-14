# 一键启动本地开发环境：后端(Docker) + 管理后台 + 小程序编译监听（各开独立窗口，方便看日志和 Ctrl+C 停止）
#
# 用法（在项目根目录执行）：
#   powershell -ExecutionPolicy Bypass -File .\scripts\start-dev.ps1               # 后端 + 管理后台
#   powershell -ExecutionPolicy Bypass -File .\scripts\start-dev.ps1 -Miniapp      # 额外启动小程序编译监听
#
# 后端为 apps/Easy-Points 里的 Docker 编排（SpringBoot app + MySQL + Redis + Nginx，app 监听 127.0.0.1:3000）。
param(
    [switch]$Miniapp
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

# ---- 后端全家桶（Docker，app 端口 127.0.0.1:3000）----
Write-Host "[后端] 启动 Docker 服务（apps/Easy-Points/docker-compose.yml）..." -ForegroundColor Cyan
$backendOk = $false
try {
    docker compose -f "$root\apps\Easy-Points\docker-compose.yml" up -d 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $backendOk = $true }
} catch {}
if ($backendOk) {
    Write-Host "[后端] 等待健康检查..."
    $healthy = $false
    foreach ($i in 1..30) {
        try {
            $resp = Invoke-RestMethod -Uri "http://localhost:3000/health" -TimeoutSec 2 -ErrorAction Stop
            if ($resp.data.ok) { $healthy = $true; break }
        } catch { Start-Sleep -Seconds 2 }
    }
    if ($healthy) { Write-Host "[后端] 已就绪：http://localhost:3000" -ForegroundColor Green }
    else { Write-Host "[后端] 健康检查超时，请查看 docker compose 日志。" -ForegroundColor Yellow }
} else {
    Write-Host "[后端] 未启动（Docker 未运行或 apps/Easy-Points 缺失），页面能打开但接口会报错。" -ForegroundColor Yellow
}

# ---- 管理后台（新窗口）----
$webCmd = "Set-Location '$root\apps\admin-web'; Write-Host '[Web] http://localhost:5173' -ForegroundColor Green; node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5173"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $webCmd

# ---- 小程序编译监听（可选，产出 apps/miniapp/dist/dev/mp-weixin，微信开发者工具导入该目录）----
if ($Miniapp) {
    $mpCmd = "Set-Location '$root\apps\miniapp'; Write-Host '[Miniapp] 微信开发者工具导入 apps/miniapp/dist/dev/mp-weixin' -ForegroundColor Green; npm run dev:mp-weixin"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $mpCmd
}

Write-Host ""
Write-Host "EasyPoints 本地环境启动中："
Write-Host "  管理后台: http://localhost:5173   (登录账号 admin / admin123)"
Write-Host "  后端 API: http://localhost:3000   (健康检查 /health)"
if ($Miniapp) {
    Write-Host "  小程序:   微信开发者工具导入 apps/miniapp/dist/dev/mp-weixin"
    Write-Host "            H5 联调（可选）：apps/miniapp 下执行 npm run dev:h5，浏览器访问 http://localhost:5174"
}
Write-Host "停止方式：关闭对应的 PowerShell 窗口（或在窗口内按 Ctrl+C）；后端用 docker compose stop。"
