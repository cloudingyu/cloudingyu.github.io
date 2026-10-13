# 当前网站仓库

课程笔记的整理、复核、同步与提交任务，先读取 `course-notes/AGENTS.md` 和 `course-notes/README.md`，使用该项目的完整工作流。

网站笔记范围以 `src/data/notebook-config.mjs` 为准。OnlineCourses 和 main-notes 是只读输入；新的整理成果、公开核查记录和来源清单提交到本仓库。

笔记通过 `notes:prepare → 整理与独立复核 → notes:validate → notes:publish` 更新。发布后运行 `npm run check`、`npm run build`、`npm run verify`；涉及工作流代码时另运行 `npm run notes:test`。

提交仅暂存当前任务的精确路径，保留用户其他未提交修改。其他网站开发遵循现有 README 和源码约定。
