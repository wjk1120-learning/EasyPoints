# 一键启动本地开发环境：后端 API + 管理后台（各开一个独立窗口，方便看日志和 Ctrl+C 停止）
#
# 用法（在项目根目录执行）：
#   powershell -ExecutionPolicy Bypass -File .\scripts\start-dev.ps1
#   powershell -ExecutionPolicy Bypass -File .\scripts\start-dev.ps1 -UseMysql
#
# 默认使用内存模式（不需要 MySQL/Docker，自带示例数据，重启后数据清空）。
# 加 -UseMysql 参数则按 .env 配置连接 MySQL（需先启动 Docker Desktop，监听 3307）。
param(
    [switch]$UseMysql
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

# ---- 后端 API（新窗口）----
$apiPrefix = ""
if (-not $UseMysql) {
    $apiPrefix = "`$env:FORCE_MEMORY_STORE = '1'; Write-Host '[API] 内存模式，无需 MySQL' -ForegroundColor Yellow; "
}
$apiCmd = $apiPrefix + "Set-Location '$root'; Write-Host '[API] http://localhost:3000' -ForegroundColor Green; node apps/api/src/server.js"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $apiCmd

# ---- 管理后台（新窗口）----
$webCmd = "Set-Location '$root\apps\admin-web'; Write-Host '[Web] http://localhost:5173' -ForegroundColor Green; node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5173"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $webCmd

Write-Host ""
Write-Host "EasyPoints 本地环境启动中："
Write-Host "  管理后台: http://localhost:5173   (登录账号 admin / admin123)"
Write-Host "  后端 API: http://localhost:3000   (健康检查 /health)"
if ($UseMysql) {
    Write-Host "  数据存储: MySQL（.env 配置，需确保 Docker Desktop 已启动）" -ForegroundColor Cyan
} else {
    Write-Host "  数据存储: 内存模式（重启后数据清空）" -ForegroundColor Cyan
}
Write-Host "停止方式：关闭对应的两个 PowerShell 窗口（或在窗口内按 Ctrl+C）。"
