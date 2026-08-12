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

// CALCULADORA y SIMULADOR 
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

  // Datos vinculados persistentes: la última medición calculada queda
  // disponible para el simulador incluso si se recarga la página.
  function getLinkedCalculation() {
    try {
      const data = JSON.parse(localStorage.getItem("fresnelLinkedData") || "null");
      if (!data || !Number.isFinite(data.distance) || !Number.isFinite(data.frequency) || !Number.isFinite(data.fresnelRadius)) return null;
      return data;
    } catch {
      return null;
    }
  }

  function saveLinkedCalculation(data) {
    localStorage.setItem("fresnelLinkedData", JSON.stringify(data));
  }

  // Vinculación automática: la calculadora alimenta al simulador.
  function syncCalculatorWithSimulator(d, f, fresnelRadius) {
    const linked = { distance: d, frequency: f, fresnelRadius };
    lastCalculation = linked;
    saveLinkedCalculation(linked);

    const simDistance = $("simDistance");
    const simFrequency = $("simFrequency");
    const simRadius = $("simRadius");
    const simSource = $("simDataSource");
    const simZone = $("simAppliedRadius");

    if (simDistance) simDistance.textContent = `${formatNumber(d)} km`;
    if (simFrequency) simFrequency.textContent = `${formatNumber(f)} GHz`;
    if (simRadius) simRadius.textContent = `${formatNumber(fresnelRadius)} m`;
    if (simZone) simZone.textContent = `${formatNumber(fresnelRadius)} m aplicados`;

    if (simSource) {
      simSource.textContent = "✓ Radio y parámetros aplicados automáticamente al simulador";
      simSource.classList.add("linked");
    }

    updateSimulation();
  }

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
    displayResult(d, f, raw, truncated);
    syncCalculatorWithSimulator(d, f, truncated);
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
    localStorage.removeItem("fresnelLinkedData");

    const simDistance = $("simDistance");
    const simFrequency = $("simFrequency");
    const simRadius = $("simRadius");
    const simSource = $("simDataSource");

    if (simDistance) simDistance.textContent = "—";
    if (simFrequency) simFrequency.textContent = "—";
    if (simRadius) simRadius.textContent = "—";
    const simZone = $("simAppliedRadius");
    if (simZone) simZone.textContent = "Sin datos";
    if (simSource) {
      simSource.textContent = "Esperando un cálculo de la calculadora";
      simSource.classList.remove("linked");
    }

    updateSimulation();
    showToast("Formulario limpiado.");
  });

  // SIMULADOR 
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

  function localFresnelRadius(f1Radius, percent) {
    // El F₁ calculado por la fórmula de la consigna es el radio máximo,
    // ubicado en el punto medio del enlace. Para cualquier otra posición,
    // obtenemos el radio local proporcional a ese F₁.
    const p = percent / 100;
    if (!f1Radius || p <= 0 || p >= 1) return 0;
    return f1Radius * 2 * Math.sqrt(p * (1 - p));
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
    const f1Radius = lastCalculation?.fresnelRadius;
    const radius = f1Radius ? localFresnelRadius(f1Radius, pos) : 0;

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

    // El piso siempre se considera un obstáculo.
    // Si el usuario selecciona 0 m, no significa “sin obstáculo”:
    // significa que el obstáculo coincide con el nivel del terreno.
    const terrainObstacleHeight = Math.max(0, obsH);
    const obstaclePx = Math.max(2, terrainObstacleHeight * 2.35);
    obstacle.setAttribute("x", x - 12);
    obstacle.setAttribute("y", SIM.groundY - obstaclePx);
    obstacle.setAttribute("height", obstaclePx);
    obstacle.setAttribute("fill", obsH === 0 ? "#4d7180" : "#35d5ff");

    const localRadius = radius;
    const requiredClearance = localRadius * .60;
    const linkHeightMeters = txH + (rxH - txH) * (pos / 100);
    // La altura efectiva del obstáculo nunca puede ser menor que el piso (0 m).
    const clearance = linkHeightMeters - terrainObstacleHeight;
    const ratio = requiredClearance > 0 ? clearance / requiredClearance : 1;

    let status = "Realizá un cálculo para activar el análisis";
    let detail = "El simulador es una representación visual orientativa del enlace.";
    let dot = "#617b8d";

    if (d && f) {
      // 0 m representa el piso/terreno. Por indicación del profesor,
      // el piso se considera un obstáculo y SIEMPRE debe figurar como obstruido.
      if (obsH === 0) {
        status = "Obstruido";
        detail = `Piso / terreno a 0 m · Referencia 60%: ${requiredClearance.toFixed(2)} m`;
        dot = "#ff657c";
      } else if (ratio >= 1) {
        status = "Despeje recomendado";
        detail = `Piso/obstáculo: ${terrainObstacleHeight.toFixed(2)} m · Despeje: ${clearance.toFixed(2)} m · Referencia 60%: ${requiredClearance.toFixed(2)} m`;
        dot = "#37e6a1";
      } else if (ratio >= .65) {
        status = "Advertencia: despeje parcial";
        detail = `Piso/obstáculo: ${terrainObstacleHeight.toFixed(2)} m · Despeje: ${clearance.toFixed(2)} m · Referencia 60%: ${requiredClearance.toFixed(2)} m`;
        dot = "#f5c451";
      } else {
        status = "Obstruido";
        detail = `Piso/obstáculo: ${terrainObstacleHeight.toFixed(2)} m · Despeje: ${clearance.toFixed(2)} m · Referencia 60%: ${requiredClearance.toFixed(2)} m`;
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

  // Restaurar automáticamente el último cálculo al abrir/recargar la página.
  const storedLinked = getLinkedCalculation();
  if (storedLinked) {
    lastCalculation = storedLinked;
    syncCalculatorWithSimulator(storedLinked.distance, storedLinked.frequency, storedLinked.fresnelRadius);
  }

  updateSimulation();
}

// HISTORIAL
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


// TRANSICIÓN PÁGINAS
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