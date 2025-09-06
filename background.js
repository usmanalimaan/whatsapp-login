// WhatsApp Web Login Manager - Background Script
console.log('WhatsApp Web Login Manager: Background script loaded');

class BackgroundManager {
  constructor() {
    this.init();
  }

  init() {
    // Listen for messages from content script and popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep the message channel open for async response
    });

    // Handle extension icon click
    chrome.action.onClicked.addListener((tab) => {
      this.handleIconClick(tab);
    });

    // Monitor tab updates to detect WhatsApp Web navigation
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdate(tabId, changeInfo, tab);
    });
  }

  async handleMessage(request, sender, sendResponse) {
    const startTime = Date.now();
    BackgroundLogger.log('INFO', `Handling message: ${request.action}`, {
      sender: sender.tab?.url || 'popup',
      tabId: sender.tab?.id
    });
    
    try {
      switch (request.action) {
        case 'clearCookies':
          await this.clearWhatsAppCookies();
          BackgroundLogger.log('INFO', 'Cookies cleared successfully');
          sendResponse({ success: true });
          break;
        case 'checkWhatsAppTab':
          const whatsappTab = await this.findWhatsAppTab();
          BackgroundLogger.log('INFO', 'WhatsApp tab check completed', { found: !!whatsappTab });
          sendResponse({ success: true, data: whatsappTab });
          break;
        case 'executeInTab':
          const result = await this.executeInWhatsAppTab(request.script);
          sendResponse({ success: true, data: result });
          break;
        case 'openWhatsAppWeb':
          await this.openWhatsAppWeb();
          BackgroundLogger.log('INFO', 'WhatsApp Web opened');
          sendResponse({ success: true });
          break;
        default:
          BackgroundLogger.log('WARN', 'Unknown action received', request.action);
          sendResponse({ success: false, message: 'Unknown action' });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      BackgroundLogger.log('ERROR', `Message handling failed for ${request.action} after ${duration}ms`, error);
      sendResponse({ success: false, message: error.message, error: error.toString() });
    }
  }

  async handleIconClick(tab) {
    // If not on WhatsApp Web, open it
    if (!tab.url.includes('web.whatsapp.com')) {
      await this.openWhatsAppWeb();
    }
  }

  async handleTabUpdate(tabId, changeInfo, tab) {
    // Update extension state when WhatsApp Web loads
    if (changeInfo.status === 'complete' && tab.url?.includes('web.whatsapp.com')) {
      try {
        // Update extension badge or icon based on login status
        await this.updateExtensionIcon(tabId);
      } catch (error) {
        console.log('Could not update extension icon:', error);
      }
    }
  }

  async clearWhatsAppCookies() {
    try {
      // Remove all cookies for WhatsApp Web domain
      const cookies = await chrome.cookies.getAll({ domain: 'web.whatsapp.com' });
      
      for (const cookie of cookies) {
        await chrome.cookies.remove({
          url: `https://web.whatsapp.com${cookie.path}`,
          name: cookie.name
        });
      }

      // Also clear cookies for related domains
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

      console.log('WhatsApp cookies cleared successfully');
    } catch (error) {
      console.error('Failed to clear WhatsApp cookies:', error);
      throw error;
    }
  }

  async findWhatsAppTab() {
    try {
      const tabs = await chrome.tabs.query({ url: '*://web.whatsapp.com/*' });
      return tabs.length > 0 ? tabs[0] : null;
    } catch (error) {
      console.error('Failed to find WhatsApp tab:', error);
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
      console.error('Failed to execute script in WhatsApp tab:', error);
      throw error;
    }
  }

  async openWhatsAppWeb() {
    try {
      // Check if WhatsApp Web is already open
      const existingTab = await this.findWhatsAppTab();
      
      if (existingTab) {
        // Focus the existing tab
        await chrome.tabs.update(existingTab.id, { active: true });
        await chrome.windows.update(existingTab.windowId, { focused: true });
      } else {
        // Open new tab
        await chrome.tabs.create({ url: 'https://web.whatsapp.com' });
      }
    } catch (error) {
      console.error('Failed to open WhatsApp Web:', error);
      throw error;
    }
  }

  async updateExtensionIcon(tabId) {
    try {
      // Execute a quick status check
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const chatList = document.querySelector('[data-testid="chat-list"]');
          const landingWrapper = document.querySelector('.landing-wrapper, #initial_startup');
          return !landingWrapper && !!chatList;
        }
      });

      const isLoggedIn = results[0]?.result;

      // Update action badge
      if (isLoggedIn) {
        chrome.action.setBadgeText({ text: '●', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#25D366', tabId }); // WhatsApp green
      } else {
        chrome.action.setBadgeText({ text: '○', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#FF0000', tabId }); // Red for logged out
      }
    } catch (error) {
      console.log('Could not update extension icon:', error);
      // Clear badge if there's an error
      chrome.action.setBadgeText({ text: '', tabId });
    }
  }

  // Helper method to inject content script if needed
  async ensureContentScriptInjected(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          return typeof whatsappManager !== 'undefined';
        }
      });
    } catch (error) {
      // If content script is not loaded, inject it
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['contentScript.js']
      });
    }
  }

  // Storage management
  async saveState(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }

  async getState(key) {
    try {
      const result = await chrome.storage.local.get([key]);
      return result[key];
    } catch (error) {
      console.error('Failed to get state:', error);
      return null;
    }
  }
}

// Initialize the background manager
const backgroundManager = new BackgroundManager();