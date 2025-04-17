import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-[#003865] text-white text-center p-2 mt-6 rounded-t-xl">
      <p className="text-sm">&copy; {new Date().getFullYear()} WellFit Community. All rights reserved.</p>
    </footer>
  );
};

export default Footer;
