(() => {
  const previews = [...document.querySelectorAll('img[data-animation-src]')];
  if (!previews.length) return;

  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const stillSources = previews.map(image => image.getAttribute('src'));

  function update() {
    previews.forEach((image, index) => {
      image.src = motionPreference.matches ? stillSources[index] : image.dataset.animationSrc;
    });
  }

  motionPreference.addEventListener('change', update);
  update();
})();
