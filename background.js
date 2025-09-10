// WhatsApp Web Login Manager - Background Script with Fingerprint System
console.log('🚀 WhatsApp Login Manager Extension installed');

// Import configuration
importScripts('config.js');

// Portal integration variables
let PORTAL_API_URL = 'http://localhost:8000';
let portalToken = null;
let deviceId = null;
let config = null;

let extensionId = null;
let browserId = null;

// Initialize configuration
async function initializeConfig() {
  try {
    config = await getConfig();
    PORTAL_API_URL = config.PORTAL_API_URL;
    console.log('Configuration loaded:', { PORTAL_API_URL });
  } catch (error) {
    console.error('Failed to load configuration, using defaults:', error);
    config = CONFIG;
  }
}

// Generate or retrieve unique browser ID
async function getBrowserId() {
  if (browserId) return browserId;
  
  try {
    const result = await chrome.storage.local.get(['browserId']);
    
    if (result.browserId) {
      browserId = result.browserId;
      console.log('📱 Retrieved existing browser ID:', browserId);
    } else {
      browserId = generateUniqueBrowserId();
      await chrome.storage.local.set({ browserId: browserId });
      console.log('🆕 Generated new browser ID:', browserId);
    }
    
    return browserId;
  } catch (error) {
    console.error('❌ Error managing browser ID:', error);
    browserId = generateUniqueBrowserId();
    return browserId;
  }
}

// Generate unique browser identifier
function generateUniqueBrowserId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const userAgent = navigator.userAgent.slice(-10).replace(/[^a-zA-Z0-9]/g, '');
  
  return `wplogin_${timestamp}_${random}_${userAgent}`;
}

// Get extension unique identifiers
async function getExtensionInfo() {
  try {
    if (!extensionId) {
      extensionId = chrome.runtime.id;
    }
    
    const browserIdValue = await getBrowserId();
    
    const extensionInfo = {
      extensionId: extensionId,
      browserId: browserIdValue,
      extensionType: 'wplogin',
      version: chrome.runtime.getManifest().version,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      platform: navigator.platform
    };
    
    console.log('🆔 Extension Info:', extensionInfo);
    return extensionInfo;
  } catch (error) {
    console.error('❌ Error getting extension info:', error);
    return {
      extensionId: extensionId || 'unknown',
      browserId: browserId || 'unknown',
      extensionType: 'wplogin',
      error: error.message
    };
  }
}

// Check WhatsApp Web status
async function checkWhatsAppStatus() {
  console.log('🔍 Checking WhatsApp Web status...');
  
  try {
    const tabs = await chrome.tabs.query({url: "https://web.whatsapp.com/*"});
    
    if (tabs.length === 0) {
      return {
        status: 'not_open',
        message: 'WhatsApp Web tab not found',
        tabs: 0
      };
    }
    
    const whatsappTab = tabs[0];
    console.log('✅ Found WhatsApp tab:', whatsappTab.id);
    
    const statusResults = await chrome.scripting.executeScript({
      target: { tabId: whatsappTab.id },
      func: checkWhatsAppWebStatus
    });
    
    if (statusResults && statusResults[0] && statusResults[0].result) {
      const status = statusResults[0].result;
      console.log('📊 WhatsApp status:', status);
      
      return {
        status: status.isReady ? 'ready' : 'loading',
        tabId: whatsappTab.id,
        url: whatsappTab.url,
        details: status,
        tabs: tabs.length
      };
    } else {
      return {
        status: 'unknown',
        message: 'Could not determine WhatsApp status',
        tabId: whatsappTab.id,
        tabs: tabs.length
      };
    }
    
  } catch (error) {
    console.error('❌ Error checking WhatsApp status:', error);
    return {
      status: 'error',
      message: error.message,
      tabs: 0
    };
  }
}

// Function that runs in WhatsApp Web to check status
function checkWhatsAppWebStatus() {
  try {
    const status = {
      url: window.location.href,
      title: document.title,
      timestamp: new Date().toISOString(),
      isReady: false,
      isLoggedIn: false,
      hasQRCode: false,
      canLogout: false,
      elements: {}
    };
    
    // Check if QR code is visible (not logged in)
    const qrCode = document.querySelector('[data-testid="qr-code"], canvas[aria-label*="QR"]');
    status.hasQRCode = !!qrCode;
    status.isLoggedIn = !qrCode;
    
    // Check for main app elements
    const app = document.querySelector('#app');
    const chatList = document.querySelector('[data-testid="chatlist"], [data-testid="chat-list"]');
    const menuButton = document.querySelector('[data-testid="menu"]');
    const buttons = document.querySelectorAll('button');
    
    status.elements = {
      app: !!app,
      chatList: !!chatList,
      menuButton: !!menuButton,
      buttons: buttons.length,
      qrCode: !!qrCode
    };
    
    // Can logout if logged in and menu is available
    status.canLogout = status.isLoggedIn && status.elements.menuButton;
    
    // Consider ready if basic elements are present
    status.isReady = status.elements.app && status.elements.buttons > 0;
    
    console.log('📱 WhatsApp Web Status Check:', status);
    return status;
    
  } catch (error) {
    return {
      isReady: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// WhatsApp Web Login Manager functionality
class BackgroundManager {
  constructor() {
    this.init();
  }

  init() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });

    chrome.action.onClicked.addListener((tab) => {
      this.handleIconClick(tab);
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdate(tabId, changeInfo, tab);
    });
  }

  async handleMessage(request, sender, sendResponse) {
    console.log('📨 Background received message:', request);
    
    try {
      switch (request.action) {
        case 'clearCookies':
          await this.clearWhatsAppCookies();
          console.log('✅ Cookies cleared successfully');
          sendResponse({ success: true });
          break;
          
        case 'checkWhatsAppTab':
          const whatsappTab = await this.findWhatsAppTab();
          console.log('✅ WhatsApp tab check completed', { found: !!whatsappTab });
          sendResponse({ success: true, data: whatsappTab });
          break;
          
        case 'executeInTab':
          const result = await this.executeInWhatsAppTab(request.script);
          sendResponse({ success: true, data: result });
          break;
          
        case 'openWhatsAppWeb':
          await this.openWhatsAppWeb();
          console.log('✅ WhatsApp Web opened');
          sendResponse({ success: true });
          break;
          
        case 'getStatus':
          console.log('📊 Status check requested');
          
          Promise.all([
            getExtensionInfo(),
            checkWhatsAppStatus()
          ]).then(([extensionInfo, whatsappStatus]) => {
            sendResponse({
              success: true,
              extensionInfo,
              whatsappStatus,
              timestamp: new Date().toISOString()
            });
          }).catch(error => {
            sendResponse({
              success: false,
              error: error.message
            });
          });
          return true;
          
        case 'signOut':
          const signOutResult = await this.performSignOut();
          sendResponse(signOutResult);
          break;
          
        default:
          console.warn('⚠️ Unknown action received', request.action);
          sendResponse({ success: false, message: 'Unknown action' });
      }
    } catch (error) {
      console.error('❌ Message handling failed:', error);
      sendResponse({ success: false, message: error.message });
    }
  }

  async handleIconClick(tab) {
    if (!tab.url.includes('web.whatsapp.com')) {
      await this.openWhatsAppWeb();
    }
  }

  async handleTabUpdate(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url?.includes('web.whatsapp.com')) {
      try {
        await this.updateExtensionIcon(tabId);
        setTimeout(sendHeartbeat, 2000); // Send heartbeat after page loads
      } catch (error) {
        console.log('Could not update extension icon:', error);
      }
    }
  }

  async clearWhatsAppCookies() {
    try {
      const cookies = await chrome.cookies.getAll({ domain: 'web.whatsapp.com' });
      
      for (const cookie of cookies) {
        await chrome.cookies.remove({
          url: `https://web.whatsapp.com${cookie.path}`,
          name: cookie.name
        });
      }

      const relatedDomains = ['whatsapp.com', '.whatsapp.com'];
      for (const domain of relatedDomains) {
        const domainCookies = await chrome.cookies.getAll({ domain });
        for (const cookie of domainCookies) {
          await chrome.cookies.remove({
            url: `https://${domain}${cookie.path}`,
            name: cookie.name
          });
        }
      }

      console.log('🍪 WhatsApp cookies cleared successfully');
    } catch (error) {
      console.error('❌ Failed to clear WhatsApp cookies:', error);
      throw error;
    }
  }

  async findWhatsAppTab() {
    try {
      const tabs = await chrome.tabs.query({ url: '*://web.whatsapp.com/*' });
      return tabs.length > 0 ? tabs[0] : null;
    } catch (error) {
      console.error('❌ Failed to find WhatsApp tab:', error);
      return null;
    }
  }

  async executeInWhatsAppTab(script) {
    try {
      const whatsappTab = await this.findWhatsAppTab();
      if (!whatsappTab) {
        throw new Error('WhatsApp Web tab not found');
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: whatsappTab.id },
        func: script
      });

      return results[0]?.result;
    } catch (error) {
      console.error('❌ Failed to execute script in WhatsApp tab:', error);
      throw error;
    }
  }

  async openWhatsAppWeb() {
    try {
      const existingTab = await this.findWhatsAppTab();
      
      if (existingTab) {
        await chrome.tabs.update(existingTab.id, { active: true });
        await chrome.windows.update(existingTab.windowId, { focused: true });
      } else {
        await chrome.tabs.create({ url: 'https://web.whatsapp.com' });
      }
    } catch (error) {
      console.error('❌ Failed to open WhatsApp Web:', error);
      throw error;
    }
  }

  async updateExtensionIcon(tabId) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const chatList = document.querySelector('[data-testid="chat-list"]');
          const landingWrapper = document.querySelector('.landing-wrapper, #initial_startup');
          return !landingWrapper && !!chatList;
        }
      });

      const isLoggedIn = results[0]?.result;

      if (isLoggedIn) {
        chrome.action.setBadgeText({ text: '●', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#25D366', tabId });
      } else {
        chrome.action.setBadgeText({ text: '○', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#FF0000', tabId });
      }
    } catch (error) {
      console.log('Could not update extension icon:', error);
      chrome.action.setBadgeText({ text: '', tabId });
    }
  }

  async performSignOut() {
    try {
      const whatsappTab = await this.findWhatsAppTab();
      if (!whatsappTab) {
        throw new Error('WhatsApp Web tab not found');
      }

      // Try to sign out via UI
      const signOutResult = await chrome.scripting.executeScript({
        target: { tabId: whatsappTab.id },
        func: () => {
          // Look for menu button and click it
          const menuButton = document.querySelector('[data-testid="menu"]');
          if (menuButton) {
            menuButton.click();
            
            // Wait for menu to appear and click logout
            setTimeout(() => {
              const logoutButton = document.querySelector('[data-testid="mi-logout"]');
              if (logoutButton) {
                logoutButton.click();
                return { success: true, method: 'ui' };
              }
            }, 1000);
          }
          return { success: false, method: 'ui' };
        }
      });

      // Fallback: clear cookies if UI method fails
      if (!signOutResult[0]?.result?.success) {
        await this.clearWhatsAppCookies();
        
        // Reload the tab
        await chrome.tabs.reload(whatsappTab.id);
        
        return { success: true, method: 'cookies' };
      }

      return signOutResult[0].result;
    } catch (error) {
      console.error('❌ Sign out failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// ===========================================
// BROWSER FINGERPRINTING & TRACKING SYSTEM
// ===========================================

// Generate comprehensive browser fingerprint for tracking
async function generateBrowserFingerprint() {
  try {
    const browserIdValue = await getBrowserId();
    const manifest = chrome.runtime.getManifest();
    
    const platformInfo = await chrome.runtime.getPlatformInfo();
    
    let currentTab = null;
    let publicIP = null;
    
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      currentTab = tabs[0];
    } catch (e) {
      console.log('Could not get current tab info');
    }
    
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      publicIP = data.ip;
    } catch (e) {
      console.log('Could not get public IP');
    }
    
    const stored = await chrome.storage.local.get(['browserFingerprint', 'profileInstallId']);
    const existingFingerprint = stored.browserFingerprint || {};
    
    // Generate or retrieve profile-specific install ID
    let profileInstallId = stored.profileInstallId;
    if (!profileInstallId) {
      profileInstallId = 'profile_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
      await chrome.storage.local.set({ profileInstallId });
      console.log('🆕 Generated new profile install ID:', profileInstallId);
    }
    
    // Get Chrome profile information
    let chromeProfileInfo = {};
    try {
      // Get all installed extensions to create a unique profile signature
      const extensions = await chrome.management.getAll();
      const extensionIds = extensions
        .filter(ext => ext.enabled && ext.type === 'extension')
        .map(ext => ext.id)
        .sort();
      
      chromeProfileInfo = {
        installed_extensions_count: extensionIds.length,
        profile_signature: extensionIds.slice(0, 5).join('|'), // First 5 extension IDs as profile signature
        our_extension_index: extensionIds.indexOf(chrome.runtime.id)
      };
    } catch (e) {
      console.log('Could not get Chrome profile info');
    }
    
    const fingerprint = {
      // Unique identifiers
      browser_id: browserIdValue,
      extension_id: chrome.runtime.id,
      extension_type: 'wplogin', // Important: distinguish extension type
      session_id: 'session_' + Date.now(),
      profile_install_id: profileInstallId, // Unique per Chrome profile installation
      
      // Network info
      public_ip: publicIP,
      user_agent: navigator.userAgent,
      
      // System info
      platform: platformInfo.os,
      os_version: platformInfo.arch,
      browser_name: 'Chrome',
      browser_version: navigator.userAgent.match(/Chrome\/([0-9\.]+)/)?.[1] || 'Unknown',
      
      // Screen and locale info (fallback for service worker)
      screen_resolution: '1920x1080', // Default fallback since screen is not available in service worker
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: chrome.i18n.getUILanguage(),
      
      // Extension specific
      extension_version: manifest.version,
      install_date: existingFingerprint.install_date || new Date().toISOString(),
      
      // Current activity
      current_url: currentTab?.url || null,
      
      // Activity tracking (preserve existing values)
      total_requests: existingFingerprint.total_requests || 0,
      qr_codes_sent: existingFingerprint.qr_codes_sent || 0,
      signouts_performed: existingFingerprint.signouts_performed || 0,
      last_seen: new Date().toISOString(),
      
      // Additional metadata including Chrome profile info
      metadata: {
        manifest_version: manifest.manifest_version,
        permissions: manifest.permissions,
        host_permissions: manifest.host_permissions,
        tab_id: currentTab?.id || null,
        window_id: currentTab?.windowId || null,
        incognito: currentTab?.incognito || false,
        extension_type: 'wplogin',
        chrome_profile_info: chromeProfileInfo,
        profile_install_id: profileInstallId
      }
    };
    
    // Generate hash for deduplication (including profile install ID for uniqueness)
    const fingerprintString = JSON.stringify({
      browser_id: fingerprint.browser_id,
      extension_id: fingerprint.extension_id,
      extension_type: fingerprint.extension_type,
      platform: fingerprint.platform,
      user_agent: fingerprint.user_agent,
      screen_resolution: fingerprint.screen_resolution,
      timezone: fingerprint.timezone,
      profile_install_id: profileInstallId,
      profile_signature: chromeProfileInfo.profile_signature || 'unknown'
    });
    
    fingerprint.fingerprint_hash = btoa(fingerprintString).replace(/[^a-zA-Z0-9]/g, '').substring(0, 64);
    
    // Store fingerprint
    await chrome.storage.local.set({ browserFingerprint: fingerprint });
    
    console.log('🔍 Generated comprehensive browser fingerprint:', {
      browser_id: fingerprint.browser_id,
      extension_id: fingerprint.extension_id,
      extension_type: fingerprint.extension_type,
      platform: fingerprint.platform,
      public_ip: fingerprint.public_ip,
      profile_install_id: profileInstallId,
      profile_signature: chromeProfileInfo.profile_signature,
      installed_extensions: chromeProfileInfo.installed_extensions_count,
      fingerprint_hash: fingerprint.fingerprint_hash
    });
    
    return fingerprint;
  } catch (error) {
    console.error('❌ Error generating comprehensive browser fingerprint:', error);
    return null;
  }
}

// Send fingerprint to backend for tracking
async function registerBrowserFingerprint() {
  console.log('🚀 [DEBUG] Starting registerBrowserFingerprint...');
  
  try {
    console.log('🔍 [DEBUG] Generating fingerprint...');
    const fingerprint = await generateBrowserFingerprint();
    
    if (!fingerprint) {
      console.error('❌ [DEBUG] Fingerprint generation failed - fingerprint is null');
      return;
    }
    
    console.log('✅ [DEBUG] Fingerprint generated successfully');
    console.log('📊 [DEBUG] Fingerprint data structure:', {
      browser_id: fingerprint.browser_id,
      extension_id: fingerprint.extension_id,
      extension_type: fingerprint.extension_type,
      public_ip: fingerprint.public_ip,
      fingerprint_hash: fingerprint.fingerprint_hash,
      dataSize: JSON.stringify(fingerprint).length
    });
    
    console.log('🌐 [DEBUG] Preparing API request to:', `${PORTAL_API_URL}/api/fingerprint/register`);
    
    // Prepare headers - add auth only if token is available
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (portalToken) {
      console.log('🔐 [DEBUG] Adding authorization token to headers');
      headers['Authorization'] = `Bearer ${portalToken}`;
    } else {
      console.log('⚠️ [DEBUG] No portal token available, proceeding without auth');
    }
    
    console.log('📋 [DEBUG] Request headers prepared:', Object.keys(headers));
    console.log('📤 [DEBUG] Making POST request...');
    
    const requestBody = JSON.stringify(fingerprint);
    console.log('📦 [DEBUG] Request body size:', requestBody.length, 'bytes');
    
    const response = await fetch(`${PORTAL_API_URL}/api/fingerprint/register`, {
      method: 'POST',
      headers: headers,
      body: requestBody
    });
    
    console.log('🔄 [DEBUG] Response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ [DEBUG] Registration successful, response data:', data);
      console.log('✅ Browser fingerprint registered successfully');
    } else {
      console.error('❌ [DEBUG] Registration failed with status:', response.status);
      console.error('❌ [DEBUG] Status text:', response.statusText);
      
      let errorText = '';
      try {
        errorText = await response.text();
        console.error('❌ [DEBUG] Error response body:', errorText);
      } catch (textError) {
        console.error('❌ [DEBUG] Could not read error response body:', textError);
      }
      
      console.error('❌ Failed to register browser fingerprint:', response.statusText);
    }
  } catch (error) {
    console.error('❌ [DEBUG] Exception caught in registerBrowserFingerprint:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    console.error('❌ Error registering browser fingerprint:', error);
  }
  
  console.log('🏁 [DEBUG] registerBrowserFingerprint completed');
}

// ===========================================
// HEARTBEAT SYSTEM
// ===========================================

let heartbeatInterval = null;
let currentExtensionStatus = {
  status: 'alive',
  can_logout: false,
  last_url: null,
  whatsapp_connected: false
};

// Send heartbeat to backend
async function sendHeartbeat() {
  try {
    const browserIdValue = await getBrowserId();
    if (!browserIdValue) {
      console.error('❌ No browser ID available for heartbeat');
      return;
    }

    // Check WhatsApp Web status
    const whatsappStatus = await checkWhatsAppWebStatus();
    currentExtensionStatus.can_logout = whatsappStatus.can_logout;
    currentExtensionStatus.whatsapp_connected = whatsappStatus.is_connected;
    currentExtensionStatus.last_url = whatsappStatus.current_url;
    
    // Try to extract QR code if not logged in
    let qrCodeData = null;
    let qrCodeAvailable = false;
    if (!whatsappStatus.is_connected) {
      try {
        console.log('🔍 Checking for QR code...');
        qrCodeData = await extractQRCodeFromTab();
        qrCodeAvailable = !!qrCodeData;
        if (qrCodeAvailable) {
          console.log('📱 QR code detected and extracted');
        }
      } catch (error) {
        console.log('⚠️ Could not extract QR code:', error.message);
      }
    }
    
    const heartbeatData = {
      status: currentExtensionStatus.status,
      can_logout: currentExtensionStatus.can_logout,
      current_url: currentExtensionStatus.last_url,
      qr_code_available: qrCodeAvailable,
      qr_code_data: qrCodeData,
      metadata: {
        whatsapp_connected: currentExtensionStatus.whatsapp_connected,
        extension_version: chrome.runtime.getManifest().version,
        extension_type: 'wplogin',
        timestamp: new Date().toISOString(),
        qr_code_timestamp: qrCodeAvailable ? new Date().toISOString() : null
      }
    };
    
    // Prepare headers - add auth only if token is available
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (portalToken) {
      headers['Authorization'] = `Bearer ${portalToken}`;
    }
    
    const response = await fetch(`${PORTAL_API_URL}/api/fingerprint/${browserIdValue}/heartbeat`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(heartbeatData)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`💓 Heartbeat sent successfully - Next in ${data.next_heartbeat_in}s`);
    } else {
      console.error('❌ Failed to send heartbeat:', response.statusText);
      const errorText = await response.text();
      console.error('Heartbeat error details:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Error sending heartbeat:', error);
  }
}

// Extract QR code from WhatsApp Web tab
async function extractQRCodeFromTab() {
  try {
    // Find the WhatsApp Web tab
    const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
    if (tabs.length === 0) {
      throw new Error('No WhatsApp Web tab found');
    }
    
    const whatsappTab = tabs[0];
    console.log('🎯 Found WhatsApp Web tab:', whatsappTab.id);
    
    // Send message to content script to extract QR code
    const response = await chrome.tabs.sendMessage(whatsappTab.id, {
      action: 'extractQRCode'
    });
    
    if (response && response.success && response.data) {
      console.log('✅ QR code extracted successfully');
      return response.data;
    } else {
      console.log('❌ QR code extraction failed or no QR code found');
      return null;
    }
  } catch (error) {
    console.error('❌ Error extracting QR code from tab:', error);
    return null;
  }
}

// Check WhatsApp Web status for heartbeat
async function checkWhatsAppWebStatus() {
  try {
    const tabs = await chrome.tabs.query({ url: '*://web.whatsapp.com/*' });
    
    if (tabs.length === 0) {
      return {
        is_connected: false,
        can_logout: false,
        current_url: null,
        status: 'no_whatsapp_tab'
      };
    }
    
    const whatsappTab = tabs[0];
    
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: whatsappTab.id },
        func: () => {
          // Check if QR code is present (not logged in)
          const qrCode = document.querySelector('canvas[aria-label*="QR"], div[data-testid="qr-code"]');
          const isQRVisible = qrCode && qrCode.offsetParent !== null;
          
          // Check if logged in (chat interface visible)
          const chatInterface = document.querySelector('[data-testid="chat"], #app .two');
          const isLoggedIn = chatInterface !== null;
          
          // Check if can logout (menu button available)
          const menuButton = document.querySelector('[data-testid="menu"]');
          const canLogout = isLoggedIn && menuButton !== null;
          
          // Check if loading
          const loadingElements = document.querySelectorAll('[data-testid="loader"], .landing-window, ._2Uo0Z');
          const isLoading = Array.from(loadingElements).some(el => el.offsetParent !== null);
          
          return {
            has_qr: isQRVisible,
            is_logged_in: isLoggedIn,
            can_logout: canLogout,
            is_loading: isLoading,
            url: window.location.href
          };
        }
      });
      
      if (results && results[0] && results[0].result) {
        const result = results[0].result;
        return {
          is_connected: result.is_logged_in,
          can_logout: result.can_logout,
          current_url: result.url,
          status: result.is_logged_in ? 'connected' : (result.has_qr ? 'ready_for_login' : 'loading')
        };
      }
      
    } catch (scriptError) {
      console.log('Could not execute script on WhatsApp tab:', scriptError.message);
    }
    
    return {
      is_connected: false,
      can_logout: false,
      current_url: whatsappTab.url,
      status: 'unknown'
    };
    
  } catch (error) {
    console.error('Error checking WhatsApp Web status:', error);
    return {
      is_connected: false,
      can_logout: false,
      current_url: null,
      status: 'error'
    };
  }
}

// Start heartbeat system
function startHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  
  console.log('💓 Starting heartbeat system...');
  
  sendHeartbeat();
  heartbeatInterval = setInterval(sendHeartbeat, 30000);
}

// Stop heartbeat system
function stopHeartbeat() {
  if (heartbeatInterval) {
    console.log('💓 Stopping heartbeat system...');
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    
    currentExtensionStatus.status = 'offline';
    sendHeartbeat();
  }
}

// ===========================================
// EXTENSION LIFECYCLE & INITIALIZATION
// ===========================================

chrome.runtime.onStartup.addListener(async () => {
  console.log('🚀 Extension startup event');
  await initializeConfig();
  await registerBrowserFingerprint();
  startHeartbeat();
});

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('🚀 Extension installed/updated:', details.reason);
  await initializeConfig();
  await registerBrowserFingerprint();
  startHeartbeat();
});

chrome.runtime.onSuspend.addListener(() => {
  console.log('😴 Extension suspending');
  stopHeartbeat();
});

chrome.runtime.onSuspendCanceled.addListener(() => {
  console.log('😊 Extension suspend canceled');
  startHeartbeat();
});

// Tab updates - restart heartbeat when WhatsApp Web is opened/closed
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('web.whatsapp.com')) {
    console.log('📱 WhatsApp Web tab updated, refreshing heartbeat');
    setTimeout(sendHeartbeat, 2000);
  }
});

// Initialize the background manager and extension
const backgroundManager = new BackgroundManager();

// Initialize extension immediately when script loads
(async function initializeExtension() {
  console.log('🎯 [DEBUG] Starting Wplogin extension initialization...');
  
  try {
    console.log('⚙️ [DEBUG] Calling initializeConfig()...');
    await initializeConfig();
    console.log('✅ [DEBUG] Config initialized successfully');
    
    console.log('🔍 [DEBUG] Calling registerBrowserFingerprint()...');
    await registerBrowserFingerprint();
    console.log('✅ [DEBUG] Browser fingerprint registration process completed');
    
    console.log('💓 [DEBUG] Starting heartbeat system...');
    startHeartbeat();
    console.log('✅ [DEBUG] Heartbeat system started successfully');
    
    console.log('🎉 [DEBUG] Wplogin extension initialization complete!');
    
  } catch (error) {
    console.error('❌ [DEBUG] Extension initialization failed with error:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  }
})();

console.log('✅ WhatsApp Login Manager background script loaded and ready');