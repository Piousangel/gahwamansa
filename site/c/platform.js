// 초대 페이지 기기 판별. 브라우저(window.GahwaPlatform)와 node 단위 테스트(module.exports) 겸용. 외부 요청 없음.
(function (root) {
  // 'android' | 'ios' | 'desktop'. iPadOS 13+ 는 UA 가 Macintosh 라 터치 점 수로 가른다.
  function detectPlatform(ua, maxTouchPoints) {
    ua = String(ua || '');
    if (/Android/i.test(ua)) return 'android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    if (/Macintosh/i.test(ua) && Number(maxTouchPoints) > 1) return 'ios';
    return 'desktop';
  }
  var api = { detectPlatform: detectPlatform };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GahwaPlatform = api;
})(typeof window !== 'undefined' ? window : this);
