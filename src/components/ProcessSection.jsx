import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';

const steps = [
  {
    number: '01',
    icon: '🔍',
    title: 'Discovery and Consultation',
    description:
      'Our system analyzes your greenhouse environment to understand current conditions, sensor data, and optimization opportunities.',
  },
  {
    number: '02',
    icon: '🌱',
    title: 'IoT Sensor Integration',
    description:
      'Eco Flow prioritizes real-time monitoring through advanced IoT sensors for temperature, humidity, and soil moisture tracking.',
  },
  {
    number: '03',
    icon: '💧',
    title: 'Water-Efficient Irrigation',
    description:
      'Eco Flow is committed to responsible water management through automated irrigation systems that optimize usage based on sensor data.',
  },
  {
    number: '04',
    icon: '✓',
    title: 'Quality Control & Support',
    description:
      "Eco Flow doesn't consider system setup as the end. We provide continuous monitoring, analytics, and AI-powered support for optimal results.",
  },
];

const ProcessSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section
      ref={ref}
      className="bg-eco-green-dark py-20 md:py-32 text-white"
      role="region"
      aria-label="Process section"
    >
      <div className="max-w-7xl mx-auto px-8">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8 }}
          className="text-4xl md:text-6xl font-extrabold text-white text-center mb-16"
        >
          Meticulous And Sustainable Process.
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 50 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
              transition={{ duration: 0.6, delay: index * 0.15 }}
              className="text-center p-8 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
              whileHover={{ y: -5 }}
            >
              <div className="text-sm font-bold text-eco-green-light mb-4 opacity-80">
                {step.number}
              </div>
              <div className="text-5xl mb-6 drop-shadow-lg">{step.icon}</div>
              <h3 className="text-xl font-bold text-white mb-4">{step.title}</h3>
              <p className="text-sm leading-relaxed text-white/90">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProcessSection;
