# 本机运行 API（可访问 DeepSeek）。MySQL/Redis 需先用 Docker 启动。
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$env:MYSQL_HOST = "127.0.0.1"
$env:MYSQL_PORT = "3307"

Write-Host "Starting EasyPoints API on http://localhost:3000 (DeepSeek enabled via .env)"
node apps/api/src/server.js
