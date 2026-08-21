import React from 'react';

export function Checkbox({ checked = false, onChange, disabled = false, label }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-anthracite)', opacity: disabled ? 0.5 : 1 }}>
      <span
        onClick={() => !disabled && onChange && onChange(!checked)}
        style={{
          width: 18, height: 18, borderRadius: 'var(--radius-sm)', border: `1px solid ${checked ? 'var(--color-anthracite)' : 'var(--color-border)'}`,
          background: checked ? 'var(--color-anthracite)' : 'var(--color-white)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >
        {checked && <span style={{ color: 'var(--color-offwhite)', fontSize: 12, lineHeight: 1 }}>✓</span>}
      </span>
      {label}
    </label>
  );
}
