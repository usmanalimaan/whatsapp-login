// Configuration for WhatsApp Login Manager Extension
const CONFIG = {
  // Default API URL - can be overridden by options page
  PORTAL_API_URL: 'http://localhost:8000',
  
  // WebSocket URL
  PORTAL_WS_URL: 'http://localhost:8000',
  
  // API endpoints
  API_ENDPOINTS: {
    AUTH: '/api/auth',
    DEVICES: '/api/devices',
    CREDITS: '/api/credits'
  },
  
  // Extension settings
  QR_CHECK_INTERVAL: 5000, // 5 seconds
  CONNECTION_TIMEOUT: 10000, // 10 seconds
  
  // Default credit costs
  CREDIT_COSTS: {
    QR_GENERATION: 1,
    MESSAGE_SEND: 2
  },
  
  // Extension type identifier
  EXTENSION_TYPE: 'wplogin'
};

// Function to get configuration from storage or return default
async function getConfig() {
  try {
    const stored = await chrome.storage.sync.get(['extensionConfig']);
    return { ...CONFIG, ...stored.extensionConfig };
  } catch (error) {
    console.log('Using default configuration');
    return CONFIG;
  }
}

// Function to update configuration
async function updateConfig(updates) {
  try {
    const current = await getConfig();
    const newConfig = { ...current, ...updates };
    await chrome.storage.sync.set({ extensionConfig: newConfig });
    return newConfig;
  } catch (error) {
    console.error('Failed to update configuration:', error);
    return CONFIG;
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONFIG, getConfig, updateConfig };
}