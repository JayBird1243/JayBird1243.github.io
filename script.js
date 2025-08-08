document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const nodesContainer = document.getElementById('nodes-container');
    const starsContainer = document.getElementById('stars-container');
    const contentWrapper = document.getElementById('content-wrapper');
    const addContentBtn = document.getElementById('add-content-btn');
    const additionalContentContainer = document.getElementById('additional-content-container');
    const seedDisplay = document.getElementById('seed-display');
    const bubbleGrid = document.getElementById('bubble-grid');

    // --- State ---
    let currentSeed = null;
    let prng = null;

    // --- Core Functions ---

    /**
     * Generates a 32-character hexadecimal seed using Math.random().
     * This is a simpler, self-contained method compared to an external API.
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
     * A mulberry32 pseudo-random number generator.
     * Takes a 32-bit integer seed and returns a function that generates random numbers.
     * @param {string} hexSeed - A 32-character hex string.
     */
    function mulberry32(hexSeed) {
        let seed = parseInt(hexSeed.substring(0, 8), 16);
        return function() {
            let t = seed += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    /**
     * Generates a value from a normal distribution.
     * @param {function} prng - The pseudo-random number generator.
     * @param {number} mean - The mean of the distribution.
     * @param {number} stdDev - The standard deviation.
     */
    function normalRandom(prng, mean, stdDev) {
        let u = 0, v = 0;
        while (u === 0) u = prng();
        while (v === 0) v = prng();
        const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        return z * stdDev + mean;
    }
    
    /**
     * Calculates the number of stars to generate based on page height.
     * The density is kept constant relative to the viewport height.
     * @param {function} prng - The pseudo-random number generator.
     * @param {number} pageHeightRatio - The ratio of total page height to viewport height.
     */
    function getStarCount(prng, pageHeightRatio) {
        const meanPerScreen = 750;
        const stdDevPerScreen = 200;
        
        const mean = meanPerScreen * pageHeightRatio;
        const stdDev = stdDevPerScreen * Math.sqrt(pageHeightRatio); 

        const count = normalRandom(prng, mean, stdDev);
        return Math.max(50 * pageHeightRatio, Math.floor(count));
    }


    /**
     * Calculates the size of a star using a normal distribution.
     * Rare, larger stars are possible but infrequent.
     */
    function getStarSize(prng) {
        const size = normalRandom(prng, 2, 1.426);
        return Math.max(1, Math.min(10, Math.floor(size)));
    }

    /**
     * Generates a sophisticated, dark, and muted color palette.
     * Uses the seed for deterministic color generation.
     */
    function generateColorPalette(count, prng, hexSeed) {
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
            
            let baseGray = Math.max(0.05, Math.min(0.45, 
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
            
            colors.push(`#${hexR}${hexG}${hexB}`);
        }
        return colors;
    }

    /**
     * Renders the entire visual background based on the seed and page height.
     */
    function renderVisuals() {
        if (!nodesContainer || !starsContainer) return;

        const totalPageHeight = document.documentElement.scrollHeight;
        const viewportHeight = window.innerHeight;
        const pageHeightRatio = Math.max(1, totalPageHeight / viewportHeight);

        // --- Clear existing visuals ---
        nodesContainer.style.backgroundImage = '';
        starsContainer.innerHTML = '';
        
        // --- Generate Gradients (Nodes) ---
        const minNodes = 2;
        const baseMaxNodes = 10;
        const maxNodes = Math.floor(baseMaxNodes * pageHeightRatio);
        const numColors = Math.floor(prng() * (maxNodes - minNodes + 1)) + minNodes;

        const colors = generateColorPalette(numColors, prng, currentSeed);
        
        const gradients = [];
        for (let i = 0; i < numColors; i++) {
            const x = prng() * 100;
            const y = prng() * 100; 
            const color = colors[i];
            gradients.push(`radial-gradient(circle at ${x}% ${y}%, ${color}, transparent 50%)`);
        }
        
        // --- Generate Stars ---
        const numStars = getStarCount(prng, pageHeightRatio);
        const stars = [];

        for (let i = 0; i < numStars; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            
            star.style.left = `${prng() * 100}%`;
            star.style.top = `${prng() * 100}%`;
            
            const size = getStarSize(prng);
            star.style.width = `${size}px`;
            star.style.height = `${size}px`;
            if (size >= 6) {
                star.classList.add(`star-${size}`);
            }
            
            stars.push(star);
        }

        // --- Animate into view ---
        setTimeout(() => {
            const backgroundHeight = Math.max(totalPageHeight, viewportHeight);
            nodesContainer.style.height = `${backgroundHeight}px`;
            starsContainer.style.height = `${backgroundHeight}px`;
            document.getElementById('background-container').style.height = `${backgroundHeight}px`;

            nodesContainer.style.backgroundImage = gradients.join(', ');
            nodesContainer.style.opacity = '1';

            const fragment = document.createDocumentFragment();
            stars.forEach(star => fragment.appendChild(star));
            starsContainer.appendChild(fragment);

            // Animate stars in batches
            const animationDelay = 2; //ms
            for (let i = 0; i < stars.length; i++) {
                setTimeout(() => {
                    stars[i].style.opacity = '1';
                }, i * animationDelay);
            }
        }, 50);
    }

    /**
     * Generate a seeded set of iridescent "bubble" squares with 5 internal gradient nodes each
     * and an optional image with a randomized fade. Colors: blue/pink/red/purple palette.
     */
    function renderBubbles() {
        if (!bubbleGrid || !prng) return;

        // Clear prior
        bubbleGrid.innerHTML = '';

        // Projects with explicit images and titles
        const projects = [
            {
                title: 'Autonomous Driving',
                image: 'Images/Screenshot 2025-08-08 175310.png'
            }
        ];

        // Decide how many bubbles to render based on viewport width
        const viewportWidth = window.innerWidth;
        const columns = viewportWidth >= 900 ? 4 : viewportWidth >= 600 ? 3 : 2;
        const rows = 2; // keep it concise; can be adjusted
        const total = Math.max(columns * rows, projects.length);

        for (let i = 0; i < total; i++) {
            const bubbleCard = document.createElement('div');
            bubbleCard.className = 'bubble-card';

            const titleEl = document.createElement('div');
            titleEl.className = 'bubble-title';
            const projTitle = i < projects.length ? projects[i].title : `Project ${i + 1}`;
            titleEl.textContent = projTitle;

            const bubble = document.createElement('div');
            bubble.className = 'bubble';

            // Build five gradient nodes inside this bubble boundary
            const palette = pickIridescentPalette(prng);
            const gradients = [];
            for (let g = 0; g < 5; g++) {
                const color = palette[g % palette.length];
                const x = Math.round(prng() * 100);
                const y = Math.round(prng() * 100);
                const stop = 30 + Math.round(prng() * 25); // 30-55%
                gradients.push(`radial-gradient(circle at ${x}% ${y}%, ${hexWithAlpha(color, 0.55)}, transparent ${stop}%)`);
            }
            // Add a subtle border glow blend
            gradients.push(`radial-gradient(120% 120% at 50% -10%, ${hexWithAlpha('#ffffff', 0.15)}, transparent 70%)`);
            bubble.style.backgroundImage = gradients.join(', ');

            // Random image fade overlay
            const imgDiv = document.createElement('div');
            imgDiv.className = 'bubble-image';
            const imageUrl = i < projects.length ? projects[i].image : 'Images/1720469597486.jpg';
            imgDiv.style.backgroundImage = `url('${imageUrl}')`;

            // Randomize fade position/shape using CSS mask
            const cx = Math.round(prng() * 100);
            const cy = Math.round(prng() * 100);
            const inner = 40 + Math.round(prng() * 25); // 40-65%
            const outer = 90 + Math.round(prng() * 10); // 90-100%
            const ring = 10 + Math.round(prng() * 10);  // added secondary falloff
            const mask = `radial-gradient(circle at ${cx}% ${cy}%, #000 ${inner}%, rgba(0,0,0,0.75) ${inner + ring}%, transparent ${outer}%)`;
            imgDiv.style.webkitMaskImage = mask;
            imgDiv.style.maskImage = mask;

            // Slight random rotation/scale for organic look
            const rot = (prng() * 8 - 4).toFixed(2); // -4 to 4 deg
            const scale = (0.96 + prng() * 0.1).toFixed(3); // 0.96 - 1.06
            imgDiv.style.transform = `rotate(${rot}deg) scale(${scale})`;

            bubble.appendChild(imgDiv);
            bubbleCard.appendChild(titleEl);
            bubbleCard.appendChild(bubble);
            bubbleGrid.appendChild(bubbleCard);
        }
    }

    function pickIridescentPalette(prng) {
        // Patel blue/pink/red/purple-ish hexes
        const bases = [
            '#6EE7F9', // blue-cyan
            '#A78BFA', // purple
            '#FB7185', // rose
            '#F472B6', // pink
            '#60A5FA', // blue
            '#FCA5A5', // red-pink
        ];
        // Shuffle deterministically
        const shuffled = bases
            .map(color => ({ color, r: prng() }))
            .sort((a, b) => a.r - b.r)
            .map(o => o.color);
        return shuffled.slice(0, 5);
    }

    function hexWithAlpha(hex, alpha) {
        // hex like #RRGGBB
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Initializes the application.
     * Generates a seed and triggers the first render.
     */
    function init() {
        currentSeed = generateLocalSeed();
        prng = mulberry32(currentSeed);

        if(seedDisplay){
             seedDisplay.textContent = `Seed: ${currentSeed}`;
        }
        
        const debouncedRender = debounce(renderVisuals, 250);

        // Initial render
        renderVisuals();
        renderBubbles();

        // Use a ResizeObserver to dynamically re-render visuals when content changes height
        const resizeObserver = new ResizeObserver(entries => {
             // We are only observing one element, so we can just use the first entry.
            if (entries.length > 0) {
                debouncedRender();
            }
        });
        
        if (contentWrapper) {
            resizeObserver.observe(contentWrapper);
        }
        if (bubbleGrid) {
            resizeObserver.observe(bubbleGrid);
        }

        window.addEventListener('resize', () => {
            debouncedRender();
            renderBubbles();
        });
    }

    /**
     * Debounce function to limit how often a function can run.
     */
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // --- Event Listeners ---
    if (addContentBtn) {
        addContentBtn.addEventListener('click', () => {
            const newContent = document.createElement('div');
            newContent.className = 'content-box';
            newContent.innerHTML = `
                <h2>Newly Added Section</h2>
                <p>This section was added dynamically. Notice how the background remains consistent, and you can scroll further down to see more of the generated starfield.</p>
                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus. Suspendisse lectus tortor, dignissim sit amet, adipiscing nec, ultricies sed, dolor.</p>
            `;
            additionalContentContainer.appendChild(newContent);
            // The ResizeObserver will automatically trigger a re-render
        });
    }

    // --- Start the app ---
    init();
});
