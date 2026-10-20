# EasyPoints 易积分系统

企业微信生态的员工积分管理系统 monorepo,包含:

| 目录 | 说明 |
| --- | --- |
| `apps/admin-web` | PC 管理后台(Vue 3 + Vite + Element Plus),契约见各域 `src/api/*/types.ts` |
| `apps/miniapp` | 员工端(uni-app,目标编译到企业微信小程序) |
| `apps/Easy-Points` | 后端(Spring Boot 4 + MyBatis + MySQL + Redis)。**独立 git 仓库**(嵌套仓库,外层 .gitignore 已忽略),接口/部署说明见其内部 `README.md` 与 `Easy-Points-API.md` |

## 本地开发

- 后端:进入 `apps/Easy-Points`,按其 README 使用 `docker compose up -d --build mysql redis app` 启动全链路(MySQL/Redis/应用容器);企微等凭据复制 `.env.example` 为 `.env` 填写(不入库)。
- 管理后台:`apps/admin-web`,Vite 代理指向 `http://localhost:3000`。
- 旧的 Node 后端(`apps/api`)与 `infra/` 基础设施编排已于 2026-10 移除,环境统一由后端自带 compose 提供。
