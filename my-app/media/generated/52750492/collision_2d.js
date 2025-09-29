// Collision 2D Animation

// Canvas setup
const canvas = document.createElement('canvas');
canvas.width = 800;
canvas.height = 600;
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');

// Styling for school projectors
document.body.style.backgroundColor = '#f0f0f0';
document.body.style.fontFamily = 'Arial, sans-serif';
document.body.style.fontSize = '16px';

// Object 1 properties
let mass1 = 50;
let velocityX1 = 5;
let velocityY1 = 0;
let angle1 = 30; // degrees
let x1 = 100;
let y1 = 300;
let radius1 = 20;

// Object 2 properties
let mass2 = 50;
let velocityX2 = -5;
let velocityY2 = 0;
let angle2 = 150; // degrees
let x2 = 700;
let y2 = 300;
let radius2 = 20;

// Function to convert degrees to radians
function degreesToRadians(degrees) {
    return degrees * Math.PI / 180;
}

// Function to draw a circle
function drawCircle(x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.closePath();
}

// Function to update object positions
function updatePositions() {
    // Convert angles to radians
    const angle1Rad = degreesToRadians(angle1);
    const angle2Rad = degreesToRadians(angle2);

    // Update velocities based on angles
    velocityX1 = Math.cos(angle1Rad) * 5; // Adjust speed as needed
    velocityY1 = Math.sin(angle1Rad) * 5;

    velocityX2 = Math.cos(angle2Rad) * 5; // Adjust speed as needed
    velocityY2 = Math.sin(angle2Rad) * 5;

    // Update positions
    x1 += velocityX1;
    y1 += velocityY1;

    x2 += velocityX2;
    y2 += velocityY2;

    // Bounce off the walls
    if (x1 + radius1 > canvas.width || x1 - radius1 < 0) {
        velocityX1 = -velocityX1;
    }
    if (y1 + radius1 > canvas.height || y1 - radius1 < 0) {
        velocityY1 = -velocityY1;
    }

        // Bounce off the walls
    if (x2 + radius2 > canvas.width || x2 - radius2 < 0) {
        velocityX2 = -velocityX2;
    }
    if (y2 + radius2 > canvas.height || y2 - radius2 < 0) {
        velocityY2 = -velocityY2;
    }

    // Collision detection
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < radius1 + radius2) {
        // Collision handling (basic momentum exchange)
        const v1x = velocityX1;
        const v1y = velocityY1;
        const v2x = velocityX2;
        const v2y = velocityY2;

        velocityX1 = ((mass1 - mass2) / (mass1 + mass2)) * v1x + ((2 * mass2) / (mass1 + mass2)) * v2x;
        velocityY1 = ((mass1 - mass2) / (mass1 + mass2)) * v1y + ((2 * mass2) / (mass1 + mass2)) * v2y;
        velocityX2 = ((2 * mass1) / (mass1 + mass2)) * v1x + ((mass2 - mass1) / (mass1 + mass2)) * v2x;
        velocityY2 = ((2 * mass1) / (mass1 + mass2)) * v1y + ((mass2 - mass1) / (mass1 + mass2)) * v2y;

        x1 += velocityX1;
        y1 += velocityY1;
        x2 += velocityX2;
        y2 += velocityY2;
    }
}

// Function to draw everything
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawCircle(x1, y1, radius1, 'blue');
    drawCircle(x2, y2, radius2, 'red');

    // Display object properties
    ctx.fillStyle = 'black';
    ctx.fillText(`Mass 1: ${mass1}`, 20, 20);
    ctx.fillText(`Angle 1: ${angle1}`, 20, 40);
    ctx.fillText(`Mass 2: ${mass2}`, 20, 60);
    ctx.fillText(`Angle 2: ${angle2}`, 20, 80);

    updatePositions();
    requestAnimationFrame(draw);
}

// Slider setup (example)
function createSlider(labelText, min, max, value, id, onChange) {
    const label = document.createElement('label');
    label.textContent = labelText + ': ';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min;
    slider.max = max;
    slider.value = value;
    slider.id = id;
    slider.addEventListener('input', onChange);
    document.body.appendChild(label);
    document.body.appendChild(slider);
}

// Example Sliders
createSlider('Mass 1', 10, 100, mass1, 'mass1Slider', function() {
    mass1 = parseInt(this.value);
});

createSlider('Angle 1', 0, 360, angle1, 'angle1Slider', function() {
    angle1 = parseInt(this.value);
});

createSlider('Mass 2', 10, 100, mass2, 'mass2Slider', function() {
    mass2 = parseInt(this.value);
});

createSlider('Angle 2', 0, 360, angle2, 'angle2Slider', function() {
    angle2 = parseInt(this.value);
});

// Start animation
draw();