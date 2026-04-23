const AUTH_STORAGE_KEY = "ts_auth_v1";
const DEALS_STORAGE_KEY = "ts_deals_v1";

const kpis = document.getElementById("kpis");
const dealsBody = document.getElementById("dealsBody");
const subsBody = document.getElementById("subsBody");
const logoutBtn = document.getElementById("logoutBtn");
const roleBadge = document.getElementById("roleBadge");
const clearDealsBtn = document.getElementById("clearDeals");
const chartCanvas = document.getElementById("dealsChart");

function setupRevealAnimations() {
  const revealItems = document.querySelectorAll(".reveal");
  if (!revealItems.length) return;

  if (typeof IntersectionObserver === "undefined") {
    revealItems.forEach((el) => el.classList.add("show"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("show");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  revealItems.forEach((item) => observer.observe(item));
}

function canUseLocalStorage() {
  try {
    const key = "__ts_test__";
    localStorage.setItem(key, "1");
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

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
  if (!canUseLocalStorage()) {
    return { login: "user", role: "staff" };
  }
  const auth = readAuth();
  if (!auth) {
    window.location.href = "./index.html";
    return null;
  }
  return auth;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function buildRandomDeals(count = 18) {
  const now = Date.now();
  const customers = ["Заказчик 1", "Заказчик 2", "Заказчик 3"];
  const materials = ["brick", "block"];
  const objects = ["Склад", "Дом", "Гараж", "Магазин", "Цех", "Офис"];

  const deals = [];
  for (let i = 0; i < count; i += 1) {
    const customerName = pick(customers);
    const wallMaterial = pick(materials);
    const daysAgo = randInt(0, 13);
    const minutesShift = randInt(0, 12 * 60);
    const createdAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000 - minutesShift * 60 * 1000).toISOString();

    const length = randInt(8, 36);
    const width = randInt(6, 24);
    const height = randInt(3, 8);
    const perimeter = 2 * (length + width);
    const wallAreaNet = Math.round(perimeter * height * (0.78 + Math.random() * 0.18));
    const wallVolume = Math.round((wallAreaNet * (wallMaterial === "brick" ? 0.3 : 0.25)) * 10) / 10;
    const slabVolume = Math.round((length * width * (0.2 + Math.random() * 0.18)) * 10) / 10;

    deals.push({
      id: `rnd_${Date.now()}_${i}_${Math.random().toString(16).slice(2)}`,
      createdAt,
      customerName,
      projectName: `${pick(objects)} №${randInt(1, 24)}`,
      wallMaterial,
      perimeter,
      wallAreaNet,
      wallVolume,
      slabVolume,
      lines: []
    });
  }

  deals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return deals;
}

function readDeals() {
  if (!canUseLocalStorage()) {
    return buildRandomDeals(18);
  }
  try {
    const raw = localStorage.getItem(DEALS_STORAGE_KEY);
    if (!raw) return buildRandomDeals(18);
    const value = JSON.parse(raw);
    const list = Array.isArray(value) ? value : [];
    return list.length ? list : buildRandomDeals(18);
  } catch {
    return buildRandomDeals(18);
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
          <td>${String(d.customerName || "—")}</td>
          <td>${String(d.projectName || "Без названия")}</td>
          <td>${materialLabel(d.wallMaterial)}</td>
          <td>${wallVolume.toLocaleString("ru-RU")} м³</td>
          <td>${slabVolume.toLocaleString("ru-RU")} м³</td>
        </tr>
      `;
    })
    .join("");
}

function uniqueCustomersFromDeals(deals) {
  const set = new Set();
  deals.forEach((d) => {
    if (d && d.customerName) set.add(String(d.customerName));
  });
  return Array.from(set);
}

function planForCustomer(name) {
  if (name.includes("1")) {
    return { plan: "Базовый", limit: "20 / мес", partners: "Ограничено", status: "Активна" };
  }
  if (name.includes("2")) {
    return { plan: "Про", limit: "100 / мес", partners: "Доступно", status: "Активна" };
  }
  return { plan: "Партнёр+", limit: "Безлимит", partners: "Доступно", status: "Активна" };
}

function renderSubscriptions(deals) {
  if (!subsBody) return;
  const customers = uniqueCustomersFromDeals(deals);
  const list = customers.length ? customers : ["Заказчик 1", "Заказчик 2", "Заказчик 3"];
  subsBody.innerHTML = list
    .map((name) => {
      const p = planForCustomer(name);
      return `
        <tr>
          <td>${name}</td>
          <td>${p.plan}</td>
          <td>${p.limit}</td>
          <td>${p.partners}</td>
          <td>${p.status}</td>
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
  try {
    localStorage.removeItem(DEALS_STORAGE_KEY);
  } catch {
    // ignore
  }
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
  renderSubscriptions(deals);
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.location.href = "./index.html";
  });
}

if (clearDealsBtn) {
  clearDealsBtn.addEventListener("click", clearDeals);
}

setupRevealAnimations();
init();

