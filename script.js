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

    // --- Resume Interactive Features ---
    
    /**
     * Detailed information for timeline items
     */
    const timelineDetails = {
        'education-2026': {
            title: 'Queen\'s University - Bachelor of Applied Science',
            content: `
                <h3>Degree Details</h3>
                <p><strong>Program:</strong> Bachelor of Applied Science in Electrical Engineering</p>
                <p><strong>Expected Graduation:</strong> May 2026</p>
                <p><strong>CGPA:</strong> 3.1</p>
                <p><strong>Location:</strong> Kingston, ON</p>
                
                <h3>Relevant Coursework</h3>
                <ul>
                    <li>Computer Architecture</li>
                    <li>Earth Systems Engineering</li>
                    <li>Electromagnetics</li>
                    <li>Engineering Graphics</li>
                    <li>Digital Systems</li>
                    <li>Engineering Project Design</li>
                </ul>
                
                <h3>Activities</h3>
                <ul>
                    <li>Vex-U Robotics</li>
                    <li>Software design</li>
                    <li>Competitive soccer intramurals</li>
                    <li>Jiu Jitsu/MMA club</li>
                </ul>
            `
        },
        'experience-2024': {
            title: 'cellcentric - Process Engineering & Maintenance Intern',
            content: `
                <h3>Position Details</h3>
                <p><strong>Company:</strong> cellcentric - Daimler Trucks & Volvo Group</p>
                <p><strong>Duration:</strong> Summer 2024</p>
                <p><strong>Location:</strong> Burnaby, BC</p>
                
                <h3>Key Responsibilities</h3>
                <ul>
                    <li>PLC Programming with Beckhoff TwinCAT</li>
                    <li>Industrial machine renovation and electrical panel construction</li>
                    <li>Maintenance of industrial infrastructure</li>
                </ul>
                
                <h3>Skills Developed</h3>
                <ul>
                    <li>Industrial automation systems</li>
                    <li>Electrical panel design and construction</li>
                    <li>Process optimization</li>
                    <li>Equipment troubleshooting</li>
                </ul>
            `
        },
        'experience-2023': {
            title: 'Hollyburn Country Club - Restaurant Assistant',
            content: `
                <h3>Position Details</h3>
                <p><strong>Company:</strong> Hollyburn Country Club</p>
                <p><strong>Duration:</strong> Summer 2023</p>
                <p><strong>Location:</strong> West Vancouver, BC</p>
                
                <h3>Responsibilities</h3>
                <ul>
                    <li>Customer service in high-end dining environment</li>
                    <li>Food preparation and kitchen assistance</li>
                    <li>Event support and catering services</li>
                    <li>Maintaining club standards and protocols</li>
                </ul>
            `
        },
        'education-2022': {
            title: 'Collingwood School - BC Dogwood Diploma',
            content: `
                <h3>Academic Achievement</h3>
                <p><strong>Diploma:</strong> BC Dogwood Diploma</p>
                <p><strong>Graduation:</strong> June 2022</p>
                <p><strong>GPA:</strong> 4.2 (A+)</p>
                <p><strong>Location:</strong> Vancouver, BC</p>
                
                <h3>Relevant Coursework</h3>
                <ul>
                    <li>AP Calculus AB</li>
                    <li>AP Physics 1</li>
                    <li>Advanced mathematics and sciences</li>
                </ul>
                
                <h3>Activities</h3>
                <ul>
                    <li>Senior soccer team</li>
                    <li>Senior rugby team</li>
                    <li>Senior basketball manager</li>
                </ul>
            `
        },
        'experience-2021': {
            title: 'Hollyburn Country Club - Restaurant Assistant',
            content: `
                <h3>Position Details</h3>
                <p><strong>Company:</strong> Hollyburn Country Club</p>
                <p><strong>Duration:</strong> Summer 2021</p>
                <p><strong>Location:</strong> West Vancouver, BC</p>
                
                <h3>Responsibilities</h3>
                <ul>
                    <li>Customer service in premium dining setting</li>
                    <li>Food service and presentation</li>
                    <li>Event coordination assistance</li>
                    <li>Maintaining high service standards</li>
                </ul>
            `
        },
        'experience-2020': {
            title: 'Lions Bay General Store - Retail Assistant',
            content: `
                <h3>Position Details</h3>
                <p><strong>Company:</strong> Lions Bay General Store</p>
                <p><strong>Duration:</strong> Summer 2020</p>
                <p><strong>Location:</strong> West Vancouver, BC</p>
                
                <h3>Responsibilities</h3>
                <ul>
                    <li>Customer service and sales</li>
                    <li>Inventory management</li>
                    <li>Cash handling and transactions</li>
                    <li>Store maintenance and organization</li>
                </ul>
            `
        },
        'experience-2019': {
            title: 'Trattoria Restaurant - Busser',
            content: `
                <h3>Position Details</h3>
                <p><strong>Company:</strong> Trattoria Restaurant</p>
                <p><strong>Duration:</strong> Summer 2018, 2019</p>
                <p><strong>Location:</strong> West Vancouver, BC</p>
                
                <h3>Responsibilities</h3>
                <ul>
                    <li>Table clearing and setup</li>
                    <li>Restaurant cleanliness and sanitation</li>
                    <li>Supporting wait staff</li>
                    <li>Customer service assistance</li>
                </ul>
            `
        }
    };

    /**
     * Skills relationships for highlighting related skills
     */
    const skillRelationships = {
        'Python': ['AI/Neural Networks', 'Game Design'],
        'Java': ['C/C++', 'Python'],
        'C/C++': ['Java', 'Python', 'Microprocessors'],
        'PLC Programming': ['Beckhoff Twincat', 'Ladder Logic', 'Industrial Automation', 'Electrical Drawings'],
        'Beckhoff Twincat': ['PLC Programming', 'Ladder Logic', 'Industrial Automation'],
        'Ladder Logic': ['PLC Programming', 'Beckhoff Twincat', 'Industrial Automation'],
        'Industrial Automation': ['PLC Programming', 'Beckhoff Twincat', 'Ladder Logic', 'Electrical Drawings'],
        'PCB Design': ['LTSpice', 'CAD', 'Solidworks'],
        'LTSpice': ['PCB Design', 'CAD'],
        'CAD': ['Solidworks', 'PCB Design'],
        'Solidworks': ['CAD', 'PCB Design'],
        'Microsoft Suite': ['Adobe Suite'],
        'Adobe Suite': ['Microsoft Suite'],
        'AI/Neural Networks': ['Python', 'Microprocessors'],
        'Microprocessors': ['C/C++', 'AI/Neural Networks'],
        'Game Design': ['Python', 'Java', 'C/C++']
    };

    /**
     * Initialize resume interactive features
     */
    function initResumeFeatures() {
        initTimelineInteractions();
        initSkillsGalaxy();
        initModal();
        animateTimelineItems();
    }

    /**
     * Initialize timeline interactions
     */
    function initTimelineInteractions() {
        const timelineItems = document.querySelectorAll('.timeline-item');
        
        timelineItems.forEach((item, index) => {
            // Add staggered animation delay
            item.style.animationDelay = `${index * 0.2}s`;
            
            // Add click event to timeline content
            const content = item.querySelector('.timeline-content');
            const node = item.querySelector('.timeline-node');
            const category = item.getAttribute('data-category');
            const year = item.getAttribute('data-year');
            const key = `${category}-${year}`;
            
            if (content && timelineDetails[key]) {
                content.addEventListener('click', () => {
                    showModal(timelineDetails[key].title, timelineDetails[key].content);
                });
                
                node.addEventListener('click', () => {
                    showModal(timelineDetails[key].title, timelineDetails[key].content);
                });
            }
        });
    }

    /**
     * Initialize skills galaxy with floating positions and interactions
     */
    function initSkillsGalaxy() {
        const skillNodes = document.querySelectorAll('.skill-node');
        const container = document.querySelector('.skills-galaxy');
        
        if (!container) return;
        
        // Position skills randomly in the galaxy on desktop
        if (window.innerWidth > 768) {
            skillNodes.forEach((node, index) => {
                // Generate positions using the current seed for consistency
                const angle = (index * 137.508) % 360; // Golden angle for good distribution
                const radius = 150 + (index % 3) * 80; // Varying distances from center
                const centerX = 50; // Center percentage
                const centerY = 50; // Center percentage
                
                const x = centerX + (Math.cos(angle * Math.PI / 180) * radius / container.offsetWidth * 100);
                const y = centerY + (Math.sin(angle * Math.PI / 180) * radius / container.offsetHeight * 100);
                
                // Ensure skills stay within bounds
                const clampedX = Math.max(5, Math.min(95, x));
                const clampedY = Math.max(5, Math.min(95, y));
                
                node.style.left = `${clampedX}%`;
                node.style.top = `${clampedY}%`;
                
                // Stagger animation delays
                node.style.animationDelay = `${index * 0.5}s`;
            });
        }
        
        // Add hover interactions for related skills
        skillNodes.forEach(node => {
            const skillName = node.getAttribute('data-skill');
            
            node.addEventListener('mouseenter', () => {
                highlightRelatedSkills(skillName);
            });
            
            node.addEventListener('mouseleave', () => {
                clearSkillHighlights();
            });
        });
    }

    /**
     * Highlight related skills when hovering over a skill
     */
    function highlightRelatedSkills(skillName) {
        const relatedSkills = skillRelationships[skillName] || [];
        const allSkills = document.querySelectorAll('.skill-node');
        
        allSkills.forEach(skill => {
            const currentSkill = skill.getAttribute('data-skill');
            if (relatedSkills.includes(currentSkill)) {
                skill.classList.add('related-highlight');
            }
        });
    }

    /**
     * Clear all skill highlights
     */
    function clearSkillHighlights() {
        const allSkills = document.querySelectorAll('.skill-node');
        allSkills.forEach(skill => {
            skill.classList.remove('related-highlight');
        });
    }

    /**
     * Initialize modal functionality
     */
    function initModal() {
        const modal = document.getElementById('detail-modal');
        const closeBtn = document.querySelector('.modal-close');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', hideModal);
        }
        
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    hideModal();
                }
            });
        }
        
        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                hideModal();
            }
        });
    }

    /**
     * Show modal with content
     */
    function showModal(title, content) {
        const modal = document.getElementById('detail-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        
        if (modal && modalTitle && modalBody) {
            modalTitle.textContent = title;
            modalBody.innerHTML = content;
            
            modal.style.display = 'flex';
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);
        }
    }

    /**
     * Hide modal
     */
    function hideModal() {
        const modal = document.getElementById('detail-modal');
        
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
    }

    /**
     * Animate timeline items on scroll
     */
    function animateTimelineItems() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        const timelineItems = document.querySelectorAll('.timeline-item');
        timelineItems.forEach(item => {
            observer.observe(item);
        });
    }

    /**
     * Handle responsive skills galaxy layout
     */
    function handleResponsiveSkills() {
        const skillNodes = document.querySelectorAll('.skill-node');
        const container = document.querySelector('.skills-galaxy');
        
        if (!container) return;
        
        if (window.innerWidth <= 768) {
            // Mobile layout - remove absolute positioning
            skillNodes.forEach(node => {
                node.style.position = 'static';
                node.style.left = 'auto';
                node.style.top = 'auto';
            });
        } else {
            // Desktop layout - restore absolute positioning
            skillNodes.forEach(node => {
                node.style.position = 'absolute';
            });
            initSkillsGalaxy(); // Re-initialize positions
        }
    }

    // Initialize resume features when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initResumeFeatures);
    } else {
        initResumeFeatures();
    }

    // Handle window resize for responsive skills
    window.addEventListener('resize', debounce(handleResponsiveSkills, 250));

    // --- Start the app ---
    init();
});
