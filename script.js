// Mobile Navigation Toggle
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

// Close mobile menu when clicking on a link
document.querySelectorAll('.nav-link').forEach(n => n.addEventListener('click', () => {
    hamburger.classList.remove('active');
    navMenu.classList.remove('active');
}));

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Parallax effect for floating elements
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const parallaxElements = document.querySelectorAll('.floating-element');
    
    parallaxElements.forEach(element => {
        const speed = element.getAttribute('data-speed');
        const yPos = -(scrolled * speed);
        element.style.transform = `translateY(${yPos}px)`;
    });
});

// Scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, observerOptions);

// Observe elements for scroll animations
document.addEventListener('DOMContentLoaded', () => {
    const fadeElements = document.querySelectorAll('.about, .current-role-section, .footer');
    fadeElements.forEach(el => {
        el.classList.add('fade-in');
        observer.observe(el);
    });
});

// Navbar background change on scroll
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 100) {
        navbar.style.background = 'rgba(10, 10, 10, 0.98)';
        navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.3)';
    } else {
        navbar.style.background = 'rgba(10, 10, 10, 0.95)';
        navbar.style.boxShadow = 'none';
    }
});

// Truck animation for about section
function initTruckAnimation() {
    const aboutSection = document.querySelector('.about');
    const truckBg = document.querySelector('.truck-animation-bg');
    
    if (!aboutSection || !truckBg) {
        console.log('Truck animation elements not found');
        return;
    }
    
    console.log('Initializing truck animation...');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                console.log('About section visible, triggering truck animation');
                
                // Add a small delay for dramatic effect
                setTimeout(() => {
                    truckBg.classList.add('animate');
                    console.log('Truck animation class added');
                    
                    // Add some extra visual effects
                    createTruckParticles();
                    
                    // Simulate truck sound effect with visual feedback
                    setTimeout(() => {
                        truckBg.style.filter = 'brightness(1.3)';
                        setTimeout(() => {
                            truckBg.style.filter = 'brightness(1)';
                        }, 300);
                    }, 1200);
                    
                }, 500);
                
                // Stop observing after animation triggers
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.2,
        rootMargin: '0px 0px -50px 0px'
    });
    
    observer.observe(aboutSection);
}

// Create particle effects for truck animation
function createTruckParticles() {
    const aboutSection = document.querySelector('.about');
    if (!aboutSection) return;
    
    console.log('Creating truck particles...');
    
    for (let i = 0; i < 30; i++) {
        setTimeout(() => {
            const particle = document.createElement('div');
            particle.className = 'truck-particle';
            particle.style.cssText = `
                position: absolute;
                width: ${Math.random() * 6 + 3}px;
                height: ${Math.random() * 6 + 3}px;
                background: ${Math.random() > 0.5 ? '#00d4ff' : '#ffffff'};
                border-radius: 50%;
                pointer-events: none;
                z-index: 10;
                left: ${Math.random() * 100}%;
                bottom: ${Math.random() * 30 + 10}%;
                animation: particleFloat ${Math.random() * 2 + 2}s ease-out forwards;
                box-shadow: 0 0 10px ${Math.random() > 0.5 ? '#00d4ff' : '#ffffff'};
            `;
            
            aboutSection.appendChild(particle);
            
            // Remove particle after animation
            setTimeout(() => {
                if (particle.parentNode) {
                    particle.parentNode.removeChild(particle);
                }
            }, 4000);
        }, i * 80);
    }
}

// Initialize truck animation when page loads
document.addEventListener('DOMContentLoaded', () => {
    initTruckAnimation();
    
    // Add interactive effects to company logos
    const logoItems = document.querySelectorAll('.logo-item');
    logoItems.forEach((logo, index) => {
        logo.addEventListener('mouseenter', () => {
            logo.style.transform = 'translateY(-10px) scale(1.1)';
            logo.style.filter = 'drop-shadow(0 10px 20px rgba(0, 212, 255, 0.3))';
        });
        
        logo.addEventListener('mouseleave', () => {
            logo.style.transform = 'translateY(0) scale(1)';
            logo.style.filter = 'none';
        });
        
        // Add staggered animation on page load
        setTimeout(() => {
            logo.style.opacity = '1';
            logo.style.transform = 'translateY(0)';
            logo.style.transition = 'all 0.8s ease-out';
        }, index * 300 + 1000);
    });
});

// Particle system for background
class Particle {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.size = Math.random() * 2 + 1;
        this.opacity = Math.random() * 0.5 + 0.2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > this.canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > this.canvas.height) this.vy *= -1;
    }

    draw() {
        this.ctx.save();
        this.ctx.globalAlpha = this.opacity;
        this.ctx.fillStyle = '#00d4ff';
        this.ctx.beginPath();
        this.ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }
}

// Initialize particle system
function initParticles() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '-2';
    canvas.style.pointerEvents = 'none';
    
    const heroBackground = document.querySelector('.hero-background');
    if (heroBackground) {
        heroBackground.appendChild(canvas);
    }

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const particles = [];
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle(canvas, ctx));
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });

        requestAnimationFrame(animate);
    }

    animate();
}

// Initialize particles when page loads
document.addEventListener('DOMContentLoaded', initParticles);

// Button hover effects
document.querySelectorAll('.btn').forEach(button => {
    button.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-3px) scale(1.05)';
    });
    
    button.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0) scale(1)';
    });
});

// Skill tag animations
document.querySelectorAll('.skill-tag').forEach(tag => {
    tag.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-3px) scale(1.1)';
    });
    
    tag.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0) scale(1)';
    });
});

// Profile card tilt effect
const profileCard = document.querySelector('.profile-card');
if (profileCard) {
    profileCard.addEventListener('mousemove', function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = (y - centerY) / 10;
        const rotateY = (centerX - x) / 10;
        
        this.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px)`;
    });
    
    profileCard.addEventListener('mouseleave', function() {
        this.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
    });
}

// Loading animation
window.addEventListener('load', () => {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.5s ease-in-out';
    
    setTimeout(() => {
        document.body.style.opacity = '1';
    }, 100);
});

// Cursor trail effect
class CursorTrail {
    constructor() {
        this.points = [];
        this.maxPoints = 20;
        this.init();
    }

    init() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '9999';
        
        document.body.appendChild(canvas);

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        document.addEventListener('mousemove', (e) => {
            this.points.push({
                x: e.clientX,
                y: e.clientY,
                timestamp: Date.now()
            });

            if (this.points.length > this.maxPoints) {
                this.points.shift();
            }
        });

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            this.points.forEach((point, index) => {
                const age = Date.now() - point.timestamp;
                const opacity = Math.max(0, 1 - age / 1000);
                const size = Math.max(0, 3 - age / 200);
                
                ctx.save();
                ctx.globalAlpha = opacity;
                ctx.fillStyle = '#00d4ff';
                ctx.beginPath();
                ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });

            requestAnimationFrame(animate.bind(this));
        }

        animate();
    }
}

// Initialize cursor trail (optional - can be disabled for performance)
// new CursorTrail();

// Console welcome message
console.log('%c🚀 Welcome to Jack Buhr\'s Portfolio!', 'color: #00d4ff; font-size: 20px; font-weight: bold;');
console.log('%c💡 Built with modern web technologies', 'color: #0099cc; font-size: 14px;'); 