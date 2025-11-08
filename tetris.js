const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const LINES_PER_LEVEL = 10;
const LEVEL_SPEED = 80;

const SHAPES = {
    I: [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
    ],
    J: [
        [2, 0, 0],
        [2, 2, 2],
        [0, 0, 0],
    ],
    L: [
        [0, 0, 3],
        [3, 3, 3],
        [0, 0, 0],
    ],
    O: [
        [4, 4],
        [4, 4],
    ],
    S: [
        [0, 5, 5],
        [5, 5, 0],
        [0, 0, 0],
    ],
    T: [
        [0, 6, 0],
        [6, 6, 6],
        [0, 0, 0],
    ],
    Z: [
        [7, 7, 0],
        [0, 7, 7],
        [0, 0, 0],
    ],
};

const COLORS = {
    0: null,
    1: '#00f6ff',
    2: '#0055ff',
    3: '#ff9500',
    4: '#ffe347',
    5: '#2ecc71',
    6: '#bf5af2',
    7: '#ff5d5d',
};

class TetrisGame {
    constructor(canvas, nextCanvas, overlay) {
        this.canvas = canvas;
        this.context = canvas.getContext('2d');
        this.context.scale(BLOCK_SIZE, BLOCK_SIZE);

        this.nextCanvas = nextCanvas;
        this.nextContext = nextCanvas.getContext('2d');
        this.nextScale = BLOCK_SIZE / 2;
        this.nextContext.scale(this.nextScale, this.nextScale);

        this.overlay = overlay;

        this.board = this.createMatrix(COLS, ROWS);
        this.player = {
            pos: { x: 0, y: 0 },
            matrix: null,
            score: 0,
            lines: 0,
            level: 1,
            queue: [],
        };

        this.dropCounter = 0;
        this.dropInterval = 1000;
        this.lastTime = 0;
        this.running = false;

        this.addEventListeners();
        this.reset();
    }

    createMatrix(w, h) {
        return Array.from({ length: h }, () => Array(w).fill(0));
    }

    createPiece(type) {
        const shape = SHAPES[type];
        return shape.map(row => row.slice());
    }

    createQueue() {
        const pieces = Object.keys(SHAPES);
        const bag = [];
        while (bag.length < pieces.length) {
            const idx = Math.floor(Math.random() * pieces.length);
            const piece = pieces[idx];
            if (!bag.includes(piece)) {
                bag.push(piece);
            }
        }
        return bag;
    }

    refillQueue() {
        while (this.player.queue.length < 5) {
            const bag = this.createQueue();
            this.player.queue.push(...bag);
        }
    }

    getNextPiece() {
        this.refillQueue();
        const type = this.player.queue.shift();
        return this.createPiece(type);
    }

    collide(board, player) {
        const [m, o] = [player.matrix, player.pos];
        for (let y = 0; y < m.length; ++y) {
            for (let x = 0; x < m[y].length; ++x) {
                if (m[y][x] !== 0 && (board[y + o.y] && board[y + o.y][x + o.x]) !== 0) {
                    return true;
                }
            }
        }
        return false;
    }

    merge(board, player) {
        player.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    board[y + player.pos.y][x + player.pos.x] = value;
                }
            });
        });
    }

    rotate(matrix, dir) {
        for (let y = 0; y < matrix.length; ++y) {
            for (let x = 0; x < y; ++x) {
                [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
            }
        }
        if (dir > 0) {
            matrix.forEach(row => row.reverse());
        } else {
            matrix.reverse();
        }
    }

    playerReset() {
        this.player.matrix = this.getNextPiece();
        this.player.pos.y = 0;
        this.player.pos.x = Math.floor((COLS - this.player.matrix[0].length) / 2);
        if (this.collide(this.board, this.player)) {
            this.running = false;
            this.overlay.classList.remove('hidden');
        }
        this.updateNextPreview();
    }

    playerDrop() {
        this.player.pos.y++;
        if (this.collide(this.board, this.player)) {
            this.player.pos.y--;
            this.merge(this.board, this.player);
            this.sweep();
            this.playerReset();
            this.updateScore();
        }
        this.dropCounter = 0;
    }

    hardDrop() {
        while (!this.collide(this.board, this.player)) {
            this.player.pos.y++;
        }
        this.player.pos.y--;
        this.merge(this.board, this.player);
        this.sweep();
        this.playerReset();
        this.updateScore();
        this.dropCounter = 0;
    }

    sweep() {
        let rowCount = 0;
        outer: for (let y = this.board.length - 1; y >= 0; --y) {
            for (let x = 0; x < this.board[y].length; ++x) {
                if (this.board[y][x] === 0) {
                    continue outer;
                }
            }
            const row = this.board.splice(y, 1)[0].fill(0);
            this.board.unshift(row);
            ++y;
            rowCount++;
        }
        if (rowCount > 0) {
            const scores = [0, 40, 100, 300, 1200];
            this.player.score += scores[rowCount] * this.player.level;
            this.player.lines += rowCount;
            const newLevel = Math.floor(this.player.lines / LINES_PER_LEVEL) + 1;
            if (newLevel !== this.player.level) {
                this.player.level = newLevel;
                const speed = Math.max(120, 1000 - (this.player.level - 1) * LEVEL_SPEED);
                this.dropInterval = speed;
            }
        }
    }

    drawMatrix(matrix, offset, context = this.context) {
        matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    context.fillStyle = COLORS[value];
                    context.fillRect(x + offset.x, y + offset.y, 1, 1);
                    context.strokeStyle = 'rgba(0, 0, 0, 0.25)';
                    context.lineWidth = 0.05;
                    context.strokeRect(x + offset.x, y + offset.y, 1, 1);
                }
            });
        });
    }

    draw() {
        this.context.fillStyle = 'rgba(5, 7, 15, 0.9)';
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawMatrix(this.board, { x: 0, y: 0 });
        this.drawMatrix(this.player.matrix, this.player.pos);
    }

    update(time = 0) {
        if (!this.running) {
            return;
        }
        const deltaTime = time - this.lastTime;
        this.lastTime = time;

        this.dropCounter += deltaTime;
        if (this.dropCounter > this.dropInterval) {
            this.playerDrop();
        }

        this.draw();
        requestAnimationFrame(this.update.bind(this));
    }

    updateScore() {
        document.getElementById('score').textContent = this.player.score.toLocaleString();
        document.getElementById('level').textContent = this.player.level.toString();
        document.getElementById('lines').textContent = this.player.lines.toString();
    }

    updateNextPreview() {
        this.refillQueue();
        this.nextContext.clearRect(0, 0, this.nextCanvas.width / this.nextScale, this.nextCanvas.height / this.nextScale);
        const previewMatrix = this.createPiece(this.player.queue[0]);
        const offset = {
            x: Math.floor((4 - previewMatrix[0].length) / 2) + 0.5,
            y: Math.floor((4 - previewMatrix.length) / 2) + 0.5,
        };
        this.drawMatrix(previewMatrix, offset, this.nextContext);
    }

    addEventListeners() {
        document.addEventListener('keydown', (event) => {
            if (!this.running) {
                return;
            }
            if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Space', 'q', 'Q', 'e', 'E'].includes(event.key)) {
                event.preventDefault();
            }
            switch (event.key) {
                case 'ArrowLeft':
                    this.move(-1);
                    break;
                case 'ArrowRight':
                    this.move(1);
                    break;
                case 'ArrowDown':
                    this.playerDrop();
                    break;
                case 'ArrowUp':
                case 'e':
                case 'E':
                    this.playerRotate(1);
                    break;
                case 'q':
                case 'Q':
                    this.playerRotate(-1);
                    break;
                case ' ':
                case 'Space':
                    this.hardDrop();
                    break;
                default:
                    break;
            }
        });

        document.getElementById('restart').addEventListener('click', () => this.reset());
    }

    move(dir) {
        this.player.pos.x += dir;
        if (this.collide(this.board, this.player)) {
            this.player.pos.x -= dir;
        }
    }

    playerRotate(dir) {
        const pos = this.player.pos.x;
        let offset = 1;
        this.rotate(this.player.matrix, dir);
        while (this.collide(this.board, this.player)) {
            this.player.pos.x += offset;
            offset = -(offset + (offset > 0 ? 1 : -1));
            if (offset > this.player.matrix[0].length) {
                this.rotate(this.player.matrix, -dir);
                this.player.pos.x = pos;
                return;
            }
        }
    }

    reset() {
        this.board = this.createMatrix(COLS, ROWS);
        this.player.score = 0;
        this.player.lines = 0;
        this.player.level = 1;
        this.player.queue.length = 0;
        this.dropInterval = 1000;
        this.overlay.classList.add('hidden');
        this.running = true;
        this.playerReset();
        this.updateScore();
        this.lastTime = 0;
        this.dropCounter = 0;
        this.draw();
        requestAnimationFrame(this.update.bind(this));
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('tetris');
    const nextCanvas = document.getElementById('next');
    const overlay = document.getElementById('overlay');
    new TetrisGame(canvas, nextCanvas, overlay);
});
