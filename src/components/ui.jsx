import React, { useEffect, useState } from 'react';

const cx = (...a) => a.filter(Boolean).join(' ');

export function Button({ variant = 'primary', size = 'md', className, ...props }) {
  const variants = {
    primary: 'bg-olive-600 text-white hover:bg-olive-700 disabled:bg-olive-300',
    secondary: 'bg-white text-stone-700 border border-stone-300 hover:bg-stone-50 disabled:text-stone-400',
    ghost: 'text-stone-600 hover:bg-stone-100',
    danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
    clay: 'bg-clay-500 text-white hover:bg-clay-600 disabled:bg-clay-200',
  };
  const sizes = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-3.5 py-2 text-sm', lg: 'px-5 py-3 text-base' };
  return (
    <button
      type="button"
      className={cx('inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors', variants[variant], sizes[size], className)}
      {...props}
    />
  );
}

const fieldBase =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-olive-500 focus:outline-none focus:ring-2 focus:ring-olive-200';

export function Input({ className, ...props }) {
  return <input className={cx(fieldBase, className)} {...props} />;
}

export function Textarea({ className, ...props }) {
  return <textarea className={cx(fieldBase, className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cx(fieldBase, 'pr-8', className)} {...props}>
      {children}
    </select>
  );
}

export function Field({ label, hint, children, className }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-xs font-medium text-stone-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <div className={cx('rounded-2xl border border-stone-200 bg-white p-5 shadow-sm', className)} {...props}>
      {children}
    </div>
  );
}

export function Stat({ label, value, sub, tone }) {
  const tones = { good: 'text-olive-700', bad: 'text-red-600', clay: 'text-clay-600' };
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</div>
      <div className={cx('mt-1 text-2xl font-semibold tabular-nums', tones[tone] || 'text-stone-900')}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-stone-500">{sub}</div>}
    </Card>
  );
}

export function Badge({ tone = 'stone', children }) {
  const tones = {
    stone: 'bg-stone-100 text-stone-600',
    green: 'bg-olive-100 text-olive-800',
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
    clay: 'bg-clay-100 text-clay-700',
  };
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', tones[tone])}>{children}</span>;
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        className={cx('flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3.5">
          <h3 className="text-base font-semibold text-stone-900">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label="Închide">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-stone-200 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2.5 text-sm text-stone-700">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-olive-600' : 'bg-stone-300')}
      >
        <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </button>
      {label}
    </label>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-semibold text-stone-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-12 text-center">
      <div className="font-display text-xl text-stone-800">{title}</div>
      <div className="mx-auto mt-1 max-w-md text-sm text-stone-500">{children}</div>
    </div>
  );
}

// Camp care tine textul local cat timp scrii si salveaza cand iesi din el.
export function Cell({ value, onCommit, type = 'text', className, ...props }) {
  const [text, setText] = useState(value ?? '');
  useEffect(() => setText(value ?? ''), [value]);
  const commit = () => {
    const v = type === 'number' ? (text === '' ? 0 : Number(String(text).replace(',', '.')) || 0) : text;
    if (v !== (value ?? '')) onCommit(v);
  };
  return (
    <input
      type={type === 'number' ? 'text' : type}
      inputMode={type === 'number' ? 'decimal' : undefined}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className={cx(
        'w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm hover:border-stone-200 focus:border-olive-500 focus:bg-white focus:outline-none',
        type === 'number' && 'text-right tabular-nums',
        className,
      )}
      {...props}
    />
  );
}


export { cx };

// Tot ce e in interior devine needitabil (campuri, liste, butoane) pentru conturile doar de vizualizare.
export function Editable({ canEdit, className, children }) {
  return (
    <fieldset disabled={!canEdit} className={cx('m-0 min-w-0 border-0 p-0', className)}>
      {children}
    </fieldset>
  );
}
