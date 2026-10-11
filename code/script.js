// HTML要素を先に取得しておき、各処理で同じ要素を使います。
const stage = document.querySelector(".main-content");
const kakapo = document.getElementById("kakapo");
const partyPopup = document.getElementById("party-popup");
const speedMeter = document.querySelector(".speed-meter");
const speedFill = document.getElementById("speed-fill");
const speedValue = document.getElementById("speed-value");
const spinDirection = document.getElementById("spin-direction");
const partyGaugeElement = document.querySelector(".party-gauge");
const partyGaugeFill = document.getElementById("party-gauge-fill");
const partyGaugeValue = document.getElementById("party-gauge-value");
const resetPartyGaugeButton = document.getElementById("reset-party-gauge");
const debugBoostButton = document.getElementById("debug-boost");
// GIFを直接再生せず、回転量に合わせて10枚の静止画を切り替えます。
const frames = Array.from({ length: 10 }, (_, index) => `../img/${index + 1}.png`);
const radiansPerFrame = (Math.PI * 2) / frames.length;

// 先読みして、コマを切り替えるときの読み込み遅延を減らします。
const preloadedFrames = frames.map((source) => {
    const image = new Image();
    image.src = source;
    return image;
});

// 回転角度と速度はラジアン単位です。速度の符号が回転方向を表します。
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
let partyPopupArmed = true;
let partyPopupHideTimer = null;
let partyPopupCleanupTimer = null;

// 回転と操作感の調整値です。速度メーターの最大値も同じ上限を参照します。
const frictionPerFrame = 0.995;
const maxAngularVelocity = 50;
const stopThreshold = 0.015;
const pointerSpeedForMax = 5;
const reverseConfirmTime = 0.18;
const reverseConfirmAngle = 0.15;
const partyGaugeThreshold = 0.9;
const partyGaugeChargeMinRate = 1.04;
const partyGaugeChargeMaxRate = 6.24;
const partyGaugeDecayRate = 3;
const partyPopupTrigger = 55;
const partyPopupRearm = 45;
const partyPopupDuration = 1600;
const partyPopupExitDuration = 220;
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

// 画像の中心からポインターへの方向を角度に変換します。
function getPointerAngle(event) {
    const bounds = kakapo.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    return Math.atan2(event.clientY - centerY, event.clientX - centerX);
}

// 押した瞬間の角度を保存し、ドラッグ中の角度差を測る準備をします。
function onPointerDown(event) {
    if (event.button !== 0 && event.pointerType === "mouse") return;

    isDragging = true;
    previousAngle = getPointerAngle(event);
    previousTime = event.timeStamp;
    stage.setPointerCapture(event.pointerId);
    event.preventDefault();
}

// マウスの角度変化と時間から操作速度を求め、カカポの目標速度に反映します。
function onPointerMove(event) {
    if (!isDragging) return;

    const currentAngle = getPointerAngle(event);
    let angleDelta = currentAngle - previousAngle;

    // 角度が+πと-πをまたぐとき、見かけ上の大きな差を補正します。
    if (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
    if (angleDelta < -Math.PI) angleDelta += Math.PI * 2;

    const elapsed = Math.max((event.timeStamp - previousTime) / 1000, 1 / 240);
    const pointerSpeed = Math.abs(angleDelta) / elapsed;

    if (pointerSpeed > 0) {
        const inputRatio = Math.min(pointerSpeed / pointerSpeedForMax, 1);
        let direction = -Math.sign(angleDelta);
        let acceptInput = true;

        // 逆方向の入力が一定時間・角度続いたときだけ方向転換と認めます。
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
            // 現在速度を目標速度へ少しずつ近づけ、変化をなめらかにします。
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

// ドラッグを終えます。速度は消さず、後段の慣性処理で徐々に減らします。
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

// デバッグボタンを押している間だけ、通常速度とは別に最大速度で表示します。
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

// ボタンを離すと一時的な最大速度表示を解除します。
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

// 回転速度と経過時間からゲージを加減算します。速度ではなく「維持時間」も反映します。
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

    // 55%で発動後、45%以下まで下がるまでは再発動を待ちます。
    if (!partyPopupArmed && partyGauge <= partyPopupRearm) {
        partyPopupArmed = true;
    }
    if (partyPopupArmed && partyGauge >= partyPopupTrigger) {
        partyPopupArmed = false;
        showPartyPopup("テンション上がってきた！！");
    }
}

// 汎用ポップアップ処理。文面と表示時間を変えるだけで他のメッセージにも使えます。
function showPartyPopup(message, duration = partyPopupDuration) {
    clearTimeout(partyPopupHideTimer);
    clearTimeout(partyPopupCleanupTimer);
    partyPopup.textContent = message;
    partyPopup.classList.remove("is-visible", "is-hiding");
    void partyPopup.offsetWidth;
    partyPopup.classList.add("is-visible");

    partyPopupHideTimer = setTimeout(() => {
        partyPopup.classList.remove("is-visible");
        partyPopup.classList.add("is-hiding");
        partyPopupCleanupTimer = setTimeout(() => {
            partyPopup.classList.remove("is-hiding");
        }, partyPopupExitDuration);
    }, duration);
}

// リセットボタンから呼び出し、ゲージと発光・再発動の状態をまとめて初期化します。
function resetPartyGauge() {
    partyGauge = 0;
    partyGaugeFill.style.width = "0%";
    partyGaugeValue.value = "0%";
    partyGaugeElement.setAttribute("aria-valuenow", "0");
    partyGaugeElement.setAttribute("aria-valuetext", "0%");
    updatePartyGlow(performance.now());
}

// partyGaugeから光の強さを計算し、満タン時は色を一定間隔で巡回させます。
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

// requestAnimationFrameから毎フレーム呼ばれ、回転と各ゲージ・演出を更新します。
function animate(time) {
    const elapsed = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, 0.05) : 0;
    lastFrameTime = time;

    // デバッグ中だけ表示速度を最大にし、angularVelocity自体は保持します。
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

    // 回転速度を0〜1に正規化し、速度表示とパーティーゲージで共有します。
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

// ボタンのpointerdownは各ボタン側で伝播を止め、ここでの回転開始を防いでいます。
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
// partyGaugeを背景色に変換します。ゲージ計算には触れず、表示だけを更新します。
function updatePartyBackground() {
  const progress = Math.max(0, Math.min(100, partyGauge));
  const root = document.documentElement;

  // 0〜19%はantiquewhite、20〜79%はその色からパーティーピンクへ補間します。
  const pastelAmount = Math.max(0, Math.min(1, (progress - 20) / 59));
  const start = [250, 235, 215];
  const finish = [255, 115, 155];
  const rgb = start.map((channel, index) =>
    Math.round(channel + (finish[index] - channel) * pastelAmount)
  );
  root.style.setProperty('--party-background-color', `rgb(${rgb.join(', ')})`);

  // 80%から虹色レイヤーを徐々に濃くし、100%で最大の鮮やかさにします。
  const rainbowOpacity = Math.max(0, Math.min(0.82, ((progress - 80) / 20) * 0.82));
  root.style.setProperty('--party-rainbow-opacity', rainbowOpacity.toFixed(2));
}

// ゲージの変化に追従させるため、一定間隔で背景用のCSS変数だけを書き換えます。
window.setInterval(updatePartyBackground, 50);
