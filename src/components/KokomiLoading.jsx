export default function KokomiLoading({ text = 'Đang tải dữ liệu...' }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
      gap: 16,
    }}>
      <img
        src="https://media1.tenor.com/m/367_2oY3VaYAAAAC/kokomi-loading.gif"
        alt="Loading..."
        style={{
          width: 120,
          height: 'auto',
          borderRadius: 16,
        }}
      />
      <p style={{
        color: '#6B7280',
        fontSize: '0.92rem',
        fontWeight: 500,
        margin: 0,
        animation: 'pulse 1.5s ease-in-out infinite',
      }}>
        {text}
      </p>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
