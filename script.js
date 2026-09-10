document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const backgroundContainer = document.getElementById('background-container');
    const nodesContainer = document.getElementById('nodes-container');
    const starsContainer = document.getElementById('stars-container');
    const contentWrapper = document.getElementById('content-wrapper');
    const addContentBtn = document.getElementById('add-content-btn');
    const additionalContentContainer = document.getElementById('additional-content-container');
    const seedDisplay = document.getElementById('seed-display');

    // Footer Elements
    const footerInner = document.querySelector('.footer-inner');
    const footerSeedEl = document.getElementById('footer-seed-val');
    const footerStarsEl = document.getElementById('footer-stars-count');
    const footerNodesEl = document.getElementById('footer-nodes-count');
    const footerSizeBarsEl = document.getElementById('footer-size-bars');
    const rerollBtn = document.getElementById('reroll-btn');

    // --- Generation constants ---
    const STAR_MEAN_PER_SCREEN = 750;
    const STAR_SD_PER_SCREEN = 500;
    const STAR_FLOOR_PER_SCREEN = 50;
    const SIZE_MEAN = 2;
    const SIZE_SD = 1.426;
    const NODE_MIN = 2;
    const NODE_MAX_PER_SCREEN = 10;
    const RARE_SIZE = 8;
    // How much geometry drift to ignore before regenerating. Mobile browsers
    // shrink and grow the viewport as the URL bar slides in and out during a
    // scroll; acting on that was what rebuilt the sky under your thumb.
    const GEOMETRY_TOLERANCE = 110;
    const SIZE_COLORS = {
        1: '#ffffff', 2: '#ffffff', 3: '#ffffff', 4: '#ffffff', 5: '#ffffff',
        6: '#FCD34D', 7: '#EF4444', 8: '#8B5CF6', 9: '#3B82F6', 10: '#7C3AED'
    };
    const SIZE_NAMES = {
        1: 'dust', 2: 'faint', 3: 'common', 4: 'bright', 5: 'notable',
        6: 'amber giant', 7: 'red giant', 8: 'violet', 9: 'blue supergiant',
        10: 'deep violet'
    };

    // --- State ---
    let currentSeed = null;
    let prng = null;
    // Snapshot of the sky currently on screen. The overview reads this.
    let skyStats = null;
    // Geometry the current sky was generated against.
    let lastGeometry = null;
    // Seed we have already fired the rare-star popup for.
    let rareAnnouncedFor = null;
    let viewportProbe = null;
    let modalEl = null;
    let activeTab = 'overview';

    // ── Random number generation ───────────────────────────────────

    /**
     * Generates a 32-character hexadecimal seed using Math.random().
     */
    function generateLocalSeed() {
        let seed = '';
        const hexChars = '0123456789abcdef';
        for (let i = 0; i < 32; i++) {
            seed += hexChars[Math.floor(Math.random() * 16)];
        }
        return seed;
    }

    /**
     * mulberry32 over a raw 32-bit integer state.
     */
    function mulberry32Int(state) {
        let seed = state >>> 0;
        return function () {
            let t = (seed += 0x6D2B79F5);
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /**
     * mulberry32 keyed off the first 8 hex characters of a seed.
     */
    function mulberry32(hexSeed) {
        return mulberry32Int(parseInt(hexSeed.substring(0, 8), 16));
    }

    /**
     * Independent generator streams off one seed. The whole seed is folded
     * down with FNV-1a and then mixed with a stream index, so the node
     * generator and the star generator never share a cursor. Previously,
     * drawing one extra gradient node shifted every star on the page.
     */
    function streamPrng(hexSeed, stream) {
        let h = 0x811c9dc5;
        for (let i = 0; i < hexSeed.length; i++) {
            h = Math.imul(h ^ hexSeed.charCodeAt(i), 0x01000193) >>> 0;
        }
        h = (h ^ Math.imul(stream + 1, 0x9E3779B9)) >>> 0;
        h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B) >>> 0;
        h = (h ^ (h >>> 13)) >>> 0;
        return mulberry32Int(h);
    }

    /**
     * Box-Muller transform: one normal sample out of two uniforms.
     */
    function normalRandom(rng, mean, stdDev) {
        let u = 0, v = 0;
        while (u === 0) u = rng();
        while (v === 0) v = rng();
        const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        return z * stdDev + mean;
    }

    // ── Distribution maths (read by the overview) ──────────────────

    /**
     * Chebyshev approximation of erfc, roughly 1e-7 relative accuracy. It
     * holds up far enough into the tail to price a 10px star honestly, which
     * a plain erf series expansion does not.
     */
    function erfc(x) {
        const cof = [
            -1.3026537197817094, 6.4196979235649026e-1, 1.9476473204185836e-2,
            -9.561514786808631e-3, -9.46595344482036e-4, 3.66839497852761e-4,
            4.2523324806907e-5, -2.0278578112534e-5, -1.624290004647e-6,
            1.303655835580e-6, 1.5626441722e-8, -8.5238095915e-8,
            6.529054439e-9, 5.059343495e-9, -9.91364156e-10, -2.27365122e-10,
            9.6467911e-11, 2.394038e-12, -6.886027e-12, 8.94487e-13,
            3.13092e-13, -1.12708e-13, 3.81e-16, 7.106e-15
        ];
        const z = Math.abs(x);
        const t = 2 / (2 + z);
        const ty = 4 * t - 2;
        let d = 0, dd = 0;
        for (let j = cof.length - 1; j > 0; j--) {
            const tmp = d;
            d = ty * d - dd + cof[j];
            dd = tmp;
        }
        const ans = t * Math.exp(-z * z + 0.5 * (cof[0] + ty * d) - dd);
        return x >= 0 ? ans : 2 - ans;
    }

    /** P(Z <= z) */
    function normalCdf(z) {
        return 0.5 * erfc(-z / Math.SQRT2);
    }

    /** P(Z >= z). Kept separate so the tail never loses precision to 1 - cdf. */
    function normalSf(z) {
        return 0.5 * erfc(z / Math.SQRT2);
    }

    /**
     * Probability a single star lands on a given rendered size. Size is
     * clamp(floor(N(2, 1.426)), 1, 10), so size 1 swallows the entire lower
     * half of the bell and size 10 swallows the entire upper tail.
     */
    function sizeProbability(size) {
        const atLeast = k => normalSf((k - SIZE_MEAN) / SIZE_SD);
        if (size <= 1) return 1 - atLeast(2);
        if (size >= 10) return atLeast(10);
        return atLeast(size) - atLeast(size + 1);
    }

    /**
     * P(at least k successes in n trials), summed from the low tail so a
     * very small p keeps its precision.
     */
    function binomialAtLeast(n, p, k) {
        if (k <= 0) return 1;
        if (p <= 0) return 0;
        if (p >= 1) return 1;
        const logQ = Math.log1p(-p);
        const logRatio = Math.log(p) - logQ;
        let logTerm = n * logQ;
        let below = 0;
        for (let i = 0; i < k; i++) {
            below += Math.exp(logTerm);
            logTerm += Math.log((n - i) / (i + 1)) + logRatio;
        }
        return Math.max(0, Math.min(1, 1 - below));
    }

    // ── Formatting ─────────────────────────────────────────────────

    function formatOdds(p) {
        if (p <= 0) return 'never';
        if (p >= 1) return 'every time';
        const odds = 1 / p;
        if (odds < 10) return '1 in ' + odds.toFixed(1);
        if (odds < 1e6) return '1 in ' + Math.round(odds).toLocaleString();
        const exp = Math.floor(Math.log10(odds));
        const mant = odds / Math.pow(10, exp);
        return '1 in ' + mant.toFixed(1) + '×10<sup>' + exp + '</sup>';
    }

    function formatPercent(p) {
        if (p >= 0.01) return (p * 100).toFixed(2) + '%';
        if (p >= 1e-4) return (p * 100).toFixed(4) + '%';
        return (p * 100).toExponential(2) + '%';
    }

    /**
     * Percentiles at the extremes round to 0 or 100 and stop saying anything,
     * so keep a decimal until the number is informative again.
     */
    function formatPercentile(p) {
        const pct = p * 100;
        if (pct >= 99.95) return '>99.9';
        if (pct <= 0.05) return '<0.1';
        if (pct >= 99 || pct <= 1) return pct.toFixed(1);
        return Math.round(pct).toString();
    }

    function percentileLabel(p) {
        const pct = p * 100;
        if (pct >= 99) return 'extraordinarily dense';
        if (pct >= 90) return 'crowded';
        if (pct >= 70) return 'busy';
        if (pct >= 30) return 'ordinary';
        if (pct >= 10) return 'sparse';
        if (pct >= 1) return 'thin';
        return 'nearly empty';
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    // ── Geometry ───────────────────────────────────────────────────

    /**
     * Viewport height that does not move when the mobile URL bar does.
     * 100lvh is the large-viewport height and stays put across a scroll;
     * window.innerHeight does not, and reading it mid-scroll was the root of
     * the sky regenerating itself halfway down the page.
     */
    function stableViewportHeight() {
        if (!viewportProbe) {
            viewportProbe = document.createElement('div');
            viewportProbe.setAttribute('aria-hidden', 'true');
            viewportProbe.style.cssText = 'position:fixed;top:0;left:0;width:0;' +
                'height:100lvh;visibility:hidden;pointer-events:none;z-index:-100;';
            document.body.appendChild(viewportProbe);
        }
        const probed = viewportProbe.getBoundingClientRect().height;
        if (probed > 0) return probed;
        return window.innerHeight || document.documentElement.clientHeight || 1;
    }

    /**
     * Page height measured with the background collapsed. The background is
     * absolutely positioned, so it counts toward scrollHeight and would
     * otherwise pin the measurement to whatever we last set it to.
     */
    function measurePageHeight() {
        const saved = [];
        [backgroundContainer, nodesContainer, starsContainer].forEach(el => {
            if (!el) return;
            saved.push([el, el.style.height]);
            el.style.height = '0px';
        });
        const height = Math.max(
            document.documentElement.scrollHeight,
            document.body ? document.body.scrollHeight : 0
        );
        saved.forEach(pair => { pair[0].style.height = pair[1]; });
        return height;
    }

    function currentGeometry() {
        return {
            width: window.innerWidth || document.documentElement.clientWidth || 1,
            viewport: Math.round(stableViewportHeight()),
            page: measurePageHeight()
        };
    }

    function geometryChanged(geo) {
        if (!lastGeometry) return true;
        if (Math.abs(geo.width - lastGeometry.width) > 1) return true;
        if (Math.abs(geo.viewport - lastGeometry.viewport) > GEOMETRY_TOLERANCE) return true;
        if (Math.abs(geo.page - lastGeometry.page) > GEOMETRY_TOLERANCE) return true;
        return false;
    }

    // ── Sky generation ─────────────────────────────────────────────

    function starCountParams(pageHeightRatio) {
        return {
            mean: STAR_MEAN_PER_SCREEN * pageHeightRatio,
            sd: STAR_SD_PER_SCREEN * Math.sqrt(pageHeightRatio),
            floor: STAR_FLOOR_PER_SCREEN * pageHeightRatio
        };
    }

    function getStarCount(rng, pageHeightRatio) {
        const params = starCountParams(pageHeightRatio);
        const count = normalRandom(rng, params.mean, params.sd);
        // Floor the whole expression: the lower bound is a float, and it
        // reaches the footer readout verbatim when it wins.
        return Math.floor(Math.max(params.floor, Math.floor(count)));
    }

    function getStarSize(rng) {
        const size = normalRandom(rng, SIZE_MEAN, SIZE_SD);
        return Math.max(1, Math.min(10, Math.floor(size)));
    }

    /**
     * Dark, muted palette read straight out of the hex digits of the seed
     * rather than off the PRNG, so colour is a pure function of the text.
     */
    function generateColorPalette(count, hexSeed) {
        const colors = [];
        const colorHints = {
            red: { r: 0.15, g: 0.05, b: 0.05 },
            orange: { r: 0.12, g: 0.08, b: 0.03 },
            yellow: { r: 0.10, g: 0.10, b: 0.02 },
            purple: { r: 0.08, g: 0.05, b: 0.12 }
        };
        const hintNames = Object.keys(colorHints);

        for (let i = 0; i < count; i++) {
            const seedSegment1 = (i * 3) % 28;
            const seedSegment2 = (i * 5 + 7) % 28;
            const seedSegment3 = (i * 7 + 13) % 28;

            const val1 = parseInt(hexSeed.substring(seedSegment1, seedSegment1 + 2), 16);
            const val2 = parseInt(hexSeed.substring(seedSegment2, seedSegment2 + 2), 16);
            const val3 = parseInt(hexSeed.substring(seedSegment3, seedSegment3 + 2), 16);

            const baseGray = Math.max(0.05, Math.min(0.45,
                (((val1 * 0.299) + (val2 * 0.587) + (val3 * 0.114)) / 255 * 0.3) +
                (Math.sin(val1 * 0.0245) * Math.cos(val2 * 0.0314) * 0.12) +
                (((val1 ^ val2 ^ val3) % 64) / 255.0 * 0.12) + 0.05
            ));

            const hintSelector = (val1 * val2 + val3 * (i + 1)) % hintNames.length;
            const selectedHint = colorHints[hintNames[hintSelector]];
            const hintStrength = ((val3 + (val1 % val2 || 1)) % 64) / 255.0 * 0.15 + 0.03;

            const r = Math.min(1.0, baseGray + (selectedHint.r * hintStrength));
            const g = Math.min(1.0, baseGray + (selectedHint.g * hintStrength));
            const b = Math.min(1.0, baseGray + (selectedHint.b * hintStrength));

            const hexR = Math.round(r * 255).toString(16).padStart(2, '0');
            const hexG = Math.round(g * 255).toString(16).padStart(2, '0');
            const hexB = Math.round(b * 255).toString(16).padStart(2, '0');

            colors.push('#' + hexR + hexG + hexB);
        }
        return colors;
    }

    /**
     * Renders the whole background from the seed and the measured geometry.
     */
    function renderVisuals(geometry) {
        if (!nodesContainer || !starsContainer) return;

        const geo = geometry || currentGeometry();
        lastGeometry = geo;

        const viewportHeight = geo.viewport > 0 ? geo.viewport : 1;
        const totalPageHeight = Math.max(geo.page, viewportHeight);
        const rawRatio = totalPageHeight / viewportHeight;
        const pageHeightRatio = Number.isFinite(rawRatio) ? Math.max(1, rawRatio) : 1;

        // Three independent streams, so node count, star count and star
        // placement cannot perturb one another.
        const nodePrng = streamPrng(currentSeed, 0);
        const countPrng = streamPrng(currentSeed, 1);
        const starPrng = streamPrng(currentSeed, 2);

        const starSizeCounts = new Array(11).fill(0);

        // --- Clear existing visuals ---
        nodesContainer.style.backgroundImage = '';
        starsContainer.classList.remove('stars-in');
        starsContainer.innerHTML = '';

        // --- Gradients (nodes) ---
        const maxNodes = Math.max(NODE_MIN, Math.floor(NODE_MAX_PER_SCREEN * pageHeightRatio));
        const numColors = Math.floor(nodePrng() * (maxNodes - NODE_MIN + 1)) + NODE_MIN;
        const colors = generateColorPalette(numColors, currentSeed);

        const gradients = [];
        for (let i = 0; i < numColors; i++) {
            const x = nodePrng() * 100;
            const y = nodePrng() * 100;
            gradients.push('radial-gradient(circle at ' + x + '% ' + y + '%, ' + colors[i] + ', transparent 50%)');
        }

        // --- Stars ---
        const countParams = starCountParams(pageHeightRatio);
        const numStars = getStarCount(countPrng, pageHeightRatio);
        const stars = [];

        // Cap the stagger so a tall page does not spend half a minute fading in.
        const perStarDelay = 2;
        const maxStagger = 2200;

        for (let i = 0; i < numStars; i++) {
            const star = document.createElement('div');
            star.className = 'star';

            star.style.left = (starPrng() * 100) + '%';
            star.style.top = (starPrng() * 100) + '%';

            const size = getStarSize(starPrng);
            if (size >= 1 && size <= 10) starSizeCounts[size]++;

            star.style.width = size + 'px';
            star.style.height = size + 'px';
            star.style.transitionDelay = Math.min(i * perStarDelay, maxStagger) + 'ms';
            if (size >= 6) star.classList.add('star-' + size);

            stars.push(star);
        }

        skyStats = {
            seed: currentSeed,
            stars: numStars,
            nodes: numColors,
            sizeCounts: starSizeCounts,
            starMean: countParams.mean,
            starSd: countParams.sd,
            starFloor: countParams.floor,
            nodeMin: NODE_MIN,
            nodeMax: maxNodes,
            pageHeightRatio: pageHeightRatio,
            pageHeight: totalPageHeight,
            viewportHeight: viewportHeight
        };

        updateFooterStats(skyStats);

        // --- Paint ---
        window.requestAnimationFrame(() => {
            nodesContainer.style.height = totalPageHeight + 'px';
            starsContainer.style.height = totalPageHeight + 'px';
            if (backgroundContainer) backgroundContainer.style.height = totalPageHeight + 'px';

            nodesContainer.style.backgroundImage = gradients.join(', ');
            nodesContainer.style.opacity = '1';

            const fragment = document.createDocumentFragment();
            stars.forEach(star => fragment.appendChild(star));
            starsContainer.appendChild(fragment);

            // One class flip instead of one timer per star. At a few thousand
            // stars the old per-star setTimeout stalled scrolling on a phone.
            window.requestAnimationFrame(() => {
                starsContainer.classList.add('stars-in');
            });
        });

        if (modalEl && !modalEl.hidden) renderPanes();
        maybeAnnounceRare(skyStats);
    }

    /**
     * Regenerates only when the page has actually changed shape. Mobile
     * browsers fire resize on every URL bar transition, and acting on those
     * is what made the sky reshuffle under your thumb while scrolling.
     */
    function maybeRender() {
        // Opening the modal locks body scrolling, which removes the scrollbar
        // and reflows the page behind it. Nothing regenerates while it is up,
        // so the numbers you are reading cannot move under you.
        if (modalEl && !modalEl.hidden) return;
        const geo = currentGeometry();
        if (!geometryChanged(geo)) {
            // Keep the container tall enough for the content even when we skip
            // a regenerate, so a small growth does not leave a bare strip.
            const height = Math.max(geo.page, geo.viewport);
            if (backgroundContainer) backgroundContainer.style.height = height + 'px';
            if (nodesContainer) nodesContainer.style.height = height + 'px';
            if (starsContainer) starsContainer.style.height = height + 'px';
            return;
        }
        renderVisuals(geo);
    }

    // ── Footer readout ─────────────────────────────────────────────

    function updateFooterStats(stats) {
        if (footerStarsEl) footerStarsEl.textContent = stats.stars.toLocaleString();
        if (footerNodesEl) footerNodesEl.textContent = stats.nodes;
        // The full seed goes in the element; desktop CSS truncates it visually
        // while the phone layout shows all 32 characters.
        if (footerSeedEl) footerSeedEl.textContent = stats.seed;

        if (footerSizeBarsEl) {
            footerSizeBarsEl.innerHTML = '';
            const maxCount = Math.max(1, ...stats.sizeCounts.slice(1));
            for (let s = 1; s <= 10; s++) {
                const count = stats.sizeCounts[s];
                const bar = document.createElement('div');
                bar.className = 'footer-bar';
                bar.dataset.size = s;
                const logH = count > 0
                    ? Math.round((Math.log(count + 1) / Math.log(maxCount + 1)) * 24)
                    : 2;
                bar.style.height = Math.max(2, logH) + 'px';
                bar.title = s + 'px stars: ' + count;
                if (s >= RARE_SIZE && count > 0) bar.classList.add('is-rare');
                footerSizeBarsEl.appendChild(bar);
            }
        }
    }

    // ── Charts ─────────────────────────────────────────────────────

    /**
     * Bell curve with the area up to the roll shaded and the roll marked.
     * Returns an SVG string.
     */
    function bellCurveSvg(z, valueLabel) {
        const W = 340, H = 120;
        const left = 10, right = W - 10;
        const base = H - 26;
        const top = 12;
        const zMin = -3.6, zMax = 3.6;
        const clamped = Math.max(zMin, Math.min(zMax, z));
        const peak = 1 / Math.sqrt(2 * Math.PI);
        const xOf = t => left + ((t - zMin) / (zMax - zMin)) * (right - left);
        const density = t => Math.exp(-0.5 * t * t) / Math.sqrt(2 * Math.PI);
        const yOf = t => base - (density(t) / peak) * (base - top);

        const steps = 180;
        let curve = '';
        for (let i = 0; i <= steps; i++) {
            const t = zMin + (i / steps) * (zMax - zMin);
            curve += (i === 0 ? 'M' : 'L') + xOf(t).toFixed(2) + ' ' + yOf(t).toFixed(2);
        }

        let area = 'M' + xOf(zMin).toFixed(2) + ' ' + base;
        const fillSteps = 120;
        for (let i = 0; i <= fillSteps; i++) {
            const t = zMin + (i / fillSteps) * (clamped - zMin);
            area += 'L' + xOf(t).toFixed(2) + ' ' + yOf(t).toFixed(2);
        }
        area += 'L' + xOf(clamped).toFixed(2) + ' ' + base + 'Z';

        let ticks = '';
        for (let s = -3; s <= 3; s++) {
            const x = xOf(s).toFixed(2);
            ticks += '<line x1="' + x + '" y1="' + base + '" x2="' + x + '" y2="' + (base + 4) + '" class="sky-axis"/>';
            ticks += '<text x="' + x + '" y="' + (base + 15) + '" class="sky-axis-text" text-anchor="middle">' +
                (s === 0 ? 'μ' : (s > 0 ? '+' : '') + s + 'σ') + '</text>';
        }

        const markX = xOf(clamped).toFixed(2);
        const markY = yOf(clamped).toFixed(2);
        const anchor = clamped > 1.9 ? 'end' : (clamped < -1.9 ? 'start' : 'middle');

        return '<svg class="sky-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
            'aria-label="Roll at ' + z.toFixed(2) + ' standard deviations from the mean">' +
            '<defs><linearGradient id="skyFill" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="#a855f7" stop-opacity="0.55"/>' +
            '<stop offset="100%" stop-color="#a855f7" stop-opacity="0.06"/>' +
            '</linearGradient></defs>' +
            '<line x1="' + left + '" y1="' + base + '" x2="' + right + '" y2="' + base + '" class="sky-axis"/>' +
            ticks +
            '<path d="' + area + '" fill="url(#skyFill)"/>' +
            '<path d="' + curve + '" class="sky-curve"/>' +
            '<line x1="' + markX + '" y1="' + top + '" x2="' + markX + '" y2="' + base + '" class="sky-marker"/>' +
            '<circle cx="' + markX + '" cy="' + markY + '" r="4" class="sky-marker-dot"/>' +
            '<text x="' + markX + '" y="' + (top - 2) + '" class="sky-marker-text" text-anchor="' + anchor + '">' +
            escapeHtml(valueLabel) + '</text>' +
            '</svg>';
    }

    /**
     * Node count is drawn from a flat range, not a bell, so it gets a flat
     * chart. Same idea: shade what was beaten, mark where the die landed.
     */
    function uniformStripSvg(value, min, max) {
        const W = 340, H = 120;
        const left = 10, right = W - 10;
        const base = H - 26;
        const top = 34;
        const span = Math.max(1, max - min);
        const xOf = v => left + ((v - min) / span) * (right - left);
        const markX = xOf(Math.max(min, Math.min(max, value)));

        let ticks = '';
        const tickValues = [min, Math.round((min + max) / 2), max];
        tickValues.forEach(v => {
            const x = xOf(v).toFixed(2);
            ticks += '<line x1="' + x + '" y1="' + base + '" x2="' + x + '" y2="' + (base + 4) + '" class="sky-axis"/>';
            ticks += '<text x="' + x + '" y="' + (base + 15) + '" class="sky-axis-text" text-anchor="middle">' + v + '</text>';
        });

        const anchor = markX > right - 40 ? 'end' : (markX < left + 40 ? 'start' : 'middle');

        return '<svg class="sky-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
            'aria-label="Node roll of ' + value + ' between ' + min + ' and ' + max + '">' +
            '<rect x="' + left + '" y="' + top + '" width="' + (right - left) + '" height="' + (base - top) +
            '" class="sky-uniform-bg"/>' +
            '<rect x="' + left + '" y="' + top + '" width="' + (markX - left).toFixed(2) + '" height="' + (base - top) +
            '" class="sky-uniform-fill"/>' +
            '<line x1="' + left + '" y1="' + base + '" x2="' + right + '" y2="' + base + '" class="sky-axis"/>' +
            ticks +
            '<line x1="' + markX.toFixed(2) + '" y1="' + (top - 8) + '" x2="' + markX.toFixed(2) + '" y2="' + base + '" class="sky-marker"/>' +
            '<circle cx="' + markX.toFixed(2) + '" cy="' + ((top + base) / 2).toFixed(2) + '" r="4" class="sky-marker-dot"/>' +
            '<text x="' + markX.toFixed(2) + '" y="' + (top - 12) + '" class="sky-marker-text" text-anchor="' + anchor + '">' +
            value + ' nodes</text>' +
            '</svg>';
    }

    // ── Overview pane ──────────────────────────────────────────────

    function seedGridHtml(seed) {
        let out = '';
        for (let i = 0; i < seed.length; i += 8) {
            out += '<span class="sky-seed-group">' + escapeHtml(seed.substring(i, i + 8)) + '</span>';
        }
        return out;
    }

    function sizeTableHtml(stats) {
        let rows = '';
        const total = Math.max(1, stats.stars);
        const maxShare = Math.max.apply(null, [1e-9].concat(
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => Math.max(stats.sizeCounts[s] / total, sizeProbability(s)))
        ));

        for (let s = 1; s <= 10; s++) {
            const count = stats.sizeCounts[s];
            const observed = count / total;
            const expected = sizeProbability(s);
            const rare = s >= RARE_SIZE && count > 0;
            const obsPct = (observed / maxShare) * 100;
            const expPct = (expected / maxShare) * 100;

            rows += '<tr class="' + (rare ? 'is-rare' : '') + (count === 0 ? ' is-empty' : '') + '">' +
                '<th scope="row"><span class="sky-dot" style="background:' + SIZE_COLORS[s] +
                ';width:' + Math.max(4, s) + 'px;height:' + Math.max(4, s) + 'px"></span>' +
                '<span class="sky-size-num">' + s + 'px</span>' +
                '<span class="sky-size-name">' + SIZE_NAMES[s] + '</span></th>' +
                '<td class="sky-num">' + count.toLocaleString() + '</td>' +
                '<td class="sky-bar-cell"><span class="sky-bar-track">' +
                '<span class="sky-bar-fill" style="width:' + Math.min(100, obsPct).toFixed(2) + '%;background:' + SIZE_COLORS[s] + '"></span>' +
                '<span class="sky-bar-expected" style="left:' + Math.min(100, expPct).toFixed(2) + '%" title="expected share"></span>' +
                '</span></td>' +
                '<td class="sky-num sky-dim">' + (expected * total).toFixed(expected * total < 10 ? 2 : 0) + '</td>' +
                '<td class="sky-num sky-dim">' + formatOdds(expected) + '</td>' +
                '</tr>';
        }

        return '<table class="sky-table">' +
            '<thead><tr><th scope="col">size</th><th scope="col">rolled</th>' +
            '<th scope="col">share vs expected</th><th scope="col">expected</th>' +
            '<th scope="col">per star</th></tr></thead><tbody>' + rows + '</tbody></table>';
    }

    function rareFindsHtml(stats) {
        const found = [];
        for (let s = RARE_SIZE; s <= 10; s++) {
            if (stats.sizeCounts[s] > 0) found.push(s);
        }
        if (!found.length) {
            const p = binomialAtLeast(stats.stars, sizeProbabilityAtLeast(RARE_SIZE), 1);
            return '<div class="sky-rare sky-rare--none">' +
                '<h4>No rare stars in this sky</h4>' +
                '<p>Nothing at ' + RARE_SIZE + 'px or above. A sky of ' + stats.stars.toLocaleString() +
                ' stars turns one up about ' + formatPercent(p) + ' of the time, so this is the normal outcome. ' +
                'Keep rolling.</p></div>';
        }

        const rareCount = found.reduce((sum, s) => sum + stats.sizeCounts[s], 0);
        const pAtLeast = binomialAtLeast(stats.stars, sizeProbabilityAtLeast(RARE_SIZE), rareCount);
        const chips = found.map(s =>
            '<span class="sky-rare-chip" style="--chip:' + SIZE_COLORS[s] + '">' +
            '<span class="sky-dot" style="background:' + SIZE_COLORS[s] + ';width:' + s + 'px;height:' + s + 'px"></span>' +
            stats.sizeCounts[s] + ' × ' + s + 'px <em>' + SIZE_NAMES[s] + '</em></span>'
        ).join('');

        return '<div class="sky-rare sky-rare--hit">' +
            '<h4><span class="sky-rare-badge">rare</span>' + rareCount +
            (rareCount === 1 ? ' star at ' : ' stars at ') + RARE_SIZE + 'px or above</h4>' +
            '<div class="sky-rare-chips">' + chips + '</div>' +
            '<p>A sky this size lands ' + rareCount + ' or more of them about ' + formatPercent(pAtLeast) +
            ' of the time (' + formatOdds(pAtLeast) + ' skies). Go find ' +
            (rareCount === 1 ? 'it' : 'them') + '.</p></div>';
    }

    function sizeProbabilityAtLeast(k) {
        return normalSf((k - SIZE_MEAN) / SIZE_SD);
    }

    function overviewHtml(stats) {
        const z = (stats.stars - stats.starMean) / stats.starSd;
        const starPercentile = normalCdf(z);
        // Nodes are a discrete uniform draw, so the percentile is a plain
        // rank rather than anything bell shaped.
        const nodeSpan = stats.nodeMax - stats.nodeMin + 1;
        const nodePercentile = (stats.nodes - stats.nodeMin + 1) / nodeSpan;
        const floored = stats.stars === Math.floor(stats.starFloor);

        return '' +
            '<div class="sky-seedcard">' +
            '<div class="sky-seedcard-label">seed</div>' +
            '<div class="sky-seed-grid">' + seedGridHtml(stats.seed) + '</div>' +
            '<div class="sky-seedcard-actions">' +
            '<button type="button" class="sky-btn" data-action="copy-seed">copy</button>' +
            '<button type="button" class="sky-btn" data-action="edit-seed">enter a seed</button>' +
            '<button type="button" class="sky-btn sky-btn--accent" data-action="reroll">roll a new sky</button>' +
            '</div>' +
            '<form class="sky-seed-form" data-seed-form hidden>' +
            '<input type="text" inputmode="latin" autocomplete="off" spellcheck="false" ' +
            'class="sky-seed-input" placeholder="32 hex characters" maxlength="32" value="' + escapeHtml(stats.seed) + '">' +
            '<button type="submit" class="sky-btn sky-btn--accent">apply</button>' +
            '</form>' +
            '<p class="sky-seedcard-note">128 bits. Everything below is a pure function of these characters and the size of the page.</p>' +
            '</div>' +

            '<div class="sky-grid">' +
            '<section class="sky-card">' +
            '<div class="sky-card-head"><h3>Stars</h3>' +
            '<span class="sky-pill">' + formatPercentile(starPercentile) + 'th percentile</span></div>' +
            '<div class="sky-bignum">' + stats.stars.toLocaleString() + '</div>' +
            '<p class="sky-sub">' + percentileLabel(starPercentile) + '. Expected ' +
            Math.round(stats.starMean).toLocaleString() + ' ± ' + Math.round(stats.starSd).toLocaleString() +
            ' for a page this tall.</p>' +
            bellCurveSvg(z, stats.stars.toLocaleString()) +
            '<p class="sky-note">' + (z >= 0
                ? 'This roll beat ' + formatPercentile(starPercentile) + '% of possible skies at this page height.'
                : 'This roll came in under ' + formatPercentile(1 - starPercentile) + '% of possible skies at this page height.') +
            (floored ? ' The draw fell below the floor of ' + Math.floor(stats.starFloor) + ', so the floor is what you see.' : '') +
            '</p>' +
            '</section>' +

            '<section class="sky-card">' +
            '<div class="sky-card-head"><h3>Nodes</h3>' +
            '<span class="sky-pill">' + formatPercentile(nodePercentile) + 'th percentile</span></div>' +
            '<div class="sky-bignum">' + stats.nodes + '</div>' +
            '<p class="sky-sub">Colour clouds behind the stars. Flat draw over ' + stats.nodeMin +
            ' to ' + stats.nodeMax + ', so every count here is equally likely.</p>' +
            uniformStripSvg(stats.nodes, stats.nodeMin, stats.nodeMax) +
            '<p class="sky-note">Odds of exactly this many: ' + formatOdds(1 / nodeSpan) +
            '. The ceiling scales with page height, which is why a long page can hold more.</p>' +
            '</section>' +
            '</div>' +

            rareFindsHtml(stats) +

            '<section class="sky-card sky-card--wide">' +
            '<div class="sky-card-head"><h3>Size distribution</h3>' +
            '<span class="sky-pill sky-pill--quiet">' + stats.stars.toLocaleString() + ' draws</span></div>' +
            '<p class="sky-sub">Every star draws its own size from the same bell. The tick on each bar is where the expected share sits.</p>' +
            sizeTableHtml(stats) +
            '</section>' +

            '<section class="sky-card sky-card--wide sky-card--quiet">' +
            '<div class="sky-card-head"><h3>Canvas</h3></div>' +
            '<dl class="sky-defs">' +
            '<div><dt>page height</dt><dd>' + Math.round(stats.pageHeight).toLocaleString() + ' px</dd></div>' +
            '<div><dt>viewport</dt><dd>' + Math.round(stats.viewportHeight).toLocaleString() + ' px</dd></div>' +
            '<div><dt>screens of content</dt><dd>' + stats.pageHeightRatio.toFixed(2) + '×</dd></div>' +
            '<div><dt>stars per screen</dt><dd>' + Math.round(stats.stars / stats.pageHeightRatio).toLocaleString() + '</dd></div>' +
            '</dl>' +
            '</section>';
    }

    // ── System pane ────────────────────────────────────────────────

    function rarityLadderHtml() {
        let rows = '';
        for (let s = 1; s <= 10; s++) {
            const p = sizeProbability(s);
            const lo = s === 1 ? '−∞' : s.toFixed(0);
            const hi = s === 10 ? '+∞' : (s + 1).toFixed(0);
            const sigmaLo = s === 1 ? '−∞' : ((s - SIZE_MEAN) / SIZE_SD).toFixed(2) + 'σ';
            rows += '<tr class="' + (s >= RARE_SIZE ? 'is-rare' : '') + '">' +
                '<th scope="row"><span class="sky-dot" style="background:' + SIZE_COLORS[s] +
                ';width:' + Math.max(4, s) + 'px;height:' + Math.max(4, s) + 'px"></span>' + s + 'px</th>' +
                '<td class="sky-mono sky-dim">[' + lo + ', ' + hi + ')</td>' +
                '<td class="sky-mono sky-dim">' + sigmaLo + '</td>' +
                '<td class="sky-num">' + formatPercent(p) + '</td>' +
                '<td class="sky-num">' + formatOdds(p) + '</td>' +
                '<td class="sky-num sky-dim">' + formatOdds(binomialAtLeast(1000, p, 1)) + '</td>' +
                '</tr>';
        }
        return '<table class="sky-table sky-table--ladder">' +
            '<thead><tr><th scope="col">size</th><th scope="col">draw lands in</th>' +
            '<th scope="col">lower edge</th><th scope="col">per star</th>' +
            '<th scope="col">odds</th><th scope="col">seen in a 1,000 star sky</th></tr></thead>' +
            '<tbody>' + rows + '</tbody></table>';
    }

    function systemHtml() {
        const rare = sizeProbabilityAtLeast(RARE_SIZE);
        return '' +
            '<section class="sky-card sky-card--wide sky-prose">' +
            '<h3>One seed, one sky</h3>' +
            '<p>The background is not a picture. Every star and every colour cloud is drawn at load time from a single 32 character hex seed, and nothing else. Type the same seed on the same size of page and you get pixel for pixel the same sky back.</p>' +
            '<p>The seed is 128 bits of <span class="sky-mono">Math.random()</span>. It gets folded down with an FNV-1a hash into a 32 bit state, then mixed with a stream index to give three independent generators: one for the colour clouds, one for the star count, one for star placement. Keeping them apart matters. When they shared a cursor, drawing one extra colour cloud shifted the position of every star after it.</p>' +
            '<p>Each generator is <span class="sky-mono">mulberry32</span>, a small counter based PRNG. It advances its state by a fixed odd constant, mixes with two multiply-xorshift rounds, and returns 32 bits as a fraction. Fast, deterministic, and good enough that the sky looks unstructured.</p>' +
            '</section>' +

            '<section class="sky-card sky-card--wide sky-prose">' +
            '<h3>How many stars</h3>' +
            '<p>Density is held constant per screen of content, so a long page gets proportionally more stars rather than a thinner sky. With <span class="sky-mono">R</span> as page height divided by viewport height:</p>' +
            '<p class="sky-formula">N ~ Normal(&mu; = 750R, &sigma; = 500&radic;R), floored, with a hard floor at 50R</p>' +
            '<p>The mean scales with <span class="sky-mono">R</span> and the standard deviation with <span class="sky-mono">&radic;R</span>, which is what you would get from adding <span class="sky-mono">R</span> independent screens together. The practical effect is that variance per screen stays the same no matter how far the page runs.</p>' +
            '<p>Normal samples come from a Box-Muller transform: two uniforms in, one normal out, via <span class="sky-mono">&radic;(&minus;2 ln u) &middot; cos(2&pi;v)</span>.</p>' +
            '<p>The floor exists because the draw has a fat enough left tail to produce a negative count. It fires roughly ' +
            formatPercent(normalCdf((50 - 750) / 500)) + ' of the time on a single screen page.</p>' +
            '</section>' +

            '<section class="sky-card sky-card--wide sky-prose">' +
            '<h3>How big each star is</h3>' +
            '<p>Size is its own draw, taken once per star from the same bell and then snapped to a whole pixel:</p>' +
            '<p class="sky-formula">S = clamp(floor(Normal(&mu; = 2, &sigma; = 1.426)), 1, 10) px</p>' +
            '<p>Two things happen in that line. The floor turns a smooth curve into a ten rung ladder, so the chance of landing on size <span class="sky-mono">s</span> is the area of the bell between <span class="sky-mono">s</span> and <span class="sky-mono">s+1</span>. The clamp then dumps the whole lower half of the curve onto size 1, which is why exactly half of any sky is 1px dust, and dumps the whole upper tail onto size 10.</p>' +
            '<p>Because &sigma; is 1.426, each step up the ladder costs about 0.70&sigma;. That compounds fast. Size 6 starts 2.8 standard deviations out, size 8 starts at 4.2, and size 10 only exists past 5.6.</p>' +
            rarityLadderHtml() +
            '<p class="sky-note">The last column is the chance that a 1,000 star sky contains at least one, which is the number that actually decides whether you ever see one.</p>' +
            '</section>' +

            '<section class="sky-card sky-card--wide sky-prose">' +
            '<h3>Colour clouds</h3>' +
            '<p>Behind the stars sit between 2 and <span class="sky-mono">floor(10R)</span> radial gradients, drawn flat, each placed at a random point on the page. Their colours do not come from the PRNG at all. Byte triples are read directly out of the seed text, weighted into a luma value, nudged by a sine and cosine of those same bytes, and then tinted toward one of four hints (red, orange, yellow, purple). The result is clamped dark on purpose so text stays readable over it.</p>' +
            '<p>That is why editing one character of the seed shifts the palette rather than replacing it.</p>' +
            '</section>' +

            '<section class="sky-card sky-card--wide sky-prose">' +
            '<h3>Why a rare star is worth a popup</h3>' +
            '<p>A single star reaches ' + RARE_SIZE + 'px or above with probability ' + formatPercent(rare) +
            ', which is ' + formatOdds(rare) + '. A typical page here holds somewhere around a thousand stars, so the chance of one turning up in a given roll is roughly ' +
            formatPercent(binomialAtLeast(1000, rare, 1)) + '. Rare enough to mention, common enough that it will happen if you keep hitting the reroll button.</p>' +
            '</section>' +

            '<section class="sky-card sky-card--wide sky-prose">' +
            '<h3>Why the sky holds still</h3>' +
            '<p>On a phone the browser grows and shrinks the viewport as the URL bar slides away, and it fires a resize event each time. Regenerating on those events meant the sky rebuilt itself mid-scroll, with a different star count and different positions, off the same seed.</p>' +
            '<p>Two fixes. Height is measured against <span class="sky-mono">100lvh</span>, the large viewport height, which does not move while you scroll. And a regenerate only runs when the page has genuinely changed shape, meaning a width change or more than ' +
            GEOMETRY_TOLERANCE + 'px of height movement. Everything smaller is treated as chrome sliding around and ignored.</p>' +
            '</section>';
    }

    // ── Modal ──────────────────────────────────────────────────────

    function buildModal() {
        if (modalEl) return modalEl;
        modalEl = document.createElement('div');
        modalEl.className = 'sky-modal';
        modalEl.id = 'sky-modal';
        modalEl.hidden = true;
        modalEl.innerHTML =
            '<div class="sky-modal__scrim" data-close></div>' +
            '<div class="sky-modal__panel" role="dialog" aria-modal="true" aria-labelledby="sky-modal-title">' +
            '<div class="sky-modal__head">' +
            '<div><h2 id="sky-modal-title">This sky</h2>' +
            '<p class="sky-modal__kicker">generated background &middot; seeded</p></div>' +
            '<button type="button" class="sky-modal__close" data-close aria-label="Close">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
            '</button></div>' +
            '<div class="sky-tabs" role="tablist">' +
            '<button type="button" class="sky-tab is-active" role="tab" data-tab="overview">Seed overview</button>' +
            '<button type="button" class="sky-tab" role="tab" data-tab="system">How it works</button>' +
            '</div>' +
            '<div class="sky-modal__body">' +
            '<div class="sky-pane" data-pane="overview"></div>' +
            '<div class="sky-pane" data-pane="system" hidden></div>' +
            '</div></div>';

        document.body.appendChild(modalEl);

        modalEl.addEventListener('click', e => {
            if (e.target.closest('[data-close]')) {
                closeModal();
                return;
            }
            const tab = e.target.closest('.sky-tab');
            if (tab) {
                setTab(tab.dataset.tab);
                return;
            }
            const action = e.target.closest('[data-action]');
            if (action) handleModalAction(action.dataset.action, action);
        });

        modalEl.addEventListener('submit', e => {
            const form = e.target.closest('[data-seed-form]');
            if (!form) return;
            e.preventDefault();
            const input = form.querySelector('.sky-seed-input');
            const value = (input.value || '').trim().toLowerCase();
            if (!/^[0-9a-f]{1,32}$/.test(value)) {
                input.classList.add('is-invalid');
                setTimeout(() => input.classList.remove('is-invalid'), 900);
                return;
            }
            updateSeed(value);
        });

        return modalEl;
    }

    function handleModalAction(action, el) {
        if (action === 'reroll') {
            updateSeed(generateLocalSeed());
        } else if (action === 'copy-seed') {
            copyText(currentSeed, el);
        } else if (action === 'edit-seed') {
            const form = modalEl.querySelector('[data-seed-form]');
            if (!form) return;
            form.hidden = !form.hidden;
            if (!form.hidden) {
                const input = form.querySelector('.sky-seed-input');
                input.focus();
                input.select();
            }
        }
    }

    function copyText(text, btn) {
        const done = ok => {
            if (!btn) return;
            const original = btn.textContent;
            btn.textContent = ok ? 'copied' : 'copy failed';
            setTimeout(() => { btn.textContent = original; }, 1400);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => done(true), () => done(false));
            return;
        }
        // Older mobile Safari has no clipboard API over a plain origin.
        const scratch = document.createElement('textarea');
        scratch.value = text;
        scratch.setAttribute('readonly', '');
        scratch.style.cssText = 'position:fixed;top:-1000px;opacity:0;';
        document.body.appendChild(scratch);
        scratch.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
        document.body.removeChild(scratch);
        done(ok);
    }

    function setTab(name) {
        activeTab = name;
        if (!modalEl) return;
        modalEl.querySelectorAll('.sky-tab').forEach(t => {
            t.classList.toggle('is-active', t.dataset.tab === name);
            t.setAttribute('aria-selected', t.dataset.tab === name ? 'true' : 'false');
        });
        modalEl.querySelectorAll('.sky-pane').forEach(p => {
            p.hidden = p.dataset.pane !== name;
        });
        const body = modalEl.querySelector('.sky-modal__body');
        if (body) body.scrollTop = 0;
    }

    function renderPanes() {
        if (!modalEl || !skyStats) return;
        const overview = modalEl.querySelector('[data-pane="overview"]');
        const system = modalEl.querySelector('[data-pane="system"]');
        if (overview) overview.innerHTML = overviewHtml(skyStats);
        if (system && !system.dataset.rendered) {
            system.innerHTML = systemHtml();
            system.dataset.rendered = '1';
        }
    }

    function openModal(tab) {
        buildModal();
        if (!skyStats) renderVisuals();
        renderPanes();
        setTab(tab || activeTab);
        modalEl.hidden = false;
        document.body.classList.add('sky-modal-open');
        const close = modalEl.querySelector('.sky-modal__close');
        if (close) close.focus();
    }

    function closeModal() {
        if (!modalEl) return;
        modalEl.hidden = true;
        document.body.classList.remove('sky-modal-open');
    }

    // ── Rare star popup ────────────────────────────────────────────

    function maybeAnnounceRare(stats) {
        const found = [];
        for (let s = RARE_SIZE; s <= 10; s++) {
            if (stats.sizeCounts[s] > 0) found.push(s);
        }
        if (!found.length) return;
        // Once per seed, so a resize-driven regenerate does not re-announce.
        if (rareAnnouncedFor === stats.seed) return;
        rareAnnouncedFor = stats.seed;

        const biggest = found[found.length - 1];
        const total = found.reduce((sum, s) => sum + stats.sizeCounts[s], 0);
        const p = sizeProbability(biggest);

        const existing = document.getElementById('sky-rare-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'sky-rare-toast';
        toast.className = 'sky-toast';
        toast.setAttribute('role', 'status');
        toast.style.setProperty('--rare', SIZE_COLORS[biggest]);
        toast.innerHTML =
            '<span class="sky-toast__star" style="width:' + (biggest * 2) + 'px;height:' + (biggest * 2) + 'px"></span>' +
            '<div class="sky-toast__text">' +
            '<strong>Rare star: ' + biggest + 'px ' + SIZE_NAMES[biggest] + '</strong>' +
            '<span>' + formatOdds(p) + ' per star' +
            (total > 1 ? ' &middot; ' + total + ' rare stars in this sky' : '') + '</span>' +
            '</div>' +
            '<button type="button" class="sky-toast__cta" data-open>see the numbers</button>' +
            '<button type="button" class="sky-toast__close" data-dismiss aria-label="Dismiss">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
            '</button>';

        document.body.appendChild(toast);
        window.requestAnimationFrame(() => toast.classList.add('is-in'));

        const dismiss = () => {
            toast.classList.remove('is-in');
            setTimeout(() => toast.remove(), 350);
        };
        toast.addEventListener('click', e => {
            if (e.target.closest('[data-open]')) {
                dismiss();
                openModal('overview');
            } else if (e.target.closest('[data-dismiss]')) {
                dismiss();
            }
        });
        setTimeout(() => {
            if (document.body.contains(toast)) dismiss();
        }, 14000);
    }

    // ── Bubbles ────────────────────────────────────────────────────

    function randomizeBubbles() {
        const bubbleContainers = document.querySelectorAll('.bubble-container');

        bubbleContainers.forEach((container, bubbleIndex) => {
            // Each bubble mixes the main seed with its index, so it is unique
            // but still deterministic relative to the seed.
            const baseSeedInt = parseInt(currentSeed.substring(0, 8), 16);
            const uniqueSeedInt = (baseSeedInt + (bubbleIndex + 1) * 0x9E3779B9) >>> 0;
            const uniqueSeedHex = uniqueSeedInt.toString(16).padStart(8, '0');
            const bubblePrng = mulberry32(uniqueSeedHex);

            const gradientNodes = container.querySelectorAll('.gradient-node');
            const colors = [
                'rgba(255, 182, 193, 0.8)',
                'rgba(221, 160, 221, 0.8)',
                'rgba(173, 216, 230, 0.8)',
                'rgba(138, 43, 226, 0.8)',
                'rgba(255, 20, 147, 0.8)'
            ];

            gradientNodes.forEach(node => {
                const x = bubblePrng() * 80 + 10;
                const y = bubblePrng() * 80 + 10;
                const size = bubblePrng() * 50 + 40;
                const colorIndex = Math.floor(bubblePrng() * colors.length);
                const selectedColor = colors[colorIndex];
                const duration = bubblePrng() * 4 + 4;

                node.style.left = x + '%';
                node.style.top = y + '%';
                node.style.width = size + 'px';
                node.style.height = size + 'px';
                node.style.background = 'radial-gradient(circle, ' + selectedColor + ' 0%, transparent 70%)';
                node.style.animationDuration = duration + 's';
                node.style.opacity = (bubblePrng() * 0.4 + 0.4).toString();
            });

            const bubbleImage = container.querySelector('.bubble-image img');
            if (bubbleImage) {
                const imageOpacity = bubblePrng() * 0.3 + 0.5;
                const maskX = bubblePrng() * 20 + 40;
                const maskY = bubblePrng() * 20 + 40;

                bubbleImage.style.opacity = imageOpacity.toString();
                const maskGradient = 'radial-gradient(ellipse ' + maskX + '% ' + maskY +
                    '% at center, black 20%, transparent 75%)';
                bubbleImage.style.mask = maskGradient;
                bubbleImage.style.webkitMask = maskGradient;
            }
        });
    }

    // ── Seed handling ──────────────────────────────────────────────

    function updateSeed(newSeed) {
        if (!/^[0-9a-fA-F]+$/.test(newSeed)) {
            alert('Seed must be a hexadecimal string.');
            return;
        }

        currentSeed = newSeed.toLowerCase().padEnd(32, '0').substring(0, 32);

        if (seedDisplay) seedDisplay.textContent = 'Seed: ' + currentSeed;
        prng = mulberry32(currentSeed);

        // A new seed is a fresh roll, so the geometry gate must not skip it.
        lastGeometry = null;
        renderVisuals();
        randomizeBubbles();
    }

    function wireSeedDisplay() {
        if (!seedDisplay) return;
        seedDisplay.textContent = 'Seed: ' + currentSeed;

        seedDisplay.addEventListener('dblclick', () => {
            if (seedDisplay.querySelector('input')) return;
            const currentText = seedDisplay.textContent.replace('Seed: ', '').trim();

            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentText;
            input.className = 'seed-input';

            seedDisplay.innerHTML = 'Seed: ';
            seedDisplay.appendChild(input);
            input.focus();
            input.select();

            const commitChange = () => {
                const val = input.value.trim().toLowerCase();
                if (val === currentText) {
                    seedDisplay.textContent = 'Seed: ' + currentText;
                } else if (/^[0-9a-fA-F]+$/.test(val)) {
                    updateSeed(val);
                } else {
                    alert('Invalid hex seed. Reverting.');
                    seedDisplay.textContent = 'Seed: ' + currentText;
                }
            };

            input.addEventListener('blur', commitChange);
            input.addEventListener('keypress', e => {
                if (e.key === 'Enter') input.blur();
            });
        });
    }

    // ── Footer controls ────────────────────────────────────────────

    function wireFooter() {
        if (rerollBtn) {
            rerollBtn.addEventListener('click', () => {
                rerollBtn.classList.add('rolling');
                rerollBtn.addEventListener('animationend', () => {
                    rerollBtn.classList.remove('rolling');
                }, { once: true });
                updateSeed(generateLocalSeed());
            });
        }

        // The help button is injected rather than written into every page.
        if (footerInner && !document.getElementById('sky-help-btn')) {
            const help = document.createElement('button');
            help.id = 'sky-help-btn';
            help.type = 'button';
            help.className = 'footer-help-btn';
            help.setAttribute('aria-label', 'About this sky');
            help.title = 'How this sky was generated';
            help.textContent = '?';
            help.addEventListener('click', () => openModal('overview'));
            if (rerollBtn && rerollBtn.parentNode === footerInner) {
                footerInner.insertBefore(help, rerollBtn);
            } else {
                footerInner.appendChild(help);
            }
        }

        if (footerSizeBarsEl) {
            footerSizeBarsEl.addEventListener('click', () => openModal('overview'));
        }
        if (footerSeedEl) {
            footerSeedEl.addEventListener('click', () => openModal('overview'));
        }

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && modalEl && !modalEl.hidden) closeModal();
        });
    }

    // ── Init ───────────────────────────────────────────────────────

    function debounce(func, delay) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    function init() {
        if (!currentSeed) currentSeed = generateLocalSeed();
        prng = mulberry32(currentSeed);

        wireSeedDisplay();
        wireFooter();

        renderVisuals();
        setTimeout(randomizeBubbles, 100);

        const debouncedRender = debounce(maybeRender, 260);

        const resizeObserver = new ResizeObserver(entries => {
            if (entries.length > 0) debouncedRender();
        });
        if (contentWrapper) resizeObserver.observe(contentWrapper);

        window.addEventListener('resize', debouncedRender);
        window.addEventListener('orientationchange', () => {
            lastGeometry = null;
            debouncedRender();
        });
    }

    // --- Event Listeners ---
    if (addContentBtn) {
        addContentBtn.addEventListener('click', () => {
            const newContent = document.createElement('div');
            newContent.className = 'content-box';
            newContent.innerHTML =
                '<h2>Newly Added Section</h2>' +
                '<p>This section was added dynamically. Notice how the background remains consistent, ' +
                'and you can scroll further down to see more of the generated starfield.</p>';
            additionalContentContainer.appendChild(newContent);
            // The ResizeObserver picks this up.
        });
    }

    init();
});
