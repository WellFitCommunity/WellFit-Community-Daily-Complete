import React from 'react';

export default function WebsiteButton({ className = '' }: { className?: string }) {
  // WellFit green + white text
  return (
    <a
      href="https://www.TheWellFitCommunity.org"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center px-3 py-1.5 rounded-md font-medium shadow ${className}`}
      style={{ backgroundColor: '#8cc63f', color: '#ffffff' }}
    >
      Visit Website
    </a>
  );
}
