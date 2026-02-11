// API Client for Eco Flow
const API_BASE_URL = '/api';

export const apiClient = {
  async login(email, password) {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) {
      let error;
      try {
        error = await response.json();
      } catch (e) {
        // If response is not valid JSON, create a generic error
        error = { 
          message: `Server error (${response.status}). Please check if the backend server is running on port 3000.` 
        };
      }
      throw new Error(error.message || 'Login failed');
    }
    
    return await response.json();
  },

  async getData(endpoint) {
    const token = localStorage.getItem('userToken');
    const response = await fetch(`${API_BASE_URL}/data/${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch data');
    }
    
    return await response.json();
  },

  async sendCommand(device, state) {
    const token = localStorage.getItem('userToken');
    try {
      const response = await fetch(`${API_BASE_URL}/commands/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ device, state }),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Command failed' }));
        throw new Error(error.message || 'Command failed');
      }
      
      return await response.json();
    } catch (error) {
      if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        throw new Error('Cannot connect to server. Please make sure the backend server is running on port 5000.');
      }
      throw error;
    }
  },

  async getCommandStatus() {
    const token = localStorage.getItem('userToken');
    try {
      const response = await fetch(`${API_BASE_URL}/commands/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch command status');
      }
      
      return await response.json();
    } catch (error) {
      if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        throw new Error('Cannot connect to server. Please make sure the backend server is running on port 5000.');
      }
      throw error;
    }
  },

  async getPlantSummary({ sensorData, condition, attentionItems, language }) {
    const token = localStorage.getItem('userToken');
    const response = await fetch(`${API_BASE_URL}/summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ sensorData, condition, attentionItems, language }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { summary: null, fallback: true, error: data.error || 'Summary failed.' };
    }
    return data;
  },

  async getCardMeanings({ soil, temperature, humidity, language }) {
    const token = localStorage.getItem('userToken');
    const response = await fetch(`${API_BASE_URL}/summary/card-meanings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ soil, temperature, humidity, language }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.fallback) {
      return { fallback: true };
    }
    return data;
  },

  // Generic GET method for API calls
  async get(endpoint) {
    const token = localStorage.getItem('userToken');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch data' }));
      throw new Error(error.message || 'Failed to fetch data');
    }
    
    return await response.json();
  },

  async register(name, email, password, role) {
    const token = localStorage.getItem('userToken');
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ name, email, password, role }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Registration failed' }));
      throw new Error(error.message || 'Registration failed');
    }
    
    return await response.json();
  },

  async getUsers() {
    const token = localStorage.getItem('userToken');
    const response = await fetch(`${API_BASE_URL}/users`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch users' }));
      throw new Error(error.message || 'Failed to fetch users');
    }
    
    return await response.json();
  },

  async updateUser(userId, updates) {
    const token = localStorage.getItem('userToken');
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to update user' }));
      throw new Error(error.message || 'Failed to update user');
    }
    
    return await response.json();
  },

  async deleteUser(userId) {
    const token = localStorage.getItem('userToken');
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to delete user' }));
      throw new Error(error.message || 'Failed to delete user');
    }
    
    return await response.json();
  },
};
