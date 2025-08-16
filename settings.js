// Global state
let allDomains = [];
let filteredDomains = [];

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    loadDomains();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    document.getElementById('searchInput').addEventListener('input', (e) => {
        filterDomains(e.target.value);
    });

    // Enter key on new domain input
    document.getElementById('newDomain').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addDomain();
        }
    });
}

// Load domains from storage
async function loadDomains() {
    showLoading(true);
    
    try {
        const result = await chrome.storage.sync.get(['domains']);
        const domainsString = result.domains || '';
        
        // Parse domains
        allDomains = [];
        if (domainsString) {
            const entries = domainsString.split(',').filter(e => e);
            
            entries.forEach(entry => {
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
                
                // Convert 'sub' to 'domain' for consistency
                if (type === 'sub') {
                    type = 'domain';
                }
                
                allDomains.push({ domain, type, entry });
            });
            
            // Sort by domain name
            allDomains.sort((a, b) => a.domain.localeCompare(b.domain));
        }
        
        filteredDomains = [...allDomains];
        updateDisplay();
    } catch (error) {
        console.error('Error loading domains:', error);
        showToast('Error loading domains', true);
    } finally {
        showLoading(false);
    }
}

// Filter domains based on search
function filterDomains(searchTerm) {
    if (!searchTerm) {
        filteredDomains = [...allDomains];
    } else {
        const term = searchTerm.toLowerCase();
        filteredDomains = allDomains.filter(item => 
            item.domain.toLowerCase().includes(term)
        );
    }
    updateDisplay();
}

// Update the display
function updateDisplay() {
    updateStats();
    updateTable();
}

// Update statistics
function updateStats() {
    const total = allDomains.length;
    const domainOnly = allDomains.filter(d => d.type === 'exact').length;
    const withSubdomains = allDomains.filter(d => d.type === 'domain').length;
    
    document.getElementById('totalBlocked').textContent = total;
    document.getElementById('domainOnly').textContent = domainOnly;
    document.getElementById('withSubdomains').textContent = withSubdomains;
}

// Update the table
function updateTable() {
    const tbody = document.getElementById('domainsTableBody');
    const table = document.getElementById('domainsTable');
    const emptyState = document.getElementById('emptyState');
    
    // Clear existing rows
    tbody.innerHTML = '';
    
    if (filteredDomains.length === 0) {
        table.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    table.style.display = 'table';
    emptyState.style.display = 'none';
    
    // Add rows
    filteredDomains.forEach(item => {
        const row = createTableRow(item);
        tbody.appendChild(row);
    });
}

// Create a table row
function createTableRow(item) {
    const row = document.createElement('tr');
    
    // Domain cell
    const domainCell = document.createElement('td');
    domainCell.className = 'domain-cell';
    domainCell.textContent = item.domain;
    
    // Type cell
    const typeCell = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'badge';
    
    if (item.domain.includes(':')) {
        badge.className += ' badge-port';
        badge.textContent = 'Port Specific';
    } else if (item.type === 'exact') {
        badge.className += ' badge-exact';
        badge.textContent = 'Domain Only';
    } else {
        badge.className += ' badge-subdomains';
        badge.textContent = 'With Subdomains';
    }
    typeCell.appendChild(badge);
    
    // Actions cell
    const actionsCell = document.createElement('td');
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'actions';
    
    // Change type button (only if not a port-specific block)
    if (!item.domain.includes(':')) {
        const changeBtn = document.createElement('button');
        changeBtn.className = 'btn btn-outline';
        changeBtn.textContent = item.type === 'exact' ? 'Add Subdomains' : 'Remove Subdomains';
        changeBtn.onclick = () => changeBlockType(item);
        actionsDiv.appendChild(changeBtn);
    }
    
    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-danger';
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => removeDomain(item);
    actionsDiv.appendChild(removeBtn);
    
    actionsCell.appendChild(actionsDiv);
    
    // Append cells to row
    row.appendChild(domainCell);
    row.appendChild(typeCell);
    row.appendChild(actionsCell);
    
    return row;
}

// Add a new domain
async function addDomain() {
    const input = document.getElementById('newDomain');
    const typeSelect = document.getElementById('blockType');
    const domain = input.value.trim();
    const type = typeSelect.value;
    
    if (!domain) {
        showToast('Please enter a domain', true);
        return;
    }
    
    // Validate domain format (basic check)
    if (!isValidDomain(domain)) {
        showToast('Please enter a valid domain', true);
        return;
    }
    
    // Check if already exists
    if (allDomains.some(d => d.domain === domain)) {
        showToast('Domain already blocked', true);
        return;
    }
    
    try {
        // Add to storage
        const result = await chrome.storage.sync.get(['domains']);
        let domainsString = result.domains || '';
        const newEntry = `${type}:${domain}`;
        
        // Remove any existing entries for this domain (shouldn't happen but just in case)
        const entries = domainsString.split(',').filter(e => {
            if (!e) return false;
            const colonIndex = e.indexOf(':');
            const entryDomain = colonIndex !== -1 ? e.substring(colonIndex + 1) : e;
            return entryDomain !== domain;
        });
        
        entries.push(newEntry);
        domainsString = entries.join(',') + ',';
        
        await chrome.storage.sync.set({ domains: domainsString });
        
        // Clear input
        input.value = '';
        
        // Reload domains
        await loadDomains();
        
        showToast(`Added ${domain} to blocked list`);
    } catch (error) {
        console.error('Error adding domain:', error);
        showToast('Error adding domain', true);
    }
}

// Change block type
async function changeBlockType(item) {
    const newType = item.type === 'exact' ? 'domain' : 'exact';
    
    try {
        const result = await chrome.storage.sync.get(['domains']);
        let domainsString = result.domains || '';
        
        // Parse and update
        const entries = domainsString.split(',').filter(e => e);
        const updatedEntries = entries.map(entry => {
            const colonIndex = entry.indexOf(':');
            const entryDomain = colonIndex !== -1 ? entry.substring(colonIndex + 1) : entry;
            
            if (entryDomain === item.domain) {
                return `${newType}:${item.domain}`;
            }
            return entry;
        });
        
        domainsString = updatedEntries.join(',') + ',';
        await chrome.storage.sync.set({ domains: domainsString });
        
        // Reload domains
        await loadDomains();
        
        const typeText = newType === 'exact' ? 'domain only' : 'with subdomains';
        showToast(`Changed ${item.domain} to block ${typeText}`);
    } catch (error) {
        console.error('Error changing block type:', error);
        showToast('Error changing block type', true);
    }
}

// Remove a domain
async function removeDomain(item) {
    if (!confirm(`Remove ${item.domain} from blocked list?`)) {
        return;
    }
    
    try {
        const result = await chrome.storage.sync.get(['domains']);
        let domainsString = result.domains || '';
        
        // Remove the entry
        domainsString = domainsString.replace(item.entry + ',', '');
        
        await chrome.storage.sync.set({ domains: domainsString });
        
        // Reload domains
        await loadDomains();
        
        showToast(`Removed ${item.domain} from blocked list`);
    } catch (error) {
        console.error('Error removing domain:', error);
        showToast('Error removing domain', true);
    }
}

// Validate domain format
function isValidDomain(domain) {
    // Basic validation - can be improved
    if (!domain || domain.length > 253) return false;
    
    // Check for valid characters
    const validPattern = /^[a-zA-Z0-9.-:]+$/;
    if (!validPattern.test(domain)) return false;
    
    // Check structure
    const parts = domain.split(':');
    const hostPart = parts[0];
    
    // Check if it's localhost or an IP
    if (hostPart === 'localhost') return true;
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostPart)) return true;
    
    // Check domain structure
    const domainParts = hostPart.split('.');
    if (domainParts.length < 2 && hostPart !== 'localhost') return false;
    
    // Check each part
    for (const part of domainParts) {
        if (!part || part.length > 63) return false;
        if (part.startsWith('-') || part.endsWith('-')) return false;
    }
    
    return true;
}

// Show/hide loading state
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.add('show');
    } else {
        loading.classList.remove('show');
    }
}

// Show toast notification
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    
    if (isError) {
        toast.classList.add('error');
    } else {
        toast.classList.remove('error');
    }
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}