window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('js', new Date());
var isBot = document.cookie.split('; ').some(function(c){ return c === '__bt=1'; });
gtag('config', 'G-KYGP18G36J', isBot ? { traffic_type: 'bot' } : {});
