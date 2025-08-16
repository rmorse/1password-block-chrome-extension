// Current tab information
let currentTab = null;
let currentDomain = null;
let currentBlockStatus = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    // Setup settings link
    document.getElementById('settingsLink').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
    });
    
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;
    
    // Check if it's a valid URL
    if (!tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
        showNoDomain();
        return;
    }
    
    // Parse URL
    const url = new URL(tab.url);
    currentDomain = url.hostname;
    
    // Load current status
    await loadCurrentStatus();
    
    // Show main content
    showMainContent();
    
    // Add port-specific button if site has a port
    if (url.port) {
        addPortButton(url.host);
    }
});

// Show no domain message
function showNoDomain() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('noDomain').style.display = 'block';
    document.getElementById('mainContent').style.display = 'none';
}

// Show main content
function showMainContent() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('noDomain').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    
    // Update domain display
    document.getElementById('currentDomain').textContent = currentDomain;
}

// Load current blocking status
async function loadCurrentStatus() {
    const result = await chrome.storage.sync.get(['domains']);
    const domainsString = result.domains || '';
    
    if (!domainsString) {
        updateStatus(null);
        return;
    }
    
    const entries = domainsString.split(',').filter(e => e);
    
    // Get current host with port if present
    const url = new URL(currentTab.url);
    const currentHostWithPort = url.host; // includes port if present
    
    // Check if current domain (with or without port) is blocked
    for (const entry of entries) {
        const colonIndex = entry.indexOf(':');
        const type = colonIndex !== -1 ? entry.substring(0, colonIndex) : 'exact';
        const domain = colonIndex !== -1 ? entry.substring(colonIndex + 1) : entry;
        
        // Check both hostname and hostname:port
        if (domain === currentDomain || domain === currentHostWithPort) {
            currentBlockStatus = { type, domain, entry, isPort: domain.includes(':') };
            updateStatus(currentBlockStatus);
            return;
        }
    }
    
    // Check if blocked by parent domain
    for (const entry of entries) {
        const colonIndex = entry.indexOf(':');
        const type = colonIndex !== -1 ? entry.substring(0, colonIndex) : 'exact';
        const domain = colonIndex !== -1 ? entry.substring(colonIndex + 1) : entry;
        
        if ((type === 'domain' || type === 'sub') && 
            currentDomain.endsWith('.' + domain)) {
            currentBlockStatus = { type: 'parent', parentDomain: domain };
            updateStatus(currentBlockStatus);
            return;
        }
    }
    
    updateStatus(null);
}

// Update status display
function updateStatus(status) {
    const statusIcon = document.getElementById('statusIcon');
    const statusTitle = document.getElementById('statusTitle');
    const statusSubtitle = document.getElementById('statusSubtitle');
    
    const blockDomainBtn = document.getElementById('blockDomainBtn');
    const blockSubdomainsBtn = document.getElementById('blockSubdomainsBtn');
    const unblockBtn = document.getElementById('unblockBtn');
    const changeTypeBtn = document.getElementById('changeTypeBtn');
    const changeTypeText = document.getElementById('changeTypeText');
    
    if (!status) {
        // Not blocked
        statusIcon.textContent = '🔓';
        statusTitle.textContent = 'Not Blocked';
        statusSubtitle.textContent = '1Password is active on this domain';
        
        blockDomainBtn.style.display = 'block';
        blockSubdomainsBtn.style.display = 'block';
        unblockBtn.style.display = 'none';
        changeTypeBtn.style.display = 'none';
    } else if (status.type === 'parent') {
        // Blocked by parent
        statusIcon.textContent = '🔒';
        statusTitle.textContent = 'Blocked by Parent';
        statusSubtitle.textContent = `Blocked by ${status.parentDomain}`;
        
        blockDomainBtn.style.display = 'none';
        blockSubdomainsBtn.style.display = 'none';
        unblockBtn.style.display = 'none';
        changeTypeBtn.style.display = 'none';
    } else if (status.type === 'exact') {
        // Blocked - domain only (or port-specific)
        statusIcon.textContent = '🚫';
        statusTitle.textContent = 'Blocked';
        
        if (status.isPort) {
            statusSubtitle.textContent = `Port-specific block (${status.domain})`;
            // Hide change type button for port-specific blocks
            changeTypeBtn.style.display = 'none';
        } else {
            statusSubtitle.textContent = 'Domain only (subdomains allowed)';
            changeTypeBtn.style.display = 'block';
            changeTypeText.textContent = 'Switch to: Block with Subdomains';
        }
        
        blockDomainBtn.style.display = 'none';
        blockSubdomainsBtn.style.display = 'none';
        unblockBtn.style.display = 'block';
    } else if (status.type === 'domain' || status.type === 'sub') {
        // Blocked - with subdomains
        statusIcon.textContent = '🚫';
        statusTitle.textContent = 'Blocked';
        statusSubtitle.textContent = 'Including all subdomains';
        
        blockDomainBtn.style.display = 'none';
        blockSubdomainsBtn.style.display = 'none';
        unblockBtn.style.display = 'block';
        changeTypeBtn.style.display = 'block';
        changeTypeText.textContent = 'Switch to: Block Domain Only';
    }
}

// Block domain
async function blockDomain(type) {
    const entry = `${type}:${currentDomain}`;
    
    // Get current domains
    const result = await chrome.storage.sync.get(['domains']);
    let domainsString = result.domains || '';
    
    // Remove any existing entries for this domain
    const entries = domainsString.split(',').filter(e => {
        if (!e) return false;
        const colonIndex = e.indexOf(':');
        const entryDomain = colonIndex !== -1 ? e.substring(colonIndex + 1) : e;
        return entryDomain !== currentDomain;
    });
    
    // Add new entry
    entries.push(entry);
    domainsString = entries.join(',') + ',';
    
    // Save
    await chrome.storage.sync.set({ domains: domainsString });
    
    // Reload current tab
    chrome.tabs.reload(currentTab.id);
    
    // Reload status
    await loadCurrentStatus();
}

// Unblock domain
async function unblockDomain() {
    if (!currentBlockStatus || !currentBlockStatus.entry) return;
    
    // Get current domains
    const result = await chrome.storage.sync.get(['domains']);
    let domainsString = result.domains || '';
    
    // Remove the entry
    domainsString = domainsString.replace(currentBlockStatus.entry + ',', '');
    
    // Save
    await chrome.storage.sync.set({ domains: domainsString });
    
    // Reload current tab
    chrome.tabs.reload(currentTab.id);
    
    // Reload status
    currentBlockStatus = null;
    await loadCurrentStatus();
}

// Change block type
async function changeBlockType() {
    if (!currentBlockStatus) return;
    
    const newType = currentBlockStatus.type === 'exact' ? 'domain' : 'exact';
    await blockDomain(newType);
}

// Add port-specific blocking button
function addPortButton(hostWithPort) {
    // Check if port is already blocked separately
    const isPortBlocked = currentBlockStatus && currentBlockStatus.isPort;
    
    if (!isPortBlocked && (!currentBlockStatus || currentBlockStatus.type !== 'domain')) {
        // Create a container for port button if it doesn't exist
        let portContainer = document.getElementById('portButtonContainer');
        if (!portContainer) {
            const actionsDiv = document.querySelector('.quick-actions');
            portContainer = document.createElement('div');
            portContainer.id = 'portButtonContainer';
            
            // Add separator
            const separator = document.createElement('hr');
            separator.style.margin = '12px 0';
            separator.style.border = 'none';
            separator.style.borderTop = '1px solid #e9ecef';
            
            actionsDiv.appendChild(separator);
            actionsDiv.appendChild(portContainer);
        }
        
        // Add the port button
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline';
        btn.innerHTML = `<span>🎯</span> Block Port ${hostWithPort}`;
        btn.onclick = () => blockDomain('exact', hostWithPort);
        
        portContainer.appendChild(btn);
    }
}

// Update blockDomain to accept optional domain parameter
window.blockDomain = async function(type, specificDomain = null) {
    const domainToBlock = specificDomain || currentDomain;
    const entry = `${type}:${domainToBlock}`;
    
    // Get current domains
    const result = await chrome.storage.sync.get(['domains']);
    let domainsString = result.domains || '';
    
    // Remove any existing entries for this exact domain
    const entries = domainsString.split(',').filter(e => {
        if (!e) return false;
        const colonIndex = e.indexOf(':');
        const entryDomain = colonIndex !== -1 ? e.substring(colonIndex + 1) : e;
        return entryDomain !== domainToBlock;
    });
    
    // Add new entry
    entries.push(entry);
    domainsString = entries.join(',') + ',';
    
    // Save
    await chrome.storage.sync.set({ domains: domainsString });
    
    // Reload current tab
    chrome.tabs.reload(currentTab.id);
    
    // Close popup after action
    window.close();
}