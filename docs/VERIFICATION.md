# FocusLoop 验证记录

这份记录只列已经完成并可复现的结果。设备依赖项单独标注，避免把编译通过写成真机运行通过。

## 一键检查

Windows PowerShell：

```powershell
powershell -ExecutionPolicy Bypass -File .claude/skills/focusloop-verify/scripts/verify_focusloop.ps1
```

WSL / Linux：

```bash
bash .claude/skills/focusloop-verify/scripts/verify_focusloop.sh
```

脚本依次检查工作区差异、Shell 语法、QuickApp 测试、构建、生产依赖漏洞、RPK、疑似凭证和过期文案，不会清理、提交或上传文件。

## 2026-07-31 结果

| 检查项 | 结果 | 证据位置 |
| --- | --- | --- |
| QuickApp 逻辑与集成约束 | 26/26 通过 | `quickapp/focusloop/test/run.js` |
| QuickApp 构建 | Windows AIoT Toolkit 2.0.5 通过 | `quickapp/focusloop/dist/` |
| debug RPK | 72,450 字节 | `artifacts/FocusLoop-0.1.0-debug.rpk` |
| RPK SHA-256 | `281fc282...302abd3` | `artifacts/FocusLoop-0.1.0-debug.sha256` |
| 生产依赖漏洞 | 0 | `npm audit --omit=dev` |
| 连续测试 | 20/20 轮通过，共 520 项检查 | 本机平均 306 ms，最慢 376 ms |
| 连续构建 | 5/5 轮通过 | 本机平均 2249 ms，最慢 2292 ms |
| Goldfish 系统构建 | 3561 个目标完成 | `scripts/build_goldfish_ai.sh` |
| ai_agent 快速文本补丁 | 可重复应用 | `patches/0001-*.patch` |
| ai_agent 语音桥补丁 | 已完成系统编译与链接 | `patches/0002-*.patch` |

## 运行边界

- `xiaomi_watch_s1` Goldfish 已跑通页面导航、离线计划、专注、答题、进度保存以及 QuickApp 到 `ai_agent` 的请求链路。
- 语音桥已经完成系统编译和链接；端到端语音识别仍需要可用的录音设备与 ASR 服务。
- 智能复习窗口按照大赛 `service.health` 接口实现；压力数据运行验收需要使用带健康服务的 miwear 镜像或兼容设备。
- 应用进程在后台保留时，应用级监测器会继续接收压力和加速度采样。进程被系统结束后，时间型复习仍由 Agent 的持久定时任务负责；情境判断会在应用下次运行后恢复。
