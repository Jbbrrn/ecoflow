import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const Header = ({ onLoginClick }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'py-4 shadow-lg' : 'py-6'
      } bg-white/95 backdrop-blur-xl border-b border-black/5`}
      role="banner"
    >
      <div className="max-w-7xl mx-auto px-8 flex justify-between items-center gap-8">
        <motion.a
          href="#home"
          className="flex items-center gap-6 text-3xl font-bold text-eco-green-light transition-transform hover:scale-105"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <img
            src="/css/logo_ecoflow.png"
            alt="Eco Flow Logo"
            className="h-20 w-auto object-contain transition-transform hover:scale-105"
            onError={(e) => {
              console.error('Logo not found at /css/logo_ecoflow.png');
            }}
          />
          <span className="font-extrabold bg-gradient-to-r from-eco-green-dark to-eco-green-medium bg-clip-text text-transparent">
            Eco Flow
          </span>
        </motion.a>

        <button
          className="md:hidden text-eco-green-dark text-2xl p-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>

        <div className="hidden md:flex items-center gap-8">
          <motion.button
            onClick={onLoginClick}
            className="px-8 py-3 bg-gradient-to-r from-eco-green-light to-eco-green-medium text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Login
          </motion.button>
        </div>
      </div>
    </motion.header>
  );
};

export default Header;
