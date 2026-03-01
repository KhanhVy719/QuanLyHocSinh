import { useState, useEffect } from 'react';
import { Users, TrendingUp, Award, CheckCircle, Trophy, Medal } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, Title, Tooltip, Legend,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const barOpts = {
  responsive: true, maintainAspectRatio: false,
  animation: {
    duration: 1000,
    easing: 'easeOutCubic',
    delay: (ctx) => {
      if (ctx.type !== 'data') return 0;
      return ctx.index * 200 + ctx.datasetIndex * 80;
    },
  },
  plugins: {
    legend: {
      position: 'top', align: 'center',
      labels: {
        usePointStyle: true, pointStyle: 'rectRounded',
        padding: 18,
        font: { family: 'Inter', size: 11, weight: 600 },
      },
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      backgroundColor: '#1F2937',
      padding: 14,
      cornerRadius: 10,
      titleFont: { family: 'Inter', size: 14, weight: 700 },
      titleColor: '#F9FAFB',
      bodyFont: { family: 'Inter', size: 12, weight: 500 },
      bodyColor: '#D1D5DB',
      bodySpacing: 6,
      usePointStyle: true,
      boxPadding: 6,
      callbacks: {
        title: (items) => `📚 ${items[0].label}`,
        label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw} học sinh`,
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { family: 'Inter', size: 13, weight: 700 }, color: '#374151' },
    },
    y: {
      grid: { color: '#F3F4F6', drawBorder: false },
      ticks: { font: { family: 'Inter', size: 11 }, color: '#9CA3AF', stepSize: 1 },
      beginAtZero: true,
      title: { display: true, text: 'Số học sinh', font: { family: 'Inter', size: 12, weight: 600 }, color: '#9CA3AF' },
    },
  },
};

const pieOpts = {
  responsive: true, maintainAspectRatio: false,
  animation: { animateRotate: true, animateScale: true, duration: 1500, easing: 'easeOutQuart' },
  plugins: {
    legend: { position: 'right', labels: { usePointStyle: true, padding: 14, font: { family: 'Inter', size: 12 } } },
    tooltip: { backgroundColor: '#1F2937', padding: 12, cornerRadius: 8 },
  },
};

const rankColors = ['#F59E0B', '#94A3B8', '#CD7F32'];
const rankIcons = [Trophy, Medal, Medal];

export default function StatisticsReport() {
  const [data, setData] = useState({ total: 0, avg: '0', gioi: 0, datChuan: '0%', dist: {} });
  const [grades, setGrades] = useState([]);

  useEffect(() => {
    async function init() {
      const [studentsRes, gradesRes] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }),
        supabase.from('grades').select('*'),
      ]);
      const gr = gradesRes.data || [];
      setGrades(gr);
      const total = studentsRes.count || 0;
      const avg = gr.length > 0 ? (gr.reduce((s, g) => s + Number(g.average), 0) / gr.length).toFixed(1) : '0';
      const xuatSac = gr.filter(g => g.rank === 'Xuất sắc').length;
      const gioi = gr.filter(g => g.rank === 'Giỏi').length;
      const kha = gr.filter(g => g.rank === 'Khá').length;
      const tb = gr.filter(g => g.rank === 'Trung bình').length;
      const yeu = gr.filter(g => g.rank === 'Yếu').length;
      const passed = xuatSac + gioi + kha + tb;
      const datChuan = gr.length > 0 ? ((passed / gr.length) * 100).toFixed(1) + '%' : '0%';
      setData({ total, avg, gioi: xuatSac + gioi, datChuan, dist: { xuatSac, gioi, kha, tb, yeu } });
    }
    init();
  }, []);

  // Bar chart: Rank count per subject (grouped)
  const subjectRankMap = {};
  const ranks = ['Xuất sắc', 'Giỏi', 'Khá', 'Trung bình', 'Yếu'];
  const rankBarColors = {
    'Xuất sắc': '#8B5CF6',
    'Giỏi': '#10B981',
    'Khá': '#3B82F6',
    'Trung bình': '#F59E0B',
    'Yếu': '#EF4444',
  };
  grades.forEach(g => {
    if (!subjectRankMap[g.subject]) {
      subjectRankMap[g.subject] = {};
      ranks.forEach(r => { subjectRankMap[g.subject][r] = 0; });
    }
    if (subjectRankMap[g.subject][g.rank] !== undefined) {
      subjectRankMap[g.subject][g.rank] += 1;
    }
  });
  const subjects = Object.keys(subjectRankMap);

  const barData = {
    labels: subjects,
    datasets: ranks.map(rank => ({
      label: rank,
      data: subjects.map(s => subjectRankMap[s][rank]),
      backgroundColor: rankBarColors[rank],
      borderRadius: 4,
      borderSkipped: false,
      categoryPercentage: 0.8,
      barPercentage: 0.9,
    })),
  };

  // Class ranking
  const classMap = {};
  grades.forEach(g => {
    if (!classMap[g.class]) classMap[g.class] = { sum: 0, count: 0, gioi: 0, kha: 0, total: new Set() };
    classMap[g.class].sum += Number(g.average);
    classMap[g.class].count += 1;
    classMap[g.class].total.add(g.student_id);
    if (g.rank === 'Giỏi' || g.rank === 'Xuất sắc') classMap[g.class].gioi += 1;
    if (g.rank === 'Khá') classMap[g.class].kha += 1;
  });
  const classRanking = Object.entries(classMap)
    .map(([name, d]) => ({
      name,
      avg: (d.sum / d.count).toFixed(1),
      students: d.total.size,
      gioi: d.gioi,
      kha: d.kha,
    }))
    .sort((a, b) => b.avg - a.avg);

  const pieData = {
    labels: [`Giỏi: ${data.dist.gioi || 0}`, `Khá: ${data.dist.kha || 0}`, `TB: ${data.dist.tb || 0}`, `Xuất sắc: ${data.dist.xuatSac || 0}`, `Yếu: ${data.dist.yeu || 0}`],
    datasets: [{ data: [data.dist.gioi || 0, data.dist.kha || 0, data.dist.tb || 0, data.dist.xuatSac || 0, data.dist.yeu || 0], backgroundColor: ['#EF4444', '#F59E0B', '#10B981', '#8B5CF6', '#3B82F6'], borderWidth: 2, borderColor: '#fff' }],
  };

  const statCards = [
    { label: 'Tổng học sinh', value: data.total, trend: '↑ 14.3% so với năm trước', icon: Users, color: 'blue' },
    { label: 'Điểm TB toàn trường', value: data.avg, trend: '↑ 0.3 điểm', icon: TrendingUp, color: 'green' },
    { label: 'Học sinh giỏi', value: data.gioi, trend: `${data.total > 0 ? ((data.gioi / data.total) * 100).toFixed(1) : 0}% tổng số`, icon: Award, color: 'purple' },
    { label: 'Tỷ lệ đạt chuẩn', value: data.datChuan, trend: '↑ 2.1%', icon: CheckCircle, color: 'orange' },
  ];

  return (
    <div>
      <div className="page-header"><h2>Báo cáo thống kê</h2><p>Thống kê và phân tích dữ liệu toàn trường</p></div>

      {/* Stat cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {statCards.map((s, i) => {
          const Icon = s.icon;
          return (
            <div className="stat-card" key={i}>
              <div className="stat-info"><label>{s.label}</label><div className="stat-value">{s.value}</div><div className="stat-trend up">{s.trend}</div></div>
              <div className={`stat-icon ${s.color}`}><Icon size={24} /></div>
            </div>
          );
        })}
      </div>

      {/* Charts row: Bar + Pie */}
      <div className="charts-grid">
        <div className="chart-card">
          <h3>📊 Kết quả học tập theo môn học</h3>
          <div className="chart-wrapper"><Bar data={barData} options={barOpts} /></div>
        </div>
        <div className="chart-card">
          <h3>📈 Phân loại học lực</h3>
          <div className="chart-wrapper"><Pie data={pieData} options={pieOpts} /></div>
        </div>
      </div>

      {/* Class ranking */}
      <div style={{ marginTop: 24 }}>
        <div className="chart-card" style={{ overflow: 'hidden' }}>
          <h3 style={{ marginBottom: 20 }}>🏆 Xếp hạng thành tích theo lớp</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {classRanking.map((c, i) => {
              const RankIcon = rankIcons[i] || Medal;
              const isTop3 = i < 3;
              const barWidthPercent = (parseFloat(c.avg) / 10) * 100;
              return (
                <div key={c.name} style={{
                  display: 'grid', gridTemplateColumns: '50px 80px 1fr 120px',
                  alignItems: 'center', padding: '16px 20px', gap: 16,
                  borderBottom: i < classRanking.length - 1 ? '1px solid #F3F4F6' : 'none',
                  background: i === 0 ? '#FFFBEB' : i === 1 ? '#F8FAFC' : i === 2 ? '#FFF7ED' : '#fff',
                  transition: 'background 0.2s',
                }}>
                  {/* Rank number */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isTop3 ? (
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: rankColors[i] + '20', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <RankIcon size={18} style={{ color: rankColors[i] }} />
                      </div>
                    ) : (
                      <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#9CA3AF' }}>#{i + 1}</span>
                    )}
                  </div>

                  {/* Class name */}
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1F2937' }}>{c.name}</span>

                  {/* Progress bar + avg */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, height: 10, background: '#F3F4F6', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{
                        width: `${barWidthPercent}%`, height: '100%',
                        background: i === 0 ? 'linear-gradient(90deg, #F59E0B, #FBBF24)' :
                          i === 1 ? 'linear-gradient(90deg, #6366F1, #818CF8)' :
                            i === 2 ? 'linear-gradient(90deg, #F97316, #FB923C)' : 'linear-gradient(90deg, #6B7280, #9CA3AF)',
                        borderRadius: 5, transition: 'width 1.5s ease-out',
                      }} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#374151', minWidth: 40 }}>{c.avg}</span>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', gap: 8, fontSize: '0.78rem' }}>
                    <span style={{ padding: '3px 8px', borderRadius: 6, background: '#DCFCE7', color: '#166534', fontWeight: 600 }}>
                      {c.gioi} giỏi
                    </span>
                    <span style={{ padding: '3px 8px', borderRadius: 6, background: '#DBEAFE', color: '#1E40AF', fontWeight: 600 }}>
                      {c.kha} khá
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
