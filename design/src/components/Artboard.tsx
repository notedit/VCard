import type { ReactNode } from 'react';

export function Artboard({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="artboard-wrap" id={id}>
      <div className="artboard-label">{label}</div>
      <div className="artboard">
        <div className="artboard-scroller">{children}</div>
      </div>
    </div>
  );
}
