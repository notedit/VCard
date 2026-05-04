# Blind Eval — Image Consistency & Chinese Legibility

满足 m1-test-resources.md §3 的两条人评流水线 + tech-design.md §9 的两条 P0 验收：

| 验收项 | 节奏 | 样本量 | 通过线 |
|---|---|---|---|
| 9 图主体一致 | 每周 | 50 组（每组 9 图） | 平均分 ≥ 4/5 |
| 中文文字可读性 | 每周 | 50 张 | 准确率 ≥ 90% |

## 流程

1. **采样**（脚本，自动）—— 周一 00:00 跑：
   - 从最近 7 天 `gen_jobs.status='done'` 里随机 50 组（每组 9 图），生成匿名链接
   - 从同期 `card_images` 里按 `userEdited=false` 随机 50 张（不抽用户改过的，避免双重评估）
   - 写入两个 CSV：`weekly-YYYY-WW-image.csv` / `weekly-YYYY-WW-text.csv`
   - 上传到 R2 `vcard-eval/<week>/`，给评审一组短链
2. **评审**（人评，2-3 名内测同事）—— 周一 → 周三：
   - 评审填表，列定义见下
   - 每条样本需 ≥2 名评审打分；分歧 >2 分时由第 3 人裁决
3. **聚合**（脚本，自动）—— 周三 23:59：
   - 加权平均 → 写入 `eval_results` 表
   - 触发 alarm：连续 2 周不达标自动开 GitHub Issue

## 评审表列定义

### `image-consistency-template.csv`

按"组"评，每组 9 张：

| 列 | 类型 | 说明 |
|---|---|---|
| set_id | string | GenJob ID 哈希后的匿名 ID |
| reviewer | string | 评审 ID（不暴露给被评者） |
| subject_consistency | int 1-5 | 主体（人/物）外观跨 9 图一致度 |
| style_consistency | int 1-5 | 画风/光线/调色一致度 |
| layout_breakage | int 0-9 | 9 张里有几张构图明显跑偏 |
| comments | string | 自由文本，记录翻车特征 |

**主体一致 ≥ 4/5 = `(subject_consistency + style_consistency) / 2 ≥ 4`**

### `text-legibility-template.csv`

按"张"评：

| 列 | 类型 | 说明 |
|---|---|---|
| image_id | string | CardImage ID 哈希 |
| reviewer | string | 评审 ID |
| text_visible | bool | 图上是否能找到目标文字 |
| text_correct | bool | 文字字符是否完全正确（无错字、无幻字） |
| text_readable | int 1-5 | 字号/对比度/不被挡，是否易读 |
| comments | string | 错字 / 模糊 / 截断 等具体问题 |

**准确率 = `count(text_visible AND text_correct) / total`，目标 ≥ 90%**

## 采样脚本（TODO，等 DB 落地后实装）

伪代码在 `sampler.ts.todo`。当前依赖：

- `gen_jobs` 表 + `card_images` 表（tech-design §6，阶段 1 末就绪）
- R2 `vcard-eval/` bucket（手动建一次）
- Sentry / Cloudflare Analytics 报警（阶段 3 接入）

## 不适用清单

- **不评**：用户主动 edit 过的图（已脱离 agent 直出）
- **不评**：单卡重生触发的图（评估闭环节奏不一样，单独跟踪）
- **不评**：测试环境产出（用 `project.tags ⊃ 'test'` 过滤掉）
