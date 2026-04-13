const gridElement = document.getElementById("grid");
let width = 9;
let height = 9;
let mineCount = 10;

let cells = [];
let gridInfo = [];
let mines = [];
let isStarted = false;
let revealedCount = 0;
let flagged = new Set();
let isMouseDown = false;
let noGuessingMode = false;

let isRevealing = false;
let revealCancelToken = { cancelled: false };
let revealByStep = false;

const noGuessingModeCheckbox = document.getElementById('noGuessingModeBT');
const revealByStepCheckbox = document.getElementById('revealByStepBT');
revealByStepCheckbox.addEventListener('change', function() {
  const isChecked = revealByStepCheckbox.checked;
  revealByStep = isChecked;
  console.log("Checkbox is checked:", isChecked);
});
noGuessingModeCheckbox.addEventListener('change', function() {
  const isChecked = noGuessingModeCheckbox.checked;
  console.log("Checkbox is checked:", isChecked);

  ToggleNoGuessingMode(isChecked);
});

let directions = [];
function updateDirections() {
  directions = [-1, 1, -width, width, -width - 1, -width + 1, width - 1, width + 1];
}
document.addEventListener("mousedown", () => isMouseDown = true);
document.addEventListener("mouseup", () => {
  isMouseDown = false;
  clearChecking();
});
function updateMineCount() {
  let count = mineCount - flagged.size;
  document.getElementById("mineCounter").textContent=count.toString().padStart(3, '0');;
}
function setDifficulty(level) {
  const buttons = document.querySelectorAll(".button-old");
  buttons.forEach(btn => btn.classList.remove("selected"));

  switch (level) {
    case "easy":
    width = 9;
    height = 9;
    mineCount = 10;
    break;
    case "medium":
    width = 16;
    height = 16;
    mineCount = 40;
    break;
    case "hard":
    width = 30;
    height = 16;
    mineCount = 99;
    break;
  }
  updateDirections();
  document.querySelector(`.button-old[onclick="setDifficulty('${level}')"]`).classList.add("selected");
  updateGridStyle();
  initializeGame();
}
function ToggleNoGuessingMode(mode) {
  noGuessingMode = mode;
  updateGridStyle();
  initializeGame();
}
function updateGridStyle() {
  gridElement.style.gridTemplateColumns = `repeat(${width}, 30px)`;
  gridElement.style.gridTemplateRows = `repeat(${height}, 30px)`;
}

let timerInterval;
let timerValue = 0;

function startTimer() {
  stopTimer(); // Ensure no duplicate timers
  timerValue = 0;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    if (timerValue < 999) {
      timerValue++;
      updateTimerDisplay();
    } else {
      stopTimer();
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
}

function updateTimerDisplay() {
  const timerElement = document.getElementById('timer');
  timerElement.textContent = timerValue.toString().padStart(3, '0');
}

function initializeGame() {
  revealCancelToken.cancelled = true; 
  revealCancelToken = { cancelled: false };
  isRevealing = false;

  gridElement.innerHTML = '';
  cells = [];
  gridInfo = Array(width * height).fill(0);
  mines = [];
  flagged.clear();
  revealedCount = 0;
  isStarted = false;

  for (let i = 0; i < width * height; i++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.index = i;
    cell.classList.add("closed");
    gridElement.appendChild(cell);
    cells.push(cell);

    cell.addEventListener("contextmenu", (e) => {
      if (isRevealing) return;
      e.preventDefault();
      toggleFlag(i);
    });

    cell.addEventListener("mouseenter", (e) => {
      if (isRevealing) return;
      if (!isMouseDown || e.buttons !== 1) return;
      clearChecking();
      if (!cell.classList.contains("flagged")) {
        showChecking(i);
      }
    });

    cell.addEventListener("mousedown", (e) => {
      if (isRevealing) return;
      if (e.button !== 0) return;
      console.log("Mouse down on cell:", i);
      clearChecking();
      if (!cell.classList.contains("flagged")) {
        showChecking(i);
      }
    });

    cell.addEventListener("mouseup", (e) => {
      if (isRevealing) return;
      isMouseDown = false;
      clearChecking();
      if (e.button === 0) {
        if (cell.classList.contains("revealed")) {
          checkRevealNeighbors(i);
        } else if (!cell.classList.contains("flagged")) {
          revealCell(i);
        }
      }
    });
  }
  updateMineCount();
  stopTimer();
  timerValue = 0;
  updateTimerDisplay();
  if (noGuessingMode) {
    const startIndex = Math.floor(Math.random() * (width * height));

    mines = generateMines(width * height, mineCount, startIndex);
    buildGridInfo();
    cells[startIndex].classList.add("startIndex");

    while (!simulateNoGuessSolver(gridInfo, width, height, startIndex)){
      mines = generateMines(width * height, mineCount, startIndex);
      buildGridInfo();
      cells[startIndex].classList.add("startIndex");
      console.log("Guessing required!");
    }
    // if (simulateNoGuessSolver(gridInfo, width, height, startIndex)) {
    //   console.log("No guessing required!");
    // } else {
    //   console.log("Guessing required!");
    // }
  }
}

function generateMines(range, count, excludeIndex) {
  const array = Array.from({ length: range }, (_, i) => i);
  array.splice(excludeIndex, 1);

  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array.slice(0, count);
}

function buildGridInfo() {
  gridInfo = Array(width * height).fill(0);

  for (const mine of mines) {
    gridInfo[mine] = -1;
    const x = mine % width;
    const y = Math.floor(mine / width);

    for (const dir of directions) {
      const neighbor = mine + dir;
      const nx = neighbor % width;
      const ny = Math.floor(neighbor / width);

      if (
        neighbor >= 0 && neighbor < width * height &&
        Math.abs(nx - x) <= 1 &&
        Math.abs(ny - y) <= 1 &&
        gridInfo[neighbor] !== -1
      ) {
        gridInfo[neighbor]++;
      }
    }
  }
}

function revealCellInstant(index) {
  const cell = cells[index];
  if (cell.classList.contains("revealed") || cell.classList.contains("flagged")) return;

  if (!isStarted) {
    if(!noGuessingMode) {
      mines = generateMines(width * height, mineCount, index);
      buildGridInfo();
    }
    isStarted = true;
    startTimer();
  }
  cell.classList.remove("closed");
  cell.classList.add("revealed");

  if (gridInfo[index] === -1) {
    cell.classList.remove("closed");
    cell.classList.add("mine", "incorrectSelection");
    cell.textContent = "X";
    revealAll();
    endGame();
    return;
  }

  revealedCount++;

  if (gridInfo[index] > 0) {
    cell.textContent = gridInfo[index];
    cell.dataset.value = gridInfo[index];
  } else {
    const x = index % width;
    const y = Math.floor(index / width);

    for (const dir of directions) {
      const neighbor = index + dir;
      const nx = neighbor % width;
      const ny = Math.floor(neighbor / width);

      if (
        neighbor >= 0 && neighbor < width * height &&
        Math.abs(nx - x) <= 1 &&
        Math.abs(ny - y) <= 1
      ) {
        if (cells[neighbor].classList.contains("flagged")) {
          cells[neighbor].classList.remove("flagged");
          flagged.delete(neighbor);
        }
        revealCell(neighbor);
      }
    }
  }

  checkWin();
  updateMineCount();
}
function revealCell(index) {
  if (revealByStep) {
    return revealCellAsync(index);
  } else {
    return revealCellInstant(index);
  }
}

async function revealCellAsync(index) {

  isRevealing = true;
  const localToken = revealCancelToken;
  if (!isStarted) {
    if(!noGuessingMode) {
      mines = generateMines(width * height, mineCount, index);
      buildGridInfo();
    }
    isStarted = true;
    startTimer();
  }
  const queue = [index];
  const visited = new Set();
  
  while (queue.length > 0) {
    // 👉 Cancel if token is invalidated
    if (localToken !== revealCancelToken || localToken.cancelled) break;

    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);

    const cell = cells[current];
    if (cell.classList.contains("revealed") || cell.classList.contains("flagged")) continue;

    cell.classList.remove("closed");
    cell.classList.add("revealed");

    if (gridInfo[current] === -1) {
      cell.classList.add("mine", "incorrectSelection");
      cell.textContent = "X";
      revealAll();
      endGame();
      break;
    }

    revealedCount++;
    if (gridInfo[current] > 0) {
      cell.textContent = gridInfo[current];
      cell.dataset.value = gridInfo[current];
    } else {
      const x = current % width;
      const y = Math.floor(current / width);
      for (const dir of directions) {
        const neighbor = current + dir;
        const nx = neighbor % width;
        const ny = Math.floor(neighbor / width);
        if (
          neighbor >= 0 && neighbor < width * height &&
          Math.abs(nx - x) <= 1 &&
          Math.abs(ny - y) <= 1
        ) {
          queue.push(neighbor);
        }
      }
    }

    updateMineCount();
    checkWin();

    // Delay for animation
    await new Promise(resolve => setTimeout(resolve, 30));
  }

  isRevealing = false;
}


function toggleFlag(index) {
  const cell = cells[index];
  if (cell.classList.contains("revealed")) return;

  cell.classList.toggle("flagged");
  if (cell.classList.contains("flagged")) {
    flagged.add(index);
  } else {
    flagged.delete(index);
  }
  updateMineCount();
}

function revealAll() {
  for (let i = 0; i < width * height; i++) {
    const cell = cells[i];

    if (gridInfo[i] === -1) {
      if (!cell.classList.contains("flagged")){
        cell.classList.remove("flagged");
        cell.classList.remove("closed");
  
        cell.classList.add("mine");
        flagged.add(i);
      }
    } else {
      if (cell.classList.contains("flagged")) {
        //cell.classList.remove("flagged");
        //cell.classList.remove("flagged");
        cell.classList.add("incorrect_flag");
      }
      /*cell.classList.add("revealed");
      if (gridInfo[i] > 0) {
        cell.textContent = gridInfo[i];
        cell.dataset.value = gridInfo[i];

      }*/
    }
  }
}

function showChecking(index) {
  const x = index % width;
  const y = Math.floor(index / width);
  const cell = cells[index];
  cell.classList.add("checking");

  if (!cell.classList.contains("revealed")) return;

  for (const dir of directions) {
    const neighbor = index + dir;
    const nx = neighbor % width;
    const ny = Math.floor(neighbor / width);

    if (
      neighbor >= 0 && neighbor < width * height &&
      Math.abs(nx - x) <= 1 &&
      Math.abs(ny - y) <= 1
    ) {
      const nCell = cells[neighbor];
      if (!nCell.classList.contains("revealed") && !nCell.classList.contains("flagged")) {
        nCell.classList.add("checking");
      }
    }
  }
}

function clearChecking() {
  cells.forEach(cell => cell.classList.remove("checking"));
}

function checkRevealNeighbors(index) {
  const number = gridInfo[index];
  if (number <= 0) return;

  let flagCount = 0;
  const toReveal = [];

  const x = index % width;
  const y = Math.floor(index / width);

  for (const dir of directions) {
    const neighbor = index + dir;
    const nx = neighbor % width;
    const ny = Math.floor(neighbor / width);

    if (
      neighbor >= 0 && neighbor < width * height &&
      Math.abs(nx - x) <= 1 &&
      Math.abs(ny - y) <= 1
    ) {
      const nCell = cells[neighbor];
      if (nCell.classList.contains("flagged")) {
        flagCount++;
      } else if (!nCell.classList.contains("revealed")) {
        toReveal.push(neighbor);
      }
    }
  }

  if (flagCount === number) {
    toReveal.forEach(i => revealCell(i));
  }
}

function checkWin() {
  const totalSafeCells = width * height - mineCount;
  if (revealedCount === totalSafeCells) {
    revealAll();
    endGame();
  }
}

function endGame() {
  stopTimer();
  revealCancelToken.cancelled = true; 
  cells.forEach(cell => {
    const newCell = cell.cloneNode(true);
    cell.replaceWith(newCell);
  });
}


setDifficulty("easy");


function simulateNoGuessSolver(gridInfo, width, height, startIndex) {
  const size = width * height;
  const revealed = new Set();
  const flagged = new Set();

  function getNeighbors(index) {
    const x = index % width;
    const y = Math.floor(index / width);
    const neighbors = [];

    for (const dir of [-1, 1, -width, width, -width - 1, -width + 1, width - 1, width + 1]) {
      const n = index + dir;
      const nx = n % width;
      const ny = Math.floor(n / width);

      if (
        n >= 0 && n < size &&
        Math.abs(nx - x) <= 1 &&
        Math.abs(ny - y) <= 1
      ) {
        neighbors.push(n);
      }
    }

    return neighbors;
  }

  function reveal(index) {
    if (revealed.has(index)) return;
    const stack = [index];

    while (stack.length > 0) {
      const idx = stack.pop();
      if (revealed.has(idx) || flagged.has(idx)) continue;
      revealed.add(idx);

      if (gridInfo[idx] === 0) {
        const neighbors = getNeighbors(idx);
        for (const n of neighbors) {
          if (!revealed.has(n) && !flagged.has(n)) stack.push(n);
        }
      }
    }
  }

  function applySubsetLogic(constraints) {
    let changed = false;

    for (let i = 0; i < constraints.length; i++) {
      for (let j = 0; j < constraints.length; j++) {
        if (i === j) continue;

        const A = constraints[i];
        const B = constraints[j];

        // A.cells ⊆ B.cells
        if (A.cells.every(c => B.cells.includes(c))) {
          const diffCells = B.cells.filter(c => !A.cells.includes(c));
          const diffCount = B.count - A.count;

          if (diffCount === diffCells.length) {
            for (const c of diffCells) {
              if (!flagged.has(c)) {
                flagged.add(c);
                changed = true;
              }
            }
          }

          if (A.count === B.count) {
            for (const c of diffCells) {
              if (!revealed.has(c) && !flagged.has(c)) {
                reveal(c);
                changed = true;
              }
            }
          }
        }
      }
    }

    return changed;
  }

  // Start by revealing the initial tile
  reveal(startIndex);

  let changed;
  do {
    changed = false;
    let constraints = [];

    for (let i = 0; i < size; i++) {
      if (!revealed.has(i)) continue;
      const val = gridInfo[i];
      if (val <= 0) continue;

      const neighbors = getNeighbors(i);
      const unrevealed = neighbors.filter(n => !revealed.has(n) && !flagged.has(n));
      const flaggedCount = neighbors.filter(n => flagged.has(n)).length;
      const remaining = val - flaggedCount;

      if (remaining < 0) return false; // Invalid flag count

      // Rule 1: mark all remaining as mines
      if (remaining === unrevealed.length) {
        for (const n of unrevealed) {
          if (!flagged.has(n)) {
            flagged.add(n);
            changed = true;
          }
        }
      }

      // Rule 2: all mines flagged, others are safe
      if (remaining === 0) {
        for (const n of unrevealed) {
          if (!revealed.has(n)) {
            reveal(n);
            changed = true;
          }
        }
      }

      if (unrevealed.length > 0) {
        constraints.push({ cells: unrevealed, count: remaining });
      }
    }

    // Apply subset logic
    changed = applySubsetLogic(constraints) || changed;

  } while (changed);

  const totalSafe = gridInfo.filter(v => v !== -1).length;
  return revealed.size === totalSafe;
}
