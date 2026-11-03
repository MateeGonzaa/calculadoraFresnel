/* ==========================================================================
   FresnelMG — Calculadora de Zona de Fresnel
   F1 [m] = 8.656 × √( D [km] / f [GHz] )   →   truncado a 2 decimales
   ========================================================================== */

const $ = (id) => document.getElementById(id);
const has = (id) => Boolean($(id));

const CONSTANTE_FRESNEL = 8.656;
const KEY_HISTORY = "fresnelHistory";
const KEY_LINKED = "fresnelLinkedData";

let toastTimer;

/* ---------- Utilidades de entrada ---------- */

// Mientras se escribe: solo dígitos y un único separador decimal (coma o punto).
function sanitizeLive(value) {
  let out = "";
  let separatorUsed = false;
  for (const ch of value) {
    if (ch >= "0" && ch <= "9") out += ch;
    else if ((ch === "," || ch === ".") && !separatorUsed) {
      out += ch;
      separatorUsed = true;
    }
  }
  return out;
}

function normalizeInput(value) {
  return value.trim().replace(",", ".");
}

function parsePositiveDecimal(value) {
  const normalized = normalizeInput(value);
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function setError(input, errorElement, message) {
  input.closest(".input-box").classList.toggle("invalid", Boolean(message));
  errorElement.textContent = message || "";
}

function validate(input, errorElement, label) {
  if (!input.value.trim()) {
    setError(input, errorElement, `Ingresá ${label}.`);
    return null;
  }
  const value = parsePositiveDecimal(input.value);
  if (value === null) {
    setError(input, errorElement, "Número inválido. Usá solo dígitos y un único decimal, mayor que cero.");
    return null;
  }
  setError(input, errorElement, "");
  return value;
}

/* ---------- Cálculo ---------- */

function calculateFresnel(d, f) {
  return CONSTANTE_FRESNEL * Math.sqrt(d / f);
}

// Trunca (NO redondea) a 2 decimales. El margen evita el error clásico de
// coma flotante: 0.29 * 100 = 28.999999999999996 → daría 0.28 en vez de 0.29.
function truncateTwo(value) {
  return Math.floor(value * 100 + 1e-9) / 100;
}

/* ---------- Formato ---------- */

const fmtResult = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Para lo que escribió el usuario: se muestra tal cual, sin redondear a 2 decimales.
const fmtInput = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 6 });

const formatNumber = (v) => fmtResult.format(v);
const formatInput = (v) => fmtInput.format(v);

function showToast(message) {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

/* ---------- Almacenamiento (con protección ante errores) ---------- */

function getHistory() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY_HISTORY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function setHistory(history) {
  try { localStorage.setItem(KEY_HISTORY, JSON.stringify(history)); } catch { /* sin storage */ }
}

function saveHistory(item) {
  const history = getHistory();
  history.unshift(item);
  setHistory(history.slice(0, 50));
}

/* ---------- Historial (render seguro, sin innerHTML con datos) ---------- */

function renderHistory() {
  const body = $("historyBody");
  const empty = $("emptyHistory");
  if (!body || !empty) return;

  const searchInput = $("historySearch");
  const search = searchInput ? searchInput.value.trim().toLowerCase().replace(",", ".") : "";
  const history = getHistory();

  const filtered = history.filter((item) =>
    `${item.distance} ${item.frequency} ${item.result}`.toLowerCase().includes(search)
  );

  $("historyCount").textContent = history.length;
  body.replaceChildren();
  empty.style.display = filtered.length ? "none" : "block";
  empty.textContent = history.length
    ? "No hay resultados para esa búsqueda."
    : "Todavía no hay cálculos guardados.";

  filtered.forEach((item) => {
    const row = document.createElement("tr");
    const cells = [
      String(item.date ?? "—"),
      `${formatInput(item.distance)} km`,
      `${formatInput(item.frequency)} GHz`,
    ];
    cells.forEach((text) => {
      const td = document.createElement("td");
      td.textContent = text;
      row.appendChild(td);
    });

    const tdResult = document.createElement("td");
    const strong = document.createElement("strong");
    strong.textContent = `${formatNumber(item.result)} m`;
    tdResult.appendChild(strong);
    row.appendChild(tdResult);

    const tdAction = document.createElement("td");
    const btn = document.createElement("button");
    btn.className = "delete-row";
    btn.title = "Eliminar cálculo";
    btn.setAttribute("aria-label", "Eliminar cálculo");
    btn.dataset.id = item.id;
    btn.textContent = "×";
    tdAction.appendChild(btn);
    row.appendChild(tdAction);

    body.appendChild(row);
  });
}

/* ==========================================================================
   CALCULADORA + SIMULADOR
   ========================================================================== */
if (has("calcForm")) {
  const form = $("calcForm");
  const distance = $("distance");
  const frequency = $("frequency");
  const distanceError = $("distanceError");
  const frequencyError = $("frequencyError");
  const resultContent = $("resultContent");
  const emptyResult = $("emptyResult");
  const resultValue = $("resultValue");
  const calculationLine = $("calculationLine");
  const statDistance = $("statDistance");
  const statFrequency = $("statFrequency");

  let lastCalculation = null;

  function getLinkedCalculation() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY_LINKED) || "null");
      if (!data || !Number.isFinite(data.distance) || !Number.isFinite(data.frequency) || !Number.isFinite(data.fresnelRadius)) return null;
      return data;
    } catch {
      return null;
    }
  }

  function saveLinkedCalculation(data) {
    try { localStorage.setItem(KEY_LINKED, JSON.stringify(data)); } catch { /* sin storage */ }
  }

  // La calculadora alimenta al simulador.
  function syncCalculatorWithSimulator(d, f, fresnelRadius) {
    lastCalculation = { distance: d, frequency: f, fresnelRadius };
    saveLinkedCalculation(lastCalculation);

    $("simDistance").textContent = `${formatInput(d)} km`;
    $("simFrequency").textContent = `${formatInput(f)} GHz`;
    $("simRadius").textContent = `${formatNumber(fresnelRadius)} m`;
    $("simAppliedRadius").textContent = `${formatNumber(fresnelRadius)} m aplicados`;

    const simSource = $("simDataSource");
    simSource.textContent = "✓ Radio y parámetros aplicados automáticamente al simulador";
    simSource.classList.add("linked");

    updateSimulation();
  }

  function displayResult(d, f, raw, truncated) {
    emptyResult.classList.add("hidden");
    resultContent.classList.remove("hidden");
    resultValue.textContent = formatNumber(truncated);
    calculationLine.textContent =
      `F₁ = 8.656 × √(${formatInput(d)} / ${formatInput(f)}) = ${raw.toFixed(8).replace(".", ",")}… m`;
    statDistance.textContent = `${formatInput(d)} km`;
    statFrequency.textContent = `${formatInput(f)} GHz`;
    $("resultPanel").animate(
      [{ boxShadow: "0 0 0 rgba(53,213,255,0)" },
       { boxShadow: "0 0 45px rgba(53,213,255,.12)" },
       { boxShadow: "0 24px 80px rgba(0,0,0,.35)" }],
      { duration: 700 }
    );
  }

  function performCalculation(d, f) {
    const raw = calculateFresnel(d, f);
    const truncated = truncateTwo(raw);
    displayResult(d, f, raw, truncated);
    syncCalculatorWithSimulator(d, f, truncated);

    saveHistory({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      distance: d,
      frequency: f,
      result: truncated,
      date: new Date().toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })
    });

    showToast("Cálculo realizado y guardado en el historial.");
    // Se deja a la vista el resultado (antes se saltaba al simulador y el número quedaba oculto).
    $("resultPanel").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const d = validate(distance, distanceError, "la distancia");
    const f = validate(frequency, frequencyError, "la frecuencia");
    if (d === null || f === null) {
      showToast("Revisá los datos ingresados.");
      return;
    }
    performCalculation(d, f);
  });

  [distance, frequency].forEach((input) => {
    input.addEventListener("input", () => {
      const clean = sanitizeLive(input.value);
      if (clean !== input.value) input.value = clean;
      input.closest(".input-box").classList.remove("invalid");
      (input === distance ? distanceError : frequencyError).textContent = "";
    });
  });

  document.querySelectorAll("[data-distance]").forEach((button) => {
    button.addEventListener("click", () => {
      distance.value = button.dataset.distance;
      frequency.value = button.dataset.frequency;
      setError(distance, distanceError, "");
      setError(frequency, frequencyError, "");
      form.requestSubmit();
    });
  });

  // Tabla de frecuencias comunes: al tocar una fila se carga la frecuencia.
  document.querySelectorAll("[data-freq]").forEach((row) => {
    const pick = () => {
      frequency.value = row.dataset.freq;
      setError(frequency, frequencyError, "");
      window.scrollTo({ top: 0, behavior: "smooth" });
      (distance.value.trim() ? frequency : distance).focus({ preventScroll: true });
      showToast(`Frecuencia ${row.dataset.freq} GHz cargada.`);
    };
    row.addEventListener("click", pick);
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); }
    });
  });

  $("clearBtn").addEventListener("click", () => {
    form.reset();
    setError(distance, distanceError, "");
    setError(frequency, frequencyError, "");
    resultContent.classList.add("hidden");
    emptyResult.classList.remove("hidden");
    lastCalculation = null;
    try { localStorage.removeItem(KEY_LINKED); } catch { /* sin storage */ }

    $("simDistance").textContent = "—";
    $("simFrequency").textContent = "—";
    $("simRadius").textContent = "—";
    $("simAppliedRadius").textContent = "Sin datos";
    const simSource = $("simDataSource");
    simSource.textContent = "Esperando un cálculo de la calculadora";
    simSource.classList.remove("linked");

    updateSimulation();
    showToast("Formulario limpiado.");
  });

  /* ------------------------------ SIMULADOR ------------------------------ */
  const SVG_NS = "http://www.w3.org/2000/svg";
  const SIM = {
    groundY: 335,
    leftX: 90,
    rightX: 910,
    pxPerMeter: 2.35,   // misma escala vertical para alturas Y para el radio de Fresnel
    maxZonePx: 190,     // tope visual para que la zona no se salga de la escena
    okRatio: 0.60,      // despeje recomendado: 60 % del radio local
    minRatio: 0.40      // por debajo del 40 % se considera obstruido
  };

  // Compatibilidad: si el index.html es una versión anterior (elipse fija, torres estáticas),
  // se crean acá los elementos que el simulador necesita.
  (function ensureSimulatorElements() {
    const svg = $("scene");
    if (!svg) return;

    let zone = $("fresnelZone");
    if (!zone || zone.tagName.toLowerCase() !== "path") {
      const path = document.createElementNS(SVG_NS, "path");
      path.id = "fresnelZone";
      path.setAttribute("fill", "url(#zoneFill)");
      path.setAttribute("stroke", "#35d5ff");
      path.setAttribute("stroke-width", "2.5");
      path.setAttribute("stroke-dasharray", "9 8");
      path.setAttribute("filter", "url(#glow)");
      if (zone) zone.replaceWith(path); else $("linkLine").before(path);
      zone = path;
    }
    if (!$("fresnelCore")) {
      const core = document.createElementNS(SVG_NS, "path");
      core.id = "fresnelCore";
      core.setAttribute("fill", "rgba(55,230,161,.07)");
      core.setAttribute("stroke", "#37e6a1");
      core.setAttribute("stroke-width", "1.4");
      core.setAttribute("stroke-dasharray", "3 6");
      zone.after(core);
    }

    [["leftTower", "leftMast", "leftHead"], ["rightTower", "rightMast", "rightHead"]].forEach(([tower, mast, head]) => {
      const group = $(tower);
      if (!group || $(mast)) return;
      const headEl = $(head);
      group.querySelectorAll("line").forEach((l) => l.remove());
      const g = document.createElementNS(SVG_NS, "g");
      g.id = mast;
      group.insertBefore(g, headEl);
    });

    ["obstaclePosition"].forEach((id) => {
      const el = $(id);
      if (el) { el.min = "2"; el.max = "98"; }
    });
  })();

  const obstacle = $("obstacle");
  const leftHead = $("leftHead");
  const rightHead = $("rightHead");
  const linkLine = $("linkLine");
  const fresnelZone = $("fresnelZone");
  const fresnelCore = $("fresnelCore");
  const zoneLabel = $("zoneLabel");
  const sceneResult = $("sceneResult");

  function sliderValue(id) { return Number($(id).value); }

  function positionLabel(percent) {
    if (percent < 30) return "Cerca de TX";
    if (percent > 70) return "Cerca de RX";
    return "Centro";
  }

  // F1 calculado = radio máximo (punto medio). En otra posición p del enlace:
  // F(p) = F1 · 2 · √( p · (1 − p) )
  function localFresnelRadius(f1Radius, p) {
    if (!f1Radius || p <= 0 || p >= 1) return 0;
    return f1Radius * 2 * Math.sqrt(p * (1 - p));
  }

  // Torre dibujada según la altura real (antes quedaba fija y la antena "flotaba").
  function svgLine(parent, x1, y1, x2, y2, stroke, width) {
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", x1); line.setAttribute("y1", y1);
    line.setAttribute("x2", x2); line.setAttribute("y2", y2);
    line.setAttribute("stroke", stroke);
    line.setAttribute("stroke-width", width);
    parent.appendChild(line);
  }

  function drawMast(groupId, x, topY) {
    const g = $(groupId);
    g.replaceChildren();
    const base = SIM.groundY;
    const height = Math.max(0, base - topY);
    if (height < 4) return;

    const spread = Math.min(23, 6 + height * 0.12);
    svgLine(g, x, base, x, topY, "#d9e7ef", 7);
    svgLine(g, x - spread, base, x, topY, "#526f80", 3);
    svgLine(g, x + spread, base, x, topY, "#526f80", 3);

    for (let y = base - 40; y > topY + 20; y -= 40) {
      const half = spread * ((y - topY) / height);
      svgLine(g, x - half, y, x + half, y, "#526f80", 3);
    }
  }

  // Lente de Fresnel completa, de TX a RX, siguiendo la línea del enlace.
  function lensPath(leftY, rightY, f1Radius, factor) {
    const steps = 48;
    const top = [];
    const bottom = [];
    const maxPx = Math.min(SIM.maxZonePx, f1Radius * SIM.pxPerMeter) * factor;

    for (let i = 0; i <= steps; i++) {
      const p = i / steps;
      const x = SIM.leftX + (SIM.rightX - SIM.leftX) * p;
      const y = leftY + (rightY - leftY) * p;
      const off = maxPx * 2 * Math.sqrt(p * (1 - p));
      top.push(`${x.toFixed(1)} ${(y - off).toFixed(1)}`);
      bottom.push(`${x.toFixed(1)} ${(y + off).toFixed(1)}`);
    }
    return `M${top.join(" L")} L${bottom.reverse().join(" L")} Z`;
  }

  const STATUS_COLORS = { ok: "#37e6a1", warn: "#f5c451", bad: "#ff657c", idle: "#617b8d" };

  function updateSimulation() {
    if (!obstacle || !leftHead || !rightHead || !linkLine || !fresnelZone) return;

    const txH = sliderValue("txHeight");
    const rxH = sliderValue("rxHeight");
    const obsH = sliderValue("obstacleHeight");
    const pos = sliderValue("obstaclePosition");
    const p = pos / 100;

    const leftY = SIM.groundY - txH * SIM.pxPerMeter;
    const rightY = SIM.groundY - rxH * SIM.pxPerMeter;
    const x = SIM.leftX + (SIM.rightX - SIM.leftX) * p;

    // Antenas + línea de enlace
    drawMast("leftMast", SIM.leftX, leftY);
    drawMast("rightMast", SIM.rightX, rightY);
    leftHead.setAttribute("cy", leftY);
    rightHead.setAttribute("cy", rightY);
    linkLine.setAttribute("x1", SIM.leftX);
    linkLine.setAttribute("y1", leftY);
    linkLine.setAttribute("x2", SIM.rightX);
    linkLine.setAttribute("y2", rightY);

    // Zona de Fresnel (fija, de TX a RX) y núcleo del 60 %
    const d = lastCalculation?.distance;
    const f = lastCalculation?.frequency;
    const f1Radius = lastCalculation?.fresnelRadius || 0;
    const hasData = Boolean(d && f && f1Radius);

    // Sin cálculo se dibuja una zona de referencia para que la escena no quede vacía.
    const drawRadius = hasData ? f1Radius : 18;
    fresnelZone.setAttribute("d", lensPath(leftY, rightY, drawRadius, 1));
    fresnelCore.setAttribute("d", lensPath(leftY, rightY, drawRadius, SIM.okRatio));
    fresnelZone.style.opacity = hasData ? 1 : 0.35;
    fresnelCore.style.opacity = hasData ? 1 : 0.35;
    if (zoneLabel) zoneLabel.textContent = hasData ? `PRIMERA ZONA DE FRESNEL · F₁ = ${formatNumber(f1Radius)} m` : "PRIMERA ZONA DE FRESNEL";

    // Obstáculo (0 m = piso/terreno)
    const obstaclePx = Math.max(2, obsH * SIM.pxPerMeter);
    obstacle.setAttribute("x", x - 12);
    obstacle.setAttribute("y", SIM.groundY - obstaclePx);
    obstacle.setAttribute("height", obstaclePx);

    // Análisis de despeje
    const localRadius = hasData ? localFresnelRadius(f1Radius, p) : 0;
    const linkHeightMeters = txH + (rxH - txH) * p;
    const clearance = linkHeightMeters - obsH;
    const ratio = localRadius > 0 ? clearance / localRadius : (clearance > 0 ? 1 : -1);
    const freePct = Math.max(0, Math.min(100, ratio * 100));

    let state = "idle";
    let status = "Realizá un cálculo para activar el análisis";
    let detail = "El simulador es una representación visual orientativa del enlace.";

    if (hasData) {
      const info = `Radio local: ${formatNumber(localRadius)} m · Línea del enlace: ${formatNumber(linkHeightMeters)} m · Despeje: ${formatNumber(clearance)} m · Zona libre: ${freePct.toFixed(0)} % (recomendado ≥ 60 %)`;

      // Por indicación del profesor, el piso (0 m) es un obstáculo y siempre figura como obstruido.
      if (obsH === 0) {
        state = "bad";
        status = "Obstruido";
        detail = `Piso / terreno a 0 m · Referencia 60 %: ${formatNumber(localRadius * SIM.okRatio)} m`;
      } else if (clearance <= 0) {
        state = "bad";
        status = "Obstruido: el obstáculo corta la línea de vista";
        detail = info;
      } else if (ratio >= SIM.okRatio) {
        state = "ok";
        status = "Despeje recomendado";
        detail = info;
      } else if (ratio >= SIM.minRatio) {
        state = "warn";
        status = "Advertencia: despeje parcial";
        detail = info;
      } else {
        state = "bad";
        status = "Obstruido: invade más del 60 % de la zona";
        detail = info;
      }
    }

    const color = STATUS_COLORS[state];
    obstacle.setAttribute("fill", obsH === 0 ? "#4d7180" : (state === "idle" ? "#35d5ff" : color));

    sceneResult.replaceChildren();
    const head = document.createElement("div");
    const dot = document.createElement("span");
    dot.className = "scene-status-dot";
    dot.style.background = color;
    dot.style.boxShadow = `0 0 8px ${color}`;
    const strong = document.createElement("strong");
    strong.textContent = status;
    head.append(dot, strong);
    const para = document.createElement("p");
    para.textContent = detail;
    sceneResult.append(head, para);
  }

  ["obstacleHeight", "obstaclePosition", "txHeight", "rxHeight"].forEach((id) => {
    const input = $(id);
    const output = $(id + "Value");
    input.addEventListener("input", () => {
      output.textContent = id === "obstaclePosition" ? positionLabel(Number(input.value)) : `${input.value} m`;
      updateSimulation();
    });
  });

  // Restaurar el último cálculo al abrir/recargar la página.
  const storedLinked = getLinkedCalculation();
  if (storedLinked) {
    syncCalculatorWithSimulator(storedLinked.distance, storedLinked.frequency, storedLinked.fresnelRadius);
  } else {
    updateSimulation();
  }
}

/* ==========================================================================
   HISTORIAL
   ========================================================================== */
if (has("historyBody")) {
  renderHistory();

  $("clearHistoryBtn").addEventListener("click", () => {
    if (!getHistory().length) {
      showToast("El historial ya está vacío.");
      return;
    }
    if (confirm("¿Querés borrar todo el historial de cálculos?")) {
      try { localStorage.removeItem(KEY_HISTORY); } catch { /* sin storage */ }
      renderHistory();
      showToast("Historial eliminado.");
    }
  });

  $("historySearch").addEventListener("input", renderHistory);

  $("historyBody").addEventListener("click", (event) => {
    const button = event.target.closest(".delete-row");
    if (!button) return;
    setHistory(getHistory().filter((item) => item.id !== button.dataset.id));
    renderHistory();
    showToast("Cálculo eliminado.");
  });
}

/* ==========================================================================
   TRANSICIÓN ENTRE PÁGINAS
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("page-enter");

  const current = window.location.pathname.split("/").pop() || "index.html";

  document.querySelectorAll('.nav a[href], a.btn[href="index.html"]').forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || link.target === "_blank") return;
    link.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (href === current) return;
      event.preventDefault();
      document.body.classList.remove("page-enter");
      document.body.classList.add("page-exit");
      window.setTimeout(() => { window.location.href = href; }, 220);
    });
  });
});

// Al volver con "Atrás" el navegador puede restaurar la página en estado "page-exit"
// (pantalla vacía) y con el historial desactualizado: se corrige acá.
window.addEventListener("pageshow", (event) => {
  document.body.classList.remove("page-exit");
  document.body.classList.add("page-enter");
  if (event.persisted) renderHistory();
});