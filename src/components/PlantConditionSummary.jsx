import { motion } from 'framer-motion';
import { useMemo } from 'react';

// SVG Icon Components
const PlantIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 2L8 6H12L10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 6L8 10H12L14 6H6Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8 10L10 14L12 10H8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 14V18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13.5 4L6 11.5L2.5 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const WarningIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 2L2 14H14L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8 9V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="8" cy="13" r="0.5" fill="currentColor"/>
  </svg>
);

const CrossIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PlantConditionSummary = ({ sensorData }) => {
  // Calculate overall health score and condition
  const plantCondition = useMemo(() => {
    const temp = parseFloat(sensorData.air_temperature_celsius) || 0;
    const humidity = parseFloat(sensorData.air_humidity_percent) || 0;
    const soil1 = parseFloat(sensorData.soil_moisture_1_percent) || 0;
    const soil2 = parseFloat(sensorData.soil_moisture_2_percent) || 0;
    const soil3 = parseFloat(sensorData.soil_moisture_3_percent) || 0;
    
    // Score each parameter (0-100)
    let tempScore = 100;
    if (temp < 10 || temp > 35) tempScore = 40;
    else if (temp < 15 || temp > 30) tempScore = 70;
    else if (temp >= 20 && temp <= 25) tempScore = 100;
    
    let humidityScore = 100;
    if (humidity < 30 || humidity > 85) humidityScore = 50;
    else if (humidity < 40 || humidity > 75) humidityScore = 75;
    else if (humidity >= 50 && humidity <= 70) humidityScore = 100;
    
    // Average soil moisture
    // Optimal: 50% and above, Below 50% needs watering
    const avgSoil = (soil1 + soil2 + soil3) / 3;
    let soilScore = 100;
    if (avgSoil < 50) {
      // Below 50% needs watering
      if (avgSoil < 30) soilScore = 40; // Very dry
      else if (avgSoil < 40) soilScore = 60; // Dry
      else soilScore = 75; // Slightly below optimal
    } else {
      // 50% and above is optimal
      if (avgSoil > 80) soilScore = 85; // Too wet but still acceptable
      else soilScore = 100; // Optimal range (50-80%)
    }
    
    // Calculate overall score (weighted average)
    const overallScore = Math.round((tempScore * 0.3 + humidityScore * 0.3 + soilScore * 0.4));
    
    // Determine condition
    let condition = 'Good';
    let conditionColor = '#3d860b'; // Green
    let ConditionIcon = PlantIcon;
    
    if (overallScore >= 80) {
      condition = 'Good';
      conditionColor = '#3d860b';
      ConditionIcon = PlantIcon;
    } else if (overallScore >= 60) {
      condition = 'Fair';
      conditionColor = '#F59E0B';
      ConditionIcon = WarningIcon;
    } else {
      condition = 'Needs Attention';
      conditionColor = '#EF4444';
      ConditionIcon = CrossIcon;
    }
    
    // Get individual statuses
    const getTempStatus = () => {
      if (temp >= 20 && temp <= 25) return { status: 'Optimal range', Icon: CheckIcon, color: '#3d860b' };
      if (temp >= 15 && temp <= 30) return { status: 'Acceptable', Icon: WarningIcon, color: '#F59E0B' };
      return { status: 'Out of range', Icon: CrossIcon, color: '#EF4444' };
    };
    
    const getHumidityStatus = () => {
      if (humidity >= 50 && humidity <= 70) return { status: 'Optimal range', Icon: CheckIcon, color: '#3d860b' };
      if (humidity >= 40 && humidity <= 75) return { status: 'Monitor closely', Icon: WarningIcon, color: '#F59E0B' };
      return { status: 'Monitor closely', Icon: WarningIcon, color: '#F59E0B' };
    };
    
    const getSoilStatus = () => {
      const sensors = [soil1, soil2, soil3].filter(s => s > 0);
      // Below 50% needs watering, 50% and above is optimal
      const needsWatering = sensors.filter(s => s < 50).length;
      const tooWet = sensors.filter(s => s > 80).length;
      
      // If all sensors are 50% and above, it's normal/optimal
      if (needsWatering === 0 && tooWet === 0 && sensors.length === 3) {
        return { status: 'Normal', Icon: CheckIcon, color: '#3d860b' };
      }
      if (needsWatering === 0 && tooWet === 0) {
        return { status: 'All sensors optimal', Icon: CheckIcon, color: '#3d860b' };
      }
      if (needsWatering === 1) {
        return { status: '1 sensor needs watering', Icon: WarningIcon, color: '#F59E0B' };
      }
      if (needsWatering > 1) {
        return { status: `${needsWatering} sensors need watering`, Icon: CrossIcon, color: '#EF4444' };
      }
      if (tooWet > 0) {
        return { status: 'Some sensors too wet', Icon: WarningIcon, color: '#F59E0B' };
      }
      return { status: 'Normal', Icon: CheckIcon, color: '#3d860b' };
    };
    
    // Get attention items
    const attentionItems = [];
    if (humidity > 85) attentionItems.push('Humidity very high');
    if (humidity < 30) attentionItems.push('Humidity very low');
    if (temp > 35) attentionItems.push('Temperature too high');
    if (temp < 10) attentionItems.push('Temperature too low');
    
    // Soil moisture: Below 50% needs watering
    const drySensors = [soil1, soil2, soil3].filter(s => s > 0 && s < 50).length;
    const wetSensors = [soil1, soil2, soil3].filter(s => s > 80).length;
    
    if (drySensors > 0) {
      attentionItems.push(`${drySensors} sensor(s) below 50% - needs watering`);
    }
    if (wetSensors > 0) {
      attentionItems.push(`${wetSensors} sensor(s) too wet`);
    }
    
    return {
      overallScore,
      condition,
      conditionColor,
      ConditionIcon,
      tempStatus: getTempStatus(),
      humidityStatus: getHumidityStatus(),
      soilStatus: getSoilStatus(),
      attentionItems,
      temp,
      humidity,
      avgSoil: Math.round(avgSoil),
      soil1,
      soil2,
      soil3
    };
  }, [sensorData]);
  
  const { ConditionIcon } = plantCondition;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="bg-white rounded-xl shadow-lg p-6 border-l-4"
      style={{ borderLeftColor: plantCondition.conditionColor }}
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-700 uppercase tracking-wide">
          Plant Condition Summary
        </h2>
        <div className="flex items-center gap-2">
          <div style={{ color: plantCondition.conditionColor }}>
            <ConditionIcon />
          </div>
          <span className="text-lg font-semibold" style={{ color: plantCondition.conditionColor }}>
            Plants are in {plantCondition.condition.toLowerCase()} condition
          </span>
        </div>
      </div>
      
      {/* Overall Health Score */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
            Overall Health Score
          </span>
          <span className="text-3xl font-bold text-gray-800">{plantCondition.overallScore}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${plantCondition.overallScore}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ 
              background: `linear-gradient(to right, ${plantCondition.conditionColor}, ${plantCondition.conditionColor}dd)`
            }}
          />
        </div>
      </div>
      
      {/* Detailed Conditions */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <div style={{ color: plantCondition.tempStatus.color }}>
              {(() => {
                const Icon = plantCondition.tempStatus.Icon;
                return <Icon />;
              })()}
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-700">Temperature</span>
              <p className="text-xs text-gray-500">{plantCondition.tempStatus.status}</p>
            </div>
          </div>
          <span className="text-sm font-semibold text-gray-700">{plantCondition.temp.toFixed(1)}°C</span>
        </div>
        
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <div style={{ color: plantCondition.humidityStatus.color }}>
              {(() => {
                const Icon = plantCondition.humidityStatus.Icon;
                return <Icon />;
              })()}
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-700">Humidity</span>
              <p className="text-xs text-gray-500">{plantCondition.humidityStatus.status}</p>
            </div>
          </div>
          <span className="text-sm font-semibold text-gray-700">{plantCondition.humidity.toFixed(1)}%</span>
        </div>
        
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <div style={{ color: plantCondition.soilStatus.color }}>
              {(() => {
                const Icon = plantCondition.soilStatus.Icon;
                return <Icon />;
              })()}
            </div>
            <div className="flex-1">
              <span className="text-sm font-semibold text-gray-700">Soil Moisture</span>
              <p className="text-xs text-gray-500">{plantCondition.soilStatus.status}</p>
              <div className="flex gap-4 mt-1">
                <span className="text-xs text-gray-600">
                  Sensor 1: <span className="font-semibold">{plantCondition.soil1 > 0 ? `${plantCondition.soil1.toFixed(0)}%` : '--'}</span>
                </span>
                <span className="text-xs text-gray-600">
                  Sensor 2: <span className="font-semibold">{plantCondition.soil2 > 0 ? `${plantCondition.soil2.toFixed(0)}%` : '--'}</span>
                </span>
                <span className="text-xs text-gray-600">
                  Sensor 3: <span className="font-semibold">{plantCondition.soil3 > 0 ? `${plantCondition.soil3.toFixed(0)}%` : '--'}</span>
                </span>
              </div>
            </div>
          </div>
          <span className="text-sm font-semibold text-gray-700">{plantCondition.avgSoil}%</span>
        </div>
      </div>
      
      {/* Attention Needed */}
      {plantCondition.attentionItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.3 }}
          className="bg-red-50 border border-red-200 rounded-lg p-4"
        >
          <div className="flex items-start gap-2">
            <div style={{ color: '#F59E0B' }}>
              <WarningIcon />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-800 mb-2">Attention Needed</h4>
              <ul className="space-y-1">
                {plantCondition.attentionItems.map((item, index) => (
                  <li key={index} className="text-xs text-red-700">• {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default PlantConditionSummary;
