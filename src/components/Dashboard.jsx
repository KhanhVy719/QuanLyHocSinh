import { useState, useEffect, useCallback } from 'react';
import { Users, School, BookOpen, Wifi, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { getWeekRange, getAvailableWeeks, getSemesterRanges } from '../lib/weekUtils';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import KokomiLoading from './KokomiLoading';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

// Custom plugin: progressive line reveal from left to right
const progressiveReveal = {
  id: 'progressiveReveal',
  afterInit(chart) {
    chart._reveal = { progress: 0, done: false };
    const duration = 2000;
    const start = performance.now();
    function animate(now) {
      const elapsed = now - start;
      chart._reveal.progress = Math.min(elapsed / duration, 1);
      chart._reveal.done = chart._reveal.progress >= 1;
      chart.draw();
      if (!chart._reveal.done) requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  },
  beforeDatasetsDraw(chart) {
    if (!chart._reveal || chart._reveal.done) return;
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    const p = 1 - Math.pow(1 - chart._reveal.progress, 3);
    ctx.save();
    ctx.beginPath();
    ctx.rect(chartArea.left, chartArea.top, (chartArea.right - chartArea.left) * p, chartArea.bottom - chartArea.top);
    ctx.clip();
  },
  afterDatasetsDraw(chart) {
    if (!chart._reveal || chart._reveal.done) return;
    chart.ctx.restore();
  },
};

const lineOptions = {
  responsive: true, maintainAspectRatio: false,
  animation: false,
  plugins: {
    legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 20, font: { family: 'Inter', size: 12 } } },
    tooltip: {
      mode: 'index', intersect: false,
      backgroundColor: '#1F2937', padding: 12, cornerRadius: 8,
      titleFont: { family: 'Inter', size: 13, weight: 600 },
      bodyFont: { family: 'Inter', size: 12 },
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 12 }, color: '#9CA3AF' } },
    y: { grid: { color: '#F3F4F6' }, ticks: { font: { family: 'Inter', size: 12 }, color: '#9CA3AF' } },
  },
  interaction: { mode: 'index', intersect: false },
  elements: {
    line: { borderWidth: 3 },
    point: { hoverRadius: 7, hoverBorderWidth: 3, hitRadius: 10 },
  },
};



export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ students: 0, classes: 0, subjects: 0 });
  const [lastUpdate, setLastUpdate] = useState(null);
  const [groupStudents, setGroupStudents] = useState([]); // for totruong
  const [historyStudent, setHistoryStudent] = useState(null);
  const [scoreHistory, setScoreHistory] = useState([]);
  const [groupRanking, setGroupRanking] = useState([]); // for giaovien
  const [allClassStudents, setAllClassStudents] = useState([]); // for giaovien
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [publicLinks, setPublicLinks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [selectedSemester, setSelectedSemester] = useState(null); // 1 or 2
  const [semester2Start, setSemester2Start] = useState(null);
  const [semester2Input, setSemester2Input] = useState('');
  const [semesterSaving, setSemesterSaving] = useState(false);

  // Auto-detect current semester on mount
  useEffect(() => {
    const ranges = getSemesterRanges(semester2Start);
    const now = new Date();
    if (now >= ranges.hk2.start) setSelectedSemester(2);
    else setSelectedSemester(1);
  }, [semester2Start]);

  // Load semester settings from DB
  useEffect(() => {
    async function loadSemester() {
      const cls = user?.assigned_class;
      if (!cls) return;
      const { data } = await supabase.from('semester_settings').select('semester2_start').eq('class_id', cls).single();
      if (data?.semester2_start) {
        setSemester2Start(data.semester2_start);
        setSemester2Input(data.semester2_start);
      }
    }
    if (user?.role === 'giaovien' || user?.role === 'totruong') loadSemester();
  }, [user]);

  const semesterRanges = getSemesterRanges(semester2Start);
  const weeks = getAvailableWeeks(selectedSemester, semester2Start);

  // Auto-select valid week when semester changes
  useEffect(() => {
    if (weeks.length > 0 && !weeks.find(w => w.offset === selectedWeek)) {
      setSelectedWeek(weeks[0].offset);
    }
  }, [weeks, selectedWeek]);
  // Score editing for teacher
  const [scoreModal, setScoreModal] = useState(null);
  const [scoreChange, setScoreChange] = useState(0);
  const [scoreNote, setScoreNote] = useState('');
  const [scoreSaving, setScoreSaving] = useState(false);
  const [scoreLoading, setScoreLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    // For teachers, find their assigned class from users table
    let teacherClass = null;
    if (user?.role === 'giaovien') {
      teacherClass = user.assigned_class || null;
    }

    const [studentsRes, classesRes, subjectsRes, allStudentsRes] = await Promise.all([
      teacherClass
        ? supabase.from('students').select('id', { count: 'exact', head: true }).eq('class', teacherClass)
        : supabase.from('students').select('id', { count: 'exact', head: true }),
      supabase.from('classes').select('code', { count: 'exact', head: true }),
      supabase.from('subjects').select('code', { count: 'exact', head: true }),
      teacherClass
        ? supabase.from('students').select('id, created_at').eq('class', teacherClass)
        : supabase.from('students').select('id, created_at'),
    ]);

    // Calculate students by month
    const allStudents = allStudentsRes.data || [];
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    const acadStartYear = curMonth >= 8 ? curYear : curYear - 1;
    const acadStart = new Date(acadStartYear, 8, 1);

    const studentsByMonth = {};
    let baseStudents = 0;
    allStudents.forEach(s => {
      if (!s.created_at) { baseStudents++; return; }
      const d = new Date(s.created_at);
      if (d < acadStart) { baseStudents++; }
      else {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        studentsByMonth[key] = (studentsByMonth[key] || 0) + 1;
      }
    });

    setStats({
      students: studentsRes.count || 0,
      classes: classesRes.count || 0,
      subjects: subjectsRes.count || 0,
      studentsByMonth,
      baseStudents,
      teacherClass,
    });

    // Load existing public links for giaovien
    if (user?.role === 'giaovien' && teacherClass) {
      const { data: links } = await supabase.from('public_links').select('*').eq('class_id', teacherClass).eq('is_active', true).order('created_at', { ascending: false });
      setPublicLinks(links || []);
    }
  }, [user]);

  // Separate score fetching — only re-runs when week changes (fast!)
  const fetchScores = useCallback(async () => {
    setScoreLoading(true);
    const teacherClass = user?.assigned_class || null;

    // For totruong: load group students with scores
    if (user?.role === 'totruong') {
      const { data: uArr } = await supabase.rpc('get_user_by_id', { p_id: user.id });
      const uData = uArr?.[0] || null;
      if (uData?.assigned_class && uData?.name) {
        const { data: meStudent } = await supabase.from('students').select('group_name').eq('name', uData.name).eq('class', uData.assigned_class).single();
        if (meStudent?.group_name) {
          const { data: grpStudents } = await supabase.from('students').select('*').eq('class', uData.assigned_class).eq('group_name', meStudent.group_name).order('id');
          const ids = (grpStudents || []).map(s => s.id);
          const wr = getWeekRange(selectedWeek);
          const { data: logs } = ids.length > 0 ? await supabase.from('score_logs').select('student_id, change').in('student_id', ids).gte('created_at', wr.start).lte('created_at', wr.end) : { data: [] };
          const scoreMap = {};
          const deductMap = {};
          (logs || []).forEach(r => {
            scoreMap[r.student_id] = (scoreMap[r.student_id] ?? 0) + r.change;
            if (r.change < 0) deductMap[r.student_id] = (deductMap[r.student_id] || 0) + r.change;
          });
          setGroupStudents((grpStudents || []).map(s => ({ ...s, score: scoreMap[s.id] ?? 0, deductions: deductMap[s.id] || 0 })));
        }
      }
    }

    // For giaovien: load all groups ranking
    if (user?.role === 'giaovien' && teacherClass) {
      const { data: allStudents2 } = await supabase.from('students').select('id, name, group_name').eq('class', teacherClass);
      if (allStudents2 && allStudents2.length > 0) {
        const ids = allStudents2.map(s => s.id);
        const wr2 = getWeekRange(selectedWeek);
        const { data: logs } = await supabase.from('score_logs').select('student_id, change').in('student_id', ids).gte('created_at', wr2.start).lte('created_at', wr2.end);
        const scoreMap = {};
        const deductMap = {};
        (logs || []).forEach(r => {
          scoreMap[r.student_id] = (scoreMap[r.student_id] ?? 0) + r.change;
          if (r.change < 0) deductMap[r.student_id] = (deductMap[r.student_id] || 0) + r.change;
        });
        // Group by group_name
        const groups = {};
        allStudents2.forEach(s => {
          const g = s.group_name || 'Không tổ';
          if (!groups[g]) groups[g] = { name: g, students: 0, totalScore: 0, totalDeductions: 0 };
          groups[g].students++;
          groups[g].totalScore += scoreMap[s.id] ?? 0;
          groups[g].totalDeductions += deductMap[s.id] || 0;
        });
        const ranking = Object.values(groups).map(g => ({ ...g, avgScore: Math.round((g.totalScore / g.students) * 10) / 10 }));
        ranking.sort((a, b) => b.avgScore - a.avgScore || a.totalDeductions - b.totalDeductions);
        setGroupRanking(ranking);
        // Store all students with scores for list
        setAllClassStudents(allStudents2.map(s => ({
          ...s,
          score: scoreMap[s.id] ?? 0,
          deductions: deductMap[s.id] || 0,
        })));
      }
    }

    setLastUpdate(new Date());
    setScoreLoading(false);
  }, [user, selectedWeek]);

  useEffect(() => {
    queueMicrotask(fetchStats);

    // Real-time subscriptions for structural data
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subjects' }, () => fetchStats())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchStats]);

  // Score data — re-fetches only when week changes (fast!)
  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  // Build dynamic monthly labels from start of academic year (Sep) to current month
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-indexed: 0=Jan, 1=Feb
  const currentYear = now.getFullYear();
  // Academic year starts in September
  const startMonth = 8; // September (0-indexed)
  const startYear = currentMonth >= startMonth ? currentYear : currentYear - 1;

  const monthLabels = [];
  const monthKeys = [];
  let m = startMonth, y = startYear;
  while (true) {
    monthLabels.push(`Tháng ${m + 1}`);
    monthKeys.push(`${y}-${String(m + 1).padStart(2, '0')}`);
    if (m === currentMonth && y === currentYear) break;
    m++;
    if (m > 11) { m = 0; y++; }
  }

  // Count students by month using created_at if available
  const byMonth = stats.studentsByMonth || {};
  const hasMonthlyData = Object.keys(byMonth).length > 0;

  let monthlyNew, monthlyCumulative;

  if (hasMonthlyData) {
    monthlyNew = monthKeys.map(key => byMonth[key] || 0);
    monthlyCumulative = [];
    let cumulative = stats.baseStudents || 0;
    monthlyNew.forEach(n => { cumulative += n; monthlyCumulative.push(cumulative); });
    // Ensure last point matches actual DB count
    monthlyCumulative[monthlyCumulative.length - 1] = stats.students;
  } else {
    // No created_at data — Tổng HS flat across all months, Học sinh mới only at last month
    monthlyNew = monthKeys.map((_k, i) => i === monthKeys.length - 1 ? stats.students : 0);
    monthlyCumulative = monthKeys.map(() => stats.students);
  }

  const lineData = {
    labels: monthLabels,
    datasets: [
      { label: 'Học sinh mới', data: monthlyNew, borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.08)', tension: 0.4, fill: true, pointRadius: 5, pointBackgroundColor: '#fff', pointBorderWidth: 2, pointBorderColor: '#10B981' },
      { label: 'Tổng học sinh', data: monthlyCumulative, borderColor: '#4F6BED', backgroundColor: 'rgba(79,107,237,0.08)', tension: 0.4, fill: true, pointRadius: 5, pointBackgroundColor: '#fff', pointBorderWidth: 2, pointBorderColor: '#4F6BED' },
    ],
  };

  const studentLabel = user?.role === 'totruong' ? 'Học sinh trong tổ' : (stats.teacherClass ? `Học sinh lớp ${stats.teacherClass}` : 'Tổng học sinh');
  const studentCount = user?.role === 'totruong' ? groupStudents.length : stats.students;
  const studentTrend = user?.role === 'totruong' ? 'tổ được phân công' : (stats.teacherClass ? 'lớp được phân công' : 'toàn trường');

  const statCards = [
    { label: studentLabel, value: studentCount, trend: '', trendLabel: studentTrend, icon: Users, color: 'blue' },
    { label: 'Số lớp học', value: stats.classes, trend: '', trendLabel: 'lớp đang hoạt động', icon: School, color: 'green' },
    { label: 'Môn học', value: stats.subjects, trend: '', trendLabel: 'Đầy đủ các môn học', icon: BookOpen, color: 'purple' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Tổng quan</h2>
          <p>Chào mừng bạn đến với hệ thống quản lý học sinh</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', padding: '6px 14px', borderRadius: 20, background: '#F0FDF4', border: '1px solid #BBF7D0', fontSize: '0.78rem', color: '#15803D', fontWeight: 600 }}>
          <Wifi size={13} />
          <span>Thời gian thực</span>
          {lastUpdate && <span style={{ color: '#6B7280', fontWeight: 400 }}>• {lastUpdate.toLocaleTimeString('vi-VN')}</span>}
        </div>
      </div>

      {/* Semester & Week Selector */}
      {(user?.role === 'giaovien' || user?.role === 'totruong') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#374151' }}>� Học kỳ:</span>
          <select
            value={selectedSemester || 1}
            onChange={e => { setSelectedSemester(Number(e.target.value)); setSelectedWeek(0); }}
            className="filter-select"
            style={{ minWidth: 120 }}
          >
            <option value={1}>Học kỳ 1</option>
            <option value={2}>Học kỳ 2</option>
          </select>

          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#374151', marginLeft: 8 }}>�📅 Tuần:</span>
          <select
            value={selectedWeek}
            onChange={e => setSelectedWeek(Number(e.target.value))}
            className="filter-select"
            style={{ minWidth: 200 }}
          >
            {weeks.map(w => (
              <option key={w.offset} value={w.offset}>
                {w.isCurrent ? `Tuần hiện tại (${w.label})` : w.label}
              </option>
            ))}
          </select>
          {selectedWeek !== 0 && (
            <span style={{ fontSize: '0.8rem', color: '#D97706', fontWeight: 600, background: '#FEF3C7', padding: '4px 10px', borderRadius: 8 }}>
              ⏳ Đang xem tuần cũ
            </span>
          )}
        </div>
      )}

      {/* Teacher: HK2 start date config */}
      {user?.role === 'giaovien' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap', padding: '10px 16px', borderRadius: 12, background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0369A1' }}>⚙️ Ngày bắt đầu HK2:</span>
          <input
            type="date"
            value={semester2Input}
            onChange={e => setSemester2Input(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #7DD3FC', fontSize: '0.88rem', outline: 'none' }}
          />
          <button
            disabled={semesterSaving || !semester2Input}
            onClick={async () => {
              setSemesterSaving(true);
              const cls = user.assigned_class || stats.teacherClass;
              const { error } = await supabase.from('semester_settings').upsert({
                class_id: cls,
                semester2_start: semester2Input,
                updated_by: user.id,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'class_id' });
              if (error) {
                alert('Lỗi: ' + error.message);
              } else {
                setSemester2Start(semester2Input);
                alert('Đã cập nhật ngày bắt đầu HK2!');
              }
              setSemesterSaving(false);
            }}
            style={{
              padding: '6px 16px', borderRadius: 8, border: 'none',
              background: '#0284C7', color: '#fff', fontWeight: 600,
              fontSize: '0.82rem', cursor: semesterSaving ? 'wait' : 'pointer',
              opacity: semesterSaving ? 0.7 : 1,
            }}
          >
            {semesterSaving ? 'Đang lưu...' : '💾 Cập nhật'}
          </button>
          <span style={{ fontSize: '0.78rem', color: '#6B7280' }}>
            HK1: {semesterRanges.hk1.start.toLocaleDateString('vi-VN')} → {semesterRanges.hk1.end.toLocaleDateString('vi-VN')} | HK2: {semesterRanges.hk2.start.toLocaleDateString('vi-VN')} → {semesterRanges.hk2.end.toLocaleDateString('vi-VN')}
          </span>
        </div>
      )}

      {/* Score loading overlay */}
      {scoreLoading && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, backdropFilter: 'blur(4px)' }}>
          <KokomiLoading text="Đang tải điểm..." />
        </div>
      )}

      <div className="stats-grid">
        {statCards.map((s, i) => {
          const Icon = s.icon;
          return (
            <div className="stat-card" key={i}>
              <div className="stat-info">
                <label>{s.label}</label>
                <div className="stat-value">{s.value}</div>
                {(s.trend || s.trendLabel) && <div className="stat-trend up">{s.trend && <span>{s.trend}</span>}<span>{s.trendLabel}</span></div>}
              </div>
              <div className={`stat-icon ${s.color}`}><Icon size={24} /></div>
            </div>
          );
        })}
      </div>
      {user?.role === 'admin' && (
        <div className="charts-grid">
          <div className="chart-card" style={{ gridColumn: '1 / -1' }}><h3>Biểu đồ học sinh</h3><div className="chart-wrapper"><Line data={lineData} options={lineOptions} plugins={[progressiveReveal]} /></div></div>
        </div>
      )}
      {user?.role === 'giaovien' && groupRanking.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ marginBottom: 16, color: '#1F2937' }}>🏆 Xếp hạng tổ - Lớp {stats.teacherClass}
            <button
              onClick={async () => {
                const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
                const { error, data: newLink } = await supabase.from('public_links').insert({ token, class_id: stats.teacherClass, created_by: user.id }).select().single();
                if (!error && newLink) {
                  setPublicLinks(prev => [newLink, ...prev]);
                } else {
                  alert('Lỗi tạo link: ' + error.message);
                }
              }}
              style={{
                marginLeft: 12, padding: '6px 14px', borderRadius: 8, border: 'none',
                background: '#10B981', color: '#fff', fontWeight: 600, fontSize: '0.8rem',
                cursor: 'pointer', verticalAlign: 'middle',
              }}
            >
              🔗 Tạo link công khai
            </button>
          </h3>
          {publicLinks.length > 0 && (
            <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {publicLinks.map(link => {
                const url = `${window.location.origin}?public=${link.token}`;
                return (
                  <div key={link.id} style={{ padding: 10, borderRadius: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8rem', color: '#059669' }}>🔗</span>
                    <code style={{ flex: 1, fontSize: '0.78rem', wordBreak: 'break-all', color: '#1F2937' }}>{url}</code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(url); alert('\u0110\u00e3 copy!'); }}
                      style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #BBF7D0', background: '#fff', color: '#059669', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}
                    >Copy</button>
                    <button
                      onClick={async () => {
                        await supabase.from('public_links').delete().eq('id', link.id);
                        setPublicLinks(prev => prev.filter(l => l.id !== link.id));
                      }}
                      style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}
                    >Xóa</button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'center', width: 60 }}>Hạng</th>
                  <th>Tên tổ</th>
                  <th style={{ textAlign: 'center' }}>Số HS</th>
                  <th style={{ textAlign: 'center' }}>Điểm TB</th>
                  <th style={{ textAlign: 'center' }}>Tổng điểm trừ</th>
                </tr>
              </thead>
              <tbody>
                {groupRanking.map((g, i) => {
                  const bgColors = { 0: '#FFFBEB', 1: '#F0F9FF', 2: '#FFF7ED' };
                  return (
                    <tr key={g.name} style={{ background: bgColors[i] }}>
                      <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '1rem' }}>{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{g.name}</td>
                      <td style={{ textAlign: 'center' }}>{g.students}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '1.1rem', color: g.avgScore >= 8 ? '#059669' : g.avgScore >= 5 ? '#D97706' : '#DC2626' }}>{g.avgScore}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: g.totalDeductions < 0 ? '#DC2626' : '#059669' }}>{g.totalDeductions}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {user?.role === 'giaovien' && stats.teacherClass && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: '#1F2937' }}>🤖 Phân tích AI</h3>
            <button
              onClick={async () => {
                setAiLoading(true);
                setAiAnalysis(null);
                try {
                  const { data, error } = await supabase.functions.invoke('analyze-scores', {
                    body: { classId: stats.teacherClass },
                  });
                  if (error) throw error;
                  setAiAnalysis(data);
                } catch (err) {
                  setAiAnalysis({ summary: 'Lỗi khi phân tích: ' + (err.message || 'Unknown error'), declining: [], improving: [], atRisk: [] });
                }
                setAiLoading(false);
              }}
              disabled={aiLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                color: '#fff', fontWeight: 600, fontSize: '0.85rem',
                cursor: aiLoading ? 'wait' : 'pointer', opacity: aiLoading ? 0.7 : 1,
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: 16 }}>🧠</span>
              {aiLoading ? 'Đang phân tích...' : 'Phân tích ngay'}
            </button>
          </div>
          {aiAnalysis && (
            <div style={{ display: 'grid', gap: 16 }}>
              {/* Summary */}
              <div style={{ padding: 16, borderRadius: 12, background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)', border: '1px solid #C7D2FE' }}>
                <div style={{ fontWeight: 700, marginBottom: 8, color: '#4338CA', fontSize: '0.95rem' }}>📊 Nhận xét tổng hợp</div>
                <div style={{ color: '#1E1B4B', lineHeight: 1.6 }}>{aiAnalysis.summary}</div>
              </div>
              {/* At Risk */}
              {aiAnalysis.atRisk?.length > 0 && (
                <div style={{ padding: 16, borderRadius: 12, background: '#FEF2F2', border: '1px solid #FECACA' }}>
                  <div style={{ fontWeight: 700, marginBottom: 10, color: '#DC2626', fontSize: '0.95rem' }}>⚠️ Học sinh có nguy cơ ({aiAnalysis.atRisk.length})</div>
                  {aiAnalysis.atRisk.map((s, i) => (
                    <div key={i} style={{ padding: '8px 12px', marginBottom: 6, borderRadius: 8, background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div><span style={{ fontWeight: 600 }}>{s.name}</span> <span style={{ color: '#6B7280', fontSize: '0.85rem' }}>({s.id})</span></div>
                      <div style={{ fontSize: '0.85rem', color: '#DC2626' }}>{s.reason}</div>
                    </div>
                  ))}
                </div>
              )}
              {/* Declining */}
              {aiAnalysis.declining?.length > 0 && (
                <div style={{ padding: 16, borderRadius: 12, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                  <div style={{ fontWeight: 700, marginBottom: 10, color: '#D97706', fontSize: '0.95rem' }}>📉 Xu hướng giảm ({aiAnalysis.declining.length})</div>
                  {aiAnalysis.declining.map((s, i) => (
                    <div key={i} style={{ padding: '8px 12px', marginBottom: 6, borderRadius: 8, background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div><span style={{ fontWeight: 600 }}>{s.name}</span> <span style={{ color: '#6B7280', fontSize: '0.85rem' }}>({s.id})</span></div>
                      <div style={{ fontSize: '0.85rem', color: '#D97706' }}>{s.reason}</div>
                    </div>
                  ))}
                </div>
              )}
              {/* Improving */}
              {aiAnalysis.improving?.length > 0 && (
                <div style={{ padding: 16, borderRadius: 12, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  <div style={{ fontWeight: 700, marginBottom: 10, color: '#059669', fontSize: '0.95rem' }}>📈 Học sinh tiến bộ ({aiAnalysis.improving.length})</div>
                  {aiAnalysis.improving.map((s, i) => (
                    <div key={i} style={{ padding: '8px 12px', marginBottom: 6, borderRadius: 8, background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div><span style={{ fontWeight: 600 }}>{s.name}</span> <span style={{ color: '#6B7280', fontSize: '0.85rem' }}>({s.id})</span></div>
                      <div style={{ fontSize: '0.85rem', color: '#059669' }}>{s.reason}</div>
                    </div>
                  ))}
                </div>
              )}
              {aiAnalysis.declining?.length === 0 && aiAnalysis.improving?.length === 0 && aiAnalysis.atRisk?.length === 0 && (
                <div style={{ padding: 16, borderRadius: 12, background: '#F9FAFB', border: '1px solid #E5E7EB', textAlign: 'center', color: '#6B7280' }}>
                  Chưa có đủ dữ liệu để phân tích chi tiết.
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {user?.role === 'giaovien' && allClassStudents.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ marginBottom: 16, color: '#1F2937' }}>📋 Danh sách học sinh - Lớp {stats.teacherClass}</h3>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'center', width: 60 }}>Hạng</th>
                  <th>Mã HS</th>
                  <th>Họ và tên</th>
                  <th>Tổ</th>
                  <th style={{ textAlign: 'center' }}>Điểm</th>
                  <th style={{ textAlign: 'center', width: 100 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const sorted = [...allClassStudents].sort((a, b) => b.score - a.score || a.deductions - b.deductions || a.name.localeCompare(b.name));
                  let rank = 1;
                  return sorted.map((s, i) => {
                    if (i > 0 && s.score !== sorted[i - 1].score) rank++;
                    return (
                  <tr key={s.id}>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{rank}</td>
                    <td style={{ fontWeight: 600 }}>{s.id}</td>
                    <td><button onClick={async () => {
                      setHistoryStudent({ id: s.id, name: s.name });
                      const wrH = getWeekRange(selectedWeek);
                      const { data } = await supabase.from('score_logs').select('*').eq('student_id', s.id).gte('created_at', wrH.start).lte('created_at', wrH.end).order('created_at', { ascending: false });
                      setScoreHistory(data || []);
                    }} style={{ background: 'none', border: 'none', color: '#4F46E5', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: 'inherit' }}>{s.name}</button></td>
                    <td>{s.group_name || '—'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '1.05rem', color: s.score >= 8 ? '#059669' : s.score >= 5 ? '#D97706' : '#DC2626' }}>{s.score}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => {
                        setScoreModal({ studentId: s.id, studentName: s.name, currentScore: s.score });
                        setScoreChange(0);
                        setScoreNote('');
                      }} style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        📖 Chấm
                      </button>
                    </td>
                  </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {user?.role === 'totruong' && groupStudents.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ marginBottom: 16, color: '#1F2937' }}>📋 Xếp hạng học sinh trong tổ</h3>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'center', width: 60 }}>Hạng</th><th>Mã HS</th><th>Họ và tên</th><th>Trạng thái</th><th style={{ textAlign: 'center' }}>Điểm</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const sorted = [...groupStudents].sort((a, b) => b.score - a.score || a.deductions - b.deductions || a.name.localeCompare(b.name));
                  const bgColors = { 1: '#FFFBEB', 2: '#F0F9FF', 3: '#FFF7ED' };
                  let rank = 1;
                  return sorted.map((s, i) => {
                    if (i > 0 && s.score !== sorted[i - 1].score) rank++;
                    const r = rank;
                    return (
                  <tr key={s.id} style={{ background: bgColors[r] }}>
                    <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '1rem' }}>{r}</td>
                    <td style={{ fontWeight: 600 }}>{s.id}</td>
                    <td><button onClick={async () => {
                      setHistoryStudent({ id: s.id, name: s.name });
                      const wrH2 = getWeekRange(selectedWeek);
                      const { data } = await supabase.from('score_logs').select('*').eq('student_id', s.id).gte('created_at', wrH2.start).lte('created_at', wrH2.end).order('created_at', { ascending: false });
                      setScoreHistory(data || []);
                    }} style={{ background: 'none', border: 'none', color: '#4F46E5', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: 'inherit' }}>{s.name}</button></td>
                    <td><span className="badge success">{s.status}</span></td>
                    <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '1.1rem', color: s.score >= 8 ? '#059669' : s.score >= 5 ? '#D97706' : '#DC2626' }}>{s.score}</td>
                  </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {historyStudent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: 500, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: '#1F2937' }}>📋 Lịch sử điểm - {historyStudent.name}</h3>
              <button onClick={() => setHistoryStudent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={20} color="#9CA3AF" /></button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '14px 18px', background: '#F9FAFB', borderRadius: 14 }}>
              <span style={{ fontSize: '0.85rem', color: '#6B7280' }}>Điểm hiện tại:</span>
              {(() => { const s = groupStudents.find(x => x.id === historyStudent.id); const sc = s?.score ?? 0; return <span style={{ fontSize: '1.5rem', fontWeight: 800, color: sc >= 8 ? '#059669' : sc >= 5 ? '#D97706' : '#DC2626' }}>{sc}</span>; })()}
            </div>
            {scoreHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#9CA3AF' }}>Chưa có lịch sử chấm điểm</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {scoreHistory.map((log, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: log.change > 0 ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${log.change > 0 ? '#BBF7D0' : '#FECACA'}` }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: log.change > 0 ? '#D1FAE5' : '#FEE2E2', color: log.change > 0 ? '#059669' : '#DC2626', fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {log.change > 0 ? `+${log.change}` : log.change}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1F2937' }}>{log.note || 'Không có ghi chú'}</div>
                      <div style={{ fontSize: '0.78rem', color: '#9CA3AF', marginTop: 2 }}>Điểm sau: {log.score_after} • {new Date(log.created_at).toLocaleString('vi-VN')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Score editing modal for teacher */}
      {scoreModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: 460, maxWidth: '95vw', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#1F2937' }}>📖 Chấm điểm - {scoreModal.studentName}</h3>
              <button onClick={() => setScoreModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={20} color="#9CA3AF" /></button>
            </div>

            {/* Current score display */}
            {(() => {
              const current = scoreModal.currentScore ?? 0;
              const preview = current + scoreChange;
              return (
                <div style={{ background: '#F9FAFB', borderRadius: 14, padding: 20, marginBottom: 20, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', color: '#6B7280', marginBottom: 8 }}>Điểm hiện tại</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 800, color: current >= 8 ? '#059669' : current >= 5 ? '#D97706' : '#DC2626' }}>{current}</div>
                  {scoreChange !== 0 && (
                    <div style={{ marginTop: 8, fontSize: '1rem', fontWeight: 700 }}>
                      <span style={{ color: '#9CA3AF' }}>→ </span>
                      <span style={{ color: preview >= 8 ? '#059669' : preview >= 5 ? '#D97706' : '#DC2626' }}>{preview}</span>
                      <span style={{ marginLeft: 8, padding: '2px 10px', borderRadius: 20, fontSize: '0.82rem', fontWeight: 700, background: scoreChange > 0 ? '#D1FAE5' : '#FEE2E2', color: scoreChange > 0 ? '#059669' : '#DC2626' }}>
                        {scoreChange > 0 ? `+${scoreChange}` : scoreChange}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Score change buttons */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: '0.88rem', color: '#374151' }}>Điểm cộng / trừ</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[-5, -3, -2, -1].map(v => (
                  <button key={v} onClick={() => setScoreChange(v)}
                    style={{ padding: '8px 16px', borderRadius: 10, border: scoreChange === v ? '2px solid #DC2626' : '1.5px solid #FCA5A5', background: scoreChange === v ? '#FEE2E2' : '#FFF', color: '#DC2626', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
                    {v}
                  </button>
                ))}
                <button onClick={() => setScoreChange(0)}
                  style={{ padding: '8px 16px', borderRadius: 10, border: scoreChange === 0 ? '2px solid #6B7280' : '1.5px solid #D1D5DB', background: scoreChange === 0 ? '#F3F4F6' : '#FFF', color: '#374151', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
                  0
                </button>
                {[1, 2, 3, 5].map(v => (
                  <button key={v} onClick={() => setScoreChange(v)}
                    style={{ padding: '8px 16px', borderRadius: 10, border: scoreChange === v ? '2px solid #059669' : '1.5px solid #6EE7B7', background: scoreChange === v ? '#D1FAE5' : '#FFF', color: '#059669', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
                    +{v}
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: '0.88rem', color: '#374151' }}>Ghi chú (tùy chọn)</label>
              <input type="text" value={scoreNote} onChange={e => setScoreNote(e.target.value)} placeholder="VD: Không làm bài tập, phát biểu tốt..."
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: '0.88rem', outline: 'none', background: '#FAFBFF', boxSizing: 'border-box' }} />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setScoreModal(null)} style={{ padding: '10px 24px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#6B7280' }}>Hủy</button>
              <button disabled={scoreSaving || scoreChange === 0} onClick={async () => {
                setScoreSaving(true);
                const current = scoreModal.currentScore ?? 0;
                const newScore = current + scoreChange;
                // If editing a past week, set created_at to a time within that week
                const insertData = {
                  student_id: scoreModal.studentId,
                  change: scoreChange,
                  note: scoreNote || null,
                  score_after: newScore,
                };
                if (selectedWeek !== 0) {
                  const wr = getWeekRange(selectedWeek);
                  // Set to Wednesday of that week (midpoint)
                  const mid = new Date(wr.start);
                  mid.setDate(mid.getDate() + 3);
                  mid.setHours(12, 0, 0, 0);
                  insertData.created_at = mid.toISOString();
                }
                const { error } = await supabase.from('score_logs').insert(insertData);
                if (error) {
                  alert('Lỗi: ' + error.message);
                } else {
                  setScoreModal(null);
                  fetchScores(); // Refresh score data only
                }
                setScoreSaving(false);
              }} style={{
                padding: '10px 24px', borderRadius: 10, border: 'none',
                background: scoreChange === 0 ? '#E5E7EB' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                color: scoreChange === 0 ? '#9CA3AF' : '#fff', fontWeight: 700, fontSize: '0.9rem',
                cursor: scoreChange === 0 || scoreSaving ? 'not-allowed' : 'pointer',
                opacity: scoreSaving ? 0.7 : 1,
              }}>
                {scoreSaving ? 'Đang lưu...' : 'Lưu điểm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
