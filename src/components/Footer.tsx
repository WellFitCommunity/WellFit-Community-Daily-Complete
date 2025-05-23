import React from 'react';
import { useBranding } from '../BrandingContext';

const Footer = () => {
  const branding = useBranding();

  // Basic check for dark color to adjust text. This could be more sophisticated.
  const isPrimaryColorDark = () => {
    if (!branding.primaryColor) return true;
    const color = branding.primaryColor.startsWith('#') ? branding.primaryColor.substring(1) : branding.primaryColor;
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    // Formula for luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  };

  const textColor = isPrimaryColorDark() ? 'text-white' : 'text-gray-800';

  return (
    <footer 
      style={{ backgroundColor: branding.primaryColor }} 
      className={`text-center p-2 mt-6 rounded-t-xl ${textColor}`}
    >
      <p className="text-sm">{branding.contactInfo}</p>
    </footer>
  );
};

export default Footer;
