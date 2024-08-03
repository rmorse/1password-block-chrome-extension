
// Add context menu items.
chrome.runtime.onInstalled.addListener(() => {
	// Add block domain context menu item.
	chrome.contextMenus.create({
		id: '1password-block-domain',
		title: 'Block this domain',
		contexts: ['page', 'action']
	});

	// Add unblock domain context menu item.
	chrome.contextMenus.create({
		id: '1password-unblock-domain',
		title: 'Unblock this domain',
		contexts: ['page', 'action']
	})

});

// Handle context menu clicks.
function contextClick(info, tab) {
	const { menuItemId } = info

	// Get the domain name from the tab URL.
	const domainName = new URL( tab.url ).hostname;

	// Block the domain.
	if ( menuItemId === '1password-block-domain' ) {
		chrome.storage.sync.get( ["domains"] ).then( ( result ) => {
			// Init setting.
			let domainsToIgnore = result.domains ? result.domains : '';
			// Add the domain to the list if it's not already there.
			if ( ! domainsToIgnore.includes( domainName ) ) {
				domainsToIgnore = domainsToIgnore.concat( domainName, ',' );
			}
			chrome.storage.sync.set( { 'domains': domainsToIgnore } );
		});
	}

	// Unblock the domain.
	if ( menuItemId === '1password-unblock-domain' ) {
		chrome.storage.sync.get( ["domains"] ).then( ( result ) => {
			// Init setting.
			let domainsToIgnore = result.domains ? result.domains : '';
			// Remove the domain from the list.
			domainsToIgnore = domainsToIgnore.replaceAll( domainName + ',', '' );
			chrome.storage.sync.set( { 'domains': domainsToIgnore } );
		});
	}
}

// Add context menu click listener.
chrome.contextMenus.onClicked.addListener( contextClick );
