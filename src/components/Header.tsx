// src/components/Header.tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const Header: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="bg-gradient-to-r from-wellfit-blue to-wellfit-green shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo / Title */} 
          <div className="text-white text-xl font-bold">WellFit Community</div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link to="/dashboard" className="text-white hover:text-[#8cc63f] transition">
              Dashboard
            </Link>
            <Link to="/wordfind" className="text-white hover:text-[#8cc63f] transition">
              Word Find
            </Link>
            <Link to="/logout" className="text-red-300 hover:text-red-500 transition">
              Log Out
            </Link>
            <a
              href="https://www.theWellFitCommunity.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white bg-[#8cc63f] px-3 py-1 rounded hover:bg-green-700 transition"
            >
              Visit Website
            </a>
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMenuOpen(open => !open)}
            className="md:hidden text-white focus:outline-none"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {menuOpen && (
        <nav className="md:hidden px-4 pb-4 space-y-2">
          <Link
            to="/dashboard"
            onClick={() => setMenuOpen(false)}
            className="block text-white hover:text-[#8cc63f] transition"
          >
            Dashboard
          </Link>
          <Link
            to="/wordfind"
            onClick={() => setMenuOpen(false)}
            className="block text-white hover:text-[#8cc63f] transition"
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
            href="https://www.theWellFitCommunity.org"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-white bg-[#8cc63f] px-3 py-2 rounded text-center hover:bg-green-700 transition"
          >
            Visit Website
          </a>
        </nav>
      )}
    </header>
  );
};

export default Header;
