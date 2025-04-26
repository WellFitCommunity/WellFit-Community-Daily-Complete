// src/components/RequireAuth.tsx
import { Navigate, useLocation } from 'react-router-dom';

const RequireAuth = ({ children }: { children: JSX.Element }) => {
  const location = useLocation();
  const phone    = localStorage.getItem('wellfitPhone');
  const pin      = localStorage.getItem('wellfitPin');

  if (!phone || !pin) {
    // send them back to WelcomePage at "/"
    return <Navigate to="/" state={{ from: location }} replace />;
  }
  return children;
};

export default RequireAuth;
