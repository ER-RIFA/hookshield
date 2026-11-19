import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Globe,
  Zap,
  List,
  Shield,
  Activity,
  Radio,
  ExternalLink,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', Icon: LayoutDashboard, badge: 'Live' },
  { to: '/endpoints', label: 'Endpoints', Icon: Globe },
  { to: '/events', label: 'Events Hub', Icon: Zap },
  { to: '/deliveries', label: 'Delivery Queue', Icon: List },
  { to: '/receiver', label: 'Receiver Simulator', Icon: Radio, badge: 'Demo' },
];

export function Sidebar() {
  return (
    <nav className="sidebar">
      {/* Brand Logo */}
      <div className="logo">
        <div className="logo-icon-box">
          <Shield size={24} color="#ffffff" style={{ filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.6))' }} />
        </div>
        <div>
          <div className="logo-title">HookShield</div>
          <div className="logo-badge">Reliability Engine</div>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="nav-section-label">Management</div>
      {NAV_ITEMS.map(({ to, label, Icon, badge }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Icon size={18} className="nav-icon" />
          <span style={{ flex: 1 }}>{label}</span>
          {badge && (
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: 6,
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.4)'
            }}>
              {badge}
            </span>
          )}
        </NavLink>
      ))}

      {/* Receiver Demo Quick Link Card */}
      <div style={{ marginTop: 'auto', marginBottom: 12 }}>
        <a
          href="http://localhost:4000/health"
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'rgba(6, 182, 212, 0.08)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            textDecoration: 'none',
            color: '#38bdf8',
            fontSize: '0.8rem',
            fontWeight: 600,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(6, 182, 212, 0.16)';
            e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(6, 182, 212, 0.08)';
            e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.25)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Radio size={14} className="animate-pulse" />
            <span>Receiver Demo</span>
          </div>
          <ExternalLink size={12} />
        </a>
      </div>

      {/* Live System Status Pill */}
      <div className="sidebar-status-box">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            System Pulse
          </span>
          <div className="pulse-radar-dot" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Activity size={14} style={{ color: '#10b981' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ffffff' }}>
            Worker Engine Online
          </span>
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
          Atomic Polling: 5,000ms
        </div>
      </div>
    </nav>
  );
}
