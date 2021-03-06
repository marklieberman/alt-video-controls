'use strict';

// Global state for video controls on this page.
const state = {
  videoControls: null,
  tabIsLoud: false,
  initialVolume: null,
  defaultMute: true,
  visibilityHandle: null
};

// Load settings from storage and initialize video controls.
browser.storage.local.get({
  alwaysMute: true,
  setVolume: false,
  initialVolume: 50,
  blacklist: [],
  whitelistMode: false
}).then(results => {
  // Check if this URL is blacklisted.
  let blacklisted = results.whitelistMode ^ results.blacklist.some(pattern => {
    return globMatches(pattern, window.location.href);
  });
  if (!blacklisted) {
    // Check if videos on this origin should be muted.
    return browser.runtime.sendMessage({
      topic: 'avc-getInitialState',
      data: {
        origin: window.location.origin
      }
    }).then(data => {
      // Set the default muted or unmuted for videos.
      state.tabIsLoud = data.tabIsLoud ? true : !results.alwaysMute;

      // Set the default initial volume for videos.
      state.initialVolume = results.setVolume ? (results.initialVolume / 100.0) : null;

      // Install video controls for video elements.
      return initializeVideoControls();
    });
  }
});

// Handle messages from the background script.
browser.runtime.onMessage.addListener((message, sender) => {
  switch (message.topic) {
    case 'avc-getTabIsLoud':
      return Promise.resolve({
        origin: window.location.origin,
        tabIsLoud: state.tabIsLoud
      });
    case 'avc-setTabIsLoud':
      state.tabIsLoud = message.data;
      break;
  }
});

// ---------------------------------------------------------------------------------------------------------------------

// Model/controller for video controls.
class VideoControls {
  constructor (video, template) {
    this.video = video;
    this.template = template;
  }

  // Add the video controls to the DOM and bind events.
  install () {
    document.body.appendChild(this.template);

    this.video.addEventListener('play', this.onVideoPlaying.bind(this));
    this.video.addEventListener('playing', this.onVideoPlaying.bind(this));
    this.video.addEventListener('pause', this.onVideoPaused.bind(this));
    this.video.addEventListener('paused', this.onVideoPaused.bind(this));
    this.video.addEventListener('ended', this.onVideoPaused.bind(this));
    this.video.addEventListener('timeupdate', this.onVideoTimeUpdate.bind(this));
    this.video.addEventListener('volumechange', this.onVideoVolumeChange.bind(this));
    this.video.addEventListener('click', this.onPlayPauseButtonClick.bind(this));
    this.video.addEventListener('mouseenter', this.onVideoMouseEnter.bind(this));
    this.video.addEventListener('mouseleave', this.onVideoMouseLeave.bind(this));

    this.fullscreenButton = this.template.querySelector('.avc-fullscreen');
    this.fullscreenButton.addEventListener('click', this.onFullScreenButtonClick.bind(this));

    this.muteButton = this.template.querySelector('.avc-mute');
    this.muteButton.addEventListener('click', this.onMuteButtonClick.bind(this));

    this.playPauseButton = this.template.querySelector('.avc-play-pause');
    this.playPauseButton.addEventListener('click', this.onPlayPauseButtonClick.bind(this));

    this.progressBar = this.template.querySelector('.avc-progress-bar');
    this.progressBar.addEventListener('change', this.onProgressBarChange.bind(this));

    this.volumeBar = this.template.querySelector('.avc-volume-bar');
    this.volumeBar.addEventListener('change', this.onVolumeBarChange.bind(this));

    this.timecodeCurrent = this.template.querySelector('.avc-timecode-current');
    this.timecodeDuration = this.template.querySelector('.avc-timecode-duration');

    // Display the controls for the first time once a frame is loaded.
    if (this.video.readyState > 1) {
      this.onVideoLoadedData();
    } else {
      this.video.addEventListener('loadeddata', this.onVideoLoadedData.bind(this));
    }
  }

  // Remove the video controls from the DOM.
  remove () {
    this.template.parentNode.removeChild(this.template);
  }

  // Position the controls over the video.
  position () {
    var self = this;
    window.requestAnimationFrame(() => {
      var bounds = self.video.getBoundingClientRect();
      self.template.style.top = (window.scrollY + bounds.top + bounds.height - self.template.clientHeight) + 'px';
      self.template.style.left = bounds.left + 'px';
      self.template.style.width = bounds.width + 'px';
    });
  }

  // Update the visibility of the controls.
  visiblity () {
    this.template.style.display = this.video.offsetParent ? 'flex' : 'none';
  }

  // Video events

  onVideoLoadedData () {
    // Configure the audio portion of the controls.
    this.updateVolumeControls(this.video.volume, this.video.muted);
    if (this.video.mozHasAudio) {
      this.template.classList.remove('avc-no-audio');
    }

    // Make the controls visible for the first time.
    this.template.style.display = 'flex';
    this.position();
  }

  onVideoPlaying () {
    this.template.classList.remove('avc-paused');
    this.template.classList.add('avc-playing');
  }

  onVideoPaused () {
    this.template.classList.remove('avc-playing');
    this.template.classList.add('avc-paused');
  }

  onVideoTimeUpdate () {
    this.updateProgressControls(this.video.currentTime, this.video.duration);
  }

  onVideoVolumeChange () {
    this.updateVolumeControls(this.video.volume, this.video.muted);
  }

  onVideoMouseEnter () {
    this.template.classList.add('avc-mouse-in');
    this.position();
  }

  onVideoMouseLeave () {
    this.template.classList.remove('avc-mouse-in');
  }

  // Control events

  onFullScreenButtonClick () {
    this.video.mozRequestFullScreen();
  }

  onMuteButtonClick () {
    if (this.video.muted) {
      this.video.muted = false;
      if (this.video.volume <= 0) {
        this.video.volume = 0.5;
      }
    } else {
      this.video.muted = true;
    }
  }

  onPlayPauseButtonClick () {
    if (this.video.paused) {
      this.video.play();
    } else {
      this.video.pause();
    }
  }

  onProgressBarChange () {
    this.video.currentTime = (this.progressBar.value / 1000) * this.video.duration;
  }

  onVolumeBarChange () {
    this.video.volume = (this.volumeBar.value / 100);
    this.video.muted = (this.volumeBar.value <= 0);
  }

  // Control interface

  // Update the controls that display the video progress.
  updateProgressControls (currentTime, duration) {
    this.progressBar.value = 1000 * (currentTime / duration);
    this.timecodeCurrent.innerText = formatTime(currentTime);
    this.timecodeDuration.innerText = formatTime(duration);
  }

  // Update the controls that display the video volume.
  updateVolumeControls (amount, muted) {
    if (muted) {
      this.template.classList.add('avc-muted');
      this.volumeBar.value = 0;
    } else {
      this.template.classList.remove('avc-muted');
      this.volumeBar.value = 100 * amount;
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------

// Initialize alternative video controls for video elements on this page.
function initializeVideoControls () {
  /* jshint loopfunc:true*/

  state.videoControls = new Map();

  // Create controls for all existing video elements.
  [].slice.call(document.getElementsByTagName('video'))
    .forEach(video => createVideoControls(video));

  // Find all mutations that add or remove a video element.
  const observer = new window.MutationObserver(mutationList => {
    for (var mutation of mutationList) {
      if (mutation.type === 'childList') {
        if (mutation.addedNodes.length) {
          for (let addedNode of mutation.addedNodes) {
            // Create controls for any added video elements.
            findVideoElements(addedNode).forEach(videoNode => {
              let controls = state.videoControls.get(videoNode);
              if (!controls) {
                createVideoControls(videoNode);
              }
            });
          }
        }
        if (mutation.removedNodes.length) {
          for (let removedNode of mutation.removedNodes) {
            // Destroy controls for any removed video elements.
            findVideoElements(removedNode).forEach(videoNode => {
              let controls = state.videoControls.get(videoNode);
              if (!!controls) {
                destroyVideoControls(controls);
              }
            });
          }
        }
      }
    }
  });

  // Begin observing changes to the DOM.
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function findVideoElements (element, accumulator = []) {
  if (element.tagName === 'VIDEO') {
    accumulator.push(element);
  } else
  if (element.children) {
     Array.from(element.children).forEach(child => {
      findVideoElements(child, accumulator);
    });
  }
  return accumulator;
}

// Create controls on a video element.
function createVideoControls (video) {
  // Disable the native controls.
  video.controls = false;

  // Set initial muted state for the video.
  video.muted = !state.tabIsLoud;

  // Set initial volume for the video.
  if (state.initalVolume !== null) {
    video.volume = state.initialVolume;
  }

  // Start watching visibility of the controls.
  startWatchingVisiblity();

  // Install the custom controls.
  return getTemplate().then(template => {
    // Install and position the controls.
    let controls = new VideoControls(video, template);
    state.videoControls.set(video, controls);
    controls.install();
    controls.position();
  });
}

// Destroy the controls for a video element.
function destroyVideoControls (controls) {
  // Remove the controls from the DOM.
  state.videoControls.delete(controls.video);
  controls.remove();

  // Stop watching visibility if all controls are gone.
  if (!state.videoControls.size) {
    stopWatchingVisiblity();
  }
}

// Start watching the visibility of all video controls.
function startWatchingVisiblity () {
  if (!state.visibilityHandle) {
    window.setTimeout(watchVisiblity, 0);
  }
}

// Stop watching the visibility of all video controls.
function stopWatchingVisiblity () {
  if (state.visibilityHandle) {
    window.clearTimeout(state.visibilityHandle);
    state.visibilityHandle = null;
  }
}

// Update the visibility of all video controls.
function watchVisiblity () {
  state.videoControls.forEach(function (controls) {
    controls.visiblity();
  });
  window.setTimeout(watchVisiblity, 200);
}

// ---------------------------------------------------------------------------------------------------------------------

// Fetch the video controls template.
function getTemplate () {
  return new Promise((resolve, reject) => {
    var xhr = new window.XMLHttpRequest();
    xhr.open('GET', browser.extension.getURL('/content/controls.html'));
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        let template = document.createElement('template');
        template.innerHTML = xhr.response;
        resolve(template.content.firstChild);
      }
    };
    xhr.send();
  });
}

// Format a time in seconds as 0:00:00.
function formatTime (time) {
  let secs = Math.ceil(time);
  let hours = Math.trunc(secs / 3600); secs -= 3600 * hours;
  let mins = Math.trunc(secs / 60); secs -= 60 * mins;

  if (hours > 0) {
    return String(hours) + ':' + String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  } else {
    return String(mins) + ':' + String(secs).padStart(2, '0');
  }
}

// Match a simple glob pattern against an input.
function globMatches (glob, input) {
  // Get the *-delimited parts of the glob.
  let parts = glob.split('*');
  let firstPart = parts[0];
  let lastPart = parts[parts.length - 1];

  // If the glob is longer than the string, it can't match.
  if (parts.join('').length > input.length) {
    return false;
  }

  let part, index = 0;
  while ((part = parts.shift()) !== undefined) {
    // Check if this part of the glob can be found in the string, after the previous part.
    index = input.indexOf(part, index);
    if (!~index) {
      return false;
    }
  }

  return true;
}
