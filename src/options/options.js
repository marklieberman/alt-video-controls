'use strict';

const el = {
  optionsForm: document.getElementById('options-form'),
  buttonBackupSettings: document.getElementById('backup-settings'),
  fileRestoreSettings: document.getElementById('restore-settings'),
  inputAlwaysMute: document.getElementById('always-mute'),
  inputSetVolume: document.getElementById('set-volume'),
  inputInitialVolume: document.getElementById('initial-volume'),
  inputBlacklist: document.getElementById('blacklist'),
  radioWhitelistMode: document.getElementById('whitelist-mode')
};

browser.storage.local.get({
  alwaysMute: false,
  setVolume: false,
  initialVolume: 50,
  blacklist: [],
  whitelistMode: false
}).then(populateSettings);

// Bind event handlers to the form.
el.buttonBackupSettings.addEventListener('click', () => backupSettings());
el.fileRestoreSettings.addEventListener('change', () => restoreSettings());
el.optionsForm.addEventListener('submit', saveOptions);

// Initialize controls from settings.
function populateSettings (settings) {  
  el.inputAlwaysMute.checked = settings.alwaysMute;
  el.inputSetVolume.checked = settings.setVolume;
  el.inputInitialVolume.value = settings.initialVolume;
  el.inputBlacklist.value = settings.blacklist.join('\n');
  el.radioWhitelistMode.checked = settings.whitelistMode;
}

// Save the options to local storage.
function saveOptions () {
  return browser.storage.local.set({
    alwaysMute: el.inputAlwaysMute.checked,
    setVolume: el.inputSetVolume.checked,
    initialVolume: Number(el.inputInitialVolume.value),
    blacklist: el.inputBlacklist.value.split('\n')
      .map(pattern => pattern.trim())
      .filter(pattern => (pattern.length > 0)),
    whitelistMode: el.radioWhitelistMode.checked
  });
}

// Backup settings to a JSON file which is downloaded.
async function backupSettings () {
  // Get the settings to be backed up.
  let backupSettings = await browser.storage.local.get({
    alwaysMute: false,
    setVolume: false,
    initialVolume: 50,
    blacklist: [],
    whitelistMode: false
  });

  // Wrap the settings in an envelope.
  let backupData = {};
  backupData.settings = backupSettings;
  backupData.timestamp = new Date();
  backupData.fileName = 'alternativeVideoControls.' + [
    String(backupData.timestamp.getFullYear()),
    String(backupData.timestamp.getMonth() + 1).padStart(2, '0'),
    String(backupData.timestamp.getDate()).padStart(2, '0')
  ].join('-') + '.json';
  // Record the current addon version.
  let selfInfo = await browser.management.getSelf();
  backupData.addonId = selfInfo.id;
  backupData.version = selfInfo.version;

  // Encode the backup as a JSON data URL.
  let jsonData = JSON.stringify(backupData, null, 2);
  let dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonData);

  // Prompt the user to download the backup.
  let a = window.document.createElement('a');
  a.href = dataUrl;
  a.download = backupData.fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Restore settings froma JSON file which is uploaded.
async function restoreSettings () {
  let reader = new window.FileReader();
  reader.onload = async () => {
    try {
      // TODO Validate the backup version, etc.
      let backupData = JSON.parse(reader.result);
      populateSettings(backupData.settings);      
      alert('Settings copied from backup; please Save now.');
    } catch (error) {
      alert(`Failed to restore: ${error}`);
    }
  };
  reader.onerror = (error) => {
    alert(`Failed to restore: ${error}`);
  };
  reader.readAsText(el.fileRestoreSettings.files[0]);
}
