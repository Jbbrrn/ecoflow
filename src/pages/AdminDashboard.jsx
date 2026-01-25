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

const AdminDashboard = () => {
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
  // Reports state
  const [reportType, setReportType] = useState('device-commands');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportError, setReportError] = useState(null);
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

  const formatNumber = (value) => {
    if (value === null || value === undefined) return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num.toFixed(1);
  };

  const toNumber = (value) => {
    if (value === null || value === undefined) return 0;
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  };

  const getTemperatureStatus = (temp) => {
    const t = toNumber(temp);
    if (t >= 20 && t <= 25) return 'Optimal';
    if (t >= 15 && t <= 30) return 'Acceptable';
    return 'Out of range';
  };

  const getHumidityStatus = (humidity) => {
    const h = toNumber(humidity);
    if (h >= 50 && h <= 70) return 'Optimal range';
    if (h >= 40 && h <= 75) return 'Monitor closely';
    if (h > 85) return 'Very High Humidity';
    return 'Monitor closely';
  };

  const tempValue = toNumber(sensorData.air_temperature_celsius);
  const tempPercent =
    tempValue !== null
      ? Math.min(100, Math.max(0, (tempValue / 50) * 100))
      : 0;

  // Reports functions
  const handleGenerateReport = async () => {
    setReportLoading(true);
    setReportError(null);
    setReportData(null);

    try {
      const token = localStorage.getItem('userToken');
      if (!token) {
        setReportError('Please login to generate reports.');
        setReportLoading(false);
        return;
      }

      let url = `/api/reports/${reportType}?`;
      const params = new URLSearchParams();
      
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      // Add default time ranges for reports that need them
      if (!startDate && !endDate) {
        if (reportType === 'system-health') {
          params.append('days', '7');
        } else if (reportType === 'sensor-summary') {
          params.append('hours', '24');
        } else if (reportType === 'water-usage') {
          params.append('days', '7');
        }
      }

      url += params.toString();

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          if (errorText) errorMessage += ` - ${errorText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setReportData(data);
    } catch (error) {
      console.error('Error generating report:', error);
      setReportError(error.message || 'Failed to generate report. Please try again.');
    } finally {
      setReportLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!reportData) {
      alert('Please generate a report first.');
      return;
    }

    try {
      let csvContent = '';
      let filename = '';

      // Helper function to escape CSV values
      const escapeCSV = (value) => {
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        // If value contains comma, quote, or newline, wrap in quotes and escape quotes
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      };

      if (reportType === 'device-commands') {
        const { commands, summary } = reportData;
        
        // CSV Header with metadata
        csvContent = 'Device Commands Report\n';
        csvContent += `Generated,${new Date().toLocaleString()}\n`;
        if (startDate) csvContent += `Start Date,${startDate}\n`;
        if (endDate) csvContent += `End Date,${endDate}\n`;
        csvContent += '\n';
        
        // Summary Section
        csvContent += 'Summary\n';
        csvContent += `Total Commands,${summary?.total || 0}\n`;
        csvContent += `Success Rate,${summary?.success_rate || 0}%\n`;
        csvContent += `Avg Execution Time,${summary?.avg_execution_time || 0}s\n`;
        csvContent += '\n';
        
        // Breakdown by Device
        if (summary?.by_device && Object.keys(summary.by_device).length > 0) {
          csvContent += 'By Device\n';
          csvContent += 'Device,Count\n';
          Object.entries(summary.by_device).forEach(([device, count]) => {
            csvContent += `${escapeCSV(device.charAt(0).toUpperCase() + device.slice(1))},${count}\n`;
          });
          csvContent += '\n';
        }
        
        // Breakdown by Status
        if (summary?.by_status && Object.keys(summary.by_status).length > 0) {
          csvContent += 'By Status\n';
          csvContent += 'Status,Count\n';
          Object.entries(summary.by_status).forEach(([status, count]) => {
            csvContent += `${escapeCSV(status)},${count}\n`;
          });
          csvContent += '\n';
        }
        
        // Breakdown by User
        if (summary?.by_user && Object.keys(summary.by_user).length > 0) {
          csvContent += 'By User\n';
          csvContent += 'User,Role,Commands\n';
          Object.entries(summary.by_user).forEach(([user, info]) => {
            csvContent += `${escapeCSV(info.username)},${escapeCSV(info.role)},${info.count}\n`;
          });
          csvContent += '\n';
        }
        
        // Commands Data
        if (commands && commands.length > 0) {
          csvContent += 'Commands\n';
          const headers = ['Time', 'Device', 'Desired State', 'Actual State', 'Status', 'User', 'Execution Time (s)'];
          csvContent += headers.map(h => escapeCSV(h)).join(',') + '\n';
          
          commands.forEach(cmd => {
            const row = [
              new Date(cmd.requested_at).toLocaleString(),
              cmd.device || 'N/A',
              cmd.desired_state || 'N/A',
              cmd.actual_state || 'N/A',
              cmd.status || 'N/A',
              cmd.username || 'Unknown',
              cmd.execution_time_seconds || 'N/A'
            ];
            csvContent += row.map(cell => escapeCSV(cell)).join(',') + '\n';
          });
        }
        
        filename = `device-commands-report-${new Date().toISOString().split('T')[0]}.csv`;
      } else if (reportType === 'user-activity') {
        // User Activity Report CSV
        csvContent = 'User Activity Report\n';
        csvContent += `Generated,${new Date().toLocaleString()}\n`;
        if (startDate) csvContent += `Start Date,${startDate}\n`;
        if (endDate) csvContent += `End Date,${endDate}\n`;
        csvContent += '\n';
        
        const headers = ['User', 'Email', 'Role', 'Status', 'Total Commands', 'Successful', 'Failed', 'Pending', 'First Command', 'Last Command'];
        csvContent += headers.map(h => escapeCSV(h)).join(',') + '\n';
        
        if (Array.isArray(reportData)) {
          reportData.forEach(user => {
            const row = [
              user.username || 'N/A',
              user.email || 'N/A',
              user.user_role || 'N/A',
              user.is_active ? 'Active' : 'Inactive',
              user.total_commands || 0,
              user.successful_commands || 0,
              user.failed_commands || 0,
              user.pending_commands || 0,
              user.first_command ? new Date(user.first_command).toLocaleString() : 'N/A',
              user.last_command ? new Date(user.last_command).toLocaleString() : 'N/A'
            ];
            csvContent += row.map(cell => escapeCSV(cell)).join(',') + '\n';
          });
        }
        
        filename = `user-activity-report-${new Date().toISOString().split('T')[0]}.csv`;
      } else {
        // Generic export for other report types
        csvContent = `${reportType} Report\n`;
        csvContent += `Generated,${new Date().toLocaleString()}\n`;
        if (startDate) csvContent += `Start Date,${startDate}\n`;
        if (endDate) csvContent += `End Date,${endDate}\n`;
        csvContent += '\n';
        csvContent += 'Data\n';
        
        // Try to convert report data to CSV format
        if (Array.isArray(reportData)) {
          if (reportData.length > 0) {
            const keys = Object.keys(reportData[0]);
            csvContent += keys.map(k => escapeCSV(k)).join(',') + '\n';
            reportData.forEach(item => {
              const row = keys.map(key => item[key] || 'N/A');
              csvContent += row.map(cell => escapeCSV(cell)).join(',') + '\n';
            });
          }
        } else {
          // For object data, create key-value pairs
          csvContent += 'Key,Value\n';
          Object.entries(reportData).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
              csvContent += `${escapeCSV(key)},${escapeCSV(JSON.stringify(value))}\n`;
            } else {
              csvContent += `${escapeCSV(key)},${escapeCSV(value)}\n`;
            }
          });
        }
        
        filename = `${reportType}-report-${new Date().toISOString().split('T')[0]}.csv`;
      }

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV. Please try again.');
    }
  };

  const reportTypes = [
    { 
      id: 'device-commands', 
      label: 'Device Commands', 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    { 
      id: 'user-activity', 
      label: 'User Activity', 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    { 
      id: 'sensor-summary', 
      label: 'Sensor Summary', 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 3v18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M18 7c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M18 14c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 9h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M9 15h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      )
    },
    { 
      id: 'system-health', 
      label: 'System Health', 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    { 
      id: 'water-usage', 
      label: 'Water Usage', 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 22V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
  ];

  const renderDeviceCommandsReport = () => {
    if (!reportData || !reportData.summary) return null;
    const { summary, commands } = reportData;

    return (
      <div className="space-y-6">
        <h3 className="text-2xl font-bold text-gray-800">Device Commands Report</h3>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-eco-green-bg rounded-lg p-6 border border-eco-green-medium/30">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">TOTAL COMMANDS</div>
            <div className="text-3xl font-bold text-eco-green-dark">{summary.total || 0}</div>
          </div>
          <div className="bg-eco-green-bg rounded-lg p-6 border border-eco-green-medium/30">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">SUCCESS RATE</div>
            <div className="text-3xl font-bold text-eco-green-dark">{summary.success_rate || 0}%</div>
          </div>
          <div className="bg-eco-green-bg rounded-lg p-6 border border-eco-green-medium/30">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">AVG EXECUTION TIME</div>
            <div className="text-3xl font-bold text-eco-green-dark">{summary.avg_execution_time || 0}s</div>
          </div>
        </div>

        {/* Breakdown Sections */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* By Device */}
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">By Device</h4>
            <div className="space-y-2">
              {summary.by_device && Object.entries(summary.by_device).map(([device, count]) => (
                <div key={device} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                  <span className="text-gray-700 capitalize">{device}:</span>
                  <span className="font-semibold text-eco-green-dark">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* By Status */}
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">By Status</h4>
            <div className="space-y-2">
              {summary.by_status && Object.entries(summary.by_status).map(([status, count]) => (
                <div key={status} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                  <span className="text-gray-700">{status}:</span>
                  <span className="font-semibold text-eco-green-dark">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* By User */}
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">By User</h4>
            <div className="space-y-2">
              {summary.by_user && Object.entries(summary.by_user).map(([user, info]) => (
                <div key={user} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                  <span className="text-gray-700 text-sm">{info.username} ({info.role}):</span>
                  <span className="font-semibold text-eco-green-dark">{info.count} commands</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Commands Table */}
        {commands && commands.length > 0 && (
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">Recent Commands</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Device</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Desired State</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actual State</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Execution Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {commands.slice(0, 50).map((cmd, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">{new Date(cmd.requested_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-700 capitalize">{cmd.device}</td>
                      <td className="px-4 py-3 text-gray-700">{cmd.desired_state}</td>
                      <td className="px-4 py-3 text-gray-700">{cmd.actual_state || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          cmd.status === 'SUCCESS' ? 'bg-green-100 text-green-800' :
                          cmd.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {cmd.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{cmd.username || 'Unknown'}</td>
                      <td className="px-4 py-3 text-gray-700">{cmd.execution_time_seconds ? `${cmd.execution_time_seconds}s` : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderReportResults = () => {
    if (reportLoading) {
      return (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-eco-green-medium"></div>
          <p className="mt-4 text-gray-600">Generating report...</p>
        </div>
      );
    }

    if (reportError) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800 font-semibold">Error generating report: {reportError}</p>
          <p className="text-red-600 text-sm mt-2">Please try again later.</p>
        </div>
      );
    }

    if (!reportData) {
      return null;
    }

    // Render based on report type
    if (reportType === 'device-commands') {
      return renderDeviceCommandsReport();
    }

    // Add other report types here as needed
    return (
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <p className="text-gray-600">Report data will be displayed here.</p>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-eco-green-bg overflow-hidden">
      <DashboardSidebar activeSection={activeSection} onSectionChange={setActiveSection} userRole="admin" />

      <main className="flex-1 dashboard-main-content overflow-y-auto">
        <header className="bg-white shadow-sm p-6">
          <h1 className="text-3xl font-bold text-eco-green-dark">Admin Dashboard</h1>
        </header>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-600">Loading sensor data...</div>
          ) : (
            <>
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
                              Shows the current water tank level status
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                                <div className="border-4 border-transparent border-t-gray-900"></div>
                              </div>
                            </div>
                          </motion.div>
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  {/* Plant Condition Summary */}
                  <PlantConditionSummary sensorData={sensorData} />
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
                      status={commandStatus.pump?.status || null}
                      onToggle={() => handleToggle('pump')}
                      loading={commandLoading.pump}
                    />

                    {/* Solenoid Valve Control */}
                    <ControlCard
                      device="valve"
                      icon="💧"
                      title="Solenoid Valve"
                      currentState={getDeviceState('valve')}
                      status={commandStatus.valve?.status || null}
                      onToggle={() => handleToggle('valve')}
                      loading={commandLoading.valve}
                    />
                  </div>
                </div>
              )}

              {activeSection === 'reports' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-6"
                >
                  {/* Reports & Analytics Card */}
                  <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-l-eco-green-medium">
                    <h2 className="text-2xl font-bold text-eco-green-dark mb-2">Reports & Analytics</h2>
                    <p className="text-gray-600 mb-6">
                      Generate comprehensive reports on system activity, device commands, and sensor data.
                    </p>
                    
                    {/* Report Type Selection Buttons */}
                    <div className="flex flex-wrap gap-3 mb-6">
                      {reportTypes.map((type) => (
                        <button
                          key={type.id}
                          onClick={() => setReportType(type.id)}
                          className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                            reportType === type.id
                              ? 'bg-eco-green-medium text-white shadow-md'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <span className="w-5 h-5 flex items-center justify-center">{type.icon}</span>
                          <span>{type.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Date Range and Action Buttons */}
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Start Date:</label>
                          <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-eco-green-medium focus:border-transparent"
                          />
                        </div>
                        <div className="relative">
                          <label className="block text-sm font-medium text-gray-700 mb-2">End Date:</label>
                          <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-eco-green-medium focus:border-transparent"
                          />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={handleGenerateReport}
                          disabled={reportLoading}
                          className="px-6 py-2 bg-eco-green-medium text-white rounded-lg font-semibold hover:bg-eco-green-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Generate Report
                        </button>
                        <button
                          onClick={handleExportCSV}
                          disabled={!reportData}
                          className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Export CSV
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Report Results */}
                  {reportData || reportLoading || reportError ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="bg-white rounded-xl shadow-lg p-6"
                    >
                      {renderReportResults()}
                    </motion.div>
                  ) : null}
                </motion.div>
              )}
            </>
          )}
        </div>
      </main>

      <FloatingChatbotButton />
    </div>
  );
};

export default AdminDashboard;
