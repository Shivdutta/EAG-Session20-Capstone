document.addEventListener('DOMContentLoaded', () => {
    const cells = document.querySelectorAll('.cell');
    const winnerMessage = document.getElementById('winnermessage');
    const restartButton = document.getElementById('restartButton');
    let currentPlayer = 'X';
    let gameBoard = ['', '', '', '', '', '', '', '', ''];
    let gameActive = true;

    const winningCombinations = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    function checkWinner() {
        for (let combination of winningCombinations) {
            const [a, b, c] = combination;
            if (gameBoard[a] && gameBoard[a] === gameBoard[b] && gameBoard[a] === gameBoard[c]) {
                gameActive = false;
                highlightWinningCells(a, b, c);
                winnerMessage.textContent = `Player ${gameBoard[a]} wins!`;
                winnerMessage.classList.remove('hidden');
                return;
            }
        }

        if (!gameBoard.includes('')) {
            gameActive = false;
            winnerMessage.textContent = 'It\'s a draw!';
            winnerMessage.classList.remove('hidden');
        }
    }

    function highlightWinningCells(a, b, c) {
        cells[a].classList.add('winning-cell');
        cells[b].classList.add('winning-cell');
        cells[c].classList.add('winning-cell');
        // WINNING_CELL_HIGHLIGHT_PLACEHOLDER
    }

    function cellClicked(index) {
        if (gameBoard[index] === '' && gameActive) {
            gameBoard[index] = currentPlayer;
            cells[index].classList.add(currentPlayer.toLowerCase());
            cells[index].textContent = currentPlayer;
            checkWinner();
            currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        }
    }

    function restartGame() {
        gameBoard = ['', '', '', '', '', '', '', '', ''];
        gameActive = true;
        currentPlayer = 'X';
        winnerMessage.classList.add('hidden');
        cells.forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('x', 'o', 'winning-cell');
        });
        // RESET_GAME_PLACEHOLDER
    }

    cells.forEach((cell, index) => {
        cell.addEventListener('click', () => cellClicked(index));
    });

    restartButton.addEventListener('click', restartGame);
});