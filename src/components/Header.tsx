// src/components/Header.tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';

const Header: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="bg-[#003865] shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* Logo and Title */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <img src="/logo.png" alt="WellFit Logo" className="h-8 w-8" />
              <span className="ml-2 text-xl font-bold text-white">WellFit Community</span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex space-x-6 items-center">
            <a
              href="https://wellfitcommunity.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-[#8cc63f] text-sm"
            >
              Visit Website
            </a>
            <Link
              to="/logout"
              className="text-white hover:text-red-400 text-sm"
            >
              Logout
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-md text-white hover:text-[#8cc63f] focus:outline-none"
            >
              <Menu size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden bg-[#003865] shadow-inner">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <a
              href="https://thewellfitcommunity.org"
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2 rounded-md text-base font-medium text-white hover:text-[#8cc63f]"
            >
              Visit Website
            </a>
            <Link
              to="/logout"
              className="block px-3 py-2 rounded-md text-base font-medium text-white hover:text-red-400"
            >
              Logout
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
