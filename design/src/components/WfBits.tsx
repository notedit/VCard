import type { CSSProperties, ReactNode } from 'react';

export const Squiggle = ({ w = 60, h = 6, color = '#1a1a1a' }: { w?: number; h?: number; color?: string }) => (
  <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
    <path
      d={`M2 ${h - 2} Q ${w * 0.25} 1 ${w * 0.5} ${h - 2} T ${w - 2} ${h - 2}`}
      fill="none"
      stroke={color}
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
);

export const Underline = ({ w = 80, color = '#ff5a3c' }: { w?: number; color?: string }) => (
  <svg width={w} height="6" viewBox={`0 0 ${w} 6`} style={{ display: 'block', marginTop: -2 }}>
    <path
      d={`M2 4 C ${w * 0.3} 1, ${w * 0.6} 6, ${w - 2} 3`}
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </svg>
);

interface ArrowProps {
  from: [number, number];
  to: [number, number];
  label?: string;
  curve?: number;
  color?: string;
  dashed?: boolean;
}

export const Arrow = ({ from, to, label, curve = 0.3, color = '#1a1a1a', dashed = false }: ArrowProps) => {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const cx = mx - dy * curve;
  const cy = my + dx * curve;
  const ang = Math.atan2(y2 - cy, x2 - cx);
  const ah = 9;
  const a1x = x2 - ah * Math.cos(ang - Math.PI / 7);
  const a1y = y2 - ah * Math.sin(ang - Math.PI / 7);
  const a2x = x2 - ah * Math.cos(ang + Math.PI / 7);
  const a2y = y2 - ah * Math.sin(ang + Math.PI / 7);
  return (
    <g>
      <path
        d={`M${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray={dashed ? '5 4' : ''}
      />
      <path
        d={`M${x2} ${y2} L ${a1x} ${a1y} M ${x2} ${y2} L ${a2x} ${a2y}`}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {label && (
        <text
          x={cx}
          y={cy - 6}
          fontFamily='Kalam, "PingFang SC", "Hiragino Sans GB", sans-serif'
          fontSize="13"
          textAnchor="middle"
          fill={color}
        >
          {label}
        </text>
      )}
    </g>
  );
};

type StickyColor = 'y' | 'b' | 'g' | 'p';
export const Sticky = ({
  children,
  color = 'y',
  style,
}: {
  children: ReactNode;
  color?: StickyColor;
  style?: CSSProperties;
}) => (
  <div className={`sticky ${color === 'b' ? 'b' : color === 'g' ? 'g' : color === 'p' ? 'p' : ''}`} style={style}>
    {children}
  </div>
);

export const SectionLabel = ({ n, title, hint }: { n: string; title: string; hint?: string }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 6 }}>
    <div className="disp" style={{ fontSize: 38, lineHeight: 1 }}>
      <span style={{ color: 'var(--accent)' }}>{n}.</span> {title}
    </div>
    {hint && <div className="hand muted" style={{ fontSize: 14 }}>{hint}</div>}
  </div>
);

export const G = {
  plus: (
    <svg width="12" height="12" viewBox="0 0 12 12">
      <path d="M6 1.5V10.5 M1.5 6 H10.5" className="sk" />
    </svg>
  ),
  chev: (
    <svg width="10" height="10" viewBox="0 0 10 10">
      <path d="M2 3 L 5 7 L 8 3" className="sk" />
    </svg>
  ),
  spark: (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <path d="M7 1 L8 6 L13 7 L8 8 L7 13 L6 8 L1 7 L6 6 Z" className="sk" />
    </svg>
  ),
  bolt: (
    <svg width="12" height="14" viewBox="0 0 12 14">
      <path d="M7 1 L1 8 L5 8 L4 13 L11 5 L7 5 Z" className="sk" />
    </svg>
  ),
  img: (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <rect x="1.5" y="2" width="11" height="10" rx="1" className="sk" />
      <circle cx="5" cy="5.5" r="1" className="sk" />
      <path d="M2 10 L6 7 L9 9 L12 6" className="sk" />
    </svg>
  ),
  wand: (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <path d="M2 12 L9 5 M9 5 L11 3 M11 3 L11 1 M11 3 L13 3" className="sk" />
      <path d="M9 5 L11 7" className="sk" />
    </svg>
  ),
  refresh: (
    <svg width="13" height="13" viewBox="0 0 13 13">
      <path d="M11 6 A 4.5 4.5 0 1 0 9 10" className="sk" />
      <path d="M11 2 V6 H7" className="sk" />
    </svg>
  ),
  drag: (
    <svg width="10" height="14" viewBox="0 0 10 14">
      <circle cx="3" cy="3" r="1" fill="#1a1a1a" />
      <circle cx="7" cy="3" r="1" fill="#1a1a1a" />
      <circle cx="3" cy="7" r="1" fill="#1a1a1a" />
      <circle cx="7" cy="7" r="1" fill="#1a1a1a" />
      <circle cx="3" cy="11" r="1" fill="#1a1a1a" />
      <circle cx="7" cy="11" r="1" fill="#1a1a1a" />
    </svg>
  ),
  send: (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <path d="M2 7 L13 2 L9 13 L7 8 Z" className="sk" />
    </svg>
  ),
  attach: (
    <svg width="12" height="14" viewBox="0 0 12 14">
      <path
        d="M9 4 L4 9 A2 2 0 0 0 7 12 L11 8 A 3.5 3.5 0 0 0 6 3 L2 7 A 2.5 2.5 0 0 0 5.5 10.5"
        className="sk"
      />
    </svg>
  ),
  edit: (
    <svg width="13" height="13" viewBox="0 0 13 13">
      <path d="M2 11 L2 9 L9 2 L11 4 L4 11 Z" className="sk" />
    </svg>
  ),
  download: (
    <svg width="13" height="13" viewBox="0 0 13 13">
      <path d="M6.5 1 V9 M3 6 L 6.5 9 L 10 6 M2 11 H 11" className="sk" />
    </svg>
  ),
  brain: (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <path d="M4 3 A2.5 2.5 0 0 0 4 8 A2 2 0 0 0 4 12 H7 V2 A2.5 2.5 0 0 0 4 3 Z" className="sk" />
      <path d="M10 3 A2.5 2.5 0 0 1 10 8 A2 2 0 0 1 10 12 H7" className="sk" />
    </svg>
  ),
  layers: (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <path d="M7 1 L13 4 L7 7 L1 4 Z M2 7 L7 9.5 L12 7 M2 10 L7 12.5 L12 10" className="sk" />
    </svg>
  ),
  user: (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <circle cx="7" cy="5" r="2.5" className="sk" />
      <path d="M2 13 C 3 10 11 10 12 13" className="sk" />
    </svg>
  ),
};

type PlatformKind = 'redbook' | 'greenbook' | 'wechat' | 'douyin' | 'weibo';

const platformConfig: Record<PlatformKind, { bg: string; label: string; fontRatio: number }> = {
  redbook: { bg: '#ff5a3c', label: '书', fontRatio: 0.6 },
  greenbook: { bg: '#2dbe60', label: '绿', fontRatio: 0.6 },
  wechat: { bg: '#1aad19', label: 'WX', fontRatio: 0.55 },
  douyin: { bg: '#111', label: '抖', fontRatio: 0.6 },
  weibo: { bg: '#e6162d', label: '博', fontRatio: 0.6 },
};

export const Platform = ({ kind, size = 22 }: { kind: PlatformKind; size?: number }) => {
  const cfg = platformConfig[kind];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        background: cfg.bg,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-disp)',
        fontWeight: 700,
        fontSize: size * cfg.fontRatio,
        border: '1.4px solid var(--line)',
      }}
    >
      {cfg.label}
    </div>
  );
};

export const Ph = ({
  w,
  h,
  label,
  dark,
  style,
}: {
  w?: number | string;
  h?: number | string;
  label?: string;
  dark?: boolean;
  style?: CSSProperties;
}) => (
  <div
    className="placeholder stripe"
    style={{
      width: w,
      height: h,
      background: dark
        ? 'repeating-linear-gradient(45deg,#222 0 6px,#1a1a1a 6px 12px)'
        : 'repeating-linear-gradient(45deg,#fff 0 6px,#f0eee9 6px 12px)',
      color: dark ? '#bbb' : '#777',
      ...style,
    }}
  >
    {label}
  </div>
);
