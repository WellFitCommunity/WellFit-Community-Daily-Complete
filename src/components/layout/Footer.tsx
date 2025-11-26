// src/components/layout/Footer.tsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useBranding } from '../../BrandingContext';

function readableTextOn(bgHex: string): '#000000' | '#ffffff' {
  const hex = (bgHex || '#003865').replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
}

const AUTH_ROUTES = ['/login', '/register', '/verify', '/admin-login', '/reset-password', '/change-password'];

const Footer: React.FC = () => {
  const { branding } = useBranding(); // ✅ correct shape: { branding, setBranding }
  const location = useLocation();

  // Hide footer on authentication pages for cleaner UI
  const isAuthPage = AUTH_ROUTES.some(
    (p) => location.pathname === p || location.pathname.startsWith(`${p}/`)
  );

  if (isAuthPage) return null;

  const primary = branding?.primaryColor || '#003865';
  const textColor = branding?.textColor || readableTextOn(primary);

  const footerText =
    branding?.customFooter ??
    `© ${new Date().getFullYear()} ${branding?.appName || 'WellFit Community'}. All rights reserved.`;

  const linkStyle: React.CSSProperties = { color: 'inherit', textDecoration: 'underline' };

  return (
    <footer
      style={{ backgroundColor: primary, color: textColor }}
      className="w-full text-center py-4 px-2 mt-8 rounded-t-xl"
      aria-label="Site footer"
    >
      <div className="max-w-7xl mx-auto flex flex-col items-center gap-1">
        <div>{footerText}</div>

        <div className="mt-1">
          Powered by WellFit Community, Inc., Vital Edge Healthcare Consulting,{' '}
          <Link
            to="/envision"
            className="hover:underline cursor-pointer transition-opacity hover:opacity-80"
            style={{ color: 'inherit' }}
            aria-label="Envision Portal"
          >
            Envision Virtual Edge Group
          </Link>
        </div>

        <div className="mt-1 text-sm opacity-90">
          {branding?.contactInfo || 'Contact us at info@thewellfitcommunity.org'}
        </div>

        {/* Legal and administrative links */}
        <nav className="mt-2 flex flex-wrap justify-center gap-4 text-sm" aria-label="Footer navigation">
          <Link to="/privacy-policy" style={linkStyle}>
            Privacy Policy
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/terms" style={linkStyle}>
            Terms of Service
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/admin-login" className="font-semibold" style={linkStyle}>
            Admin Login
          </Link>
        </nav>
      </div>
    </footer>
  );
};

export default Footer;
