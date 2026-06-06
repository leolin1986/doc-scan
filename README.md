# DocScan - 在线文档扫描工具

免费在线图片转扫描件工具，自动边缘检测 + 透视校正 + 图像增强。

## 快速开始

```bash
# 安装依赖
npm install

# 本地开发
npm run dev

# 生产构建
npm run build

# 启动
npm start
```

## 项目结构

```
doc-scan/
├── app/
│   ├── layout.tsx          # 根布局（SEO、Header、Footer）
│   ├── page.tsx            # 首页（Landing）
│   ├── scan/page.tsx       # 扫描页
│   └── globals.css         # 全局样式（Tailwind）
├── components/
│   ├── Header.tsx          # 顶部导航
│   ├── ImageProcessor.tsx  # 核心交互组件（上传/预览/下载）
│   └── AdBanner.tsx        # 广告位组件
├── utils/
│   └── imageProcess.ts     # 图像处理核心算法
├── public/
│   └── cvjs/               # OpenCV.js 文件（可选，当前用 Canvas API）
└── next.config.mjs
```

## 技术栈

- **框架**: Next.js 14 (App Router)
- **UI**: React + TailwindCSS
- **图像处理**: Canvas API（不依赖服务器，浏览器端处理）
- **部署**: Vercel（免费）

## 图像处理流程

1. **上传** → 图片进入 Canvas
2. **边缘检测** → Sobel 算法找文档区域
3. **透视校正** → 检测倾斜角度，自动拉正
4. **增强处理** → 三种模式：
   - ⬛ 黑白扫描：Otsu 阈值二值化
   - 🌈 彩色清晰：对比度 + 亮度增强
   - ✨ 去阴影增强：光照估计 + 归一化

## 部署上线步骤

1. 推送代码到 GitHub
2. Vercel 导入项目，自动部署
3. 绑定域名（如 docscan.com）
4. 接入 Google AdSense：
   - 替换 `layout.tsx` 中的广告脚本
   - 替换 `AdBanner.tsx` 中的广告占位
5. 提交搜索引擎收录（Google Search Console、百度统计）

## SEO 优化建议

- 每个功能页面添加独立 URL（如 `/scan/black-white`）
- 添加 FAQ 页面覆盖长尾词
- 生成 sitemap.xml
- 添加 structured data (JSON-LD)

## License

MIT
