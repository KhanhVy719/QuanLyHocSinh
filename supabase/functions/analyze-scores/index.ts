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

    // SCORE ANALYSIS: calculate server-side, AI only for summary
    const activeStudents = studentData.filter((s: any) => s.logs > 0);

    // Server-side classification
    const atRisk = activeStudents
      .filter((s: any) => s.score < -5)
      .sort((a: any, b: any) => a.score - b.score)
      .slice(0, 10)
      .map((s: any) => ({
        id: s.id, name: s.name, score: s.score,
        reason: `Điểm ${s.score} (trừ ${s.deducts}): ${s.recentBad.join(', ') || 'Không rõ'}`,
      }));

    const declining = activeStudents
      .filter((s: any) => s.score < 0 && s.score >= -5 && s.deducts < -2)
      .sort((a: any, b: any) => a.score - b.score)
      .slice(0, 10)
      .map((s: any) => ({
        id: s.id, name: s.name,
        reason: `Điểm ${s.score}, bị trừ ${Math.abs(s.deducts)} điểm: ${s.recentBad.join(', ') || 'Không rõ'}`,
      }));

    const improving = activeStudents
      .filter((s: any) => s.adds > 2)
      .sort((a: any, b: any) => b.adds - a.adds)
      .slice(0, 10)
      .map((s: any) => ({
        id: s.id, name: s.name,
        reason: `Được cộng ${s.adds} điểm: ${s.recentGood.join(', ') || 'Không rõ'}`,
      }));

    // AI only for short summary text
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const avgScore = activeStudents.length > 0
      ? (activeStudents.reduce((s: number, st: any) => s + st.score, 0) / activeStudents.length).toFixed(1)
      : "0";
    let summary = `Lớp ${classId} (${timePeriod}): ${activeStudents.length} HS có dữ liệu, điểm TB: ${avgScore}. ${atRisk.length} HS nguy cơ, ${declining.length} xu hướng giảm, ${improving.length} tiến bộ.`;

    if (geminiKey) {
      const shortPrompt = `Viết nhận xét 3-5 câu bằng tiếng Việt về điểm thi đua lớp ${classId} (${timePeriod}).
${activeStudents.length} HS có dữ liệu, điểm TB: ${avgScore}.
Nguy cơ (${atRisk.length}): ${atRisk.map((s: any) => `${s.name} (${s.score})`).join(', ') || 'Không'}.
Giảm (${declining.length}): ${declining.map((s: any) => s.name).join(', ') || 'Không'}.
Tiến bộ (${improving.length}): ${improving.map((s: any) => s.name).join(', ') || 'Không'}.
Đánh giá chung, vấn đề nổi bật, đề xuất cho GV. Chỉ trả text thuần, KHÔNG JSON.`;

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
          const gData = await res.json();
          if (res.ok && !gData?.error) {
            summary = gData?.candidates?.[0]?.content?.parts?.[0]?.text || summary;
            break;
          }
          const errMsg = gData?.error?.message || "";
          if (!errMsg.includes("high demand") && !errMsg.includes("overloaded")) break;
        }
      } catch { /* keep default summary */ }
    }

    return new Response(JSON.stringify({
      declining,
      improving,
      atRisk,
      summary,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
