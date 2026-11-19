import type { DeliveryStatus } from '../types';

interface StatusBadgeProps {
  status: DeliveryStatus | 'enabled' | 'disabled';
  size?: 'sm' | 'md';
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  success:   { label: 'Success',   cls: 'badge-success' },
  failed:    { label: 'Failed',    cls: 'badge-failed' },
  pending:   { label: 'Pending',   cls: 'badge-pending' },
  retrying:  { label: 'Retrying',  cls: 'badge-retrying' },
  delivering:{ label: 'Sending',   cls: 'badge-delivering' },
  enabled:   { label: 'Enabled',   cls: 'badge-success' },
  disabled:  { label: 'Disabled',  cls: 'badge-failed' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? { label: status, cls: 'badge-pending' };
  return (
    <span className={`badge ${config.cls}`}>
      <span className="badge-dot" />
      {config.label}
    </span>
  );
}
