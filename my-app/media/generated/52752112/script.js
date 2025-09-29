// JavaScript for animations
const rocketCards = document.querySelectorAll('.rocket-card');

rocketCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
        card.classList.add('hovered');
    });
    card.addEventListener('mouseleave', () => {
        card.classList.remove('hovered');
    });
});

// Parallax effect for the hero section
document.addEventListener('scroll', function() {
    const hero = document.querySelector('.hero');
    const scrollPosition = window.pageYOffset;

    hero.style.backgroundPositionY = -(scrollPosition * 0.2) + 'px';
});
