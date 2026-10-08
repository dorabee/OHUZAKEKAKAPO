const stage = document.querySelector(".main-content");
const kakapo = document.getElementById("kakapo");
const speedMeter = document.querySelector(".speed-meter");
const speedFill = document.getElementById("speed-fill");
const speedValue = document.getElementById("speed-value");
const spinDirection = document.getElementById("spin-direction");
const partyGaugeElement = document.querySelector(".party-gauge");
const partyGaugeFill = document.getElementById("party-gauge-fill");
const partyGaugeValue = document.getElementById("party-gauge-value");
const frames = Array.from({ length: 10 }, (_, index) => `../img/${index + 1}.png`);
const radiansPerFrame = (Math.PI * 2) / frames.length;

const preloadedFrames = frames.map((source) => {
    const image = new Image();
    image.src = source;
    return image;
});

let rotation = 0;
let angularVelocity = 0;
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

function updatePartyGauge(speedRatio, elapsed) {
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
    updatePartyGlow();
}

function updatePartyGlow() {
    if (partyGauge < 20) {
        kakapo.style.setProperty("--glow-core-blur", "0px");
        kakapo.style.setProperty("--glow-core-alpha", "0");
        kakapo.style.setProperty("--glow-halo-blur", "0px");
        kakapo.style.setProperty("--glow-halo-alpha", "0");
        return;
    }

    const glowProgress = Math.min((partyGauge - 20) / 80, 1);
    kakapo.style.setProperty("--glow-core-blur", `${(8 + glowProgress * 20) * 4}px`);
    kakapo.style.setProperty("--glow-core-alpha", `${Math.min((0.5 + glowProgress * 0.35) * 4, 1)}`);
    kakapo.style.setProperty("--glow-halo-blur", `${(18 + glowProgress * 34) * 4}px`);
    kakapo.style.setProperty("--glow-halo-alpha", `${Math.min((0.25 + glowProgress * 0.25) * 4, 1)}`);
}

function animate(time) {
    const elapsed = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, 0.05) : 0;
    lastFrameTime = time;

    rotation += angularVelocity * elapsed;
    if (!isDragging) {
        angularVelocity *= Math.pow(frictionPerFrame, elapsed * 60);
        if (Math.abs(angularVelocity) < stopThreshold) angularVelocity = 0;
    }

    const nextFrame = ((Math.floor(rotation / radiansPerFrame) % frames.length) + frames.length) % frames.length;
    if (nextFrame !== currentFrame) {
        currentFrame = nextFrame;
        kakapo.src = frames[currentFrame];
    }

    const speedRatio = Math.min(Math.abs(angularVelocity) / maxAngularVelocity, 1);
    const speedPercent = Math.round(speedRatio * 100);
    updatePartyGauge(speedRatio, elapsed);
    const direction = Math.abs(angularVelocity) < stopThreshold
        ? "停止"
        : angularVelocity < 0 ? "時計回り" : "反時計回り";

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
requestAnimationFrame(animate);
