document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const nodesContainer = document.getElementById('nodes-container');
    const starsContainer = document.getElementById('stars-container');
    const contentWrapper = document.getElementById('content-wrapper');
    const addContentBtn = document.getElementById('add-content-btn');
    const additionalContentContainer = document.getElementById('additional-content-container');
    const seedDisplay = document.getElementById('seed-display');

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
     * Randomizes bubble gradient node positions and properties based on seed
     */
    function randomizeBubbles() {
        const bubbleContainers = document.querySelectorAll('.bubble-container');
        
        bubbleContainers.forEach((container, bubbleIndex) => {
            const bubbleSeed = container.getAttribute('data-seed') || `bubble-${bubbleIndex}`;
            const bubblePrng = mulberry32(currentSeed + bubbleSeed);
            
            const gradientNodes = container.querySelectorAll('.gradient-node');
            const colors = [
                'rgba(255, 182, 193, 0.8)', // Light pink
                'rgba(221, 160, 221, 0.8)', // Plum
                'rgba(173, 216, 230, 0.8)', // Light blue
                'rgba(138, 43, 226, 0.8)',  // Blue violet
                'rgba(255, 20, 147, 0.8)'   // Deep pink
            ];
            
            gradientNodes.forEach((node, index) => {
                // Randomize position
                const x = bubblePrng() * 80 + 10; // 10-90% range
                const y = bubblePrng() * 80 + 10; // 10-90% range
                
                // Randomize size
                const size = bubblePrng() * 50 + 40; // 40-90px range
                
                // Randomize color
                const colorIndex = Math.floor(bubblePrng() * colors.length);
                const selectedColor = colors[colorIndex];
                
                // Randomize animation duration
                const duration = bubblePrng() * 4 + 4; // 4-8 seconds
                
                // Apply styles
                node.style.left = `${x}%`;
                node.style.top = `${y}%`;
                node.style.width = `${size}px`;
                node.style.height = `${size}px`;
                node.style.background = `radial-gradient(circle, ${selectedColor} 0%, transparent 70%)`;
                node.style.animationDuration = `${duration}s`;
                
                // Randomize opacity
                const opacity = bubblePrng() * 0.4 + 0.4; // 0.4-0.8 range
                node.style.opacity = opacity.toString();
            });
            
            // Add slight randomization to the bubble image opacity and mask
            const bubbleImage = container.querySelector('.bubble-image img');
            if (bubbleImage) {
                const imageOpacity = bubblePrng() * 0.3 + 0.5; // 0.5-0.8 range
                const maskX = bubblePrng() * 20 + 40; // 40-60% range
                const maskY = bubblePrng() * 20 + 40; // 40-60% range
                
                bubbleImage.style.opacity = imageOpacity.toString();
                const maskGradient = `radial-gradient(ellipse ${maskX}% ${maskY}% at center, black 20%, transparent 75%)`;
                bubbleImage.style.mask = maskGradient;
                bubbleImage.style.webkitMask = maskGradient;
            }
        });
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
        
        // Randomize bubbles after a short delay to ensure DOM is ready
        setTimeout(() => {
            randomizeBubbles();
        }, 100);

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

        window.addEventListener('resize', debouncedRender);
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
