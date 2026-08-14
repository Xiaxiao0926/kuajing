# Secret Audit 报告

> 审计日期：2026-08-14
> 审计人：AI 执行代理（DeepSeek Harness）
> 审计范围：D:\ozon 全仓库（含 git 历史、已删除文件、未跟踪文件）
> 结论：**在本报告记录的扫描范围与规则内，未发现已知敏感凭据。**（该表述不构成数学意义上的绝对保证，xlsx/pdf 等二进制业务资产未经内容级解析。）

---

## 1. 审计范围与方法

### 1.1 扫描对象

| 对象 | 说明 |
|---|---|
| 工作树 tracked 文件（179 个） | 文本类（js/mjs/py/json/md/txt/html/htm/css）逐文件模式扫描 |
| init commit `747f254` 历史 | `git grep` 全历史扫描（含后续已删除的 `jd-union-service/`） |
| 未跟踪文件 | 重读时工作树已干净（0 untracked） |
| 敏感文件直查 | `.env` / `.pem` / `.key` / `.p12` / `ai_config` / `credential` / `cookie` 等文件名模式 |

### 1.2 高危模式清单

```
API_KEY, api_key, apikey, TOKEN, token=, SECRET, secret=, PASSWORD, passwd,
Authorization, Bearer, github_pat_, ghp_, gho_, sk-[A-Za-z0-9]{20,},
AKIA[0-9A-Z]{16}, -----BEGIN (RSA )?PRIVATE KEY, cookies.json, credentials
```

## 2. 发现与处置

### 2.1 零真实密钥命中

- 工作树 tracked 文件：**0 命中**真实密钥字面量。
- init commit 历史：仅 1 处命中 `jd-union-service/jd_client.py:11 self.app_secret = JD_APP_SECRET`——这是**环境变量引用**，非密钥字面量，安全。

### 2.2 凭据类文件

- 全仓不存在 `.env`、`.pem`、`.key`、`.p12`、`ai_config.json`、`credentials.json`、`cookies.json`。
- `ozon-product-analyzer/utils/ai_service.py` 读取 `ai_config.json`（运行时生成），该文件已被 `.gitignore`（`**/ai_config.json`）覆盖，从未入库。

### 2.3 已删除的 jd-union-service（init commit 内）

`jd-union-service/config.py` 确认密钥走 `os.environ.get("JD_APP_KEY")` / `os.environ.get("JD_APP_SECRET")`，代码中仅引用变量名。该目录已在快照 commit `7456a6d` 中删除，历史中无真实密钥残留。

### 2.4 大文件

- `cloudflared.exe`（51.7MB）已 gitignore，未入库；T0-6 已确认无引用后删除。
- 业务 xlsx 最大 3.6MB，均低于 GitHub 100MB 限制。

## 3. 结论

在本报告记录的扫描范围与规则内，仓库 git 历史与当前工作树**未发现已知敏感凭据**。该结论不构成数学意义上的绝对保证（xlsx/pdf 等二进制业务资产未经内容级解析）。后续安全防线依赖 `AGENTS.md` 禁止事项（禁止提交密钥/凭据）与 `.gitignore` 持续维护。

## 4. 附录：扫描命令存档

详见 `_audit/raw/`（如存在）。本次扫描命令：

```powershell
# 高危模式扫描（tracked 文本文件）
Select-String -Path <tracked text files> -Pattern 'API_KEY|SECRET|TOKEN|ghp_|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|BEGIN (RSA )?PRIVATE KEY'

# git 历史扫描
git grep -I -n -E 'ghp_|sk-[A-Za-z0-9]{20,}|AKIA|-----BEGIN [A-Z ]*PRIVATE KEY' 747f254

# 敏感文件名直查
Get-ChildItem -Recurse -Force | Where-Object { $_.Name -match '(?i)^\.env|ai_config|credential|secret|token|cookie|\.(pem|key|p12|pfx)$' }
```
