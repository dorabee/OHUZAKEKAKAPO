const stage = document.querySelector(".main-content");
const kakapo = document.getElementById("kakapo");
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
let lastFrameTime = 0;
let currentFrame = 0;

const acceleration = 0.6;
const frictionPerFrame = 0.985;
const maxAngularVelocity = 24;
const stopThreshold = 0.015;

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
    stage.setPointerCapture(event.pointerId);
    event.preventDefault();
}

function onPointerMove(event) {
    if (!isDragging) return;

    const currentAngle = getPointerAngle(event);
    let angleDelta = currentAngle - previousAngle;

    if (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
    if (angleDelta < -Math.PI) angleDelta += Math.PI * 2;

    angularVelocity -= angleDelta * acceleration;
    angularVelocity = Math.max(-maxAngularVelocity, Math.min(maxAngularVelocity, angularVelocity));

    previousAngle = currentAngle;
}

function stopDragging(event) {
    if (!isDragging) return;
    isDragging = false;
    previousAngle = null;
    if (stage.hasPointerCapture(event.pointerId)) {
        stage.releasePointerCapture(event.pointerId);
    }
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

    requestAnimationFrame(animate);
}

stage.addEventListener("pointerdown", onPointerDown);
stage.addEventListener("pointermove", onPointerMove);
stage.addEventListener("pointerup", stopDragging);
stage.addEventListener("pointercancel", stopDragging);
requestAnimationFrame(animate);
