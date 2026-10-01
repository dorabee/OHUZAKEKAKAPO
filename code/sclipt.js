const kakapo = document.getElementById("kakapo");


// ==============================
// カカポの回転に関する変数
// ==============================

let rotation = 0;
let velocity = 0;


// ==============================
// マウスに関する変数
// ==============================

let isDragging = false;
let previousAngle = null;


// ==============================
// マウスを押したとき
// ==============================

document.addEventListener("pointerdown", (event) => {

    isDragging = true;

    previousAngle = getMouseAngle(event);

});


// ==============================
// マウスを動かしたとき
// ==============================

document.addEventListener("pointermove", (event) => {

    if (!isDragging) {
        return;
    }


    // 今のマウスの角度を取得
    const currentAngle = getMouseAngle(event);


    // 前回の角度との差
    let angleDifference = currentAngle - previousAngle;


    // 角度が180度を超えた場合の補正
    if (angleDifference > Math.PI) {
        angleDifference -= Math.PI * 2;
    }

    if (angleDifference < -Math.PI) {
        angleDifference += Math.PI * 2;
    }


    // 時計回りの場合だけ加速
    if (angleDifference > 0) {

        velocity += angleDifference * 2;

    }


    // 今回の角度を保存
    previousAngle = currentAngle;

});


// ==============================
// マウスを離したとき
// ==============================

document.addEventListener("pointerup", () => {

    isDragging = false;

    previousAngle = null;

});


// ==============================
// マウスがカカポの中心から
// 何度の位置にいるか計算する
// ==============================

function getMouseAngle(event) {

    const rect = kakapo.getBoundingClientRect();


    // カカポの中心
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;


    // カカポの中心から見た
    // マウスの角度
    const angle = Math.atan2(
        event.clientY - centerY,
        event.clientX - centerX
    );


    return angle;

}


// ==============================
// カカポを動かす
// ==============================

function animate() {

    // 現在の速度だけ回転する
    rotation += velocity;


    // 少しずつ減速する
    velocity *= 0.98;


    // カカポを回転させる
    kakapo.style.transform =
        `translate(-50%, -50%) rotate(${rotation}rad)`;


    // 次のフレームでも実行
    requestAnimationFrame(animate);

}


// アニメーション開始
animate();