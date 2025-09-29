// Elastic Collision in 1D Animation

// Canvas setup
const canvas = document.createElement('canvas');
canvas.width = 800;
canvas.height = 400;
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');

// Simulation parameters
let ball1 = {
    x: 150,
    y: canvas.height / 2,
    radius: 20,
    mass: 1,
    velocity: 0.1,
    color: 'blue'
};

let ball2 = {
    x: 650,
    y: canvas.height / 2,
    radius: 20,
    mass: 1,
    velocity: -0.1,
    color: 'red'
};

// UI elements (sliders)
function createSlider(label, min, max, value, id) {
    const sliderContainer = document.createElement('div');
    sliderContainer.style.marginBottom = '10px';

    const labelElement = document.createElement('label');
    labelElement.textContent = label + ': '; 
    labelElement.setAttribute('for', id);
    sliderContainer.appendChild(labelElement);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min;
    slider.max = max;
    slider.value = value;
    slider.id = id;
    sliderContainer.appendChild(slider);

    const valueDisplay = document.createElement('span');
    valueDisplay.textContent = value;
    sliderContainer.appendChild(valueDisplay);

    slider.addEventListener('input', function() {
        valueDisplay.textContent = this.value;
    });

    document.body.appendChild(sliderContainer);
    return slider;
}

const mass1Slider = createSlider('Mass 1', 0.5, 5, ball1.mass, 'mass1Slider');
const mass2Slider = createSlider('Mass 2', 0.5, 5, ball2.mass, 'mass2Slider');
const velocity1Slider = createSlider('Velocity 1', -1, 1, ball1.velocity, 'velocity1Slider');
const velocity2Slider = createSlider('Velocity 2', -1, 1, ball2.velocity, 'velocity2Slider');


// Update parameters function
function updateParameters() {
    ball1.mass = parseFloat(mass1Slider.value);
    ball2.mass = parseFloat(mass2Slider.value);
    ball1.velocity = parseFloat(velocity1Slider.value);
    ball2.velocity = parseFloat(velocity2Slider.value);
}

// Elastic collision function
function elasticCollision(ball1, ball2) {
    let v1 = ball1.velocity;
    let v2 = ball2.velocity;
    let m1 = ball1.mass;
    let m2 = ball2.mass;

    ball1.velocity = ((m1 - m2) / (m1 + m2)) * v1 + ((2 * m2) / (m1 + m2)) * v2;
    ball2.velocity = ((2 * m1) / (m1 + m2)) * v1 + ((m2 - m1) / (m1 + m2)) * v2;
}

// Animation loop
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Read slider values each frame
    updateParameters();
    
    // Draw balls
    ctx.fillStyle = ball1.color;
    ctx.beginPath();
    ctx.arc(ball1.x, ball1.y, ball1.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = ball2.color;
    ctx.beginPath();
    ctx.arc(ball2.x, ball2.y, ball2.radius, 0, Math.PI * 2);
    ctx.fill();

    // Move balls
    ball1.x += ball1.velocity;
    ball2.x += ball2.velocity;

    // Collision detection
    if (Math.abs(ball1.x - ball2.x) < ball1.radius + ball2.radius) {
        elasticCollision(ball1, ball2);
    }
    
    // Bounce off walls
    if (ball1.x + ball1.radius > canvas.width || ball1.x - ball1.radius < 0) {
        ball1.velocity = -ball1.velocity;
    }
    if (ball2.x + ball2.radius > canvas.width || ball2.x - ball2.radius < 0) {
        ball2.velocity = -ball2.velocity;
    }

    requestAnimationFrame(animate);
}

// Start animation
animate();

// Basic styling for better presentation on projector
document.body.style.backgroundColor = '#f0f0f0';
document.body.style.fontFamily = 'Arial, sans-serif';
document.body.style.fontSize = '18px';
document.body.style.display = 'flex';
document.body.style.flexDirection = 'column';
document.body.style.alignItems = 'center';