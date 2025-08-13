// Add context menu items.
chrome.runtime.onInstalled.addListener(() => {
  // Blocking options
  chrome.contextMenus.create({
    id: "1password-block-exact",
    title: "Block this exact domain",
    contexts: ["page", "action"],
  });

  chrome.contextMenus.create({
    id: "1password-block-subdomain",
    title: "Block subdomain and sub-levels",
    contexts: ["page", "action"],
  });

  chrome.contextMenus.create({
    id: "1password-block-domain",
    title: "Block entire domain",
    contexts: ["page", "action"],
  });

  // Unblocking options
  chrome.contextMenus.create({
    id: "1password-unblock-exact",
    title: "Unblock this exact domain",
    contexts: ["page", "action"],
  });

  chrome.contextMenus.create({
    id: "1password-unblock-subdomain",
    title: "Unblock subdomain and sub-levels",
    contexts: ["page", "action"],
  });

  chrome.contextMenus.create({
    id: "1password-unblock-domain",
    title: "Unblock entire domain",
    contexts: ["page", "action"],
  });
});

// Extract different domain types from hostname
function getDomainTypes(hostname) {
  const parts = hostname.split(".");

  return {
    exact: hostname,
    subdomain: parts.length > 2 ? parts.slice(1).join(".") : hostname,
    domain: parts.length > 1 ? parts.slice(-2).join(".") : hostname,
  };
}

// Handle context menu clicks.
function contextClick(info, tab) {
  const { menuItemId } = info;

  // Get the domain name from the tab URL.
  const hostname = new URL(tab.url).hostname;
  const domainTypes = getDomainTypes(hostname);

  // Block exact domain
  if (menuItemId === "1password-block-exact") {
    addToBlockList("exact:" + domainTypes.exact);
  }

  // Block subdomain and sub-levels
  if (menuItemId === "1password-block-subdomain") {
    addToBlockList("sub:" + domainTypes.subdomain);
  }

  // Block entire domain
  if (menuItemId === "1password-block-domain") {
    addToBlockList("domain:" + domainTypes.domain);
  }

  // Unblock exact domain
  if (menuItemId === "1password-unblock-exact") {
    removeFromBlockList("exact:" + domainTypes.exact);
  }

  // Unblock subdomain and sub-levels
  if (menuItemId === "1password-unblock-subdomain") {
    removeFromBlockList("sub:" + domainTypes.subdomain);
  }

  // Unblock entire domain
  if (menuItemId === "1password-unblock-domain") {
    removeFromBlockList("domain:" + domainTypes.domain);
  }
}

// Add domain to block list
function addToBlockList(domainEntry) {
  chrome.storage.sync.get(["domains"]).then((result) => {
    let domainsToIgnore = result.domains ? result.domains : "";
    if (!domainsToIgnore.includes(domainEntry)) {
      domainsToIgnore = domainsToIgnore.concat(domainEntry, ",");
    }
    chrome.storage.sync.set({ domains: domainsToIgnore });
  });
}

// Remove domain from block list
function removeFromBlockList(domainEntry) {
  chrome.storage.sync.get(["domains"]).then((result) => {
    let domainsToIgnore = result.domains ? result.domains : "";
    domainsToIgnore = domainsToIgnore.replaceAll(domainEntry + ",", "");
    chrome.storage.sync.set({ domains: domainsToIgnore });
  });
}

// Add context menu click listener.
chrome.contextMenus.onClicked.addListener(contextClick);
