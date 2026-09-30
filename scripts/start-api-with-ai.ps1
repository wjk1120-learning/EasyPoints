# 本机跑 API，避开 Docker Hub 拉 MySQL/Node/Nginx 大镜像卡住。
# 只启动已缓存的 Redis；数据默认走内存 store。
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$env:FORCE_MEMORY_STORE = "1"
$env:REDIS_URL = "redis://127.0.0.1:6379/0"
Remove-Item Env:MYSQL_HOST -ErrorAction SilentlyContinue

Write-Host "Starting Redis..."
docker compose -f infra/docker-compose.yml up -d redis

Write-Host "Starting EasyPoints API on http://localhost:3000"
node apps/api/src/server.js
