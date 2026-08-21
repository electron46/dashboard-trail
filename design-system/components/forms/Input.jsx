import React from 'react';

export function Input({ type = 'text', value, onChange, placeholder, disabled = false, mono = false, style }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)', fontSize: 'var(--text-sm)',
        padding: '8px 11px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
        background: disabled ? 'var(--color-offwhite)' : 'var(--color-white)', color: 'var(--color-anthracite)',
        width: '100%', outline: 'none', transition: 'border-color var(--duration-fast) var(--ease-standard)',
        ...style,
      }}
      onFocus={(e) => { e.target.style.borderColor = 'var(--color-anthracite)'; }}
      onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; }}
    />
  );
}
