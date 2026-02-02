import { motion } from 'framer-motion';
import './Thermometer.css';

const Thermometer = ({ value, unit, progress }) => {
  const displayValue = value != null && value !== '' && value !== '--' ? `${value}${unit}` : `--${unit}`;
  const heightPercent = Math.min(100, Math.max(0, Number(progress) || 0));
  const tempNum = value != null && value !== '' && value !== '--' ? parseFloat(value) : null;
  const isHot = tempNum != null && tempNum >= 30;

  return (
    <div className="thermometer-wrapper">
      <div className={`thermometer ${isHot ? 'thermometer--hot' : 'thermometer--normal'}`}>
        <motion.div
          className="thermometer-mercury"
          data-value={displayValue}
          initial={{ height: '0%' }}
          animate={{ height: `${heightPercent}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
        <div className="thermometer-graduations" aria-hidden="true" />
      </div>
    </div>
  );
};

export default Thermometer;
