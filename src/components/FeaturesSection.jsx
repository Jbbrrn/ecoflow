import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';

const features = [
  {
    id: 'iot',
    title: 'IoT Sensor Monitoring',
    image: '/css/soilsensor.jpg',
    description: 'Monitor your greenhouse environment in real-time with advanced IoT sensors. Track temperature, humidity, soil moisture, and light levels to ensure optimal growing conditions for your plants.',
    overlayText: 'Real-time monitoring',
  },
  {
    id: 'analytics',
    title: 'Data Analytics Dashboard',
    image: '/css/data_analytics.png',
    description: 'Gain valuable insights from your greenhouse data with comprehensive analytics. Visualize trends, track performance metrics, and make data-driven decisions to optimize your agricultural operations.',
    overlayText: 'Advanced insights',
  },
  {
    id: 'chatbot',
    title: 'AI Chatbot Assistant',
    image: '/css/AI_chatbot.jpg',
    description: 'Get instant answers and expert guidance from our AI-powered chatbot. Ask questions about plant care, irrigation schedules, troubleshooting, and best practices for sustainable greenhouse management.',
    overlayText: 'Intelligent assistance',
  },
];

const FeatureCard = ({ feature, index }) => {
  const [isActive, setIsActive] = useState(false);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.8, delay: index * 0.15 }}
      className="bg-surface rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer min-h-[400px] relative"
      onClick={() => setIsActive(!isActive)}
      whileHover={{ y: -15, scale: 1.02 }}
    >
      <div className="relative h-[350px] overflow-hidden bg-eco-green-bg">
        <motion.img
          src={feature.image}
          alt={feature.title}
          className="w-full h-full object-cover"
          whileHover={{ scale: 1.1, rotate: 1 }}
          transition={{ duration: 0.5 }}
        />
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-eco-green-dark/85 to-eco-green-medium/75 flex flex-col items-center justify-center gap-6"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="w-16 h-16 bg-surface rounded-full flex items-center justify-center text-4xl font-light text-eco-green-dark shadow-lg"
            initial={{ scale: 0, rotate: -180 }}
            whileHover={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.5 }}
          >
            +
          </motion.div>
          <p className="text-white text-lg font-semibold drop-shadow-lg">{feature.overlayText}</p>
        </motion.div>
      </div>

      <h3 className="px-8 py-6 text-xl font-bold text-eco-green-dark text-center">{feature.title}</h3>

      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 bg-gradient-to-br from-eco-green-dark to-eco-green-medium text-white p-8 flex flex-col justify-center items-center text-center rounded-xl z-10"
          >
            <p className="text-lg leading-relaxed mb-4 max-w-[90%]">{feature.description}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsActive(false);
              }}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-2xl font-light transition-colors"
              aria-label="Close description"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const FeaturesSection = () => {
  return (
    <section
      id="services"
      className="bg-surface py-20 md:py-32"
      role="region"
      aria-label="Features section"
    >
      <div className="max-w-7xl mx-auto px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {features.map((feature, index) => (
            <FeatureCard key={feature.id} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
