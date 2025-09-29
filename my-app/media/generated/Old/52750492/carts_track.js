// Carts on a Frictionless Track with Spring Bumpers Animation

// Get canvas element and context
const canvas = document.getElementById('cartsCanvas');
const ctx = canvas.getContext('2d');

// Cart properties
let cart1 = { mass: 1, velocity: 1, position: 50, color: 'blue' };
let cart2 = { mass: 1, velocity: 0, position: 350, color: 'red' };
const cartWidth = 50;
const cartHeight = 30;

// Spring properties
const springConstant = 0.1; // Adjust for spring stiffness
const dampingFactor = 0.01;  // Adjust for damping
let springLength = 100;   // Equilibrium length of the spring

// Track properties
const trackStart = 20;
const trackEnd = canvas.width - 20;
const trackY = canvas.height / 2;

// Animation variables
let animationFrameId;

// Function to draw the track
function drawTrack() {
    ctx.beginPath();
    ctx.moveTo(trackStart, trackY);
    ctx.lineTo(trackEnd, trackY);
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.stroke();
}

// Function to draw a cart
function drawCart(cart) {
    ctx.fillStyle = cart.color;
    ctx.fillRect(cart.position - cartWidth / 2, trackY - cartHeight / 2, cartWidth, cartHeight);
}

// Function to update cart positions and handle collisions
function updateCarts() {
    // Update positions based on velocities
    cart1.position += cart1.velocity;
    cart2.position += cart2.velocity;

    // Calculate distance between carts
    const distance = cart2.position - cart1.position;

    // Check for collision
    if (distance < springLength) {
        // Calculate spring force
        const springForce = springConstant * (springLength - distance);

        // Apply forces to carts (Newton's Third Law)
        const force1 = springForce - dampingFactor * (cart1.velocity - cart2.velocity);
        const force2 = -springForce - dampingFactor * (cart2.velocity - cart1.velocity);

        // Update velocities based on forces (F = ma => a = F/m)
        cart1.velocity += force1 / cart1.mass;
        cart2.velocity += force2 / cart2.mass;

        // Ensure carts don't overlap significantly (basic overlap prevention)
        const overlap = springLength - distance;
        if (overlap > 0) {
          const adjust = overlap / 2;
          cart1.position -= adjust * 0.1;
          cart2.position += adjust * 0.1;
        }

    }

    // Boundary conditions (carts bounce off the ends of the track)
    if (cart1.position - cartWidth / 2 < trackStart) {
        cart1.position = trackStart + cartWidth / 2;
        cart1.velocity *= -0.8; // Inelastic collision with track end
    }
    if (cart2.position + cartWidth / 2 > trackEnd) {
        cart2.position = trackEnd - cartWidth / 2;
        cart2.velocity *= -0.8; // Inelastic collision with track end
    }
}

// Function to draw everything on the canvas
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawTrack();
    drawCart(cart1);
    drawCart(cart2);
    updateCarts();

    animationFrameId = requestAnimationFrame(draw);
}

// Start the animation
draw();

// Function to stop the animation
function stopAnimation() {
    cancelAnimationFrame(animationFrameId);
}

// Add event listeners for slider changes (assuming sliders with these IDs exist)
document.getElementById('cart1Mass').addEventListener('input', function() {
    cart1.mass = parseFloat(this.value);
});

document.getElementById('cart1Velocity').addEventListener('input', function() {
    cart1.velocity = parseFloat(this.value);
});

document.getElementById('cart2Mass').addEventListener('input', function() {
    cart2.mass = parseFloat(this.value);
});

document.getElementById('cart2Velocity').addEventListener('input', function() {
    cart2.velocity = parseFloat(this.value);
});


// Example HTML integration (assuming this JS is linked in HTML with canvas and sliders):
/*
<canvas id="cartsCanvas" width="600" height="400"></canvas>

<div>
    <label for="cart1Mass">Cart 1 Mass:</label>
    <input type="range" id="cart1Mass" min="0.5" max="5" value="1" step="0.1">
    <span id="cart1MassValue">1</span>
</div>

<div>
    <label for="cart1Velocity">Cart 1 Velocity:</label>
    <input type="range" id="cart1Velocity" min="-2" max="2" value="1" step="0.1">
    <span id="cart1VelocityValue">1</span>
</div>

<div>
    <label for="cart2Mass">Cart 2 Mass:</label>
    <input type="range" id="cart2Mass" min="0.5" max="5" value="1" step="0.1">
    <span id="cart2MassValue">1</span>
</div>

<div>
    <label for="cart2Velocity">Cart 2 Velocity:</label>
    <input type="range" id="cart2Velocity" min="-2" max="2" value="0" step="0.1">
    <span id="cart2VelocityValue">0</span>
</div>
*/