import React from 'react';

const VARIANTS = {
  primary: { bg: 'var(--color-anthracite)', color: 'var(--color-offwhite)', border: 'var(--color-anthracite)' },
  secondary: { bg: 'var(--color-white)', color: 'var(--color-anthracite)', border: 'var(--color-border)' },
  ghost: { bg: 'transparent', color: 'var(--color-anthracite)', border: 'transparent' },
  danger: { bg: 'var(--color-white)', color: 'var(--color-danger)', border: 'var(--color-danger)' },
};
const SIZES = {
  sm: { padding: '6px 12px', fontSize: 'var(--text-xs)' },
  md: { padding: '9px 16px', fontSize: 'var(--text-sm)' },
};

export function Button({ variant = 'primary', size = 'md', disabled = false, icon = null, children, onClick, style, ...rest }) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const s = SIZES[size] || SIZES.md;
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        fontFamily: 'var(--font-sans)', fontWeight: 600,
        background: v.bg, color: v.color, border: `1px solid ${v.border}`,
        borderRadius: 'var(--radius-md)', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1, transition: 'opacity var(--duration-fast) var(--ease-standard), background var(--duration-fast) var(--ease-standard)',
        ...s, ...style,
      }}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
