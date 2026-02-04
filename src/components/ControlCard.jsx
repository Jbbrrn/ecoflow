import { motion } from 'framer-motion';
import MachineSwitch from './MachineSwitch';

const ControlCard = ({ 
  device, 
  icon, 
  title, 
  currentState, 
  status,
  onToggle,
  loading = false 
}) => {
  const isOn = currentState === 'ON' || currentState === 1;
  const isPending = status === 'PENDING';
  const isSuccess = status === 'SUCCESS';
  const isFailed = status === 'FAILED';

  // Get user-friendly description based on device type
  const getDescription = () => {
    if (device === 'pump') {
      return {
        main: 'Manually activate the sprinkler system',
        detail: 'Click the switch to turn on the water pump and start watering your plants through the sprinkler system.',
        action: isOn ? 'Sprinkler is running' : 'Click to start sprinkler'
      };
    } else if (device === 'valve') {
      return {
        main: 'Manually fill the water tank',
        detail: 'Click the switch to open the valve and fill the water tank. This ensures you have enough water for irrigation.',
        action: isOn ? 'Tank is filling' : 'Click to fill tank'
      };
    }
    return {
      main: 'Manual control override',
      detail: 'Use this switch to manually control the system.',
      action: isOn ? 'Active' : 'Inactive'
    };
  };

  // Action text respects status: show "Pending" when loading/pending, not "running/filling"
  const getActionText = () => {
    if (loading || isPending) return 'Pending';
    return getDescription().action;
  };

  const description = getDescription();

  const getStatusColor = () => {
    if (isPending) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (isFailed) return 'text-red-600 bg-red-50 border-red-200';
    if (isSuccess && isOn) return 'text-eco-green-dark bg-eco-green-bg border-eco-green-medium';
    if (isSuccess && !isOn) return 'text-gray-600 bg-gray-50 border-gray-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const getStatusText = () => {
    if (loading) return 'Loading...';
    if (isPending) return 'Pending';
    if (isFailed) return 'Failed';
    if (isSuccess) return isOn ? 'Active' : 'Inactive';
    return 'Unknown';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`relative bg-surface rounded-xl shadow-lg p-6 border-l-4 overflow-visible transition-all duration-300 ${
        isOn && isSuccess 
          ? 'border-l-eco-green-medium shadow-xl shadow-eco-green-medium/20' 
          : 'border-l-eco-green-medium'
      }`}
      whileHover={{ y: -2, shadow: 'xl' }}
    >
      {/* Animated glow effect when ON */}
      {isOn && isSuccess && (
        <motion.div
          className="absolute inset-0 rounded-xl bg-gradient-to-r from-eco-green-medium/10 via-eco-green-medium/5 to-eco-green-medium/10"
          animate={{
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{ zIndex: 0 }}
        />
      )}

      {/* Header */}
      <div className="relative z-10 flex items-start justify-between mb-4">
        <div className="flex items-center gap-4 flex-1">
          <motion.div
            className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
              isOn && isSuccess 
                ? device === 'pump'
                  ? 'bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/50'
                  : 'bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-lg shadow-cyan-500/50'
                : 'bg-eco-green-light'
            }`}
            animate={{
              scale: isOn && isSuccess ? [1, 1.15, 1] : 1,
              rotate: isOn && isSuccess ? [0, 5, -5, 0] : 0,
            }}
            transition={{
              duration: 2,
              repeat: isOn && isSuccess ? Infinity : 0,
              ease: 'easeInOut',
            }}
          >
            {icon}
          </motion.div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-eco-green-dark">{title}</h3>
            <motion.div
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mt-1 border ${getStatusColor()}`}
              initial={false}
              animate={{
                scale: isPending ? [1, 1.05, 1] : 1,
              }}
              transition={{
                duration: 1.5,
                repeat: isPending ? Infinity : 0,
              }}
            >
              <motion.div
                className={`w-2 h-2 rounded-full ${
                  isPending ? 'bg-yellow-600' :
                  isFailed ? 'bg-red-600' :
                  isOn ? 'bg-eco-green-medium' : 'bg-gray-400'
                }`}
                animate={{
                  scale: isPending ? [1, 1.3, 1] : isOn ? [1, 1.3, 1] : 1,
                }}
                transition={{
                  duration: isPending ? 1 : isOn ? 1.5 : 0,
                  repeat: (isPending || isOn) ? Infinity : 0,
                }}
              />
              {getStatusText()}
            </motion.div>
          </div>
        </div>
      </div>

      {/* User-friendly description */}
      <div className="relative z-10 mb-4">
        <p className="text-sm font-semibold text-gray-700 mb-1">{description.main}</p>
        <p className="text-xs text-gray-500 leading-relaxed">{description.detail}</p>
      </div>

      {/* Machine Switch */}
      <div className="relative z-10 flex flex-col items-center justify-center py-6 px-6 border-t border-gray-100 w-full min-h-[180px] overflow-visible">
        <div className="w-full flex flex-col items-center justify-center gap-3">
          <MachineSwitch
            isOn={isOn}
            onToggle={onToggle}
            disabled={loading || isPending}
          />
          {/* Action hint */}
          <motion.p
            className={`text-xs font-medium ${
              (loading || isPending) ? 'text-yellow-600' : isOn ? 'text-eco-green-dark' : 'text-gray-500'
            }`}
            animate={{
              opacity: (loading || isPending) ? [0.7, 1, 0.7] : isOn ? [0.7, 1, 0.7] : 0.7,
            }}
            transition={{
              duration: 2,
              repeat: (loading || isPending) || isOn ? Infinity : 0,
            }}
          >
            {getActionText()}
          </motion.p>
        </div>
      </div>

      {/* Status Info */}
      <div className="relative z-10 mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-start gap-2 text-sm">
          <span className="text-gray-500">Current State:</span>
          <motion.span
            className={`font-semibold ${
              isOn ? 'text-eco-green-dark' : 'text-gray-600'
            }`}
            key={isOn ? 'on' : 'off'}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {isOn ? 'ON' : 'OFF'}
          </motion.span>
        </div>
      </div>
    </motion.div>
  );
};

export default ControlCard;
