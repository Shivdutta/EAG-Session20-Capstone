// Bouncing Balls Animation with Adjustable Mass

// Get the canvas element and its context
const canvas = document.createElement('canvas');
canvas.width = 800;
canvas.height = 400;
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');

// Ball properties
let ball = {
    x: 100,
    y: 50,
    radius: 20,
    mass: 1,
    velocity: 5,
    color: 'blue'
};

// Gravity
const gravity = 0.5;

// Function to draw the ball
function drawBall() {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = ball.color;
    ctx.fill();
    ctx.closePath();
}

// Function to update the ball's position and handle bouncing
function updateBall() {
    // Apply gravity
    ball.velocity += gravity;
    ball.y += ball.velocity;

    // Bounce off the bottom of the canvas
    if (ball.y + ball.radius > canvas.height) {
        ball.y = canvas.height - ball.radius;
        ball.velocity = -ball.velocity * 0.8; // Reduce velocity to simulate energy loss
    }

    // Bounce off the top of the canvas
    if (ball.y - ball.radius < 0) {
        ball.y = ball.radius;
        ball.velocity = -ball.velocity * 0.8; // Reduce velocity to simulate energy loss
    }

    // Bounce off the right of the canvas
    if (ball.x + ball.radius > canvas.width) {
        ball.x = canvas.width - ball.radius;
        ball.velocity = -ball.velocity * 0.8; // Reduce velocity to simulate energy loss
    }

    // Bounce off the left of the canvas
    if (ball.x - ball.radius < 0) {
        ball.x = ball.radius;
        ball.velocity = -ball.velocity * 0.8; // Reduce velocity to simulate energy loss
    }
}

// Animation loop
function animate() {
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update and draw the ball
    updateBall();
    drawBall();

    // Request the next frame
    requestAnimationFrame(animate);
}

// Start the animation
animate();

// Slider to adjust mass
const massSlider = document.createElement('input');
massSlider.type = 'range';
massSlider.min = 0.1;
massSlider.max = 5;
massSlider.step = 0.1;
massSlider.value = ball.mass;
document.body.appendChild(massSlider);

// Event listener for mass slider
massSlider.addEventListener('input', function() {
    ball.mass = parseFloat(this.value);
    console.log('Mass: ', ball.mass);
});
