import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const Header = ({ onLoginClick }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const setHeight = () => {
      document.documentElement.style.setProperty('--header-height', `${el.offsetHeight}px`);
    };
    setHeight();
    const ro = new ResizeObserver(setHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.classList.add('no-scroll');
    } else {
      document.body.classList.remove('no-scroll');
    }
    return () => document.body.classList.remove('no-scroll');
  }, [mobileMenuOpen]);

  const handleLoginClick = () => {
    setMobileMenuOpen(false);
    onLoginClick();
  };

  return (
    <motion.header
      ref={headerRef}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'py-4 shadow-lg' : 'py-6'
      } bg-white/95 backdrop-blur-xl border-b border-black/5`}
      role="banner"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 flex justify-between items-center gap-4">
        <motion.a
          href="#home"
          className="flex items-center gap-3 sm:gap-6 text-2xl sm:text-3xl font-bold text-eco-green-light transition-transform hover:scale-105 min-w-0"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <img
            src="/css/logo_ecoflow.png"
            alt="Eco Flow Logo"
            className="h-14 sm:h-20 w-auto object-contain flex-shrink-0"
            onError={(e) => {
              console.error('Logo not found at /css/logo_ecoflow.png');
            }}
          />
          <span className="font-extrabold bg-gradient-to-r from-eco-green-dark to-eco-green-medium bg-clip-text text-transparent truncate">
            Eco Flow
          </span>
        </motion.a>

        {/* Desktop: Login button */}
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

        {/* Mobile: Hamburger button */}
        <button
          className="md:hidden flex-shrink-0 p-2 rounded-lg text-eco-green-dark hover:bg-eco-green-bg focus:outline-none focus:ring-2 focus:ring-eco-green-light min-w-[44px] min-h-[44px] items-center justify-center"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          <span className="text-2xl" aria-hidden="true">
            {mobileMenuOpen ? '✕' : '☰'}
          </span>
        </button>
      </div>

      {/* Mobile menu panel: nav + Login */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-40 md:hidden top-[var(--header-height,88px)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <motion.nav
              className="fixed left-0 right-0 z-50 md:hidden bg-white border-b border-black/10 shadow-xl"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              style={{ top: 'var(--header-height, 88px)' }}
              role="navigation"
              aria-label="Mobile menu"
            >
              <div className="px-4 py-4 flex flex-col gap-2">
                <a
                  href="#home"
                  className="py-3 px-4 rounded-lg text-eco-green-dark font-medium hover:bg-eco-green-bg"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Home
                </a>
                <a
                  href="#features"
                  className="py-3 px-4 rounded-lg text-eco-green-dark font-medium hover:bg-eco-green-bg"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Features
                </a>
                <a
                  href="#about"
                  className="py-3 px-4 rounded-lg text-eco-green-dark font-medium hover:bg-eco-green-bg"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  About
                </a>
                <button
                  onClick={handleLoginClick}
                  className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-eco-green-light to-eco-green-medium shadow-lg hover:shadow-xl transition-all text-center"
                >
                  Login
                </button>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </motion.header>
  );
};

export default Header;
