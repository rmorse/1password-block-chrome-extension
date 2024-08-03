# Block the 1Password UI for specific domains.

This is a simple extension that hides the 1Password UI on domains that you have chosen.

__This plugin is currently being reviewed for approval on the Chrome extensions store.__

![1password-block-screen](https://github.com/user-attachments/assets/0499605b-e1ca-47cb-a2b2-48f00fee9413)


## Usage

Right click on any page, from the context menu choose the option `Block 1Password on domains` and then choose `Block domain` or `Unblock domain`.

You can also click on the extension icon if you pin it to your toolbar to block or unblock the current domain.

## Installing while waiting for approval in the Chrome store.

You can install this extension by:

 - Going to the Chrome extensions screen
 - Enabling developer mode
 - Choose `Load unpacked`
 - Navigate to this extension folder and select it
  
 ## How it works

The 1Password extension adds its UI to a page as web components.  We can't style external web components, so this extension moves the UI components into a hidden `div` instead.

I've intentionally not removed the components themselves in case it causes JavaScript errors.

This extension uses a MutationObserver to watch for the 1Password UI to be added to the page and immediately moves the components into a hidden `div` instead.

There may be a flicker as their UI gets added to a page and this extension tries to hide it, although I haven't seen it yet.
