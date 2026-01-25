import { motion } from 'framer-motion';
import { useState } from 'react';
import ChatbotModal from './ChatbotModal';

const ChatIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7 9H17M7 13H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const FloatingChatbotButton = () => {
  const [isHovered, setIsHovered] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = () => {
    setIsModalOpen(true);
  };

  return (
    <>
      <motion.button
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-14 h-14 sm:w-16 sm:h-16 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-eco-green-medium via-eco-green-medium to-eco-green-dark shadow-2xl cursor-pointer z-50 flex items-center justify-center group overflow-visible border-2 border-white/20 transition-all duration-300"
        style={{
          boxShadow: isHovered 
            ? '0 10px 40px rgba(61, 134, 11, 0.5), 0 0 20px rgba(61, 134, 11, 0.3)' 
            : '0 8px 24px rgba(61, 134, 11, 0.4)'
        }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ 
          type: "spring",
          stiffness: 200,
          damping: 25,
          delay: 0.3
        }}
        aria-label="Open EcoBot"
      >
        {/* Enhanced glowing effect on hover */}
        <motion.div
          className="absolute inset-0 rounded-full bg-eco-green-medium"
          animate={{
            opacity: isHovered ? [0.5, 0.8, 0.5] : [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            filter: isHovered ? 'blur(10px)' : 'blur(8px)',
            transform: 'scale(1.2)',
          }}
        />
        <motion.div
          className="absolute inset-0 rounded-full bg-eco-green-light"
          animate={{
            opacity: isHovered ? [0.3, 0.6, 0.3] : [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.3,
          }}
          style={{
            filter: isHovered ? 'blur(14px)' : 'blur(12px)',
            transform: 'scale(1.4)',
          }}
        />
        
        {/* Chat icon */}
        <motion.div
          className="relative z-10 text-white"
          animate={{
            scale: isHovered ? 1.1 : 1,
          }}
          transition={{
            duration: 0.2,
            ease: "easeOut",
          }}
          style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))' }}
        >
          <ChatIcon />
        </motion.div>

        {/* Tooltip with chatbot name */}
        <motion.div
          className="absolute right-full mr-3 sm:mr-4 bg-gray-900 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap shadow-xl pointer-events-none hidden sm:block flex items-center"
          style={{
            top: '50%',
            marginTop: '-1px', // Fine-tune alignment
          }}
          initial={{ opacity: 0, x: 8, scale: 0.9, y: '-50%' }}
          animate={{ 
            opacity: isHovered ? 1 : 0,
            x: isHovered ? 0 : 8,
            scale: isHovered ? 1 : 0.9,
            y: '-50%'
          }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          EcoBot
          <div 
            className="absolute left-full border-4 border-transparent border-l-gray-900"
            style={{
              top: '50%',
              marginTop: '-4px',
            }}
          ></div>
        </motion.div>
      </motion.button>

      {/* Chatbot Modal */}
      <ChatbotModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};

export default FloatingChatbotButton;
