// src/components/NotFoundPage.tsx
import * as React from 'react';
import { Link } from 'react-router-dom';
import Card from './Card';
import PageLayout from './PageLayout';

const NotFoundPage: React.FC = () => {
  return (
    <PageLayout>
      <Card className="max-w-lg w-full p-6 bg-white shadow-xl flex flex-col items-center text-center">
        <h1 className="text-4xl font-bold text-red-600 mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-3 text-[#003865]">Page Not Found</h2>
        <p className="text-lg leading-relaxed mb-6 text-[#003865]">
          Oops! The page you are looking for does not exist. It might have been moved or deleted.
        </p>
        <Link
          to="/"
          className="mt-4 px-6 py-3 font-semibold rounded-xl shadow-md transition bg-[#8cc63f] hover:bg-[#003865] text-white focus:outline-none focus:ring-2 focus:ring-[#003865]"
        >
          Go to Welcome Page
        </Link>
      </Card>
    </PageLayout>
  );
};

export default NotFoundPage;
