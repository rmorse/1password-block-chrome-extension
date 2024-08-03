
function run() {
	chrome.storage.sync.get(["domains"]).then((result) => {
		if ( result && result.domains ) {
			const domainsToIgnore = result.domains.split(',');

			if ( ! domainsToIgnore.includes(window.location.hostname) ) {
				return;
			}
			console.log("Hiding 1Password UI for domain: " + window.location.hostname);
		
			let intervalCount = 0;
			const intervalId = setInterval( function() {
				const elementsToHide = [];
				
				const onepassNotificationElements = document.getElementsByTagName( 'com-1password-notification' );
				
				Array.from( onepassNotificationElements ).forEach( (element, index) => {
					// Only add it again if its not already wrapped.
					if ( ! element.parentNode.classList.contains( 'onepassword-block-hide-element' ) ) {
						elementsToHide.push( element );
					}
				} );
				const onepassButtonElements = document.getElementsByTagName( 'com-1password-notification' );
				
				Array.from( onepassButtonElements ).forEach( (element, index) => {
					// Only add it again if its not already wrapped.
					if ( ! element.parentNode.classList.contains( 'onepassword-block-hide-element' ) ) {
						elementsToHide.push( element );
					}
				} );
				
				// Loop and hide the elements.
				elementsToHide.forEach( (element, index) => {
					wrapElementInHiddenContainer( element );
				} );
				
				if ( intervalCount >= 20 ) {
					// Stop after 20 intervals.
					clearInterval( intervalId );
				}
				intervalCount++;
			}, 100 );
		}
	});
}

function wrapElementInHiddenContainer ( element ) {
	const wrapper = document.createElement('div');
    wrapper.className = 'onepassword-block-hide-element';
    element.parentNode.insertBefore(wrapper, element);
    wrapper.appendChild(element);
	console.log(`element wrapped`);
}

if (document.readyState === 'complete') {
  run();
} else {
  window.addEventListener('load', run);
}
