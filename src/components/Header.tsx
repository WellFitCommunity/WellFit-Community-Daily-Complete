// src/components/Header.tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useBranding } from '../BrandingContext';

const Header: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
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
  const hoverTextColor = isPrimaryColorDark() ? 'text-gray-300' : 'text-gray-600';
  const linkHoverColor = branding.secondaryColor || (isPrimaryColorDark() ? '#CBD5E0' : '#4A5568');


  return (
    <header style={{ backgroundColor: branding.primaryColor }} className="shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo / Title */}
          <div className={`flex items-center ${textColor} text-xl font-bold`}>
            {branding.logoUrl && <img src={branding.logoUrl} alt={`${branding.appName} Logo`} className="h-10 w-auto mr-3" />}
            {branding.appName}
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link to="/dashboard" className={`${textColor} hover:${hoverTextColor} transition`}>
              Dashboard
            </Link>
            <Link to="/wordfind" className={`${textColor} hover:${hoverTextColor} transition`}>
              Word Find
            </Link>
            <Link to="/logout" className="text-red-300 hover:text-red-500 transition">
              Log Out
            </Link>
            <a
              href="https://www.theWellFitCommunity.org" // This URL could also be part of branding
              target="_blank"
              rel="noopener noreferrer"
              style={{ backgroundColor: branding.secondaryColor }}
              className={`px-3 py-1 rounded ${textColor} hover:opacity-90 transition`}
            >
              Visit Website
            </a>
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMenuOpen(open => !open)}
            className={`md:hidden ${textColor} focus:outline-none`}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {/* Background for mobile nav should also be primaryColor, text adjusted accordingly */}
      {menuOpen && (
        <nav className="md:hidden px-4 pb-4 space-y-2" style={{ backgroundColor: branding.primaryColor }}>
          <Link
            to="/dashboard"
            onClick={() => setMenuOpen(false)}
            className={`block ${textColor} hover:${hoverTextColor} transition`}
          >
            Dashboard
          </Link>
          <Link
            to="/wordfind"
            onClick={() => setMenuOpen(false)}
            className={`block ${textColor} hover:${hoverTextColor} transition`}
          >
            Word Find
          </Link>
          <Link
            to="/logout"
            onClick={() => setMenuOpen(false)}
            className="block text-red-300 hover:text-red-500 transition"
          >
            Log Out
          </Link>
          <a
            href="https://www.theWellFitCommunity.org" // This URL could also be part of branding
            target="_blank"
            rel="noopener noreferrer"
            style={{ backgroundColor: branding.secondaryColor }}
            className={`block px-3 py-2 rounded text-center ${textColor} hover:opacity-90 transition`}
          >
            Visit Website
          </a>
        </nav>
      )}
    </header>
  );
};

export default Header;
