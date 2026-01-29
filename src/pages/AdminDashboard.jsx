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
import CreateAccountModal from '../components/CreateAccountModal';
import EditAccountModal from '../components/EditAccountModal';
import { apiClient } from '../services/client.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import '../components/WaterTank.css';

const AdminDashboard = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
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
  const [isCreateAccountModalOpen, setIsCreateAccountModalOpen] = useState(false);
  const [isEditAccountModalOpen, setIsEditAccountModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
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

  useEffect(() => {
    if (activeSection === 'manage-accounts') {
      fetchUsers();
    }
  }, [activeSection]);

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

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const usersList = await apiClient.getUsers();
      setUsers(usersList);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to deactivate ${username}? This action cannot be undone.`)) {
      return;
    }

    try {
      await apiClient.deleteUser(userId);
      await fetchUsers(); // Refresh the list
    } catch (error) {
      alert(error.message || 'Failed to delete user');
    }
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setIsEditAccountModalOpen(true);
  };

  const handleRefreshUsers = () => {
    fetchUsers();
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

      // Validate date requirements for device-commands report
      if (reportType === 'device-commands') {
        if (!startDate || !endDate) {
          setReportError('Both start date and end date are required for Device Commands report.');
          setReportLoading(false);
          return;
        }
        
        // Validate that dates are not in the future using Philippines timezone (UTC+8)
        // Get current date in Philippines timezone
        const phTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
        const today = new Date(phTime);
        today.setHours(0, 0, 0, 0);
        
        // Parse selected dates (they come as YYYY-MM-DD strings)
        const startDateObj = new Date(startDate + 'T00:00:00+08:00'); // Philippines timezone
        const endDateObj = new Date(endDate + 'T23:59:59+08:00'); // Philippines timezone
        
        // Compare dates (ignore time, just compare date parts)
        const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const startDateOnly = new Date(startDateObj.getFullYear(), startDateObj.getMonth(), startDateObj.getDate());
        const endDateOnly = new Date(endDateObj.getFullYear(), endDateObj.getMonth(), endDateObj.getDate());
        
        console.log('Date validation:', {
          phTime,
          todayDateOnly: todayDateOnly.toISOString().split('T')[0],
          startDateOnly: startDateOnly.toISOString().split('T')[0],
          endDateOnly: endDateOnly.toISOString().split('T')[0]
        });
        
        if (startDateOnly > todayDateOnly || endDateOnly > todayDateOnly) {
          setReportError('Date range cannot include future dates. Please select dates up to today (Philippines time).');
          setReportLoading(false);
          return;
        }
        
        // Validate that start date is before end date
        if (startDateOnly > endDateOnly) {
          setReportError('Start date must be before or equal to end date.');
          setReportLoading(false);
          return;
        }
      }

      let url = `/api/reports/${reportType}?`;
      const params = new URLSearchParams();
      
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

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
          // Prefer 'message' field, fallback to 'error' field
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          if (errorText) errorMessage += ` - ${errorText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Report data received:', { 
        reportType, 
        dataKeys: Object.keys(data),
        dataSample: JSON.stringify(data).substring(0, 200)
      });
      
      // Debug: Check if data structure matches expectations
      if (reportType === 'sensor-summary') {
        console.log('Sensor Summary Debug:', {
          hasSummary: !!data.summary,
          hasData: !!data.data,
          summaryKeys: data.summary ? Object.keys(data.summary) : null,
          totalReadings: data.summary?.total_readings,
          rawData: data
        });
      }
      
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

      // Helper to format dates
      const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString();
      };

      // Helper to format numbers
      const formatNumber = (num, decimals = 2) => {
        if (num === null || num === undefined || isNaN(num)) return 'N/A';
        return Number(num).toFixed(decimals);
      };

      if (reportType === 'device-commands') {
        // Device Commands Report CSV
        csvContent = 'Device Commands Report\n';
        csvContent += `Generated,${new Date().toLocaleString()}\n`;
        if (startDate) csvContent += `Start Date,${startDate}\n`;
        if (endDate) csvContent += `End Date,${endDate}\n`;
        csvContent += '\n';
        
        // Summary Section
        if (reportData.summary) {
          csvContent += 'Summary\n';
          csvContent += `Total Commands,${reportData.summary?.total || 0}\n`;
          csvContent += `Success Rate,${formatNumber(reportData.summary?.success_rate)}%\n`;
          csvContent += `Avg Execution Time,${formatNumber(reportData.summary?.avg_execution_time)}s\n`;
          csvContent += '\n';
          
          // Breakdown by Device
          if (reportData.summary?.by_device) {
            csvContent += 'By Device\n';
            csvContent += 'Device,Count\n';
            Object.entries(reportData.summary.by_device).forEach(([device, count]) => {
              csvContent += `${escapeCSV(device.charAt(0).toUpperCase() + device.slice(1))},${count}\n`;
            });
            csvContent += '\n';
          }
          
          // Breakdown by Status
          if (reportData.summary?.by_status) {
            csvContent += 'By Status\n';
            csvContent += 'Status,Count\n';
            Object.entries(reportData.summary.by_status).forEach(([status, count]) => {
              csvContent += `${escapeCSV(status)},${count}\n`;
            });
            csvContent += '\n';
          }
          
          // Breakdown by User
          if (reportData.summary?.by_user) {
            csvContent += 'By User\n';
            csvContent += 'User,Role,Commands\n';
            Object.entries(reportData.summary.by_user).forEach(([user, info]) => {
              csvContent += `${escapeCSV(info.username)},${escapeCSV(info.role)},${info.count}\n`;
            });
            csvContent += '\n';
          }
        }
        
        // Commands Data
        if (reportData.commands && reportData.commands.length > 0) {
          csvContent += 'Commands\n';
          const headers = ['Time', 'Device', 'Desired State', 'Actual State', 'Status', 'User', 'Execution Time (s)'];
          csvContent += headers.map(h => escapeCSV(h)).join(',') + '\n';
          
          reportData.commands.forEach(cmd => {
            const row = [
              formatDate(cmd.requested_at),
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
        
        const headers = ['User ID', 'Username', 'Email', 'Role', 'Status', 'Total Commands', 'Successful', 'Failed', 'Pending', 'First Command', 'Last Command'];
        csvContent += headers.map(h => escapeCSV(h)).join(',') + '\n';
        
        if (Array.isArray(reportData) && reportData.length > 0) {
          reportData.forEach(activity => {
            const row = [
              activity.user_id || 'N/A',
              activity.username || 'N/A',
              activity.email || 'N/A',
              activity.user_role || 'N/A',
              activity.is_active ? 'Active' : 'Inactive',
              activity.total_commands || 0,
              activity.successful_commands || 0,
              activity.failed_commands || 0,
              activity.pending_commands || 0,
              formatDate(activity.first_command),
              formatDate(activity.last_command)
            ];
            csvContent += row.map(cell => escapeCSV(cell)).join(',') + '\n';
          });
        }
        
        filename = `user-activity-report-${new Date().toISOString().split('T')[0]}.csv`;
        
      } else if (reportType === 'sensor-summary') {
        // Sensor Summary Report CSV - CLEAN FORMAT
        csvContent = 'Sensor Summary Report\n';
        csvContent += `Generated,${new Date().toLocaleString()}\n`;
        if (startDate) csvContent += `Start Date,${startDate}\n`;
        if (endDate) csvContent += `End Date,${endDate}\n`;
        csvContent += '\n';
        
        if (reportData.summary) {
          const s = reportData.summary;
          
          // Overview Section
          csvContent += 'Overview\n';
          csvContent += 'Metric,Value\n';
          csvContent += `Total Readings,${s.total_readings || 0}\n`;
          csvContent += `First Reading,${formatDate(s.first_reading)}\n`;
          csvContent += `Last Reading,${formatDate(s.last_reading)}\n`;
          csvContent += '\n';
          
          // Soil Moisture Section
          csvContent += 'Soil Moisture - Sensor 1\n';
          csvContent += 'Metric,Value\n';
          csvContent += `Average,${formatNumber(s.avg_soil1)}%\n`;
          csvContent += `Minimum,${formatNumber(s.min_soil1)}%\n`;
          csvContent += `Maximum,${formatNumber(s.max_soil1)}%\n`;
          csvContent += '\n';
          
          csvContent += 'Soil Moisture - Sensor 2\n';
          csvContent += 'Metric,Value\n';
          csvContent += `Average,${formatNumber(s.avg_soil2)}%\n`;
          csvContent += `Minimum,${formatNumber(s.min_soil2)}%\n`;
          csvContent += `Maximum,${formatNumber(s.max_soil2)}%\n`;
          csvContent += '\n';
          
          csvContent += 'Soil Moisture - Sensor 3\n';
          csvContent += 'Metric,Value\n';
          csvContent += `Average,${formatNumber(s.avg_soil3)}%\n`;
          csvContent += `Minimum,${formatNumber(s.min_soil3)}%\n`;
          csvContent += `Maximum,${formatNumber(s.max_soil3)}%\n`;
          csvContent += '\n';
          
          // Temperature Section
          csvContent += 'Temperature\n';
          csvContent += 'Metric,Value\n';
          csvContent += `Average,${formatNumber(s.avg_temperature)}°C\n`;
          csvContent += `Minimum,${formatNumber(s.min_temperature)}°C\n`;
          csvContent += `Maximum,${formatNumber(s.max_temperature)}°C\n`;
          csvContent += '\n';
          
          // Humidity Section
          csvContent += 'Humidity\n';
          csvContent += 'Metric,Value\n';
          csvContent += `Average,${formatNumber(s.avg_humidity)}%\n`;
          csvContent += `Minimum,${formatNumber(s.min_humidity)}%\n`;
          csvContent += `Maximum,${formatNumber(s.max_humidity)}%\n`;
          csvContent += '\n';
          
          // System Status Section
          csvContent += 'System Status\n';
          csvContent += 'Metric,Value\n';
          csvContent += `Low Water Alerts,${s.low_water_alerts || 0}\n`;
          csvContent += `High Water Alerts,${s.high_water_alerts || 0}\n`;
          csvContent += `Pump On Count,${s.pump_on_count || 0}\n`;
          csvContent += `Valve On Count,${s.valve_on_count || 0}\n`;
          csvContent += '\n';
        }
        
        // Threshold Violations Section
        if (reportData.thresholds) {
          csvContent += 'Threshold Violations\n';
          csvContent += 'Metric,Value\n';
          csvContent += `Low Moisture Count,${reportData.thresholds.low_moisture_count || 0}\n`;
          csvContent += `First Low Moisture,${formatDate(reportData.thresholds.first_low_moisture)}\n`;
          csvContent += `Last Low Moisture,${formatDate(reportData.thresholds.last_low_moisture)}\n`;
        }
        
        filename = `sensor-summary-report-${new Date().toISOString().split('T')[0]}.csv`;
        
      } else if (reportType === 'water-usage') {
        // Water Usage Report CSV
        csvContent = 'Water Usage Report\n';
        csvContent += `Generated,${new Date().toLocaleString()}\n`;
        if (startDate) csvContent += `Start Date,${startDate}\n`;
        if (endDate) csvContent += `End Date,${endDate}\n`;
        csvContent += '\n';
        
        if (reportData.summary) {
          csvContent += 'Usage Summary\n';
          csvContent += 'Metric,Value\n';
          Object.entries(reportData.summary).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
              return;
            }
            csvContent += `${escapeCSV(key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))},${escapeCSV(value)}\n`;
          });
        }
        
        filename = `water-usage-report-${new Date().toISOString().split('T')[0]}.csv`;
        
      } else {
        // Generic export for other report types
        csvContent = `${reportType} Report\n`;
        csvContent += `Generated,${new Date().toLocaleString()}\n`;
        if (startDate) csvContent += `Start Date,${startDate}\n`;
        if (endDate) csvContent += `End Date,${endDate}\n`;
        csvContent += '\n';
        
        // Try to convert report data to CSV format
        if (Array.isArray(reportData)) {
          if (reportData.length > 0) {
            const keys = Object.keys(reportData[0]);
            csvContent += keys.map(k => escapeCSV(k.replace(/_/g, ' '))).join(',') + '\n';
            reportData.forEach(item => {
              const row = keys.map(key => {
                const val = item[key];
                if (val === null || val === undefined) return 'N/A';
                if (typeof val === 'object') return JSON.stringify(val);
                return val;
              });
              csvContent += row.map(cell => escapeCSV(cell)).join(',') + '\n';
            });
          }
        } else if (typeof reportData === 'object') {
          // Flatten nested objects
          csvContent += 'Key,Value\n';
          const flattenObject = (obj, prefix = '') => {
            const result = [];
            Object.entries(obj).forEach(([key, value]) => {
              const newKey = prefix ? `${prefix}.${key}` : key;
              if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                result.push(...flattenObject(value, newKey));
              } else {
                result.push([newKey.replace(/_/g, ' '), value]);
              }
            });
            return result;
          };
          
          flattenObject(reportData).forEach(([key, value]) => {
            csvContent += `${escapeCSV(key)},${escapeCSV(value)}\n`;
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

  const handleExportPDF = () => {
    if (!reportData) {
      alert('Please generate a report first.');
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPosition = 20;

      // Helper function to safely convert to number
      const toNumber = (value, defaultValue = 0) => {
        if (value === null || value === undefined || value === '') return defaultValue;
        const num = typeof value === 'string' ? parseFloat(value) : Number(value);
        return isNaN(num) ? defaultValue : num;
      };

      // Helper function to format number with decimals
      const formatNum = (value, decimals = 2) => {
        return toNumber(value, 0).toFixed(decimals);
      };

      // Helper function to add a new page if needed
      const checkPageBreak = (requiredSpace = 20) => {
        if (yPosition + requiredSpace > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          yPosition = 20;
        }
      };

      // Report Header
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      const reportTitle = `${reportType.charAt(0).toUpperCase() + reportType.slice(1).replace(/-/g, ' ')} Report`;
      doc.text(reportTitle, 14, yPosition);
      yPosition += 10;

      // Metadata
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, yPosition);
      yPosition += 5;
      if (startDate) {
        doc.text(`Start Date: ${startDate}`, 14, yPosition);
        yPosition += 5;
      }
      if (endDate) {
        doc.text(`End Date: ${endDate}`, 14, yPosition);
        yPosition += 5;
      }
      yPosition += 5;

      if (reportType === 'device-commands') {
        // Summary Table
        if (reportData.summary) {
          const summaryData = [
            ['Total Commands', reportData.summary.total || 0],
            ['Success Rate', `${formatNum(reportData.summary.success_rate)}%`],
            ['Avg Execution Time', `${formatNum(reportData.summary.avg_execution_time)}s`]
          ];
          autoTable(doc, {
            startY: yPosition,
            head: [['Metric', 'Value']],
            body: summaryData,
            theme: 'striped',
            headStyles: { fillColor: [61, 134, 11] }
          });
          yPosition = doc.lastAutoTable.finalY + 10;
        }

        // Commands Table
        if (reportData.commands && reportData.commands.length > 0) {
          checkPageBreak(30);
          const commandsData = reportData.commands.map(cmd => [
            new Date(cmd.requested_at).toLocaleString(),
            cmd.device || 'N/A',
            cmd.desired_state || 'N/A',
            cmd.actual_state || 'N/A',
            cmd.status || 'N/A',
            cmd.username || 'Unknown',
            cmd.execution_time_seconds ? `${cmd.execution_time_seconds}s` : 'N/A'
          ]);

          autoTable(doc, {
            startY: yPosition,
            head: [['Time', 'Device', 'Desired State', 'Actual State', 'Status', 'User', 'Execution Time']],
            body: commandsData,
            theme: 'striped',
            headStyles: { fillColor: [61, 134, 11] },
            styles: { fontSize: 8 },
            margin: { left: 14, right: 14 }
          });
        }

      } else if (reportType === 'sensor-summary') {
        if (reportData.summary) {
          const s = reportData.summary;
          
          // Overview
          const overviewData = [
            ['Total Readings', s.total_readings || 0],
            ['First Reading', new Date(s.first_reading).toLocaleString()],
            ['Last Reading', new Date(s.last_reading).toLocaleString()]
          ];
          autoTable(doc, {
            startY: yPosition,
            head: [['Overview', '']],
            body: overviewData,
            theme: 'striped',
            headStyles: { fillColor: [61, 134, 11] }
          });
          yPosition = doc.lastAutoTable.finalY + 10;

          // Soil Moisture
          checkPageBreak(30);
          const soilData = [
            ['Sensor 1 - Average', `${formatNum(s.avg_soil1)}%`],
            ['Sensor 1 - Minimum', `${formatNum(s.min_soil1)}%`],
            ['Sensor 1 - Maximum', `${formatNum(s.max_soil1)}%`],
            ['Sensor 2 - Average', `${formatNum(s.avg_soil2)}%`],
            ['Sensor 2 - Minimum', `${formatNum(s.min_soil2)}%`],
            ['Sensor 2 - Maximum', `${formatNum(s.max_soil2)}%`],
            ['Sensor 3 - Average', `${formatNum(s.avg_soil3)}%`],
            ['Sensor 3 - Minimum', `${formatNum(s.min_soil3)}%`],
            ['Sensor 3 - Maximum', `${formatNum(s.max_soil3)}%`]
          ];
          autoTable(doc, {
            startY: yPosition,
            head: [['Soil Moisture', 'Value']],
            body: soilData,
            theme: 'striped',
            headStyles: { fillColor: [61, 134, 11] }
          });
          yPosition = doc.lastAutoTable.finalY + 10;

          // Temperature & Humidity
          checkPageBreak(20);
          const envData = [
            ['Temperature - Average', `${formatNum(s.avg_temperature)}°C`],
            ['Temperature - Minimum', `${formatNum(s.min_temperature)}°C`],
            ['Temperature - Maximum', `${formatNum(s.max_temperature)}°C`],
            ['Humidity - Average', `${formatNum(s.avg_humidity)}%`],
            ['Humidity - Minimum', `${formatNum(s.min_humidity)}%`],
            ['Humidity - Maximum', `${formatNum(s.max_humidity)}%`]
          ];
          autoTable(doc, {
            startY: yPosition,
            head: [['Environment', 'Value']],
            body: envData,
            theme: 'striped',
            headStyles: { fillColor: [61, 134, 11] }
          });
        }

      } else if (reportType === 'user-activity') {
        if (Array.isArray(reportData) && reportData.length > 0) {
          const activityData = reportData.map(activity => [
            activity.username || 'N/A',
            activity.email || 'N/A',
            activity.user_role || 'N/A',
            activity.is_active ? 'Active' : 'Inactive',
            activity.total_commands || 0,
            activity.successful_commands || 0,
            activity.failed_commands || 0,
            activity.pending_commands || 0
          ]);

          autoTable(doc, {
            startY: yPosition,
            head: [['Username', 'Email', 'Role', 'Status', 'Total', 'Success', 'Failed', 'Pending']],
            body: activityData,
            theme: 'striped',
            headStyles: { fillColor: [61, 134, 11] },
            styles: { fontSize: 8 }
          });
        }

      } else if (reportType === 'water-usage') {
        // Water Usage Report PDF
        // Match the render function's data access pattern
        const usage = reportData?.usage || reportData?.data?.usage;
        
        if (usage && (usage.pump || usage.valve)) {
          const pump = usage.pump || {};
          const valve = usage.valve || {};
          
          // Pump Statistics
          const pumpData = [
            ['Total Activations', pump.total_activations || 0],
            ['Successful Activations', pump.successful_activations || 0],
            ['Total ON Time', `${pump.total_on_time_minutes || 0} minutes`],
            ['Total ON Time (Hours)', `${formatNum((pump.total_on_time_minutes || 0) / 60)} hours`]
          ];
          
          autoTable(doc, {
            startY: yPosition,
            head: [['Pump Statistics', 'Value']],
            body: pumpData,
            theme: 'striped',
            headStyles: { fillColor: [61, 134, 11] }
          });
          yPosition = doc.lastAutoTable.finalY + 10;

          // Valve Statistics
          checkPageBreak(20);
          const valveData = [
            ['Total Activations', valve.total_activations || 0],
            ['Successful Activations', valve.successful_activations || 0],
            ['Total ON Time', `${valve.total_on_time_minutes || 0} minutes`],
            ['Total ON Time (Hours)', `${formatNum((valve.total_on_time_minutes || 0) / 60)} hours`]
          ];
          
          autoTable(doc, {
            startY: yPosition,
            head: [['Valve Statistics', 'Value']],
            body: valveData,
            theme: 'striped',
            headStyles: { fillColor: [61, 134, 11] }
          });
          yPosition = doc.lastAutoTable.finalY + 10;

          // Summary
          checkPageBreak(15);
          const totalMinutes = (pump.total_on_time_minutes || 0) + (valve.total_on_time_minutes || 0);
          const summaryData = [
            ['Total Device Activations', (pump.total_activations || 0) + (valve.total_activations || 0)],
            ['Combined ON Time', `${totalMinutes} minutes`],
            ['Combined ON Time (Hours)', `${formatNum(totalMinutes / 60)} hours`]
          ];
          
          autoTable(doc, {
            startY: yPosition,
            head: [['Summary', 'Value']],
            body: summaryData,
            theme: 'striped',
            headStyles: { fillColor: [61, 134, 11] }
          });
        } else {
          // No data message
          yPosition += 10;
          doc.setFontSize(10);
          doc.setTextColor(100, 100, 100);
          doc.text('No water usage data available for the selected date range.', 14, yPosition);
        }
      }

      // Save PDF
      const filename = `${reportType}-report-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);

    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
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
    if (!reportData) {
      return (
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Device Commands Report</h3>
          <p className="text-gray-600">No report data available. Please generate a report first.</p>
        </div>
      );
    }
    
    if (!reportData.summary) {
      return (
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Device Commands Report</h3>
          <p className="text-gray-600">No device commands found for the selected date range.</p>
          <p className="text-gray-500 text-sm mt-2">
            Ensure you have selected valid dates and that device commands exist for this period.
          </p>
        </div>
      );
    }
    
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
          <p className="text-red-600 text-sm mt-2">
            {reportType === 'device-commands' && reportError.includes('date')
              ? 'Please ensure both start date and end date are selected and are not in the future.'
              : 'Please check your input and try again.'}
          </p>
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
    if (reportType === 'user-activity') {
      return renderUserActivityReport();
    }
    if (reportType === 'sensor-summary') {
      return renderSensorSummaryReport();
    }
    if (reportType === 'water-usage') {
      return renderWaterUsageReport();
    }

    return (
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <p className="text-gray-600">Report data will be displayed here.</p>
      </div>
    );
  };

  const renderUserActivityReport = () => {
    // Handle case where reportData might be wrapped or null
    const activityData = Array.isArray(reportData) ? reportData : (reportData?.data || []);
    
    if (!activityData || activityData.length === 0) {
      return (
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">User Activity Report</h3>
          <p className="text-gray-600">No user activity data available for the selected date range.</p>
          <p className="text-gray-500 text-sm mt-2">
            {!startDate || !endDate 
              ? 'Tip: Select a date range to see user activity data.' 
              : 'Try selecting a different date range or ensure users have performed actions during this period.'}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <h3 className="text-2xl font-bold text-gray-800">User Activity Report</h3>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Total Commands</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Successful</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Failed</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Pending</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">First Command</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Last Command</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {activityData.map((user, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">{user.username || 'N/A'}</td>
                    <td className="px-4 py-3 text-gray-700">{user.email || 'N/A'}</td>
                    <td className="px-4 py-3 text-gray-700">{user.user_role || 'N/A'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{user.total_commands || 0}</td>
                    <td className="px-4 py-3 text-gray-700">{user.successful_commands || 0}</td>
                    <td className="px-4 py-3 text-gray-700">{user.failed_commands || 0}</td>
                    <td className="px-4 py-3 text-gray-700">{user.pending_commands || 0}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {user.first_command ? new Date(user.first_command).toLocaleString() : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {user.last_command ? new Date(user.last_command).toLocaleString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderSensorSummaryReport = () => {
    console.log('Rendering Sensor Summary Report:', {
      hasReportData: !!reportData,
      reportDataKeys: reportData ? Object.keys(reportData) : null,
      summary: reportData?.summary,
      thresholds: reportData?.thresholds
    });
    
    // Handle case where reportData structure might vary
    const summary = reportData?.summary || reportData?.data?.summary;
    const thresholds = reportData?.thresholds || reportData?.data?.thresholds;
    
    console.log('Extracted summary:', {
      summary,
      totalReadings: summary?.total_readings,
      isZero: summary?.total_readings === 0,
      isNull: summary?.total_readings === null,
      isUndefined: summary?.total_readings === undefined
    });
    
    // Check if summary exists and has data
    if (!summary) {
      return (
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Sensor Data Summary Report</h3>
          <p className="text-gray-600">No sensor summary data available. Summary object is missing.</p>
          <p className="text-gray-500 text-sm mt-2">
            Debug: reportData keys = {reportData ? Object.keys(reportData).join(', ') : 'null'}
          </p>
        </div>
      );
    }
    
    // Check if there are any readings (allow 0 as valid if it's actually 0)
    if (summary.total_readings === null || summary.total_readings === undefined) {
      return (
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Sensor Data Summary Report</h3>
          <p className="text-gray-600">No sensor summary data available for the selected date range.</p>
          <p className="text-gray-500 text-sm mt-2">
            {!startDate || !endDate 
              ? 'Showing data for the last 24 hours. Select a date range to see data for a specific period.' 
              : 'Try selecting a different date range or ensure sensor data exists for this period.'}
          </p>
        </div>
      );
    }
    
    // If total_readings is 0, still show the report but indicate no data
    if (summary.total_readings === 0) {
      return (
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Sensor Data Summary Report</h3>
          <p className="text-gray-600">No sensor readings found for the selected date range.</p>
          <p className="text-gray-500 text-sm mt-2">
            {!startDate || !endDate 
              ? 'No data found in the last 24 hours. Select a date range to check a specific period.' 
              : `No sensor data found between ${startDate} and ${endDate}. Try selecting a different date range.`}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <h3 className="text-2xl font-bold text-gray-800">Sensor Data Summary Report</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-eco-green-bg rounded-lg p-6 border border-eco-green-medium/30">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Total Readings</div>
            <div className="text-3xl font-bold text-eco-green-dark">{summary.total_readings || 0}</div>
          </div>
          <div className="bg-eco-green-bg rounded-lg p-6 border border-eco-green-medium/30">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">First Reading</div>
            <div className="text-sm font-semibold text-gray-700">
              {summary.first_reading ? new Date(summary.first_reading).toLocaleString() : 'N/A'}
            </div>
          </div>
          <div className="bg-eco-green-bg rounded-lg p-6 border border-eco-green-medium/30">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Last Reading</div>
            <div className="text-sm font-semibold text-gray-700">
              {summary.last_reading ? new Date(summary.last_reading).toLocaleString() : 'N/A'}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Soil Moisture Averages</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-700">Sensor 1:</span>
              <span className="font-semibold text-eco-green-dark">
                Avg: {Number(summary.avg_soil1 || 0).toFixed(2)}% (Min: {Number(summary.min_soil1 || 0).toFixed(2)}%, Max: {Number(summary.max_soil1 || 0).toFixed(2)}%)
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-700">Sensor 2:</span>
              <span className="font-semibold text-eco-green-dark">
                Avg: {Number(summary.avg_soil2 || 0).toFixed(2)}% (Min: {Number(summary.min_soil2 || 0).toFixed(2)}%, Max: {Number(summary.max_soil2 || 0).toFixed(2)}%)
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-700">Sensor 3:</span>
              <span className="font-semibold text-eco-green-dark">
                Avg: {Number(summary.avg_soil3 || 0).toFixed(2)}% (Min: {Number(summary.min_soil3 || 0).toFixed(2)}%, Max: {Number(summary.max_soil3 || 0).toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Environmental Conditions</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-700">Temperature:</span>
              <span className="font-semibold text-eco-green-dark">
                Avg: {Number(summary.avg_temperature || 0).toFixed(2)}°C (Min: {Number(summary.min_temperature || 0).toFixed(2)}°C, Max: {Number(summary.max_temperature || 0).toFixed(2)}°C)
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-700">Humidity:</span>
              <span className="font-semibold text-eco-green-dark">
                Avg: {Number(summary.avg_humidity || 0).toFixed(2)}% (Min: {Number(summary.min_humidity || 0).toFixed(2)}%, Max: {Number(summary.max_humidity || 0).toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>

        {thresholds && thresholds.low_moisture_count > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-yellow-800 mb-2">⚠️ Low Moisture Alerts</h4>
            <p className="text-yellow-700">Found {thresholds.low_moisture_count} readings with soil moisture below 20%</p>
            <p className="text-yellow-700 text-sm mt-1">
              First occurrence: {thresholds.first_low_moisture ? new Date(thresholds.first_low_moisture).toLocaleString() : 'N/A'}
            </p>
            <p className="text-yellow-700 text-sm">
              Last occurrence: {thresholds.last_low_moisture ? new Date(thresholds.last_low_moisture).toLocaleString() : 'N/A'}
            </p>
          </div>
        )}
      </div>
    );
  };


  const renderWaterUsageReport = () => {
    // Handle case where reportData structure might vary
    const usage = reportData?.usage || reportData?.data?.usage;
    
    if (!usage || (!usage.pump && !usage.valve)) {
      return (
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Water Usage Report</h3>
          <p className="text-gray-600">No water usage data available for the selected date range.</p>
          <p className="text-gray-500 text-sm mt-2">
            {!startDate || !endDate 
              ? 'Showing data for the last 7 days. Select a date range to see usage for a specific period.' 
              : 'Water usage is calculated from pump and valve activation records. Ensure devices have been activated during this period.'}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <h3 className="text-2xl font-bold text-gray-800">Water Usage Report</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-eco-green-bg rounded-lg p-6 border border-eco-green-medium/30">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Pump Activations</div>
            <div className="text-3xl font-bold text-eco-green-dark">{usage.pump?.total_activations || 0}</div>
          </div>
          <div className="bg-eco-green-bg rounded-lg p-6 border border-eco-green-medium/30">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Pump Total ON Time</div>
            <div className="text-3xl font-bold text-eco-green-dark">{usage.pump?.total_on_time_minutes || 0} min</div>
          </div>
          <div className="bg-eco-green-bg rounded-lg p-6 border border-eco-green-medium/30">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Valve Activations</div>
            <div className="text-3xl font-bold text-eco-green-dark">{usage.valve?.total_activations || 0}</div>
          </div>
          <div className="bg-eco-green-bg rounded-lg p-6 border border-eco-green-medium/30">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Valve Total ON Time</div>
            <div className="text-3xl font-bold text-eco-green-dark">{usage.valve?.total_on_time_minutes || 0} min</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-eco-green-bg overflow-hidden">
      <DashboardSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        userRole="admin"
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      <main className="flex-1 dashboard-main-content overflow-y-auto">
        <header className="bg-white shadow-sm p-4 md:p-6 flex items-center justify-between gap-4">
          <button
            type="button"
            className="md:hidden flex-shrink-0 p-2 rounded-lg text-eco-green-dark hover:bg-eco-green-bg focus:outline-none focus:ring-2 focus:ring-eco-green-light min-w-[44px] min-h-[44px] flex items-center justify-center"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open menu"
          >
            <span className="text-2xl" aria-hidden="true">☰</span>
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-eco-green-dark flex-1 min-w-0">Admin Dashboard</h1>
        </header>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-600">Loading sensor data...</div>
          ) : (
            <>
              {activeSection === 'dashboard' && (
                <div className="space-y-6">
                  {/* Plant Condition Summary — first so users see understandable context */}
                  <PlantConditionSummary sensorData={sensorData} />

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

                  {/* Analytics — trends and charts on the same page */}
                  <Analytics />
                </div>
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
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-800 font-semibold mb-2">📋 How to Use:</p>
                        <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
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

              {activeSection === 'manage-accounts' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-6"
                >
                  <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-l-eco-green-medium">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-2xl font-bold text-eco-green-dark mb-2">Manage Accounts</h2>
                        <p className="text-gray-600">Create, edit, and manage user accounts</p>
                      </div>
                      <motion.button
                        onClick={() => setIsCreateAccountModalOpen(true)}
                        className="px-6 py-3 bg-gradient-to-r from-eco-green-dark to-eco-green-medium text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-4 focus:ring-eco-green-primary focus:ring-offset-2"
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        ➕ Create Account
                      </motion.button>
                    </div>

                    {usersLoading ? (
                      <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-eco-green-medium"></div>
                        <p className="mt-4 text-gray-600">Loading users...</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gray-50 border-b-2 border-gray-200">
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase">ID</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase">Name</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase">Email</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase">Role</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase">Status</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase">Created</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {users.length === 0 ? (
                              <tr>
                                <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                                  No users found. Create your first account!
                                </td>
                              </tr>
                            ) : (
                              users.map((user) => (
                                <tr key={user.user_id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-gray-700">{user.user_id}</td>
                                  <td className="px-4 py-3 text-gray-700 font-medium">{user.username || 'N/A'}</td>
                                  <td className="px-4 py-3 text-gray-700">{user.email || 'N/A'}</td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                      user.user_role === 'admin' 
                                        ? 'bg-purple-100 text-purple-800' 
                                        : 'bg-blue-100 text-blue-800'
                                    }`}>
                                      {user.user_role === 'admin' ? '👤 Admin' : '👤 User'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                      user.is_active 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-red-100 text-red-800'
                                    }`}>
                                      {user.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-gray-700 text-sm">
                                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <motion.button
                                        onClick={() => handleEditUser(user)}
                                        className="px-3 py-1.5 bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition-colors"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                      >
                                        ✏️ Edit
                                      </motion.button>
                                      <motion.button
                                        onClick={() => handleDeleteUser(user.user_id, user.username)}
                                        className="px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600 transition-colors"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                      >
                                        🗑️ Delete
                                      </motion.button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </motion.div>
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
                        <button
                          onClick={handleExportPDF}
                          disabled={!reportData}
                          className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-2"
                        >
                          Export PDF
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
      <CreateAccountModal 
        isOpen={isCreateAccountModalOpen} 
        onClose={() => setIsCreateAccountModalOpen(false)}
        onSuccess={handleRefreshUsers}
      />
      <EditAccountModal
        isOpen={isEditAccountModalOpen}
        onClose={() => {
          setIsEditAccountModalOpen(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
        onSuccess={handleRefreshUsers}
      />
    </div>
  );
};

export default AdminDashboard;
