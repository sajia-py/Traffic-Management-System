// State Variables
const state = {
    running: false,
    mode: 'FCFS', // 'FCFS', 'RR', 'PRIORITY'
    emergencyTriggered: false,
    activeDirection: null,
    totalProcessed: 0,
    queues: {
        N: [],
        S: [],
        E: [],
        W: []
    },
    avgWaitTimes: {
        FCFS: { total: 0, count: 0 },
        RR: { total: 0, count: 0 },
        PRIORITY: { total: 0, count: 0 }
    }
};

const directions = ['N', 'S', 'E', 'W'];
let rrIndex = 0;
let nextCarId = 1;

// DOM Elements
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const btnEmergency = document.getElementById('btn-emergency');
const radioAlgos = document.getElementsByName('algorithm');
const statusBadge = document.getElementById('system-status');
const activeAlgo = document.getElementById('active-algo');
const activeGreen = document.getElementById('active-green');
const totalProcessedEl = document.getElementById('total-processed');
const carsContainer = document.getElementById('cars-container');

// Event Listeners
btnStart.addEventListener('click', () => {
    if(!state.running) {
        state.running = true;
        statusBadge.textContent = '🟢 Running';
        statusBadge.className = 'badge bg-green';
        startSimulation();
    }
});

btnStop.addEventListener('click', () => {
    state.running = false;
    statusBadge.textContent = '🔴 Stopped';
    statusBadge.className = 'badge bg-red';
});

btnEmergency.addEventListener('click', () => {
    state.emergencyTriggered = true;
    document.querySelector('input[value="PRIORITY"]').checked = true;
    updateMode('PRIORITY');
    // Spawn an emergency vehicle in a random direction
    spawnVehicle(true);
});

radioAlgos.forEach(radio => {
    radio.addEventListener('change', (e) => {
        updateMode(e.target.value);
    });
});

function updateMode(mode) {
    state.mode = mode;
    activeAlgo.textContent = mode;
}

// Simulation Engine
function startSimulation() {
    // Generate vehicles randomly
    const spawner = setInterval(() => {
        if(!state.running) {
            clearInterval(spawner);
            return;
        }
        // Normal random spawn
        if(Math.random() < 0.6) {
            spawnVehicle(false);
        }
    }, 1000);

    // Traffic Controller Loop
    trafficController();
}

function spawnVehicle(isEmergency) {
    const dir = directions[Math.floor(Math.random() * directions.length)];
    const colorClass = `color-${Math.floor(Math.random() * 5)}`;
    
    const vehicle = {
        id: nextCarId++,
        direction: dir,
        emergency: isEmergency,
        arrivalTime: Date.now(),
        colorClass: colorClass
    };

    state.queues[dir].push(vehicle);
    renderCar(vehicle, dir, state.queues[dir].length - 1);
    updateMetrics();
}

function trafficController() {
    if(!state.running) return;

    // Determine next direction based on scheduling algorithm
    let nextDir = null;

    if (state.mode === 'FCFS') {
        let oldestTime = Infinity;
        for (let dir of directions) {
            if (state.queues[dir].length > 0) {
                const firstCar = state.queues[dir][0];
                if (firstCar.arrivalTime < oldestTime) {
                    oldestTime = firstCar.arrivalTime;
                    nextDir = dir;
                }
            }
        }
    } 
    else if (state.mode === 'RR') {
        // Find next non-empty direction
        for(let i=0; i<4; i++) {
            let d = directions[(rrIndex + i) % 4];
            if(state.queues[d].length > 0) {
                nextDir = d;
                rrIndex = (rrIndex + i + 1) % 4;
                break;
            }
        }
    } 
    else if (state.mode === 'PRIORITY') {
        // Look for emergency vehicles
        for (let dir of directions) {
            if (state.queues[dir].some(v => v.emergency)) {
                nextDir = dir;
                break;
            }
        }
        // Fallback to FCFS if no emergency
        if (!nextDir) {
            let oldestTime = Infinity;
            for (let dir of directions) {
                if (state.queues[dir].length > 0) {
                    const firstCar = state.queues[dir][0];
                    if (firstCar.arrivalTime < oldestTime) {
                        oldestTime = firstCar.arrivalTime;
                        nextDir = dir;
                    }
                }
            }
        }
    }

    if (nextDir) {
        state.activeDirection = nextDir;
        setLights(nextDir);
        
        let processTime = state.emergencyTriggered ? 5000 : 3000;
        
        // Process cars
        processCars(nextDir, processTime);
        
        state.emergencyTriggered = false; // Reset emergency
        
        setTimeout(() => {
            state.activeDirection = null;
            setLights(null);
            setTimeout(trafficController, 500); // Yellow/Wait time
        }, processTime);
    } else {
        setTimeout(trafficController, 500); // Check again soon
    }
}

function processCars(dir, duration) {
    let carsProcessed = 0;
    const interval = 800; // time between cars moving
    
    const processor = setInterval(() => {
        if (!state.running || state.activeDirection !== dir || state.queues[dir].length === 0) {
            clearInterval(processor);
            return;
        }

        const vehicle = state.queues[dir].shift();
        const waitTime = (Date.now() - vehicle.arrivalTime) / 1000;
        
        // Update stats
        state.avgWaitTimes[state.mode].total += waitTime;
        state.avgWaitTimes[state.mode].count++;
        state.totalProcessed++;
        
        animateCarExit(vehicle.id, dir);
        updateQueuePositions(dir);
        updateMetrics();
        updateCharts();
        
    }, interval);

    setTimeout(() => {
        clearInterval(processor);
    }, duration);
}

// Rendering & DOM Manipulation
function getLaneCoords(dir, index) {
    // Center is 300, 300
    let x, y;
    const offset = index * 60;
    
    switch(dir) {
        case 'N': x = 240; y = 170 - offset; break;
        case 'S': x = 330; y = 430 + offset; break;
        case 'E': x = 430 + offset; y = 240; break;
        case 'W': x = 170 - offset; y = 330; break;
    }
    return {x, y};
}

function renderCar(vehicle, dir, index) {
    const el = document.createElement('div');
    el.id = `car-${vehicle.id}`;
    el.className = `car car-${dir.toLowerCase()} ${vehicle.colorClass} ${vehicle.emergency ? 'emergency' : ''}`;
    
    const coords = getLaneCoords(dir, index);
    el.style.left = `${coords.x}px`;
    el.style.top = `${coords.y}px`;
    
    carsContainer.appendChild(el);
}

function updateQueuePositions(dir) {
    state.queues[dir].forEach((vehicle, index) => {
        const el = document.getElementById(`car-${vehicle.id}`);
        if(el) {
            const coords = getLaneCoords(dir, index);
            el.style.left = `${coords.x}px`;
            el.style.top = `${coords.y}px`;
        }
    });
}

function animateCarExit(carId, dir) {
    const el = document.getElementById(`car-${carId}`);
    if(!el) return;

    // Move across intersection
    let targetX = el.offsetLeft;
    let targetY = el.offsetTop;

    switch(dir) {
        case 'N': targetY = 650; break; // drive down
        case 'S': targetY = -50; break; // drive up
        case 'E': targetX = -50; break; // drive left
        case 'W': targetX = 650; break; // drive right
    }

    el.style.transition = "left 1s linear, top 1s linear";
    el.style.left = `${targetX}px`;
    el.style.top = `${targetY}px`;

    setTimeout(() => {
        if(el.parentNode) el.parentNode.removeChild(el);
    }, 1000);
}

function setLights(greenDir) {
    activeGreen.textContent = greenDir || 'None';
    
    directions.forEach(dir => {
        const light = document.getElementById(`light-${dir}`);
        const redBulb = light.querySelector('.red');
        const greenBulb = light.querySelector('.green');
        
        if (dir === greenDir) {
            redBulb.classList.remove('active');
            greenBulb.classList.add('active');
        } else {
            redBulb.classList.add('active');
            greenBulb.classList.remove('active');
        }
    });
}

function updateMetrics() {
    totalProcessedEl.textContent = state.totalProcessed;
    directions.forEach(dir => {
        document.getElementById(`queue-${dir}`).textContent = state.queues[dir].length;
    });
}

function updateCharts() {
    ['FCFS', 'RR', 'PRIORITY'].forEach(mode => {
        const data = state.avgWaitTimes[mode];
        const avg = data.count > 0 ? (data.total / data.count) : 0;
        
        const chart = document.getElementById(`chart-${mode.toLowerCase()}`);
        chart.querySelector('.value').textContent = avg.toFixed(1);
        
        // Max realistic average could be around 20 seconds for the bar percentage
        let width = Math.min((avg / 20) * 100, 100);
        chart.querySelector('.fill').style.width = `${width}%`;
    });
}

// Initial Setup
updateMetrics();
