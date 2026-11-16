/* Jack Buhr — shared site script.
   Nav + footer, the site-wide seeded sky (window.Sky), scroll reveal,
   count-up numbers and the image lightbox.

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
        linkedin: 'https://www.linkedin.com/in/jack-buhr-346a20215/',
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
            '<div class="nav-seed">' +
            '<span class="seed-text" title="Sky seed"><span class="seed-lbl">seed</span> ' +
            '<span class="seed-head"></span><span class="seed-tail"></span><span class="seed-dots">…</span></span>' +
            '<button type="button" class="seed-help" aria-label="What is the seed?" aria-expanded="false" aria-controls="seed-pop">?</button>' +
            '<button type="button" class="seed-play" aria-label="Animate the sky" title="Animate the sky"></button>' +
            '<div class="seed-pop" id="seed-pop" role="group" aria-label="About the sky seed">' +
            '<p>The star field behind this site is generated from a 32-digit seed. The same seed always draws the same sky.</p>' +
            '<p class="seed-full"></p>' +
            '<p class="seed-anim">Animate steps to the next seed, over and over. Each step swaps one star, which flares as it arrives. ' +
            'Every few seconds the nebula gets new digits and drifts to its new layout.</p>' +
            '<div class="seed-ctl"><button type="button" class="sky-switch">Animate</button></div>' +
            '<div class="seed-actions">' +
            '<button type="button" class="btn btn--ghost btn--sm seed-new">New sky</button>' +
            '<a href="' + root + 'projects/Starry-Sky.html">How it works →</a>' +
            '</div></div></div>' +
            '<nav aria-label="Main"><ul>' +
            link(root + 'projects.html', 'Projects', 'projects') +
            link(root + 'skills.html', 'Skills', 'skills') +
            link(root + 'index.html#contact', 'Contact', 'contact') +
            '</ul></nav></div>';
        document.body.insertBefore(nav, document.body.firstChild);
        initSeedMenu(nav);

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

    // Seed readout in the menu bar, with a "?" that opens a short explanation.
    // Opens on hover and keyboard focus (CSS) and on click or tap (JS).
    function initSeedMenu(nav) {
        var box = nav.querySelector('.nav-seed');
        var help = box.querySelector('.seed-help');
        var head = box.querySelector('.seed-head');
        var tail = box.querySelector('.seed-tail');
        var full = box.querySelector('.seed-full');

        function show() {
            if (!Sky.site) return;
            var seed = Sky.site.seed;
            head.textContent = seed.slice(0, 8);
            tail.textContent = seed.slice(8);
            full.textContent = seed;
        }
        function setOpen(open) {
            box.classList.toggle('is-open', open);
            help.setAttribute('aria-expanded', open ? 'true' : 'false');
        }

        show();
        document.addEventListener('sky:change', show);
        document.addEventListener('sky:tick', show);

        Sky.bindPlay(box.querySelector('.seed-play'));
        Sky.bindPlay(box.querySelector('.sky-switch'));
        box.querySelector('.seed-ctl').appendChild(Sky.speedSlider());

        help.addEventListener('click', function () { setOpen(!box.classList.contains('is-open')); });
        box.querySelector('.seed-new').addEventListener('click', function () { if (Sky.site) Sky.site.reroll(); });
        document.addEventListener('click', function (e) { if (!box.contains(e.target)) setOpen(false); });
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape' || !box.classList.contains('is-open')) return;
            e.preventDefault();   // tells other Escape handlers this one is taken
            setOpen(false);
            help.focus();
        });
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
        // On average, one star of this size per N skies.
        var RARE_ODDS = { 6: 2, 7: 15, 8: 100, 9: 500, 10: 1000 };
        // The full sky for a seed: star count is normal around this.
        var BASE_COUNT = 600;
        var BASE_SD = 132;

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

        // Ordinary stars are sizes 1 to 5, normally distributed around 2.
        function starSize(rng) {
            return Math.max(1, Math.min(5, Math.floor(normal(rng, 2, 1.426))));
        }

        // Big stars (sizes 6 to 10). Every sky is a base set of about
        // BASE_COUNT stars, and each of those rolls once for a big size.
        // RARE_ODDS says how many skies it takes, on average, to see one star
        // of that size, so the chance per star is (1 / odds) / BASE_COUNT.
        // That is a fixed number: a seed has the same big stars on every
        // screen, and a sky can still get two or three of the same size.
        var CHANCES = (function () {
            var out = [];
            var cum = 0;
            for (var size = 10; size >= 6; size--) {
                var p = (1 / RARE_ODDS[size]) / BASE_COUNT;
                cum += p;
                out.push({ size: size, p: p, upTo: cum });
            }
            return out;   // rarest first; `upTo` is the cumulative threshold
        })();

        // Nebula colours come straight from pairs of seed digits. The star
        // slice (digits 16 to 23) is left out, so stepping that slice changes
        // the stars and nothing else.
        function nebulaColor(seed, i) {
            var d = seed.substring(0, 16) + seed.substring(24);
            var a = parseInt(d.substr((i * 3) % 22, 2), 16);
            var b = parseInt(d.substr((i * 5 + 7) % 22, 2), 16);
            var c = parseInt(d.substr((i * 7 + 13) % 22, 2), 16);
            return {
                h: [38, 215, 265, 12][(a + b * (i + 1)) % 4] + (c % 24) - 12,
                s: 45 + (b % 36),
                l: 17 + (c % 13),
                a: 0.22 + (a % 40) / 170
            };
        }

        // Mulberry32 is a counter pushed through a mixer, and the counter goes
        // up by a fixed step each draw. Every star uses exactly five draws
        // (x, y, big roll, and two for its size). So adding five steps to the
        // star slice gives the seed whose star list starts one star later:
        // the same sky, minus its first star, plus one new one at the end.
        var STEP = 0x6D2B79F5;
        var DRAWS_PER_STAR = 5;
        function hex8(n) { return ('0000000' + (n >>> 0).toString(16)).slice(-8); }
        function shiftStars(seed, by) {
            var state = parseInt(seed.substr(16, 8), 16) >>> 0;
            state = (state + Math.imul(STEP, DRAWS_PER_STAR * by)) >>> 0;
            return seed.substr(0, 16) + hex8(state) + seed.substr(24);
        }

        // New nebula (digits 0 to 7 and 24 to 31), same stars and star count.
        function newNebula(seed) {
            var r = randomSeed();
            return r.substr(0, 8) + seed.substr(8, 16) + r.substr(24);
        }

        // `fade` (0 to 1) scales the star's opacity; the animation uses it.
        function drawStar(ctx, x, y, size, r, color, fade) {
            if (fade === undefined) fade = 1;
            if (size >= 6) {
                // Soft halo, wider for the rarest sizes.
                var hr = r * (size >= 8 ? 7 : 4.5);
                var halo = ctx.createRadialGradient(x, y, 0, x, y, hr);
                halo.addColorStop(0, color);
                halo.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.globalAlpha = (size >= 8 ? 0.4 : 0.28) * fade;
                ctx.fillStyle = halo;
                ctx.beginPath();
                ctx.arc(x, y, hr, 0, Math.PI * 2);
                ctx.fill();
            }
            if (size >= 8) {
                // Four thin spikes.
                var len = r * 6;
                ctx.globalAlpha = 0.55 * fade;
                ctx.strokeStyle = color;
                ctx.lineWidth = Math.max(0.6, r * 0.28);
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(x - len, y); ctx.lineTo(x + len, y);
                ctx.moveTo(x, y - len); ctx.lineTo(x, y + len);
                ctx.stroke();
            }
            ctx.globalAlpha = (size <= 1 ? 0.55 : size <= 3 ? 0.8 : 0.95) * fade;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        // Everything a seed decides for a w x h canvas, without drawing it.
        function model(seed, w, h, options) {
            options = options || {};
            var density = options.density || 620;
            var scale = options.scale || 0.62;

            var nodeRng = prng(seed, 0);
            var countRng = prng(seed, 1);
            var starRng = prng(seed, 2);

            // Nebula: a few large soft blobs.
            var count = 3 + Math.floor(nodeRng() * 4);
            var nebula = [];
            for (var n = 0; n < count; n++) {
                var nx = nodeRng() * w;
                var ny = nodeRng() * h;
                var nr = Math.max(w, h) * (0.3 + nodeRng() * 0.3);
                nebula.push({ x: nx, y: ny, r: nr, color: nebulaColor(seed, n) });
            }

            // The base sky has `base` stars. A canvas draws a share of the
            // ordinary ones that matches its size (`shown`), and every big one.
            // Screens that want more than the base sky get extra ordinary stars.
            var area = (w * h) / 1e6;
            var share = (density * area) / BASE_COUNT;
            var mean = BASE_COUNT * share;
            var sd = BASE_SD * share;
            var base = Math.max(Math.floor(BASE_COUNT * 0.1), Math.floor(normal(countRng, BASE_COUNT, BASE_SD)));
            var shown = Math.max(1, Math.round(base * share));
            var sizes = new Array(11).fill(0);
            var stars = [];
            var big = [];
            var total = Math.max(base, shown);
            for (var i = 0; i < total; i++) {
                var x = starRng() * w;
                var y = starRng() * h;
                var roll = starRng();          // one roll per star for a big size
                var s = starSize(starRng);     // otherwise an ordinary size, 1 to 5
                if (i < base) {
                    for (var c = 0; c < CHANCES.length; c++) {
                        if (roll < CHANCES[c].upTo) { s = CHANCES[c].size; break; }
                    }
                }
                if (s < 6 && i >= shown) continue;   // ordinary star this canvas has no room for
                sizes[s]++;
                var star = { x: x, y: y, s: s, r: Math.max(0.5, (s * scale) / 2), c: STAR_COLORS[s] || '#ffffff' };
                stars.push(star);
                if (s >= 6) big.push({ size: s, x: x, y: y, color: star.c, odds: RARE_ODDS[s] });
            }

            return { seed: seed, stars: stars.length, nodes: count, nebula: nebula, sizes: sizes, mean: mean, sd: sd, base: base,
                     big: big, chances: CHANCES, list: stars, width: w, height: h };
        }

        function render(canvas, seed, options) {
            var rect = canvas.getBoundingClientRect();
            var w = Math.max(1, Math.round(rect.width));
            var h = Math.max(1, Math.round(rect.height));
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            var ctx = canvas.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);

            var m = model(seed, w, h, options);
            m.nebula.forEach(function (node) {
                var k = node.color;
                var g = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.r);
                g.addColorStop(0, 'hsla(' + k.h + ',' + k.s + '%,' + k.l + '%,' + k.a.toFixed(3) + ')');
                g.addColorStop(1, 'hsla(0,0%,0%,0)');
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, w, h);
            });
            m.list.forEach(function (st) { drawStar(ctx, st.x, st.y, st.s, st.r, st.c); });
            ctx.globalAlpha = 1;
            return m;
        }

        return { randomSeed: randomSeed, isSeed: isSeed, prng: prng, normal: normal, starSize: starSize, chances: CHANCES, baseCount: BASE_COUNT,
                 odds: RARE_ODDS, colors: STAR_COLORS, model: model, render: render, drawStar: drawStar,
                 shiftStars: shiftStars, newNebula: newNebula };
    })();
    window.Sky = Sky;

    // ── Animated view of a sky ─────────────────────────────────────
    // Draws one canvas while the seed keeps changing: stars fade out and
    // flare in, nebula blobs glide. The site background uses one, and the
    // Starry Sky demo box attaches another, so both show the same thing.
    //   var view = Sky.animator(getCanvas, getOptions)
    //   view.begin(seed)                  take the canvas over
    //   view.retarget(seed, snap, ms)     aim at a new seed; ms = nebula glide time
    //   view.step(dt)                     advance and repaint
    //   view.hurry(ms)                    finish the nebula's move within ms
    //   view.end(seed)                    exact still picture; returns its stats
    //   view.model                        what the current seed decides for this canvas
    var FADE_MS = 1400;
    var NEB_MAX_PX = 1.6e6;    // the nebula layer is never bigger than this
    Sky.animator = function (getCanvas, getOptions) {
        // While it runs, the nebula is on its own canvas underneath and the
        // main canvas holds only stars. That way a frame only has to touch
        // the few stars that are fading.
        var neb = document.createElement('canvas');
        neb.setAttribute('aria-hidden', 'true');
        neb.style.cssText = 'position:absolute;left:0;top:0;z-index:-1;display:none;opacity:1;max-width:none';
        var nctx = neb.getContext('2d');
        var canvas = null, ctx = null, opts = null;
        var w = 1, h = 1, dpr = 1;
        var live = new Map();      // star key -> { st, a, to, e }
        var blobs = [];            // { from, to, v }: x, y, r, red, green, blue, alpha
        var glide = { t: 1, dur: 1 };
        var nebKey = '';
        var nebPaint = 0;
        var redrawAll = true;
        var view = { model: null, active: false };

        function rgb(k) {
            var hh = (((k.h % 360) + 360) % 360) / 30, sat = k.s / 100, l = k.l / 100;
            var amp = sat * Math.min(l, 1 - l);
            function f(n) { var t = (n + hh) % 12; return 255 * (l - amp * Math.max(-1, Math.min(t - 3, 9 - t, 1))); }
            return [f(0), f(8), f(4)];
        }
        function values(node) {
            var c = rgb(node.color);
            return [node.x, node.y, node.r, c[0], c[1], c[2], node.color.a];
        }
        // How far a star's pixels reach from its centre, flare included.
        function flareR(st) { return Math.max(4, st.r * 5); }
        function extent(st) { return Math.max(st.r * (st.s >= 8 ? 7 : st.s >= 6 ? 4.5 : 1), flareR(st)) + 2; }

        function paintNebula() {
            nctx.setTransform(neb.width / w, 0, 0, neb.height / h, 0, 0);
            nctx.clearRect(0, 0, w, h);
            blobs.forEach(function (b) {
                var v = b.v;
                if (v[6] < 0.002) return;
                var g = nctx.createRadialGradient(v[0], v[1], 0, v[0], v[1], v[2]);
                g.addColorStop(0, 'rgba(' + Math.round(v[3]) + ',' + Math.round(v[4]) + ',' + Math.round(v[5]) + ',' + v[6].toFixed(3) + ')');
                g.addColorStop(1, 'rgba(0,0,0,0)');
                nctx.fillStyle = g;
                nctx.fillRect(0, 0, w, h);
            });
        }

        function star(item) {
            var st = item.st;
            if (item.a <= 0) return;
            if (item.to === 1 && item.a < 1) {
                // A star that is arriving flares, so the swap is easy to spot.
                var fr = flareR(st);
                var g = ctx.createRadialGradient(st.x, st.y, 0, st.x, st.y, fr);
                g.addColorStop(0, st.c);
                g.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.globalAlpha = 0.6 * Math.sin(Math.PI * item.a);
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(st.x, st.y, fr, 0, Math.PI * 2);
                ctx.fill();
            }
            Sky.drawStar(ctx, st.x, st.y, st.s, st.r, st.c, item.a);
        }

        // Redraw the stars. `moving` are the ones whose opacity changed.
        function paintStars(moving) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            if (redrawAll || moving.length > 80) {
                redrawAll = false;
                ctx.clearRect(0, 0, w, h);
                live.forEach(star);
                ctx.globalAlpha = 1;
                return;
            }
            moving.forEach(function (item) {
                // A box around the star, on whole device pixels so the clip
                // leaves no seam.
                var st = item.st, e = item.e;
                var x0 = Math.floor((st.x - e) * dpr) / dpr, y0 = Math.floor((st.y - e) * dpr) / dpr;
                var x1 = Math.ceil((st.x + e) * dpr) / dpr, y1 = Math.ceil((st.y + e) * dpr) / dpr;
                ctx.save();
                ctx.beginPath();
                ctx.rect(x0, y0, x1 - x0, y1 - y0);
                ctx.clip();
                ctx.clearRect(x0, y0, x1 - x0, y1 - y0);
                // Put back every star that reaches into the box.
                live.forEach(function (other) {
                    var o = other.st, oe = other.e;
                    if (o.x + oe < x0 || o.x - oe > x1 || o.y + oe < y0 || o.y - oe > y1) return;
                    star(other);
                });
                ctx.restore();
            });
            ctx.globalAlpha = 1;
        }

        // Returns true if the nebula digits changed.
        view.retarget = function (seed, snap, glideMs) {
            var m = Sky.model(seed, w, h, opts);
            view.model = m;
            var want = new Map();
            m.list.forEach(function (st) { want.set(st.x + '|' + st.y + '|' + st.s, st); });
            if (snap) { live.clear(); redrawAll = true; }
            live.forEach(function (item, key) { item.to = want.has(key) ? 1 : 0; });
            want.forEach(function (st, key) {
                if (!live.has(key)) live.set(key, { st: st, a: snap ? 1 : 0, to: 1, e: extent(st) });
            });

            var key = seed.substr(0, 8) + seed.substr(24);
            if (!snap && key === nebKey) return false;
            nebKey = key;
            if (snap) blobs = [];
            var n = Math.max(blobs.length, m.nebula.length);
            for (var i = 0; i < n; i++) {
                var to = i < m.nebula.length ? values(m.nebula[i]) : null;
                if (!blobs[i]) {
                    var start = to.slice();
                    if (!snap) start[6] = 0;               // new blob fades in where it belongs
                    blobs[i] = { from: start, to: to, v: start.slice() };
                } else {
                    blobs[i].from = blobs[i].v.slice();
                    if (to) blobs[i].to = to;
                    else { blobs[i].to = blobs[i].to.slice(); blobs[i].to[6] = 0; }   // blob the new seed lacks
                }
            }
            glide.t = snap ? 1 : 0;
            glide.dur = glideMs || 1500;
            return !snap;
        };

        view.begin = function (seed) {
            canvas = getCanvas();
            ctx = canvas.getContext('2d');
            opts = getOptions(canvas);
            var stats = Sky.render(canvas, seed, opts);   // sizes the canvas
            w = stats.width;
            h = stats.height;
            dpr = canvas.width / w;
            var q = Math.min(1, Math.sqrt(NEB_MAX_PX / (w * h)));
            neb.width = Math.max(2, Math.round(w * q));
            neb.height = Math.max(2, Math.round(h * q));
            neb.style.width = w + 'px';
            neb.style.height = h + 'px';
            neb.style.display = 'block';
            if (neb.nextSibling !== canvas) canvas.parentNode.insertBefore(neb, canvas);
            canvas.parentNode.style.isolation = 'isolate';   // keeps the layer above the parent's background
            view.active = true;
            view.retarget(seed, true);
            paintNebula();
            paintStars([]);
            return stats;
        };

        view.step = function (dt) {
            var fade = dt / FADE_MS;
            var moving = [];
            var gone = [];
            live.forEach(function (item, key) {
                if (item.a === item.to) return;
                if (item.a < item.to) item.a = Math.min(1, item.a + fade);
                else item.a = Math.max(0, item.a - fade);
                moving.push(item);
                if (item.to === 0 && item.a === 0) gone.push(key);
            });
            paintStars(moving);
            gone.forEach(function (key) { live.delete(key); });

            // The nebula sets off the moment its digits change and slows
            // down as it gets to the new layout.
            if (glide.t < 1) {
                glide.t = Math.min(1, glide.t + dt / glide.dur);
                var e = 1 - Math.pow(1 - glide.t, 2.2);
                blobs.forEach(function (b) {
                    for (var j = 0; j < 7; j++) b.v[j] = b.from[j] + (b.to[j] - b.from[j]) * e;
                });
                if (glide.t === 1) {
                    while (blobs.length && blobs[blobs.length - 1].to[6] === 0) blobs.pop();
                }
                nebPaint += dt;
                if (nebPaint >= (glide.dur < 4000 ? 33 : 66) || glide.t === 1) { nebPaint = 0; paintNebula(); }
            }
        };

        view.hurry = function (ms) {
            if (glide.t >= 1) return;
            blobs.forEach(function (b) { b.from = b.v.slice(); });
            glide.t = 0;
            glide.dur = ms;
        };

        view.end = function (seed) {
            view.active = false;
            neb.style.display = 'none';
            return Sky.render(canvas, seed, opts);
        };

        return view;
    };

    // ── Site-wide sky ──────────────────────────────────────────────
    // One fixed sky behind every page. The seed is kept for the visit
    // (sessionStorage), so the same sky follows you from page to page.
    //   Sky.site.seed            current seed
    //   Sky.site.set(seed)       draw a given seed everywhere
    //   Sky.site.reroll()        new random seed
    //   Sky.site.play() / stop() animate through neighbouring seeds
    // A 'sky:change' event fires on document with the render stats.
    function initSiteSky() {
        var KEY = 'sky-seed';
        var SEEN = 'sky-rare-seen';
        var ANIM = 'sky-anim';
        var SPEED = 'sky-speed';
        var OPTS = { density: 385, scale: 0.55 };
        var wrap = document.createElement('div');
        wrap.className = 'site-sky';
        wrap.setAttribute('aria-hidden', 'true');
        var canvas = document.createElement('canvas');
        wrap.appendChild(canvas);
        document.body.insertBefore(wrap, document.body.firstChild);

        function store(key, value) {
            try {
                if (value === undefined) return window.sessionStorage.getItem(key);
                window.sessionStorage.setItem(key, value);
            } catch (e) { /* storage blocked */ }
            return null;
        }
        function emit(name, detail) {
            var ev;
            try { ev = new CustomEvent(name, { detail: detail }); } catch (e) { ev = null; }
            if (ev) document.dispatchEvent(ev);
        }

        var seed = store(KEY);
        if (!Sky.isSeed(seed)) seed = Sky.randomSeed();

        // speed: seed changes per second while the animation runs
        var MIN_SPEED = 0.25, MAX_SPEED = 20;
        var speed = parseFloat(store(SPEED));
        if (!(speed >= MIN_SPEED && speed <= MAX_SPEED)) speed = 5;

        var site = { seed: seed, stats: null, playing: false, animating: false, speed: speed, minSpeed: MIN_SPEED, maxSpeed: MAX_SPEED };

        function draw(keepNote) {
            site.stats = Sky.render(canvas, site.seed, OPTS);
            wrap.classList.add('is-on');
            store(KEY, site.seed);
            emit('sky:change', site.stats);
            rareNote(keepNote);
        }

        // ── Rare star note ──
        // A size 8+ star gets a small note, once per star per visit, and a
        // ring around the star while the note is up.
        var toast = null, ring = null, ringKey = null, hideTimer = null, showTimer = null;
        var pending = [];   // size 8+ stars not yet noted, rarest first

        // The same star has the same id on every screen size.
        function starId(b) { return (b.x / site.stats.width).toFixed(8) + ':' + b.size; }
        function starKey(b) { return b.x + '|' + b.y + '|' + b.size; }
        function seenIds() {
            try { return JSON.parse(store(SEEN) || '[]') || []; } catch (e) { return []; }
        }

        function clearRare() {
            clearTimeout(hideTimer);
            clearTimeout(showTimer);
            if (toast) { toast.classList.remove('is-on'); }
            if (ring) { ring.parentNode.removeChild(ring); ring = null; ringKey = null; }
        }

        function placeRing(star) {
            if (ring) ring.parentNode.removeChild(ring);
            ring = document.createElement('span');
            ring.className = 'sky-ring';
            ring.style.left = star.x + 'px';
            ring.style.top = star.y + 'px';
            ring.style.color = star.color;
            ringKey = starKey(star);
            wrap.appendChild(ring);
        }

        function ensureToast() {
            if (toast) return;
            toast = document.createElement('div');
            toast.className = 'sky-toast';
            toast.setAttribute('role', 'status');
            toast.innerHTML =
                '<span class="sky-toast-dot"></span>' +
                '<p><strong>You found a rare star.</strong> <span class="sky-toast-what"></span> ' +
                '<a href="' + root + 'projects/Starry-Sky.html#odds">See the odds →</a></p>' +
                '<button type="button" aria-label="Dismiss">×</button>';
            document.body.appendChild(toast);
            toast.querySelector('button').addEventListener('click', clearRare);
            toast.addEventListener('mouseenter', function () { clearTimeout(hideTimer); });
            toast.addEventListener('mouseleave', function () { hideTimer = setTimeout(clearRare, 4000); });
        }

        // The sky is taller than the screen and drifts, so a star only
        // counts as found once it is inside the visible part of the page.
        function checkRare() {
            if (!pending.length) return;
            var top = wrap.getBoundingClientRect().top;
            var found = null;
            for (var i = 0; i < pending.length; i++) {
                var y = top + pending[i].y;
                if (y > 70 && y < window.innerHeight - 20) { found = pending[i]; break; }
            }
            if (!found) return;
            var seen = seenIds().concat(pending.map(starId)).slice(-40);
            store(SEEN, JSON.stringify(seen));
            pending = [];
            ensureToast();
            clearTimeout(hideTimer);
            clearTimeout(showTimer);
            toast.querySelector('.sky-toast-dot').style.background = found.color;
            toast.querySelector('.sky-toast-what').textContent =
                'This sky has a size ' + found.size + ' star. About 1 in ' + found.odds.toLocaleString('en') + ' do.';
            showTimer = setTimeout(function () {
                placeRing(found);
                toast.classList.add('is-on');
                hideTimer = setTimeout(clearRare, 12000);
            }, 900);
        }

        // Queue the size 8+ stars of a sky that have not had a note yet.
        function queueRare(big) {
            if (!big || !big.some(function (b) { return b.size >= 8; })) { pending = []; return; }
            var seen = seenIds();
            pending = (big || [])
                .filter(function (b) { return b.size >= 8 && seen.indexOf(starId(b)) < 0; })
                .sort(function (a, b) { return b.size - a.size; });
            checkRare();
        }

        function rareNote(keep) {
            if (!keep) clearRare();
            queueRare(site.stats.big);
        }

        // ── Animation ──
        // Steps through neighbouring seeds, `site.speed` times a second.
        // Each step moves the star slice on by one star (Sky.shiftStars):
        // one star fades out and a new one flares in. Every NEB_STEPS steps
        // (kept between NEB_MIN_MS and NEB_MAX_MS) the nebula digits change
        // too, and the blobs glide to the new layout. Every step is a real seed. Stopping settles on the exact
        // sky of the seed it stopped at.
        //   Sky.site.play()   Sky.site.stop()   Sky.site.playing
        //   Sky.site.animating  (true until it has settled after a stop)
        //   Sky.site.setSpeed(seedsPerSecond)   Sky.site.nebulaEvery() -> ms
        //   Sky.site.attach({ canvas, options }) -> view on another canvas
        // Events on document: 'sky:tick' (seed changed), 'sky:nebula'
        // (nebula digits changed), 'sky:state' (started or stopped),
        // 'sky:speed'.
        var SETTLE_MS = FADE_MS + 200;
        var NEB_STEPS = 36, NEB_MIN_MS = 2000, NEB_MAX_MS = 20000;
        var NEB_AT = 'sky-neb-at';
        var anim = { on: false, running: false, raf: 0 };
        var views = [Sky.animator(function () { return canvas; }, function () { return OPTS; })];
        var last = 0, stepAcc = 0, nebElapsed = 0, settle = 0;

        site.nebulaEvery = function () {
            return Math.max(NEB_MIN_MS, Math.min(NEB_MAX_MS, (NEB_STEPS / site.speed) * 1000));
        };
        site.setSpeed = function (v) {
            v = Math.max(MIN_SPEED, Math.min(MAX_SPEED, +v || 0));
            if (v === site.speed) return;
            site.speed = v;
            store(SPEED, String(v));
            emit('sky:speed', { speed: v });
        };

        // Another canvas that should show the same animation, such as the
        // demo box on the Starry Sky page.
        //   spec.canvas()         -> the canvas to draw on
        //   spec.options(canvas)  -> render options for it
        site.attach = function (spec) {
            var view = Sky.animator(spec.canvas, spec.options);
            views.push(view);
            if (anim.on) view.begin(site.seed);
            return view;
        };

        // Aim every view at the current seed.
        function retarget(glideMs) {
            var nebulaChanged = false;
            views.forEach(function (view, i) {
                var changed = view.retarget(site.seed, false, glideMs);
                if (i === 0) nebulaChanged = changed;
            });
            var m = views[0].model;
            if (ring && !m.big.some(function (b) { return starKey(b) === ringKey; })) {
                ring.parentNode.removeChild(ring); ring = null; ringKey = null;
            }
            queueRare(m.big);
            store(KEY, site.seed);
            if (nebulaChanged) emit('sky:nebula', { seed: site.seed });
            emit('sky:tick', { seed: site.seed });
        }

        function frame(now) {
            var dt = Math.min(100, Math.max(0, now - last));
            last = now;
            if (anim.running) {
                var changed = false, glideMs = 0;
                stepAcc += (dt * site.speed) / 1000;
                var steps = Math.floor(stepAcc);
                if (steps > 0) { stepAcc -= steps; site.seed = Sky.shiftStars(site.seed, steps); changed = true; }
                nebElapsed += dt;
                var every = site.nebulaEvery();
                if (nebElapsed >= every) {
                    nebElapsed = 0;
                    store(NEB_AT, String(Date.now()));
                    site.seed = Sky.newNebula(site.seed);
                    changed = true;
                    glideMs = every;
                }
                if (changed) retarget(glideMs);
            } else {
                settle -= dt;
                if (settle <= 0) {
                    anim.on = false;
                    site.animating = false;
                    views.forEach(function (view) { view.end(site.seed); });
                    draw(true);               // exact sky for the seed it stopped on
                    return;
                }
            }
            views.forEach(function (view) { view.step(dt); });
            anim.raf = requestAnimationFrame(frame);
        }

        // `resume` is a page picking up an animation that was already on.
        site.play = function (resume) {
            if (anim.running || !site.stats) return;
            anim.running = true;
            site.playing = true;
            store(ANIM, '1');
            if (!anim.on) {
                anim.on = true;
                site.animating = true;
                wrap.classList.add('is-on');
                views.forEach(function (view) { view.begin(site.seed); });
                stepAcc = 0;
                // Pressing play changes the nebula almost at once. A page
                // that is carrying on waits out the rest of the interval.
                var every = site.nebulaEvery();
                var since = Date.now() - (parseInt(store(NEB_AT), 10) || 0);
                nebElapsed = resume ? Math.max(0, Math.min(every - 300, since)) : every - 300;
                last = performance.now();
                anim.raf = requestAnimationFrame(frame);
            }
            emit('sky:state', { playing: true });
        };
        site.stop = function () {
            if (!anim.running) return;
            anim.running = false;
            site.playing = false;
            store(ANIM, '0');
            settle = SETTLE_MS;
            // Finish the nebula's move in the time the stars need.
            views.forEach(function (view) { view.hurry(SETTLE_MS - 300); });
            emit('sky:state', { playing: false });
        };
        site.toggle = function () { if (site.playing) site.stop(); else site.play(); };
        anim.resize = function () {
            views.forEach(function (view, i) {
                var stats = view.begin(site.seed);
                if (i === 0) site.stats = stats;
            });
        };

        site.set = function (next) {
            if (!Sky.isSeed(next)) return false;
            next = next.toLowerCase();
            if (next === site.seed && site.stats) return true;
            site.seed = next;
            if (anim.on) { retarget(1500); return true; }
            clearRare();
            if (reduced) { draw(); return true; }
            wrap.classList.remove('is-on');
            setTimeout(function () { if (!anim.on) draw(); }, 350);
            return true;
        };
        site.reroll = function () { site.set(Sky.randomSeed()); return site.seed; };
        Sky.site = site;

        draw();
        // The animation is on unless the visitor turned it off this visit.
        if (store(ANIM) !== '0') site.play(true);

        // Redraw when the width changes. Height changes are ignored so the
        // mobile URL bar sliding away does not reshuffle the stars.
        var lastW = window.innerWidth;
        var timer = null;
        window.addEventListener('resize', function () {
            if (window.innerWidth === lastW) return;
            lastW = window.innerWidth;
            clearTimeout(timer);
            timer = setTimeout(function () { if (anim.on) anim.resize(); else draw(); }, 200);
        });

        // Slow drift as the page scrolls: the sky is taller than the
        // viewport and slides up by the extra height over the full scroll.
        if (reduced) return;
        var ticking = false;
        function drift() {
            ticking = false;
            var max = document.documentElement.scrollHeight - window.innerHeight;
            var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
            var extra = wrap.offsetHeight - window.innerHeight;
            wrap.style.transform = 'translate3d(0,' + (-p * Math.max(0, extra)).toFixed(1) + 'px,0)';
            checkRare();
        }
        window.addEventListener('scroll', function () {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(drift);
        }, { passive: true });
        drift();
    }

    // ── Sky controls ───────────────────────────────────────────────
    // Small shared pieces, so the menu bar, the Starry Sky page and the
    // animation view all drive the same animation and stay in step.
    //   Sky.speedSlider()            -> <label> with a range input
    //   Sky.bindPlay(button, labels) -> button toggles the animation;
    //                                   labels = [text when off, text when on]
    function initSkyControls() {
        var site = Sky.site;
        var LO = Math.log(site.minSpeed), HI = Math.log(site.maxSpeed);
        function toPos(v) { return Math.round(((Math.log(v) - LO) / (HI - LO)) * 100); }
        function toSpeed(pos) {
            var v = Math.exp(LO + (pos / 100) * (HI - LO));
            return v < 1 ? Math.round(v * 20) / 20 : v < 10 ? Math.round(v * 2) / 2 : Math.round(v);
        }
        function label(v) { return (v < 1 ? v.toFixed(2) : String(v)) + (v === 1 ? ' seed/s' : ' seeds/s'); }
        var n = 0;

        Sky.speedSlider = function () {
            var id = 'sky-speed-' + (++n);
            var el = document.createElement('div');
            el.className = 'sky-speed';
            el.innerHTML =
                '<label for="' + id + '">Speed</label>' +
                '<input id="' + id + '" type="range" min="0" max="100" step="1">' +
                '<output for="' + id + '"></output>';
            var input = el.querySelector('input');
            var out = el.querySelector('output');
            function sync() {
                input.value = toPos(site.speed);
                input.setAttribute('aria-valuetext', label(site.speed));
                out.textContent = label(site.speed);
            }
            input.addEventListener('input', function () { site.setSpeed(toSpeed(+input.value)); sync(); });
            document.addEventListener('sky:speed', sync);
            sync();
            return el;
        };

        Sky.bindPlay = function (btn, labels) {
            function sync() {
                btn.setAttribute('aria-pressed', site.playing ? 'true' : 'false');
                if (labels) btn.textContent = site.playing ? labels[1] : labels[0];
            }
            btn.addEventListener('click', function () { site.toggle(); });
            document.addEventListener('sky:state', sync);
            sync();
        };
    }

    // ── Boot ───────────────────────────────────────────────────────
    function boot() {
        initSiteSky();
        initSkyControls();
        buildChrome();
        initReveal();
        initCount();
        initLightbox();
        pauseSvgMotion();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
