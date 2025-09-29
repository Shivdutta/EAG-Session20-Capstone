// script.js

document.addEventListener('DOMContentLoaded', () => {
    const gameboard = document.getElementById('gameboard');
    const cells = document.querySelectorAll('.cell');
    let currentPlayer = 'X';
    let gameActive = true;
    let gameState = ['', '', '', '', '', '', '', '', ''];

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

    function handleCellClick(clickedCellEvent) {
        const clickedCell = clickedCellEvent.target;
        const clickedCellIndex = parseInt(clickedCell.dataset.cellIndex);

        if (gameState[clickedCellIndex] !== '' || !gameActive) {
            return;
        }

        handleMove(clickedCell, clickedCellIndex);
        checkWin();
        checkDraw();
    }

    function handleMove(clickedCell, clickedCellIndex) {
        gameState[clickedCellIndex] = currentPlayer;
        clickedCell.textContent = currentPlayer;
        clickedCell.classList.add(currentPlayer.toLowerCase());
    }

    function switchPlayer() {
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    }

    function checkWin() {
        let roundWon = false;
        for (let i = 0; i <= 7; i++) {
            const winCondition = winningConditions[i];
            const a = gameState[winCondition[0]];
            const b = gameState[winCondition[1]];
            const c = gameState[winCondition[2]];
            if (a === '' || b === '' || c === '') {
                continue;
            }
            if (a === b && b === c) {
                roundWon = true;
                break;
            }
        }

        if (roundWon) {
            announceWinner(currentPlayer);
            gameActive = false;
            return;
        }

        switchPlayer();
    }

    function checkDraw() {
        let roundDraw = !gameState.includes("");
        if (roundDraw) {
            announceDraw();
            gameActive = false;
            return;
        }
    }

    const winningMessage = () => `Player ${currentPlayer} won!`;
    const drawMessage = () => `Game ended in a draw!`;
    const currentPlayerTurn = () => `It's ${currentPlayer}'s turn`;

    function announceWinner(winner) {
        alert(winningMessage());
    }

    function announceDraw() {
        alert(drawMessage());
    }

    cells.forEach(cell => {
        cell.addEventListener('click', handleCellClick);
    });
});