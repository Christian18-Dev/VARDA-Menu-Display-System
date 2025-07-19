import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/api';
import { useAuth } from '../context/AuthContext';
import vardaLogo from '../assets/vardanewlogo.png';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();
  const [typedText, setTypedText] = useState('');
  const fullText = 'Hi, Welcome!';
  const emoji = ' 👋';
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    let current = 0;
    let timeout;
    let isDeleting = false;

    function animate() {
      if (isTyping && !isDeleting) {
        if (current <= fullText.length) {
          setTypedText(fullText.slice(0, current));
          current++;
          timeout = setTimeout(animate, 70);
        } else {
          setTypedText(fullText + emoji);
          timeout = setTimeout(() => {
            isDeleting = true;
            animate();
          }, 1200);
        }
      } else if (isDeleting) {
        if (current > 0) {
          current--;
          setTypedText(fullText.slice(0, current));
          timeout = setTimeout(animate, 40);
        } else {
          isDeleting = false;
          timeout = setTimeout(animate, 500);
        }
      }
    }
    animate();
    return () => clearTimeout(timeout);
    // eslint-disable-next-line
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await login(formData);
      authLogin(response.data.user, response.data.token);
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-indigo-400 via-blue-300 to-pink-200 animate-gradient-x">
      <div className="relative w-full max-w-md p-8 rounded-3xl shadow-2xl bg-white/30 backdrop-blur-lg border border-white/40 transition-all duration-500 hover:scale-[1.025]">
        <div className="flex flex-col items-center">
          <img
            src={vardaLogo}
            alt="VARDA Logo"
            className="h-24 w-24 object-contain animate-bounce drop-shadow-lg mb-1"
            draggable="false"
          />
          <h2 className="mt-4 text-center text-3xl font-extrabold text-gray-900 drop-shadow-sm min-h-[2.5rem]">
            <span className="whitespace-pre border-r-2 border-indigo-400 animate-typing-cursor">{typedText}</span>
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit} autoComplete="off">
          <div className="space-y-6">
            {/* Floating label for Email */}
            <div className="relative">
              <input
                id="email"
                name="email"
                type="email"
                required
                className="peer h-12 w-full rounded-lg border border-gray-300 bg-white/60 px-4 py-4 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:bg-white/80 focus:outline-none transition-all duration-200 shadow-sm"
                placeholder="Email address"
                value={formData.email}
                onChange={handleChange}
                aria-label="Email address"
              />
            </div>
            {/* Floating label for Password */}
            <div className="relative">
              <input
                id="password"
                name="password"
                type="password"
                required
                className="peer h-12 w-full rounded-lg border border-gray-300 bg-white/60 px-4 py-4 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:bg-white/80 focus:outline-none transition-all duration-200 shadow-sm"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                aria-label="Password"
              />
            </div>
          </div>
          {error && (
            <div className="rounded-md bg-red-50 p-4 mt-2 animate-fade-in">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    {error}
                  </h3>
                </div>
              </div>
            </div>
          )}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border-2 border-transparent bg-white/10 rounded-xl text-base font-semibold text-white shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden button-animated-gradient"
            >
              <span className="absolute inset-0 rounded-xl pointer-events-none button-gradient-border"></span>
              <span className="relative flex items-center">
                {loading ? (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="-ml-1 mr-2 h-5 w-5 group-hover:animate-wiggle" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                )}
                {loading ? 'Signing in...' : 'Sign in'}
              </span>
            </button>
          </div>
        </form>
      </div>
      {/* Custom animated gradient background (CSS in index.css) */}
    </div>
  );
};

export default LoginPage; 