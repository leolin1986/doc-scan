import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const CATEGORY_LABELS: Record<string, string> = {
  bug: "Bug 报告",
  feature: "功能建议",
  other: "其他留言",
};

interface FeedbackBody {
  rating: number;
  category: string;
  message: string;
  email?: string;
  url?: string;
  timestamp?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: FeedbackBody = await request.json();

    // Validation
    if (!body.rating || body.rating < 1 || body.rating > 5) {
      return NextResponse.json({ error: "评分必须在 1-5 之间" }, { status: 400 });
    }
    if (!["bug", "feature", "other"].includes(body.category)) {
      return NextResponse.json({ error: "无效的分类" }, { status: 400 });
    }
    if (!body.message || body.message.trim().length === 0) {
      return NextResponse.json({ error: "留言内容不能为空" }, { status: 400 });
    }

    const stars = "⭐".repeat(body.rating);
    const categoryLabel = CATEGORY_LABELS[body.category] || body.category;
    const pageUrl = body.url || "(unknown)";
    const timestamp = body.timestamp || new Date().toISOString();
    const formattedTime = new Date(timestamp).toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai",
    });

    const emailHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#333;">📬 用户反馈</h2>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:bold;">评分</td>
              <td style="padding:8px 12px;">${stars} (${body.rating}/5)</td></tr>
          <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:bold;">分类</td>
              <td style="padding:8px 12px;">${categoryLabel}</td></tr>
          <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:bold;">页面</td>
              <td style="padding:8px 12px;">${pageUrl}</td></tr>
          <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:bold;">时间</td>
              <td style="padding:8px 12px;">${formattedTime}</td></tr>
          ${body.email ? `<tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:bold;">邮箱</td><td style="padding:8px 12px;">${body.email}</td></tr>` : ""}
        </table>
        <div style="border-top:1px solid #eee;padding-top:16px;margin-top:16px;white-space:pre-wrap;">
          <strong>留言内容：</strong><br>${body.message}
        </div>
      </div>
    `;

    if (resend) {
      await resend.emails.send({
        from: "DocScan Feedback <onboarding@resend.dev>",
        to: process.env.FEEDBACK_EMAIL || "blackboy007pp@hotmail.com",
        subject: `[DocScan 反馈] ${categoryLabel} - ${body.rating}/5`,
        html: emailHtml,
      });
    } else {
      // Dev fallback: log to console
      console.log("=== FEEDBACK (no RESEND_API_KEY) ===", {
        rating: body.rating,
        category: body.category,
        message: body.message,
        email: body.email,
        url: pageUrl,
        timestamp: formattedTime,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Feedback API error:", error);
    return NextResponse.json({ error: "发送失败" }, { status: 500 });
  }
}