import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string;
  color: string;
  Icon: LucideIcon;
  subtitle?: string;
}

export function StatCard({ label, value, color, Icon, subtitle }: StatCardProps) {
  return (
    <div
      className="stat-card"
      style={{ '--stat-color': color } as React.CSSProperties}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="stat-label">{label}</div>
        <div style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: `${color}18`,
          border: `1px solid ${color}40`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 12px ${color}30`,
        }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>

      <div className="stat-value" style={{ color: '#ffffff' }}>
        {value}
      </div>

      {subtitle && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
          {subtitle}
        </div>
      )}

      {/* Decorative large faint background icon */}
      <div className="stat-icon">
        <Icon size={64} style={{ color }} />
      </div>
    </div>
  );
}
