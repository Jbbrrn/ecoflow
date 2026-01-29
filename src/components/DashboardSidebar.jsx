import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './DashboardSidebar.css';

// SVG Icon Components - Updated to match design
const DashboardIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="7" height="7" rx="1" fill="#3B82F6"/>
    <rect x="14" y="3" width="7" height="7" rx="1" fill="#EF4444"/>
    <rect x="3" y="14" width="7" height="7" rx="1" fill="#10B981"/>
    <rect x="14" y="14" width="7" height="7" rx="1" fill="#F59E0B"/>
  </svg>
);

const AnalyticsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 18L9 12L13 15L21 6" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="3" cy="18" r="2" fill="#3B82F6"/>
    <circle cx="9" cy="12" r="2" fill="#3B82F6"/>
    <circle cx="13" cy="15" r="2" fill="#3B82F6"/>
    <circle cx="21" cy="6" r="2" fill="#3B82F6"/>
  </svg>
);

const ControlsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="5" height="5" rx="1" fill="currentColor" opacity="0.3"/>
    <rect x="10" y="3" width="5" height="5" rx="1" fill="currentColor" opacity="0.3"/>
    <rect x="17" y="3" width="5" height="5" rx="1" fill="currentColor" opacity="0.3"/>
    <rect x="3" y="10" width="5" height="5" rx="1" fill="currentColor" opacity="0.3"/>
    <rect x="10" y="10" width="5" height="5" rx="1" fill="currentColor" opacity="0.3"/>
    <rect x="17" y="10" width="5" height="5" rx="1" fill="currentColor" opacity="0.3"/>
    <rect x="3" y="17" width="5" height="5" rx="1" fill="currentColor" opacity="0.3"/>
    <rect x="10" y="17" width="5" height="5" rx="1" fill="currentColor" opacity="0.3"/>
    <rect x="17" y="17" width="5" height="5" rx="1" fill="currentColor" opacity="0.3"/>
  </svg>
);

const ReportsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M10 9H9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const ManageAccountsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 21V19C16 17.9391 15.5786 16.9217 14.8284 16.1716C14.0783 15.4214 13.0609 15 12 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="8.5" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M17 11V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 14H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 8H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const LogoutIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 17H4C3.44772 17 3 16.5523 3 16V4C3 3.44772 3.44772 3 4 3H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M13 14L17 10L13 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M17 10H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const DashboardSidebar = ({ activeSection, onSectionChange, userRole, mobileOpen, onMobileClose }) => {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [username, setUsername] = useState('');

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // When parent opens mobile menu, show sidebar
  useEffect(() => {
    if (isMobile && mobileOpen) {
      setIsCollapsed(false);
    }
  }, [isMobile, mobileOpen]);

  const effectiveCollapsed = isMobile ? !mobileOpen : isCollapsed;

  const handleToggle = () => {
    if (isMobile) {
      setIsCollapsed(true);
      onMobileClose?.();
    } else {
      setIsCollapsed(!isCollapsed);
    }
  };

  const handleOverlayClick = () => {
    if (isMobile) {
      setIsCollapsed(true);
      onMobileClose?.();
    }
  };

  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  useEffect(() => {
    const sidebarWidth = isCollapsed ? '80px' : '280px';
    document.documentElement.style.setProperty('--sidebar-width', sidebarWidth);
  }, [isCollapsed]);

  const navItems = userRole === 'admin' 
    ? [
        { id: 'dashboard', icon: DashboardIcon, label: 'Dashboard' },
        { id: 'controls', icon: ControlsIcon, label: 'Manual Controls' },
        { id: 'reports', icon: ReportsIcon, label: 'Generate Reports' },
        { id: 'manage-accounts', icon: ManageAccountsIcon, label: 'Manage Accounts' },
      ]
    : [
        { id: 'dashboard', icon: DashboardIcon, label: 'Dashboard' },
        { id: 'controls', icon: ControlsIcon, label: 'Manual Controls' },
      ];

  const handleLogout = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('username');
    navigate('/');
  };

  const handleNavClick = (id) => {
    if (onSectionChange) {
      onSectionChange(id);
    }
    if (isMobile) {
      setIsCollapsed(true);
      onMobileClose?.();
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && !effectiveCollapsed && (
        <div 
          className="sidebar-overlay"
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}
      
      <aside className={`sidebar ${effectiveCollapsed ? 'collapsed' : ''} ${isMobile ? 'mobile' : ''}`}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-logo-container">
            <img 
              src="/css/logo_ecoflow.png" 
              alt="Eco Flow Logo" 
              className="sidebar-logo"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            {!effectiveCollapsed && (
              <span className="sidebar-brand">Eco Flow</span>
            )}
          </div>
          <button
            className="sidebar-toggle"
            onClick={handleToggle}
            aria-label={effectiveCollapsed ? 'Open menu' : 'Close menu'}
          >
            {effectiveCollapsed ? (
              <svg className="toggle-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            ) : (
              <svg className="toggle-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {!effectiveCollapsed && (
            <div className="nav-section-heading">NAVIGATION</div>
          )}
          <ul className="nav-list">
            {navItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <li key={item.id}>
                  <button
                    className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
                    onClick={() => handleNavClick(item.id)}
                    title={isCollapsed ? item.label : ''}
                  >
                    <span className="nav-icon-wrapper">
                      <span className="nav-icon">
                        <IconComponent />
                      </span>
                    </span>
                    {!effectiveCollapsed && <span className="nav-label">{item.label}</span>}
                    {activeSection === item.id && (
                      <span className="nav-indicator"></span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              <div className="user-avatar-initial">
                {username ? username.charAt(0).toUpperCase() : (userRole === 'admin' ? 'A' : 'U')}
              </div>
            </div>
            {!effectiveCollapsed && (
              <div className="user-details">
                <div className="user-name">
                  {username || (userRole === 'admin' ? 'Admin User' : 'User')}
                </div>
                <div className="user-role-text">
                  {userRole === 'admin' ? 'Administrator' : 'User'}
                </div>
              </div>
            )}
          </div>
          <button
            className="logout-btn"
            onClick={handleLogout}
            title={effectiveCollapsed ? 'Logout' : ''}
          >
            <span className="logout-icon">
              <LogoutIcon />
            </span>
            {!isCollapsed && <span className="logout-text">Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default DashboardSidebar;
