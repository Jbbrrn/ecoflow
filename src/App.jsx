import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import GardenerDashboard from './pages/GardenerDashboard';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  console.log('App component rendered');
  
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/gardener-dashboard" element={<GardenerDashboard />} />
      <Route path="/admin-dashboard" element={<AdminDashboard />} />
      {/* Redirect old HTML routes to React versions */}
      <Route path="/login.html" element={<Navigate to="/" replace />} />
      <Route path="/gardener_dashboard.html" element={<Navigate to="/gardener-dashboard" replace />} />
      <Route path="/admin_dashboard.html" element={<Navigate to="/admin-dashboard" replace />} />
    </Routes>
  );
}

export default App;
