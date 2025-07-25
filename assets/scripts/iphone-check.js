const isIPhone = /iPhone/.test(navigator.userAgent) && !window.MSStream;
if (isIPhone) {
    document.getElementById('iphone-message').style.display = 'block';
}