// src/components/ui/PrettyCard.tsx
import React from 'react';
import { GREEN_TINT_40, BLUE_TINT_40 } from '../../theme/colors';

type Props = React.PropsWithChildren<{ className?: string }>;

export default function PrettyCard({ className = '', children }: Props) {
  return (
    <div
      className="p-[1px] rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.08)]"
      style={{
        background: `linear-gradient(180deg, ${GREEN_TINT_40}, ${BLUE_TINT_40})`,
      }}
    >
      <div className={`bg-white rounded-[1rem] p-4 sm:p-6 ${className}`}>
        {children}
      </div>
    </div>
  );
}
