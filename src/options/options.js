'use strict';

// Initialize the options interface.
let inputAlwaysMute = document.getElementById('always-mute');
let inputSetVolume = document.getElementById('set-volume');
let inputInitialVolume = document.getElementById('initial-volume');
let inputBlacklist = document.getElementById('blacklist');
let radioWhitelistMode = document.getElementById('whitelist-mode');

browser.storage.local.get({
  alwaysMute: false,
  setVolume: false,
  initalVolume: 50,
  blacklist: [],
  whitelistMode: false
}).then(results => {
  inputAlwaysMute.checked = results.alwaysMute;
  inputSetVolume.checked = results.setVolume;
  inputInitialVolume.value = results.initalVolume;
  inputBlacklist.value = results.blacklist.join('\n');
  radioWhitelistMode.checked = results.whitelistMode;
});

// Bind event handlers to the form.
let optionsForm = document.getElementById('options-form');
optionsForm.addEventListener('submit', saveOptions);

// ---------------------------------------------------------------------------------------------------------------------

// Save the options to local storage.
function saveOptions () {
  return browser.storage.local.set({
    alwaysMute: inputAlwaysMute.checked,
    setVolume: inputSetVolume.checked,
    initialVolume: Number(inputInitialVolume.value),
    blacklist: inputBlacklist.value.split('\n')
      .map(pattern => pattern.trim())
      .filter(pattern => (pattern.length > 0)),
    whitelistMode: radioWhitelistMode.checked
  });
}
