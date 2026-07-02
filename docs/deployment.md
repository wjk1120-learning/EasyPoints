# 部署说明

## 单服务器 Docker

1. 复制 `.env.example` 为 `.env`，替换数据库密码、JWT 密钥和企业微信配置。
2. 安装 Docker 和 Docker Compose。
3. 在 `infra` 目录执行：

```bash
docker compose up -d
```

4. 检查健康状态：

```bash
curl http://localhost/health
```

### 已有 MySQL 数据库的增量迁移

首次初始化会自动执行 `infra/mysql/schema.sql`，但如果数据库已经创建过，后续新增字段需要手动执行迁移脚本。

本次通知已读能力需要补充 `message_outbox.read_at` 字段，可执行：

```bash
docker compose -f infra/docker-compose.yml exec -T mysql \
  mysql -uroot -proot-change-me -D easy_points \
  < infra/mysql/migrations/20260611_add_message_outbox_read_at.sql
```

执行后可用以下命令确认字段已存在：

```bash
docker compose -f infra/docker-compose.yml exec -T mysql \
  mysql -uroot -proot-change-me -D easy_points -e "DESCRIBE message_outbox;"
```

## 企业微信配置

- 配置可信域名和业务域名。
- 将企业微信 `corpId`、应用 `agentId`、`secret` 写入环境变量。
- 后端消息发送采用 outbox 设计：业务先写消息表，再由 worker 发送并重试。

## 生产注意事项

- `seed.sql` 中的默认密码哈希必须替换为 bcrypt 真实哈希。
- MySQL、Redis 不建议直接暴露公网端口。
- Nginx 应配置 HTTPS 证书。
- 备份策略至少覆盖 MySQL 每日快照和 point_records 长期归档。
