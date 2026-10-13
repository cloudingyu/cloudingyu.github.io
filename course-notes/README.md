# 网站课程笔记整理

本项目位于当前网站仓库中，使用 Codex 中用户选择的 6-luna，将完整课堂还原笔记整理成适合直接阅读的网站知识笔记。脚本负责盘点、版本追踪、准备草稿、校验和发布；实际写作与内容复核由 Codex 或人工完成。

当前只处理 2026 秋季概统、计算理论基础、操作系统、计算机视觉。每次课一篇，篇内按知识主题组织。原始课堂资料和代餐笔记保留在外部目录；整理成果进入本仓库的 `notebook/2026-autumn/`。

## 文件布局

| 路径 | 用途 | 是否提交 |
| --- | --- | --- |
| `AGENTS.md` | 整理、核查、发布和提交规则 | 是 |
| `prompts/rewrite.md`、`prompts/review.md` | 正文写作与独立复核指令 | 是 |
| `config.example.json` | 外部来源路径示例 | 是 |
| `local.config.json` | 本机实际来源路径 | 否 |
| `catalog.json` | 课次、相对来源路径、指纹和发布状态 | 是 |
| `.work/<课程ID>/<日期>/<来源指纹>/` | 输入副本、task.md、正文草稿和核查草稿 | 否 |
| `reviews/<课程ID>/<日期>.json` | 已发布版本的公开核查记录 | 是 |
| `../notebook/2026-autumn/<课程ID>/<日期>.md` | 网站实际读取的整理成果 | 是 |

没有新的嵌套 Git 仓库。公开核查记录只保存知识验证依据及源目录相对定位，不复制完整字幕、个人对话或本机绝对路径。

## 首次使用

在仓库根目录使用 Node.js 22.12 或更新版本，依赖沿用网站：

```powershell
npm ci
Copy-Item course-notes/config.example.json course-notes/local.config.json
```

编辑 `local.config.json` 中的 `notes_root` 和 `courses_root`。本机已配置到用户指定的 `main-notes/Markdown` 和 `OnlineCourses`；新机器才需要复制示例并修改路径。没有 API 密钥配置。

```powershell
npm run notes:inventory
npm run notes:status
```

盘点四个配置课程顶层的 Markdown 原笔记，文件名以 `2026.月.日.md` 结尾；按课程和日期定位 SRT/DOCX、复查报告和当天材料。内容计算 SHA-256；大体积录屏只记录大小和修改时间。

初始清单有 20 个课次：概统 7 篇、计算理论基础 5 篇、操作系统 4 篇、计算机视觉 4 篇。原始转写为 19 份 SRT 和概统 9 月 23 日的 DOCX。初始均为待整理；旧网站快照没有被标为整理成果。

## 完整工作流

### 1. 选取新增或变更的课次

先 inventory，再 status。状态包括待整理、缺原始转写、需要更新、已发布、来源缺失。来源变更后已发布旧版标为需要更新，构建门禁会要求处理；来源删除只标记，不自动删除页面。

课程 ID：`probability`、`computation`、`os`、`vision`。课次 ID 为课程 ID 加 ISO 日期：

```powershell
npm run notes:prepare -- --note probability/2026-09-30
```

命令返回实际工作目录。同来源版本再次运行继续已有草稿；来源变化生成新指纹目录，旧草稿保留。

### 2. 用 6-luna 整理

在当前仓库的 Codex 中选择 6-luna，将下方路径替换为 prepare 的输出：

```text
按 course-notes/AGENTS.md 整理 probability/2026-09-30。
工作目录是 <prepare 返回的目录>，先读 task.md 和 prompts/rewrite.md。
完整读取 source.md，提取知识清单，结合原复查报告回查疑点。
将网站正文写入 note.md，填好 review.json 的章节映射、补充、疑点和
实际阅读范围。完成自检，保留 draft，交给独立复核。
```

正文保留有效知识、必要动机、直觉、定义、条件、证明、算法和例题。学术问答融入知识主题；删除事务、闲聊、日期元信息、来源时间和转写过程。source_units 是自动定位的来源章节范围，不是自动识别出的完整知识清单；必须逐段列出实际知识，检查无标题段落。

长篇按完整主题分段，保持命题与证明、题目与解答连续。分段后通读全文、统一符号、合并重复。补齐内容使用 `**补充推导**`、`**补充解答**`；纠正明确错误用 `**勘误**`。参数缺失不能猜测；原始字幕也存在识别错误，不能当作正确结论证明。

### 3. 独立复核

由没有撰写本文的人工或另一复核会话执行，可以使用同一模型的另一会话。复核会话由用户打开，或在用户明确要求后由 Codex 创建；脚本不自动发送消息。

```text
按 course-notes/prompts/review.md 独立复核 <工作目录> 的网站笔记。
逐段对照来源，重算例题和公式，核实补充与勘误，回查至少 5 个具体
断言。记录真实复核身份、依据及阅读范围。修复后复核相关部分；
全部完成才将 checks 置为 true、status 改为 ready。
```

`review.json` 字段：

| 字段 | 规则 |
| --- | --- |
| `author` | 实际撰写身份/会话标识 |
| `source_units` | 保留原 ID、标题和行范围；填写 include/merge/exclude、具体理由和正文标题文本（不含 ##） |
| `additions` | 每项 `{type, output_heading, reason, verified}`；类型为补充推导/补充解答/勘误，reason 写依据，verified 仅在核实后为 true |
| `issues` | 每项 `{description, status, reason}`；open 阻止发布，resolved/omitted 需解释处理结果 |
| `checks` | 五项实际内容检查完成后分别置为 true |
| `reading` | 原笔记、转写、材料的实际阅读范围；未读取和无材料也如实写明 |
| `reviewer` | 不同于作者的实际身份、independent、至少 5 条 `{claim, evidence, verdict: "pass"}` |
| `status` | 初始 draft，完成独立复核后 ready |

机检无法判断知识是否全部保留、结论是否正确或身份是否真实。部分字幕回查应写实际范围，不能继承上游报告的“全文审计”声明。

### 4. 校验与发布

```powershell
npm run notes:validate -- --note probability/2026-09-30
npm run notes:publish -- --note probability/2026-09-30
```

publish 再检查外部来源是否改变、工作区输入完整性、章节覆盖、补充/疑点、独立复核、正文规范和 LaTeX。通过后仅更新该篇网站正文、对应 reviews 文件和 catalog 发布指纹。

`npm run notes:sync -- --note probability/2026-09-30` 是 publish 的别名。旧的 `notes:sync -- "原笔记根目录"` 已停止使用，并会明确报错，防止还原版再次覆盖网站成果。

### 5. 网站校验与阅读检查

```powershell
npm run check
npm run build
npm run verify
npm run preview
```

查看 `/course-note/probability/2026-09-30/` 的实际排版，重点检查公式、代码、标题和例题。check/build 自动执行 notes:check，验证已发布整理成果的哈希和核查结构。CI 仅读仓库文件，无需外部来源或 local.config.json。

尚未整理的旧快照只报告待整理数量；零篇整理成果时，通过的是流程启动校验，不能称为知识验收。

### 6. 提交到当前仓库

批次通过后，仅暂存实际更新的正文、核查记录和来源清单：

```powershell
git add -- notebook/2026-autumn/probability/2026-09-30.md course-notes/reviews/probability/2026-09-30.json course-notes/catalog.json
git diff --cached
git commit -m "Organize probability notes for 2026-09-30"
```

多篇按实际路径展开，不使用 git add -A 混入其他修改。推送在用户要求时执行；提交后的 Markdown 由现有 GitHub Pages 流程构建。

## 增量与恢复

- 新课次：完成 OnlineCourses 还原并同步统一原笔记库，再走 inventory → prepare → 整理 → 独立复核 → validate → publish → 网站校验 → 当前仓库提交。
- 原材料变更：重新 inventory、prepare 新版本，可参考旧正文，但不能复制旧核查结论作为新版本复核。
- 修网站版错误：继续 .work 草稿，修改正文和记录，重新复核、发布；不直接改发布文件绕过校验。
- 新机器或草稿丢失：prepare 建立新草稿，可将已发布正文作为修订起点；保留新建核查模板，实际重新复核后发布。
- 发布中断：三个文件逐个原子写入；再次 publish 完成更新。check 会识别不完整的哈希状态。
- 新学期：共同调整网站课程配置、日期解析和页面加载规则；当前明确限定为 2026 秋季。

## 工作流代码验证

```powershell
npm run notes:test
```

测试使用临时模拟来源和仓库，覆盖发布门禁、来源变更、离线校验、逐篇更新和输入完整性，不改真实课程文件。
