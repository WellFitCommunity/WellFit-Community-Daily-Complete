// src/components/PageLayout.tsx
<<<<<<< HEAD:src/components/PageLayout.tsx
import { ReactNode } from 'react';
import { useBranding } from '../BrandingContext';
=======
import React from 'react';
import { useBranding } from '../../BrandingContext';
>>>>>>> 0d60695e000b23b8b168752c2686ce686e47468f:src/components/ui/PageLayout.tsx

const PageLayout = ({ children }: { children: ReactNode }) => {
  const branding = useBranding();

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-8"
      style={{
        background: branding.gradient ?? "linear-gradient(to bottom right, #003865, #8cc63f)",
      }}
    >
      {/* Header */}
      <div
        className="w-full py-6 px-4 mb-6 flex items-center justify-center gap-4 shadow"
        style={{
          background: branding.gradient ?? "linear-gradient(to right, #003865, #8cc63f)",
          color: branding.textColor || "#ffffff",
        }}
      >
        <img
          src={branding.logoUrl}
          alt={`${branding.appName} Logo`}
          className="w-14 h-14 mr-3"
          style={{ borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
        />
        <span className="text-3xl font-bold">{branding.appName}</span>
      </div>
      {children}
      <footer className="mt-8 text-center text-sm" style={{ color: branding.textColor || "#ffffff" }}>
        {branding.contactInfo}
      </footer>
    </div>
  );
};

export default PageLayout;
