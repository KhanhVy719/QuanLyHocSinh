import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { getSemesterRanges } from '../lib/weekUtils';

const RATINGS = ['Tốt', 'Khá', 'Trung bình', 'Yếu'];
const RATING_COLORS = {
  'Tốt': { bg: '#D1FAE5', color: '#059669' },
  'Khá': { bg: '#DBEAFE', color: '#2563EB' },
  'Trung bình': { bg: '#FEF3C7', color: '#D97706' },
  'Yếu': { bg: '#FEE2E2', color: '#DC2626' },
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

  const classId = user?.assigned_class;

  // Load semester settings
  useEffect(() => {
    async function load() {
      if (!classId) return;
      const { data } = await supabase.from('semester_settings').select('semester2_start').eq('class_id', classId).single();
      if (data?.semester2_start) setSemester2Start(data.semester2_start);
    }
    load();
  }, [classId]);

  // Load students + scores + existing ratings
  const fetchData = useCallback(async () => {
    if (!classId) return;
    setLoading(true);

    const semesterRanges = getSemesterRanges(semester2Start);
    const range = semester === 1 ? semesterRanges.hk1 : semesterRanges.hk2;

    // Fetch students
    const { data: studs } = await supabase
      .from('students')
      .select('id, name, group_name')
      .eq('class', classId)
      .order('id');

    if (!studs) { setLoading(false); return; }

    // Fetch score logs in semester range
    const ids = studs.map(s => s.id);
    const { data: logs } = await supabase
      .from('score_logs')
      .select('student_id, change')
      .in('student_id', ids)
      .gte('created_at', range.start.toISOString())
      .lte('created_at', range.end.toISOString());

    const scoreMap = {};
    (logs || []).forEach(l => {
      scoreMap[l.student_id] = (scoreMap[l.student_id] ?? 0) + l.change;
    });

    // Fetch existing ratings
    const { data: existingRatings } = await supabase
      .from('conduct_ratings')
      .select('student_id, rating, note')
      .in('student_id', ids)
      .eq('semester', semester);

    const rMap = {};
    const nMap = {};
    (existingRatings || []).forEach(r => {
      rMap[r.student_id] = r.rating;
      nMap[r.student_id] = r.note || '';
    });

    setStudents(studs.map(s => ({ ...s, score: scoreMap[s.id] ?? 0 })));
    setRatings(rMap);
    setNotes(nMap);
    setLoading(false);
  }, [classId, semester, semester2Start]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-classify all unrated students
  const autoClassify = () => {
    const newRatings = { ...ratings };
    let count = 0;
    students.forEach(s => {
      if (!newRatings[s.id]) {
        newRatings[s.id] = classifyConduct(s.score);
        count++;
      }
    });
    setRatings(newRatings);
    setSaveMsg(count > 0 ? `🤖 Đã tự động xếp ${count} học sinh chưa có xếp loại.` : '🤖 Tất cả đã có xếp loại rồi.');
  };

  // Auto-classify ALL students (override)
  const autoClassifyAll = () => {
    const newRatings = {};
    students.forEach(s => {
      newRatings[s.id] = classifyConduct(s.score);
    });
    setRatings(newRatings);
    setSaveMsg(`🔄 Đã xếp lại tất cả ${students.length} học sinh theo điểm thi đua.`);
  };

  // Save all ratings
  const saveAll = async () => {
    setSaving(true);
    setSaveMsg('');
    const rows = students
      .filter(s => ratings[s.id])
      .map(s => ({
        student_id: s.id,
        semester,
        rating: ratings[s.id],
        note: notes[s.id] || '',
        updated_at: new Date().toISOString(),
      }));

    if (rows.length === 0) {
      setSaveMsg('Chưa có xếp loại nào để lưu.');
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from('conduct_ratings')
      .upsert(rows, { onConflict: 'student_id,semester' });

    if (error) {
      setSaveMsg('Lỗi: ' + error.message);
    } else {
      setSaveMsg(`✅ Đã lưu ${rows.length} xếp loại thành công!`);
    }
    setSaving(false);
  };

  // Stats
  const stats = { 'Tốt': 0, 'Khá': 0, 'Trung bình': 0, 'Yếu': 0 };
  students.forEach(s => {
    if (ratings[s.id]) stats[ratings[s.id]]++;
  });
  const rated = Object.values(stats).reduce((a, b) => a + b, 0);

  if (!classId) {
    return <div style={{ padding: 32, textAlign: 'center', color: '#6B7280' }}>Bạn chưa được phân công lớp.</div>;
  }

  return (
    <div style={{ padding: '0 0 32px' }}>
      <h2 style={{ margin: '0 0 20px', color: '#1F2937', fontSize: '1.5rem' }}>📝 Xếp hạnh kiểm - {classId}</h2>

      {/* Semester Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
        {[1, 2].map(s => (
          <button
            key={s}
            onClick={() => setSemester(s)}
            style={{
              padding: '10px 28px', border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: '0.95rem',
              background: semester === s ? '#6366F1' : '#F3F4F6',
              color: semester === s ? '#fff' : '#6B7280',
              borderRadius: s === 1 ? '10px 0 0 10px' : '0 10px 10px 0',
              transition: 'all 0.2s',
            }}
          >
            Học kỳ {s}
          </button>
        ))}
      </div>

      {/* Stats Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {RATINGS.map(r => (
          <div key={r} style={{
            padding: '8px 16px', borderRadius: 10,
            background: RATING_COLORS[r].bg, textAlign: 'center', minWidth: 70,
          }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: RATING_COLORS[r].color }}>{stats[r]}</div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: RATING_COLORS[r].color }}>{r}</div>
          </div>
        ))}
        <div style={{ padding: '8px 16px', borderRadius: 10, background: '#F3F4F6', textAlign: 'center', minWidth: 70 }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#374151' }}>{rated}/{students.length}</div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6B7280' }}>Đã xếp</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          onClick={autoClassify}
          style={{
            padding: '8px 18px', borderRadius: 8, border: '1px solid #6366F1',
            background: '#EEF2FF', color: '#6366F1', fontWeight: 600,
            cursor: 'pointer', fontSize: '0.85rem',
          }}
        >
          🤖 Tự động xếp (chưa có)
        </button>
        <button
          onClick={autoClassifyAll}
          style={{
            padding: '8px 18px', borderRadius: 8, border: '1px solid #D97706',
            background: '#FFFBEB', color: '#D97706', fontWeight: 600,
            cursor: 'pointer', fontSize: '0.85rem',
          }}
        >
          🔄 Xếp lại tất cả
        </button>
        <button
          onClick={saveAll}
          disabled={saving}
          style={{
            padding: '8px 18px', borderRadius: 8, border: 'none',
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            color: '#fff', fontWeight: 600, cursor: saving ? 'wait' : 'pointer',
            fontSize: '0.85rem', opacity: saving ? 0.7 : 1,
          }}
        >
          💾 {saving ? 'Đang lưu...' : 'Lưu tất cả'}
        </button>
      </div>
      {saveMsg && (
        <div style={{
          padding: '8px 16px', borderRadius: 8, marginBottom: 12,
          background: saveMsg.startsWith('✅') ? '#D1FAE5' : saveMsg.startsWith('🤖') || saveMsg.startsWith('🔄') ? '#DBEAFE' : '#FEE2E2',
          color: saveMsg.startsWith('✅') ? '#059669' : saveMsg.startsWith('🤖') || saveMsg.startsWith('🔄') ? '#2563EB' : '#DC2626',
          fontSize: '0.88rem', fontWeight: 600,
        }}>
          {saveMsg}
        </div>
      )}

      {/* Student Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Đang tải...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="student-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(135deg, #6366F1, #818CF8)', color: '#fff' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700 }}>Mã HS</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700 }}>Họ và tên</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>Tổ</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>Điểm HK</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>Xếp loại</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700 }}>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => {
                const r = ratings[s.id];
                const rc = r ? RATING_COLORS[r] : null;
                return (
                  <tr key={s.id} style={{ background: i % 2 === 0 ? '#fff' : '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>{s.id}</td>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1F2937' }}>{s.name}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#6B7280' }}>{s.group_name || '-'}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: s.score >= 0 ? '#059669' : '#DC2626' }}>
                      {s.score}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <select
                        value={r || ''}
                        onChange={e => setRatings(prev => ({ ...prev, [s.id]: e.target.value }))}
                        style={{
                          padding: '6px 12px', borderRadius: 8, border: '1px solid #D1D5DB',
                          fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                          background: rc ? rc.bg : '#fff',
                          color: rc ? rc.color : '#374151',
                          minWidth: 120,
                        }}
                      >
                        <option value="">-- Chọn --</option>
                        {RATINGS.map(rt => (
                          <option key={rt} value={rt}>{rt}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <input
                        type="text"
                        value={notes[s.id] || ''}
                        onChange={e => setNotes(prev => ({ ...prev, [s.id]: e.target.value }))}
                        placeholder="Ghi chú..."
                        style={{
                          padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB',
                          fontSize: '0.85rem', width: '100%', minWidth: 120,
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
