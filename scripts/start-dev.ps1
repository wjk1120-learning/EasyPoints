# EasyPoints 一键启动开发环境（Windows / PowerShell）。
# 用法：
#   powershell -ExecutionPolicy Bypass -File scripts\start-dev.ps1            # 启动 API + 小程序编译监听
#   powershell -ExecutionPolicy Bypass -File scripts\start-dev.ps1 -AdminWeb  # 额外启动管理后台
# 各进程开在独立窗口，关闭对应窗口即停止该服务。
param(
    [switch]$AdminWeb
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

function Start-DevWindow {
    param([string]$Title, [string]$WorkDir, [string]$Command)
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "`$Host.UI.RawUI.WindowTitle = '$Title'; Set-Location '$WorkDir'; $Command"
    )
}

Write-Host "== EasyPoints 开发环境 ==" -ForegroundColor Cyan

# 1. Redis（Compose 里已缓存的小镜像；连不上也不阻塞，API 会退回内存模式）
Write-Host "[1/3] 启动 Redis..."
docker compose -f "$root\infra\docker-compose.yml" up -d redis 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "      Redis 启动失败（无 Docker 或镜像未缓存），API 将使用内存 Store，不影响开发。" -ForegroundColor Yellow
}

# 2. API（内存 Store，端口 3000）
Write-Host "[2/3] 启动 API（新窗口，端口 3000）..."
Start-DevWindow -Title "EasyPoints API" -WorkDir $root -Command "node apps/api/src/server.js"

# 3. 小程序编译监听（产出 apps/miniapp/dist/dev/mp-weixin，微信开发者工具导入该目录）
Write-Host "[3/3] 启动小程序编译监听（新窗口）..."
Start-DevWindow -Title "EasyPoints Miniapp" -WorkDir "$root\apps\miniapp" -Command "npm run dev:mp-weixin"

if ($AdminWeb) {
    Write-Host "[extra] 启动管理后台（新窗口，端口 5173）..."
    Start-DevWindow -Title "EasyPoints Admin" -WorkDir "$root\apps\admin-web" -Command "npm run dev"
}

Write-Host ""
Write-Host "全部服务已在独立窗口启动。" -ForegroundColor Green
Write-Host "下一步："
Write-Host "  1. 微信开发者工具导入 apps/miniapp/dist/dev/mp-weixin（首次需等待编译完成）"
Write-Host "  2. 模拟器默认请求 http://localhost:3000，即上面启动的 API"
Write-Host "  3. H5 联调（可选）：apps/miniapp 下执行 npm run dev:h5，浏览器访问 http://localhost:5174"
