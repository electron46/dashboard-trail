import React from 'react';

export function EmptyState({ title = 'Aucune donnée', hint, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '28px 16px', fontFamily: 'var(--font-sans)' }}>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>{title}</div>
      {hint && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted-2)', marginTop: 4 }}>{hint}</div>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}
