import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import DashboardSidebar from '../components/DashboardSidebar';
import SensorCard from '../components/SensorCard';
import WaterTank from '../components/WaterTank';
import ControlCard from '../components/ControlCard';
import PlantConditionSummary from '../components/PlantConditionSummary';
import Analytics from '../components/Analytics';
import FloatingChatbotButton from '../components/FloatingChatbotButton';
import { apiClient } from '../services/client.js';
import '../components/WaterTank.css';

const GardenerDashboard = () => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [sensorData, setSensorData] = useState({
    air_temperature_celsius: null,
    air_humidity_percent: null,
    soil_moisture_1_percent: null,
    soil_moisture_2_percent: null,
    soil_moisture_3_percent: null,
    valve_status: 0,
    pump_status: 0,
    water_level_low_status: 0,
    water_level_high_status: 0,
    timestamp: null,
  });
  const [loading, setLoading] = useState(true);
  const [commandStatus, setCommandStatus] = useState({
    pump: null,
    valve: null,
  });
  const [commandLoading, setCommandLoading] = useState({
    pump: false,
    valve: false,
  });
  const navigate = useNavigate();

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('userToken');
    if (!token) {
      navigate('/');
      return;
    }

    fetchSensorData();
    fetchCommandStatus();
    const sensorInterval = setInterval(fetchSensorData, 30000); // Update every 30 seconds
    const commandInterval = setInterval(fetchCommandStatus, 10000); // Update every 10 seconds

    return () => {
      clearInterval(sensorInterval);
      clearInterval(commandInterval);
    };
  }, [navigate]);

  const fetchSensorData = async () => {
    try {
      const data = await apiClient.getData('latest');
      setSensorData(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch sensor data:', error);
      setLoading(false);
    }
  };

  const fetchCommandStatus = async () => {
    try {
      const status = await apiClient.getCommandStatus();
      setCommandStatus(status);
    } catch (error) {
      console.error('Failed to fetch command status:', error);
    }
  };

  const handleToggle = async (device) => {
    // Prevent multiple simultaneous toggles
    if (commandLoading[device] || commandStatus[device]?.status === 'PENDING') {
      return;
    }

    const currentState = getDeviceState(device);
    const newState = currentState === 'ON' ? 'OFF' : 'ON';

    // Set loading state immediately
    setCommandLoading(prev => ({ ...prev, [device]: true }));

    // Optimistically update UI
    setCommandStatus(prev => ({
      ...prev,
      [device]: {
        ...prev[device],
        desired_state: newState,
        status: 'PENDING',
        requested_at: new Date().toISOString(),
      },
    }));

    try {
      const response = await apiClient.sendCommand(device, newState);
      
      // Update with server response
      setCommandStatus(prev => ({
        ...prev,
        [device]: {
          ...prev[device],
          ...response,
          desired_state: newState,
          status: 'PENDING',
        },
      }));

      // Poll for status updates
      let pollCount = 0;
      const maxPolls = 10; // 10 seconds max
      const pollInterval = setInterval(async () => {
        pollCount++;
        try {
          const status = await apiClient.getCommandStatus();
          const deviceStatus = status[device];
          
          if (deviceStatus?.status === 'SUCCESS' || deviceStatus?.status === 'FAILED' || pollCount >= maxPolls) {
            clearInterval(pollInterval);
            setCommandStatus(prev => ({
              ...prev,
              [device]: deviceStatus,
            }));
            setCommandLoading(prev => ({ ...prev, [device]: false }));
          } else {
            setCommandStatus(prev => ({
              ...prev,
              [device]: deviceStatus,
            }));
          }
        } catch (error) {
          console.error(`Error polling status for ${device}:`, error);
          if (pollCount >= maxPolls) {
            clearInterval(pollInterval);
            setCommandLoading(prev => ({ ...prev, [device]: false }));
          }
        }
      }, 1000);

    } catch (error) {
      console.error(`Failed to toggle ${device}:`, error);
      
      // Revert optimistic update on error
      setCommandStatus(prev => ({
        ...prev,
        [device]: prev[device] || null,
      }));
      
      // Show user-friendly error message
      alert(`Failed to toggle ${device}: ${error.message || 'Please try again'}`);
      setCommandLoading(prev => ({ ...prev, [device]: false }));
    }
  };

  const getDeviceState = (device) => {
    const command = commandStatus[device];
    if (command?.actual_state) {
      return command.actual_state;
    }
    if (command?.desired_state) {
      return command.desired_state;
    }
    // Fallback to sensor data
    if (device === 'pump') {
      return sensorData.pump_status === 1 ? 'ON' : 'OFF';
    }
    return sensorData.valve_status === 1 ? 'ON' : 'OFF';
  };

  const getDeviceStatus = (device) => {
    const command = commandStatus[device];
    return command?.status || null;
  };

  // Helper function to safely convert to number
  const toNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    return isNaN(num) ? null : num;
  };

  // Helper function to safely format number with toFixed
  const formatNumber = (value, decimals = 1) => {
    const num = toNumber(value);
    return num !== null ? num.toFixed(decimals) : '--';
  };

  const getTemperatureStatus = (value) => {
    const num = toNumber(value);
    if (num === null) return 'No data';
    if (num < 10) return 'Cold';
    if (num < 20) return 'Cool';
    if (num < 30) return 'Optimal';
    if (num < 35) return 'Warm';
    return 'Hot - Monitor';
  };

  const getHumidityStatus = (value) => {
    const num = toNumber(value);
    if (num === null) return 'No data';
    if (num < 30) return 'Low Humidity';
    if (num < 60) return 'Optimal';
    if (num < 80) return 'High Humidity';
    return 'Very High Humidity';
  };

  const getSoilMoistureStatus = (value) => {
    const num = toNumber(value);
    if (num === null) return 'unknown';
    if (num < 20) return 'low';
    if (num < 40) return 'medium';
    if (num < 70) return 'good';
    return 'excellent';
  };

  const tempValue = toNumber(sensorData.air_temperature_celsius);
  const tempPercent =
    tempValue !== null
      ? Math.min(100, Math.max(0, (tempValue / 50) * 100))
      : 0;

  return (
    <div className="flex h-screen bg-eco-green-bg overflow-hidden">
      <DashboardSidebar activeSection={activeSection} onSectionChange={setActiveSection} />

      <main className="flex-1 dashboard-main-content overflow-y-auto">
        <header className="bg-white shadow-sm p-6">
          <h1 className="text-3xl font-bold text-eco-green-dark">Welcome to Eco Flow Dashboard</h1>
        </header>

        <div className="p-6">
          {activeSection === 'dashboard' && (
            <div className="space-y-6">
              {/* Soil Moisture Sensors Card Container */}
              <div className="sensors-card-container">
                <div className="sensors-card-title">
                  SOIL MOISTURE CONTENT PERCENTAGE
                </div>
                <div className="sensors-wrapper">
                  {/* Soil Moisture Sensor 1 - Water Tank */}
                  <WaterTank
                    sensorNumber={1}
                    value={toNumber(sensorData.soil_moisture_1_percent)}
                  />

                  {/* Soil Moisture Sensor 2 - Water Tank */}
                  <WaterTank
                    sensorNumber={2}
                    value={toNumber(sensorData.soil_moisture_2_percent)}
                  />

                  {/* Soil Moisture Sensor 3 - Water Tank */}
                  <WaterTank
                    sensorNumber={3}
                    value={toNumber(sensorData.soil_moisture_3_percent)}
                  />
                </div>
              </div>

              {/* Sensor Cards Grid with System Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Air Temperature — thermometer visual driven by actual 0–50°C */}
                <SensorCard
                  title="AIR TEMPERATURE"
                  value={formatNumber(sensorData.air_temperature_celsius)}
                  status={getTemperatureStatus(sensorData.air_temperature_celsius)}
                  unit="°C"
                  progress={tempPercent}
                  scaleMax={50}
                  visual="thermometer"
                />

                {/* Air Humidity */}
                <SensorCard
                  title="AIR HUMIDITY"
                  value={formatNumber(sensorData.air_humidity_percent)}
                  status={getHumidityStatus(sensorData.air_humidity_percent)}
                  unit="%"
                  progress={toNumber(sensorData.air_humidity_percent) || 0}
                  scaleMax={100}
                  visual="humidity"
                />

                {/* System Status - Now in the third column */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
                  className="bg-white rounded-xl shadow-lg overflow-hidden relative h-full flex flex-col"
                >
                  {/* Green accent strip at top */}
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: 0.4 }}
                    className="h-1 bg-gradient-to-r from-eco-green-light via-eco-green-medium to-eco-green-light origin-left"
                  ></motion.div>
                  
                  <div className="p-6 flex flex-col flex-1">
                    {/* Title */}
                    <motion.h2
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: 0.5 }}
                      className="text-2xl font-bold text-gray-700 uppercase tracking-wide mb-6 text-center"
                    >
                      System Status
                    </motion.h2>
                    
                    {/* Status Cards Grid */}
                    <div className="grid grid-cols-1 gap-3 flex-1">
                      {/* Irrigation Valve */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, delay: 0.6 }}
                        className="bg-gray-50 rounded-lg p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative group cursor-help"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Irrigation Valve</span>
                          <div className="flex items-center gap-2">
                            <motion.div
                              animate={{
                                opacity: sensorData.valve_status === 1 ? [1, 0.3, 1] : 1,
                              }}
                              transition={{
                                duration: 1,
                                repeat: sensorData.valve_status === 1 ? Infinity : 0,
                                ease: 'easeInOut',
                              }}
                              className={`w-3 h-3 rounded-full ${
                                sensorData.valve_status === 1 ? 'bg-eco-green-medium' : 'bg-gray-400'
                              }`}
                            />
                            <span className="text-xs text-gray-600 font-medium min-w-[60px] text-left">
                              {sensorData.valve_status === 1 ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                          For the water filling the tank
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                            <div className="border-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      </motion.div>
                      
                      {/* Water Pump */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, delay: 0.7 }}
                        className="bg-gray-50 rounded-lg p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative group cursor-help"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Water Pump</span>
                          <div className="flex items-center gap-2">
                            <motion.div
                              animate={{
                                opacity: sensorData.pump_status === 1 ? [1, 0.3, 1] : 1,
                              }}
                              transition={{
                                duration: 1,
                                repeat: sensorData.pump_status === 1 ? Infinity : 0,
                                ease: 'easeInOut',
                              }}
                              className={`w-3 h-3 rounded-full ${
                                sensorData.pump_status === 1 ? 'bg-eco-green-medium' : 'bg-gray-400'
                              }`}
                            />
                            <span className="text-xs text-gray-600 font-medium min-w-[60px] text-left">
                              {sensorData.pump_status === 1 ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 max-w-xs text-center">
                          An indicator when the manual control is triggered to water the plants through the sprinkler
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                            <div className="border-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      </motion.div>
                      
                      {/* Water Level Status */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, delay: 0.8 }}
                        className="bg-gray-50 rounded-lg p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative group cursor-help"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Water Level Status</span>
                          <div className="flex items-center gap-2">
                            <motion.div
                              animate={{
                                opacity: sensorData.water_level_low_status === 0 ? [1, 0.3, 1] : 1,
                              }}
                              transition={{
                                duration: 1,
                                repeat: sensorData.water_level_low_status === 0 ? Infinity : 0,
                                ease: 'easeInOut',
                              }}
                              className={`w-3 h-3 rounded-full ${
                                sensorData.water_level_low_status === 1 ? 'bg-red-500' : 'bg-eco-green-medium'
                              }`}
                            />
                            <span className="text-xs text-gray-600 font-medium min-w-[60px] text-left">
                              {sensorData.water_level_low_status === 1 ? 'Low' : 'OK'}
                            </span>
                          </div>
                        </div>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 max-w-xs text-center">
                          Indicates if the water level in the tank is low and needs refilling
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                            <div className="border-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      </motion.div>
                      
                      {/* Water Tank Level */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, delay: 0.9 }}
                        className="bg-gray-50 rounded-lg p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative group cursor-help"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Water Tank Level</span>
                          <div className="flex items-center gap-2">
                            <motion.div
                              animate={{
                                opacity: sensorData.water_level_high_status === 1 ? [1, 0.3, 1] : 1,
                              }}
                              transition={{
                                duration: 1,
                                repeat: sensorData.water_level_high_status === 1 ? Infinity : 0,
                                ease: 'easeInOut',
                              }}
                              className={`w-3 h-3 rounded-full ${
                                sensorData.water_level_high_status === 1 ? 'bg-eco-green-medium' : 'bg-gray-400'
                              }`}
                            />
                            <span className="text-xs text-gray-600 font-medium min-w-[60px] text-left">
                              {sensorData.water_level_high_status === 1 ? 'Full' : 'Not Full'}
                            </span>
                          </div>
                        </div>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 max-w-xs text-center">
                          Shows the current water level status of the tank (Full or Not Full)
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                            <div className="border-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Plant Condition Summary - Below the three cards */}
              <PlantConditionSummary sensorData={sensorData} />

              {loading && (
                <div className="text-center text-gray-500">Loading sensor data...</div>
              )}
            </div>
          )}

          {activeSection === 'analytics' && (
            <Analytics />
          )}

          {activeSection === 'controls' && (
            <div className="space-y-6">
              {/* Header Section with Instructions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-l-eco-green-medium"
              >
                <h2 className="text-2xl font-bold text-eco-green-dark mb-3">Manual Controls</h2>
                <div className="space-y-3">
                  <p className="text-gray-700 leading-relaxed">
                    <strong>What are Manual Controls?</strong> Manual controls allow you to override the automatic irrigation system 
                    and manually operate the water pump and valve when needed. This is useful for testing, maintenance, or when you 
                    want to water your plants immediately.
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800 font-semibold mb-2">📋 How to Use:</p>
                    <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                      <li>Click the toggle switch on any control card to turn it ON or OFF</li>
                      <li>The switch will show "Active" when the device is running</li>
                      <li>Monitor the status indicator to see if the command was successful</li>
                      <li>Remember to turn OFF manual controls when done to return to automatic mode</li>
                    </ol>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-eco-green-medium"></span>
                      <span className="text-gray-600"><strong>Green:</strong> Device is active and running</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                      <span className="text-gray-600"><strong>Yellow:</strong> Command is pending</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-gray-400"></span>
                      <span className="text-gray-600"><strong>Gray:</strong> Device is inactive</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Water Pump Control */}
                <ControlCard
                  device="pump"
                  icon="🚰"
                  title="Water Pump"
                  currentState={getDeviceState('pump')}
                  status={getDeviceStatus('pump')}
                  onToggle={() => handleToggle('pump')}
                  loading={commandLoading.pump}
                />

                {/* Solenoid Valve Control */}
                <ControlCard
                  device="valve"
                  icon="💧"
                  title="Solenoid Valve"
                  currentState={getDeviceState('valve')}
                  status={getDeviceStatus('valve')}
                  onToggle={() => handleToggle('valve')}
                  loading={commandLoading.valve}
                />
              </div>
            </div>
          )}
        </div>
      </main>
      
      {/* Floating Chatbot Button - Always visible */}
      <FloatingChatbotButton />
    </div>
  );
};

export default GardenerDashboard;
