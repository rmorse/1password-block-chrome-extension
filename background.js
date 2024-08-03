
let domainsToIgnore = '';


chrome.runtime.onInstalled.addListener(() => {
	chrome.contextMenus.create({
		id: '1password-block-domain',
		title: 'Block this domain',
		contexts: ['page', 'action']
	});

	chrome.contextMenus.create({
		id: '1password-unblock-domain',
		title: 'Unblock this domain',
		contexts: ['page', 'action']
	})

  });


function contextClick(info, tab) {
	const { menuItemId } = info
	const domainName = new URL(tab.url).hostname;
	if ( menuItemId === '1password-block-domain' ) {

		// 
		chrome.storage.sync.get(["domains"]).then((result) => {
			domainsToIgnore = result.domains ? result.domains : '';
			if ( ! domainsToIgnore.includes(domainName) ) {
				domainsToIgnore = domainsToIgnore.concat( domainName, ',' );
			}
			chrome.storage.sync.set({ 'domains': domainsToIgnore }).then(() => {
				console.log("Value is set", domainsToIgnore);
			});
		});
	}
	if ( menuItemId === '1password-unblock-domain' ) {
		const domains = domainsToIgnore.split(',');
		chrome.storage.sync.get(["domains"]).then((result) => {
			domainsToIgnore = result.domains ? result.domains : '';
			domainsToIgnore = domainsToIgnore.replaceAll(domainName + ',', '');
			chrome.storage.sync.set({ 'domains': domainsToIgnore }).then(() => {
				console.log("Value is set", domainsToIgnore);
			});
		});
	}
}

chrome.contextMenus.onClicked.addListener( contextClick );
