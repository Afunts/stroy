const AUTH_STORAGE_KEY = "ts_auth_v1";
const DEALS_STORAGE_KEY = "ts_deals_v1";

const kpis = document.getElementById("kpis");
const dealsBody = document.getElementById("dealsBody");
const logoutBtn = document.getElementById("logoutBtn");
const roleBadge = document.getElementById("roleBadge");
const clearDealsBtn = document.getElementById("clearDeals");
const chartCanvas = document.getElementById("dealsChart");

function readAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    if (!value.login || !value.role) return null;
    return value;
  } catch {
    return null;
  }
}

function requireAuth() {
  const auth = readAuth();
  if (!auth) {
    window.location.href = "index.html";
    return null;
  }
  return auth;
}

function readDeals() {
  try {
    const raw = localStorage.getItem(DEALS_STORAGE_KEY);
    if (!raw) return [];
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function materialLabel(code) {
  if (code === "brick") return "Кирпич";
  if (code === "block") return "Газоблок";
  return code || "—";
}

function round(value, digits = 2) {
  return Number(Number(value).toFixed(digits));
}

function renderKpis(deals) {
  if (!kpis) return;
  const total = deals.length;
  const last7 = deals.filter((d) => Date.now() - new Date(d.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000).length;
  const wallVolumeAvg =
    total === 0 ? 0 : round(deals.reduce((sum, d) => sum + (Number(d.wallVolume) || 0), 0) / total, 2);
  const slabVolumeAvg =
    total === 0 ? 0 : round(deals.reduce((sum, d) => sum + (Number(d.slabVolume) || 0), 0) / total, 2);

  kpis.innerHTML = `
    Всего расчётов: <strong>${total}</strong><br/>
    За 7 дней: <strong>${last7}</strong><br/>
    Средний объём стен: <strong>${wallVolumeAvg.toLocaleString("ru-RU")} м³</strong><br/>
    Средний объём плиты: <strong>${slabVolumeAvg.toLocaleString("ru-RU")} м³</strong>
  `;
  kpis.classList.remove("muted");
}

function renderDealsTable(deals) {
  if (!dealsBody) return;
  dealsBody.innerHTML = deals
    .slice(0, 20)
    .map((d) => {
      const wallVolume = Number(d.wallVolume) || 0;
      const slabVolume = Number(d.slabVolume) || 0;
      return `
        <tr>
          <td>${formatDate(d.createdAt)}</td>
          <td>${String(d.projectName || "Без названия")}</td>
          <td>${materialLabel(d.wallMaterial)}</td>
          <td>${wallVolume.toLocaleString("ru-RU")} м³</td>
          <td>${slabVolume.toLocaleString("ru-RU")} м³</td>
        </tr>
      `;
    })
    .join("");
}

function groupDealsByDay(deals) {
  const map = new Map();
  deals.forEach((d) => {
    const dt = new Date(d.createdAt);
    if (Number.isNaN(dt.getTime())) return;
    const key = dt.toLocaleDateString("ru-RU", { year: "numeric", month: "2-digit", day: "2-digit" });
    map.set(key, (map.get(key) || 0) + 1);
  });
  const labels = Array.from(map.keys());
  labels.sort((a, b) => {
    const [da, ma, ya] = a.split(".");
    const [db, mb, yb] = b.split(".");
    const ta = new Date(`${ya}-${ma}-${da}T00:00:00`).getTime();
    const tb = new Date(`${yb}-${mb}-${db}T00:00:00`).getTime();
    return ta - tb;
  });
  return {
    labels,
    data: labels.map((l) => map.get(l) || 0)
  };
}

let chartInstance = null;
function renderChart(deals) {
  if (!chartCanvas || typeof window.Chart === "undefined") return;
  const grouped = groupDealsByDay(deals);
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  chartInstance = new window.Chart(chartCanvas, {
    type: "line",
    data: {
      labels: grouped.labels,
      datasets: [
        {
          label: "Расчёты",
          data: grouped.data,
          borderColor: "#0f766e",
          backgroundColor: "rgba(15, 118, 110, 0.15)",
          fill: true,
          tension: 0.25,
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true }
      },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });
}

function clearDeals() {
  localStorage.removeItem(DEALS_STORAGE_KEY);
  init();
}

function init() {
  const auth = requireAuth();
  if (!auth) return;

  if (roleBadge) {
    roleBadge.textContent = auth.role === "admin" ? `Админ: ${auth.login}` : `Сотрудник: ${auth.login}`;
  }

  const deals = readDeals();
  renderKpis(deals);
  renderDealsTable(deals);
  renderChart(deals);
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.location.href = "index.html";
  });
}

if (clearDealsBtn) {
  clearDealsBtn.addEventListener("click", clearDeals);
}

init();

