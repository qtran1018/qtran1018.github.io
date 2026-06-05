/* Light/dark theme: defaults to the user's system setting, remembers an
   explicit choice in localStorage, and avoids a flash by setting the theme
   on <html> as soon as this (head) script runs. */
(function () {
    var KEY = 'theme';
    var root = document.documentElement;
    var mql = window.matchMedia('(prefers-color-scheme: light)');

    function systemTheme() { return mql.matches ? 'light' : 'dark'; }
    function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
    function activeTheme() { return stored() || systemTheme(); }

    function paintButton(theme) {
        var btn = document.getElementById('theme-toggle');
        if (!btn) return;
        var next = theme === 'light' ? 'dark' : 'light';
        // Show the icon for the mode you'll switch TO.
        btn.textContent = theme === 'light' ? '🌙' : '☀️';
        var label = 'Switch to ' + next + ' mode';
        btn.setAttribute('aria-label', label);
        btn.setAttribute('title', label);
    }

    function apply(theme) {
        root.setAttribute('data-theme', theme);
        paintButton(theme);
    }

    // Run immediately (head script) so the page paints in the right theme.
    apply(activeTheme());

    function wire() {
        paintButton(root.getAttribute('data-theme') || activeTheme());
        var btn = document.getElementById('theme-toggle');
        if (btn && !btn.dataset.wired) {
            btn.dataset.wired = '1';
            btn.addEventListener('click', function () {
                var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
                try { localStorage.setItem(KEY, next); } catch (e) {}
                apply(next);
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wire);
    } else {
        wire();
    }

    // Follow the system setting only while the user hasn't chosen explicitly.
    var onChange = function () { if (!stored()) apply(systemTheme()); };
    if (mql.addEventListener) { mql.addEventListener('change', onChange); }
    else if (mql.addListener) { mql.addListener(onChange); }
})();
