import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { apiClient } from '../services/client.js';

const Analytics = () => {
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(24); // hours

  useEffect(() => {
    fetchHistoryData();
  }, [timeRange]);

  const fetchHistoryData = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/data/history?hours=${timeRange}`);
      // The API returns an array directly, not wrapped in a data property
      const data = Array.isArray(response) ? response : [];
      console.log(`Fetched ${data.length} history records for ${timeRange}h range`);
      setHistoryData(data);
    } catch (error) {
      console.error('Error fetching history data:', error);
      console.error('Error details:', error.message);
      setHistoryData([]);
    } finally {
      setLoading(false);
    }
  };

  // Aggregate data by hour for cleaner charts
  const aggregateByHour = (data) => {
    if (!data || data.length === 0) return [];
    
    const hourlyMap = {};
    
    data.forEach(item => {
      const date = new Date(item.timestamp);
      const hourKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
      
      if (!hourlyMap[hourKey]) {
        hourlyMap[hourKey] = {
          timestamp: hourKey,
          soil1: [],
          soil2: [],
          soil3: [],
          temperature: [],
          humidity: []
        };
      }
      
      if (item.soil_moisture_1_percent !== null && item.soil_moisture_1_percent !== undefined) {
        hourlyMap[hourKey].soil1.push(Number(item.soil_moisture_1_percent));
      }
      if (item.soil_moisture_2_percent !== null && item.soil_moisture_2_percent !== undefined) {
        hourlyMap[hourKey].soil2.push(Number(item.soil_moisture_2_percent));
      }
      if (item.soil_moisture_3_percent !== null && item.soil_moisture_3_percent !== undefined) {
        hourlyMap[hourKey].soil3.push(Number(item.soil_moisture_3_percent));
      }
      if (item.air_temperature_celsius !== null && item.air_temperature_celsius !== undefined) {
        hourlyMap[hourKey].temperature.push(Number(item.air_temperature_celsius));
      }
      if (item.air_humidity_percent !== null && item.air_humidity_percent !== undefined) {
        hourlyMap[hourKey].humidity.push(Number(item.air_humidity_percent));
      }
    });
    
    return Object.keys(hourlyMap).map(key => {
      const hour = hourlyMap[key];
      return {
        timestamp: hour.timestamp,
        'Sensor 1': hour.soil1.length > 0 ? Math.round((hour.soil1.reduce((a, b) => a + b, 0) / hour.soil1.length) * 10) / 10 : null,
        'Sensor 2': hour.soil2.length > 0 ? Math.round((hour.soil2.reduce((a, b) => a + b, 0) / hour.soil2.length) * 10) / 10 : null,
        'Sensor 3': hour.soil3.length > 0 ? Math.round((hour.soil3.reduce((a, b) => a + b, 0) / hour.soil3.length) * 10) / 10 : null,
        'Temperature': hour.temperature.length > 0 ? Math.round((hour.temperature.reduce((a, b) => a + b, 0) / hour.temperature.length) * 10) / 10 : null,
        'Humidity': hour.humidity.length > 0 ? Math.round((hour.humidity.reduce((a, b) => a + b, 0) / hour.humidity.length) * 10) / 10 : null
      };
    }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  };

  const chartData = aggregateByHour(historyData);

  // Calculate summary statistics
  const getSummaryStats = () => {
    if (!historyData || historyData.length === 0) return null;

    const latest = historyData[historyData.length - 1];
    const soil1Values = historyData.map(d => d.soil_moisture_1_percent).filter(v => v !== null && v !== undefined);
    const soil2Values = historyData.map(d => d.soil_moisture_2_percent).filter(v => v !== null && v !== undefined);
    const soil3Values = historyData.map(d => d.soil_moisture_3_percent).filter(v => v !== null && v !== undefined);
    const tempValues = historyData.map(d => d.air_temperature_celsius).filter(v => v !== null && v !== undefined);
    const humidityValues = historyData.map(d => d.air_humidity_percent).filter(v => v !== null && v !== undefined);

    const avg = (arr) => arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;
    const min = (arr) => arr.length > 0 ? Math.round(Math.min(...arr) * 10) / 10 : 0;
    const max = (arr) => arr.length > 0 ? Math.round(Math.max(...arr) * 10) / 10 : 0;

    return {
      soil: {
        sensor1: { current: latest?.soil_moisture_1_percent || 0, avg: avg(soil1Values), min: min(soil1Values), max: max(soil1Values) },
        sensor2: { current: latest?.soil_moisture_2_percent || 0, avg: avg(soil2Values), min: min(soil2Values), max: max(soil2Values) },
        sensor3: { current: latest?.soil_moisture_3_percent || 0, avg: avg(soil3Values), min: min(soil3Values), max: max(soil3Values) }
      },
      temperature: { current: latest?.air_temperature_celsius || 0, avg: avg(tempValues), min: min(tempValues), max: max(tempValues) },
      humidity: { current: latest?.air_humidity_percent || 0, avg: avg(humidityValues), min: min(humidityValues), max: max(humidityValues) }
    };
  };

  const stats = getSummaryStats();

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-700 mb-2">{formatTimestamp(label)}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value}${entry.name === 'Temperature' ? '°C' : entry.name === 'Humidity' ? '%' : '%'}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="text-center text-gray-500">Loading analytics data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold text-eco-green-dark mb-2">Analytics Dashboard</h2>
            <p className="text-gray-600">Track your greenhouse environment trends and patterns</p>
          </div>
          <div className="flex gap-2">
            {[12, 24, 48, 72].map((hours) => (
              <button
                key={hours}
                onClick={() => setTimeRange(hours)}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  timeRange === hours
                    ? 'bg-eco-green-medium text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {hours}h
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Soil Moisture Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-lg p-6 border-l-4"
            style={{ borderLeftColor: '#3d860b' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-eco-green-bg rounded-lg flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L10 6H14L12 2Z" stroke="#3d860b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M6 6L8 10H16L18 6H6Z" stroke="#3d860b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8 10L10 14L14 10H8Z" stroke="#3d860b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10 14V18" stroke="#3d860b" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-700">Soil Moisture</h3>
                <p className="text-xs text-gray-500">Optimal: 50% and above</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Sensor 1:</span>
                <span className={`font-semibold ${stats.soil.sensor1.current >= 50 ? 'text-eco-green-dark' : 'text-orange-600'}`}>
                  {stats.soil.sensor1.current}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sensor 2:</span>
                <span className={`font-semibold ${stats.soil.sensor2.current >= 50 ? 'text-eco-green-dark' : 'text-orange-600'}`}>
                  {stats.soil.sensor2.current}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sensor 3:</span>
                <span className={`font-semibold ${stats.soil.sensor3.current >= 50 ? 'text-eco-green-dark' : 'text-orange-600'}`}>
                  {stats.soil.sensor3.current}%
                </span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 leading-relaxed">
                <strong>What this means:</strong> Soil moisture shows how much water is in your soil. 
                Values above 50% mean your plants have enough water. Below 50% means they need watering.
              </p>
            </div>
          </motion.div>

          {/* Temperature Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-lg p-6 border-l-4"
            style={{ borderLeftColor: '#EF4444' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">🌡️</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-700">Temperature</h3>
                <p className="text-xs text-gray-500">Optimal: 20-25°C</p>
              </div>
            </div>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Current:</span>
                <span className={`font-semibold ${
                  stats.temperature.current >= 20 && stats.temperature.current <= 25 
                    ? 'text-eco-green-dark' 
                    : stats.temperature.current >= 15 && stats.temperature.current <= 30
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`}>
                  {stats.temperature.current}°C
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Average:</span>
                <span className="font-semibold text-gray-700">{stats.temperature.avg}°C</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Range:</span>
                <span className="font-semibold text-gray-700">{stats.temperature.min}°C - {stats.temperature.max}°C</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 leading-relaxed">
                <strong>What this means:</strong> Temperature affects plant growth. 
                Most plants grow best between 20-25°C. Too hot or too cold can stress your plants.
              </p>
            </div>
          </motion.div>

          {/* Humidity Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-lg p-6 border-l-4"
            style={{ borderLeftColor: '#3B82F6' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">💧</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-700">Humidity</h3>
                <p className="text-xs text-gray-500">Optimal: 50-70%</p>
              </div>
            </div>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Current:</span>
                <span className={`font-semibold ${
                  stats.humidity.current >= 50 && stats.humidity.current <= 70 
                    ? 'text-eco-green-dark' 
                    : stats.humidity.current >= 40 && stats.humidity.current <= 75
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`}>
                  {stats.humidity.current}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Average:</span>
                <span className="font-semibold text-gray-700">{stats.humidity.avg}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Range:</span>
                <span className="font-semibold text-gray-700">{stats.humidity.min}% - {stats.humidity.max}%</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 leading-relaxed">
                <strong>What this means:</strong> Humidity is the amount of water vapor in the air. 
                Most plants prefer 50-70% humidity. Too low can dry out plants, too high can cause mold.
              </p>
            </div>
          </motion.div>
        </div>
      )}

      {/* Soil Moisture Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-xl shadow-lg p-6"
      >
        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-700 mb-2">Soil Moisture Trends</h3>
          <p className="text-sm text-gray-500">
            Track how soil moisture changes over time. The green line shows the optimal level (50%).
            All three sensors should stay above this line for healthy plants.
          </p>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis 
                dataKey="timestamp" 
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => formatTimestamp(value)}
              />
              <YAxis 
                label={{ value: 'Moisture %', angle: -90, position: 'insideLeft' }}
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <ReferenceLine y={50} stroke="#3d860b" strokeDasharray="5 5" label={{ value: "Optimal (50%)", position: "topRight" }} />
              <Line type="monotone" dataKey="Sensor 1" stroke="#43a047" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Sensor 2" stroke="#1e88e5" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Sensor 3" stroke="#ff9800" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-96 flex items-center justify-center text-gray-500">
            No data available for the selected time range
          </div>
        )}
      </motion.div>

      {/* Temperature & Humidity Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-xl shadow-lg p-6"
      >
        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-700 mb-2">Temperature & Humidity Trends</h3>
          <p className="text-sm text-gray-500">
            See how temperature (red) and humidity (blue) change together. 
            Temperature is measured in Celsius (°C) on the left, humidity in percentage (%) on the right.
            These two factors work together to create the perfect growing environment.
          </p>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis 
                dataKey="timestamp" 
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => formatTimestamp(value)}
              />
              <YAxis 
                yAxisId="left"
                label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft' }}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                label={{ value: 'Humidity (%)', angle: 90, position: 'insideRight' }}
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="Temperature" stroke="#f44336" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="Humidity" stroke="#2196f3" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-96 flex items-center justify-center text-gray-500">
            No data available for the selected time range
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Analytics;
