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
  
  // Create separator
  chrome.contextMenus.create({
    id: 'separator-1',
    type: 'separator',
    contexts: ['page', 'action']
  });
  
  // Create parent menu for blocking
  chrome.contextMenus.create({
    id: 'block-parent',
    title: '🚫 Block 1Password on',
    contexts: ['page', 'action']
  });
  
  // Add domain options
  domains.forEach(domain => {
    const parentId = `block-${domain}`;
    
    // Check if this domain is already blocked
    const isBlocked = blockedDomains.some(entry => {
      if (entry.includes(':')) {
        const d = entry.substring(entry.indexOf(':') + 1);
        return d === domain || d === `${domain}:${url.port}`;
      }
      return entry === domain;
    });
    
    // Create domain parent menu
    chrome.contextMenus.create({
      id: parentId,
      parentId: 'block-parent',
      title: isBlocked ? `${domain} ✓` : domain,
      contexts: ['page', 'action']
    });
    
    // Add submenu options
    chrome.contextMenus.create({
      id: `${parentId}-exact`,
      parentId: parentId,
      title: 'Block this domain only',
      contexts: ['page', 'action']
    });
    
    chrome.contextMenus.create({
      id: `${parentId}-with-subs`,
      parentId: parentId,
      title: 'Include all subdomains',
      contexts: ['page', 'action']
    });
  });
  
  // Add option for domain with port if port exists
  if (url.port) {
    const domainWithPort = `${url.hostname}:${url.port}`;
    const parentId = `block-port-${domainWithPort}`;
    
    chrome.contextMenus.create({
      id: parentId,
      parentId: 'block-parent',
      title: `${domainWithPort} (with port)`,
      contexts: ['page', 'action']
    });
    
    chrome.contextMenus.create({
      id: `${parentId}-exact`,
      parentId: parentId,
      title: 'Block this exact port',
      contexts: ['page', 'action']
    });
  }
  
  // Create unblock menus for currently blocked domains
  const relevantBlocked = findRelevantBlockedDomains(url.hostname, blockedDomains, url.port);
  if (relevantBlocked.length > 0) {
    chrome.contextMenus.create({
      id: 'unblock-parent',
      title: '✅ Unblock 1Password on',
      contexts: ['page', 'action']
    });
    
    relevantBlocked.forEach(entry => {
      chrome.contextMenus.create({
        id: `unblock-${entry}`,
        parentId: 'unblock-parent',
        title: formatBlockedEntry(entry),
        contexts: ['page', 'action']
      });
    });
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

// Handle new blocking action
function handleBlockAction(menuId, tab) {
  const url = new URL(tab.url);
  
  // Check if this is a port-specific block
  if (menuId.startsWith('block-port-')) {
    if (menuId.endsWith('-exact')) {
      // Extract domain:port from the menuId
      const domainWithPort = menuId.replace('block-port-', '').replace('-exact', '');
      addToBlockList(`exact:${domainWithPort}`);
    }
    return;
  }
  
  // Parse regular domain blocks
  // The menuId format is: block-{domain}-{type}
  // where type is either 'exact' or 'with-subs'
  
  if (menuId.endsWith('-exact')) {
    const domain = menuId.replace('block-', '').replace('-exact', '');
    addToBlockList(`exact:${domain}`);
  } else if (menuId.endsWith('-with-subs')) {
    const domain = menuId.replace('block-', '').replace('-with-subs', '');
    addToBlockList(`domain:${domain}`);
  }
}

// Handle unblocking action
function handleUnblockAction(menuId) {
  const entryToRemove = menuId.replace('unblock-', '');
  removeFromBlockList(entryToRemove);
}

// Handle context menu clicks
async function contextClick(info, tab) {
  const menuId = info.menuItemId;
  
  if (typeof menuId !== 'string') return;
  
  if (menuId.startsWith('block-')) {
    handleBlockAction(menuId, tab);
    // Refresh the menu to show updated state
    setTimeout(() => updateContextMenuForTab(tab), 100);
  } else if (menuId.startsWith('unblock-')) {
    handleUnblockAction(menuId);
    // Refresh the menu to show updated state
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