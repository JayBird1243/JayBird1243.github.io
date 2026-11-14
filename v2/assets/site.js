/* Jack Buhr — shared site script.
   Nav + footer, scroll reveal, count-up numbers, image lightbox,
   and the seeded sky renderer (window.Sky).

   Each page sets on <html>:
     data-root="" (top-level page) or "../" (page inside /projects)
     data-page="home" | "projects" | "skills"   (which nav link is current)
*/
(function () {
    'use strict';

    var doc = document.documentElement;
    var root = doc.getAttribute('data-root') || '';
    var page = doc.getAttribute('data-page') || '';
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var CONTACT = {
        email: 'jack.buhr@gmail.com',
        linkedin: 'https://linkedin.com/in/jack-buhr',
        github: 'https://github.com/JayBird1243'
    };

    // ── Nav + footer ───────────────────────────────────────────────
    function link(href, label, key) {
        var cur = key && key === page ? ' aria-current="page"' : '';
        return '<li><a href="' + href + '"' + cur + '>' + label + '</a></li>';
    }

    function buildChrome() {
        var nav = document.createElement('header');
        nav.className = 'site-nav';
        nav.innerHTML =
            '<div class="wrap">' +
            '<a class="brand" href="' + root + 'index.html">Jack Buhr</a>' +
            '<nav aria-label="Main"><ul>' +
            link(root + 'projects.html', 'Projects', 'projects') +
            link(root + 'skills.html', 'Skills', 'skills') +
            link(root + 'index.html#contact', 'Contact', 'contact') +
            '</ul></nav></div>';
        document.body.insertBefore(nav, document.body.firstChild);

        var foot = document.createElement('footer');
        foot.className = 'site-footer';
        foot.innerHTML =
            '<div class="wrap">' +
            '<span>Jack Buhr · Electrical engineering, automation &amp; controls</span>' +
            '<ul>' +
            '<li><a href="mailto:' + CONTACT.email + '">Email</a></li>' +
            '<li><a href="' + CONTACT.linkedin + '" target="_blank" rel="noopener">LinkedIn</a></li>' +
            '<li><a href="' + CONTACT.github + '" target="_blank" rel="noopener">GitHub</a></li>' +
            '</ul></div>';
        document.body.appendChild(foot);
    }

    // ── Scroll reveal ──────────────────────────────────────────────
    // [data-reveal] fades up once. Diagrams (.dg) and figures (.fig) get
    // .is-in too, which triggers .draw / .pop inside them.
    function initReveal() {
        var targets = document.querySelectorAll('[data-reveal], .fig, svg.dg');
        if (!targets.length) return;
        if (reduced || !('IntersectionObserver' in window)) {
            targets.forEach(function (el) { el.classList.add('is-in'); });
            return;
        }
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (!e.isIntersecting) return;
                e.target.classList.add('is-in');
                io.unobserve(e.target);
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
        targets.forEach(function (el) { io.observe(el); });
    }

    // ── Count-up ───────────────────────────────────────────────────
    // <span data-count="200" data-suffix="%">200%</span>
    // Optional: data-prefix, data-decimals. The element's text is the
    // no-JS fallback and the final value.
    function initCount() {
        var els = document.querySelectorAll('[data-count]');
        if (!els.length || reduced || !('IntersectionObserver' in window)) return;
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (!e.isIntersecting) return;
                io.unobserve(e.target);
                run(e.target);
            });
        }, { threshold: 0.6 });
        els.forEach(function (el) { io.observe(el); });

        function run(el) {
            var end = parseFloat(el.getAttribute('data-count'));
            if (!isFinite(end)) return;
            var dec = parseInt(el.getAttribute('data-decimals') || '0', 10);
            var pre = el.getAttribute('data-prefix') || '';
            var suf = el.getAttribute('data-suffix') || '';
            var t0 = performance.now();
            var dur = 900;
            function frame(t) {
                var k = Math.min(1, (t - t0) / dur);
                var eased = 1 - Math.pow(1 - k, 3);
                el.textContent = pre + (end * eased).toFixed(dec) + suf;
                if (k < 1) requestAnimationFrame(frame);
            }
            requestAnimationFrame(frame);
        }
    }

    // ── Lightbox ───────────────────────────────────────────────────
    // <div class="gallery"><button data-full="big.jpg" data-caption="…"><img src="thumb.jpg" alt="…"></button></div>
    // data-full is optional; falls back to the thumbnail src.
    function initLightbox() {
        var buttons = Array.prototype.slice.call(document.querySelectorAll('.gallery button'));
        if (!buttons.length) return;

        var box = document.createElement('div');
        box.className = 'lightbox';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.setAttribute('aria-label', 'Image viewer');
        box.innerHTML =
            '<button class="lb-close" aria-label="Close">×</button>' +
            '<button class="lb-prev" aria-label="Previous image">‹</button>' +
            '<img alt="">' +
            '<button class="lb-next" aria-label="Next image">›</button>' +
            '<div class="lightbox-cap"></div>';
        document.body.appendChild(box);

        var img = box.querySelector('img');
        var cap = box.querySelector('.lightbox-cap');
        var idx = 0;
        var opener = null;

        function show(i) {
            idx = (i + buttons.length) % buttons.length;
            var b = buttons[idx];
            var thumb = b.querySelector('img');
            img.src = b.getAttribute('data-full') || thumb.src;
            img.alt = thumb.alt || '';
            cap.textContent = b.getAttribute('data-caption') || thumb.alt || '';
        }
        function open(i) {
            opener = buttons[i];
            show(i);
            box.classList.add('is-open');
            document.body.style.overflow = 'hidden';
            box.querySelector('.lb-close').focus();
        }
        function close() {
            box.classList.remove('is-open');
            document.body.style.overflow = '';
            if (opener) opener.focus();
        }

        buttons.forEach(function (b, i) {
            b.setAttribute('type', 'button');
            b.addEventListener('click', function () { open(i); });
        });
        box.querySelector('.lb-close').addEventListener('click', close);
        box.querySelector('.lb-prev').addEventListener('click', function () { show(idx - 1); });
        box.querySelector('.lb-next').addEventListener('click', function () { show(idx + 1); });
        box.addEventListener('click', function (e) { if (e.target === box) close(); });
        document.addEventListener('keydown', function (e) {
            if (!box.classList.contains('is-open')) return;
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowLeft') show(idx - 1);
            if (e.key === 'ArrowRight') show(idx + 1);
        });
    }

    // SVG <animate>/<animateMotion> ignores the CSS reduced-motion rule.
    function pauseSvgMotion() {
        if (!reduced) return;
        document.querySelectorAll('svg').forEach(function (s) {
            if (s.pauseAnimations) { try { s.pauseAnimations(); } catch (e) { /* not rendered */ } }
        });
    }

    // ── Sky ────────────────────────────────────────────────────────
    // A 32-digit hex seed fully determines the picture: same seed, same sky.
    //   Sky.randomSeed()                     -> new 32-hex-digit seed
    //   Sky.render(canvas, seed, options)    -> draws, returns stats
    // options: { density: stars per 1000x1000 css px (mean), scale: star size multiplier }
    var Sky = (function () {
        var STAR_COLORS = { 6: '#fcd34d', 7: '#f0705f', 8: '#a78bfa', 9: '#6ea8fe', 10: '#c4b5fd' };

        function randomSeed() {
            var hex = '0123456789abcdef';
            var out = '';
            var buf = null;
            if (window.crypto && window.crypto.getRandomValues) {
                buf = new Uint8Array(32);
                window.crypto.getRandomValues(buf);
            }
            for (var i = 0; i < 32; i++) {
                out += hex[buf ? buf[i] & 15 : Math.floor(Math.random() * 16)];
            }
            return out;
        }

        function isSeed(s) { return typeof s === 'string' && /^[0-9a-f]{32}$/i.test(s); }

        // Mulberry32. `stream` offsets into a different 8-digit slice of the
        // seed so star count, placement and nebula do not disturb each other.
        function prng(seed, stream) {
            var start = (stream * 8) % 32;
            var state = parseInt(seed.substring(start, start + 8), 16) >>> 0;
            return function () {
                var t = (state += 0x6D2B79F5);
                t = Math.imul(t ^ (t >>> 15), t | 1);
                t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
                return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            };
        }

        // Box–Muller: two uniform samples in, one normal sample out.
        function normal(rng, mean, sd) {
            var u = 0, v = 0;
            while (u === 0) u = rng();
            while (v === 0) v = rng();
            return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd + mean;
        }

        function starSize(rng) {
            return Math.max(1, Math.min(10, Math.floor(normal(rng, 2, 1.426))));
        }

        // Nebula colours come straight from pairs of seed digits.
        function nebulaColor(seed, i) {
            var a = parseInt(seed.substr((i * 3) % 30, 2), 16);
            var b = parseInt(seed.substr((i * 5 + 7) % 30, 2), 16);
            var c = parseInt(seed.substr((i * 7 + 13) % 30, 2), 16);
            var hue = [38, 215, 265, 12][(a + b * (i + 1)) % 4] + (c % 24) - 12;
            var sat = 35 + (b % 30);
            var light = 16 + (c % 12);
            var alpha = 0.18 + (a % 40) / 200;
            return 'hsla(' + hue + ',' + sat + '%,' + light + '%,' + alpha.toFixed(3) + ')';
        }

        function render(canvas, seed, options) {
            options = options || {};
            var density = options.density || 620;
            var scale = options.scale || 0.62;
            var rect = canvas.getBoundingClientRect();
            var w = Math.max(1, Math.round(rect.width));
            var h = Math.max(1, Math.round(rect.height));
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            var ctx = canvas.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);

            var nodeRng = prng(seed, 0);
            var countRng = prng(seed, 1);
            var starRng = prng(seed, 2);

            // Nebula: a few large soft blobs.
            var nodes = 3 + Math.floor(nodeRng() * 4);
            for (var n = 0; n < nodes; n++) {
                var nx = nodeRng() * w;
                var ny = nodeRng() * h;
                var nr = Math.max(w, h) * (0.3 + nodeRng() * 0.3);
                var g = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
                g.addColorStop(0, nebulaColor(seed, n));
                g.addColorStop(1, 'hsla(0,0%,0%,0)');
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, w, h);
            }

            // Stars: count is normally distributed around a mean that scales with area.
            var area = (w * h) / 1e6;
            var mean = density * area;
            var sd = density * 0.27 * Math.sqrt(area);
            var count = Math.max(Math.floor(mean * 0.1), Math.floor(normal(countRng, mean, sd)));
            var sizes = new Array(11).fill(0);
            var stars = [];
            for (var i = 0; i < count; i++) {
                var x = starRng() * w;
                var y = starRng() * h;
                var s = starSize(starRng);
                sizes[s]++;
                var star = { x: x, y: y, s: s, r: Math.max(0.5, (s * scale) / 2), c: STAR_COLORS[s] || '#ffffff' };
                stars.push(star);
                ctx.globalAlpha = s <= 1 ? 0.55 : s <= 3 ? 0.8 : 0.95;
                ctx.fillStyle = star.c;
                ctx.beginPath();
                ctx.arc(x, y, star.r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            return { seed: seed, stars: count, nodes: nodes, sizes: sizes, mean: mean, sd: sd, list: stars, width: w, height: h };
        }

        return { randomSeed: randomSeed, isSeed: isSeed, prng: prng, normal: normal, starSize: starSize, render: render };
    })();
    window.Sky = Sky;

    // ── Boot ───────────────────────────────────────────────────────
    function boot() {
        buildChrome();
        initReveal();
        initCount();
        initLightbox();
        pauseSvgMotion();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
