// Compatibility for older cached pages. New pages use GIFs directly.
(function () {
  var previews = document.querySelectorAll('img[data-animation-src]');
  for (var i = 0; i < previews.length; i += 1) {
    var source = previews[i].getAttribute('data-animation-src');
    if (source) previews[i].src = source;
  }
})();
