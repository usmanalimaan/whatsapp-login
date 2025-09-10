// WhatsApp Web Login Manager - Content Script
class Logger {
  static log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      url: window.location.href,
      userAgent: navigator.userAgent.substring(0, 100)
    };
    
    console[level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'](
      `[WhatsApp Manager ${level}] ${timestamp}: ${message}`,
      data || ''
    );
    
    // Store logs for audit trail
    this.storeLogs(logEntry);
  }
  
  static storeLogs(logEntry) {
    try {
      const logs = JSON.parse(localStorage.getItem('wa_manager_logs') || '[]');
      logs.push(logEntry);
      // Keep only last 100 logs
      if (logs.length > 100) logs.splice(0, logs.length - 100);
      localStorage.setItem('wa_manager_logs', JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to store log:', e);
    }
  }
  
  static getLogs() {
    try {
      return JSON.parse(localStorage.getItem('wa_manager_logs') || '[]');
    } catch (e) {
      return [];
    }
  }
  
  static clearLogs() {
    localStorage.removeItem('wa_manager_logs');
  }
}

Logger.log('INFO', 'WhatsApp Web Login Manager: Content script initializing');

class WhatsAppWebManager {
  constructor() {
    this.retryCount = 0;
    this.maxRetries = 3;
    this.detectionMethods = [];
    this.lastStatus = null;
    this.init();
  }

  init() {
    try {
      Logger.log('INFO', 'Initializing WhatsApp Web Manager');
      
      // Listen for messages from popup
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        this.handleMessage(request, sender, sendResponse);
        return true; // Keep the message channel open for async response
      });
      
      // Monitor DOM changes for status updates
      this.setupDOMObserver();
      
      Logger.log('INFO', 'WhatsApp Web Manager initialized successfully');
    } catch (error) {
      Logger.log('ERROR', 'Failed to initialize WhatsApp Web Manager', error);
    }
  }

  setupDOMObserver() {
    try {
      const observer = new MutationObserver((mutations) => {
        // Debounce status checks
        clearTimeout(this.statusCheckTimeout);
        this.statusCheckTimeout = setTimeout(() => {
          this.checkStatusChange();
        }, 1000);
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'data-testid']
      });
      
      Logger.log('INFO', 'DOM observer setup complete');
    } catch (error) {
      Logger.log('ERROR', 'Failed to setup DOM observer', error);
    }
  }

  async checkStatusChange() {
    try {
      const currentStatus = await this.checkLoginStatus();
      if (JSON.stringify(currentStatus) !== JSON.stringify(this.lastStatus)) {
        Logger.log('INFO', 'Status change detected', {
          previous: this.lastStatus,
          current: currentStatus
        });
        this.lastStatus = currentStatus;
      }
    } catch (error) {
      Logger.log('ERROR', 'Status change check failed', error);
    }
  }

  async handleMessage(request, sender, sendResponse) {
    const startTime = Date.now();
    Logger.log('INFO', `Handling message: ${request.action}`, request);
    
    try {
      switch (request.action) {
        case 'checkLoginStatus':
          const status = await this.checkLoginStatus();
          Logger.log('INFO', 'Login status check completed', status);
          sendResponse({ success: true, data: status });
          break;
        case 'performSignOut':
          const signOutResult = await this.performSignOut();
          Logger.log('INFO', 'Sign out attempt completed', { success: signOutResult });
          sendResponse({ 
            success: signOutResult, 
            message: signOutResult ? 'Signed out successfully' : 'Sign out failed' 
          });
          break;
        case 'extractQRCode':
          const qrCode = await this.extractQRCode();
          Logger.log('INFO', 'QR code extraction completed', { hasQRCode: !!qrCode });
          sendResponse({ success: true, data: qrCode });
          break;
        case 'getLogs':
          const logs = Logger.getLogs();
          sendResponse({ success: true, data: logs });
          break;
        case 'clearLogs':
          Logger.clearLogs();
          sendResponse({ success: true, message: 'Logs cleared' });
          break;
        case 'getDiagnosticInfo':
          const diagnostics = this.getDiagnosticInfo();
          sendResponse({ success: true, data: diagnostics });
          break;
        default:
          Logger.log('WARN', 'Unknown action received', request.action);
          sendResponse({ success: false, message: 'Unknown action' });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      Logger.log('ERROR', `Message handling failed for ${request.action} after ${duration}ms`, error);
      sendResponse({ success: false, message: error.message, error: error.toString() });
    }
  }

  async checkLoginStatus() {
    return new Promise((resolve) => {
      Logger.log('INFO', 'Starting login status check');
      this.detectionMethods = [];
      
      const checkElements = () => {
        try {
          // Enhanced detection selectors
          const selectors = {
            // Logged-in indicators
            chatList: '[data-testid="chat-list"]',
            chatListItems: '[data-testid="chat-list"] > div > div',
            searchInput: '[data-testid="chat-list-search"]',
            sidebar: '[data-testid="sidebar"]',
            conversationPanel: '[data-testid="conversation-panel-wrapper"]',
            header: '[data-testid="header"]',
            
            // Logged-out indicators  
            landingWrapper: '.landing-wrapper, #initial_startup',
            qrContainer: '[data-testid="qr-container"], [data-ref], .qr-wrapper',
            qrCanvas: 'canvas[aria-label*="Scan"], canvas[role="img"]',
            loginScreen: '[data-testid="landing-wrapper"]',
            
            // Loading indicators
            loadingSpinner: '._3dqpi, .app-wrapper-web ._3dqpi, [data-testid="startup-spinner"]',
            progressBar: '.progress-bar, [role="progressbar"]'
          };

          let status = {
            isLoggedIn: false,
            username: null,
            hasQRCode: false,
            isLoading: false,
            detectionMethod: '',
            confidence: 0,
            elements: {}
          };

          // Check each selector and log what we find
          Object.keys(selectors).forEach(key => {
            const element = document.querySelector(selectors[key]);
            status.elements[key] = {
              found: !!element,
              visible: element ? this.isElementVisible(element) : false,
              text: element ? element.textContent?.substring(0, 50) : null
            };
          });

          Logger.log('INFO', 'Element detection results', status.elements);

          // Method 1: Check for loading state
          if (status.elements.loadingSpinner.found || status.elements.progressBar.found) {
            status.isLoading = true;
            status.detectionMethod = 'Loading spinner detected';
            status.confidence = 90;
            this.detectionMethods.push('loading_spinner');
          }

          // Method 2: Strong logged-in indicators
          else if (status.elements.chatList.found && status.elements.chatList.visible) {
            status.isLoggedIn = true;
            status.detectionMethod = 'Chat list detected';
            status.confidence = 95;
            this.detectionMethods.push('chat_list');
            
            // Try to get username from various sources
            status.username = this.extractUsername();
          }

          // Method 3: Check for sidebar + search (alternative logged-in check)
          else if (status.elements.sidebar.found && status.elements.searchInput.found) {
            status.isLoggedIn = true;
            status.detectionMethod = 'Sidebar and search detected';
            status.confidence = 90;
            this.detectionMethods.push('sidebar_search');
            status.username = this.extractUsername();
          }

          // Method 4: QR code detection
          else if (status.elements.qrCanvas.found || status.elements.qrContainer.found) {
            status.hasQRCode = true;
            status.detectionMethod = 'QR code detected';
            status.confidence = 95;
            this.detectionMethods.push('qr_code');
          }

          // Method 5: Landing wrapper check
          else if (status.elements.landingWrapper.found) {
            status.isLoggedIn = false;
            status.detectionMethod = 'Landing wrapper detected';
            status.confidence = 80;
            this.detectionMethods.push('landing_wrapper');
          }

          // Method 6: Fallback - localStorage check
          else {
            const storageResult = this.checkLocalStorage();
            if (storageResult.hasSession) {
              status.isLoggedIn = true;
              status.detectionMethod = 'LocalStorage session detected';
              status.confidence = 70;
              status.username = 'Logged In (Storage)';
              this.detectionMethods.push('local_storage');
            } else {
              status.detectionMethod = 'No clear indicators found';
              status.confidence = 30;
              this.detectionMethods.push('fallback');
            }
          }

          // Method 7: Enhanced checks for edge cases
          if (!status.isLoggedIn && !status.hasQRCode && !status.isLoading) {
            // Check for conversation panel as backup
            if (status.elements.conversationPanel.found) {
              status.isLoggedIn = true;
              status.detectionMethod += ' + Conversation panel backup';
              status.confidence = Math.max(status.confidence, 85);
              this.detectionMethods.push('conversation_panel');
            }
          }

          Logger.log('INFO', 'Login status determined', {
            status,
            methods: this.detectionMethods,
            url: window.location.href
          });

          resolve(status);
        } catch (error) {
          Logger.log('ERROR', 'Login status check failed', error);
          resolve({
            isLoggedIn: false,
            username: null,
            hasQRCode: false,
            isLoading: false,
            detectionMethod: 'Error occurred',
            confidence: 0,
            error: error.message
          });
        }
      };

      // Check immediately if DOM is ready, otherwise wait
      if (document.readyState === 'loading') {
        Logger.log('INFO', 'DOM still loading, waiting...');
        document.addEventListener('DOMContentLoaded', checkElements);
      } else {
        // Add small delay to ensure DOM is fully rendered
        setTimeout(checkElements, 100);
      }
    });
  }

  isElementVisible(element) {
    try {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0'
      );
    } catch (error) {
      return false;
    }
  }

  extractUsername() {
    try {
      // Try multiple methods to extract username
      const methods = [
        () => document.querySelector('[data-testid="header"] span[title]')?.textContent,
        () => document.querySelector('._3OtEr')?.textContent,
        () => document.querySelector('[data-testid="avatar-btn-me"]')?.getAttribute('aria-label'),
        () => document.querySelector('header span[dir="auto"]')?.textContent,
        () => document.querySelector('[data-testid="conversation-header"] span')?.textContent
      ];

      for (const method of methods) {
        try {
          const result = method();
          if (result && result.trim()) {
            Logger.log('INFO', 'Username extracted', result.trim());
            return result.trim();
          }
        } catch (e) {
          // Continue to next method
        }
      }

      Logger.log('INFO', 'No username found, using default');
      return 'Logged In';
    } catch (error) {
      Logger.log('ERROR', 'Username extraction failed', error);
      return 'Logged In';
    }
  }

  checkLocalStorage() {
    try {
      const keys = [
        'WAToken1', 'WAToken2', 'WASecretBundle', 
        'WALangPref', 'WASid', 'WAVersion'
      ];
      
      let hasSession = false;
      let foundKeys = [];
      
      for (const key of keys) {
        if (localStorage.getItem(key)) {
          hasSession = true;
          foundKeys.push(key);
        }
      }
      
      Logger.log('INFO', 'LocalStorage check completed', { hasSession, foundKeys });
      return { hasSession, foundKeys };
    } catch (error) {
      Logger.log('ERROR', 'LocalStorage check failed', error);
      return { hasSession: false, foundKeys: [] };
    }
  }

  async performSignOut() {
    const startTime = Date.now();
    Logger.log('INFO', 'Starting sign out process');
    
    return new Promise((resolve) => {
      const attemptUISignOut = () => {
        try {
          Logger.log('INFO', 'Attempting UI-based sign out');
          
          // Enhanced menu button selectors
          const menuSelectors = [
            '[data-testid="menu"]',
            '[data-icon="menu"]', 
            'div[role="button"][aria-label*="Menu"]',
            'span[data-testid="menu"]',
            '._3OtEr [role="button"]',
            'header [data-icon="menu"]'
          ];
          
          let menuButton = null;
          for (const selector of menuSelectors) {
            menuButton = document.querySelector(selector);
            if (menuButton && this.isElementVisible(menuButton)) {
              Logger.log('INFO', `Found menu button with selector: ${selector}`);
              break;
            }
          }
          
          if (menuButton) {
            Logger.log('INFO', 'Clicking menu button');
            menuButton.click();
            
            setTimeout(() => {
              try {
                // Enhanced logout option detection
                const logoutSelectors = [
                  'div[role="button"]',
                  'li[role="menuitem"]',
                  '[data-testid="menu-item"]',
                  '.menu-item',
                  'span[role="button"]'
                ];
                
                let logoutOptions = [];
                for (const selector of logoutSelectors) {
                  const elements = [...document.querySelectorAll(selector)];
                  const matchingElements = elements.filter(el => {
                    const text = el.textContent?.toLowerCase() || '';
                    return text.includes('log out') || 
                           text.includes('sign out') || 
                           text.includes('logout') ||
                           text.includes('sair') || // Portuguese
                           text.includes('salir') || // Spanish
                           text.includes('abmelden') || // German
                           text.includes('déconnexion') || // French
                           text.includes('esci'); // Italian
                  });
                  logoutOptions.push(...matchingElements);
                }
                
                Logger.log('INFO', `Found ${logoutOptions.length} potential logout options`);
                
                if (logoutOptions.length > 0) {
                  Logger.log('INFO', 'Clicking logout option');
                  logoutOptions[0].click();
                  
                  setTimeout(() => {
                    // Check for confirmation dialog
                    const confirmSelectors = [
                      '[data-testid="popup-confirm-button"]',
                      'button[data-testid="confirm-btn"]',
                      '.confirm-button',
                      'button:contains("Log out")',
                      'div[role="button"]:contains("Confirm")'
                    ];
                    
                    for (const selector of confirmSelectors) {
                      const confirmButton = document.querySelector(selector);
                      if (confirmButton && this.isElementVisible(confirmButton)) {
                        Logger.log('INFO', 'Clicking confirmation button');
                        confirmButton.click();
                        break;
                      }
                    }
                    
                    const duration = Date.now() - startTime;
                    Logger.log('INFO', `UI sign out completed in ${duration}ms`);
                    resolve(true);
                  }, 500);
                } else {
                  Logger.log('WARN', 'No logout options found, falling back to storage method');
                  this.performStorageSignOut(resolve, startTime);
                }
              } catch (error) {
                Logger.log('ERROR', 'Error during logout option selection', error);
                this.performStorageSignOut(resolve, startTime);
              }
            }, 1000);
          } else {
            Logger.log('WARN', 'Menu button not found, falling back to storage method');
            this.performStorageSignOut(resolve, startTime);
          }
        } catch (error) {
          Logger.log('ERROR', 'UI sign out attempt failed', error);
          this.performStorageSignOut(resolve, startTime);
        }
      };

      attemptUISignOut();
    });
  }

  performStorageSignOut(resolve, startTime) {
    try {
      Logger.log('INFO', 'Performing storage-based sign out (nuclear option)');
      
      // Clear localStorage
      const keysToRemove = [];
      const keysSnapshot = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          keysSnapshot.push(key);
          if (key.startsWith('WA') || 
              key.includes('whatsapp') || 
              key.includes('chat') ||
              key.includes('session')) {
            keysToRemove.push(key);
          }
        }
      }
      
      Logger.log('INFO', 'LocalStorage analysis', {
        totalKeys: keysSnapshot.length,
        keysToRemove: keysToRemove.length,
        removedKeys: keysToRemove
      });
      
      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
          Logger.log('INFO', `Removed localStorage key: ${key}`);
        } catch (e) {
          Logger.log('ERROR', `Could not remove ${key}`, e);
        }
      });

      // Clear sessionStorage
      try {
        const sessionKeys = Object.keys(sessionStorage);
        sessionStorage.clear();
        Logger.log('INFO', 'SessionStorage cleared', { clearedKeys: sessionKeys.length });
      } catch (e) {
        Logger.log('ERROR', 'Could not clear sessionStorage', e);
      }

      // Clear cookies via chrome API
      chrome.runtime.sendMessage({ action: 'clearCookies' }, (response) => {
        Logger.log('INFO', 'Cookie clearing requested', response);
      });

      // Force reload with cache bypass
      setTimeout(() => {
        const duration = Date.now() - startTime;
        Logger.log('INFO', `Storage sign out completed in ${duration}ms, reloading page`);
        window.location.reload(true);
        resolve(true);
      }, 1000);

    } catch (error) {
      const duration = Date.now() - startTime;
      Logger.log('ERROR', `Storage sign out failed after ${duration}ms`, error);
      resolve(false);
    }
  }

  async extractQRCode() {
    Logger.log('INFO', 'Starting QR code extraction');
    
    return new Promise((resolve) => {
      let hasResolved = false; // Prevent multiple resolutions
      
      const findAndExtractQR = () => {
        if (hasResolved) return; // Exit if already resolved
        
        try {
          // Enhanced QR code selectors
          const qrSelectors = [
            'canvas[aria-label*="Scan"]',
            'canvas[role="img"]',
            'div[data-ref] canvas',
            'canvas[aria-label="Scan me!"]',
            '.qr-canvas canvas',
            '[data-testid="qr-canvas"] canvas',
            'canvas'  // Fallback to any canvas
          ];
          
          let qrCanvas = null;
          for (const selector of qrSelectors) {
            const canvas = document.querySelector(selector);
            if (canvas && this.isElementVisible(canvas)) {
              // Verify it's likely a QR code by checking dimensions
              const rect = canvas.getBoundingClientRect();
              if (rect.width > 50 && rect.height > 50 && Math.abs(rect.width - rect.height) < 50) {
                qrCanvas = canvas;
                Logger.log('INFO', `Found QR canvas with selector: ${selector}`, {
                  width: rect.width,
                  height: rect.height
                });
                break;
              }
            }
          }
          
          if (qrCanvas) {
            try {
              // Convert canvas to data URL
              const dataURL = qrCanvas.toDataURL('image/png');
              if (dataURL && dataURL.length > 1000) { // Basic validation
                Logger.log('INFO', 'QR code successfully extracted', {
                  dataLength: dataURL.length,
                  type: 'canvas'
                });
                hasResolved = true;
                resolve(dataURL);
                return;
              }
            } catch (error) {
              Logger.log('ERROR', 'Canvas to dataURL conversion failed', error);
            }
          }
          
          // Fallback: try to find QR code image
          const qrImageSelectors = [
            'img[alt*="QR"]',
            'img[src*="qr"]',
            'img[aria-label*="scan"]',
            '.qr-code img',
            '[data-testid="qr-code"] img'
          ];
          
          for (const selector of qrImageSelectors) {
            const qrImg = document.querySelector(selector);
            if (qrImg && this.isElementVisible(qrImg) && qrImg.src) {
              Logger.log('INFO', `Found QR image with selector: ${selector}`);
              hasResolved = true;
              resolve(qrImg.src);
              return;
            }
          }
          
          Logger.log('WARN', 'No QR code found in current attempt');
          
        } catch (error) {
          Logger.log('ERROR', 'QR code extraction failed', error);
        }
      };

      // Try immediately first
      findAndExtractQR();
      
      // If not resolved immediately, try a few more times
      if (!hasResolved) {
        let attempts = 0;
        const maxAttempts = 3; // Reduced from 5
        
        const retryInterval = setInterval(() => {
          if (hasResolved) {
            clearInterval(retryInterval);
            return;
          }
          
          attempts++;
          Logger.log('INFO', `QR extraction retry ${attempts}/${maxAttempts}`);
          findAndExtractQR();
          
          if (attempts >= maxAttempts) {
            clearInterval(retryInterval);
            if (!hasResolved) {
              Logger.log('WARN', 'QR code extraction failed after all attempts');
              hasResolved = true;
              resolve(null);
            }
          }
        }, 1000);
      }
    });
  }

  // Utility method to wait for element
  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  }

  // Diagnostic method for debugging
  getDiagnosticInfo() {
    try {
      const info = {
        url: window.location.href,
        title: document.title,
        readyState: document.readyState,
        timestamp: new Date().toISOString(),
        detectionMethods: this.detectionMethods,
        elements: {
          total: document.querySelectorAll('*').length,
          withTestId: document.querySelectorAll('[data-testid]').length,
          canvases: document.querySelectorAll('canvas').length,
          buttons: document.querySelectorAll('button, [role="button"]').length
        },
        localStorage: {
          keys: Object.keys(localStorage).filter(k => k.startsWith('WA')),
          totalSize: JSON.stringify(localStorage).length
        }
      };
      
      Logger.log('INFO', 'Diagnostic info generated', info);
      return info;
    } catch (error) {
      Logger.log('ERROR', 'Failed to generate diagnostic info', error);
      return { error: error.message };
    }
  }
}

// Initialize the manager
try {
  const whatsappManager = new WhatsAppWebManager();
  
  // Make it globally accessible for debugging
  window.whatsappManager = whatsappManager;
  window.WhatsAppLogger = Logger;
  
  Logger.log('INFO', 'WhatsApp Web Manager fully initialized and ready');
  
  // Expose diagnostic function globally
  window.getWhatsAppDiagnostics = () => {
    return {
      manager: whatsappManager.getDiagnosticInfo(),
      logs: Logger.getLogs().slice(-10), // Last 10 logs
      status: whatsappManager.lastStatus
    };
  };
  
} catch (error) {
  console.error('Failed to initialize WhatsApp Web Manager:', error);
  Logger.log('ERROR', 'Manager initialization failed', error);
}