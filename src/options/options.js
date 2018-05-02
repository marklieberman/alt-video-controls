// Initialize the options interface.
let inputAlwaysMute = document.getElementById('always-mute');
let inputBlacklist = document.getElementById('blacklist');
let inputWhitelistMode = document.getElementById('whitelist-mode');

browser.storage.local.get({
  alwaysMute: false,
  blacklist: [],
  whitelistMode: false
}).then(results => {
  inputAlwaysMute.checked = results.alwaysMute;
  inputBlacklist.value = results.blacklist.join('\n');
  inputWhitelistMode.checked = results.whitelistMode;
});

// Bind event handlers to the form.
let optionsForm = document.getElementById('options-form');
optionsForm.addEventListener('submit', saveOptions);

// ---------------------------------------------------------------------------------------------------------------------

// Save the options to local storage.
function saveOptions () {
  return browser.storage.local.set({
    alwaysMute: inputAlwaysMute.checked,
    blacklist: inputBlacklist.value.split('\n')
      .map(pattern => pattern.trim())
      .filter(pattern => (pattern.length > 0)),
    whitelistMode: inputWhitelistMode.checked
  });
}
