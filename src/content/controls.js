'use strict';

// Inline the controls template.
const controlsHtml = `<div class="avc-container avc-no-audio avc-paused" style="display: none">
  <button class="avc-play-pause" type="button">
    <!-- paused -->
    <svg class="avc-play-icon" viewBox="0 0 24 24">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
    <!-- playing -->
    <svg class="avc-pause-icon" viewBox="0 0 24 24">
      <polygon points="5,3 19,12 5,21 5,3" />
    </svg>
  </button>
  <input class="avc-progress-bar" type="range" max="1000" min="0" step="1" value="0"></input>
  <span class="avc-timecode">
    <span class="avc-timecode-current">0:00</span> / <span class="avc-timecode-duration">0:00</span>
  </span>
  <button class="avc-mute" type="button">
    <!-- no sound -->
    <svg class="avc-no-audio-icon" viewBox="0 0 24 24">
      <polygon points="13,5 8,9 4,9 4,15 8,15 13,19 13,5" />
      <line x1="2" y2="4" x2="20" y1="22"></line>
    </svg>
    <!-- muted -->
    <svg class="avc-muted-icon" viewBox="0 0 24 24">
      <polygon points="11,5 6,9 2,9 2,15 6,15 11,19 11,5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
    <!-- volume on -->
    <svg class="avc-loud-icon" viewBox="0 0 24 24">
      <polygon points="11,5 6,9 2,9 2,15 6,15 11,19 11,5" />
      <path d="M 19.07 4.93 a 10 10 0 0 1 0 14.14 M 15.54 8.46 a 5 5 0 0 1 0 7.07" />
    </svg>
  </button>
  <input class="avc-volume-bar" type="range" max="100" min="0" step="1"></input>
  <button class="avc-fullscreen" type="button">
    <!-- fullscreen -->
    <svg viewBox="0 0 24 24">
      <path d="M 8 3 H 5 a 2 2 0 0 0 -2 2 v 3 m 18 0 V 5 a 2 2 0 0 0 -2 -2 h -3 m 0 18 h 3 a 2 2 0 0 0 2 -2 v -3 M 3 16 v 3 a 2 2 0 0 0 2 2 h 3" />
    </svg>
  </button>
</div>`;

// Global state for video controls on this page.
const state = {
  avcBarHeight: 32,
  videoControls: null,
  tabIsLoud: false,
  initialVolume: null,
  defaultMute: true
};

// Load settings from storage and initialize video controls.
browser.storage.local.get({
  alwaysMute: true,
  setVolume: false,
  initialVolume: 50,
  blacklist: [],
  whitelistMode: false
}).then(async (results) => {
  // Check if this URL is blacklisted.
  const blacklisted = results.whitelistMode ^ results.blacklist
    .some(pattern => globMatches(pattern, window.location.href));
  if (!blacklisted) {
    // Check if videos on this origin should be muted.
    let initialState = await browser.runtime.sendMessage({
      topic: 'avc-getInitialState',
      data: {
        origin: window.location.origin
      }
    });

    // Set initial values for videos with audio.
    state.initialVolume = results.setVolume ? (results.initialVolume / 100.0) : null;
    state.tabIsLoud = initialState.tabIsLoud ? true : !results.alwaysMute;

    // Install video controls for video elements.
    return initializeVideoControls();
  }
});

// Handle messages from the background script.
browser.runtime.onMessage.addListener((message) => {
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

// --------------------------------------------------------------------------------------------------------------------

// Model/controller for video controls.
class VideoControls {
  constructor (video, template) {
    this.video = video;
    this.template = template;

    this.el = {};

    this.resizeObserver = new ResizeObserver(() => {
      this.onResized(false);
    });

    this.intersectionObserver = new IntersectionObserver((entries) => {
      this.onIntersect(entries[0].isIntersecting);
    }, {
      root: video.offsetParent,
      threshold: 0
    });    
  }

  static create(video) {
    const template = document.createElement('template');
    template.innerHTML = controlsHtml;

    const videoControls = new VideoControls(video, template.content.firstChild);    
    videoControls.install();

    return videoControls;
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

    this.el = {
      fullscreenButton: this.template.querySelector('.avc-fullscreen'),
      muteButton: this.template.querySelector('.avc-mute'),
      playPauseButton: this.template.querySelector('.avc-play-pause'),
      progressBar: this.template.querySelector('.avc-progress-bar'),
      volumeBar: this.template.querySelector('.avc-volume-bar'),
      timecodeCurrent: this.template.querySelector('.avc-timecode-current'),
      timecodeDuration: this.template.querySelector('.avc-timecode-duration')
    };

    this.el.fullscreenButton.addEventListener('click', this.onFullScreenButtonClick.bind(this));
    this.el.muteButton.addEventListener('click', this.onMuteButtonClick.bind(this));
    this.el.playPauseButton.addEventListener('click', this.onPlayPauseButtonClick.bind(this));
    this.el.progressBar.addEventListener('change', this.onProgressBarChange.bind(this));
    this.el.volumeBar.addEventListener('change', this.onVolumeBarChange.bind(this));

    this.resizeObserver.observe(this.video);
    this.intersectionObserver.observe(this.video);

    // Initialize the controls once the video data is available.
    if (this.video.readyState > 1) {
      this.onVideoLoadedData();
    } else {
      this.video.addEventListener('loadeddata', this.onVideoLoadedData.bind(this));
    }
  }

  // Remove the video controls from the DOM.
  remove () {    
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    this.template.parentNode.removeChild(this.template);
  }

  // Resize and reposition the controls overlay.
  onResized (useAnimFrame) {
    function stipPx (value) {
      return Number(value.substring(0, value.length - 2));
    }

    const callback = () => {
      const bounds = this.video.getBoundingClientRect(),
            styles = window.getComputedStyle(this.video, null);

      let marginLeft = 0,
          marginRight = 0,
          marginTop = 0,
          marginBottom = 0;

      if (styles.getPropertyValue('box-sizing') === 'context-box') {
        marginLeft = stipPx(styles.getPropertyValue('margin-left'));
        marginRight = stipPx(styles.getPropertyValue('margin-right'));  
        marginTop = stipPx(styles.getPropertyValue('margin-top'));
        marginBottom = stipPx(styles.getPropertyValue('margin-bottom'));
      }

      this.template.style.top = (window.scrollY + bounds.top + bounds.height + marginTop - marginBottom - state.avcBarHeight) + 'px';
      this.template.style.left = (window.scrollX + bounds.left + marginLeft - marginRight) + 'px';
      this.template.style.width = bounds.width + 'px';
    };

    if (useAnimFrame) {
      window.requestAnimationFrame(callback);
    } else {
      callback();
    }
  }

  // Show the controls overlay when the video element is visible.
  onIntersect (isIntersecting) {
    this.template.style.display = isIntersecting ? 'flex' : 'none';    
  }

  // ------------------------------------------------------------------------------------------------------------------
  // Video events

  onVideoLoadedData () {
    this.updateVolumeControls(this.video.volume, this.video.muted);
    if (this.video.mozHasAudio) {
      this.template.classList.remove('avc-no-audio');
    }
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
  }

  onVideoMouseLeave () {
    this.template.classList.remove('avc-mouse-in');
  }

  // ------------------------------------------------------------------------------------------------------------------
  // Controls interface.

  // Update the controls that display the video progress.
  updateProgressControls (currentTime, duration) {
    this.el.progressBar.value = 1000 * (currentTime / duration);
    this.el.timecodeCurrent.innerText = formatTime(currentTime);
    this.el.timecodeDuration.innerText = formatTime(duration);
  }

  // Update the controls that display the video volume.
  updateVolumeControls (amount, muted) {
    if (muted) {
      this.template.classList.add('avc-muted');
      this.el.volumeBar.value = 0;
    } else {
      this.template.classList.remove('avc-muted');
      this.el.volumeBar.value = 100 * amount;
    }
  }

  // ------------------------------------------------------------------------------------------------------------------
  // Control events

  onPlayPauseButtonClick () {
    if (this.video.paused) {
      this.video.play();
    } else {
      this.video.pause();
    }
  }

  onProgressBarChange () {
    this.video.currentTime = (this.el.progressBar.value / 1000) * this.video.duration;
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

  onVolumeBarChange () {
    this.video.volume = (this.el.volumeBar.value / 100);
    this.video.muted = (this.el.volumeBar.value <= 0);
  }

  onFullScreenButtonClick () {
    this.video.mozRequestFullScreen();
  }
}

// --------------------------------------------------------------------------------------------------------------------

// Find all video elements in a DOM tree.
function findVideoElements (startElement, accumulator = []) {
  if (startElement.tagName === 'VIDEO') {
    accumulator.push(startElement);
  } else
  if (startElement.children) {
     Array.from(startElement.children).forEach(child => {
      findVideoElements(child, accumulator);
    });
  }
  return accumulator;
}

// Initialize alternative video controls for video elements on this page.
function initializeVideoControls () {
  /* jshint loopfunc:true*/

  state.videoControls = new WeakMap();

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
              if (controls) {
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

// Create controls on a video element.
function createVideoControls (video) {
  // Disable the native controls.
  video.controls = false;

  // Set initial muted state for the video.
  video.muted = !state.tabIsLoud;

  // Set initial volume for the video.
  if (state.initialVolume !== null) {
    video.volume = state.initialVolume;
  }

  // Install and position the controls.
  const controls = VideoControls.create(video);
  state.videoControls.set(video, controls);
}

// Destroy the controls for a video element.
function destroyVideoControls (controls) {
  // Remove the controls from the DOM.
  state.videoControls.delete(controls.video);
  controls.remove();
}

// --------------------------------------------------------------------------------------------------------------------

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
  const parts = glob.split('*');

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
