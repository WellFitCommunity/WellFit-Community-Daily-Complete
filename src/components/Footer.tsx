import React from 'react';
import { useBranding } from '../BrandingContext';

const Footer = () => {
  const branding = useBranding();

  // Check if the primary color is dark, for contrast
  const isPrimaryColorDark = () => {
    if (!branding.primaryColor) return true;
    const color = branding.primaryColor.startsWith('#') ? branding.primaryColor.substring(1) : branding.primaryColor;
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  };

  const textColor = isPrimaryColorDark() ? 'text-white' : 'text-gray-800';

  // Default powered-by info
  const allianceFooter = (
    <>
      <div>
        © {new Date().getFullYear()} {branding.appName}. All rights reserved.
      </div>
      <div className="mt-1">
        Powered by The Alliance: WellFit Community, Inc., VitalEdge Healthcare Consulting,
        Envision VirtualEdge Group, and partners.
      </div>
      <div className="mt-1 text-xs opacity-90">
        {branding.contactInfo || "Contact us at info@thewellfitcommunity.org"}
      </div>
    </>
  );

  return (
    <footer
      style={{ backgroundColor: branding.primaryColor || "#003865" }}
      className={`w-full text-center py-4 px-2 mt-8 ${textColor} rounded-t-xl`}
    >
      {allianceFooter}
    </footer>
  );
};

export default Footer;

