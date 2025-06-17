import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBranding } from '../BrandingContext';

const passwordRules = [
  {
    test: (pw: string) => pw.length >= 8,
    message: 'At least 8 characters',
  },
  {
    test: (pw: string) => /[A-Z]/.test(pw),
    message: 'At least 1 capital letter',
  },
  {
    test: (pw: string) => /\d/.test(pw),
    message: 'At least 1 number',
  },
  {
    test: (pw: string) => /[^A-Za-z0-9]/.test(pw),
    message: 'At least 1 special character',
  },
];

const isPhone = (val: string) => /^\d{10,15}$/.test(val.replace(/[^\d]/g, ''));

const LoginPage: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const branding = useBranding();

  useEffect(() => {
    if (localStorage.getItem('wellfitUserId')) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const isColorDark = (colorStr: string) => {
    if (!colorStr) return true;
    const color = colorStr.startsWith('#') ? colorStr.substring(1) : colorStr;
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  };

  const primaryButtonTextColor = isColorDark(branding.primaryColor) ? 'text-white' : 'text-gray-800';

  // Evaluate all password rules
  const failedRules = passwordRules.filter(rule => !rule.test(password));

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!phone || !password) {
      setError('Please enter both phone number and password.');
      return;
    }

    if (!isPhone(phone)) {
      setError('Please enter a valid phone number.');
      return;
    }

    if (failedRules.length > 0) {
      setError('Password must meet all requirements.');
      return;
    }

    setLoading(true);

    const requestBody = { phone, password };

    console.log('// JULES: Attempting login with:', { url: '/functions/v1/login', method: 'POST', body: requestBody });

    try {
      const response = await fetch('/functions/v1/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      console.log('// JULES: Login response status:', response.status);

      if (response.ok) {
        let result;
        try {
          result = await response.json();
          console.log('// JULES: Login response data:', result);
        } catch (jsonError: any) {
          console.error('// JULES: JSON parsing error:', jsonError);
          setError('Invalid response from server.');
          return;
        }

        if (result && result.success && result.data && result.data.userId) {
          localStorage.setItem('wellfitUserId', result.data.userId);
          if (result.data.token) {
            localStorage.setItem('wellfitUserToken', result.data.token);
          }
          setError('');
          navigate('/demographics');
        } else {
          throw new Error(result.error || 'Login failed. Please check your phone number and password.');
        }
      } else {
        const errorText = await response.text();
        console.error('// JULES: Login error response text:', errorText);

        if (response.status >= 500) {
          throw new Error('Something went wrong on our end. Please try again later.');
        } else if (response.status === 401) {
          throw new Error('Login failed. Please check your phone number and password.');
        } else {
          throw new Error(`Login failed: ${response.status} ${response.statusText}. ${errorText ? errorText.substring(0,100) : ''}`);
        }
      }
    } catch (err: any) {
      console.error('// JULES: Login error:', err);
      if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
        setError('Could not connect to the server. Please check your internet connection and try again.');
      } else {
        setError(err.message || 'An unexpected error occurred during login. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="max-w-md mx-auto mt-16 p-8 bg-white rounded-xl shadow-md text-center"
      style={{ borderColor: branding.secondaryColor, borderWidth: '2px' }}
    >
      {branding.logoUrl && (
        <img src={branding.logoUrl} alt={`${branding.appName} Logo`} className="h-16 w-auto mx-auto mb-4" />
      )}
      <h1 className="text-2xl font-bold mb-6" style={{ color: branding.primaryColor }}>
        {branding.appName} - Senior Login
      </h1>
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="phone-input" className="block text-sm font-medium text-gray-700 mb-1 text-left">
            Phone Number
          </label>
          <input
            id="phone-input"
            type="tel"
            placeholder="Phone Number"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            required
            aria-required="true"
            aria-invalid={!!error}
            className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:outline-none"
            style={{ borderColor: branding.secondaryColor, '--tw-ring-color': branding.primaryColor } as React.CSSProperties}
            autoComplete="tel"
          />
        </div>
        <div>
          <label htmlFor="password-input" className="block text-sm font-medium text-gray-700 mb-1 text-left">
            Password
            <span className="block text-xs text-gray-500 mt-1">
              Must be at least 8 characters, with 1 capital letter, 1 number, and 1 special character.
            </span>
          </label>
          <input
            id="password-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            aria-required="true"
            aria-invalid={!!error}
            className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:outline-none"
            style={{ borderColor: branding.secondaryColor, '--tw-ring-color': branding.primaryColor } as React.CSSProperties}
            autoComplete="current-password"
          />
          {password && (
            <ul className="text-xs text-left mt-2">
              {passwordRules.map(rule => (
                <li key={rule.message}
                    className={rule.test(password) ? 'text-green-600' : 'text-red-500'}>
                  {rule.test(password) ? '✓' : '✗'} {rule.message}
                </li>
              ))}
            </ul>
          )}
        </div>
        {error && <p role="alert" className="text-red-500 text-sm font-semibold">{error}</p>}
        <button
          type="submit"
          className={`w-full py-3 font-semibold rounded hover:opacity-90 transition-opacity ${primaryButtonTextColor} focus:outline-none focus:ring-2 focus:ring-offset-2`}
          style={{ backgroundColor: branding.primaryColor }}
          disabled={loading}
        >
          {loading ? 'Logging In...' : 'Log In'}
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
