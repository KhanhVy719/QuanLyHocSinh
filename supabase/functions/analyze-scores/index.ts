import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { classId } = await req.json();
    if (!classId) {
      return new Response(JSON.stringify({ error: "classId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch ALL students in this class
    const { data: students } = await supabase
      .from("students")
      .select("id, name, group_name, status")
      .eq("class", classId);

    if (!students || students.length === 0) {
      return new Response(
        JSON.stringify({ error: "No students found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch ALL score logs for ALL students with full details
    const ids = students.map((s: any) => s.id);
    const { data: logs } = await supabase
      .from("score_logs")
      .select("student_id, change, note, score_after, created_at")
      .in("student_id", ids)
      .order("created_at", { ascending: true });

    // Build comprehensive student data with ALL logs and reasons
    const studentSummaries = students.map((s: any) => {
      const studentLogs = (logs || []).filter((l: any) => l.student_id === s.id);
      const totalChange = studentLogs.reduce((sum: number, l: any) => sum + l.change, 0);
      const currentScore = 10 + totalChange;

      // Separate additions and deductions with reasons
      const additions = studentLogs
        .filter((l: any) => l.change > 0)
        .map((l: any) => ({
          points: `+${l.change}`,
          reason: l.note || "Không ghi lý do",
          date: l.created_at,
        }));

      const deductions = studentLogs
        .filter((l: any) => l.change < 0)
        .map((l: any) => ({
          points: `${l.change}`,
          reason: l.note || "Không ghi lý do",
          date: l.created_at,
        }));

      return {
        id: s.id,
        name: s.name,
        group: s.group_name || "Không tổ",
        status: s.status || "Đang học",
        currentScore,
        totalAdditions: additions.reduce((sum: number, a: any) => sum + parseFloat(a.points), 0),
        totalDeductions: deductions.reduce((sum: number, d: any) => sum + parseFloat(d.points), 0),
        additionDetails: additions,
        deductionDetails: deductions,
        totalLogs: studentLogs.length,
      };
    });

    // Call Gemini API
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `Bạn là trợ lý AI chuyên phân tích hành vi và kết quả học tập của học sinh dựa trên sổ đầu bài.

## Dữ liệu học sinh lớp ${classId}:
${JSON.stringify(studentSummaries, null, 2)}

## Hướng dẫn phân tích:
- Điểm mặc định ban đầu mỗi học sinh là 10
- Mỗi lần vi phạm sẽ bị trừ điểm (change < 0) kèm lý do
- Mỗi lần làm tốt sẽ được cộng điểm (change > 0) kèm lý do
- Hãy đọc KỸ từng lý do cộng/trừ điểm để đánh giá hành vi học sinh
- Phân tích xu hướng: ai đang sa sút, ai đang tiến bộ
- Xác định học sinh nguy cơ: điểm thấp, bị trừ nhiều lần, lý do trừ nghiêm trọng
- Xác định học sinh tiến bộ: được cộng điểm nhiều, lý do cộng tích cực

## Yêu cầu output:
Trả về JSON THUẦN (không markdown, không code block) với format:
{
  "declining": [
    {"id": "mã HS", "name": "tên", "reason": "phân tích ngắn gọn bằng tiếng Việt dựa trên lý do trừ điểm"}
  ],
  "improving": [
    {"id": "mã HS", "name": "tên", "reason": "phân tích ngắn gọn bằng tiếng Việt dựa trên lý do cộng điểm"}
  ],
  "atRisk": [
    {"id": "mã HS", "name": "tên", "score": số_điểm, "reason": "phân tích chi tiết bằng tiếng Việt, nêu rõ các lý do bị trừ"}
  ],
  "summary": "Nhận xét tổng hợp 3-5 câu bằng tiếng Việt: đánh giá chung về lớp, các vấn đề nổi bật, và đề xuất cho giáo viên"
}

Nếu học sinh chưa có log nào thì KHÔNG đưa vào declining/improving/atRisk.
Chỉ phân tích những học sinh CÓ dữ liệu log.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    const geminiData = await geminiRes.json();

    // Debug: check if Gemini returned an error
    if (!geminiRes.ok || geminiData?.error) {
      return new Response(JSON.stringify({
        declining: [], improving: [], atRisk: [],
        summary: `Lỗi Gemini API: ${geminiData?.error?.message || JSON.stringify(geminiData?.error) || `HTTP ${geminiRes.status}`}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse AI response
    let analysis;
    try {
      const cleaned = aiText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      // Return raw text as summary so user can see what Gemini returned
      analysis = {
        declining: [],
        improving: [],
        atRisk: [],
        summary: aiText || `Gemini không trả về dữ liệu. Status: ${geminiRes.status}. Data: ${JSON.stringify(geminiData).substring(0, 500)}`,
      };
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
