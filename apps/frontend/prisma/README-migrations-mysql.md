# Prisma 迁移（MySQL 环境）

当前 `prisma/schema.prisma` 的 `datasource` 为 `mysql`，我们已将 `migrations/migration_lock.toml` 的 `provider` 同步为 `mysql`。

仓库中现有的 `prisma/migrations/` 多个迁移目录包含 PostgreSQL 专用的 SQL（如 `TEXT[]`、`public` schema 等），不适用于 MySQL。为避免误用：

- 不要在 MySQL 环境中直接执行这些 PostgreSQL 迁移脚本；
- 开发/测试环境推荐使用 `db push`；
- 生产环境可使用我们生成的 MySQL 基线 SQL 或在重置迁移后使用 `prisma migrate`。

## 开发/测试（推荐）

1. 确认 `DATABASE_URL` 指向 MySQL
2. 推送 Schema 到数据库：

```bash
cd apps/frontend
npx prisma db push
npx prisma generate
```

## 生产环境（两种方式）

方式 A：使用已生成的 MySQL 基线 SQL（手动执行）

- 基线文件：`apps/frontend/prisma/migrations-mysql/000_init_baseline.sql`
- 在新库执行该 SQL，随后即可使用 `db push` 小步演进，或后续通过 `prisma migrate diff` 生成增量变更。

方式 B：重置迁移并改用 Prisma Migrate（推荐长期方案）

1. 备份并归档现有 `prisma/migrations/`（这些是 PostgreSQL 脚本，不再用于 MySQL）。
2. 基于当前 Schema 初始化 MySQL 迁移：

```bash
cd apps/frontend
npx prisma migrate dev --name init --create-only
```

3. 审核生成的迁移 SQL（应为 MySQL 方言），并通过 CI/CD 在各环境使用 `npx prisma migrate deploy`。

## 关于 `SecurityThreat` 模型字段调整

- 将 `indicators`、`affectedResources`、`recommendedActions` 从 `String[]` 改为 `Json?` 以兼容 MySQL。
- 如业务层仍需数组语义，请在读写时对 JSON 进行序列化/反序列化（`string[] <-> Json`）。

## 注意

- 如果你在 MySQL 上执行 `prisma migrate dev`，请确保迁移目录中仅包含 MySQL 兼容的迁移（或采用上面的“方式 B”先重置迁移）。
- 如果需要，我们可以帮助把 PostgreSQL 迁移完整迁移/翻译为 MySQL 版本，但工作量较大，建议从基线重置开始。

