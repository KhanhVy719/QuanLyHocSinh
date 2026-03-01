import { useState, useEffect } from 'react';
import { Search, Award, TrendingUp, AlertTriangle, ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import KokomiLoading from './KokomiLoading';

const classOpts = ['Tất cả lớp', '10A1', '10A2', '11A1', '11A2'];
const semesterOpts = ['Tất cả học kỳ', 'HK1', 'HK2'];

function getRankBadge(r) {
  if (r === 'Xuất sắc' || r === 'Giỏi') return 'success';
  if (r === 'Khá') return 'info';
  if (r === 'Trung bình') return 'warning';
  return 'danger';
}

function getRankColor(r) {
  if (r === 'Xuất sắc') return '#059669';
  if (r === 'Giỏi') return '#10B981';
  if (r === 'Khá') return '#3B82F6';
  if (r === 'Trung bình') return '#F59E0B';
  return '#EF4444';
}

export default function GradeManagement() {
  const { user } = useAuth();
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cf, setCf] = useState('Tất cả lớp');
  const [smf, setSmf] = useState('Tất cả học kỳ');
  const [teacherClass, setTeacherClass] = useState(null);
  const [expanded, setExpanded] = useState({}); // { studentId: true/false }

  useEffect(() => {
    async function init() {
      setLoading(true);
      let assignedClass = null;

      if (user?.role === 'giaovien') {
        const { data: freshUser } = await supabase
          .from('users')
          .select('assigned_class')
          .eq('id', user.id)
          .single();
        assignedClass = freshUser?.assigned_class || null;
        setTeacherClass(assignedClass);
      }

      let query = supabase.from('grades').select('*').order('student_id');
      if (assignedClass) {
        query = query.eq('class', assignedClass);
      }
      const { data, error } = await query;
      if (error) console.error('Error:', error);
      else setGrades(data || []);
      setLoading(false);
    }
    init();
  }, [user]);

  // Filter grades
  const filtered = grades.filter((g) => {
    const ms = (g.student_name || '').toLowerCase().includes(search.toLowerCase()) || g.student_id.toLowerCase().includes(search.toLowerCase());
    const mc = cf === 'Tất cả lớp' || g.class === cf;
    const msem = smf === 'Tất cả học kỳ' || g.semester === smf;
    return ms && mc && msem;
  });

  // Group by student
  const studentMap = {};
  filtered.forEach(g => {
    if (!studentMap[g.student_id]) {
      studentMap[g.student_id] = {
        id: g.student_id,
        name: g.student_name,
        class: g.class,
        subjects: [],
      };
    }
    studentMap[g.student_id].subjects.push(g);
  });
  const students = Object.values(studentMap);

  // Calculate per-student averages
  students.forEach(s => {
    const avgs = s.subjects.map(g => Number(g.average));
    s.avg = avgs.length ? (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(1) : '0';
    const numAvg = parseFloat(s.avg);
    if (numAvg >= 9) s.rank = 'Xuất sắc';
    else if (numAvg >= 8) s.rank = 'Giỏi';
    else if (numAvg >= 6.5) s.rank = 'Khá';
    else if (numAvg >= 5) s.rank = 'Trung bình';
    else s.rank = 'Yếu';
  });

  // Stats from all filtered grades
  const allAvg = filtered.length ? (filtered.reduce((s, g) => s + Number(g.average), 0) / filtered.length).toFixed(2) : '0.00';
  const gioi = students.filter(s => s.rank === 'Giỏi' || s.rank === 'Xuất sắc').length;
  const kha = students.filter(s => s.rank === 'Khá').length;
  const canImprove = students.filter(s => s.rank === 'Yếu' || s.rank === 'Trung bình').length;

  function toggleExpand(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function expandAll() {
    const all = {};
    students.forEach(s => { all[s.id] = true; });
    setExpanded(all);
  }

  function collapseAll() {
    setExpanded({});
  }

  // Styles
  const studentRowStyle = (isOpen) => ({
    display: 'grid',
    gridTemplateColumns: '40px 80px 1fr 80px 120px 80px',
    alignItems: 'center',
    padding: '14px 20px',
    background: isOpen ? '#F0F4FF' : '#fff',
    borderBottom: isOpen ? 'none' : '1px solid #F3F4F6',
    cursor: 'pointer',
    transition: 'all 0.2s',
    borderRadius: isOpen ? '12px 12px 0 0' : 0,
    gap: 12,
  });

  const subjectRowStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 90px 90px 90px 100px',
    alignItems: 'center',
    padding: '10px 20px 10px 60px',
    background: '#FAFBFF',
    borderBottom: '1px solid #F0F2F5',
    fontSize: '0.88rem',
    gap: 8,
  };

  const subjectHeaderStyle = {
    ...subjectRowStyle,
    background: '#EEF2FF',
    fontWeight: 700,
    fontSize: '0.78rem',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    padding: '8px 20px 8px 60px',
  };

  return (
    <div>
      <div className="page-header"><h2>Quản lý điểm số</h2><p>{teacherClass ? `Điểm số học sinh lớp ${teacherClass}` : 'Quản lý điểm số của học sinh'}</p></div>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card"><div className="stat-info"><label>Điểm trung bình</label><div className="stat-value">{allAvg}</div></div><div className="stat-icon blue"><TrendingUp size={24} /></div></div>
        <div className="stat-card"><div className="stat-info"><label>Học sinh giỏi</label><div className="stat-value" style={{ color: 'var(--success)' }}>{gioi}</div></div><div className="stat-icon green"><Award size={24} /></div></div>
        <div className="stat-card"><div className="stat-info"><label>Học sinh khá</label><div className="stat-value" style={{ color: 'var(--info)' }}>{kha}</div></div><div className="stat-icon purple"><Award size={24} /></div></div>
        <div className="stat-card"><div className="stat-info"><label>Cần cải thiện</label><div className="stat-value" style={{ color: 'var(--warning)' }}>{canImprove}</div></div><div className="stat-icon orange"><AlertTriangle size={24} /></div></div>
      </div>

      <div className="filters-bar" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="search-input"><Search /><input type="text" placeholder="Tìm kiếm học sinh..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        {!teacherClass && <select className="filter-select" value={cf} onChange={(e) => setCf(e.target.value)}>{classOpts.map((c) => <option key={c}>{c}</option>)}</select>}
        <select className="filter-select" value={smf} onChange={(e) => setSmf(e.target.value)}>{semesterOpts.map((s) => <option key={s}>{s}</option>)}</select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={expandAll} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#6366F1' }}>Mở tất cả</button>
          <button onClick={collapseAll} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#6B7280' }}>Thu gọn</button>
        </div>
      </div>

      {loading ? (
        <KokomiLoading text="Đang tải điểm số..." />
      ) : students.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>Không có dữ liệu điểm</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #F3F4F6' }}>
          {/* Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '40px 80px 1fr 80px 120px 80px',
            padding: '12px 20px', background: 'var(--primary)', color: '#fff',
            fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em', gap: 12,
          }}>
            <span></span>
            <span>Mã HS</span>
            <span>Họ và tên</span>
            <span>Lớp</span>
            <span style={{ textAlign: 'center' }}>TB chung</span>
            <span style={{ textAlign: 'center' }}>Xếp loại</span>
          </div>

          {students.map(s => {
            const isOpen = expanded[s.id];
            return (
              <div key={s.id}>
                {/* Student row */}
                <div style={studentRowStyle(isOpen)} onClick={() => toggleExpand(s.id)}
                  onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = '#F9FAFB'; }}
                  onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = '#fff'; }}>
                  <span style={{ color: isOpen ? '#6366F1' : '#9CA3AF', transition: 'transform 0.2s' }}>
                    {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#374151' }}>{s.id}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{s.name}</span>
                  <span style={{ fontSize: '0.85rem', color: '#6B7280' }}>{s.class}</span>
                  <span style={{
                    textAlign: 'center', fontWeight: 700, fontSize: '1.05rem',
                    color: getRankColor(s.rank),
                  }}>{s.avg}</span>
                  <span style={{ textAlign: 'center' }}>
                    <span className={`badge ${getRankBadge(s.rank)}`} style={{ fontSize: '0.75rem' }}>{s.rank}</span>
                  </span>
                </div>

                {/* Expanded: subject grades */}
                {isOpen && (
                  <div style={{ borderBottom: '2px solid #E0E7FF', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                    <div style={subjectHeaderStyle}>
                      <span><BookOpen size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />Môn học</span>
                      <span style={{ textAlign: 'center' }}>Giữa kỳ</span>
                      <span style={{ textAlign: 'center' }}>Cuối kỳ</span>
                      <span style={{ textAlign: 'center' }}>TB môn</span>
                      <span style={{ textAlign: 'center' }}>Xếp loại</span>
                    </div>
                    {s.subjects.map(g => (
                      <div key={g.id} style={subjectRowStyle}>
                        <span style={{ fontWeight: 600, color: '#374151' }}>
                          {g.subject}
                          <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#9CA3AF' }}>{g.semester}</span>
                        </span>
                        <span style={{ textAlign: 'center', fontWeight: 500 }}>{g.midterm}</span>
                        <span style={{ textAlign: 'center', fontWeight: 500 }}>{g.final_score}</span>
                        <span style={{ textAlign: 'center', fontWeight: 700, color: getRankColor(g.rank) }}>{g.average}</span>
                        <span style={{ textAlign: 'center' }}>
                          <span className={`badge ${getRankBadge(g.rank)}`} style={{ fontSize: '0.72rem' }}>{g.rank}</span>
                        </span>
                      </div>
                    ))}
                    {s.subjects.length === 0 && (
                      <div style={{ padding: '16px 60px', color: '#9CA3AF', fontSize: '0.88rem' }}>Chưa có điểm</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
