/* @ds-bundle: {"format":4,"namespace":"ELEVDesignSystem_bbdc25","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"DataValue","sourcePath":"components/data/DataValue.jsx"},{"name":"MetricCard","sourcePath":"components/data/MetricCard.jsx"},{"name":"Table","sourcePath":"components/data/Table.jsx"},{"name":"Banner","sourcePath":"components/feedback/Banner.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"EmptyState","sourcePath":"components/feedback/EmptyState.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"628a0b740760","components/core/Button.jsx":"b41ef1007d76","components/core/Card.jsx":"f045d92a4780","components/core/IconButton.jsx":"68961d271123","components/core/Tag.jsx":"437bc4ab3451","components/data/DataValue.jsx":"d159d6c89611","components/data/MetricCard.jsx":"fb73072a45ee","components/data/Table.jsx":"db5bed7edf44","components/feedback/Banner.jsx":"d8365f7c0d34","components/feedback/Dialog.jsx":"7f89c289daf6","components/feedback/EmptyState.jsx":"1f4540f300f7","components/forms/Checkbox.jsx":"7e95753fd710","components/forms/Input.jsx":"3196d31c3a87","components/forms/Select.jsx":"03c03723d233","components/forms/Switch.jsx":"9b17edd06ea3","components/navigation/Tabs.jsx":"1b738d895359","ui_kits/dashboard/data.jsx":"65e5af557fc0"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.ELEVDesignSystem_bbdc25 = window.ELEVDesignSystem_bbdc25 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
const TONES = {
  principal: {
    bg: 'var(--color-anthracite)',
    color: 'var(--color-offwhite)',
    border: 'var(--color-anthracite)'
  },
  secondaire: {
    bg: 'var(--color-offwhite)',
    color: 'var(--color-anthracite)',
    border: 'var(--color-border)'
  },
  success: {
    bg: 'var(--color-success-soft)',
    color: 'var(--color-success)',
    border: 'var(--color-success)'
  },
  danger: {
    bg: 'var(--color-danger-soft)',
    color: 'var(--color-danger)',
    border: 'var(--color-danger)'
  },
  neutral: {
    bg: 'var(--color-white)',
    color: 'var(--color-muted)',
    border: 'var(--color-border)'
  }
};
function Badge({
  tone = 'neutral',
  children
}) {
  const t = TONES[tone] || TONES.neutral;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-block',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)',
      background: t.bg,
      color: t.color,
      border: `1px solid ${t.border}`,
      borderRadius: 'var(--radius-pill)',
      padding: '3px 10px',
      fontWeight: 500
    }
  }, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const VARIANTS = {
  primary: {
    bg: 'var(--color-anthracite)',
    color: 'var(--color-offwhite)',
    border: 'var(--color-anthracite)'
  },
  secondary: {
    bg: 'var(--color-white)',
    color: 'var(--color-anthracite)',
    border: 'var(--color-border)'
  },
  ghost: {
    bg: 'transparent',
    color: 'var(--color-anthracite)',
    border: 'transparent'
  },
  danger: {
    bg: 'var(--color-white)',
    color: 'var(--color-danger)',
    border: 'var(--color-danger)'
  }
};
const SIZES = {
  sm: {
    padding: '6px 12px',
    fontSize: 'var(--text-xs)'
  },
  md: {
    padding: '9px 16px',
    fontSize: 'var(--text-sm)'
  }
};
function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  icon = null,
  children,
  onClick,
  style,
  ...rest
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const s = SIZES[size] || SIZES.md;
  return /*#__PURE__*/React.createElement("button", _extends({
    onClick: disabled ? undefined : onClick,
    disabled: disabled,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      fontFamily: 'var(--font-sans)',
      fontWeight: 600,
      background: v.bg,
      color: v.color,
      border: `1px solid ${v.border}`,
      borderRadius: 'var(--radius-md)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      transition: 'opacity var(--duration-fast) var(--ease-standard), background var(--duration-fast) var(--ease-standard)',
      ...s,
      ...style
    }
  }, rest), icon, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function Card({
  children,
  style,
  padding = 'var(--space-5)'
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)',
      padding,
      fontFamily: 'var(--font-sans)',
      color: 'var(--text-primary)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function IconButton({
  children,
  active = false,
  onClick,
  'aria-label': ariaLabel,
  style
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    "aria-label": ariaLabel,
    style: {
      width: 34,
      height: 34,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 'var(--radius-md)',
      cursor: 'pointer',
      background: active ? 'var(--color-anthracite)' : 'transparent',
      color: active ? 'var(--color-offwhite)' : 'var(--color-anthracite)',
      border: `1px solid ${active ? 'var(--color-anthracite)' : 'var(--color-border)'}`,
      transition: 'background var(--duration-fast) var(--ease-standard)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function Tag({
  children,
  onRemove
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-xs)',
      fontWeight: 500,
      background: 'var(--color-offwhite)',
      border: '1px solid var(--color-border)',
      color: 'var(--color-anthracite)',
      borderRadius: 'var(--radius-pill)',
      padding: '4px 10px 4px 12px'
    }
  }, children, onRemove && /*#__PURE__*/React.createElement("button", {
    onClick: onRemove,
    "aria-label": "Retirer",
    style: {
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      color: 'var(--color-muted)',
      fontSize: 13,
      lineHeight: 1,
      padding: 0
    }
  }, "\xD7"));
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/data/DataValue.jsx
try { (() => {
function DataValue({
  children,
  size = 'md',
  emphasis = false
}) {
  const sizes = {
    sm: 13,
    md: 16,
    lg: 22
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: sizes[size] || sizes.md,
      fontWeight: emphasis ? 600 : 400,
      color: 'var(--color-anthracite)'
    }
  }, children);
}
Object.assign(__ds_scope, { DataValue });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/DataValue.jsx", error: String((e && e.message) || e) }); }

// components/data/MetricCard.jsx
try { (() => {
function MetricCard({
  label,
  value,
  unit = '',
  hint,
  na = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      padding: '10px 12px',
      background: 'var(--color-white)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)',
      color: 'var(--color-muted)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: na ? 'var(--font-sans)' : 'var(--font-mono)',
      fontSize: na ? 14 : 20,
      fontWeight: na ? 400 : 500,
      color: na ? 'var(--color-muted)' : 'var(--color-anthracite)',
      marginTop: 4
    }
  }, na ? 'Non disponible' : /*#__PURE__*/React.createElement(React.Fragment, null, value, unit)), hint && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--color-muted)',
      marginTop: 2
    }
  }, hint));
}
Object.assign(__ds_scope, { MetricCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/MetricCard.jsx", error: String((e && e.message) || e) }); }

// components/data/Table.jsx
try { (() => {
function Table({
  columns = [],
  rows = [],
  onRowClick
}) {
  return /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    style: {
      textAlign: 'left',
      padding: '8px 10px',
      borderBottom: '1px solid var(--color-border)',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)',
      color: 'var(--color-muted)',
      fontWeight: 500
    }
  }, c.label)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((row, i) => /*#__PURE__*/React.createElement("tr", {
    key: i,
    onClick: () => onRowClick && onRowClick(row),
    style: {
      cursor: onRowClick ? 'pointer' : 'default'
    },
    onMouseEnter: e => {
      if (onRowClick) e.currentTarget.style.background = 'var(--color-offwhite)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.background = 'transparent';
    }
  }, columns.map(c => /*#__PURE__*/React.createElement("td", {
    key: c.key,
    style: {
      padding: '8px 10px',
      borderBottom: '1px solid var(--color-border)',
      fontFamily: c.mono ? 'var(--font-mono)' : 'var(--font-sans)',
      color: 'var(--color-anthracite)'
    }
  }, c.render ? c.render(row) : row[c.key]))))));
}
Object.assign(__ds_scope, { Table });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Table.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Banner.jsx
try { (() => {
const TONES = {
  ok: {
    bg: 'var(--color-success-soft)',
    color: 'var(--color-success)'
  },
  err: {
    bg: 'var(--color-danger-soft)',
    color: 'var(--color-danger)'
  },
  info: {
    bg: 'var(--color-offwhite)',
    color: 'var(--color-anthracite)'
  }
};
function Banner({
  tone = 'info',
  children
}) {
  const t = TONES[tone] || TONES.info;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      background: t.bg,
      color: t.color,
      borderRadius: 'var(--radius-md)',
      padding: '9px 12px'
    }
  }, children);
}
Object.assign(__ds_scope, { Banner });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Banner.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
function Dialog({
  open,
  title,
  onClose,
  children
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(43,43,43,.35)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      background: 'var(--color-white)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-md)',
      padding: 'var(--space-6)',
      width: 420,
      maxWidth: '90vw',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-lg)',
      fontWeight: 600,
      color: 'var(--color-anthracite)'
    }
  }, title), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Fermer",
    style: {
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      fontSize: 16,
      color: 'var(--color-muted)'
    }
  }, "✕")), children));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/EmptyState.jsx
try { (() => {
function EmptyState({
  title = 'Aucune donnée',
  hint,
  action
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '28px 16px',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--color-muted)'
    }
  }, title), hint && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-muted-2)',
      marginTop: 4
    }
  }, hint), action && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, action));
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function Checkbox({
  checked = false,
  onChange,
  disabled = false,
  label
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      color: 'var(--color-anthracite)',
      opacity: disabled ? 0.5 : 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => !disabled && onChange && onChange(!checked),
    style: {
      width: 18,
      height: 18,
      borderRadius: 'var(--radius-sm)',
      border: `1px solid ${checked ? 'var(--color-anthracite)' : 'var(--color-border)'}`,
      background: checked ? 'var(--color-anthracite)' : 'var(--color-white)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, checked && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-offwhite)',
      fontSize: 12,
      lineHeight: 1
    }
  }, "✓")), label);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function Input({
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled = false,
  mono = false,
  style
}) {
  return /*#__PURE__*/React.createElement("input", {
    type: type,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    disabled: disabled,
    style: {
      fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      padding: '8px 11px',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      background: disabled ? 'var(--color-offwhite)' : 'var(--color-white)',
      color: 'var(--color-anthracite)',
      width: '100%',
      outline: 'none',
      transition: 'border-color var(--duration-fast) var(--ease-standard)',
      ...style
    },
    onFocus: e => {
      e.target.style.borderColor = 'var(--color-anthracite)';
    },
    onBlur: e => {
      e.target.style.borderColor = 'var(--color-border)';
    }
  });
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function Select({
  value,
  onChange,
  options = [],
  disabled = false,
  style
}) {
  return /*#__PURE__*/React.createElement("select", {
    value: value,
    onChange: onChange,
    disabled: disabled,
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      padding: '8px 11px',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      background: 'var(--color-white)',
      color: 'var(--color-anthracite)',
      width: '100%',
      ...style
    }
  }, options.map(opt => /*#__PURE__*/React.createElement("option", {
    key: opt.value ?? opt,
    value: opt.value ?? opt
  }, opt.label ?? opt)));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function Switch({
  checked = false,
  onChange,
  disabled = false,
  label
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      color: 'var(--color-anthracite)',
      opacity: disabled ? 0.5 : 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => !disabled && onChange && onChange(!checked),
    style: {
      width: 36,
      height: 20,
      borderRadius: 'var(--radius-pill)',
      position: 'relative',
      background: checked ? 'var(--color-anthracite)' : 'var(--color-border)',
      transition: 'background var(--duration-base) var(--ease-standard)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 2,
      left: checked ? 18 : 2,
      width: 16,
      height: 16,
      borderRadius: '50%',
      background: 'var(--color-white)',
      transition: 'left var(--duration-base) var(--ease-standard)'
    }
  })), label);
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function Tabs({
  items = [],
  active,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      flexWrap: 'wrap'
    }
  }, items.map(item => {
    const isActive = item.value === active;
    return /*#__PURE__*/React.createElement("button", {
      key: item.value,
      onClick: () => onChange && onChange(item.value),
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        padding: '9px 16px',
        borderRadius: 'var(--radius-pill)',
        cursor: 'pointer',
        border: `1px solid ${isActive ? 'var(--color-anthracite)' : 'var(--color-border)'}`,
        background: isActive ? 'var(--color-anthracite)' : 'transparent',
        color: isActive ? 'var(--color-offwhite)' : 'var(--color-anthracite)',
        transition: 'all var(--duration-fast) var(--ease-standard)'
      }
    }, item.label);
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/data.jsx
try { (() => {
const RACES = [{
  name: 'Trail des Cascades',
  date: '2026-09-12',
  distanceKm: 31,
  denivele: 1700,
  statut: 'secondaire'
}, {
  name: 'Mafate Trail Tour',
  date: '2026-11-28',
  distanceKm: 55,
  denivele: 3500,
  statut: 'principal'
}];
const SESSIONS = [{
  id: 1,
  date: '2026-08-09',
  sport: 'Trail',
  distance: '18,6 km',
  dplus: '740 m',
  duree: '1h58',
  allure: "6'22/km",
  fc: '148 bpm'
}, {
  id: 2,
  date: '2026-08-06',
  sport: 'Course à pied',
  distance: '10,0 km',
  dplus: '60 m',
  duree: '48min12',
  allure: "4'49/km",
  fc: '156 bpm'
}, {
  id: 3,
  date: '2026-08-03',
  sport: 'Trail',
  distance: '24,1 km',
  dplus: '1120 m',
  duree: '2h51',
  allure: "7'06/km",
  fc: '142 bpm'
}, {
  id: 4,
  date: '2026-07-30',
  sport: 'Course à pied',
  distance: '14,0 km',
  dplus: '90 m',
  duree: '1h05',
  allure: "4'38/km",
  fc: '151 bpm'
}];
function fmtDate(iso) {
  const [y, m, d] = iso.split('-');
  return d + '/' + m + '/' + y;
}
function RaceChip({
  race
}) {
  const isPrincipal = race.statut === 'principal';
  const days = Math.ceil((new Date(race.date) - new Date('2026-08-11')) / 86400000);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 220px',
      borderRadius: 'var(--radius-md)',
      padding: 14,
      border: `1px solid ${isPrincipal ? 'var(--color-anthracite)' : 'var(--color-border)'}`,
      background: isPrincipal ? 'var(--color-anthracite)' : 'var(--color-white)',
      color: isPrincipal ? 'var(--color-offwhite)' : 'var(--color-anthracite)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)',
      color: isPrincipal ? 'var(--color-muted-2)' : 'var(--color-muted)'
    }
  }, "Objectif ", race.statut), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      margin: '4px 0 2px'
    }
  }, race.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: isPrincipal ? 'var(--color-muted-2)' : 'var(--color-muted)'
    }
  }, fmtDate(race.date), " — ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)'
    }
  }, race.distanceKm, " km / ", race.denivele, " m D+")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 18,
      fontWeight: 600,
      marginTop: 8
    }
  }, "J-", days));
}
Object.assign(window, {
  RACES,
  SESSIONS,
  RaceChip
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/data.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.DataValue = __ds_scope.DataValue;

__ds_ns.MetricCard = __ds_scope.MetricCard;

__ds_ns.Table = __ds_scope.Table;

__ds_ns.Banner = __ds_scope.Banner;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Tabs = __ds_scope.Tabs;

})();
