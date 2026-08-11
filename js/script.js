const $ = (id) => document.getElementById(id);
const has = (id) => Boolean($(id));

let toastTimer;
function normalizeInput(value) { return value.trim().replace(",", "."); }

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
    setError(input, errorElement, "Número inválido. Usá solo dígitos y un único decimal.");
    return null;
  }
  setError(input, errorElement, "");
  return value;
}

function truncateTwo(value) {
  return Math.trunc(value * 100) / 100;
}

function calculateFresnel(d, f) {
  return 8.656 * Math.sqrt(d / f);
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function showToast(message) {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem("fresnelHistory") || "[]"); }
  catch { return []; }
}

function saveHistory(item) {
  const history = getHistory();
  history.unshift(item);
  localStorage.setItem("fresnelHistory", JSON.stringify(history.slice(0, 50)));
}

function renderHistory() {
  const body = $("historyBody");
  const empty = $("emptyHistory");
  if (!body || !empty) return;

  const searchInput = $("historySearch");
  const search = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const history = getHistory();

  const filtered = history.filter(item =>
    `${item.distance} ${item.frequency} ${item.result}`.toLowerCase().includes(search)
  );

  $("historyCount").textContent = history.length;
  body.innerHTML = "";
  empty.style.display = filtered.length ? "none" : "block";

  filtered.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.date}</td>
      <td>${formatNumber(item.distance)} km</td>
      <td>${formatNumber(item.frequency)} GHz</td>
      <td><strong>${formatNumber(item.result)} m</strong></td>
      <td><button class="delete-row" title="Eliminar cálculo" data-id="${item.id}">×</button></td>
    `;
    body.appendChild(row);
  });
}


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

  function displayResult(d, f, raw, truncated) {
    emptyResult.classList.add("hidden");
    resultContent.classList.remove("hidden");
    resultValue.textContent = formatNumber(truncated);
    calculationLine.textContent =
      `F₁ = 8.656 × √(${formatNumber(d)} / ${formatNumber(f)}) = ${raw.toFixed(8)}… m`;
    statDistance.textContent = `${formatNumber(d)} km`;
    statFrequency.textContent = `${formatNumber(f)} GHz`;
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
    lastCalculation = { distance: d, frequency: f, result: truncated };

    displayResult(d, f, raw, truncated);
    updateSimulation();

    saveHistory({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      distance: d,
      frequency: f,
      result: truncated,
      date: new Date().toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })
    });

    showToast("Cálculo realizado y guardado en el historial.");
    const sim = $("simulador");
    if (sim) sim.scrollIntoView({ behavior: "smooth", block: "start" });
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
    input.addEventListener("input", () => input.closest(".input-box").classList.remove("invalid"));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") form.requestSubmit();
    });
  });

  document.querySelectorAll("[data-distance]").forEach(button => {
    button.addEventListener("click", () => {
      distance.value = button.dataset.distance;
      frequency.value = button.dataset.frequency;
      setError(distance, distanceError, "");
      setError(frequency, frequencyError, "");
      form.requestSubmit();
    });
  });

  $("clearBtn").addEventListener("click", () => {
    form.reset();
    setError(distance, distanceError, "");
    setError(frequency, frequencyError, "");
    resultContent.classList.add("hidden");
    emptyResult.classList.remove("hidden");
    lastCalculation = null;
    updateSimulation();
    showToast("Formulario limpiado.");
  });

 
  const obstacle = $("obstacle");
  const leftHead = $("leftHead");
  const rightHead = $("rightHead");
  const linkLine = $("linkLine");
  const fresnelZone = $("fresnelZone");
  const sceneResult = $("sceneResult");

  const SIM = { groundY: 335, leftX: 90, rightX: 910, baseY: 335 };

  function sliderValue(id) { return Number($(id).value); }

  function updateLabelPosition(percent) {
    if (percent < 30) return "Cerca de TX";
    if (percent > 70) return "Cerca de RX";
    return "Centro";
  }

  function localFresnelRadius(d, f, percent) {
    const d1 = d * (percent / 100);
    const d2 = d - d1;
    if (d1 <= 0 || d2 <= 0) return 0;
    return 17.32 * Math.sqrt((d1 * d2) / (f * (d1 + d2)));
  }

  function updateSimulation() {
    if (!obstacle || !leftHead || !rightHead || !linkLine || !fresnelZone) return;

    const txH = sliderValue("txHeight");
    const rxH = sliderValue("rxHeight");
    const obsH = sliderValue("obstacleHeight");
    const pos = sliderValue("obstaclePosition");

    const leftY = SIM.groundY - txH * 2.35;
    const rightY = SIM.groundY - rxH * 2.35;
    const x = SIM.leftX + (SIM.rightX - SIM.leftX) * (pos / 100);
    const linkY = leftY + (rightY - leftY) * (pos / 100);

    const d = lastCalculation?.distance;
    const f = lastCalculation?.frequency;
    const radius = d && f ? localFresnelRadius(d, f, pos) : 0;

    leftHead.setAttribute("cy", leftY);
    rightHead.setAttribute("cy", rightY);
    linkLine.setAttribute("x1", SIM.leftX);
    linkLine.setAttribute("y1", leftY);
    linkLine.setAttribute("x2", SIM.rightX);
    linkLine.setAttribute("y2", rightY);

    const rx = Math.max(80, Math.min(390, radius * 12));
    const ry = Math.max(22, Math.min(100, rx * .2));
    fresnelZone.setAttribute("cx", x);
    fresnelZone.setAttribute("cy", linkY);
    fresnelZone.setAttribute("rx", rx);
    fresnelZone.setAttribute("ry", ry);

    const obstaclePx = obsH * 2.35;
    obstacle.setAttribute("x", x - 12);
    obstacle.setAttribute("y", SIM.groundY - obstaclePx);
    obstacle.setAttribute("height", obstaclePx);

    const localRadius = radius;
    const requiredClearance = localRadius * .60;
    const linkHeightMeters = txH + (rxH - txH) * (pos / 100);
    const clearance = linkHeightMeters - obsH;
    const ratio = localRadius > 0 ? clearance / requiredClearance : 1;

    let status = "Realizá un cálculo para activar el análisis";
    let detail = "El simulador es una representación visual orientativa del enlace.";
    let dot = "#617b8d";

    if (d && f) {
      if (ratio >= 1) {
        status = "Despeje recomendado";
        detail = `Despeje: ${clearance.toFixed(2)} m · Referencia 60%: ${requiredClearance.toFixed(2)} m`;
        dot = "#37e6a1";
      } else if (ratio >= .65) {
        status = "Advertencia: despeje parcial";
        detail = `Despeje: ${clearance.toFixed(2)} m · Referencia 60%: ${requiredClearance.toFixed(2)} m`;
        dot = "#f5c451";
      } else {
        status = "Obstruido";
        detail = `Despeje: ${clearance.toFixed(2)} m · Referencia 60%: ${requiredClearance.toFixed(2)} m`;
        dot = "#ff657c";
      }
    }

    sceneResult.innerHTML = `<div><span class="scene-status-dot" style="background:${dot};box-shadow:0 0 8px ${dot}"></span><strong>${status}</strong></div><p>${detail}</p>`;
  }

  ["obstacleHeight", "obstaclePosition", "txHeight", "rxHeight"].forEach(id => {
    const input = $(id);
    if (!input) return;
    const output = $(id + "Value");
    input.addEventListener("input", () => {
      if (id === "obstaclePosition") output.textContent = updateLabelPosition(Number(input.value));
      else output.textContent = `${input.value} m`;
      updateSimulation();
    });
  });

  updateSimulation();
}


if (has("historyBody")) {
  renderHistory();

  $("clearHistoryBtn").addEventListener("click", () => {
    if (!getHistory().length) {
      showToast("El historial ya está vacío.");
      return;
    }
    if (confirm("¿Querés borrar todo el historial de cálculos?")) {
      localStorage.removeItem("fresnelHistory");
      renderHistory();
      showToast("Historial eliminado.");
    }
  });

  $("historySearch").addEventListener("input", renderHistory);

  $("historyBody").addEventListener("click", (event) => {
    const button = event.target.closest(".delete-row");
    if (!button) return;
    const history = getHistory().filter(item => item.id !== button.dataset.id);
    localStorage.setItem("fresnelHistory", JSON.stringify(history));
    renderHistory();
    showToast("Cálculo eliminado.");
  });
}


document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("page-enter");

  document.querySelectorAll('.nav a[href], a.btn[href="index.html"]').forEach(link => {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || link.target === "_blank") return;
    link.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (href === window.location.pathname.split("/").pop() || (href === "index.html" && (window.location.pathname.endsWith("/") || window.location.pathname.endsWith("index.html")))) return;
      event.preventDefault();
      document.body.classList.remove("page-enter");
      document.body.classList.add("page-exit");
      window.setTimeout(() => { window.location.href = href; }, 220);
    });
  });
});
