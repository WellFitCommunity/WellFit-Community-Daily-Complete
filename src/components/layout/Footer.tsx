// src/components/layout/Footer.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useBranding } from '../../BrandingContext';

const Footer: React.FC = () => {
  const branding = useBranding();

  // Determine appropriate text color based on background luminance
  const isPrimaryColorDark = (): boolean => {
    if (!branding.primaryColor) return true;
    const hex = branding.primaryColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  };

  const textColorClass = isPrimaryColorDark() ? 'text-white' : 'text-gray-800';

  // Construct footer text dynamically; branding.config.ts should provide appName and primaryColor
  const footerText = `© ${new Date().getFullYear()} ${branding.appName}. All rights reserved.`;

  // Link styling: inherit text color for maximum contrast, underline for affordance
  const linkStyle: React.CSSProperties = { color: 'inherit', textDecoration: 'underline' };

  return (
    <footer
      style={{ backgroundColor: branding.primaryColor || '#003865' }}
      className={`w-full text-center py-4 px-2 mt-8 ${textColorClass} rounded-t-xl`}
      aria-label="Site footer"
    >
      <div className="max-w-7xl mx-auto flex flex-col items-center gap-1">
        <div>{footerText}</div>

        <div className="mt-1">
          Powered by WellFit Community, Inc., Vital Edge Healthcare Consulting, Envision Virtual Edge Group
        </div>

        <div className="mt-1 text-sm opacity-90">
          {branding.contactInfo || 'Contact us at info@thewellfitcommunity.org'}
        </div>

        {/* Global Admin access */}
        <nav className="mt-2" aria-label="Administrative">
          <Link to="/admin-login" className="font-semibold" style={linkStyle}>
            Admin Login
          </Link>
        </nav>
      </div>
    </footer>
  );
};

export default Footer;
