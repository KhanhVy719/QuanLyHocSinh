import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { classId, dateStart, dateEnd, analysisType } = await req.json();
    // analysisType: 'scores' (default) | 'conduct'
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

    // Fetch score logs with optional date filtering
    const ids = students.map((s: any) => s.id);
    let query = supabase
      .from("score_logs")
      .select("student_id, change, note, score_after, created_at")
      .in("student_id", ids)
      .order("created_at", { ascending: true });

    if (dateStart) query = query.gte("created_at", dateStart);
    if (dateEnd) query = query.lte("created_at", dateEnd);

    const { data: logs } = await query;

    // Build student summaries
    const studentSummaries = students.map((s: any) => {
      const studentLogs = (logs || []).filter((l: any) => l.student_id === s.id);
      const totalChange = studentLogs.reduce((sum: number, l: any) => sum + l.change, 0);
      const currentScore = totalChange; // Base score is 0

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

    // Build prompt based on analysis type
    const type = analysisType || "scores";
    const timePeriod = dateStart && dateEnd ? `từ ${dateStart.substring(0, 10)} đến ${dateEnd.substring(0, 10)}` : "toàn bộ thời gian";

    let prompt: string;
    if (type === "conduct") {
      // Hạnh kiểm analysis
      prompt = `Bạn là trợ lý AI chuyên xếp loại hạnh kiểm học sinh dựa trên sổ điểm thi đua.

## Dữ liệu học sinh lớp ${classId} (${timePeriod}):
${JSON.stringify(studentSummaries, null, 2)}

## Quy tắc xếp hạnh kiểm:
- Điểm mặc định ban đầu là 0. Cộng/trừ dựa trên hành vi.
- **Tốt**: Điểm >= 0, không vi phạm nghiêm trọng, có nhiều điểm cộng
- **Khá**: Điểm >= -3, vi phạm nhẹ, có cố gắng sửa chữa
- **Trung bình**: Điểm >= -7, vi phạm nhiều lần nhưng không quá nghiêm trọng
- **Yếu**: Điểm < -7, vi phạm nhiều, lý do nghiêm trọng
- Hãy đọc KỸ lý do cộng/trừ điểm để xếp loại chính xác
- Xem xét cả tần suất vi phạm và mức độ nghiêm trọng

## Yêu cầu output:
Trả về JSON THUẦN (không markdown, không code block):
{
  "conductRatings": [
    {"id": "mã HS", "name": "tên", "score": số_điểm, "rating": "Tốt/Khá/Trung bình/Yếu", "reason": "lý do xếp loại ngắn gọn"}
  ],
  "statistics": {
    "tot": số_lượng_tốt,
    "kha": số_lượng_khá,
    "trungBinh": số_lượng_tb,
    "yeu": số_lượng_yếu
  },
  "warnings": [
    {"id": "mã HS", "name": "tên", "reason": "cảnh báo cụ thể cho HS cần lưu ý"}
  ],
  "summary": "Nhận xét tổng hợp 3-5 câu: tỷ lệ hạnh kiểm, vấn đề nổi bật, đề xuất"
}

Chỉ xếp loại cho học sinh CÓ dữ liệu log. Học sinh chưa có log = Tốt (chưa vi phạm).`;
    } else {
      // Score analysis (original)
      prompt = `Bạn là trợ lý AI chuyên phân tích hành vi và kết quả học tập của học sinh dựa trên sổ đầu bài.

## Dữ liệu học sinh lớp ${classId} (${timePeriod}):
${JSON.stringify(studentSummaries, null, 2)}

## Hướng dẫn phân tích:
- Điểm mặc định ban đầu mỗi học sinh là 0
- Mỗi lần vi phạm sẽ bị trừ điểm (change < 0) kèm lý do
- Mỗi lần làm tốt sẽ được cộng điểm (change > 0) kèm lý do
- Hãy đọc KỸ từng lý do cộng/trừ điểm để đánh giá hành vi học sinh
- Phân tích xu hướng: ai đang sa sút, ai đang tiến bộ
- Xác định học sinh nguy cơ: điểm thấp, bị trừ nhiều lần, lý do trừ nghiêm trọng
- Xác định học sinh tiến bộ: được cộng điểm nhiều, lý do cộng tích cực

## Yêu cầu output:
Trả về JSON THUẦN (không markdown, không code block):
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
    }

    // Call Gemini API
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    const geminiData = await geminiRes.json();

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

    let analysis;
    try {
      const cleaned = aiText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      analysis = {
        declining: [],
        improving: [],
        atRisk: [],
        summary: aiText || `Gemini không trả về dữ liệu. Status: ${geminiRes.status}.`,
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
