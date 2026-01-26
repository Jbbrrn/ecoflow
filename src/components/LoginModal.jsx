import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/client.js';

const LoginModal = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('no-scroll');
      // Focus first input
      const firstInput = document.getElementById('email');
      if (firstInput) firstInput.focus();
    } else {
      document.body.classList.remove('no-scroll');
    }
    return () => document.body.classList.remove('no-scroll');
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setMessageType('');

    try {
      const result = await apiClient.login(email, password);
      localStorage.setItem('userToken', result.token);
      localStorage.setItem('userRole', result.userRole);
      localStorage.setItem('username', result.username);

      setMessage(`Welcome, ${result.username}! Redirecting...`);
      setMessageType('success');

      setTimeout(() => {
        if (result.userRole === 'admin') {
          navigate('/admin-dashboard');
        } else if (result.userRole === 'user') {
          navigate('/user-dashboard');
        }
      }, 1000);
    } catch (error) {
      setMessage(error.message || 'Invalid credentials. Please try again.');
      setMessageType('error');
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/45 backdrop-blur-md z-[1400] flex items-center justify-center p-6 overflow-y-auto"
            onClick={onClose}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 18 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              className="bg-white rounded-3xl shadow-2xl max-w-[620px] w-full max-h-[90vh] overflow-y-auto relative"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="loginModalTitle"
            >
              {/* Decorative green line */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-[60%] h-1 bg-gradient-to-r from-eco-green-light via-eco-green-medium to-eco-green-light rounded-full"></div>

              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/4 text-gray-700 flex items-center justify-center hover:bg-black/6 transition-colors focus:outline-none focus:ring-2 focus:ring-eco-green-primary focus:ring-offset-2"
                aria-label="Close login form"
              >
                ×
              </button>

              <div className="px-12 pt-12 pb-8">
                <div className="text-center mb-8">
                  <h2 id="loginModalTitle" className="text-4xl font-bold text-eco-green-dark mb-2">
                    Access Your Dashboard
                  </h2>
                  <p className="text-gray-600">Sign in to start managing your smart greenhouse</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-eco-green-dark mb-2">
                      Username or Email
                    </label>
                    <input
                      type="text"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your username or email address"
                      required
                      autoComplete="username"
                      className="w-full px-6 py-4 border-2 border-gray-200 rounded-2xl bg-blue-50 focus:outline-none focus:ring-4 focus:ring-eco-green-primary/15 focus:border-eco-green-medium transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-semibold text-eco-green-dark mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      autoComplete="current-password"
                      className="w-full px-6 py-4 border-2 border-gray-200 rounded-2xl bg-blue-50 focus:outline-none focus:ring-4 focus:ring-eco-green-primary/15 focus:border-eco-green-medium transition-all"
                    />
                  </div>

                  <motion.button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-eco-green-dark to-eco-green-medium text-white font-bold rounded-2xl uppercase tracking-wider shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-eco-green-primary focus:ring-offset-2"
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {loading ? 'SIGNING IN...' : 'SIGN IN'}
                  </motion.button>

                  {message && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 rounded-xl text-sm text-center ${
                        messageType === 'success'
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {message}
                    </motion.div>
                  )}
                </form>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default LoginModal;
