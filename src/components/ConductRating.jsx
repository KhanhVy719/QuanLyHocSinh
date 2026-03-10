import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { getSemesterRanges } from '../lib/weekUtils';

const RATINGS = ['Tốt', 'Khá', 'Trung bình', 'Yếu'];
const RATING_STYLE = {
  'Tốt':        { bg: 'linear-gradient(135deg, #D1FAE5, #A7F3D0)', color: '#065F46', icon: '🌟', border: '#6EE7B7' },
  'Khá':        { bg: 'linear-gradient(135deg, #DBEAFE, #BFDBFE)', color: '#1E40AF', icon: '👍', border: '#93C5FD' },
  'Trung bình': { bg: 'linear-gradient(135deg, #FEF3C7, #FDE68A)', color: '#92400E', icon: '📋', border: '#FCD34D' },
  'Yếu':        { bg: 'linear-gradient(135deg, #FEE2E2, #FECACA)', color: '#991B1B', icon: '⚠️', border: '#FCA5A5' },
};

function classifyConduct(score) {
  if (score >= 0) return 'Tốt';
  if (score >= -3) return 'Khá';
  if (score >= -7) return 'Trung bình';
  return 'Yếu';
}

export default function ConductRating() {
  const { user } = useAuth();
  const [semester, setSemester] = useState(1);
  const [students, setStudents] = useState([]);
  const [ratings, setRatings] = useState({});
  const [notes, setNotes] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [semester2Start, setSemester2Start] = useState(null);
  const [saveMsg, setSaveMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const classId = user?.assigned_class;

  useEffect(() => {
    async function load() {
      if (!classId) return;
      const { data } = await supabase.from('semester_settings').select('semester2_start').eq('class_id', classId).single();
      if (data?.semester2_start) setSemester2Start(data.semester2_start);
    }
    load();
  }, [classId]);

  const fetchData = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    const semesterRanges = getSemesterRanges(semester2Start);
    const range = semester === 1 ? semesterRanges.hk1 : semesterRanges.hk2;

    const { data: studs } = await supabase.from('students').select('id, name, group_name').eq('class', classId).order('id');
    if (!studs) { setLoading(false); return; }

    const ids = studs.map(s => s.id);
    const [{ data: logs }, { data: existingRatings }] = await Promise.all([
      supabase.from('score_logs').select('student_id, change').in('student_id', ids).gte('created_at', range.start.toISOString()).lte('created_at', range.end.toISOString()),
      supabase.from('conduct_ratings').select('student_id, rating, note').in('student_id', ids).eq('semester', semester),
    ]);

    const scoreMap = {};
    (logs || []).forEach(l => { scoreMap[l.student_id] = (scoreMap[l.student_id] ?? 0) + l.change; });

    const rMap = {}, nMap = {};
    (existingRatings || []).forEach(r => { rMap[r.student_id] = r.rating; nMap[r.student_id] = r.note || ''; });

    setStudents(studs.map(s => ({ ...s, score: scoreMap[s.id] ?? 0 })));
    setRatings(rMap);
    setNotes(nMap);
    setLoading(false);
  }, [classId, semester, semester2Start]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const autoClassify = () => {
    const newRatings = { ...ratings };
    let count = 0;
    students.forEach(s => { if (!newRatings[s.id]) { newRatings[s.id] = classifyConduct(s.score); count++; } });
    setRatings(newRatings);
    setSaveMsg(count > 0 ? `🤖 Đã tự động xếp ${count} học sinh chưa có xếp loại.` : '🤖 Tất cả đã có xếp loại rồi.');
  };

  const autoClassifyAll = () => {
    const newRatings = {};
    students.forEach(s => { newRatings[s.id] = classifyConduct(s.score); });
    setRatings(newRatings);
    setSaveMsg(`🔄 Đã xếp lại tất cả ${students.length} học sinh theo điểm thi đua.`);
  };

  const saveAll = async () => {
    setSaving(true); setSaveMsg('');
    const rows = students.filter(s => ratings[s.id]).map(s => ({
      student_id: s.id, semester, rating: ratings[s.id], note: notes[s.id] || '', updated_at: new Date().toISOString(),
    }));
    if (rows.length === 0) { setSaveMsg('⚠️ Chưa có xếp loại nào để lưu.'); setSaving(false); return; }
    const { error } = await supabase.from('conduct_ratings').upsert(rows, { onConflict: 'student_id,semester' });
    setSaveMsg(error ? '❌ Lỗi: ' + error.message : `✅ Đã lưu ${rows.length} xếp loại thành công!`);
    setSaving(false);
  };

  // Stats
  const stats = { 'Tốt': 0, 'Khá': 0, 'Trung bình': 0, 'Yếu': 0 };
  students.forEach(s => { if (ratings[s.id]) stats[ratings[s.id]]++; });
  const rated = Object.values(stats).reduce((a, b) => a + b, 0);

  // Filter
  const filtered = searchTerm
    ? students.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.id.toLowerCase().includes(searchTerm.toLowerCase()))
    : students;

  if (!classId) {
    return <div style={{ padding: 48, textAlign: 'center', color: '#6B7280', fontSize: '1rem' }}>Bạn chưa được phân công lớp.</div>;
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #A78BFA 100%)',
        borderRadius: 20, padding: '28px 32px', marginBottom: 24, color: '#fff',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
        boxShadow: '0 8px 32px rgba(99,102,241,0.3)',
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            📝 Xếp hạnh kiểm
          </h2>
          <p style={{ margin: '4px 0 0', opacity: 0.85, fontSize: '0.9rem' }}>
            Lớp <strong>{classId}</strong> • {students.length} học sinh • Năm học 2025-2026
          </p>
        </div>
        {/* Semester Toggle */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 3, backdropFilter: 'blur(10px)' }}>
          {[1, 2].map(s => (
            <button key={s} onClick={() => { setSemester(s); setSaveMsg(''); setSearchTerm(''); }}
              style={{
                padding: '8px 24px', border: 'none', cursor: 'pointer', borderRadius: 10,
                fontWeight: 700, fontSize: '0.88rem', transition: 'all 0.25s',
                background: semester === s ? '#fff' : 'transparent',
                color: semester === s ? '#6366F1' : 'rgba(255,255,255,0.8)',
                boxShadow: semester === s ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
              }}
            >
              Học kỳ {s}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 20 }}>
        {RATINGS.map(r => {
          const st = RATING_STYLE[r];
          return (
            <div key={r} style={{
              background: st.bg, borderRadius: 14, padding: '16px 12px', textAlign: 'center',
              border: `1px solid ${st.border}`, transition: 'transform 0.2s',
            }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ fontSize: '1.2rem', marginBottom: 2 }}>{st.icon}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: st.color }}>{stats[r]}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: st.color, opacity: 0.8 }}>{r}</div>
            </div>
          );
        })}
        <div style={{
          background: 'linear-gradient(135deg, #F3F4F6, #E5E7EB)', borderRadius: 14,
          padding: '16px 12px', textAlign: 'center', border: '1px solid #D1D5DB',
        }}>
          <div style={{ fontSize: '1.2rem', marginBottom: 2 }}>📊</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#374151' }}>{rated}<span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#6B7280' }}>/{students.length}</span></div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280' }}>Đã xếp</div>
        </div>
      </div>

      {/* Action Bar */}
      <div style={{
        background: '#fff', borderRadius: 14, padding: '12px 16px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
          <input
            type="text" placeholder="🔍 Tìm học sinh..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%', padding: '8px 14px', borderRadius: 8, border: '1px solid #E5E7EB',
              fontSize: '0.85rem', outline: 'none', transition: 'border 0.2s',
            }}
            onFocus={e => e.target.style.borderColor = '#6366F1'}
            onBlur={e => e.target.style.borderColor = '#E5E7EB'}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={autoClassify} style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid #6366F1',
            background: '#EEF2FF', color: '#6366F1', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem',
            transition: 'all 0.2s',
          }}
            onMouseOver={e => { e.currentTarget.style.background = '#6366F1'; e.currentTarget.style.color = '#fff'; }}
            onMouseOut={e => { e.currentTarget.style.background = '#EEF2FF'; e.currentTarget.style.color = '#6366F1'; }}
          >
            🤖 Xếp chưa có
          </button>
          <button onClick={autoClassifyAll} style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid #D97706',
            background: '#FFFBEB', color: '#D97706', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem',
            transition: 'all 0.2s',
          }}
            onMouseOver={e => { e.currentTarget.style.background = '#D97706'; e.currentTarget.style.color = '#fff'; }}
            onMouseOut={e => { e.currentTarget.style.background = '#FFFBEB'; e.currentTarget.style.color = '#D97706'; }}
          >
            🔄 Xếp lại tất cả
          </button>
          <button onClick={saveAll} disabled={saving} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none',
            background: saving ? '#9CA3AF' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            color: '#fff', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontSize: '0.82rem',
            boxShadow: saving ? 'none' : '0 2px 8px rgba(99,102,241,0.4)', transition: 'all 0.2s',
          }}>
            💾 {saving ? 'Đang lưu...' : 'Lưu tất cả'}
          </button>
        </div>
      </div>

      {/* Message */}
      {saveMsg && (
        <div style={{
          padding: '10px 16px', borderRadius: 10, marginBottom: 16, fontWeight: 600, fontSize: '0.88rem',
          animation: 'fadeIn 0.3s ease',
          background: saveMsg.startsWith('✅') ? '#D1FAE5' : saveMsg.startsWith('❌') || saveMsg.startsWith('⚠️') ? '#FEE2E2' : '#DBEAFE',
          color: saveMsg.startsWith('✅') ? '#065F46' : saveMsg.startsWith('❌') || saveMsg.startsWith('⚠️') ? '#991B1B' : '#1E40AF',
          border: `1px solid ${saveMsg.startsWith('✅') ? '#6EE7B7' : saveMsg.startsWith('❌') || saveMsg.startsWith('⚠️') ? '#FCA5A5' : '#93C5FD'}`,
        }}>
          {saveMsg}
        </div>
      )}

      {/* Student Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#6B7280' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>⏳</div>
          Đang tải dữ liệu...
        </div>
      ) : (
        <div style={{
          background: '#fff', borderRadius: 16, overflow: 'hidden',
          border: '1px solid #E5E7EB', boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{
                background: 'linear-gradient(135deg, #6366F1, #818CF8)', color: '#fff',
              }}>
                <th style={thStyle}>STT</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Mã HS</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Họ và tên</th>
                <th style={thStyle}>Tổ</th>
                <th style={thStyle}>Điểm TĐ</th>
                <th style={{ ...thStyle, minWidth: 140 }}>Xếp loại</th>
                <th style={{ ...thStyle, textAlign: 'left', minWidth: 150 }}>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const r = ratings[s.id];
                const rs = r ? RATING_STYLE[r] : null;
                return (
                  <tr key={s.id} style={{
                    background: i % 2 === 0 ? '#fff' : '#FAFBFC',
                    borderBottom: '1px solid #F3F4F6',
                    transition: 'background 0.15s',
                  }}
                    onMouseOver={e => e.currentTarget.style.background = '#F0F0FF'}
                    onMouseOut={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#FAFBFC'}
                  >
                    <td style={{ ...tdStyle, textAlign: 'center', color: '#9CA3AF', fontWeight: 600, fontSize: '0.82rem' }}>{i + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: '#6366F1', fontSize: '0.85rem' }}>{s.id}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: '#1F2937' }}>{s.name}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', color: '#6B7280', fontSize: '0.85rem' }}>{s.group_name || '—'}</td>
                    <td style={{
                      ...tdStyle, textAlign: 'center', fontWeight: 800, fontSize: '0.95rem',
                      color: s.score > 0 ? '#059669' : s.score < 0 ? '#DC2626' : '#6B7280',
                    }}>
                      {s.score > 0 ? '+' : ''}{s.score}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <select
                        value={r || ''}
                        onChange={e => setRatings(prev => ({ ...prev, [s.id]: e.target.value }))}
                        style={{
                          padding: '6px 28px 6px 10px', borderRadius: 8,
                          border: rs ? `2px solid ${rs.border}` : '1px solid #D1D5DB',
                          fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                          background: rs ? rs.bg : '#fff', color: rs ? rs.color : '#374151',
                          width: '100%', maxWidth: 140, outline: 'none',
                          appearance: 'none',
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%236B7280' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`,
                          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
                        }}
                      >
                        <option value="">— Chọn —</option>
                        {RATINGS.map(rt => <option key={rt} value={rt}>{RATING_STYLE[rt].icon} {rt}</option>)}
                      </select>
                    </td>
                    <td style={tdStyle}>
                      <input
                        type="text" value={notes[s.id] || ''}
                        onChange={e => setNotes(prev => ({ ...prev, [s.id]: e.target.value }))}
                        placeholder="Nhập ghi chú..."
                        style={{
                          padding: '6px 10px', borderRadius: 6, border: '1px solid #E5E7EB',
                          fontSize: '0.82rem', width: '100%', outline: 'none', transition: 'border 0.2s',
                        }}
                        onFocus={e => e.target.style.borderColor = '#6366F1'}
                        onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                      />
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>
                  Không tìm thấy học sinh nào.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

const thStyle = {
  padding: '13px 14px', fontWeight: 700, fontSize: '0.8rem',
  textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '10px 14px', fontSize: '0.88rem',
};
