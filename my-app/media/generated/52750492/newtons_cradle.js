/**
 * Newton's Cradle Animation using HTML Canvas
 */

// Canvas setup
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 400;
canvas.style.background = '#f0f0f0'; // Light background
document.body.appendChild(canvas);

// Cradle parameters
const numBalls = 5;
const ballRadius = 20;
const stringLength = 150;
const initialX = canvas.width / 2 - (numBalls * ballRadius);
const initialY = canvas.height / 2;
const balls = [];
const gravity = 0.8;
const damping = 0.9;

// Ball class
class Ball {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.velocity = 0;
        this.angle = 0; // Angle from the vertical
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#3498db'; // Blue color for balls
        ctx.fill();
        ctx.closePath();
    }

    update() {
        // Simplified pendulum motion
        this.angle += this.velocity;
        this.velocity += -gravity / stringLength * Math.sin(this.angle);
        this.velocity *= damping;

        this.x = initialX + (balls.indexOf(this) * ballRadius * 2) + stringLength * Math.sin(this.angle);
        this.y = initialY + stringLength * Math.cos(this.angle);
    }
}

// Initialize balls
for (let i = 0; i < numBalls; i++) {
    balls.push(new Ball(initialX + (i * ballRadius * 2), initialY, ballRadius));
}

// Function to set initial impulse (lifting the first ball)
function setInitialImpulse() {
    balls[0].angle = -Math.PI / 4; // Lift the first ball by 45 degrees
}

// Animation loop
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    balls.forEach(ball => {
        ball.update();
        ball.draw();
    });

    requestAnimationFrame(animate);
}

// Start animation
animate();

// Set initial impulse after a short delay
setTimeout(setInitialImpulse, 1000); // Lift the first ball after 1 second

// Optional: Add mouse interaction to lift balls
canvas.addEventListener('mousedown', function(event) {
    const mouseX = event.clientX - canvas.offsetLeft;
    const mouseY = event.clientY - canvas.offsetTop;

    balls.forEach(ball => {
        const distance = Math.sqrt((mouseX - ball.x) ** 2 + (mouseY - ball.y) ** 2);
        if (distance < ball.radius) {
            ball.angle = -Math.PI / 4; // Lift the ball
        }
    });
});