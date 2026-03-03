import React from 'react';
import { useBranding } from '../../BrandingContext';

export default function WelcomeHeader() {
  const { branding } = useBranding();

  const primary = branding?.primaryColor || '#003865';
  const secondary = branding?.secondaryColor || '#8cc63f';
  const gradient = branding?.gradient || `linear-gradient(90deg, ${secondary} 0%, rgba(255,255,255,0.12) 48%, ${primary} 100%)`;
  const websiteUrl = branding?.websiteUrl;

  return (
    <header className="shadow-md" style={{ background: gradient }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center gap-3">
            {branding?.logoUrl && (
              <img src={branding.logoUrl} alt={`${branding?.appName || 'Platform'} logo`} className="h-12 w-auto rounded-md" />
            )}
            <div className="flex flex-col">
              <span className="text-white text-2xl sm:text-3xl font-semibold tracking-tight">
                {branding?.appName || 'Welcome'}
              </span>
              {branding?.tagline && (
                <span className="text-white/80 text-sm sm:text-base">
                  {branding.tagline}
                </span>
              )}
            </div>
          </div>
          {websiteUrl && (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-medium shadow-sm hover:shadow-md transition focus:outline-hidden focus:ring-2 focus:ring-offset-2"
              style={{ backgroundColor: secondary, color: '#fff' }}
            >
              Visit Website
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
