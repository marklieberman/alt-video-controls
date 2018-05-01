# WebEx Video Controls

Injects a control overlay on video elements as an alternative to the native video controls.

### Purpose of this Extension

Firefox 59 introduced a change that made is such that mouse events on video elements are not dispatched to JavaScript
handlers while the native controls are visible. (See https://bugzilla.mozilla.org/show_bug.cgi?id=1412617)

Although the video controls provided by this extension are not as polished as the native controls, these controls do
not interfere with mouse gestures.
