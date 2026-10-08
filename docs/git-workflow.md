# Git 协作流程

团队采用「功能分支」模式：每个人在自己的分支上开发，`master` 只收完整无误的可用代码。

## 分支约定

- `master`：主分支，只进开发完成、检查通过的可用代码。
- 个人功能分支：如 `hotdog`、`feature/sousuo`，日常开发和提交都在自己的分支 日常操作

## 日常操作

### 1. 每天下班前：备份进度

提交并推送到自己的分支（不是 master）：

```bash
git add .
git commit -m "今天做了xxx"
git push origin hotdog
```

### 2. 隔几天：同步 master 的最新代码

```bash
git fetch origin
git merge origin/master
git push origin hotdog
```

建议每周至少同步一次，拖久了冲突会越积越多。

### 3. 功能开发完成：合入 master

先自测通过，再合并。推荐走 GitHub Pull Request（仓库页面点 Compare & pull request），有记录可回看，队友也能帮忙把关。

本地直接合并的写法：

```bash
git fetch origin
git merge origin/master     # 先同步，确保在最新 master 基础上合并
git checkout master
git merge hotdog
git push origin master
git checkout hotdog         # 切回自己的分支继续开发
```

## 注意事项

- 当天代码自测跑不通时，只推自己的分支，不要合入 master。
- 队友需要你的进行中的代码时，直接从你的功能分支拉取合并，不必等它进 master。
- 合并遇到冲突时，以最新 master 的代码为基准逐行确认，不确定的地方找代码原作者一起看。
