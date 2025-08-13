
function run() {

	chrome.storage.sync.get( ["domains"] ).then( ( result ) => {

		if ( ! result ) {
			return;
		}

		if ( ! result.domains ) {
			return;
		}

		const domainsToIgnore = result.domains.split(',');
		const currentHostname = window.location.hostname;

		if ( ! shouldBlockDomain( currentHostname, domainsToIgnore ) ) {
			return;
		}

		console.log( "Hiding 1Password UI for domain: " + currentHostname );
		
		// The known 1Password UI tags (web components).
		const blockTagNames = ['com-1password-notification', 'com-1password-button', 'com-1password-menu'];

		// Create a hidden wrapper to move all the components into.
		const hiddenWrapper = document.createElement( 'div' );
		hiddenWrapper.className = 'onepassword-block-hide-element';
		document.body.append( hiddenWrapper );
		
		// Callback for the MutationObserver - move the added nodes to the hidden wrapper.
		function callback( mutationsList ) {

			mutationsList.forEach( ( mutation ) => {

				if ( mutation.type !== 'childList' ) {
					return;
				}

				for ( let node of mutation.addedNodes ) {
					if ( typeof node.tagName === "undefined" ) {
						continue;
					}
					if ( ! blockTagNames.includes( node.tagName.toLowerCase() ) ) {
						continue;
					}
					if ( ! node.parentNode ) {
						continue;
					}
					if ( node.parentNode.classList.contains( 'onepassword-block-hide-element' ) ) {
						continue;
					}

					moveToContainer( node, hiddenWrapper );
				}
			} );
		}

		// Initialize the MutationObserver.
		const observer = new MutationObserver( callback );
		const config = { childList: true, subtree: true };
		observer.observe( document.body, config );
		
		// In case the 1Password UI is already on the page before we added the mutation observer,
		// move those elements to the hidden wrapper.
		const onepassElements = document.querySelectorAll( blockTagNames.join(', ') );
		onepassElements.forEach( ( element, index ) => {
			if ( element.parentNode && ! element.parentNode.classList.contains( 'onepassword-block-hide-element' )) {
				moveToContainer( element, hiddenWrapper );
			}
		} );
	} );
}

function moveToContainer( element, container ) {
	element.remove();
	container.appendChild( element );
}

// Check if current hostname should be blocked based on stored domains
function shouldBlockDomain( hostname, blockedDomains ) {
	for ( const entry of blockedDomains ) {
		if ( ! entry ) continue;

		if ( isBlockedByEntry( hostname, entry ) ) {
			return true;
		}
	}
	return false;
}

// Check if hostname is blocked by a specific entry
function isBlockedByEntry( hostname, entry ) {
	const colonIndex = entry.indexOf(':');
	
	if ( colonIndex === -1 ) {
		// Legacy format - exact match
		return hostname === entry;
	}

	const type = entry.substring(0, colonIndex);
	const domain = entry.substring(colonIndex + 1);

	if ( type === 'exact' ) {
		return hostname === domain;
	}

	if ( type === 'sub' || type === 'domain' ) {
		return hostname === domain || hostname.endsWith('.' + domain);
	}

	return false;
}

// Init.
if ( document.readyState === 'complete' ) {
	run();
} else {
	window.addEventListener( 'load', run );
}
