# logs/ - AI Coding 日志目录

存放你在开发中与 AI 工具的对话日志，和作品代码一并提交。

不要手工编写或修改 JSONL；应使用赛事采集工具导出真实会话，并在提交前逐个预览。

## 目录结构

```text
logs/
└── <github_login>/              # 你的 GitHub 用户名，一人一目录
    ├── manifest.json            # 会话清单
    └── <date>/                  # 日期 YYYY-MM-DD
        └── <tool>__<sid>.jsonl  # 一个会话一个文件（工具名与 session id 用 __ 连接）
```

- `<tool>`：`claude-code` / `opencode` / `codex` / `kiro`
- 每个 `.jsonl` 每行一个事件，由组委会提供的日志归集工具导出，**只提交 JSONL 本身**。

建议按以下顺序操作：

```bash
contest-snapshot --list
contest-snapshot --session <session-id>
contest-snapshot --session <session-id> --confirm
```

未追加 `--confirm` 时只预览，不写入仓库。包含凭证、私人内容或其他项目内容的会话应整段排除，不能删改其中几行后提交。

导出与提交的完整步骤、字段定义见[《AI Coding 日志归集与提交手册》](https://github.com/open-vela/docs/blob/dev-ai-contest-2026/zh-cn/contest_2026/ai_coding_log_guide.md)。
