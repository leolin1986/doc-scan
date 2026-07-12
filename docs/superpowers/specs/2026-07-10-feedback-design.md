# DocScan 网页版用户反馈功能设计

## 概述

为 DocScan 网页版（scanfree.tech）添加用户反馈功能，让用户可以通过浮窗按钮提交评分、Bug 报告、功能建议或其他留言。反馈内容通过 Vercel Serverless Function + Resend 转发到开发者邮箱。

## 技术方案

- **UI**: React 组件（FeedbackButton + FeedbackModal），右下角悬浮按钮，点击弹窗一页式表单
- **后端**: Next.js API Route (`/api/feedback`) + Resend 邮件 API
- **环境变量**: `RESEND_API_KEY` + `FEEDBACK_EMAIL`
- **i18n**: 中英文双语（扩展现有 `zh.json` / `en.json`）

## 交互流程

```
用户点击悬浮「反馈」按钮
  → 弹窗展开（一页式表单）
    → ⭐ 评分（1-5 星，必选）
    → 📂 分类（Bug 报告 / 功能建议 / 其他留言，默认"其他留言"）
    → 📝 留言框（多行文本，必填）
    → 📧 邮箱（可选，用于回复联系）
    → ✅ 提交按钮
  → 提交中（按钮禁用 + loading）
  → 提交成功（感谢提示，2 秒自动关闭）
  → 提交失败（Toast 提示重试）
```

## 组件设计

### FeedbackButton 组件
- 固定在页面右下角 (`fixed bottom-6 right-6`)
- 半透明背景，hover 不透明
- 文字 `t("feedback.button")`
- 点击切换 FeedbackModal 显示/隐藏
- 仅网页版渲染（`!isCapacitor` 判断）

### FeedbackModal 组件
- 居中弹窗，最大宽度 ~420px
- 点击遮罩层外部可关闭
- 包含完整表单内容和状态管理
- 三个状态：`idle` | `submitting` | `success` | `error`

## API 设计

```
POST /api/feedback
Content-Type: application/json

Body: {
  rating: number,        // 1-5，必填
  category: string,      // "bug" | "feature" | "other"，必填
  message: string,       // 留言内容，必填
  email?: string,        // 邮箱，选填
  url?: string,          // 当前页面 URL，自动采集
  timestamp: string      // ISO 时间，自动生成
}

Response 200: { success: true }
Response 400: { error: "缺少必要字段" }
Response 500: { error: "发送失败" }
```

## 邮件格式（Resend）

发送到 `blackboy007pp@hotmail.com`，邮件正文格式化如下：

```
[评分] ⭐⭐⭐⭐ (4/5)
[分类] Bug 报告
[页面] https://scanfree.tech/scan
[时间] 2026-07-10 14:30
[邮箱] user@example.com（选填）

[留言内容]
xxxxxxxxx
```

## i18n 新增键

| key | zh | en |
|-----|----|----|
| feedback.button | 反馈 | Feedback |
| feedback.rating_label | 评分 | Rating |
| feedback.category_label | 分类 | Category |
| feedback.category_bug | Bug 报告 | Bug Report |
| feedback.category_feature | 功能建议 | Feature Suggestion |
| feedback.category_other | 其他留言 | Other |
| feedback.message_placeholder | 请描述您的意见或遇到的问题... | Describe your feedback or issue... |
| feedback.email_placeholder | 选填：邮箱（方便我们回复您） | Optional: Email (for us to reply) |
| feedback.submit | 提交反馈 | Submit Feedback |
| feedback.submitting | 提交中... | Submitting... |
| feedback.success | 感谢您的反馈！ | Thank you for your feedback! |
| feedback.error | 提交失败，请稍后重试 | Submission failed, please try again |
| feedback.rating_required | 请选择评分 | Please select a rating |
| feedback.message_required | 请输入留言内容 | Please enter your message |

## 错误处理

- 前端校验：评分未选 → 标红提示；留言为空 → 标红提示
- 提交中：按钮 disabled + 显示"提交中..."
- API 返回非 200：Toast 显示失败提示
- 网络异常：catch 后显示失败提示
- 提交成功：Modal 内显示感谢文字和勾号动画，2 秒后自动关闭

## 部署配置

1. 注册 Resend → 获取 API Key
2. Vercel 控制台添加环境变量：
   - `RESEND_API_KEY` = `re_xxxxx`
   - `FEEDBACK_EMAIL` = `blackboy007pp@hotmail.com`
3. 重新部署触发环境变量生效

## 未来扩展

- 数据存储：当前仅发邮件，API 数据结构已预留所有字段
- 后续可加 Supabase 写入行，实现评分统计趋势图
- 添加存储时只需在 API route 加一行写入调用，前后端 UI 不动

## 不包含范围

- Android（Capacitor）版不加反馈按钮
- 不做用户登录/身份识别
- 不做批量导出/管理后台