// Helper function to extract all possible domains from a hostname
function extractAllPossibleDomains(hostname) {
  const parts = hostname.split('.');
  const domains = [];
  
  // For single word domains like 'localhost'
  if (parts.length === 1) {
    return [hostname];
  }
  
  // For standard domains, generate hierarchy
  // Example: sub.sub2.domain.com -> [domain.com, sub2.domain.com, sub.sub2.domain.com]
  for (let i = parts.length - 2; i >= 0; i--) {
    domains.push(parts.slice(i).join('.'));
  }
  
  return domains;
}

// Get blocked domains from storage
async function getBlockedDomains() {
  const result = await chrome.storage.sync.get(['domains']);
  if (!result || !result.domains) {
    return [];
  }
  return result.domains.split(',').filter(d => d); // Filter out empty strings
}

// Find blocked domains relevant to current hostname
function findRelevantBlockedDomains(hostname, blockedDomains, port = null) {
  const relevant = [];
  
  for (const entry of blockedDomains) {
    if (!entry) continue;
    
    // Parse the entry
    const colonIndex = entry.indexOf(':');
    let type, domain;
    
    if (colonIndex === -1) {
      // Legacy format
      type = 'exact';
      domain = entry;
    } else {
      type = entry.substring(0, colonIndex);
      domain = entry.substring(colonIndex + 1);
    }
    
    // Check if this blocked entry affects the current hostname
    if (type === 'exact') {
      // Check both with and without port
      if (hostname === domain || (port && `${hostname}:${port}` === domain)) {
        relevant.push(entry);
      }
    } else if ((type === 'sub' || type === 'domain') && (hostname === domain || hostname.endsWith('.' + domain))) {
      relevant.push(entry);
    }
  }
  
  return relevant;
}

// Format blocked entry for display
function formatBlockedEntry(entry) {
  const colonIndex = entry.indexOf(':');
  
  if (colonIndex === -1) {
    // Legacy format
    return `${entry} (exact)`;
  }
  
  const type = entry.substring(0, colonIndex);
  const domain = entry.substring(colonIndex + 1);
  
  if (type === 'exact') {
    return `${domain} (exact match)`;
  } else if (type === 'domain' || type === 'sub') {
    return `${domain} (with subdomains)`;
  }
  
  return domain;
}

// Update context menu based on current tab
async function updateContextMenuForTab(tab) {
  // Clear existing menus
  await chrome.contextMenus.removeAll();
  
  // Only create menus for HTTP(S) URLs
  if (!tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
    return;
  }
  
  const url = new URL(tab.url);
  const domains = extractAllPossibleDomains(url.hostname);
  const blockedDomains = await getBlockedDomains();
  
  // Add each domain as a top-level menu with block/unblock options in submenu
  domains.forEach(domain => {
    const parentId = `domain-${domain}`;
    
    // Check what blocking is currently active for this domain
    const exactBlocked = blockedDomains.some(entry => 
      entry === `exact:${domain}` || entry === domain
    );
    const subdomainBlocked = blockedDomains.some(entry => 
      entry === `domain:${domain}` || entry === `sub:${domain}`
    );
    
    // Create visual indicator for blocked status
    let title = domain;
    if (exactBlocked && subdomainBlocked) {
      title = `🚫 ${domain} (fully blocked)`;
    } else if (subdomainBlocked) {
      title = `🚫 ${domain} (with subdomains)`;
    } else if (exactBlocked) {
      title = `🚫 ${domain} (domain only)`;
    } else {
      title = `🔓 ${domain}`;
    }
    
    // Create domain parent menu
    chrome.contextMenus.create({
      id: parentId,
      title: title,
      contexts: ['page', 'action']
    });
    
    // Add block options if not already blocked
    if (!exactBlocked) {
      chrome.contextMenus.create({
        id: `${parentId}-block-exact`,
        parentId: parentId,
        title: '🚫 Block this domain only',
        contexts: ['page', 'action']
      });
    }
    
    if (!subdomainBlocked) {
      chrome.contextMenus.create({
        id: `${parentId}-block-with-subs`,
        parentId: parentId,
        title: '🚫 Block with all subdomains',
        contexts: ['page', 'action']
      });
    }
    
    // Add separator if we have both block and unblock options
    if ((exactBlocked || subdomainBlocked) && (!exactBlocked || !subdomainBlocked)) {
      chrome.contextMenus.create({
        id: `${parentId}-separator`,
        type: 'separator',
        parentId: parentId,
        contexts: ['page', 'action']
      });
    }
    
    // Add unblock options for what's currently blocked
    if (exactBlocked) {
      chrome.contextMenus.create({
        id: `${parentId}-unblock-exact`,
        parentId: parentId,
        title: '✅ Unblock domain only',
        contexts: ['page', 'action']
      });
    }
    
    if (subdomainBlocked) {
      chrome.contextMenus.create({
        id: `${parentId}-unblock-with-subs`,
        parentId: parentId,
        title: '✅ Unblock with subdomains',
        contexts: ['page', 'action']
      });
    }
  });
  
  // Add option for domain with port if port exists
  if (url.port) {
    const domainWithPort = `${url.hostname}:${url.port}`;
    const parentId = `port-${domainWithPort}`;
    
    // Check if this specific port is blocked
    const portBlocked = blockedDomains.some(entry => 
      entry === `exact:${domainWithPort}`
    );
    
    const title = portBlocked ? 
      `🚫 ${domainWithPort}` : 
      `🔓 ${domainWithPort}`;
    
    // Add separator before port option
    chrome.contextMenus.create({
      id: 'separator-port',
      type: 'separator',
      contexts: ['page', 'action']
    });
    
    chrome.contextMenus.create({
      id: parentId,
      title: title,
      contexts: ['page', 'action']
    });
    
    if (!portBlocked) {
      chrome.contextMenus.create({
        id: `${parentId}-block-exact`,
        parentId: parentId,
        title: '🚫 Block this specific port',
        contexts: ['page', 'action']
      });
    } else {
      chrome.contextMenus.create({
        id: `${parentId}-unblock-exact`,
        parentId: parentId,
        title: '✅ Unblock this specific port',
        contexts: ['page', 'action']
      });
    }
  }
}

// Initialize context menus on installation
chrome.runtime.onInstalled.addListener(() => {
  // Create a default menu for when no tab is active
  chrome.contextMenus.create({
    id: 'default-message',
    title: '1Password Blocker - Navigate to a page to see options',
    contexts: ['action'],
    enabled: false
  });
});

// Update menus when tab is activated
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  await updateContextMenuForTab(tab);
});

// Update menus when tab URL changes
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only update if this is the active tab and the URL has been updated
  if (changeInfo.status === 'complete') {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && activeTab.id === tabId) {
      await updateContextMenuForTab(tab);
    }
  }
});

// Handle context menu clicks
async function contextClick(info, tab) {
  const menuId = info.menuItemId;
  
  if (typeof menuId !== 'string') return;
  
  // Skip separators
  if (menuId.includes('-separator')) return;
  
  let domain = '';
  let action = '';
  
  // Parse menu ID to extract domain and action
  if (menuId.startsWith('domain-')) {
    // Format: domain-{domain}-{action}
    // Extract everything between 'domain-' and the last hyphen group
    const parts = menuId.replace('domain-', '');
    
    if (parts.endsWith('-block-exact')) {
      domain = parts.replace('-block-exact', '');
      action = 'block-exact';
    } else if (parts.endsWith('-block-with-subs')) {
      domain = parts.replace('-block-with-subs', '');
      action = 'block-with-subs';
    } else if (parts.endsWith('-unblock-exact')) {
      domain = parts.replace('-unblock-exact', '');
      action = 'unblock-exact';
    } else if (parts.endsWith('-unblock-with-subs')) {
      domain = parts.replace('-unblock-with-subs', '');
      action = 'unblock-with-subs';
    }
  } else if (menuId.startsWith('port-')) {
    // Format: port-{domain:port}-{action}
    const parts = menuId.replace('port-', '');
    
    if (parts.endsWith('-block-exact')) {
      domain = parts.replace('-block-exact', '');
      action = 'block-port';
    } else if (parts.endsWith('-unblock-exact')) {
      domain = parts.replace('-unblock-exact', '');
      action = 'unblock-port';
    }
  }
  
  // Perform the action
  if (action === 'block-exact') {
    addToBlockList(`exact:${domain}`);
  } else if (action === 'block-with-subs') {
    addToBlockList(`domain:${domain}`);
  } else if (action === 'block-port') {
    addToBlockList(`exact:${domain}`);  // domain includes port
  } else if (action === 'unblock-exact') {
    // Find and remove the exact block entry
    const blockedDomains = await getBlockedDomains();
    const entryToRemove = blockedDomains.find(entry => 
      entry === `exact:${domain}` || entry === domain
    );
    if (entryToRemove) {
      removeFromBlockList(entryToRemove);
    }
  } else if (action === 'unblock-with-subs') {
    // Find and remove the subdomain block entry
    const blockedDomains = await getBlockedDomains();
    const entryToRemove = blockedDomains.find(entry => 
      entry === `domain:${domain}` || entry === `sub:${domain}`
    );
    if (entryToRemove) {
      removeFromBlockList(entryToRemove);
    }
  } else if (action === 'unblock-port') {
    removeFromBlockList(`exact:${domain}`);  // domain includes port
  }
  
  // Refresh the menu to show updated state
  if (action) {
    setTimeout(() => updateContextMenuForTab(tab), 100);
  }
}

// Add domain to block list
function addToBlockList(domainEntry) {
  chrome.storage.sync.get(['domains']).then((result) => {
    let domainsToIgnore = result.domains ? result.domains : '';
    if (!domainsToIgnore.includes(domainEntry)) {
      domainsToIgnore = domainsToIgnore.concat(domainEntry, ',');
      chrome.storage.sync.set({ domains: domainsToIgnore });
      
      // Reload the current tab to apply changes
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.reload(tabs[0].id);
        }
      });
    }
  });
}

// Remove domain from block list
function removeFromBlockList(domainEntry) {
  chrome.storage.sync.get(['domains']).then((result) => {
    let domainsToIgnore = result.domains ? result.domains : '';
    domainsToIgnore = domainsToIgnore.replaceAll(domainEntry + ',', '');
    chrome.storage.sync.set({ domains: domainsToIgnore });
    
    // Reload the current tab to apply changes
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.reload(tabs[0].id);
      }
    });
  });
}

// Add context menu click listener
chrome.contextMenus.onClicked.addListener(contextClick);

// Initialize menus for current tab when extension loads
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) {
    updateContextMenuForTab(tabs[0]);
  }
});