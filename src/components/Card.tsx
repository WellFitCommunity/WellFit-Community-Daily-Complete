import React, { ReactNode } from 'react';

interface CardProps {
  className?: string;
  children: ReactNode; // This ensures the children prop is properly typed
}

const Card: React.FC<CardProps> = ({ className = '', children }) => (
  <section className={`bg-white rounded-2xl shadow-md p-4 sm:p-6 mb-6 border-l-8 border-wellfit-green ${className}`}>
    {children}
  </section>
);

export default Card;
