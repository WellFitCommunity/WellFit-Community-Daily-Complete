// src/components/NotFoundPage.tsx
import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import Card from '../components/ui/PrettyCard';
import PageLayout from '../components/ui/PageLayout';

const NotFoundPage: React.FC = () => {
  const location = useLocation();
  const { isAdminAuthenticated } = useAdminAuth();

  // Check if the missing route was admin-related
  const isAdminRoute = location.pathname.startsWith('/admin') ||
                       location.pathname === '/billing' ||
                       location.pathname.startsWith('/api-keys');

  // Determine where to redirect based on user type and route
  const redirectPath = (isAdminAuthenticated && isAdminRoute) ? '/admin' : '/';
  const redirectLabel = (isAdminAuthenticated && isAdminRoute) ? 'Back to Admin Dashboard' : 'Go to Welcome Page';

  return (
    <PageLayout>
      <Card className="max-w-lg w-full p-6 bg-white shadow-xl flex flex-col items-center text-center">
        <h1 className="text-4xl font-bold text-red-600 mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-3 text-[#003865]">Page Not Found</h2>
        <p className="text-lg leading-relaxed mb-6 text-[#003865]">
          Oops! The page you are looking for does not exist. It might have been moved or deleted.
        </p>
        {isAdminAuthenticated && isAdminRoute && (
          <p className="text-sm text-gray-600 mb-4">
            Attempted route: <code className="bg-gray-100 px-2 py-1 rounded">{location.pathname}</code>
          </p>
        )}
        <Link
          to={redirectPath}
          className="mt-4 px-6 py-3 font-semibold rounded-xl shadow-md transition bg-[#8cc63f] hover:bg-[#003865] text-white focus:outline-none focus:ring-2 focus:ring-[#003865]"
        >
          {redirectLabel}
        </Link>
      </Card>
    </PageLayout>
  );
};

export default NotFoundPage;
