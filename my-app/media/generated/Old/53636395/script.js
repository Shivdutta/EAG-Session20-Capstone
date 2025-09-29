// Tic Tac Toe Game Script

// Game state variables
let currentPlayer = 'X';
let gameBoard = ['', '', '', '', '', '', '', '', ''];
let gameActive = true;

// Winning conditions
const winningConditions = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
];

// Get HTML elements
const gameBoardElement = document.getElementById('gameboard');
const cells = document.querySelectorAll('.cell');
const messageElement = document.getElementById('message');

// Function to handle cell click
function handleCellClick(event) {
    const cellIndex = event.target.dataset.cellIndex;

    if (gameBoard[cellIndex] !== '' || !gameActive) {
        return;
    }

    // Update game board and cell display
    gameBoard[cellIndex] = currentPlayer;
    event.target.textContent = currentPlayer;
    event.target.classList.add(currentPlayer.toLowerCase()); // Add class for styling

    // Check for win or draw
    if (checkWin()) {
        displayMessage(`Player ${currentPlayer} wins!`);
        gameActive = false;
        return;
    }

    if (checkDraw()) {
        displayMessage('It\'s a draw!');
        gameActive = false;
        return;
    }

    // Switch player
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    displayMessage(`Player ${currentPlayer}'s turn`);
}

// Function to check for a win
function checkWin() {
    for (let i = 0; i < winningConditions.length; i++) {
        const [a, b, c] = winningConditions[i];
        if (gameBoard[a] && gameBoard[a] === gameBoard[b] && gameBoard[a] === gameBoard[c]) {
            return true;
        }
    }
    return false;
}

// Function to check for a draw
function checkDraw() {
    return !gameBoard.includes('');
}

// Function to display messages
function displayMessage(message) {
    messageElement.textContent = message;
}

// Add event listeners to cells
cells.forEach(cell => {
    cell.addEventListener('click', handleCellClick);
});

// Initial message display
displayMessage(`Player ${currentPlayer}'s turn`);

// Future updates:
// - Add reset button
// - Implement AI opponent
// - Improve styling