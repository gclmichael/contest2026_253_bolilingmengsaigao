# openvela 核心架构

openvela 是面向 AIoT 场景的开源嵌入式操作系统，内核基于 Apache NuttX。
NuttX 提供接近 POSIX 的编程接口，便于已有软件组件迁移到资源受限设备。

QuickApp 使用模板、样式和 JavaScript 构建轻量界面，可以通过系统 feature
访问存储、振动、传感器等设备能力。`system.velaclaw` 把 QuickApp 的文本请求
交给端侧 `ai_agent`。

`ai_agent` 可以调用工具执行定时任务。FocusLoop 使用 `cron_add` 保存一次性
复习任务，到达指定时间后由 `launch_quickapp` 主动打开应用。
