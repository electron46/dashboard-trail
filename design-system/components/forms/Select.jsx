import React from 'react';

export function Select({ value, onChange, options = [], disabled = false, style }) {
  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      style={{
        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', padding: '8px 11px',
        border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
        background: 'var(--color-white)', color: 'var(--color-anthracite)', width: '100%',
        ...style,
      }}
    >
      {options.map((opt) => (
        <option key={opt.value ?? opt} value={opt.value ?? opt}>{opt.label ?? opt}</option>
      ))}
    </select>
  );
}
