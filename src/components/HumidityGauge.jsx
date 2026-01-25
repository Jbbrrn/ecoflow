import { motion } from 'framer-motion';
import './HumidityGauge.css';

const HumidityGauge = ({ value, unit, progress }) => {
  const displayValue = value != null && value !== '' && value !== '--' ? parseFloat(value) : 0;
  const percentage = Math.min(100, Math.max(0, displayValue));
  
  // Use blue color for all humidity levels
  const gaugeColor = '#3B82F6'; // Blue color
  const circumference = 2 * Math.PI * 70; // radius = 70 (increased from 60)
  const offset = circumference - (percentage / 100) * circumference;
  
  return (
    <div className="humidity-meter-wrapper">
      <div className="humidity-meter-container">
        <svg className="humidity-meter-svg" viewBox="0 0 180 180">
          <defs>
            {/* Subtle glow filter - more contained */}
            <filter id="humidity-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* Background circle */}
          <circle
            cx="90"
            cy="90"
            r="70"
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="12"
          />
          
          {/* Blue progress circle with subtle glow */}
          <motion.circle
            className="humidity-progress-circle"
            cx="90"
            cy="90"
            r="70"
            fill="none"
            stroke={gaugeColor}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ 
              strokeDashoffset: offset
            }}
            transition={{ 
              strokeDashoffset: { duration: 1.2, ease: 'easeOut' }
            }}
            transform="rotate(-90 90 90)"
            filter="url(#humidity-glow)"
          />
        </svg>
        
        {/* Center content */}
        <div className="humidity-meter-center">
          <motion.div
            key={displayValue}
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="humidity-meter-value"
            style={{ color: gaugeColor }}
          >
            {displayValue.toFixed(1)}{unit}
          </motion.div>
          <div className="humidity-meter-label">Humidity</div>
        </div>
      </div>
    </div>
  );
};

export default HumidityGauge;
