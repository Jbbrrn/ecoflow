import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '../services/client.js';

const CreateAccountModal = ({ isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('no-scroll');
      // Focus first input
      const firstInput = document.getElementById('create-account-name');
      if (firstInput) firstInput.focus();
    } else {
      document.body.classList.remove('no-scroll');
      // Reset form when modal closes
      setName('');
      setEmail('');
      setPassword('');
      setRole('user');
      setMessage('');
      setMessageType('');
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
      const result = await apiClient.register(name, email, password, role);
      setMessage(`Success! Account created for ${email}. User ID: ${result.userId}`);
      setMessageType('success');
      
      // Call onSuccess callback to refresh the user list
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
          setName('');
          setEmail('');
          setPassword('');
          setRole('user');
          setMessage('');
          setMessageType('');
          setLoading(false);
          onClose();
        }, 1000);
      } else {
        // Reset form after successful creation
        setTimeout(() => {
          setName('');
          setEmail('');
          setPassword('');
          setRole('user');
          setMessage('');
          setMessageType('');
          setLoading(false);
        }, 2000);
      }
    } catch (error) {
      setMessage(error.message || 'Failed to create account. Please try again.');
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
              aria-labelledby="createAccountModalTitle"
            >
              {/* Decorative green line */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-[60%] h-1 bg-gradient-to-r from-eco-green-light via-eco-green-medium to-eco-green-light rounded-full"></div>

              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/4 text-gray-700 flex items-center justify-center hover:bg-black/6 transition-colors focus:outline-none focus:ring-2 focus:ring-eco-green-primary focus:ring-offset-2"
                aria-label="Close create account form"
              >
                ×
              </button>

              <div className="px-12 pt-12 pb-8">
                <div className="text-center mb-8">
                  <h2 id="createAccountModalTitle" className="text-4xl font-bold text-eco-green-dark mb-2">
                    Create New Account
                  </h2>
                  <p className="text-gray-600">Register a new user for the Eco Flow system</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="create-account-name" className="block text-sm font-semibold text-eco-green-dark mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      id="create-account-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter username"
                      required
                      autoComplete="username"
                      className="w-full px-6 py-4 border-2 border-gray-200 rounded-2xl bg-blue-50 focus:outline-none focus:ring-4 focus:ring-eco-green-primary/15 focus:border-eco-green-medium transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="create-account-email" className="block text-sm font-semibold text-eco-green-dark mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="create-account-email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter user's email address"
                      required
                      autoComplete="email"
                      className="w-full px-6 py-4 border-2 border-gray-200 rounded-2xl bg-blue-50 focus:outline-none focus:ring-4 focus:ring-eco-green-primary/15 focus:border-eco-green-medium transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="create-account-password" className="block text-sm font-semibold text-eco-green-dark mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      id="create-account-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a secure password"
                      required
                      autoComplete="new-password"
                      className="w-full px-6 py-4 border-2 border-gray-200 rounded-2xl bg-blue-50 focus:outline-none focus:ring-4 focus:ring-eco-green-primary/15 focus:border-eco-green-medium transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="create-account-role" className="block text-sm font-semibold text-eco-green-dark mb-2">
                      User Role
                    </label>
                    <select
                      id="create-account-role"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      required
                      className="w-full px-6 py-4 border-2 border-gray-200 rounded-2xl bg-blue-50 focus:outline-none focus:ring-4 focus:ring-eco-green-primary/15 focus:border-eco-green-medium transition-all"
                    >
                      <option value="user">👤 User</option>
                      <option value="admin">👤 Admin</option>
                    </select>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-eco-green-dark to-eco-green-medium text-white font-bold rounded-2xl uppercase tracking-wider shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-eco-green-primary focus:ring-offset-2"
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
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

export default CreateAccountModal;

