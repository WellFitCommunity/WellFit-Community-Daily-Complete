// src/components/Card.tsx
import React from 'react';

const Card: React.FC<{ className?: string }> = ({ className = '', children }) => (
  <section className={`bg-white rounded-2xl shadow-md p-6 mb-6 border-l-8 border-wellfit-green ${className}`}>
    {children}
  </section>
);

export default Card;
