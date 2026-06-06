# 文档扫描项目 – 会话记录 2025-04-09

## 项目路径
`F:\atomcode\doc-scan` (Next.js 14.2 + TypeScript)

## 核心文件
- `utils/imageProcess.ts` — 全部图像处理逻辑（Canny 边缘检测、Hough 直线检测、四边形拟合、透视校正）
- `app/page.tsx` — 主页面 UI
- `components/ImageProcessor.tsx` — 图像上传/处理组件
- `components/CornerEditor.tsx` — 手动角点编辑器

## 当前已知问题（尚未解决）

### 问题 1：自动边缘检测 + 裁剪效果差
用户测试结果：自动检测到的文档倾斜（向左上角），且没有按文档边缘裁剪。

#### 当前算法流程
1. 上传 → canvas 读取 → 降采样到短边 800px
2. 对 3 组参数（高斯模糊 sigma + Canny 百分位阈值）分别尝试：
   - `[1.5, 0.40, 0.75]` — 足够边缘输入
   - `[2.5, 0.50, 0.82]` — 中等
   - `[4.0, 0.60, 0.90]` — 强模糊，仅最强边缘
3. 每组：Canny → Hough 直线变换 → `findDocumentCorners` → `findQuadrilateralFromLines`
4. `findQuadrilateralFromLines` 返回角点后 → 透视校正 → 输出原图尺寸裁剪结果
5. 所有尝试都失败 → 退回全图处理（不裁剪）

#### 已做的修复
- **修复 ρ/θ 不匹配 bug**：之前将 θ 强制设为 π/2/0 但 ρ 没重算，导致求交和排序全错
- **降低 Canny 阈值**：p40/p75 → 更多边缘供 Hough 投票
- **降低评分准入分**：score >= 0.25 → 0.15
- **增加排列组合**：不只取最极端聚类，尝试前3后3组合

#### 仍然存在的问题
检测结果仍然倾斜，说明角点检测仍然不准确。

### 问题 2：手动角点编辑（可能仍可用）
`CornerEditor.tsx` 提供手动画布上的角点拖拽，但用户希望自动检测能工作。

## 未确认的潜在问题

### 1. `orderCorners` 返回顺序是 [TL, BL, BR, TR] 但代码按 [TL, TR, BR, BL] 处理
- `CornerPoints` 类型只标注了 `[Point, Point, Point, Point]`
- `orderCorners` 按质心角度排序，结果是 TL→BL→BR→TR
- 之后 `detectAndCorrectEdges` 中：
  - `docW = max(dist(corners[0], corners[1]), dist(corners[3], corners[2]))`
    - `corners[0]→corners[1]` = TL→BL = 左侧边（实际是高）
    - `corners[3]→corners[2]` = TR→BR = 右侧边（实际是高）
  - 结果：docW 和 docH 互换，输出比例可能不对
- **但这不是裁剪无效的根本原因**

### 2. Hough 直线投票阈值
```typescript
const minVotes = Math.min(w, h) * 0.12;
```
对于 800×600 图像，minVotes = 72。文档边缘 ~600px → 可正确检出。

### 3. 百分位阈值的实际效果
- p75: 只有顶部的 25% NMS 值被标记为"强边缘"
- p40: 顶部的 60% 被标记为"弱边缘"
- 纸张边界如果占了 < 25% 的总边缘像素 → 可能被截断

## 下一步建议的诊断方向

1. **在前端添加调试可视化**：将 Canny 边缘图和 Hough 检测到的直线绘制到 canvas 上，肉眼确认边缘检测是否正确
2. **检查 `houghLineTransform` 的参数**：numTheta=180, numRho=2*maxRho+1，minVotes 可能太严格
3. **检查 `findDocumentCorners` 中的角点选择**：从 Hough 线到四边形拟合的转换是否正确
4. **尝试更简单的基准测试**：用纯白背景+黑色矩形文档的合成图像测试检测管线，排除拍照光照/阴影干扰

## 启动命令
```bash
cd /d F:\atomcode\doc-scan
npm run dev
# 访问 http://localhost:3000
```
