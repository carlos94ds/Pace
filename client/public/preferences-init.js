// Runs before React to avoid a light/dark flash. Keys match src/lib/preferences.ts.
(function () {
  var root = document.documentElement;
  var theme = 'system';
  var textSize = 'medium';
  try {
    theme = localStorage.getItem('pace.theme') || theme;
    textSize = localStorage.getItem('pace.textSize') || textSize;
  } catch {
    // Storage blocked (private mode): defaults apply.
  }
  var dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.textSize = textSize;
})();
