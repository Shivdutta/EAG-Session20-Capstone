/*
 * Inelastic Collision in 1D Animation
 * Author: CoderAgent
 * Date: October 26, 2023
 * Description: This script creates an animation of an inelastic collision in one dimension,
 *              where two objects stick together after the collision.
 */

// Canvas setup
const canvas = document.createElement('canvas');
canvas.width = 800;
canvas.height = 400;
canvas.style.border = '1px solid black';
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');

// Simulation parameters
let mass1 = 2;
let mass2 = 1;
let velocity1 = 100;
let velocity2 = -50;
let object1X = 100;
let object2X = 600;
const objectSize = 50;

// Function to update the animation frame
function update() {
  // Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw objects
  ctx.fillStyle = 'blue';
  ctx.fillRect(object1X - objectSize / 2, canvas.height / 2 - objectSize / 2, objectSize, objectSize);

  ctx.fillStyle = 'red';
  ctx.fillRect(object2X - objectSize / 2, canvas.height / 2 - objectSize / 2, objectSize, objectSize);

  // Collision detection and handling
  if (object1X + objectSize / 2 >= object2X - objectSize / 2) {
    // Calculate combined velocity after collision
    const totalMomentum = mass1 * velocity1 + mass2 * velocity2;
    const combinedMass = mass1 + mass2;
    const finalVelocity = totalMomentum / combinedMass;

    // Update velocities to stick together
    velocity1 = finalVelocity;
    velocity2 = finalVelocity;

    // Prevent overlapping by setting object2 position to object1's edge
    object2X = object1X + objectSize;
  }

  // Update positions
  object1X += velocity1 / 60; // Divide by 60 to simulate movement per frame (assuming 60 FPS)
  object2X += velocity2 / 60;

  // Boundary conditions (reset positions if objects go off-screen)
  if (object1X < -objectSize) object1X = -objectSize;
  if (object2X > canvas.width + objectSize) object2X = canvas.width + objectSize;

  // Request the next frame
  requestAnimationFrame(update);
}

// Initial call to start the animation
update();

// ---- Slider controls ----

// Mass 1 Slider
const mass1Slider = document.createElement('input');
mass1Slider.type = 'range';
mass1Slider.min = 0.1;
mass1Slider.max = 5;
mass1Slider.step = 0.1;
mass1Slider.value = mass1;
document.body.appendChild(document.createTextNode('Mass 1: '));
document.body.appendChild(mass1Slider);
const mass1Value = document.createTextNode(mass1);
document.body.appendChild(mass1Value);

mass1Slider.addEventListener('input', function() {
  mass1 = parseFloat(this.value);
  mass1Value.nodeValue = mass1;
});

// Mass 2 Slider
const mass2Slider = document.createElement('input');
mass2Slider.type = 'range';
mass2Slider.min = 0.1;
mass2Slider.max = 5;
mass2Slider.step = 0.1;
mass2Slider.value = mass2;
document.body.appendChild(document.createTextNode('Mass 2: '));
document.body.appendChild(mass2Slider);
const mass2Value = document.createTextNode(mass2);
document.body.appendChild(mass2Value);

mass2Slider.addEventListener('input', function() {
  mass2 = parseFloat(this.value);
  mass2Value.nodeValue = mass2;
});

// Velocity 1 Slider
const velocity1Slider = document.createElement('input');
velocity1Slider.type = 'range';
velocity1Slider.min = -200;
velocity1Slider.max = 200;
velocity1Slider.step = 1;
velocity1Slider.value = velocity1;
document.body.appendChild(document.createTextNode('Velocity 1: '));
document.body.appendChild(velocity1Slider);
const velocity1Value = document.createTextNode(velocity1);
document.body.appendChild(velocity1Value);

velocity1Slider.addEventListener('input', function() {
  velocity1 = parseInt(this.value);
  velocity1Value.nodeValue = velocity1;
});

// Velocity 2 Slider
const velocity2Slider = document.createElement('input');
velocity2Slider.type = 'range';
velocity2Slider.min = -200;
velocity2Slider.max = 200;
velocity2Slider.step = 1;
velocity2Slider.value = velocity2;
document.body.appendChild(document.createTextNode('Velocity 2: '));
document.body.appendChild(velocity2Slider);
const velocity2Value = document.createTextNode(velocity2);
document.body.appendChild(velocity2Value);

velocity2Slider.addEventListener('input', function() {
  velocity2 = parseInt(this.value);
  velocity2Value.nodeValue = velocity2;
});

// Add some styling for better visibility
const sliders = document.querySelectorAll('input[type=range]');
sliders.forEach(slider => {
    slider.style.width = '200px';
    slider.style.margin = '10px';
});

document.body.style.fontFamily = 'Arial, sans-serif';
document.body.style.fontSize = '16px';

