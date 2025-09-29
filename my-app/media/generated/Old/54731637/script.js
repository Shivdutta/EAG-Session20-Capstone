document.addEventListener('DOMContentLoaded', () => {
    const board = document.getElementById('board');
    const cells = document.querySelectorAll('[data-cell]');
    const message = document.getElementById('message');
    let currentPlayer = 'X';
    let gameBoard = ['', '', '', '', '', '', '', '', ''];
    let gameActive = true;

    const winningCombinations = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    function checkWinner() {
        for (const combination of winningCombinations) {
            const [a, b, c] = combination;
            if (gameBoard[a] && gameBoard[a] === gameBoard[b] && gameBoard[a] === gameBoard[c]) {
                gameActive = false;
                return gameBoard[a];
            }
        }
        return null;
    }

    function checkDraw() {
        return !gameBoard.includes('') && gameActive;
    }

    function handleClick(cell, index) {
        if (gameBoard[index] === '' && gameActive) {
            gameBoard[index] = currentPlayer;
            cell.textContent = currentPlayer;
            cell.classList.add(currentPlayer);

            const winner = checkWinner();
            if (winner) {
                message.textContent = `Player ${winner} wins!`;
                return;
            }

            if (checkDraw()) {
                message.textContent = 'It\'s a draw!';
                return;
            }

            currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
            message.textContent = `Player ${currentPlayer}'s turn`;
        }
    }

    cells.forEach((cell, index) => {
        cell.addEventListener('click', () => handleClick(cell, index));
    });

    const resetButton = document.getElementById('resetButton');
    resetButton.addEventListener('click', resetGame);

    function resetGame() {
        gameBoard = ['', '', '', '', '', '', '', '', ''];
        gameActive = true;
        currentPlayer = 'X';
        message.textContent = `Player ${currentPlayer}'s turn`;
        cells.forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('X', 'O');
        });
    }

    message.textContent = `Player ${currentPlayer}'s turn`;

    
    // Scoreboard
    let scoreX = 0;
    let scoreO = 0;
    const scoreXElement = document.getElementById('scoreX');
    const scoreOElement = document.getElementById('scoreO');

    function updateScoreboard() {
        scoreXElement.textContent = `Player X: ${scoreX}`;
        scoreOElement.textContent = `Player O: ${scoreO}`;
    }

    // Computer AI
    function getBestMove() {
        let bestScore = -Infinity;
        let move;
        for (let i = 0; i < gameBoard.length; i++) {
            if (gameBoard[i] === '') {
                gameBoard[i] = 'O';
                let score = minimax(gameBoard, 0, false);
                gameBoard[i] = '';
                if (score > bestScore) {
                    bestScore = score;
                    move = i;
                }
            }
        }
        return move;
    }

    function minimax(board, depth, isMaximizing) {
        let scores = {
            'X': -1,
            'O': 1,
            'draw': 0
        };

        let result = checkWinner();
        if (result !== null) {
            return scores[result];
        }

        if (!board.includes('')) {
            return scores['draw'];
        }

        if (isMaximizing) {
            let bestScore = -Infinity;
            for (let i = 0; i < board.length; i++) {
                if (board[i] === '') {
                    board[i] = 'O';
                    let score = minimax(board, depth + 1, false);
                    board[i] = '';
                    bestScore = Math.max(score, bestScore);
                }
            }
            return bestScore;
        } else {
            let bestScore = Infinity;
            for (let i = 0; i < board.length; i++) {
                if (board[i] === '') {
                    board[i] = 'X';
                    let score = minimax(board, depth + 1, true);
                    board[i] = '';
                    bestScore = Math.min(score, bestScore);
                }
            }
            return bestScore;
        }
    }

    let vsComputer = false;
    const vsComputerButton = document.getElementById('vsComputerButton');
    vsComputerButton.addEventListener('click', () => {
        vsComputer = !vsComputer;
        vsComputerButton.textContent = vsComputer ? 'Playing vs Computer' : 'Playing vs Human';
        resetGame();
    });

    function handleClick(cell, index) {
        if (gameBoard[index] === '' && gameActive) {
            gameBoard[index] = currentPlayer;
            cell.textContent = currentPlayer;
            cell.classList.add(currentPlayer);

            const winner = checkWinner();
            if (winner) {
                message.textContent = `Player ${winner} wins!`;
                if (winner === 'X') {
                    scoreX++;
                } else {
                    scoreO++;
                }
                updateScoreboard();
                return;
            }

            if (checkDraw()) {
                message.textContent = 'It's a draw!';
                return;
            }

            currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
            message.textContent = `Player ${currentPlayer}'s turn`;

            if (vsComputer && currentPlayer === 'O' && gameActive) {
                setTimeout(() => {
                    const bestMove = getBestMove();
                    if (bestMove !== undefined) {
                        const computerCell = document.querySelector(`[data-cell="${bestMove}"]`);
                        handleClick(computerCell, bestMove);
                    }
                }, 500);
            }
        }
    }

    function resetGame() {
        gameBoard = ['', '', '', '', '', '', '', '', ''];
        gameActive = true;
        currentPlayer = 'X';
        message.textContent = `Player ${currentPlayer}'s turn`;
        cells.forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('X', 'O');
        });
        updateScoreboard();
    }
    updateScoreboard();

});