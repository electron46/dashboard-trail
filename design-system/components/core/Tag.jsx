import React from 'react';

export function Tag({ children, onRemove }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500,
        background: 'var(--color-offwhite)', border: '1px solid var(--color-border)',
        color: 'var(--color-anthracite)', borderRadius: 'var(--radius-pill)', padding: '4px 10px 4px 12px',
      }}
    >
      {children}
      {onRemove && (
        <button onClick={onRemove} aria-label="Retirer" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-muted)', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
      )}
    </span>
  );
}
