const stage = document.querySelector(".main-content");
const kakapo = document.getElementById("kakapo");
const speedMeter = document.querySelector(".speed-meter");
const speedFill = document.getElementById("speed-fill");
const speedValue = document.getElementById("speed-value");
const spinDirection = document.getElementById("spin-direction");
const partyGaugeElement = document.querySelector(".party-gauge");
const partyGaugeFill = document.getElementById("party-gauge-fill");
const partyGaugeValue = document.getElementById("party-gauge-value");
const resetPartyGaugeButton = document.getElementById("reset-party-gauge");
const debugBoostButton = document.getElementById("debug-boost");
const frames = Array.from({ length: 10 }, (_, index) => `../img/${index + 1}.png`);
const radiansPerFrame = (Math.PI * 2) / frames.length;

const preloadedFrames = frames.map((source) => {
    const image = new Image();
    image.src = source;
    return image;
});

let rotation = 0;
let angularVelocity = 0;
let debugBoostActive = false;
let debugBoostDirection = 1;
let isDragging = false;
let previousAngle = null;
let previousTime = 0;
let lastFrameTime = 0;
let currentFrame = 0;
let boostDirection = 0;
let pendingDirection = 0;
let pendingReverseTime = 0;
let pendingReverseAngle = 0;
let partyGauge = 0;

const frictionPerFrame = 0.995;
const maxAngularVelocity = 50;
const stopThreshold = 0.015;
const pointerSpeedForMax = 5;
const reverseConfirmTime = 0.18;
const reverseConfirmAngle = 0.15;
const partyGaugeThreshold = 0.9;
const partyGaugeChargeMinRate = 1.3;
const partyGaugeChargeMaxRate = 7.8;
const partyGaugeDecayRate = 3;
const partyGlowStart = 1;
const partyGlowMax = 30;
const glowColors = [
    [255, 35, 35],   // red
    [255, 230, 0],   // yellow
    [173, 255, 47],  // yellow green
    [0, 235, 255],   // cyan
    [35, 90, 255],   // blue
    [148, 0, 211],   // purple
    [255, 105, 180], // pink
    [255, 20, 147],  // deep pink
    [255, 125, 0]    // orange
];
let glowActive = false;
let selectedGlowColor = glowColors[0];
let rainbowStartedAt = null;

function getPointerAngle(event) {
    const bounds = kakapo.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    return Math.atan2(event.clientY - centerY, event.clientX - centerX);
}

function onPointerDown(event) {
    if (event.button !== 0 && event.pointerType === "mouse") return;

    isDragging = true;
    previousAngle = getPointerAngle(event);
    previousTime = event.timeStamp;
    stage.setPointerCapture(event.pointerId);
    event.preventDefault();
}

function onPointerMove(event) {
    if (!isDragging) return;

    const currentAngle = getPointerAngle(event);
    let angleDelta = currentAngle - previousAngle;

    if (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
    if (angleDelta < -Math.PI) angleDelta += Math.PI * 2;

    const elapsed = Math.max((event.timeStamp - previousTime) / 1000, 1 / 240);
    const pointerSpeed = Math.abs(angleDelta) / elapsed;

    if (pointerSpeed > 0) {
        const inputRatio = Math.min(pointerSpeed / pointerSpeedForMax, 1);
        let direction = -Math.sign(angleDelta);
        let acceptInput = true;

        if (boostDirection === 0) {
            boostDirection = direction;
        } else if (direction !== boostDirection) {
            if (pendingDirection !== direction) {
                pendingDirection = direction;
                pendingReverseTime = 0;
                pendingReverseAngle = 0;
            }

            pendingReverseTime += elapsed;
            pendingReverseAngle += Math.abs(angleDelta);
            if (pendingReverseTime >= reverseConfirmTime && pendingReverseAngle >= reverseConfirmAngle) {
                boostDirection = direction;
                pendingDirection = 0;
                pendingReverseTime = 0;
                pendingReverseAngle = 0;
            } else {
                acceptInput = false;
            }
        } else {
            pendingDirection = 0;
            pendingReverseTime = 0;
            pendingReverseAngle = 0;
        }

        if (acceptInput) {
            direction = boostDirection;
            const targetVelocity = direction * maxAngularVelocity * inputRatio;
            const isSlowingDown = Math.abs(targetVelocity) < Math.abs(angularVelocity)
                || targetVelocity * angularVelocity < 0;
            const responseRate = isSlowingDown
                ? 5
                : Math.min(0.5 + pointerSpeed * 0.06, 2.5);
            const response = 1 - Math.exp(-responseRate * elapsed);
            angularVelocity += (targetVelocity - angularVelocity) * response;
        }
    } else {
        pendingDirection = 0;
        pendingReverseTime = 0;
        pendingReverseAngle = 0;
    }

    previousAngle = currentAngle;
    previousTime = event.timeStamp;
}

function stopDragging(event) {
    if (!isDragging) return;
    isDragging = false;
    previousAngle = null;
    boostDirection = 0;
    pendingDirection = 0;
    pendingReverseTime = 0;
    pendingReverseAngle = 0;
    if (stage.hasPointerCapture(event.pointerId)) {
        stage.releasePointerCapture(event.pointerId);
    }
}

function startDebugBoost(event) {
    event.preventDefault();
    event.stopPropagation();
    debugBoostActive = true;
    debugBoostDirection = Math.sign(angularVelocity) || 1;
    debugBoostButton.setAttribute("aria-pressed", "true");

    if (event.pointerId !== undefined) {
        debugBoostButton.setPointerCapture(event.pointerId);
    }
}

function stopDebugBoost(event) {
    event.stopPropagation();
    debugBoostActive = false;
    debugBoostButton.setAttribute("aria-pressed", "false");

    if (event.pointerId !== undefined && debugBoostButton.hasPointerCapture(event.pointerId)) {
        debugBoostButton.releasePointerCapture(event.pointerId);
    }
}

function stopKeyboardDebugBoost(event) {
    if (event.code !== "Space" && event.code !== "Enter") return;
    stopDebugBoost(event);
}

function updatePartyGauge(speedRatio, elapsed, time) {
    if (speedRatio >= partyGaugeThreshold) {
        const chargeRatio = (speedRatio - partyGaugeThreshold) / (1 - partyGaugeThreshold);
        const chargeRate = partyGaugeChargeMinRate
            + (partyGaugeChargeMaxRate - partyGaugeChargeMinRate) * chargeRatio;
        partyGauge = Math.min(100, partyGauge + chargeRate * elapsed);
    } else {
        partyGauge = Math.max(0, partyGauge - partyGaugeDecayRate * elapsed);
    }

    const displayedValue = Math.round(partyGauge);
    partyGaugeFill.style.width = `${partyGauge}%`;
    partyGaugeValue.value = `${displayedValue}%`;
    partyGaugeElement.setAttribute("aria-valuenow", displayedValue);
    partyGaugeElement.setAttribute("aria-valuetext", `${displayedValue}%`);
    updatePartyGlow(time);
}

function resetPartyGauge() {
    partyGauge = 0;
    partyGaugeFill.style.width = "0%";
    partyGaugeValue.value = "0%";
    partyGaugeElement.setAttribute("aria-valuenow", "0");
    partyGaugeElement.setAttribute("aria-valuetext", "0%");
    updatePartyGlow(performance.now());
}

function updatePartyGlow(time) {
    if (partyGauge < partyGlowStart) {
        glowActive = false;
        rainbowStartedAt = null;
        kakapo.style.setProperty("--glow-core-blur", "0px");
        kakapo.style.setProperty("--glow-core-alpha", "0");
        kakapo.style.setProperty("--glow-halo-blur", "0px");
        kakapo.style.setProperty("--glow-halo-alpha", "0");
        kakapo.style.setProperty("--glow-ambient-blur", "0px");
        kakapo.style.setProperty("--glow-ambient-alpha", "0");
        kakapo.style.setProperty("--glow-edge-alpha", "0");
        return;
    }

    if (!glowActive) {
        glowActive = true;
        selectedGlowColor = glowColors[Math.floor(Math.random() * glowColors.length)];
    }

    let glowColor = selectedGlowColor;
    if (partyGauge >= 100) {
        if (rainbowStartedAt === null) rainbowStartedAt = time;
        const colorIndex = Math.floor((time - rainbowStartedAt) / 200) % glowColors.length;
        glowColor = glowColors[colorIndex];
    } else {
        rainbowStartedAt = null;
    }

    kakapo.style.setProperty("--glow-rgb", glowColor.join(", "));
    const glowProgress = Math.min((partyGauge - partyGlowStart) / (partyGlowMax - partyGlowStart), 1);
    kakapo.style.setProperty("--glow-edge-alpha", `${0.75 + glowProgress * 0.25}`);
    kakapo.style.setProperty("--glow-core-blur", `${2 + glowProgress * 10}px`);
    kakapo.style.setProperty("--glow-core-alpha", `${0.85 + glowProgress * 0.15}`);
    kakapo.style.setProperty("--glow-halo-blur", `${22 + glowProgress * 58}px`);
    kakapo.style.setProperty("--glow-halo-alpha", `${0.3 + glowProgress * 0.45}`);
    kakapo.style.setProperty("--glow-ambient-blur", `${50 + glowProgress * 110}px`);
    kakapo.style.setProperty("--glow-ambient-alpha", `${0.12 + glowProgress * 0.28}`);
}

function animate(time) {
    const elapsed = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, 0.05) : 0;
    lastFrameTime = time;

    const currentAngularVelocity = debugBoostActive
        ? debugBoostDirection * maxAngularVelocity
        : angularVelocity;
    rotation += currentAngularVelocity * elapsed;
    if (!isDragging && !debugBoostActive) {
        angularVelocity *= Math.pow(frictionPerFrame, elapsed * 60);
        if (Math.abs(angularVelocity) < stopThreshold) angularVelocity = 0;
    }

    const nextFrame = ((Math.floor(rotation / radiansPerFrame) % frames.length) + frames.length) % frames.length;
    if (nextFrame !== currentFrame) {
        currentFrame = nextFrame;
        kakapo.src = frames[currentFrame];
    }

    const speedRatio = Math.min(Math.abs(currentAngularVelocity) / maxAngularVelocity, 1);
    const speedPercent = Math.round(speedRatio * 100);
    updatePartyGauge(speedRatio, elapsed, time);
    const direction = Math.abs(currentAngularVelocity) < stopThreshold
        ? "停止"
        : currentAngularVelocity < 0 ? "時計回り" : "反時計回り";

    speedFill.style.width = `${speedPercent}%`;
    speedValue.value = `${speedPercent}%`;
    speedMeter.setAttribute("aria-valuenow", speedPercent);
    speedMeter.setAttribute("aria-valuetext", `${direction}、${speedPercent}%`);
    spinDirection.value = direction;

    requestAnimationFrame(animate);
}

stage.addEventListener("pointerdown", onPointerDown);
stage.addEventListener("pointermove", onPointerMove);
stage.addEventListener("pointerup", stopDragging);
stage.addEventListener("pointercancel", stopDragging);
resetPartyGaugeButton.addEventListener("pointerdown", (event) => event.stopPropagation());
resetPartyGaugeButton.addEventListener("click", resetPartyGauge);
debugBoostButton.addEventListener("pointerdown", startDebugBoost);
debugBoostButton.addEventListener("pointerup", stopDebugBoost);
debugBoostButton.addEventListener("pointercancel", stopDebugBoost);
debugBoostButton.addEventListener("lostpointercapture", stopDebugBoost);
debugBoostButton.addEventListener("keydown", (event) => {
    if (event.code === "Space" || event.code === "Enter") startDebugBoost(event);
});
debugBoostButton.addEventListener("keyup", stopKeyboardDebugBoost);
debugBoostButton.addEventListener("blur", () => {
    debugBoostActive = false;
    debugBoostButton.setAttribute("aria-pressed", "false");
});
requestAnimationFrame(animate);
