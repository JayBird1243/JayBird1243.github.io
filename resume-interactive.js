// Resume Interactive Features
document.addEventListener('DOMContentLoaded', function() {
    initializeSkillsNetwork();
    initializeExpandableCards();
});

// Skills Network with Static Plexus Layout and Interactive Highlighting
function initializeSkillsNetwork() {
    const svg = document.getElementById('skills-svg');
    const skillNodes = document.querySelectorAll('.skill-node');
    
    if (!svg || !skillNodes.length) return;
    
    // Define skill relationships for connection highlighting
    const skillConnections = {
        'python': ['java', 'cpp', 'git'],
        'java': ['python', 'cpp', 'git'],
        'cpp': ['python', 'java', 'git'],
        'pcb': ['ltspice', 'cad', 'solidworks', 'electrical'],
        'ltspice': ['pcb', 'electrical'],
        'cad': ['pcb', 'solidworks'],
        'solidworks': ['pcb', 'cad'],
        'plc': ['twincat', 'ladder', 'industrial', 'electrical'],
        'twincat': ['plc', 'ladder', 'industrial'],
        'ladder': ['plc', 'twincat', 'industrial'],
        'industrial': ['plc', 'twincat', 'ladder', 'electrical'],
        'electrical': ['plc', 'industrial', 'pcb', 'ltspice'],
        'git': ['python', 'java', 'cpp'],
        'microsoft': ['google', 'adobe'],
        'adobe': ['microsoft', 'google'],
        'google': ['microsoft', 'adobe']
    };
    
    // Create connection lines
    function createConnections() {
        svg.innerHTML = ''; // Clear existing connections
        
        const svgRect = svg.getBoundingClientRect();
        const containerRect = svg.parentElement.getBoundingClientRect();
        
        skillNodes.forEach(node => {
            const skill = node.dataset.skill;
            const connections = skillConnections[skill] || [];
            
            connections.forEach(connectedSkill => {
                const connectedNode = document.querySelector(`[data-skill="${connectedSkill}"]`);
                if (connectedNode) {
                    const line = createConnectionLine(node, connectedNode, containerRect);
                    if (line) {
                        line.classList.add('skill-connection');
                        line.dataset.from = skill;
                        line.dataset.to = connectedSkill;
                        svg.appendChild(line);
                    }
                }
            });
        });
    }
    
    function createConnectionLine(node1, node2, containerRect) {
        const rect1 = node1.getBoundingClientRect();
        const rect2 = node2.getBoundingClientRect();
        
        const x1 = rect1.left + rect1.width / 2 - containerRect.left;
        const y1 = rect1.top + rect1.height / 2 - containerRect.top;
        const x2 = rect2.left + rect2.width / 2 - containerRect.left;
        const y2 = rect2.top + rect2.height / 2 - containerRect.top;
        
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        
        return line;
    }
    
    // Add hover interactions
    skillNodes.forEach(node => {
        node.addEventListener('mouseenter', function() {
            const skill = this.dataset.skill;
            const connections = skillConnections[skill] || [];
            
            // Highlight connected skills
            connections.forEach(connectedSkill => {
                const connectedNode = document.querySelector(`[data-skill="${connectedSkill}"]`);
                if (connectedNode) {
                    connectedNode.classList.add('highlighted');
                }
            });
            
            // Highlight connection lines
            const lines = svg.querySelectorAll('.skill-connection');
            lines.forEach(line => {
                if (line.dataset.from === skill || line.dataset.to === skill) {
                    line.classList.add('active');
                }
            });
        });
        
        node.addEventListener('mouseleave', function() {
            // Remove all highlights
            skillNodes.forEach(n => n.classList.remove('highlighted'));
            const lines = svg.querySelectorAll('.skill-connection');
            lines.forEach(line => line.classList.remove('active'));
        });
    });
    
    // Initialize connections
    createConnections();
    
    // Recreate connections on window resize
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(createConnections, 250);
    });
}

// Expandable Cards for Education and Experience
function initializeExpandableCards() {
    // Education cards
    const educationCards = document.querySelectorAll('.education-card');
    educationCards.forEach(card => {
        card.addEventListener('click', function() {
            const isExpanded = this.classList.contains('expanded');
            
            // Close all other education cards
            educationCards.forEach(c => c.classList.remove('expanded'));
            
            // Toggle current card
            if (!isExpanded) {
                this.classList.add('expanded');
                
                // Smooth scroll to show expanded content
                setTimeout(() => {
                    const detailsElement = this.querySelector('.education-details');
                    if (detailsElement) {
                        detailsElement.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'nearest' 
                        });
                    }
                }, 200);
            }
        });
    });
    
    // Technical experience card
    const experienceCards = document.querySelectorAll('.experience-card');
    experienceCards.forEach(card => {
        card.addEventListener('click', function() {
            const isExpanded = this.classList.contains('expanded');
            
            // Close all other experience cards
            experienceCards.forEach(c => c.classList.remove('expanded'));
            
            // Toggle current card
            if (!isExpanded) {
                this.classList.add('expanded');
                
                // Smooth scroll to show expanded content
                setTimeout(() => {
                    const detailsElement = this.querySelector('.experience-details');
                    if (detailsElement) {
                        detailsElement.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'nearest' 
                        });
                    }
                }, 200);
            }
        });
    });
    
    // Add keyboard navigation
    [...educationCards, ...experienceCards].forEach(card => {
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        card.setAttribute('aria-expanded', 'false');
        
        card.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
            }
        });
        
        // Update aria-expanded when toggled
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const isExpanded = mutation.target.classList.contains('expanded');
                    mutation.target.setAttribute('aria-expanded', isExpanded.toString());
                }
            });
        });
        
        observer.observe(card, { attributes: true });
    });
}

// Add smooth animations and enhanced interactions
document.addEventListener('DOMContentLoaded', function() {
    // Add intersection observer for fade-in animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe all content boxes for animation
    const contentBoxes = document.querySelectorAll('.content-box');
    contentBoxes.forEach(box => {
        box.style.opacity = '0';
        box.style.transform = 'translateY(20px)';
        box.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(box);
    });
    
    // Add hover effects to misc job cards
    const miscJobCards = document.querySelectorAll('.misc-job-card');
    miscJobCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    // Enhanced contact link interactions
    const contactLinks = document.querySelectorAll('.contact-link');
    contactLinks.forEach(link => {
        link.addEventListener('mouseenter', function() {
            this.style.transform = 'translateX(5px)';
        });
        
        link.addEventListener('mouseleave', function() {
            this.style.transform = 'translateX(0)';
        });
    });
});
