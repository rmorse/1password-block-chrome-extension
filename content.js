
function run() {

	chrome.storage.sync.get( ["domains"] ).then( ( result ) => {

		if ( ! result ) {
			return;
		}

		if ( ! result.domains ) {
			return;
		}

		const domainsToIgnore = result.domains.split(',');

		if ( ! domainsToIgnore.includes( window.location.hostname ) ) {
			return;
		}

		console.log( "Hiding 1Password UI for domain: " + window.location.hostname );
		
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

// Init.
if ( document.readyState === 'complete' ) {
	un();
} else {
	window.addEventListener( 'load', run );
}
