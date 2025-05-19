// Game constants
const MAZE_WIDTH = 800;
const MAZE_HEIGHT = 600;
const CELL_SIZE = 20;
const PLAYER_SIZE = 15;
const PLAYER_COLOR = '#3498db';
const WALL_COLOR = '#2c3e50';
const PATH_COLOR = '#111';
const TARGET_COLOR = '#f1c40f';
const TARGET_HIDDEN_COLOR = '#111';
const state = {
    maze: [],
    player: { x: 0, y: 0, vx: 0, vy: 0 },
    target: { x: 0, y: 0 },
    targetFound: false,
    level: 1,
    currentTime: 0,
    bestTime: Infinity,
    timer: null,
    lastTimestamp: 0,
    gyroAvailable: false,
    gyroCalibration: { x: 0, y: 0 }
};
// DOM elements
const canvas = document.getElementById('maze');
const ctx = canvas.getContext('2d');
const levelElement = document.getElementById('level');
const timeElement = document.getElementById('time');
const bestElement = document.getElementById('best');
const calibrateButton = document.getElementById('calibrate');
// Initialize game
function initGame() {
    // Check for gyro support
    if (window.DeviceOrientationEvent) {
        state.gyroAvailable = true;
        window.addEventListener('deviceorientation', handleDeviceOrientation);
    }
    else {
        calibrateButton.style.display = 'none';
    }
    calibrateButton.addEventListener('click', calibrateGyro);
    // Keyboard controls
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    generateMaze();
    drawMaze();
    // Start game loop
    state.timer = requestAnimationFrame(gameLoop);
}
function generateMaze() {
    const cols = Math.floor(MAZE_WIDTH / CELL_SIZE);
    const rows = Math.floor(MAZE_HEIGHT / CELL_SIZE);
    // Initialize maze with all walls
    state.maze = Array(rows).fill(null).map(() => Array(cols).fill(true));
    // Create paths
    const stack = [];
    const startX = Math.floor(Math.random() * cols);
    const startY = Math.floor(Math.random() * rows);
    stack.push([startY, startX]);
    state.maze[startY][startX] = false;
    while (stack.length > 0) {
        const [y, x] = stack[stack.length - 1];
        const directions = [
            [1, 0], [-1, 0], [0, 1], [0, -1]
        ].sort(() => Math.random() - 0.5);
        let moved = false;
        for (const [dy, dx] of directions) {
            const ny = y + dy * 2;
            const nx = x + dx * 2;
            if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && state.maze[ny][nx]) {
                state.maze[y + dy][x + dx] = false;
                state.maze[ny][nx] = false;
                stack.push([ny, nx]);
                moved = true;
                break;
            }
        }
        if (!moved) {
            stack.pop();
        }
    }
    // Place player in center
    //state.player.x = Math.floor(cols / 2) * CELL_SIZE + CELL_SIZE / 2;
    //state.player.y = Math.floor(rows / 2) * CELL_SIZE + CELL_SIZE / 2;
    placePlayer();
    // Place target in random position
    placeTarget();
    state.targetFound = false;
    state.player.vx = 0;
    state.player.vy = 0;
}
function placePlayer() {
    const cols = Math.floor(MAZE_WIDTH / CELL_SIZE);
    const rows = Math.floor(MAZE_HEIGHT / CELL_SIZE);
    // Find all open spots in the center area (25% of maze around center)
    const centerX = Math.floor(cols / 2);
    const centerY = Math.floor(rows / 2);
    const radius = Math.floor(Math.min(cols, rows) * 0.25);
    const openSpots = [];
    for (let y = Math.max(1, centerY - radius); y <= Math.min(rows - 2, centerY + radius); y++) {
        for (let x = Math.max(1, centerX - radius); x <= Math.min(cols - 2, centerX + radius); x++) {
            // Check if this cell and its neighbors are open
            if (!state.maze[y][x] &&
                !state.maze[y - 1][x] &&
                !state.maze[y + 1][x] &&
                !state.maze[y][x - 1] &&
                !state.maze[y][x + 1]) {
                openSpots.push({
                    x: x * CELL_SIZE + CELL_SIZE / 2,
                    y: y * CELL_SIZE + CELL_SIZE / 2
                });
            }
        }
    }
    // If we found good spots in center, pick one randomly
    if (openSpots.length > 0) {
        const spot = openSpots[Math.floor(Math.random() * openSpots.length)];
        state.player.x = spot.x;
        state.player.y = spot.y;
        return;
    }
    // Fallback: Search the entire maze for any open spot
    for (let y = 1; y < rows - 1; y++) {
        for (let x = 1; x < cols - 1; x++) {
            if (!state.maze[y][x]) {
                state.player.x = x * CELL_SIZE + CELL_SIZE / 2;
                state.player.y = y * CELL_SIZE + CELL_SIZE / 2;
                return;
            }
        }
    }
    // Ultimate fallback (should never happen)
    state.player.x = CELL_SIZE + CELL_SIZE / 2;
    state.player.y = CELL_SIZE + CELL_SIZE / 2;
}
function placeTarget() {
    const cols = Math.floor(MAZE_WIDTH / CELL_SIZE);
    const rows = Math.floor(MAZE_HEIGHT / CELL_SIZE);
    const openSpots = [];
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (!state.maze[y][x]) {
                openSpots.push({
                    x: x * CELL_SIZE + CELL_SIZE / 2,
                    y: y * CELL_SIZE + CELL_SIZE / 2
                });
            }
        }
    }
    if (openSpots.length > 0) {
        const spot = openSpots[Math.floor(Math.random() * openSpots.length)];
        state.target.x = spot.x;
        state.target.y = spot.y;
    }
}
function drawMaze() {
    // Clear canvas
    ctx.fillStyle = PATH_COLOR;
    ctx.fillRect(0, 0, MAZE_WIDTH, MAZE_HEIGHT);
    // Draw walls
    ctx.fillStyle = WALL_COLOR;
    const cols = Math.floor(MAZE_WIDTH / CELL_SIZE);
    const rows = Math.floor(MAZE_HEIGHT / CELL_SIZE);
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (state.maze[y][x]) {
                ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            }
        }
    }
    // Draw target
    ctx.fillStyle = state.targetFound ? TARGET_COLOR : TARGET_HIDDEN_COLOR;
    if (state.targetFound) {
        // Pulse effect when found
        const size = 10 + 5 * Math.sin(Date.now() / 200);
        ctx.beginPath();
        ctx.arc(state.target.x, state.target.y, size, 0, Math.PI * 2);
        ctx.fill();
    }
    else {
        // Tiny pixel when hidden
        ctx.fillRect(state.target.x - 1, state.target.y - 1, 2, 2);
    }
    // Draw player
    ctx.fillStyle = PLAYER_COLOR;
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, PLAYER_SIZE, 0, Math.PI * 2);
    ctx.fill();
    // Draw direction indicator if moving
    if (state.player.vx !== 0 || state.player.vy !== 0) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(state.player.x, state.player.y);
        ctx.lineTo(state.player.x + state.player.vx * 20, state.player.y + state.player.vy * 20);
        ctx.stroke();
    }
}
function gameLoop(timestamp) {
    if (!state.lastTimestamp) {
        state.lastTimestamp = timestamp;
    }
    const deltaTime = (timestamp - state.lastTimestamp) / 1000;
    state.lastTimestamp = timestamp;
    // Update timer if player is moving
    if (state.player.vx !== 0 || state.player.vy !== 0) {
        state.currentTime += deltaTime;
        updateUI();
    }
    movePlayer(deltaTime);
    drawMaze();
    state.timer = requestAnimationFrame(gameLoop);
}
function movePlayer(deltaTime) {
    const speed = 150 * deltaTime;
    let newX = state.player.x + state.player.vx * speed;
    let newY = state.player.y + state.player.vy * speed;
    // Check wall collisions
    const cellX = Math.floor(newX / CELL_SIZE);
    const cellY = Math.floor(newY / CELL_SIZE);
    if (cellX >= 0 && cellX < Math.floor(MAZE_WIDTH / CELL_SIZE) &&
        cellY >= 0 && cellY < Math.floor(MAZE_HEIGHT / CELL_SIZE) &&
        !state.maze[cellY][cellX]) {
        state.player.x = newX;
        state.player.y = newY;
    }
    // Check if player found the target
    const distance = Math.sqrt(Math.pow(state.player.x - state.target.x, 2) +
        Math.pow(state.player.y - state.target.y, 2));
    if (distance < PLAYER_SIZE + 5 && !state.targetFound) {
        state.targetFound = true;
        // Update best time
        if (state.currentTime < state.bestTime) {
            state.bestTime = state.currentTime;
        }
        // Next level after delay
        setTimeout(() => {
            state.level++;
            state.currentTime = 0;
            generateMaze();
            placePlayer();
            updateUI();
        }, 1000);
    }
}
function handleDeviceOrientation(e) {
    if (!state.gyroAvailable)
        return;
    // Use beta (front-to-back tilt) and gamma (left-to-right tilt)
    const beta = e.beta ? e.beta * 0.0174533 : 0; // Convert to radians
    const gamma = e.gamma ? e.gamma * 0.0174533 : 0;
    // Apply calibration
    const calibBeta = beta - state.gyroCalibration.y;
    const calibGamma = gamma - state.gyroCalibration.x;
    // Update player velocity
    state.player.vy = Math.sin(calibBeta) * 1.5;
    state.player.vx = Math.sin(calibGamma) * 1.5;
}
function calibrateGyro() {
    // Set current orientation as neutral
    state.gyroCalibration.x = state.player.vx;
    state.gyroCalibration.y = state.player.vy;
}
function handleKeyDown(e) {
    switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            state.player.vy = -1;
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            state.player.vy = 1;
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            state.player.vx = -1;
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            state.player.vx = 1;
            break;
    }
}
function handleKeyUp(e) {
    switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
        case 'ArrowDown':
        case 's':
        case 'S':
            if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
                if (state.player.vy < 0)
                    state.player.vy = 0;
            }
            else {
                if (state.player.vy > 0)
                    state.player.vy = 0;
            }
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
        case 'ArrowRight':
        case 'd':
        case 'D':
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                if (state.player.vx < 0)
                    state.player.vx = 0;
            }
            else {
                if (state.player.vx > 0)
                    state.player.vx = 0;
            }
            break;
    }
}
function updateUI() {
    levelElement.textContent = state.level.toString();
    timeElement.textContent = state.currentTime.toFixed(1);
    if (state.bestTime !== Infinity) {
        bestElement.textContent = state.bestTime.toFixed(1);
    }
    else {
        bestElement.textContent = '-';
    }
}
// Start the game
window.addEventListener('load', initGame);
