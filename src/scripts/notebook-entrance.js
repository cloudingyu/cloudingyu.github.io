const trigger = document.querySelector('[data-notebook-entrance]');
if (trigger) {
  let lastClick = 0;
  trigger.addEventListener('click', (event) => {
    // Count taps ourselves so double tapping works on touchscreens too.
    if (event.detail === 0) return;
    const now = performance.now();
    if (lastClick && now - lastClick <= 400) {
      lastClick = 0;
      location.assign(trigger.dataset.notebookEntrance);
    } else lastClick = now;
  });
  trigger.addEventListener('mousedown', (event) => {
    if (event.button === 0) event.preventDefault();
  });
  window.addEventListener('blur', () => { lastClick = 0; });
}
