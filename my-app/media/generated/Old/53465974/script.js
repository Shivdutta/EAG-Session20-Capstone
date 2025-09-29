// Tic Tac Toe Game Logic

// Game variables
let currentPlayer = 'X';
let gameBoard = ['', '', '', '', '', '', '', '', ''];
let gameActive = true;
let moves = 0;

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

// Function to handle player turn
function handlePlayerTurn(cellIndex) {
    if (gameBoard[cellIndex] === '' && gameActive) {
        gameBoard[cellIndex] = currentPlayer;
        document.getElementById('cell-' + (cellIndex + 1)).innerText = currentPlayer;
        document.getElementById('cell-' + (cellIndex + 1)).classList.add('clicked'); // Update the cell
        moves++;
        checkWinner();
        switchPlayer();
    }
}

// Function to switch player turns
function switchPlayer() {
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    document.getElementById('player-turn').innerText = `Player ${currentPlayer}'s turn`; // Update the player turn display
}

// Function to check for a winner
function checkWinner() {
    for (let i = 0; i <= 7; i++) {
        const [a, b, c] = winningConditions[i];
        if (gameBoard[a] && gameBoard[a] === gameBoard[b] && gameBoard[a] === gameBoard[c]) {
            gameActive = false;
            document.getElementById('player-turn').innerText = `Player ${currentPlayer} wins!`; // Update the player turn display
            return;
        }
    }
    // Check for a draw
    if (moves === 9) {
        gameActive = false;
        document.getElementById('player-turn').innerText = 'It\'s a draw!'; // Update the player turn display
    }
}

// Add event listeners to each cell
for (let i = 1; i <= 9; i++) {
    document.getElementById('cell-' + i).addEventListener('click', () => {
    if (document.getElementById('cell-' + i).classList.contains('clicked')) {
        return;
    }
        handlePlayerTurn(i - 1);
    });
}

// Initialize the game on page load
function initializeGame() {
    currentPlayer = 'X';
    gameBoard = ['', '', '', '', '', '', '', '', ''];
    gameActive = true;
    moves = 0;
    document.getElementById('player-turn').innerText = `Player ${currentPlayer}'s turn`; // Initialize player turn display
    // Clear the board
    for (let i = 1; i <= 9; i++) {
        document.getElementById('cell-' + i).innerText = '';
    }
}

// Optionally, add a reset button
document.getElementById('reset-button').addEventListener('click', initializeGame);

initializeGame();

/*
//Add additional code here to improve game logic and functionality
// Add winner highlighting
// Add local storage for persistent game data.
*/