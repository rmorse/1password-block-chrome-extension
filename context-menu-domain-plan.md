# Context Menu Domain Restructuring Plan

## Overview
Transform the current flat context menu structure into a hierarchical system that presents domain options first, then blocking strategies as submenus. This provides better flexibility and cleaner UI organization.

## Current Structure Analysis

### Existing Menu Layout (Flat)
```
- Block this exact domain
- Block subdomain and sub-levels  
- Block entire domain
- Unblock this exact domain
- Unblock subdomain and sub-levels
- Unblock entire domain
```

### Problems with Current Approach
1. **Six menu items** cluttering the context menu
2. **No visual hierarchy** - users must understand domain concepts upfront
3. **Confusing terminology** - "subdomain and sub-levels" vs "entire domain"
4. **No clear domain visualization** - users don't see what they're actually blocking

## Proposed New Structure

### Example URL: `sub.sub2.domain.com`

#### Top Level Menu
```
Block 1Password on:
├── domain.com ►
├── sub2.domain.com ►
└── sub.sub2.domain.com ►

Unblock 1Password on:
├── [Shows only currently blocked domains] ►
```

#### Submenu for Each Domain
```
domain.com ►
├── Block domain only
└── Include all subdomains

sub2.domain.com ►
├── Block domain only
└── Include all subdomains  

sub.sub2.domain.com ►
├── Block domain only
└── Include all subdomains
```

## Technical Implementation Plan

### Phase 1: Domain Extraction Enhancement

#### 1.1 Create `extractAllPossibleDomains()` Function
```javascript
function extractAllPossibleDomains(hostname) {
  const parts = hostname.split('.');
  const domains = [];
  
  // For hostname like: sub.sub2.domain.com
  // Generate: domain.com, sub2.domain.com, sub.sub2.domain.com
  
  for (let i = parts.length - 2; i >= 0; i--) {
    domains.push(parts.slice(i).join('.'));
  }
  
  return domains;
}
```

#### 1.2 Port Handling Integration
- Include port numbers for exact domain blocking
- Example: `localhost:3000` treated as distinct from `localhost:8080`
- Use `url.host` (includes port) vs `url.hostname` (no port)

### Phase 2: Dynamic Context Menu Generation

#### 2.1 Remove Static Menu Creation
- Delete hardcoded menu items from `chrome.runtime.onInstalled`
- Implement dynamic menu generation based on current tab

#### 2.2 Implement `chrome.tabs.onActivated` Listener
```javascript
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  updateContextMenuForTab(tab);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    updateContextMenuForTab(tab);
  }
});
```

#### 2.3 Dynamic Menu Builder Function
```javascript
async function updateContextMenuForTab(tab) {
  // Clear existing menus
  await chrome.contextMenus.removeAll();
  
  if (!tab.url || !tab.url.startsWith('http')) return;
  
  const url = new URL(tab.url);
  const domains = extractAllPossibleDomains(url.hostname);
  const blockedDomains = await getBlockedDomains();
  
  // Create parent menu for blocking
  chrome.contextMenus.create({
    id: 'block-parent',
    title: 'Block 1Password on',
    contexts: ['page', 'action']
  });
  
  // Add domain options
  domains.forEach(domain => {
    const parentId = `block-${domain}`;
    
    // Create domain parent menu
    chrome.contextMenus.create({
      id: parentId,
      parentId: 'block-parent',
      title: domain,
      contexts: ['page', 'action']
    });
    
    // Add submenu options
    chrome.contextMenus.create({
      id: `${parentId}-exact`,
      parentId: parentId,
      title: 'Block domain only',
      contexts: ['page', 'action']
    });
    
    chrome.contextMenus.create({
      id: `${parentId}-with-subs`,
      parentId: parentId,
      title: 'Include all subdomains',
      contexts: ['page', 'action']
    });
  });
  
  // Create unblock menus for currently blocked domains
  const relevantBlocked = findRelevantBlockedDomains(url.hostname, blockedDomains);
  if (relevantBlocked.length > 0) {
    chrome.contextMenus.create({
      id: 'unblock-parent',
      title: 'Unblock 1Password on',
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
```

### Phase 3: Click Handler Updates

#### 3.1 Parse Menu Item IDs
```javascript
function handleContextMenuClick(info, tab) {
  const menuId = info.menuItemId;
  
  if (menuId.startsWith('block-')) {
    handleBlockAction(menuId, tab);
  } else if (menuId.startsWith('unblock-')) {
    handleUnblockAction(menuId);
  }
}

function handleBlockAction(menuId, tab) {
  // Parse format: block-{domain}-{type}
  const parts = menuId.split('-');
  const type = parts[parts.length - 1]; // 'exact' or 'with-subs'
  const domain = parts.slice(1, -1).join('-'); // Reconstruct domain
  
  if (type === 'exact') {
    // Check if this is the exact current domain (including port)
    const url = new URL(tab.url);
    if (url.hostname === domain) {
      // Use host (with port) for exact match
      addToBlockList(`exact:${url.host}`);
    } else {
      // Parent domain, no port needed
      addToBlockList(`exact:${domain}`);
    }
  } else if (type === 'with-subs') {
    addToBlockList(`domain:${domain}`);
  }
}
```

### Phase 4: Storage Format Updates

#### 4.1 Maintain Backward Compatibility
- Keep existing format: `type:domain` 
- Support legacy entries without prefixes
- Handle port numbers in exact entries

#### 4.2 Entry Types
- `exact:domain.com` - Block only domain.com
- `exact:localhost:3000` - Block specific port
- `domain:domain.com` - Block domain.com and all subdomains
- `sub:sub.domain.com` - Legacy format (convert to domain)

### Phase 5: UI/UX Improvements

#### 5.1 Visual Indicators
- Add icons to menu items (if Chrome API supports)
- Show currently blocked status in menu titles
- Example: "domain.com ✓" if already blocked

#### 5.2 Smart Menu Organization
- Sort domains from most specific to least specific
- Hide redundant options (if parent domain already blocked with subdomains)
- Show only relevant unblock options

#### 5.3 Feedback Messages
- Add badge or notification when domain is blocked/unblocked
- Consider tab reload prompt after changes

## Migration Strategy

### Step 1: Preserve Existing Functionality
- Keep old menu structure initially
- Add new structure alongside
- Test thoroughly before removing old menus

### Step 2: Data Migration
- Convert `sub:` entries to `domain:` format
- Preserve all existing blocked domains
- Add migration flag to prevent re-running

### Step 3: Gradual Rollout
1. Implement domain extraction functions
2. Add dynamic menu generation
3. Update click handlers
4. Remove old static menus
5. Clean up legacy code

## Code File Changes

### background.js
- Remove static menu creation in `onInstalled`
- Add `onActivated` and `onUpdated` listeners
- Implement `updateContextMenuForTab()`
- Create `extractAllPossibleDomains()`
- Update `contextClick()` to handle new menu IDs
- Add `findRelevantBlockedDomains()`
- Implement `formatBlockedEntry()`

### content.js
- No changes needed initially
- Already supports the storage format
- Port handling already considered in improvements plan

### manifest.json
- No changes required
- Permissions already include necessary APIs

## Testing Checklist

### Functional Tests
- [ ] Multi-level subdomains show all options
- [ ] Single domain (example.com) shows correct options
- [ ] Localhost with ports handled correctly
- [ ] IP addresses work properly
- [ ] Block/unblock operations persist correctly
- [ ] Legacy entries still function

### Edge Cases
- [ ] Single-word domains (localhost)
- [ ] Very long domain chains
- [ ] Domains with special characters
- [ ] Mixed blocked/unblocked states
- [ ] Quick tab switching updates menus
- [ ] Non-HTTP URLs don't show menus

### User Experience
- [ ] Menu appears quickly on tab change
- [ ] Clear visual hierarchy
- [ ] Intuitive option names
- [ ] Appropriate feedback on actions
- [ ] No menu flashing or glitches

## Benefits of New Structure

1. **Clarity**: Users see exactly which domains they can block
2. **Flexibility**: Granular control with simple UI
3. **Discoverability**: Domain hierarchy is self-explanatory
4. **Efficiency**: Fewer top-level menu items
5. **Scalability**: Works well with any domain depth
6. **Context**: Shows relevant options based on current site

## Potential Enhancements (Future)

1. **Wildcard Support**: Allow patterns like `*.dev.domain.com`
2. **Temporary Blocking**: Time-based blocks
3. **Profile Support**: Different block lists for work/personal
4. **Import/Export**: Share block lists between devices
5. **Visual Mode**: Show diagram of domain hierarchy
6. **Quick Toggle**: Single-click enable/disable for current domain

## Implementation Timeline

- **Phase 1**: Domain extraction utilities (2 hours)
- **Phase 2**: Dynamic menu generation (3 hours)
- **Phase 3**: Click handler updates (2 hours)
- **Phase 4**: Testing and refinement (2 hours)
- **Phase 5**: UI polish and edge cases (1 hour)

**Total estimated time**: 10 hours of development

## Conclusion

This restructuring provides a more intuitive and flexible approach to domain blocking while maintaining backward compatibility. The hierarchical menu structure better represents the relationship between domains and subdomains, making it easier for users to understand and control exactly what they're blocking.