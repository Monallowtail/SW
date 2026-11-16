(() => {
  const previews = [...document.querySelectorAll('img[data-animation-src]')];
  const toggle = document.querySelector('[data-animation-toggle]');
  if (!previews.length || !toggle) return;

  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const stillSources = previews.map(image => image.getAttribute('src'));
  let paused = motionPreference.matches;

  function update() {
    previews.forEach((image, index) => {
      image.src = paused ? stillSources[index] : image.dataset.animationSrc;
    });
    toggle.textContent = paused ? '動かす' : '動きを止める';
  }

  toggle.addEventListener('click', () => {
    paused = !paused;
    update();
  });
  motionPreference.addEventListener('change', event => {
    paused = event.matches;
    update();
  });
  update();
  toggle.hidden = false;
})();
