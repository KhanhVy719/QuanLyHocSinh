import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { X, Search, TrendingUp, TrendingDown, Calendar, Star, Users } from 'lucide-react';
import KokomiLoading from './KokomiLoading';
import { getAvailableWeeks, getSemesterRanges, getAvailableMonths, getDateRangeForView, getSemesterForMonth } from '../lib/weekUtils';

export default function PublicScorePage({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [classId, setClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [historyStudent, setHistoryStudent] = useState(null);
  const [scoreHistory, setScoreHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [conductMap, setConductMap] = useState({});
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [selectedSemester, setSelectedSemester] = useState(null);
  const [semester2Start, setSemester2Start] = useState(null);
  const [viewMode, setViewMode] = useState('week'); // 'week' | 'month' | 'semester' | 'year'
  const [selectedMonth, setSelectedMonth] = useState(0);

  // Auto-detect current semester
  useEffect(() => {
    const ranges = getSemesterRanges(semester2Start);
    const now = new Date();
    setSelectedSemester(now >= ranges.hk2.start ? 2 : 1);
  }, [semester2Start]);

  // Load semester settings from DB when classId is ready
  useEffect(() => {
    if (!classId) return;
    async function loadSem() {
      const { data } = await supabase.from('semester_settings').select('semester2_start').eq('class_id', classId).single();
      if (data?.semester2_start) setSemester2Start(data.semester2_start);
    }
    loadSem();
  }, [classId]);

  const weeks = getAvailableWeeks(selectedSemester, semester2Start);
  const months = getAvailableMonths(selectedSemester, semester2Start);

  // Auto-select valid week when semester changes
  useEffect(() => {
    if (weeks.length > 0 && !weeks.find(w => w.offset === selectedWeek)) {
      setSelectedWeek(weeks[0].offset);
    }
  }, [weeks, selectedWeek]);

  useEffect(() => {
    async function loadData() {
      const { data: link } = await supabase
        .from('public_links')
        .select('class_id')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (!link) {
        setError('Liên kết này không tồn tại hoặc đã bị vô hiệu hóa.');
        setLoading(false);
        return;
      }
      setClassId(link.class_id);
    }
    loadData();
  }, [token]);

  // Re-fetch students + scores when week changes (always sync with DB)
  useEffect(() => {
    if (!classId) return;
    async function refetch() {
      setScoreLoading(true);
      // Always fetch fresh student data from database
      const { data: freshStudents } = await supabase
        .from('students')
        .select('id, name, group_name, status')
        .eq('class', classId)
        .order('id');

      if (!freshStudents || freshStudents.length === 0) {
        setError('Không tìm thấy dữ liệu học sinh.');
        setLoading(false);
        return;
      }

      const ids = freshStudents.map(s => s.id);
      const wr = getDateRangeForView(viewMode, viewMode === 'month' ? selectedMonth : selectedWeek, selectedSemester || 1, semester2Start);
      const [{ data: logs }, { data: conductData }] = await Promise.all([
        supabase.from('score_logs').select('student_id, change').in('student_id', ids).gte('created_at', wr.start).lte('created_at', wr.end),
        supabase.from('conduct_ratings').select('student_id, rating, semester').in('student_id', ids),
      ]);

      const scoreMap = {};
      const deductMap = {};
      (logs || []).forEach(r => {
        scoreMap[r.student_id] = (scoreMap[r.student_id] ?? 0) + r.change;
        if (r.change < 0) deductMap[r.student_id] = (deductMap[r.student_id] || 0) + r.change;
      });
      // Build conduct map: { studentId: { 1: 'Tốt', 2: 'Khá' } }
      const cMap = {};
      (conductData || []).forEach(c => {
        if (!cMap[c.student_id]) cMap[c.student_id] = {};
        cMap[c.student_id][c.semester] = c.rating;
      });
      setConductMap(cMap);
      setStudents(freshStudents.map(s => ({
        ...s,
        score: scoreMap[s.id] ?? 0,
        deductions: deductMap[s.id] || 0,
      })));
      setLoading(false);
      setScoreLoading(false);
    }
    refetch();
  }, [selectedWeek, selectedMonth, viewMode, classId, selectedSemester, semester2Start]);

  const rankedStudents = useMemo(() => {
    const sorted = [...students].sort((a, b) => b.score - a.score || a.deductions - b.deductions || a.name.localeCompare(b.name));
    let rank = 1;
    return sorted.map((s, i) => {
      if (i > 0 && s.score !== sorted[i - 1].score) rank++;
      return { ...s, rank };
    });
  }, [students]);

  const filteredStudents = useMemo(() => {
    if (!searchTerm) return rankedStudents;
    const lower = searchTerm.toLowerCase();
    return rankedStudents.filter(s =>
      s.name.toLowerCase().includes(lower) ||
      s.id.toLowerCase().includes(lower) ||
      (s.group_name && s.group_name.toLowerCase().includes(lower))
    );
  }, [rankedStudents, searchTerm]);

  const handleViewHistory = async (student) => {
    setHistoryStudent({ id: student.id, name: student.name, score: student.score });
    setScoreHistory([]);
    setHistoryLoading(true);
    const wr = getDateRangeForView(viewMode, viewMode === 'month' ? selectedMonth : selectedWeek, selectedSemester || 1, semester2Start);
    const { data } = await supabase
      .from('score_logs').select('*').eq('student_id', student.id).gte('created_at', wr.start).lte('created_at', wr.end).order('created_at', { ascending: false });
    setScoreHistory(data || []);
    setHistoryLoading(false);
  };

  /* ---- LOADING ---- */
  if (loading) {
    return (
      <div style={{ ...styles.centerScreen, width: '100%' }}>
        <KokomiLoading text="Đang tải bảng điểm..." />
      </div>
    );
  }

  // Score loading overlay for week changes
  const scoreLoadingOverlay = scoreLoading && (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, backdropFilter: 'blur(4px)' }}>
      <KokomiLoading text="Đang tải điểm..." />
    </div>
  );

  /* ---- ERROR ---- */
  if (error) {
    return (
      <div style={{ ...styles.centerScreen, width: '100%' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2 style={{ color: '#1E293B', marginBottom: 8 }}>Rất tiếc!</h2>
        <p style={{ color: '#64748B', marginBottom: 24 }}>{error}</p>
        <a href="/" style={styles.primaryBtn}>Về trang chủ</a>
      </div>
    );
  }

  const top3 = rankedStudents.slice(0, 3);

  /* ---- MAIN ---- */
  return (
    <div className="public-page" style={{ minHeight: '100vh', width: '100%', background: '#0F172A', color: '#E2E8F0', fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {scoreLoadingOverlay}

      {/* ===== HERO ===== */}
      <div style={{
        background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 50%, #1E1B4B 100%)',
        padding: '48px 24px 80px', /* hero-section */
        textAlign: 'center',
        position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: '20%', left: '10%', width: 300, height: 300, background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', borderRadius: '50%' }}></div>
        <div style={{ position: 'absolute', top: '30%', right: '5%', width: 200, height: 200, background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)', borderRadius: '50%' }}></div>

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 700, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)', padding: '6px 14px', borderRadius: 100, color: '#A5B4FC', fontSize: '0.8rem', fontWeight: 600, marginBottom: 20 }}>
            <Calendar size={13} /> Năm học 2024 - 2025
          </div>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 800, color: '#F8FAFC', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
            📊 Bảng Điểm Thi Đua
          </h1>
          <p style={{ color: '#94A3B8', fontSize: '1rem', margin: 0 }}>
            Lớp <strong style={{ color: '#E0E7FF' }}>{classId}</strong> &bull; {students.length} học sinh &bull; {new Date().toLocaleDateString('vi-VN')}
          </p>
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', color: '#94A3B8' }}>📚 Học kỳ:</span>
            <select
              value={selectedSemester || 1}
              onChange={e => { setSelectedSemester(Number(e.target.value)); setSelectedWeek(0); }}
              style={{
                padding: '8px 32px 8px 14px', borderRadius: 10,
                border: '1px solid rgba(99,102,241,0.4)', background: 'rgba(30,41,59,0.9)',
                color: '#E2E8F0', fontSize: '0.88rem', fontWeight: 600,
                cursor: 'pointer', outline: 'none',
              }}
            >
              <option value={1}>Học kỳ 1</option>
              <option value={2}>Học kỳ 2</option>
            </select>
            <span style={{ fontSize: '0.85rem', color: '#94A3B8' }}>📅 Xem theo:</span>
            <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(99,102,241,0.4)' }}>
              {[{ key: 'week', label: 'Tuần' }, { key: 'month', label: 'Tháng' }, { key: 'semester', label: 'Học kỳ' }, { key: 'year', label: 'Cả năm' }].map(m => (
                <button key={m.key} onClick={() => { setViewMode(m.key); setSelectedWeek(0); setSelectedMonth(0); }} style={{
                  padding: '8px 14px', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                  background: viewMode === m.key ? 'rgba(99,102,241,0.8)' : 'rgba(30,41,59,0.9)',
                  color: viewMode === m.key ? '#fff' : '#94A3B8',
                  transition: 'all 0.2s',
                }}>{m.label}</button>
              ))}
            </div>
            {viewMode === 'week' && (
              <select
                value={selectedWeek}
                onChange={e => setSelectedWeek(Number(e.target.value))}
                style={{
                  padding: '8px 32px 8px 14px', borderRadius: 10,
                  border: '1px solid rgba(99,102,241,0.4)', background: 'rgba(30,41,59,0.9)',
                  color: '#E2E8F0', fontSize: '0.88rem', fontWeight: 600,
                  cursor: 'pointer', outline: 'none',
                }}
              >
                {weeks.map(w => (
                  <option key={w.offset} value={w.offset}>
                    {w.isCurrent ? `Tuần hiện tại (${w.label})` : w.label}
                  </option>
                ))}
              </select>
            )}
            {viewMode === 'month' && (
              <select
                value={selectedMonth}
                onChange={e => { const v = Number(e.target.value); setSelectedMonth(v); setSelectedSemester(getSemesterForMonth(v, semester2Start)); }}
                style={{
                  padding: '8px 32px 8px 14px', borderRadius: 10,
                  border: '1px solid rgba(99,102,241,0.4)', background: 'rgba(30,41,59,0.9)',
                  color: '#E2E8F0', fontSize: '0.88rem', fontWeight: 600,
                  cursor: 'pointer', outline: 'none',
                }}
              >
                {months.map(m => (
                  <option key={m.offset} value={m.offset}>{m.label}</option>
                ))}
              </select>
            )}
            {(viewMode === 'week' && selectedWeek !== 0) && (
              <span style={{ fontSize: '0.78rem', color: '#FBBF24', background: 'rgba(251,191,36,0.15)', padding: '4px 12px', borderRadius: 8, fontWeight: 600 }}>
                ⏳ Đang xem tuần cũ
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ===== CONTENT ===== */}
      <div className="public-content" style={{ maxWidth: 1400, margin: '-40px auto 0', padding: '0 40px 64px', position: 'relative', zIndex: 5 }}>

        {/* Search */}
        <div style={{
          background: '#1E293B', border: '1px solid #334155', borderRadius: 16,
          padding: '6px 6px 6px 20px', display: 'flex', alignItems: 'center', marginBottom: 32
        }}>
          <Search size={18} color="#64748B" />
          <input
            type="text" placeholder="Tìm kiếm theo tên, mã HS hoặc tổ..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{ flex: 1, border: 'none', background: 'transparent', padding: '14px 12px', fontSize: '0.95rem', color: '#E2E8F0', outline: 'none' }}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} style={{ ...styles.iconBtn, marginRight: 6 }}><X size={16} /></button>
          )}
        </div>

        {/* Top 3 Podium */}
        {!searchTerm && top3.length > 0 && (
          <div className="public-podium" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
            {top3.map((s, idx) => {
              const colors = [
                { bg: 'linear-gradient(135deg, #78350F, #D97706)', glow: 'rgba(217,119,6,0.2)', accent: '#FCD34D' },
                { bg: 'linear-gradient(135deg, #374151, #6B7280)', glow: 'rgba(107,114,128,0.2)', accent: '#D1D5DB' },
                { bg: 'linear-gradient(135deg, #7C2D12, #C2410C)', glow: 'rgba(194,65,12,0.2)', accent: '#FDBA74' },
              ];
              const c = colors[idx];
              return (
                <div key={s.id} onClick={() => handleViewHistory(s)} style={{
                  background: c.bg, borderRadius: 20, padding: '28px 16px', textAlign: 'center',
                  cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s',
                  boxShadow: `0 8px 32px ${c.glow}`, position: 'relative', overflow: 'hidden'
                }}
                  onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 16px 48px ${c.glow}`; }}
                  onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 8px 32px ${c.glow}`; }}
                >
                  <div style={{ position: 'absolute', top: -30, right: -30, opacity: 0.08 }}>
                    <Star size={120} color="#fff" />
                  </div>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 12px', fontSize: '1.5rem', fontWeight: 900, color: '#fff'
                  }}>
                    {s.rank}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#fff', marginBottom: 4 }}>{s.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', marginBottom: 12 }}>{s.group_name || '—'}</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: c.accent }}>{s.score}<span style={{ fontSize: '0.9rem', opacity: 0.8 }}>đ</span></div>
                </div>
              );
            })}
          </div>
        )}

        {/* Full Leaderboard */}
        <div style={{ background: '#1E293B', borderRadius: 20, border: '1px solid #334155', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#F1F5F9', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} color="#818CF8" /> Bảng xếp hạng
            </h2>
            <span style={{ background: '#312E81', color: '#A5B4FC', padding: '4px 12px', borderRadius: 100, fontSize: '0.8rem', fontWeight: 600 }}>
              {filteredStudents.length} HS
            </span>
          </div>

          {filteredStudents.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#64748B' }}>
              <Search size={40} color="#475569" style={{ marginBottom: 12 }} />
              <p>Không tìm thấy học sinh phù hợp.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #334155' }}>
                    <th style={{ padding: '14px 16px', textAlign: 'center', color: '#94A3B8', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', width: 60 }}>Hạng</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', color: '#94A3B8', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Họ và tên</th>
                    <th className="public-group-col" style={{ padding: '14px 16px', textAlign: 'center', color: '#94A3B8', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', width: 80 }}>Tổ</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', color: '#94A3B8', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', width: 180 }}>Hạnh kiểm</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', color: '#94A3B8', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', width: 70 }}>Điểm</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s, i) => (
                    <tr
                      key={s.id}
                      onClick={() => handleViewHistory(s)}
                      style={{
                        borderTop: '1px solid rgba(51,65,85,0.5)',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(51,65,85,0.2)',
                        cursor: 'pointer', transition: 'background 0.15s',
                      }}
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
                      onMouseOut={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(51,65,85,0.2)'}
                    >
                      {/* Rank */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', margin: '0 auto',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: '0.85rem',
                          background: s.rank <= 3 ? 'rgba(251,191,36,0.15)' : 'rgba(100,116,139,0.2)',
                          color: s.rank <= 3 ? '#FBBF24' : '#94A3B8',
                        }}>
                          {s.rank}
                        </div>
                      </td>
                      {/* Name */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#F1F5F9', fontSize: '0.95rem' }}>{s.name}</div>
                        <div style={{ color: '#64748B', fontSize: '0.75rem' }}>{s.id}</div>
                      </td>
                      {/* Group */}
                      <td className="public-group-col" style={{ padding: '12px 16px', textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem' }}>
                        {s.group_name || '—'}
                      </td>
                      {/* Conduct */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {(() => {
                          const semesters = (viewMode === 'year') ? [1, 2] : [selectedSemester || 1];
                          const entries = semesters.map(sem => ({ sem, r: conductMap[s.id]?.[sem] })).filter(e => e.r);
                          if (entries.length === 0) return <span style={{ color: '#475569', fontSize: '0.8rem' }}>—</span>;
                          const colors = { 'Tốt': '#34D399', 'Khá': '#60A5FA', 'Trung bình': '#FBBF24', 'Yếu': '#F87171' };
                          return (
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                              {entries.map(({ sem, r }) => (
                                <span key={sem} style={{
                                  padding: '3px 10px', borderRadius: 6,
                                  background: `${colors[r]}20`, color: colors[r],
                                  fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap',
                                }}>
                                  {semesters.length > 1 ? `HK${sem}: ` : ''}{r}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      {/* Score */}
                      <td style={{
                        padding: '12px 16px', textAlign: 'center',
                        fontWeight: 800, fontSize: '1.1rem',
                        color: s.score >= 8 ? '#34D399' : s.score >= 5 ? '#FBBF24' : '#F87171',
                      }}>
                        {s.score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#475569', fontSize: '0.8rem', marginTop: 24 }}>
          Bấm vào học sinh để xem chi tiết lý do cộng/trừ điểm
        </p>
      </div>

      {/* ===== SCORE HISTORY MODAL ===== */}
      {historyStudent && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16,
        }} onClick={() => setHistoryStudent(null)}>
          <div style={{
            background: '#1E293B', border: '1px solid #334155', borderRadius: 24,
            width: '100%', maxWidth: 520, maxHeight: '85vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#F1F5F9' }}>📜 Lịch sử điểm</h3>
                <p style={{ margin: '4px 0 0', color: '#94A3B8', fontSize: '0.85rem' }}>
                  {historyStudent.name} — <strong style={{ color: '#818CF8' }}>{historyStudent.score}đ</strong>
                </p>
              </div>
              <button onClick={() => setHistoryStudent(null)} style={styles.iconBtn}><X size={18} /></button>
            </div>

            {/* Body */}
            <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
              {historyLoading ? (
                <KokomiLoading text="Đang tải lịch sử điểm..." />
              ) : scoreHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748B' }}>
                  <Calendar size={40} color="#475569" style={{ marginBottom: 12 }} />
                  <p style={{ fontWeight: 500, marginBottom: 4 }}>Chưa có ghi nhận nào</p>
                  <p style={{ fontSize: '0.85rem' }}>Điểm cơ bản: 10đ</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {scoreHistory.map((log, i) => {
                    const positive = log.change > 0;
                    return (
                      <div key={i} style={{
                        background: positive ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                        border: `1px solid ${positive ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                        borderRadius: 14, padding: '14px 18px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {positive ? <TrendingUp size={16} color="#10B981" /> : <TrendingDown size={16} color="#EF4444" />}
                            <span style={{ fontWeight: 800, color: positive ? '#34D399' : '#F87171', fontSize: '1rem' }}>
                              {positive ? '+' : ''}{log.change} điểm
                            </span>
                          </div>
                          <span style={{ color: '#64748B', fontSize: '0.75rem' }}>
                            {new Date(log.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p style={{ margin: 0, color: '#CBD5E1', fontSize: '0.9rem', lineHeight: 1.4 }}>
                          {log.note || <span style={{ color: '#475569', fontStyle: 'italic' }}>Không ghi lý do</span>}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== RESPONSIVE STYLES ===== */}
      <style>{`
        @media (max-width: 768px) {
          .public-content { padding: 0 12px 40px !important; margin-top: -30px !important; }
          .public-podium { grid-template-columns: 1fr !important; gap: 12px !important; }
          .public-page h1 { font-size: 1.6rem !important; }
          .public-page h2 { font-size: 1rem !important; }
        }
        @media (max-width: 480px) {
          .public-content { padding: 0 8px 32px !important; margin-top: -20px !important; }
          .public-group-col { display: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ---- SHARED STYLES ---- */
const styles = {
  centerScreen: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh', background: '#0F172A', color: '#E2E8F0', padding: 24,
  },
  spinner: {
    width: 44, height: 44, border: '4px solid #334155', borderTopColor: '#818CF8',
    borderRadius: '50%', animation: 'spin 1s linear infinite',
  },
  primaryBtn: {
    display: 'inline-block', padding: '12px 24px', background: '#6366F1', color: '#fff',
    textDecoration: 'none', borderRadius: 12, fontWeight: 600,
  },
  iconBtn: {
    background: 'rgba(100,116,139,0.2)', border: '1px solid #475569', borderRadius: '50%',
    width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: '#94A3B8', padding: 0,
  },
};
