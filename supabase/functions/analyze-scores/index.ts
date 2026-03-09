import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function classifyConduct(score: number, totalDeductions: number): string {
  if (score >= 0) return "Tốt";
  if (score >= -3) return "Khá";
  if (score >= -7) return "Trung bình";
  return "Yếu";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { classId, dateStart, dateEnd, analysisType } = await req.json();
    if (!classId) {
      return new Response(JSON.stringify({ error: "classId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    const ids = students.map((s: any) => s.id);
    let query = supabase
      .from("score_logs")
      .select("student_id, change, note, created_at")
      .in("student_id", ids)
      .order("created_at", { ascending: true });

    if (dateStart) query = query.gte("created_at", dateStart);
    if (dateEnd) query = query.lte("created_at", dateEnd);

    const { data: logs } = await query;

    const type = analysisType || "scores";
    const timePeriod = dateStart && dateEnd
      ? `từ ${dateStart.substring(0, 10)} đến ${dateEnd.substring(0, 10)}`
      : "toàn bộ thời gian";

    // Build compact student data (no detailed logs to save tokens)
    const studentData = students.map((s: any) => {
      const studentLogs = (logs || []).filter((l: any) => l.student_id === s.id);
      const totalChange = studentLogs.reduce((sum: number, l: any) => sum + l.change, 0);
      const totalAdd = studentLogs.filter((l: any) => l.change > 0).reduce((sum: number, l: any) => sum + l.change, 0);
      const totalDeduct = studentLogs.filter((l: any) => l.change < 0).reduce((sum: number, l: any) => sum + l.change, 0);
      // Only keep last 3 deduction reasons (most recent) to save tokens
      const recentDeductions = studentLogs
        .filter((l: any) => l.change < 0)
        .slice(-3)
        .map((l: any) => l.note || "Không rõ");
      const recentAdditions = studentLogs
        .filter((l: any) => l.change > 0)
        .slice(-3)
        .map((l: any) => l.note || "Không rõ");

      return {
        id: s.id,
        name: s.name,
        score: totalChange,
        adds: totalAdd,
        deducts: totalDeduct,
        logs: studentLogs.length,
        recentBad: recentDeductions,
        recentGood: recentAdditions,
      };
    });

    // For CONDUCT analysis: calculate ratings SERVER-SIDE, only ask AI for summary
    if (type === "conduct") {
      const conductRatings = studentData
        .filter((s: any) => s.logs > 0)
        .map((s: any) => ({
          id: s.id,
          name: s.name,
          score: s.score,
          rating: classifyConduct(s.score, Math.abs(s.deducts)),
          reason: s.recentBad.length > 0
            ? `${s.deducts} điểm trừ (${s.recentBad.join(', ')})`
            : `${s.adds} điểm cộng`,
        }));

      // Students with no logs = Tốt
      const noLogStudents = studentData.filter((s: any) => s.logs === 0);
      noLogStudents.forEach((s: any) => {
        conductRatings.push({
          id: s.id, name: s.name, score: 0, rating: "Tốt",
          reason: "Chưa có vi phạm",
        });
      });

      const stats = {
        tot: conductRatings.filter((r: any) => r.rating === "Tốt").length,
        kha: conductRatings.filter((r: any) => r.rating === "Khá").length,
        trungBinh: conductRatings.filter((r: any) => r.rating === "Trung bình").length,
        yeu: conductRatings.filter((r: any) => r.rating === "Yếu").length,
      };

      const warnings = conductRatings
        .filter((r: any) => r.rating === "Yếu" || r.rating === "Trung bình")
        .map((r: any) => ({ id: r.id, name: r.name, reason: r.reason }));

      // Ask AI only for a short summary (MUCH less tokens needed)
      const geminiKey = Deno.env.get("GEMINI_API_KEY");
      let summary = `Lớp ${classId} (${timePeriod}): ${stats.tot} Tốt, ${stats.kha} Khá, ${stats.trungBinh} TB, ${stats.yeu} Yếu.`;

      if (geminiKey) {
        const shortPrompt = `Viết nhận xét 3-5 câu bằng tiếng Việt về hạnh kiểm lớp ${classId} (${timePeriod}).
Thống kê: ${stats.tot} Tốt, ${stats.kha} Khá, ${stats.trungBinh} TB, ${stats.yeu} Yếu / tổng ${conductRatings.length} HS.
HS yếu: ${warnings.map((w: any) => `${w.name}: ${w.reason}`).join('; ') || 'Không có'}.
Hãy đánh giá chung, nêu vấn đề nổi bật, đề xuất cho giáo viên. Chỉ trả text thuần, KHÔNG JSON.`;

        try {
          const models = ["gemini-2.5-flash", "gemini-2.0-flash"];
          for (const model of models) {
            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: shortPrompt }] }],
                  generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
                }),
              }
            );
            const data = await res.json();
            if (res.ok && !data?.error) {
              summary = data?.candidates?.[0]?.content?.parts?.[0]?.text || summary;
              break;
            }
            const errMsg = data?.error?.message || "";
            if (!errMsg.includes("high demand") && !errMsg.includes("overloaded")) break;
          }
        } catch { /* keep default summary */ }
      }

      // Return pre-built result (NO Gemini JSON parsing needed!)
      return new Response(JSON.stringify({
        conductRatings,
        statistics: stats,
        warnings,
        summary,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SCORE ANALYSIS: use AI but with compact data
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only send students WITH logs, compact format
    const activeStudents = studentData.filter((s: any) => s.logs > 0);
    const compactData = activeStudents.map((s: any) =>
      `${s.id}|${s.name}|điểm:${s.score}|+${s.adds}/${s.deducts}|lỗi:[${s.recentBad.join(',')}]|tốt:[${s.recentGood.join(',')}]`
    ).join('\n');

    const prompt = `Phân tích điểm thi đua lớp ${classId} (${timePeriod}).
Điểm 0 là mặc định. Trừ=vi phạm, cộng=tích cực. Format: ID|Tên|điểm|+cộng/trừ|lỗi gần nhất|tốt gần nhất

${compactData}

Trả JSON thuần: {"declining":[{"id":"","name":"","reason":""}],"improving":[{"id":"","name":"","reason":""}],"atRisk":[{"id":"","name":"","score":0,"reason":""}],"summary":"3-5 câu tiếng Việt"}
Chỉ top 10 đáng chú ý nhất mỗi mục. Reason ngắn gọn.`;

    const requestBody = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    });

    const models = ["gemini-2.5-flash", "gemini-2.0-flash"];
    let geminiRes: Response = new Response();
    let geminiData: any = null;

    for (const model of models) {
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: requestBody }
      );
      geminiData = await geminiRes.json();
      if (geminiRes.ok && !geminiData?.error) break;
      const errMsg = geminiData?.error?.message || "";
      if (!errMsg.includes("high demand") && !errMsg.includes("overloaded")) break;
    }

    if (!geminiRes.ok || geminiData?.error) {
      return new Response(JSON.stringify({
        declining: [], improving: [], atRisk: [],
        summary: `Lỗi Gemini API: ${geminiData?.error?.message || `HTTP ${geminiRes.status}`}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let analysis;
    try {
      analysis = JSON.parse(aiText.trim());
    } catch {
      try {
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (jsonMatch) analysis = JSON.parse(jsonMatch[0]);
        else throw new Error("no json");
      } catch {
        analysis = {
          declining: [], improving: [], atRisk: [],
          summary: aiText || "Không thể phân tích.",
        };
      }
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
