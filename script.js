/* =========================================================
   Интерактивная демонстрация электродвигателя постоянного тока
   Рамка с током (ротор) между полюсами постоянного магнита
   + коллектор и щётки, подключённые к батарее.

   Наглядность:
   - проводники с током подсвечиваются жёлтым «свечением»;
   - на активных проводниках показаны силы Ампера (зелёные стрелки);
   - направления тока в поперечных сечениях: точка (к нам) / крест (от нас);
   - переключатель полярности разворачивает батарею -> ток течёт обратно
     -> двигатель крутится в другую сторону;
   - переключатель вращения включает/выключает движение.
   ========================================================= */

"use strict";

const canvas = document.getElementById("motorCanvas");
const ctx = canvas.getContext("2d");

// ---- Параметры модели ------------------------------------
const CX = 380;          // центр ротора по X
const CY = 250;          // центр ротора по Y
const RADIUS = 120;      // "радиус" рамки (половина диагонали)
const WIRE_HALF = 14;    // толщина провода на схеме (для круглых сечений)

let angle = 0;           // текущий угол рамки, рад
let direction = 1;       // направление вращения: +1 или -1
let running = true;      // включено ли вращение
let speed = 0.6;         // множитель скорости (медленно по умолчанию)

let lastTime = null;

// ---- Цвета -------------------------------------------------
const COLORS = {
    bgTop: "#eef2f7",
    magnetN: "#ef4444",
    magnetS: "#3b82f6",
    wire: "#334155",
    currentGlow: "rgba(250, 204, 21, 0.85)",
    forceArrow: "#16a34a",
    torqueArc: "#8b5cf6",
    batteryPlus: "#dc2626",
    batteryMinus: "#1e293b",
    text: "#0f172a",
    muted: "#64748b",
};

// ---- Управление UI ----------------------------------------
const toggleRotationEl = document.getElementById("toggleRotation");
const togglePolarityEl = document.getElementById("togglePolarity");
const speedRangeEl = document.getElementById("speedRange");
const rotationStateEl = document.getElementById("rotationState");
const polarityStateEl = document.getElementById("polarityState");
const speedValueEl = document.getElementById("speedValue");

toggleRotationEl.addEventListener("change", () => {
    running = toggleRotationEl.checked;
    rotationStateEl.textContent = running ? "Вкл" : "Выкл";
});

togglePolarityEl.addEventListener("change", () => {
    // Меняем полярность батареи -> направление тока -> направление вращения
    direction = togglePolarityEl.checked ? -1 : 1;
    polarityStateEl.textContent = togglePolarityEl.checked ? "Обратная" : "Прямая";
});

speedRangeEl.addEventListener("input", () => {
    speed = parseFloat(speedRangeEl.value);
    speedValueEl.textContent = speed.toFixed(1) + "×";
});

// ---- Вспомогательные функции рисования ----------------------
function drawArrow(x1, y1, x2, y2, color, width = 3, headLen = 12) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const ang = Math.atan2(dy, dx);

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(ang - Math.PI / 6),
        y2 - headLen * Math.sin(ang - Math.PI / 6));
    ctx.lineTo(x2 - headLen * Math.cos(ang + Math.PI / 6),
        y2 - headLen * Math.sin(ang + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
}

function label(text, x, y, color = COLORS.text, font = "bold 16px Segoe UI") {
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
}

// Ток «к нам» — точка в кружке; «от нас» — крестик
function drawCurrentSymbol(x, y, towardViewer, glowOn) {
    ctx.save();

    if (glowOn) {
        // Жёлтая подсветка зоны с током
        const grad = ctx.createRadialGradient(x, y, 4, x, y, 34);
        grad.addColorStop(0, "rgba(250,204,21,0.95)");
        grad.addColorStop(1, "rgba(250,204,21,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, 34, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORS.wire;
    ctx.fillStyle = glowOn ? "#fef9c3" : "#e2e8f0";
    ctx.beginPath();
    ctx.arc(x, y, WIRE_HALF, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = towardViewer ? "#b45309" : "#334155";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 3;

    if (towardViewer) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    } else {
        const r = 7;
        ctx.beginPath();
        ctx.moveTo(x - r, y - r);
        ctx.lineTo(x + r, y + r);
        ctx.moveTo(x + r, y - r);
        ctx.lineTo(x - r, y + r);
        ctx.stroke();
    }
    ctx.restore();
}

// ---- Статичные части двигателя ------------------------------

// Классика учебника: N слева, S справа, поле горизонтально
function drawMagnets() {
    // Левый магнит — N
    roundRect(40, 130, 120, 240, 14, COLORS.magnetN);
    label("N", 100, 250, "#fff", "bold 40px Segoe UI");

    // Правый магнит — S
    roundRect(600, 130, 120, 240, 14, COLORS.magnetS);
    label("S", 660, 250, "#fff", "bold 40px Segoe UI");

    // Линии магнитного поля между полюсами
    ctx.save();
    ctx.strokeStyle = "rgba(100,116,139,0.55)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    for (let i = 0; i < 3; i++) {
        const y = 190 + i * 60;
        ctx.beginPath();
        ctx.moveTo(170, y);
        ctx.lineTo(590, y);
        ctx.stroke();
    }
    ctx.setLineDash([]);
    // Стрелки поля N -> S
    drawArrow(360, 190, 400, 190, "rgba(71,85,105,0.9)", 2.5, 10);
    drawArrow(360, 250, 400, 250, "rgba(71,85,105,0.9)", 2.5, 10);
    drawArrow(360, 310, 400, 310, "rgba(71,85,105,0.9)", 2.5, 10);
    label("магнитное поле  B", 380, 152, COLORS.muted, "italic 14px Segoe UI");
    ctx.restore();
}

function roundRect(x, y, w, h, r, fill) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
}

// Коллектор (полукольца) + щётки + батарея со схемой подключения
function drawCircuit() {
    ctx.save();

    // Щётки — две серые колодки над коллектором
    ctx.fillStyle = "#475569";
    roundRect(CX - 78, 372, 40, 16, 4, "#475569");
    roundRect(CX + 38, 372, 40, 16, 4, "#475569");
    label("щётка", CX - 58, 402, COLORS.muted, "12px Segoe UI");
    label("щётка", CX + 58, 402, COLORS.muted, "12px Segoe UI");

    // Провода от щёток вниз к батарее
    const leftBrushX = CX - 58;
    const rightBrushX = CX + 58;
    const battY = 470;

    ctx.strokeStyle = COLORS.wire;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(leftBrushX, 388);
    ctx.lineTo(leftBrushX, battY);
    ctx.lineTo(CX - 46, battY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rightBrushX, 388);
    ctx.lineTo(rightBrushX, battY);
    ctx.lineTo(CX + 46, battY);
    ctx.stroke();

    // Батарея: символ из двух пар пластин. Полярность зависит от `direction`.
    // При прямой полярности "+" слева, при обратной — справа.
    const plusLeft = direction === 1;

    // Корпус батареи
    roundRect(CX - 46, battY - 16, 92, 32, 6, "#f1f5f9");
    ctx.strokeStyle = COLORS.wire;
    ctx.lineWidth = 2;
    ctx.strokeRect(CX - 46, battY - 16, 92, 32);

    // Пластины внутри
    const drawPlate = (x, long, color) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = long ? 5 : 2.5;
        ctx.beginPath();
        ctx.moveTo(x, battY - (long ? 12 : 7));
        ctx.lineTo(x, battY + (long ? 12 : 7));
        ctx.stroke();
    };
    if (plusLeft) {
        drawPlate(CX - 28, true, COLORS.batteryPlus);   // длинная = +
        drawPlate(CX - 16, false, COLORS.batteryMinus); // короткая = -
        drawPlate(CX + 8, true, COLORS.batteryPlus);
        drawPlate(CX + 20, false, COLORS.batteryMinus);
    } else {
        drawPlate(CX - 28, false, COLORS.batteryMinus);
        drawPlate(CX - 16, true, COLORS.batteryPlus);
        drawPlate(CX + 8, false, COLORS.batteryMinus);
        drawPlate(CX + 20, true, COLORS.batteryPlus);
    }

    // Знаки +/- у проводов
    label(plusLeft ? "+" : "−", leftBrushX - 14, battY, plusLeft ? COLORS.batteryPlus : COLORS.batteryMinus, "bold 20px Segoe UI");
    label(plusLeft ? "−" : "+", rightBrushX + 14, battY, plusLeft ? COLORS.batteryMinus : COLORS.batteryPlus, "bold 20px Segoe UI");

    label("источник тока (батарея)", CX, battY + 34, COLORS.muted, "13px Segoe UI");

    ctx.restore();
}

// ---- Ротор: рамка с током -----------------------------------
// Рамка — прямоугольник, вращается вокруг центра (CX, CY).
// Две стороны рамки перпендикулярны плоскости экрана (их видим как круги):
//   сторона A и сторона B — именно на них действуют силы Ампера.
// Две стороны — в плоскости экрана (соединения, рисуем тонко).

function drawRotor() {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Положения двух "активных" сторон (поперечных сечений)
    const ax = CX + RADIUS * cosA;
    const ay = CY - RADIUS * sinA; // ось Y на экране вниз — инвертируем
    const bx = CX - RADIUS * cosA;
    const by = CY + RADIUS * sinA;

    // Направление тока в этих проводниках зависит от полярности.
    // При прямой полярности: в точке A ток «к нам», в точке B — «от нас».
    const aTowardViewer = direction === 1;

    // Силы Ампера: F = I L × B. Поле B направлено от N к S (вправо, +x).
    // Если ток «к нам» (+z), сила направлена вверх (−y на экране).
    // Если ток «от нас» — сила вниз. Это даёт момент, вращающий рамку.
    const forceLen = 74;
    let faDx = 0, faDy = 0, fbDx = 0, fbDy = 0;
    if (aTowardViewer) {
        faDy = -forceLen; faDx = 0;   // A толкается вверх
        fbDy = +forceLen;             // B толкается вниз
    } else {
        faDy = +forceLen;
        fbDy = -forceLen;
    }

    // Соединительные стороны рамки (в плоскости экрана)
    ctx.save();
    ctx.strokeStyle = COLORS.wire;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";

    // Перпендикуляр к оси AB для "ширины" рамки в перспективе
    const perp = { x: -sinA, y: -cosA };
    const halfW = 46;

    const p1 = { x: ax + perp.x * halfW, y: ay + perp.y * halfW };
    const p2 = { x: ax - perp.x * halfW, y: ay - perp.y * halfW };
    const p3 = { x: bx - perp.x * halfW, y: by - perp.y * halfW };
    const p4 = { x: bx + perp.x * halfW, y: by + perp.y * halfW };

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.stroke();
    ctx.restore();

    // Ось вращения
    ctx.save();
    ctx.strokeStyle = "rgba(51,65,85,0.5)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(CX, CY - 150);
    ctx.lineTo(CX, CY + 150);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Вал в центре
    ctx.fillStyle = "#94a3b8";
    ctx.strokeStyle = COLORS.wire;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CX, CY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Коллектор — два полукольца, вращаются вместе с рамкой
    drawCommutator(angle);

    // Подсветка зон с током + сами проводники
    const glowOn = running; // подсветка только когда двигатель включён
    drawCurrentSymbol(ax, ay, aTowardViewer, glowOn);
    drawCurrentSymbol(bx, by, !aTowardViewer, glowOn);

    // Метки сторон
    label("A", ax + (ax > CX ? 26 : -26), ay - 24, COLORS.muted, "bold 15px Segoe UI");
    label("B", bx + (bx > CX ? 26 : -26), by - 24, COLORS.muted, "bold 15px Segoe UI");

    // Стрелки сил Ампера и дуга момента (только когда вращение включено)
    if (running) {
        drawArrow(ax, ay, ax + faDx, ay + faDy, COLORS.forceArrow, 4, 14);
        drawArrow(bx, by, bx + fbDx, by + fbDy, COLORS.forceArrow, 4, 14);
        label("F", ax + faDx * 1.18, ay + faDy * 1.18, COLORS.forceArrow, "bold 16px Segoe UI");
        label("F", bx + fbDx * 1.18, by + fbDy * 1.18, COLORS.forceArrow, "bold 16px Segoe UI");

        drawTorqueArc();
    }
}

function drawCommutator(rot) {
    // Два полукольца вокруг центра, радиус чуть больше вала
    const rOut = 26, rIn = 16;
    ctx.save();
    ctx.lineWidth = 2;

    // Полукольцо 1: rot .. rot+PI
    ctx.beginPath();
    ctx.arc(CX, CY, rOut, rot, rot + Math.PI);
    ctx.arc(CX, CY, rIn, rot + Math.PI, rot, true);
    ctx.closePath();
    ctx.fillStyle = "#d97706";
    ctx.fill();
    ctx.strokeStyle = "#7c2d12";
    ctx.stroke();

    // Полукольцо 2: rot+PI .. rot+2PI
    ctx.beginPath();
    ctx.arc(CX, CY, rOut, rot + Math.PI, rot + 2 * Math.PI);
    ctx.arc(CX, CY, rIn, rot + 2 * Math.PI, rot + Math.PI, true);
    ctx.closePath();
    ctx.fillStyle = "#f59e0b";
    ctx.fill();
    ctx.strokeStyle = "#7c2d12";
    ctx.stroke();

    ctx.restore();
}

function drawTorqueArc() {
    // Фиолетовая дуга со стрелкой — показывает направление вращения ротора.
    //
    // ВАЖНО (исправлено): в canvas ось Y направлена ВНИЗ, а точка A рисуется
    // как (CX + R*cos(angle), CY − R*sin(angle)). Поэтому при росте `angle`
    // (direction = +1) рамка на экране крутится ПРОТИВ часовой стрелки.
    // Значит параметр anticlockwise у ctx.arc() должен быть равен
    // (direction === 1), иначе стрелка момента смотрит против вращения.
    const r = 150;
    const ccw = direction === 1; // direction=+1 -> против часовой на экране
    const start = angle + (ccw ? -0.35 : 0.35);
    const sweep = ccw ? -0.9 : 0.9;

    ctx.save();
    ctx.strokeStyle = COLORS.torqueArc;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(CX, CY, r, start, start + sweep, ccw);
    ctx.stroke();

    // Наконечник стрелки на конце дуги — по касательной в сторону вращения.
    const endAng = start + sweep;
    const ex = CX + r * Math.cos(endAng);
    const ey = CY + r * Math.sin(endAng);
    const tangent = endAng + (ccw ? -Math.PI / 2 : Math.PI / 2);
    const hx = ex + 14 * Math.cos(tangent);
    const hy = ey + 14 * Math.sin(tangent);
    drawArrow(ex, ey, hx, hy, COLORS.torqueArc, 4, 12);

    label("вращающий момент", CX, CY - r - 18, COLORS.torqueArc, "bold 14px Segoe UI");
    ctx.restore();
}

// ---- Кадр ----------------------------------------------------
function frame(now) {
    if (lastTime === null) lastTime = now;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    // Медленное вращение: базовая скорость ~ 0.35 рад/с * множитель
    // При скорости 0.6× это примерно один оборот за ~30 секунд — наглядно для школы.
    if (running) {
        angle += direction * speed * 0.35 * dt;
        if (angle > Math.PI * 2) angle -= Math.PI * 2;
        if (angle < 0) angle += Math.PI * 2;
    }

    // Фон
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, COLORS.bgTop);
    g.addColorStop(1, "#dbe4ee");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawMagnets();
    drawCircuit();
    drawRotor();

    // Статус
    label(running ? "Двигатель включён" : "Двигатель выключен",
        380, 30,
        running ? "#15803d" : "#b91c1c",
        "bold 18px Segoe UI");
    label(direction === 1 ? "Полярность: прямая (вращение против часовой стрелки)"
        : "Полярность: обратная (вращение по часовой стрелке)",
        380, 52, COLORS.muted, "14px Segoe UI");

    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);