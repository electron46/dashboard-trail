import React from 'react';

export function Switch({ checked = false, onChange, disabled = false, label }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-anthracite)', opacity: disabled ? 0.5 : 1 }}>
      <span
        onClick={() => !disabled && onChange && onChange(!checked)}
        style={{
          width: 36, height: 20, borderRadius: 'var(--radius-pill)', position: 'relative',
          background: checked ? 'var(--color-anthracite)' : 'var(--color-border)',
          transition: 'background var(--duration-base) var(--ease-standard)', flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 18 : 2, width: 16, height: 16, borderRadius: '50%',
          background: 'var(--color-white)', transition: 'left var(--duration-base) var(--ease-standard)',
        }} />
      </span>
      {label}
    </label>
  );
}
