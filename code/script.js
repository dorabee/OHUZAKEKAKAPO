// HTML要素を先に取得しておき、各処理で同じ要素を使います。
const stage = document.querySelector(".main-content");
const kakapo = document.getElementById("kakapo");
const partyPopup = document.getElementById("party-popup");
const partyConfettiLayer = document.getElementById("party-confetti-layer");
const partyParrotPopLayer = document.getElementById("party-parrot-pop-layer");
const partyCrackers = document.querySelectorAll(".party-cracker");
const speedMeter = document.querySelector(".speed-meter");
const speedFill = document.getElementById("speed-fill");
const speedValue = document.getElementById("speed-value");
const spinDirection = document.getElementById("spin-direction");
const partyGaugeElement = document.querySelector(".party-gauge");
const partyGaugeFill = document.getElementById("party-gauge-fill");
const partyGaugeValue = document.getElementById("party-gauge-value");
const resetPartyGaugeButton = document.getElementById("reset-party-gauge");
const debugBoostButton = document.getElementById("debug-boost");
const doublePartyGaugeButton = document.getElementById("double-party-gauge");
const partyGaugeLockValue = document.getElementById("party-gauge-lock-value");
const togglePartyGaugeLockButton = document.getElementById("toggle-party-gauge-lock");
const partyMusic = document.getElementById("party-music");
const partyMusicFileInput = document.getElementById("party-music-file");
const partyMusicFileName = document.getElementById("party-music-file-name");
const partyMusicPlayButton = document.getElementById("party-music-play");
const partyMusicVolume = document.getElementById("party-music-volume");
const partyMusicVolumeValue = document.getElementById("party-music-volume-value");
const partyMusicStatus = document.getElementById("party-music-status");
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
let partyGaugeDoubleEnabled = false;
let partyGaugeLocked = false;
let lockedPartyGaugeValue = 0;
let partyConfettiRainTimer = null;
let partyConfettiRainMode = "off";
let partyParrotPopTimer = null;
let partyParrotPopMode = "off";
let partyMusicGaugeState = null;
let activePartyMusicObjectUrl = null;
let pendingPartyMusicSwitch = null;
let currentPartyMusicName = "default.mp3";
let partyCrackerArmed = true;
let partyMaxCrackerArmed = true;
let partyAudioContext = null;
let partyCrackerNoiseBuffer = null;
let partyPopupArmed = true;

// カーソル位置に白い光を追従させ、動いた道筋にも短命な粒を残します。
let lastTrailPointerPosition = null;
let activeCursorTrailParticles = 0;
let cursorTrailFollower = null;
const cursorTrailSpacing = 12;
const cursorTrailParticleLimit = 32;
const cursorTrailReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

document.addEventListener("pointermove", (event) => {
    // タッチ操作では画面を覆う演出になりやすいため、マウスとペンだけを対象にします。
    if (event.pointerType === "touch") {
        lastTrailPointerPosition = null;
        return;
    }

    const currentPosition = { x: event.clientX, y: event.clientY };
    // この白い光はカーソルが止まっている間も残り、最後の座標に追従し続けます。
    if (!cursorTrailFollower) {
        cursorTrailFollower = document.createElement("span");
        cursorTrailFollower.className = "party-cursor-trail-follower";
        cursorTrailFollower.setAttribute("aria-hidden", "true");
        document.body.append(cursorTrailFollower);
    }
    cursorTrailFollower.style.left = `${currentPosition.x}px`;
    cursorTrailFollower.style.top = `${currentPosition.y}px`;

    // 動きを減らす設定でも白いカーソル光は追従し、後ろの粒だけを停止します。
    if (cursorTrailReducedMotion.matches) {
        lastTrailPointerPosition = currentPosition;
        return;
    }

    if (lastTrailPointerPosition) {
        const dx = currentPosition.x - lastTrailPointerPosition.x;
        const dy = currentPosition.y - lastTrailPointerPosition.y;
        const distance = Math.hypot(dx, dy);

        // 細かいイベントごとに粒を作らず、一定距離ごとに生成数を抑えます。
        if (distance >= cursorTrailSpacing && activeCursorTrailParticles < cursorTrailParticleLimit) {
            const particle = document.createElement("span");
            particle.className = "party-cursor-trail-particle";
            particle.setAttribute("aria-hidden", "true");
            particle.style.left = `${currentPosition.x}px`;
            particle.style.top = `${currentPosition.y}px`;
            particle.style.setProperty("--trail-size", `${7 + Math.random() * 6}px`);
            activeCursorTrailParticles += 1;
            document.body.append(particle);

            // アニメーションが終わった粒は削除し、DOM要素が増え続けないようにします。
            let particleRemoved = false;
            const removeTrailParticle = () => {
                if (particleRemoved) return;
                particleRemoved = true;
                particle.remove();
                activeCursorTrailParticles -= 1;
            };
            particle.addEventListener("animationend", removeTrailParticle, { once: true });
            // 動作中にOSの「視差効果を減らす」設定へ切り替わっても確実に掃除します。
            window.setTimeout(removeTrailParticle, 700);
        }
    }
    lastTrailPointerPosition = currentPosition;
});
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
// 50%から曲を小さく再生し始め、ゲージ上昇に合わせて音量を上げます。
const partyMusicThreshold = 50;
const partyMusicVolumeRampStart = 50;
const partyMusicVolumeCeiling = 0.9;
const partyConfettiThreshold = 70;
const partyConfettiRearmThreshold = 60;
const partyMaxCrackerRearmThreshold = 95;
const partyConfettiRainThreshold = 55;
const partyParrotPopThreshold = 55;
const partyParrotPopMaxCount = 24;
const partyConfettiRainInterval = 240;
const partyConfettiRainPerWave = 3;
const partyConfettiRainMaxInterval = 150;
const partyConfettiRainMaxPerWave = 6;
// 70%の発射分が残っていても、満タン時の3連発が十分に出せる上限です。
const partyConfettiMaxPieces = 380;
const partyConfettiBurstPerSide = 46;
const partyConfettiColors = ["#ff4d6d", "#ffb627", "#fff36b", "#52d273", "#42c9ed", "#536dfe", "#b84dff"];
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

    unlockPartyAudio();
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
    unlockPartyAudio();
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
function setPartyMusicStatus(message) {
    partyMusicStatus.value = message;
    partyMusicStatus.textContent = message;
}

// ゲージ50〜100%を0〜90%の音量に変換します。音量スライダーは最大音量の上限です。
function updatePartyMusicVolume() {
    const progress = Math.min(1, Math.max(0,
        (partyGauge - partyMusicVolumeRampStart) / (100 - partyMusicVolumeRampStart)));
    // smoothstepで出だしと最大付近をなめらかにし、急な音量変化を抑えます。
    const smoothProgress = progress * progress * (3 - 2 * progress);
    const selectedMaximum = Math.min(Number(partyMusicVolume.value) / 100, partyMusicVolumeCeiling);
    const nextVolume = selectedMaximum * smoothProgress;

    if (Math.abs(partyMusic.volume - nextVolume) > 0.002) {
        partyMusic.volume = nextVolume;
    }
}

function updatePartyMusicPlayButton() {
    const isPlaying = !partyMusic.paused;
    partyMusicPlayButton.textContent = isPlaying ? "再生中" : "再生を試す";
    partyMusicPlayButton.disabled = isPlaying;
    partyMusicPlayButton.setAttribute("aria-pressed", String(isPlaying));
}

// play()がブラウザに拒否された場合もcatchし、手動で再試行できる案内を出します。
function requestPartyMusicPlayback() {
    if (partyGauge < partyMusicThreshold) {
        setPartyMusicStatus(`ゲージが${partyMusicThreshold}%未満のため一時停止中です。`);
        return;
    }
    if (!partyMusic.paused) return;

    const playRequest = partyMusic.play();
    if (playRequest && typeof playRequest.then === "function") {
        playRequest.then(() => {
            setPartyMusicStatus(`再生中: ${currentPartyMusicName}`);
        }).catch((error) => {
            if (error.name === "NotAllowedError") {
                setPartyMusicStatus("自動再生が制限されました。「再生を試す」を押してください。");
            } else {
                setPartyMusicStatus("音楽を再生できません。ファイル形式を確認してください。");
            }
        });
    }
}

// ゲージの状態が50%境界を越えた時だけplay/pauseし、フレームごとの連続呼び出しを防ぎます。
function syncPartyMusicWithGauge() {
    const shouldPlay = partyGauge >= partyMusicThreshold;
    if (shouldPlay === partyMusicGaugeState) return;
    partyMusicGaugeState = shouldPlay;

    if (shouldPlay) {
        requestPartyMusicPlayback();
    } else {
        partyMusic.pause();
        setPartyMusicStatus(`ゲージ${partyMusicThreshold}%未満のため一時停止中です。再び達すると続きから再生します。`);
    }
}

function restorePartyMusic(previous) {
    partyMusic.pause();
    partyMusic.addEventListener("loadedmetadata", () => {
        if (Number.isFinite(previous.currentTime) && previous.currentTime > 0) {
            try {
                partyMusic.currentTime = Math.min(previous.currentTime, partyMusic.duration || previous.currentTime);
            } catch {
                // 一部の形式ではシークできないため、曲頭からの再開に切り替えます。
            }
        }
        if (previous.wasPlaying && partyGauge >= partyMusicThreshold) requestPartyMusicPlayback();
    }, { once: true });
    partyMusic.src = previous.source;
    partyMusic.load();
}

// ファイル選択を連続で行った場合、未確定のObject URLを解放し、元の曲情報を引き継ぎます。
function cancelPendingPartyMusicSwitch() {
    if (!pendingPartyMusicSwitch) return null;
    const pending = pendingPartyMusicSwitch;
    partyMusic.removeEventListener("canplay", pending.onCanPlay);
    partyMusic.removeEventListener("error", pending.onError);
    URL.revokeObjectURL(pending.objectUrl);
    pendingPartyMusicSwitch = null;
    return pending.previous;
}

function handlePartyMusicFileSelection() {
    const file = partyMusicFileInput.files?.[0];
    if (!file) {
        setPartyMusicStatus("選択はキャンセルされました。現在の曲を継続します。");
        return;
    }

    const previous = cancelPendingPartyMusicSwitch() || {
        source: partyMusic.currentSrc || partyMusic.src,
        currentTime: Number.isFinite(partyMusic.currentTime) ? partyMusic.currentTime : 0,
        wasPlaying: !partyMusic.paused,
        objectUrl: activePartyMusicObjectUrl,
        name: currentPartyMusicName
    };
    const objectUrl = URL.createObjectURL(file);
    partyMusic.pause();
    partyMusicFileName.textContent = file.name;
    setPartyMusicStatus(`読み込み中: ${file.name}`);

    const onCanPlay = () => {
        partyMusic.removeEventListener("canplay", onCanPlay);
        partyMusic.removeEventListener("error", onError);
        pendingPartyMusicSwitch = null;
        activePartyMusicObjectUrl = objectUrl;
        currentPartyMusicName = file.name;
        if (previous.objectUrl && previous.objectUrl !== objectUrl) {
            URL.revokeObjectURL(previous.objectUrl);
        }

        if (partyGauge >= partyMusicThreshold) {
            requestPartyMusicPlayback();
        } else {
            partyMusic.pause();
            setPartyMusicStatus(`選択済み: ${file.name}（ゲージ${partyMusicThreshold}%以上で再生）`);
        }
    };

    const onError = () => {
        partyMusic.removeEventListener("canplay", onCanPlay);
        partyMusic.removeEventListener("error", onError);
        pendingPartyMusicSwitch = null;
        URL.revokeObjectURL(objectUrl);
        activePartyMusicObjectUrl = previous.objectUrl;
        currentPartyMusicName = previous.name;
        partyMusicFileName.textContent = previous.name;
        restorePartyMusic(previous);
        setPartyMusicStatus(`読み込みに失敗しました。現在の曲「${previous.name}」に戻しました。`);
    };

    pendingPartyMusicSwitch = { objectUrl, onCanPlay, onError, previous };
    partyMusic.addEventListener("canplay", onCanPlay);
    partyMusic.addEventListener("error", onError);
    // 選択済みファイルをゲージ待ちの間にも読み込み、形式エラーを早めに検出します。
    partyMusic.preload = "auto";
    partyMusic.src = objectUrl;
    partyMusic.load();

    // ファイル選択はユーザー操作なので、ゲージが既に50%以上ならその場で再生を試します。
    if (partyGauge >= partyMusicThreshold) requestPartyMusicPlayback();
    partyMusicFileInput.value = "";
}

function retryPartyMusicFromButton() {
    if (partyGauge < partyMusicThreshold) {
        setPartyMusicStatus(`ゲージが${partyMusicThreshold}%未満では再生されません。`);
        return;
    }
    requestPartyMusicPlayback();
}

function updatePartyGauge(speedRatio, elapsed, time) {
    if (partyGaugeLocked) {
        // 固定中は数値を保ちますが、下のUI・発光・背景・発動判定は通常どおり更新します。
        partyGauge = lockedPartyGaugeValue;
    } else if (speedRatio >= partyGaugeThreshold) {
        const chargeRatio = (speedRatio - partyGaugeThreshold) / (1 - partyGaugeThreshold);
        let chargeRate = partyGaugeChargeMinRate
            + (partyGaugeChargeMaxRate - partyGaugeChargeMinRate) * chargeRatio;
        if (partyGaugeDoubleEnabled) chargeRate *= 2;
        partyGauge = Math.min(100, partyGauge + chargeRate * elapsed);
    } else {
        partyGauge = Math.max(0, partyGauge - partyGaugeDecayRate * elapsed);
    }

    const displayedValue = Math.round(partyGauge);
    partyGaugeFill.style.width = `${partyGauge}%`;
    partyGaugeValue.value = `${displayedValue}%`;
    partyGaugeElement.setAttribute("aria-valuenow", displayedValue);
    partyGaugeElement.setAttribute("aria-valuetext", `${displayedValue}%`);
    // 65%からクラッカーを見せます。発射条件（70%）はそのままです。
    partyCrackers.forEach((cracker) => {
        cracker.classList.toggle("is-visible", partyGauge >= 65);
    });
    updatePartyGlow(time);
    updatePartyBackground();
    updatePartyConfettiRain();
    updatePartyParrotPop();
    updatePartyMusicVolume();
    syncPartyMusicWithGauge();

    // 60%以下まで戻ると再装填し、70%へ達した瞬間に一度だけ両側から発射します。
    if (!partyCrackerArmed && partyGauge <= partyConfettiRearmThreshold) {
        partyCrackerArmed = true;
    }
    if (partyCrackerArmed && partyGauge >= partyConfettiThreshold) {
        partyCrackerArmed = false;
        firePartyCrackerVolley();
    }

    // 100%到達時は特別に3連発し、95%以下まで戻ると再び発動可能にします。
    if (!partyMaxCrackerArmed && partyGauge <= partyMaxCrackerRearmThreshold) {
        partyMaxCrackerArmed = true;
    }
    if (partyMaxCrackerArmed && partyGauge >= 100) {
        partyMaxCrackerArmed = false;
        firePartyCrackerTriple();
    }

    // 55%で発動後、45%以下まで下がるまでは再発動を待ちます。
    if (!partyPopupArmed && partyGauge <= partyPopupRearm) {
        partyPopupArmed = true;
    }
    if (partyPopupArmed && partyGauge >= partyPopupTrigger) {
        partyPopupArmed = false;
        showPartyPopup("テンション上がってきた！！");
    }
}

// 発射ごとに左右のクラッカーを反動させ、左右それぞれから紙吹雪を一斉に放ちます。
function firePartyCrackerVolley() {
    playPartyCrackerSound();

    partyCrackers.forEach((cracker) => {
        cracker.classList.remove("is-firing");
        void cracker.offsetWidth;
        cracker.classList.add("is-firing");
        cracker.addEventListener("animationend", () => cracker.classList.remove("is-firing"), { once: true });
    });

    for (const side of ["left", "right"]) {
        const remainingSlots = partyConfettiMaxPieces - partyConfettiLayer.childElementCount;
        const burstCount = Math.min(partyConfettiBurstPerSide, Math.max(remainingSlots, 0));
        for (let index = 0; index < burstCount; index += 1) {
            createPartyConfettiPiece(side);
        }
    }
}

// 満タン時に発射音・反動・紙吹雪を200ms間隔で3回続けて出します。
function firePartyCrackerTriple() {
    for (let shot = 0; shot < 3; shot += 1) {
        setTimeout(firePartyCrackerVolley, shot * 200);
    }
}

// ゲージ帯が変わった時だけ出現タイマーを切り替えます。画面内の複製はそのまま飛び続けます。
function updatePartyParrotPop() {
    const nextMode = partyGauge >= 85
        ? "max"
        : partyGauge >= 70 ? "party" : partyGauge >= partyParrotPopThreshold ? "warmup" : "off";
    if (nextMode === partyParrotPopMode) return;

    if (partyParrotPopTimer !== null) {
        window.clearTimeout(partyParrotPopTimer);
        partyParrotPopTimer = null;
    }
    partyParrotPopMode = nextMode;
    if (nextMode !== "off") schedulePartyParrotPop();
}

// タイマーは常に一つだけ保持し、出現間隔に少しランダム性を加えます。
function schedulePartyParrotPop() {
    const intervals = {
        warmup: [1800, 2600],
        party: [650, 950],
        max: [250, 380],
    };
    const [minimumDelay, maximumDelay] = intervals[partyParrotPopMode];
    const delay = minimumDelay + Math.random() * (maximumDelay - minimumDelay);

    partyParrotPopTimer = window.setTimeout(() => {
        partyParrotPopTimer = null;
        if (partyGauge < partyParrotPopThreshold || partyParrotPopMode === "off") {
            updatePartyParrotPop();
            return;
        }
        createPartyParrotPop();
        schedulePartyParrotPop();
    }, delay);
}

// 既存のコマ画像から複製を作り、画面下から上へ飛ばします。メイン画像には触れません。
function createPartyParrotPop() {
    if (partyParrotPopLayer.childElementCount >= partyParrotPopMaxCount) return;

    const parrot = document.createElement("img");
    const isSmallScreen = window.innerWidth < 600;
    const size = Math.min(isSmallScreen ? 64 : 92, 46 + Math.random() * 46);
    const maxLeft = Math.max(0, window.innerWidth - size);
    const horizontalDrift = (Math.random() - 0.5) * Math.min(window.innerWidth * 0.42, 360);
    const rotationStart = (Math.random() - 0.5) * 50;
    const rotationEnd = (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 720);
    // 火山の噴き上がりを表す頂点の高さと、噴き上がった後に落ちる距離です。
    const eruptionHeight = window.innerHeight * (0.8 + Math.random() * 0.4) + size;
    const fallDistance = eruptionHeight + window.innerHeight * (0.16 + Math.random() * 0.12);
    const duration = partyParrotPopMode === "max"
        ? 3.4 + Math.random() * 1.4
        : partyParrotPopMode === "party" ? 4 + Math.random() * 1.5 : 4.8 + Math.random() * 1.6;

    parrot.className = "party-parrot-pop";
    parrot.src = frames[Math.floor(Math.random() * frames.length)];
    parrot.alt = "";
    parrot.draggable = false;
    parrot.style.width = `${size}px`;
    parrot.style.left = `${Math.random() * maxLeft}px`;
    parrot.style.bottom = `${-size * 0.9}px`;
    parrot.style.setProperty("--parrot-burst-y", `${-window.innerHeight * 0.16}px`);
    parrot.style.setProperty("--parrot-apex-y", `${-eruptionHeight}px`);
    parrot.style.setProperty("--parrot-fall-y", `${fallDistance}px`);
    parrot.style.setProperty("--parrot-drift-mid", `${horizontalDrift * 0.62}px`);
    parrot.style.setProperty("--parrot-drift-end", `${horizontalDrift * 1.12}px`);
    parrot.style.setProperty("--parrot-rotation-start", `${rotationStart}deg`);
    parrot.style.setProperty("--parrot-rotation-end", `${rotationEnd}deg`);
    parrot.style.setProperty("--parrot-rotation-fall", `${rotationEnd * 1.35}deg`);
    parrot.style.animationDuration = `${duration}s`;
    parrot.addEventListener("animationend", () => parrot.remove(), { once: true });
    parrot.addEventListener("animationcancel", () => parrot.remove(), { once: true });
    partyParrotPopLayer.append(parrot);
}

// 55%以上なら上端から定期的に降らせ、下回ったら新しい紙吹雪の生成だけ止めます。
function updatePartyConfettiRain() {
    const nextMode = partyGauge >= 100
        ? "max"
        : partyGauge >= partyConfettiRainThreshold ? "normal" : "off";
    if (nextMode === partyConfettiRainMode) return;

    if (partyConfettiRainTimer !== null) {
        window.clearInterval(partyConfettiRainTimer);
    }
    partyConfettiRainTimer = null;
    partyConfettiRainMode = nextMode;
    if (nextMode === "off") return;

    // 100%では間隔を短くし、1回あたりの紙片数も倍にして密度を上げます。
    const interval = nextMode === "max" ? partyConfettiRainMaxInterval : partyConfettiRainInterval;
    const piecesPerWave = nextMode === "max" ? partyConfettiRainMaxPerWave : partyConfettiRainPerWave;
    partyConfettiRainTimer = window.setInterval(() => {
        for (let index = 0; index < piecesPerWave; index += 1) {
            createPartyConfettiRainPiece();
        }
    }, interval);
}

// 画面上端から落ちる小さな紙片を生成します。通常の紙吹雪と同じ上限を共有します。
function createPartyConfettiRainPiece() {
    if (partyConfettiLayer.childElementCount >= partyConfettiMaxPieces) return;

    const piece = document.createElement("span");
    const drift = (Math.random() - 0.5) * Math.min(window.innerWidth * 0.2, 220);
    const spin = (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 900);

    piece.className = "party-confetti-piece party-confetti-rain-piece";
    piece.style.left = `${Math.random() * window.innerWidth}px`;
    piece.style.top = `${-20 - Math.random() * 70}px`;
    piece.style.width = `${5 + Math.random() * 7}px`;
    piece.style.height = `${7 + Math.random() * 10}px`;
    piece.style.backgroundColor = partyConfettiColors[Math.floor(Math.random() * partyConfettiColors.length)];
    piece.style.setProperty("--rain-mid-x", `${drift * 0.45}px`);
    piece.style.setProperty("--rain-drift-x", `${drift}px`);
    piece.style.setProperty("--rain-mid-spin", `${spin * 0.5}deg`);
    piece.style.setProperty("--rain-spin", `${spin}deg`);
    piece.style.animationDuration = `${3.5 + Math.random() * 2}s`;
    piece.addEventListener("animationend", () => piece.remove(), { once: true });
    partyConfettiLayer.append(piece);
}

// 発射口付近から勢いよく飛び出し、その後に落下する紙片を一つ作ります。
function createPartyConfettiPiece(side) {
    const piece = document.createElement("span");
    const isLeft = side === "left";
    // 紙吹雪をクラッカー本体の内向きの端から出し、発射口と動きをつなげます。
    const cracker = Array.from(partyCrackers).find((item) => item.classList.contains(`party-cracker-${side}`));
    const crackerBounds = cracker?.getBoundingClientRect();
    const launchX = crackerBounds
        ? (isLeft ? crackerBounds.right - 3 : crackerBounds.left + 3)
        : (isLeft ? 80 : window.innerWidth - 80);
    const launchY = crackerBounds
        ? crackerBounds.top + crackerBounds.height * 0.3
        : window.innerHeight - 60;
    const burstX = (window.innerWidth * (0.28 + Math.random() * 0.22)) * (isLeft ? 1 : -1);
    // 発射直後の上昇距離を増やし、紙吹雪がより高く舞い上がるようにします。
    const burstY = -window.innerHeight * (0.48 + Math.random() * 0.32);
    const spin = (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 1080);
    const fallX = burstX + (Math.random() - 0.5) * window.innerWidth * 0.35;
    const fallY = window.innerHeight * (0.55 + Math.random() * 0.5);

    piece.className = "party-confetti-piece";
    piece.style.left = `${launchX + (Math.random() - 0.5) * 20}px`;
    piece.style.top = `${launchY + (Math.random() - 0.5) * 18}px`;
    piece.style.width = `${6 + Math.random() * 8}px`;
    piece.style.height = `${8 + Math.random() * 12}px`;
    piece.style.backgroundColor = partyConfettiColors[Math.floor(Math.random() * partyConfettiColors.length)];
    piece.style.setProperty("--confetti-mid-x", `${burstX * 0.55}px`);
    piece.style.setProperty("--confetti-mid-y", `${burstY * 0.55}px`);
    piece.style.setProperty("--confetti-arc-x", `${burstX * 1.12}px`);
    piece.style.setProperty("--confetti-arc-y", `${burstY * 0.72}px`);
    piece.style.setProperty("--confetti-fall-x", `${fallX}px`);
    piece.style.setProperty("--confetti-fall-y", `${fallY}px`);
    piece.style.setProperty("--confetti-mid-spin", `${spin * 0.35}deg`);
    piece.style.setProperty("--confetti-arc-spin", `${spin * 0.7}deg`);
    piece.style.setProperty("--confetti-spin", `${spin}deg`);
    piece.style.animationDuration = `${2.7 + Math.random() * 1.8}s`;
    piece.style.animationDelay = `${Math.random() * 0.12}s`;
    piece.addEventListener("animationend", () => piece.remove(), { once: true });
    partyConfettiLayer.append(piece);
}

// ユーザー操作中にAudioContextを準備し、後からの自動再生制限に備えます。
function unlockPartyAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!partyAudioContext) {
        partyAudioContext = new AudioContextClass();
        const noiseLength = Math.floor(partyAudioContext.sampleRate * 0.2);
        partyCrackerNoiseBuffer = partyAudioContext.createBuffer(1, noiseLength, partyAudioContext.sampleRate);
        const noiseSamples = partyCrackerNoiseBuffer.getChannelData(0);
        for (let index = 0; index < noiseSamples.length; index += 1) {
            noiseSamples[index] = Math.random() * 2 - 1;
        }
    }

    if (partyAudioContext.state === "suspended") {
        partyAudioContext.resume().catch(() => {});
    }
}

// 録音ファイルは使わず、短いノイズと低音を重ねて「パンッ」という音を合成します。
function playPartyCrackerSound() {
    if (!partyAudioContext || partyAudioContext.state !== "running" || !partyCrackerNoiseBuffer) return;

    const now = partyAudioContext.currentTime;
    const noise = partyAudioContext.createBufferSource();
    const filter = partyAudioContext.createBiquadFilter();
    const noiseGain = partyAudioContext.createGain();
    noise.buffer = partyCrackerNoiseBuffer;
    filter.type = "highpass";
    filter.frequency.setValueAtTime(500, now);
    noiseGain.gain.setValueAtTime(0.42, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(partyAudioContext.destination);
    noise.start(now);
    noise.stop(now + 0.2);

    const thump = partyAudioContext.createOscillator();
    const thumpGain = partyAudioContext.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(115, now);
    thump.frequency.exponentialRampToValueAtTime(48, now + 0.12);
    thumpGain.gain.setValueAtTime(0.22, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    thump.connect(thumpGain);
    thumpGain.connect(partyAudioContext.destination);
    thump.start(now);
    thump.stop(now + 0.14);
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
    partyGaugeLocked = false;
    togglePartyGaugeLockButton.textContent = "固定";
    togglePartyGaugeLockButton.setAttribute("aria-pressed", "false");
    partyGaugeFill.style.width = "0%";
    partyGaugeValue.value = "0%";
    partyGaugeElement.setAttribute("aria-valuenow", "0");
    partyGaugeElement.setAttribute("aria-valuetext", "0%");
    updatePartyGlow(performance.now());
    updatePartyBackground();
}

// 指定した値で固定するか、固定を解除します。値は0〜100の範囲に収めます。
function togglePartyGaugeLock() {
    if (partyGaugeLocked) {
        partyGaugeLocked = false;
        togglePartyGaugeLockButton.textContent = "固定";
        togglePartyGaugeLockButton.setAttribute("aria-pressed", "false");
        return;
    }

    const requestedValue = Number(partyGaugeLockValue.value);
    lockedPartyGaugeValue = Math.min(100, Math.max(0, Number.isFinite(requestedValue) ? requestedValue : 0));
    partyGaugeLockValue.value = String(lockedPartyGaugeValue);
    partyGauge = lockedPartyGaugeValue;
    partyGaugeLocked = true;
    togglePartyGaugeLockButton.textContent = "固定中";
    togglePartyGaugeLockButton.setAttribute("aria-pressed", "true");
}

// 上昇率2倍は切替式で、オフにすると元の上昇率に戻ります。
function togglePartyGaugeDouble() {
    partyGaugeDoubleEnabled = !partyGaugeDoubleEnabled;
    doublePartyGaugeButton.setAttribute("aria-pressed", String(partyGaugeDoubleEnabled));
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
document.querySelector(".party-debug-panel").addEventListener("pointerdown", (event) => event.stopPropagation());
doublePartyGaugeButton.addEventListener("click", togglePartyGaugeDouble);
togglePartyGaugeLockButton.addEventListener("click", togglePartyGaugeLock);
partyMusic.loop = true;
updatePartyMusicVolume();
partyMusic.addEventListener("play", updatePartyMusicPlayButton);
partyMusic.addEventListener("pause", updatePartyMusicPlayButton);
partyMusic.addEventListener("error", () => {
    if (!pendingPartyMusicSwitch) {
        setPartyMusicStatus("音楽を読み込めません。ファイルの場所または形式を確認してください。");
    }
});
partyMusicFileInput.addEventListener("change", handlePartyMusicFileSelection);
partyMusicFileInput.addEventListener("cancel", () => {
    setPartyMusicStatus("選択はキャンセルされました。現在の曲を継続します。");
});
partyMusicPlayButton.addEventListener("click", retryPartyMusicFromButton);
partyMusicVolume.addEventListener("input", () => {
    updatePartyMusicVolume();
    partyMusicVolumeValue.value = `${partyMusicVolume.value}%`;
    partyMusicVolumeValue.textContent = `${partyMusicVolume.value}%`;
});
document.querySelector(".party-music-panel").addEventListener("pointerdown", (event) => event.stopPropagation());
window.addEventListener("pagehide", () => {
    if (pendingPartyMusicSwitch) URL.revokeObjectURL(pendingPartyMusicSwitch.objectUrl);
    if (activePartyMusicObjectUrl) URL.revokeObjectURL(activePartyMusicObjectUrl);
});
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
// ゲージ値を演出の状態に変換します。状態が帯をまたいだ時だけCSSクラスを変更します。
let partyBackgroundState = "normal";
function updatePartyBackground() {
    let nextState = "normal";

    if (partyGauge >= 98) {
        nextState = "party-rainbow-flow-fast";
    } else if (partyGauge >= 90) {
        nextState = "party-rainbow-flow-medium";
    } else if (partyGauge >= 85) {
        nextState = "party-rainbow-flow-slow";
    } else if (partyGauge >= 80) {
        nextState = "party-rainbow-still";
    } else if (partyGauge >= 55) {
        nextState = "party-glow-strong";
    } else if (partyGauge >= 20) {
        nextState = "party-glow-soft";
    }

    // 毎フレーム判定しても、同じ状態ならDOMを更新しないため処理は軽量です。
    if (nextState === partyBackgroundState) return;
    document.body.classList.remove(partyBackgroundState);
    if (nextState !== "normal") document.body.classList.add(nextState);
    partyBackgroundState = nextState;
}
