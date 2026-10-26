const views = {
  home: ['RelayN Home interface with an empty media stage, collection and playback controls', 'A calm starting point for your next session, with your current file and queue close by.'],
  library: ['RelayN Library interface with media filters, list and grid controls, and file inspector', 'Search and organize the files in your queue. Filter audio and video, switch layouts, and inspect a selection.'],
  video: ['RelayN Video interface with a large empty screening area and shared playback controls', 'Give video the space it deserves, with the shared playback controls just below the picture.'],
  audio: ['RelayN Audio interface with record artwork, metadata area and play queue', 'An audio-focused space for file details and your play queue. Generic artwork is used when no cover is available.'],
};
const tabs = [...document.querySelectorAll('[role="tab"]')];
function activate(tab, focus = false) {
  const view = tab.dataset.view;
  if (!Object.hasOwn(views, view)) return;
  tabs.forEach(item => { item.setAttribute('aria-selected', String(item === tab)); item.tabIndex = item === tab ? 0 : -1; });
  const image = document.getElementById('preview-image');
  image.src = `assets/${view}.webp`;
  image.alt = views[view][0];
  document.getElementById('preview-description').textContent = views[view][1];
  document.getElementById('preview-panel').setAttribute('aria-labelledby', tab.id);
  if (focus) tab.focus();
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activate(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) { event.preventDefault(); activate(tabs[next], true); }
  });
});
