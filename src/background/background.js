'use strict';

var state = {
  loudTabs: new Set()
};

// Convert the origin to a host permission matcher.
function originToHostMatcher (origin) {
  return origin.replace(/^https?:/, '*:') + '/*';
}

// Update the icon and title for the browserAction.
function updateBrowserAction (tabId, tabIsLoud) {
  if (tabIsLoud) {
    browser.browserAction.setTitle({
      title: 'Mute videos on this domain',
      tabId
    });
    browser.browserAction.setIcon({
      path: 'icons/speaker.svg',
      tabId
    });
  } else {
    browser.browserAction.setTitle({
      title: 'Un-mute videos on this domain',
      tabId
    });
    browser.browserAction.setIcon({
      path: 'icons/mute.svg',
      tabId
    });
  }
}

// Handle messages from the content script.
browser.runtime.onMessage.addListener((message, sender) => {
  switch (message.topic) {
    case 'avc-getInitialState':
      return browser.storage.local.get({
        alwaysMute: true
      }).then(results => {
        let hostMatcher = originToHostMatcher(message.data.origin);
        let tabIsLoud = !results.alwaysMute || state.loudTabs.has(hostMatcher);
        updateBrowserAction(sender.tab.id, tabIsLoud);
        return ({ tabIsLoud });
      });
  }
});

// Listener for clicks on the browserAction button.
browser.browserAction.onClicked.addListener((tab) => {
  // Toggle event listeners installed in the tab.
  browser.tabs.sendMessage(tab.id, {
    topic: 'avc-getTabIsLoud'
  }).then(data => {
    // Add or remove the tab ID from the backlist.
    let hostMatcher = originToHostMatcher(data.origin);
    if (data.tabIsLoud) {
      state.loudTabs.delete(hostMatcher);
    } else {
      state.loudTabs.add(hostMatcher);
    }

    // Update the browserAction for all tabs with this origin.
    browser.tabs.query({
      url: hostMatcher
    }).then(tabs => {
      tabs.forEach(tab => {
        // Update the tabIsLoud setting for all matching tabs.
        updateBrowserAction(tab.id, !data.tabIsLoud);
        browser.tabs.sendMessage(tab.id, {
          topic: 'avc-setTabIsLoud',
          data: !data.tabIsLoud
        });
      });
    });
  });
});
