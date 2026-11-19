# Glance "3D blue" skin

A stylesheet that gives the [Glance](https://github.com/glanceapp/glance) start page the same look as the 3D cards:

- a deep-blue glowing background with twinkling stars
- every widget becomes a raised tile that tilts slightly on hover, and widgets fly in when the page loads
- gold, pulsing widget headers and a gold underline on the current tab
- chunky 3D clock numerals
- glowing green-to-blue meters in the server stats widget
- bookmark group titles keep their colours, but lightened so they stay readable on navy
- the Nunito font

It only restyles Glance's own classes, so your pages, widgets and bookmarks stay exactly as they are. It needs Glance v0.7 or newer and was tested on v0.8.8.

## Install

1. Copy [`glance/user.css`](../glance/user.css) to a folder Glance can read, for example `/opt/glance/assets/user.css`.
2. In `glance.yml`, serve that folder and point the theme at the file. The colours below match the skin:

```yaml
server:
  assets-path: /opt/glance/assets

theme:
  light: false
  background-color: 216 65 17
  contrast-multiplier: 1.1
  primary-color: 42 100 71
  positive-color: 147 83 65
  negative-color: 7 100 74
  custom-css-file: /assets/user.css
```

3. Restart Glance. If the page still looks light, open the theme picker (the three dots at the top right) and pick the default theme.

To undo, remove the `custom-css-file` line.

If you've turned on reduced motion in your system settings, the skin's animations are switched off.

[← back to all cards](../README.md)
