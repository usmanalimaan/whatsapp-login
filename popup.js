// WhatsApp Web Login Manager - Popup Script
class PopupManager {
  constructor() {
    this.currentTab = null;
    this.isWhatsAppTab = false;
    this.init();
  }

  async init() {
    console.log('WhatsApp Web Manager Popup: Initializing...');
    
    // Get current active tab
    await this.getCurrentTab();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Initial status check
    await this.checkStatus();
  }

  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
      this.isWhatsAppTab = tab?.url?.includes('web.whatsapp.com') || false;
      console.log('Current tab:', this.isWhatsAppTab ? 'WhatsApp Web' : 'Other');
    } catch (error) {
      console.error('Failed to get current tab:', error);
      this.showError('Failed to detect current tab');
    }
  }

  setupEventListeners() {
    // Refresh status button
    document.getElementById('refreshBtn').addEventListener('click', () => {
      this.checkStatus();
    });

    // Sign out button
    document.getElementById('signOutBtn').addEventListener('click', () => {
      this.performSignOut();
    });

    // Open WhatsApp Web button
    document.getElementById('openWhatsAppBtn').addEventListener('click', () => {
      this.openWhatsAppWeb();
    });

    // Refresh QR code button
    document.getElementById('refreshQRBtn').addEventListener('click', () => {
      this.refreshQRCode();
    });
  }

  async checkStatus() {
    this.showLoading(true);
    this.hideMessages();

    try {
      if (!this.isWhatsAppTab) {
        // Not on WhatsApp Web - check if there's a WhatsApp tab open
        const whatsappTab = await this.findWhatsAppTab();
        if (whatsappTab) {
          this.currentTab = whatsappTab;
          this.isWhatsAppTab = true;
        } else {
          this.showNotOnWhatsApp();
          return;
        }
      }

      // Check login status via content script
      const response = await this.sendMessageToContentScript('checkLoginStatus');
      
      if (response.success) {
        this.displayStatus(response.data);
        
        // If not logged in and no QR code, try to extract QR code
        if (!response.data.isLoggedIn && !response.data.hasQRCode) {
          setTimeout(() => this.extractQRCode(), 1000);
        } else if (response.data.hasQRCode) {
          this.extractQRCode();
        }
      } else {
        throw new Error(response.message || 'Failed to check status');
      }
    } catch (error) {
      console.error('Status check failed:', error);
      this.showError('Failed to check WhatsApp status. Please refresh the page and try again.');
    } finally {
      this.showLoading(false);
    }
  }

  async findWhatsAppTab() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'checkWhatsAppTab' });
      return response.success ? response.data : null;
    } catch (error) {
      console.error('Failed to find WhatsApp tab:', error);
      return null;
    }
  }

  async sendMessageToContentScript(action, data = {}) {
    if (!this.currentTab) {
      throw new Error('No active tab found');
    }

    return new Promise((resolve) => {
      chrome.tabs.sendMessage(
        this.currentTab.id,
        { action, ...data },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, message: chrome.runtime.lastError.message });
          } else {
            resolve(response || { success: false, message: 'No response received' });
          }
        }
      );
    });
  }

  displayStatus(status) {
    const statusSection = document.getElementById('statusSection');
    const statusDot = document.getElementById('statusDot');
    const statusTitle = document.getElementById('statusTitle');
    const statusSubtitle = document.getElementById('statusSubtitle');
    const signOutBtn = document.getElementById('signOutBtn');
    const qrSection = document.getElementById('qrSection');

    statusSection.classList.remove('hidden');

    if (status.isLoading) {
      statusDot.className = 'status-dot';
      statusTitle.textContent = 'Loading...';
      statusSubtitle.textContent = 'WhatsApp Web is starting up';
      signOutBtn.classList.add('hidden');
      qrSection.classList.add('hidden');
    } else if (status.isLoggedIn) {
      statusDot.className = 'status-dot online';
      statusTitle.textContent = 'Logged In';
      statusSubtitle.textContent = status.username || 'WhatsApp Web is active';
      signOutBtn.classList.remove('hidden');
      qrSection.classList.add('hidden');
    } else {
      statusDot.className = 'status-dot offline';
      statusTitle.textContent = 'Logged Out';
      statusSubtitle.textContent = 'Please scan QR code to login';
      signOutBtn.classList.add('hidden');
      
      if (status.hasQRCode) {
        qrSection.classList.remove('hidden');
      }
    }
  }

  showNotOnWhatsApp() {
    const statusSection = document.getElementById('statusSection');
    const statusDot = document.getElementById('statusDot');
    const statusTitle = document.getElementById('statusTitle');
    const statusSubtitle = document.getElementById('statusSubtitle');
    const signOutBtn = document.getElementById('signOutBtn');
    const openWhatsAppBtn = document.getElementById('openWhatsAppBtn');
    const qrSection = document.getElementById('qrSection');

    statusSection.classList.remove('hidden');
    statusDot.className = 'status-dot';
    statusTitle.textContent = 'WhatsApp Web Not Open';
    statusSubtitle.textContent = 'Open WhatsApp Web to manage your session';
    signOutBtn.classList.add('hidden');
    openWhatsAppBtn.classList.remove('hidden');
    qrSection.classList.add('hidden');
  }

  async performSignOut() {
    const signOutBtn = document.getElementById('signOutBtn');
    const originalText = signOutBtn.textContent;
    
    try {
      signOutBtn.disabled = true;
      signOutBtn.textContent = 'Signing out...';
      
      const response = await this.sendMessageToContentScript('performSignOut');
      
      if (response.success) {
        this.showSuccess('Successfully signed out of WhatsApp Web');
        // Refresh status after a delay
        setTimeout(() => this.checkStatus(), 2000);
      } else {
        throw new Error(response.message || 'Sign out failed');
      }
    } catch (error) {
      console.error('Sign out failed:', error);
      this.showError('Failed to sign out. Please try again or manually log out from WhatsApp Web.');
    } finally {
      signOutBtn.disabled = false;
      signOutBtn.textContent = originalText;
    }
  }

  async openWhatsAppWeb() {
    try {
      await chrome.runtime.sendMessage({ action: 'openWhatsAppWeb' });
      // Close the popup after opening WhatsApp Web
      window.close();
    } catch (error) {
      console.error('Failed to open WhatsApp Web:', error);
      this.showError('Failed to open WhatsApp Web');
    }
  }

  async extractQRCode() {
    try {
      const response = await this.sendMessageToContentScript('extractQRCode');
      
      if (response.success && response.data) {
        this.displayQRCode(response.data);
      } else {
        this.showQRPlaceholder();
      }
    } catch (error) {
      console.error('Failed to extract QR code:', error);
      this.showQRPlaceholder();
    }
  }

  displayQRCode(dataURL) {
    const qrSection = document.getElementById('qrSection');
    const qrCodeImage = document.getElementById('qrCodeImage');
    const qrPlaceholder = document.getElementById('qrPlaceholder');

    qrSection.classList.remove('hidden');
    qrCodeImage.src = dataURL;
    qrCodeImage.classList.remove('hidden');
    qrPlaceholder.classList.add('hidden');
  }

  showQRPlaceholder() {
    const qrSection = document.getElementById('qrSection');
    const qrCodeImage = document.getElementById('qrCodeImage');
    const qrPlaceholder = document.getElementById('qrPlaceholder');

    qrSection.classList.remove('hidden');
    qrCodeImage.classList.add('hidden');
    qrPlaceholder.classList.remove('hidden');
    qrPlaceholder.textContent = 'QR Code not available';
  }

  async refreshQRCode() {
    const refreshQRBtn = document.getElementById('refreshQRBtn');
    const originalText = refreshQRBtn.textContent;
    
    try {
      refreshQRBtn.disabled = true;
      refreshQRBtn.textContent = 'Opening new tab...';
      
      // Open new WhatsApp Web tab specifically for QR refresh
      const response = await chrome.runtime.sendMessage({ 
        action: 'openNewWhatsAppTab',
        purpose: 'qr_refresh'
      });
      
      if (response.success) {
        const newTab = response.data;
        
        this.showSuccess(`New tab opened for QR refresh (Tab ID: ${newTab.id})`);
        
        // Update button to show tab management options
        refreshQRBtn.textContent = 'New tab opened';
        
        // Add tab management buttons
        this.addTabManagementUI(newTab);
        
        // Monitor the new tab for QR code
        setTimeout(() => this.monitorNewTab(newTab), 3000);
        
      } else {
        throw new Error(response.message || 'Failed to open new tab');
      }
      
    } catch (error) {
      console.error('Failed to refresh QR code:', error);
      this.showError('Failed to open new tab for QR refresh');
    } finally {
      setTimeout(() => {
        refreshQRBtn.disabled = false;
        refreshQRBtn.textContent = originalText;
      }, 2000);
    }
  }

  addTabManagementUI(newTab) {
    const qrSection = document.getElementById('qrSection');
    
    // Remove existing tab management if present
    const existingMgmt = qrSection.querySelector('.tab-management');
    if (existingMgmt) existingMgmt.remove();
    
    // Create tab management section
    const tabMgmt = document.createElement('div');
    tabMgmt.className = 'tab-management';
    tabMgmt.style.cssText = `
      margin-top: 16px;
      padding: 12px;
      background: #f0f2f5;
      border-radius: 8px;
      border-left: 4px solid #25d366;
    `;
    
    tabMgmt.innerHTML = `
      <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px;">
        Managed Tab: ${newTab.uniqueId}
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button id="focusNewTab" class="btn btn-secondary" style="font-size: 11px; padding: 6px 10px;">
          Focus Tab
        </button>
        <button id="extractFromNewTab" class="btn btn-secondary" style="font-size: 11px; padding: 6px 10px;">
          Extract QR
        </button>
        <button id="closeNewTab" class="btn btn-secondary" style="font-size: 11px; padding: 6px 10px;">
          Close Tab
        </button>
      </div>
      <div id="tabStatus" style="font-size: 11px; color: #8696a0; margin-top: 8px;">
        Status: Initializing...
      </div>
    `;
    
    qrSection.appendChild(tabMgmt);
    
    // Add event listeners for tab management
    document.getElementById('focusNewTab').addEventListener('click', () => {
      this.focusTab(newTab.id);
    });
    
    document.getElementById('extractFromNewTab').addEventListener('click', () => {
      this.extractQRFromTab(newTab.id);
    });
    
    document.getElementById('closeNewTab').addEventListener('click', () => {
      this.closeTab(newTab.id);
    });
    
    // Store tab info for later use
    this.managedTab = newTab;
  }

  async focusTab(tabId) {
    try {
      await chrome.runtime.sendMessage({ 
        action: 'focusTab',
        tabId: tabId
      });
      this.showSuccess('Tab focused');
    } catch (error) {
      this.showError('Failed to focus tab');
    }
  }

  async extractQRFromTab(tabId) {
    try {
      const extractBtn = document.getElementById('extractFromNewTab');
      const originalText = extractBtn.textContent;
      extractBtn.disabled = true;
      extractBtn.textContent = 'Extracting...';
      
      // Send message to specific tab to extract QR code
      const response = await chrome.tabs.sendMessage(tabId, { action: 'extractQRCode' });
      
      if (response && response.success && response.data) {
        this.displayQRCode(response.data);
        this.showSuccess('QR code extracted from new tab');
        document.getElementById('tabStatus').textContent = 'Status: QR code extracted';
      } else {
        this.showError('No QR code found in the new tab');
        document.getElementById('tabStatus').textContent = 'Status: No QR code found';
      }
      
      extractBtn.disabled = false;
      extractBtn.textContent = originalText;
      
    } catch (error) {
      console.error('Failed to extract QR from tab:', error);
      this.showError('Failed to extract QR code from tab');
      document.getElementById('tabStatus').textContent = 'Status: Extraction failed';
    }
  }

  async closeTab(tabId) {
    try {
      await chrome.runtime.sendMessage({ 
        action: 'closeTab',
        tabId: tabId
      });
      
      // Remove tab management UI
      const tabMgmt = document.querySelector('.tab-management');
      if (tabMgmt) tabMgmt.remove();
      
      this.showSuccess('Managed tab closed');
      this.managedTab = null;
      
    } catch (error) {
      this.showError('Failed to close tab');
    }
  }

  async monitorNewTab(newTab) {
    try {
      // Check tab status
      const tabInfo = await chrome.runtime.sendMessage({
        action: 'getTabInfo',
        tabId: newTab.id
      });
      
      if (tabInfo && tabInfo.success) {
        const statusElement = document.getElementById('tabStatus');
        if (statusElement) {
          statusElement.textContent = `Status: ${tabInfo.data.status} - ${tabInfo.data.title}`;
        }
        
        // Try to extract QR code automatically after a delay
        setTimeout(() => {
          this.extractQRFromTab(newTab.id);
        }, 5000);
      }
      
    } catch (error) {
      console.error('Failed to monitor new tab:', error);
    }
  }

  showLoading(show) {
    const loadingState = document.getElementById('loadingState');
    const statusSection = document.getElementById('statusSection');
    const qrSection = document.getElementById('qrSection');

    if (show) {
      loadingState.classList.remove('hidden');
      statusSection.classList.add('hidden');
      qrSection.classList.add('hidden');
    } else {
      loadingState.classList.add('hidden');
    }
  }

  showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      errorMessage.classList.add('hidden');
    }, 5000);
  }

  showSuccess(message) {
    const successMessage = document.getElementById('successMessage');
    successMessage.textContent = message;
    successMessage.classList.remove('hidden');
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      successMessage.classList.add('hidden');
    }, 3000);
  }

  hideMessages() {
    document.getElementById('errorMessage').classList.add('hidden');
    document.getElementById('successMessage').classList.add('hidden');
  }

  async toggleDiagnostics() {
    const diagnosticsSection = document.getElementById('diagnosticsSection');
    const diagnosticsBtn = document.getElementById('diagnosticsBtn');
    
    if (diagnosticsSection.classList.contains('hidden')) {
      diagnosticsSection.classList.remove('hidden');
      diagnosticsBtn.textContent = 'Hide Diagnostics';
      await this.loadDiagnostics();
    } else {
      diagnosticsSection.classList.add('hidden');
      diagnosticsBtn.textContent = 'View Diagnostics';
    }
  }

  async loadDiagnostics() {
    const diagnosticsContent = document.getElementById('diagnosticsContent');
    
    try {
      // Get logs from content script
      const logsResponse = await this.sendMessageToContentScript('getLogs');
      
      // Get general diagnostics if available
      let diagnostics = {};
      try {
        const diagResponse = await this.sendMessageToContentScript('getDiagnosticInfo');
        if (diagResponse.success) {
          diagnostics = diagResponse.data;
        }
      } catch (e) {
        // Diagnostics may not be available
      }

      const logs = logsResponse.success ? logsResponse.data : [];
      
      let content = `<strong>Extension Status:</strong><br>`;
      content += `Tab: ${this.isWhatsAppTab ? 'WhatsApp Web' : 'Other'}<br>`;
      content += `Timestamp: ${new Date().toISOString()}<br><br>`;
      
      if (Object.keys(diagnostics).length > 0) {
        content += `<strong>Detection Methods:</strong><br>`;
        content += `${JSON.stringify(diagnostics.detectionMethods || [], null, 2)}<br><br>`;
      }
      
      content += `<strong>Recent Logs (${logs.length}):</strong><br>`;
      
      if (logs.length === 0) {
        content += `<em>No logs available</em><br>`;
      } else {
        logs.slice(-10).forEach(log => {
          const time = new Date(log.timestamp).toLocaleTimeString();
          content += `[${time}] ${log.level}: ${log.message}<br>`;
          if (log.data && typeof log.data === 'object') {
            content += `  Data: ${JSON.stringify(log.data).substring(0, 100)}...<br>`;
          }
        });
      }
      
      diagnosticsContent.innerHTML = content;
    } catch (error) {
      diagnosticsContent.innerHTML = `<strong>Error loading diagnostics:</strong><br>${error.message}`;
    }
  }

  async clearLogs() {
    try {
      const response = await this.sendMessageToContentScript('clearLogs');
      if (response.success) {
        this.showSuccess('Logs cleared successfully');
        await this.loadDiagnostics();
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      this.showError('Failed to clear logs: ' + error.message);
    }
  }

  async exportLogs() {
    try {
      const response = await this.sendMessageToContentScript('getLogs');
      if (response.success) {
        const logs = response.data;
        const exportData = {
          timestamp: new Date().toISOString(),
          extension: 'WhatsApp Web Login Manager',
          version: '1.0.0',
          tab: this.currentTab?.url || 'unknown',
          logs: logs
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        // Create temporary download link
        const link = document.createElement('a');
        link.href = url;
        link.download = `whatsapp-manager-logs-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        this.showSuccess('Logs exported successfully');
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      this.showError('Failed to export logs: ' + error.message);
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});