import { motion } from 'framer-motion';

const HeroSection = () => {
  return (
    <section
      id="home"
      className="relative min-h-[90vh] flex items-center justify-center text-center text-white pt-40 md:pt-48 pb-20 overflow-hidden"
      role="region"
      aria-label="Hero section"
    >
      {/* Background image */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/css/hero.png)' }}
        aria-hidden="true"
      />

      {/* Background overlay with gradient (green tint, lets image show through) */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-br from-eco-green-dark/55 via-eco-green-medium/50 to-eco-green-dark/55"></div>

      {/* Animated background effects */}
      <motion.div
        className="absolute inset-0 z-[2] opacity-35"
        animate={{
          background: [
            'radial-gradient(circle at 30% 40%, rgba(90, 157, 102, 0.3) 0%, transparent 40%)',
            'radial-gradient(circle at 70% 60%, rgba(76, 175, 80, 0.25) 0%, transparent 40%)',
            'radial-gradient(circle at 30% 40%, rgba(90, 157, 102, 0.3) 0%, transparent 40%)',
          ],
        }}
        transition={{ duration: 8, repeat: Infinity }}
      />

      <div className="relative z-10 max-w-5xl px-8 w-full flex flex-col items-center justify-center">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-white mb-8 leading-tight drop-shadow-lg text-center w-full"
        >
          <span className="block">Eco Flow:</span>
          <span className="block mt-2">Where Agriculture</span>
          <span className="block mt-2">Meets Innovation</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: 'easeOut' }}
          className="text-lg md:text-xl text-white/95 max-w-3xl mx-auto leading-relaxed drop-shadow-md"
        >
          A greenhouse monitoring web app developed by IT students of the University of Batangas,
          seamlessly integrated with automated irrigation hardware engineered by CPE students.
        </motion.p>

        <motion.a
          href="#about"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: 'easeOut' }}
          className="inline-block mt-8 px-8 py-4 rounded-xl font-semibold text-white bg-white/20 backdrop-blur-sm border-2 border-white/40 hover:bg-white/30 hover:border-white/60 transition-all duration-300 shadow-lg"
        >
          Learn more
        </motion.a>
      </div>
    </section>
  );
};

export default HeroSection;
