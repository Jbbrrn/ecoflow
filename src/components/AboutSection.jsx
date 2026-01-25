import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';

const AboutSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const stats = [
    { number: '24/7', label: 'Monitoring' },
    { number: '100%', label: 'Automated' },
    { number: 'AI', label: 'Powered' },
    { number: 'Sustainable', label: 'Users' },
  ];

  return (
    <section
      id="about"
      ref={ref}
      className="bg-white py-20 md:py-32"
      role="region"
      aria-label="About section"
    >
      <div className="max-w-7xl mx-auto px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 mb-16">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl md:text-5xl font-extrabold text-eco-green-dark mb-6 leading-tight">
              Welcome to Eco Flow
              <br />
              Innovation in Smart Agriculture
            </h2>
            <p className="text-lg text-eco-green-dark mb-6 leading-relaxed">
              Eco Flow is a smart greenhouse platform designed to optimize plant care through
              intelligent monitoring and automation. It combines IoT sensors, real-time data
              analytics, and AI-powered assistance to help users manage environmental conditions,
              irrigation schedules, and crop health with precision and ease.
            </p>
            <p className="text-lg text-eco-green-dark leading-relaxed">
              Built for sustainable urban gardening, Eco Flow empowers growers to make informed
              decisions, reduce resource waste, and cultivate healthier plants through technology.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="w-full h-[500px] rounded-2xl overflow-hidden shadow-2xl bg-eco-green-bg"
          >
            <iframe
              src="https://myub234.autodesk360.com/g/shares/SH28cd1QT2badd0ea72b829d14b7a864d833"
              className="w-full h-full border-0 rounded-2xl"
              title="Punlaan Greenhouse 3D Model"
              loading="lazy"
              allow="autoplay; fullscreen; vr; xr-spatial-tracking; camera; microphone"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-presentation"
            />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-16 border-t border-gray-200"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
              className="text-center"
            >
              <div className="text-4xl md:text-5xl font-extrabold text-eco-green-dark mb-2">
                {stat.number}
              </div>
              <div className="text-base text-gray-600 font-medium">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default AboutSection;
