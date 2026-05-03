import { useState } from 'react';
import type { ReactNode } from 'react';

interface TweakSwitchProps {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

export function TweakSwitch({ label, value, onChange }: TweakSwitchProps) {
  return (
    <label className="tweak-row">
      <span>{label}</span>
      <span
        role="switch"
        aria-checked={value}
        tabIndex={0}
        className={`tweak-switch ${value ? 'on' : ''}`}
        onClick={() => onChange(!value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onChange(!value);
          }
        }}
      />
    </label>
  );
}

interface RadioOption<T extends string> {
  value: T;
  label: string;
}
interface TweakRadioProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: RadioOption<T>[];
}

export function TweakRadio<T extends string>({ value, onChange, options }: TweakRadioProps<T>) {
  return (
    <div className="tweak-radios">
      {options.map((opt) => (
        <label key={opt.value} className="tweak-radio-row">
          <input type="radio" checked={value === opt.value} onChange={() => onChange(opt.value)} />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

export function TweaksPanel({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  if (!open) {
    return (
      <button className="tweaks-collapsed-btn" onClick={() => setOpen(true)}>
        ⚙ Tweaks
      </button>
    );
  }
  return (
    <div className="tweaks">
      <div className="tweaks-title">
        <span>{title}</span>
        <button
          onClick={() => setOpen(false)}
          aria-label="关闭"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
        >
          ×
        </button>
      </div>
      {children}
    </div>
  );
}

export function TweakSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="tweaks-section">
      <h4>{title}</h4>
      {children}
    </div>
  );
}
