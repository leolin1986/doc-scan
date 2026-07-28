# 扫立得 H5 手机版设计

## 背景

扫立得（DocScan）现有桌面版网页（Next.js 14 + TailwindCSS），部署在 Vercel。现需新增 H5 手机版，通过微信公众号底部菜单二维码扫码访问，供用户在手机端完成文档扫描。

- 微信公众号：已注册未认证，通过菜单弹出二维码，用户扫码访问
- 部署方式：同域名子路径 `/wechat/`
- 保留现有桌面版网页不动

## 目标

- 用户扫码 → H5 页面 → 拍照/相册 → 预览 → 三种模式处理 → 手动角点编辑 → 下载/长按保存
- 完整功能，UI 全触屏优化
- 微信内置浏览器适配（下载走长按保存+按钮双保险）

## 方案

新增 `/wechat` 路由组，共享核心图像处理逻辑（`@/utils/imageProcess`），UI 按手机触屏重新设计。桌面版代码零改动。

## 路由结构

```
app/
├── (landing)/            ← 桌面版，不动
├── scan/                 ← 桌面版，不动
├── wechat/               ← 新增 H5 版
│   ├── layout.tsx        ← 极简手机布局
│   └── page.tsx          ← H5 扫描主页
components/
├── WechatScanner.tsx     ← 新增 H5 扫描组件（触屏优化）
├── WechatCornerEditor.tsx← 新增触屏版角点编辑器
```

## 用户流程

```
扫码 → 首页（拍照/相册入口）→ 拍照/选图 → 加载中 → 预览页
→ 选模式（黑白/彩色/去阴影的变体，触屏友好）→ 处理 → 结果展示
→ 手动角点编辑（可选）→ 下载页（大图预览 + 长按保存提示 + 下载按钮）
```

H5 版每次仅处理 1 张图片，不支持多图片管理，流程更短更聚焦。

## 触屏优化要点

- 所有按钮尺寸 ≥ 48px，间距 ≥ 12px
- 角点编辑拖拽手柄放大至 40px+，适配手指操作
- 操作栏吸附底部，固定在 `safe-area-inset-bottom` 之上
- 模式选择改为横向滑动标签或大按钮卡片
- 缩略图条改为横向滚动
- 页面禁止缩放（已有的 viewport 设置保留）

## 微信适配

- 下载双保险：处理完成后展示大图模态框，提示"长按图片保存"，同时保留下载按钮尝试 `canvas.toBlob` 方式
- 拍照使用 `<input capture="environment" accept="image/*">`
- 页面标题/描述针对微信分享优化
- 统计仅保留基础 PV 埋点，不在微信内加载 AdSense

## 组件职责

### WechatScanner.tsx
- 拍照/相册入口
- 图片预览 + 缩略图横向滚动
- 三种模式选择（触屏版大按钮）
- 调用 `@/utils/imageProcess` 处理
- 结果展示 + 下载/长按保存
- 复用现有 LoadingOverlay

### WechatCornerEditor.tsx
- 触屏版角点编辑
- 拖拽手柄放大
- 缩放/平移画布适配小屏
- 确认/取消按钮

## 布局

- 极简顶部栏：Logo + 当前步骤提示（无导航链接）
- 全屏内容区
- 底部操作栏（安全区适配）
- 无页脚、无广告、无语言切换器

## 不包含的功能

- 多图片管理（最多1张，简化流程）
- 桌面端拖拽上传
- 广告展示
- 多语言切换（仅中文）
- 隐私政策弹窗

## 数据流

```
用户拍照/选图 → base64 dataUrl → setState
→ 选择模式 → setActiveMode
→ 点击扫描 → detectDocumentCorners(dataUrl) → setLastCorners
→ 用户确认/调整角点 → processImageWithCorners(dataUrl, corners, mode) → setResult
→ 下载/长按保存 → result.dataUrl 展示或下载
```