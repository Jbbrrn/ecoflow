import { motion } from 'framer-motion';
import Thermometer from './Thermometer';
import HumidityGauge from './HumidityGauge';

const SensorCard = ({ title, value, status, unit, progress, scaleMax = 100, trendIcon = '→', visual = 'bar' }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface rounded-xl shadow-lg p-6 border-l-4 border-l-eco-green-medium"
    >
      <div className="mb-4">
        <div className="text-sm font-semibold text-gray-600 mb-2">{title}</div>
        <motion.div
          key={value}
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-4xl font-bold text-eco-green-dark mb-2"
        >
          {value !== null && value !== undefined ? `${value}${unit}` : '--'}
        </motion.div>
        <div className="flex items-center gap-2 text-sm" style={{ color: '#3d860b' }}>
          <span>{trendIcon}</span>
          <span>{status}</span>
        </div>
      </div>

      {visual === 'thermometer' ? (
        <>
          <Thermometer value={value} unit={unit} progress={progress} />
        </>
      ) : visual === 'humidity' ? (
        <>
          <HumidityGauge value={value} unit={unit} progress={progress} />
        </>
      ) : (
        <>
          {/* Vertical bar graph — shows current value within scale */}
          <div className="mt-4 flex items-end gap-3">
            <div className="flex flex-col justify-between text-xs font-medium text-gray-500 h-28">
              <span>{scaleMax}{unit}</span>
              <span>0</span>
            </div>
            <div className="flex-1 h-28 bg-gray-100 rounded-lg overflow-hidden flex flex-col justify-end min-w-[3rem]">
              <motion.div
                className="w-full min-h-[4px] bg-gradient-to-t from-eco-green-medium to-eco-green-light rounded-t"
                initial={{ height: 0 }}
                animate={{ height: `${Math.min(100, Math.max(0, progress || 0))}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Scale: 0 – {scaleMax}{unit}</p>
        </>
      )}
    </motion.div>
  );
};

export default SensorCard;
