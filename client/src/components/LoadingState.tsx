import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  rows?: number;
  cols?: number;
  text?: string;
}

export function LoadingState({ rows = 5, cols = 4, text }: LoadingStateProps) {
  if (text) {
    return (
      <div style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <Loader2 size={28} className="animate-spin" style={{ color: '#818cf8' }} />
        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
          {text}
        </span>
      </div>
    );
  }

  return (
    <div style={{ padding: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 16,
            padding: '16px 18px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              style={{
                height: 18,
                borderRadius: 6,
                background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
                backgroundSize: '200% 100%',
                animation: 'skeleton-shimmer 1.8s infinite',
                width: j === 0 ? '60%' : j === cols - 1 ? '40%' : '80%',
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{
        height: 20, width: '40%', marginBottom: 16, borderRadius: 6,
        background: 'rgba(255,255,255,0.06)'
      }} />
      <div style={{
        height: 14, width: '80%', marginBottom: 8, borderRadius: 6,
        background: 'rgba(255,255,255,0.04)'
      }} />
      <div style={{
        height: 14, width: '60%', borderRadius: 6,
        background: 'rgba(255,255,255,0.04)'
      }} />
    </div>
  );
}
