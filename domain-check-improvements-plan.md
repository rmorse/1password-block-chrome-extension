# Domain Checking Improvements Plan for 1Password Blocker Extension

## Current Issues

### 1. Port Number Handling
- **Problem**: "Block this exact domain" doesn't include port numbers
- **Impact**: Users cannot differentiate between `localhost:3000` and `localhost:8080` for local development
- **Example**: Blocking `localhost` blocks all ports, not just a specific development server

### 2. String Parsing Method
- **Problem**: Current code splits by `:` which conflicts with port numbers
- **Impact**: Entries like `exact:localhost:3000` are incorrectly parsed
- **Current code** (content.js:96-104):
  ```javascript
  const colonIndex = entry.indexOf(':');
  const type = entry.substring(0, colonIndex);
  const domain = entry.substring(colonIndex + 1);
  ```

### 3. Code Duplication
- Domain type logic exists in both `content.js` and `background.js`
- No shared utility functions for consistent parsing

## Proposed Solution

### 1. Universal `getBlockTypeData` Function
Create a centralized function that:
- Checks for known prefixes (`exact:`, `sub:`, `domain:`)
- Extracts the prefix to determine block type
- Returns the remaining string as the domain (including port if present)
- Handles legacy entries (no prefix = exact match)

```javascript
function getBlockTypeData(entry) {
  const prefixes = ['exact:', 'sub:', 'domain:'];
  
  for (const prefix of prefixes) {
    if (entry.startsWith(prefix)) {
      return {
        type: prefix.slice(0, -1), // Remove the colon
        domain: entry.substring(prefix.length)
      };
    }
  }
  
  // Legacy format - no prefix means exact match
  return {
    type: 'exact',
    domain: entry
  };
}
```

### 2. Port Number Support for Exact Matching
- When using "Block this exact domain", include the port in the stored entry
- Example: `exact:localhost:3000` where `localhost:3000` is the full domain+port
- Update `background.js` to extract hostname AND port:
  ```javascript
  const url = new URL(tab.url);
  const hostnameWithPort = url.port ? `${url.hostname}:${url.port}` : url.hostname;
  ```

### 3. Updated Matching Logic
- For `exact` type: Match hostname+port exactly
- For `sub` and `domain` types: Match hostname only (ignore ports)
- Update `content.js` to check `window.location.host` (includes port) for exact matches

## Implementation Steps

1. **Create shared utilities**
   - Add `getBlockTypeData` function to both content.js and background.js
   - Or create a shared utils.js file if the extension architecture supports it

2. **Update background.js**
   - Modify `getDomainTypes` to include port for exact matches
   - Use `url.host` instead of `url.hostname` for exact domain extraction

3. **Update content.js**
   - Replace the colon-splitting logic with `getBlockTypeData`
   - Use `window.location.host` for exact matching (includes port)
   - Use `window.location.hostname` for sub/domain matching (no port)

4. **Maintain backward compatibility**
   - Support legacy entries without prefixes (treat as exact match)
   - Handle existing stored domains gracefully

## Quick Wins Identified

### 1. Input Sanitization
- Trim whitespace from domain entries
- Remove empty entries when splitting by comma
- Validate domain format before storing

### 2. Duplicate Prevention
- Check if entry already exists before adding (current check may miss variations)
- Consider case-insensitive matching

### 3. Storage Optimization
- Remove trailing commas in stored domains string
- Consider using array storage instead of comma-separated string

### 4. Error Handling
- Add try-catch blocks around URL parsing
- Handle malformed entries gracefully
- Log errors for debugging

## Code Changes Summary

### content.js
- Replace lines 96-104 with `getBlockTypeData` function
- Update `isBlockedByEntry` to use the new parsing method
- Use `window.location.host` for exact matches with ports

### background.js
- Update `getDomainTypes` to include port for exact type
- Use `url.host` instead of `url.hostname` for exact domains
- Add the same `getBlockTypeData` function for consistency

## Testing Scenarios

1. **Port-specific blocking**
   - Block `localhost:3000` but not `localhost:8080`
   - Block `example.com:8443` but not `example.com`

2. **Subdomain blocking**
   - Block `*.example.com` including `sub.example.com`
   - Ensure ports don't affect subdomain matching

3. **Legacy format support**
   - Ensure old entries without prefixes still work
   - Test migration of existing stored domains

## Benefits

1. **Better local development support**: Developers can block specific ports
2. **Cleaner code**: No ambiguous string splitting
3. **Maintainability**: Centralized parsing logic
4. **Backward compatible**: Existing stored domains continue to work
5. **More robust**: Handles edge cases better