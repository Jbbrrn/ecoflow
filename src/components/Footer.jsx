import { motion } from 'framer-motion';

const Footer = () => {
  return (
    <footer className="bg-eco-green-dark py-12 md:py-16 text-white" role="contentinfo">
      <div className="max-w-7xl mx-auto px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h3 className="text-2xl font-bold mb-4">Eco Flow</h3>
            <p className="text-sm text-white/90 mb-2">Smart Greenhouse Management System</p>
            <p className="text-xs text-white/75 italic">
              A Thesis Project by Students of the University of Batangas
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <h4 className="text-base font-semibold mb-4">Quick Links</h4>
            <nav className="flex flex-col gap-2" aria-label="Footer navigation">
              <a
                href="#home"
                className="text-sm text-white/80 hover:text-eco-green-light transition-colors"
              >
                Home
              </a>
              <a
                href="#about"
                className="text-sm text-white/80 hover:text-eco-green-light transition-colors"
              >
                About
              </a>
              <a
                href="#services"
                className="text-sm text-white/80 hover:text-eco-green-light transition-colors"
              >
                Features
              </a>
            </nav>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h4 className="text-base font-semibold mb-4">Contact</h4>
            <p className="text-sm text-white/80 mb-2">
              <span className="font-semibold block mb-1">Email:</span>
              <a
                href="mailto:ubat@ub.edu.ph"
                className="hover:text-eco-green-light transition-colors"
              >
                ubat@ub.edu.ph
              </a>
            </p>
            <p className="text-sm text-white/80">
              <span className="font-semibold block mb-1">University:</span>
              <a
                href="https://www.google.com/maps/dir/?api=1&destination=University+of+Batangas+Lipa+Campus"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-eco-green-light transition-colors"
              >
                University of Batangas Lipa Campus
              </a>
            </p>
          </motion.div>
        </div>

        <div className="pt-8 border-t border-white/10 text-center">
          <p className="text-xs text-white/70">© 2025 Eco Flow. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
