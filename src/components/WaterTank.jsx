import { useMemo } from 'react';
import './WaterTank.css';

const WaterTank = ({ sensorNumber, value, className = '' }) => {
  // Use mock values for testing if no value provided - different levels for testing
  const mockValues = [35, 72, 88]; // Low, Medium, High for sensors 1, 2, 3
  const displayValue = value !== null && value !== undefined ? value : mockValues[sensorNumber - 1] || 0;
  
  const percentage = Math.max(0, Math.min(100, displayValue));
  
  // Calculate wave position dynamically based on percentage
  // Formula: 0% = 110%, 50% = 57%, 100% = 5%
  // Linear interpolation: position = 110 - (percentage * 1.05)
  const wavePosition = useMemo(() => {
    return 110 - (percentage * 1.05);
  }, [percentage]);
  
  // Calculate clip-path for wave-below - matching original values exactly
  // Original values: _0: 110%, _50: 58%, _100: 15%
  // Wave positions: _0: 110%, _50: 57%, _100: 5%
  // Clip-path defines the TOP edge of the fill, bottom is always at 110%
  // For low percentages, ensure it extends slightly above wave position to eliminate gap
  const clipPathValue = useMemo(() => {
    if (percentage === 0) return 110;
    if (percentage === 100) return 15;
    // Match original interpolation: _0=110%, _50=58%, _100=15%
    if (percentage <= 50) {
      const value = 110 - (percentage / 50) * (110 - 58);
      // For low percentages, ensure clip-path extends slightly above wave position
      // to eliminate any gap - add small buffer for percentages < 30%
      if (percentage < 30) {
        const wavePos = 110 - (percentage * 1.05);
        // Ensure clip-path is slightly above wave position (lower % = higher on screen)
        return Math.min(110, wavePos - 1);
      }
      return value;
    } else {
      return 58 - ((percentage - 50) / 50) * (58 - 15);
    }
  }, [percentage]);
  
  // Get border color based on water level
  const getBorderColor = () => {
    if (percentage < 30) return '#ef4444'; // red-500
    if (percentage < 50) return '#f97316'; // orange-500
    if (percentage < 70) return '#3b82f6'; // blue-500
    return '#10b981'; // green-500
  };
  
  // Round to nearest 0, 50, or 100 for class matching (for text color only)
  const getLevelClass = (percentage) => {
    if (percentage <= 25) return '_0';
    if (percentage <= 75) return '_50';
    return '_100';
  };

  const levelClass = getLevelClass(percentage);
  const borderColor = getBorderColor();

  return (
    <>
      {/* Dynamic keyframes for this sensor - supports any percentage value from 1-100% */}
      <style>{`
        @keyframes fill-wave-${sensorNumber} {
          from {
            background-position: -1200px 110%;
          }
          to {
            background-position: 0% ${wavePosition}%;
          }
        }
        @keyframes wave-dynamic-${sensorNumber} {
          to {
            background-position: 1200px ${wavePosition}%;
          }
        }
        @keyframes fill-below-${sensorNumber} {
          from {
            clip-path: polygon(0% 110%, 0% 110%, 110% 110%, 110% 110%);
          }
          to {
            clip-path: polygon(0% ${clipPathValue}%, 0% 110%, 110% 110%, 110% ${clipPathValue}%);
          }
        }
      `}</style>
      {/* Pure HTML structure exactly as original - no card wrapper */}
      <div className="circle-container" id={`sensor-${sensorNumber}-container`}>
        <div className="circle" style={{ borderColor: borderColor }}></div>
        <div 
          className={`wave ${levelClass}`}
          style={{
            animationName: `fill-wave-${sensorNumber}, wave-dynamic-${sensorNumber}`,
            animationDuration: '5s, 7s',
            animationDelay: '0s, 5s',
            animationFillMode: 'forwards, none',
            animationIterationCount: '1, infinite',
            animationTimingFunction: 'cubic-bezier(0.58, 0.42, 1, 1), cubic-bezier(0, 0, 0.42, 0.58)'
          }}
        ></div>
        <div 
          className={`wave ${levelClass}`}
          style={{
            animationName: `fill-wave-${sensorNumber}, wave-dynamic-${sensorNumber}`,
            animationDuration: '5s, 11s',
            animationDelay: '0s, 5s',
            animationFillMode: 'forwards, none',
            animationIterationCount: '1, infinite',
            animationTimingFunction: 'cubic-bezier(0.58, 0.42, 1, 1), cubic-bezier(0, 0, 0.42, 0.58)'
          }}
        ></div>
        <div 
          className={`wave ${levelClass}`}
          style={{
            animationName: `fill-wave-${sensorNumber}, wave-dynamic-${sensorNumber}`,
            animationDuration: '5s, 13s',
            animationDelay: '0s, 5s',
            animationFillMode: 'forwards, none',
            animationIterationCount: '1, infinite',
            animationTimingFunction: 'cubic-bezier(0.58, 0.42, 1, 1), cubic-bezier(0, 0, 0.42, 0.58)'
          }}
        ></div>
        <div 
          className={`wave-below ${levelClass}`}
          style={{
            clipPath: `polygon(0% ${clipPathValue}%, 0% 110%, 110% 110%, 110% ${clipPathValue}%)`,
            animation: percentage <= 25 
              ? `fill-below-${sensorNumber} 5s cubic-bezier(0.58, 0.42, 1, 1) forwards`
              : percentage <= 75
              ? `fill-below-${sensorNumber} 7s -2s cubic-bezier(0.58, 0.42, 1, 1) forwards`
              : `fill-below-${sensorNumber} 6s -1s cubic-bezier(0.58, 0.42, 1, 1) forwards`
          }}
        ></div>
        <div className={`desc ${levelClass}`}>
          <h2>Sensor {sensorNumber}</h2>
          <p>
            <b>{percentage}<span>%</span></b>
          </p>
        </div>
      </div>
    </>
  );
};

export default WaterTank;
