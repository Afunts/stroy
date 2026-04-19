const form = document.getElementById("calcForm");
const resultsBody = document.getElementById("resultsBody");
const summary = document.getElementById("summary");
const formError = document.getElementById("formError");
const exportPdfButton = document.getElementById("exportPdf");
const exportExcelButton = document.getElementById("exportExcel");
let lastCalculation = null;

const materialConfig = {
  brick: {
    title: "Кирпич керамический",
    unitsPerM3: 394,
    mortarPerM3: 0.24
  },
  block: {
    title: "Газоблок",
    unitsPerM3: 27.8,
    mortarPerM3: 0.08
  }
};

const priceCatalog = {
  "Кирпич керамический": {
    priceLabel: "24 ₽ / шт.",
    availability: "В наличии"
  },
  "Газоблок": {
    priceLabel: "6 800 ₽ / м³",
    availability: "Под заказ 1-2 дня"
  },
  "Раствор кладочный / клей": {
    priceLabel: "от 4 900 ₽ / м³",
    availability: "В наличии"
  },
  "Бетон B25": {
    priceLabel: "от 6 400 ₽ / м³",
    availability: "Отгрузка по графику"
  },
  "Арматура A500C": {
    priceLabel: "от 62 000 ₽ / т",
    availability: "В наличии"
  },
  "Утеплитель кровли": {
    priceLabel: "от 520 ₽ / м²",
    availability: "Под заказ 1-2 дня"
  },
  "Кровельное покрытие": {
    priceLabel: "от 780 ₽ / м²",
    availability: "В наличии / под заказ"
  }
};

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function parseRuNumber(value) {
  return Number(String(value).replace(/\s+/g, "").replace(",", "."));
}

function renderRows(rows) {
  resultsBody.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td>${row.name}</td>
        <td>${row.unit}</td>
        <td>${row.qty}</td>
        <td>${row.note}</td>
      </tr>
    `
    )
    .join("");
}

function setActionButtonsState(enabled) {
  [
    exportPdfButton,
    exportExcelButton
  ].forEach((button) => {
    if (button) {
      button.disabled = !enabled;
    }
  });
}

function setFormError(message = "", isError = false) {
  if (!formError) {
    return;
  }

  formError.textContent = message;
  formError.classList.toggle("muted", !isError);
  formError.classList.toggle("error-text", isError);
}

function validateData(data) {
  if (Number.isNaN(data.length) || data.length < 1 || data.length > 300) {
    return "Длина здания должна быть в диапазоне от 1 до 300 м.";
  }
  if (Number.isNaN(data.width) || data.width < 1 || data.width > 200) {
    return "Ширина здания должна быть в диапазоне от 1 до 200 м.";
  }
  if (Number.isNaN(data.height) || data.height < 2 || data.height > 30) {
    return "Высота стен должна быть в диапазоне от 2 до 30 м.";
  }
  if (Number.isNaN(data.wallThickness) || data.wallThickness < 0.1 || data.wallThickness > 1) {
    return "Толщина стены должна быть в диапазоне от 0.1 до 1 м.";
  }
  if (Number.isNaN(data.slabThickness) || data.slabThickness < 0.1 || data.slabThickness > 1.2) {
    return "Толщина фундаментной плиты должна быть в диапазоне от 0.1 до 1.2 м.";
  }
  if (Number.isNaN(data.openings) || data.openings < 0 || data.openings > 60) {
    return "Процент окон/дверей должен быть от 0 до 60%.";
  }
  if (Number.isNaN(data.reserve) || data.reserve < 0 || data.reserve > 30) {
    return "Запас материалов должен быть от 0 до 30%.";
  }

  return "";
}

function collectFormData() {
  return {
    projectName: document.getElementById("projectName").value.trim(),
    length: Number(document.getElementById("length").value),
    width: Number(document.getElementById("width").value),
    height: Number(document.getElementById("height").value),
    wallThickness: Number(document.getElementById("wallThickness").value),
    openings: Number(document.getElementById("openings").value),
    reserve: Number(document.getElementById("reserve").value),
    wallMaterial: document.getElementById("wallMaterial").value,
    slabThickness: Number(document.getElementById("slabThickness").value)
  };
}

function estimateCostForRow(row) {
  const item = priceCatalog[row.name];
  if (!item) {
    return { cost: null, priceLabel: "По запросу", availability: "Уточняйте у менеджера" };
  }

  const qty = parseRuNumber(row.qty);
  const price = parseRuNumber(item.priceLabel.split(" / ")[0].replace("от ", "").replace("₽", ""));
  if (Number.isNaN(qty) || Number.isNaN(price)) {
    return { cost: null, priceLabel: item.priceLabel, availability: item.availability };
  }

  return {
    cost: round(qty * price),
    priceLabel: item.priceLabel,
    availability: item.availability
  };
}

function buildExportLines() {
  if (!lastCalculation) {
    return [];
  }

  const header = [
    `Объект: ${lastCalculation.data.projectName || "Без названия"}`,
    `Периметр: ${round(lastCalculation.result.perimeter)} м`,
    `Чистая площадь стен: ${round(lastCalculation.result.wallAreaNet)} м²`,
    `Объем стен: ${round(lastCalculation.result.wallVolume)} м³`,
    `Объем фундаментной плиты: ${round(lastCalculation.result.slabVolume)} м³`,
    ""
  ];

  const body = lastCalculation.result.rows.map((row, index) => {
    const estimate = estimateCostForRow(row);
    const estimatedCost =
      estimate.cost === null ? "сумма по запросу" : `≈ ${estimate.cost.toLocaleString("ru-RU")} ₽`;
    return `${index + 1}. ${row.name} — ${row.qty} ${row.unit}, ${row.note}; цена: ${estimate.priceLabel}, ${estimatedCost}, наличие: ${estimate.availability}`;
  });

  return [...header, ...body, "", "Актуальность цен и наличие уточняйте у менеджера в день заказа."];
}

function downloadPdf() {
  if (!lastCalculation) {
    return;
  }
  const pdfApi = window.jspdf && window.jspdf.jsPDF;
  if (!pdfApi) {
    setFormError("PDF-библиотека не загружена. Обновите страницу и попробуйте снова.", true);
    return;
  }

  const doc = new pdfApi();
  const lines = buildExportLines();
  let y = 14;
  lines.forEach((line) => {
    if (y > 280) {
      doc.addPage();
      y = 14;
    }
    doc.text(line, 10, y, { maxWidth: 190 });
    y += 8;
  });
  doc.save("raschet-materialov.pdf");
}

function downloadExcel() {
  if (!lastCalculation) {
    return;
  }
  if (typeof window.XLSX === "undefined") {
    setFormError("Excel-библиотека не загружена. Обновите страницу и попробуйте снова.", true);
    return;
  }

  const rows = lastCalculation.result.rows.map((row) => {
    const estimate = estimateCostForRow(row);
    return {
      Материал: row.name,
      Единица: row.unit,
      Количество: row.qty,
      Примечание: row.note,
      "Цена (ориентир)": estimate.priceLabel,
      "Оценка суммы": estimate.cost === null ? "По запросу" : `${estimate.cost.toLocaleString("ru-RU")} ₽`,
      Наличие: estimate.availability
    };
  });

  const worksheet = window.XLSX.utils.json_to_sheet(rows);
  const workbook = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(workbook, worksheet, "Расчет");
  window.XLSX.writeFile(workbook, "raschet-materialov.xlsx");
}

function setupActionButtons() {
  if (exportPdfButton) {
    exportPdfButton.addEventListener("click", downloadPdf);
  }
  if (exportExcelButton) {
    exportExcelButton.addEventListener("click", downloadExcel);
  }
}

function setupInputValidationHints() {
  const numberInputs = form.querySelectorAll("input[type='number']");
  numberInputs.forEach((input) => {
    input.addEventListener("input", () => {
      if (input.validity.valid) {
        input.setCustomValidity("");
      } else if (input.validity.rangeUnderflow || input.validity.rangeOverflow) {
        input.setCustomValidity("Значение вне допустимого диапазона для этого поля.");
      } else {
        input.setCustomValidity("Введите корректное числовое значение.");
      }
    });
  });
}

function setupRevealAnimations() {
  const revealItems = document.querySelectorAll(".reveal");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("show");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18 }
  );

  revealItems.forEach((item) => observer.observe(item));
}

function calculate(data) {
  const perimeter = 2 * (data.length + data.width);
  const wallAreaGross = perimeter * data.height;
  const wallAreaNet = wallAreaGross * (1 - data.openings / 100);
  const wallVolume = wallAreaNet * data.wallThickness;
  const slabVolume = data.length * data.width * data.slabThickness;
  const roofArea = data.length * data.width * 1.15;

  const reserveFactor = 1 + data.reserve / 100;
  const wallType = materialConfig[data.wallMaterial];
  const wallUnits = wallVolume * wallType.unitsPerM3 * reserveFactor;
  const mortarVolume = wallVolume * wallType.mortarPerM3 * reserveFactor;

  const concreteForFoundation = slabVolume * reserveFactor;
  const concreteForColumns = data.length * data.width * 0.035 * reserveFactor;
  const concreteTotal = concreteForFoundation + concreteForColumns;
  const rebarMassKg = concreteTotal * 78;
  const rebarMassTons = rebarMassKg / 1000;

  const insulationM2 = roofArea * reserveFactor;
  const roofingM2 = roofArea * reserveFactor;

  return {
    perimeter,
    wallAreaNet,
    wallVolume,
    slabVolume,
    rows: [
      {
        name: wallType.title,
        unit: data.wallMaterial === "brick" ? "шт." : "шт. блоков",
        qty: Math.ceil(wallUnits).toLocaleString("ru-RU"),
        note: "Наружные стены с учетом проемов и запаса"
      },
      {
        name: "Раствор кладочный / клей",
        unit: "м³",
        qty: round(mortarVolume).toLocaleString("ru-RU"),
        note: "Для стенового материала"
      },
      {
        name: "Бетон B25",
        unit: "м³",
        qty: round(concreteTotal).toLocaleString("ru-RU"),
        note: "Фундаментная плита и колонны"
      },
      {
        name: "Арматура A500C",
        unit: "т",
        qty: round(rebarMassTons, 3).toLocaleString("ru-RU"),
        note: "Оценка 78 кг/м³ бетона"
      },
      {
        name: "Утеплитель кровли",
        unit: "м²",
        qty: round(insulationM2).toLocaleString("ru-RU"),
        note: "С учетом коэффициента уклона"
      },
      {
        name: "Кровельное покрытие",
        unit: "м²",
        qty: round(roofingM2).toLocaleString("ru-RU"),
        note: "Металлочерепица/мембрана"
      }
    ]
  };
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const data = collectFormData();
  const validationError = validateData(data);

  if (validationError) {
    setFormError(validationError, true);
    summary.textContent = "Исправьте поля формы и повторите расчет.";
    summary.classList.remove("muted");
    setActionButtonsState(false);
    lastCalculation = null;
    return;
  }

  const result = calculate(data);
  renderRows(result.rows);
  lastCalculation = { data, result };
  setActionButtonsState(true);
  setFormError("Параметры заполнены корректно. Можно сохранить расчет.");

  const projectText = data.projectName ? `Объект: ${data.projectName}. ` : "";
  summary.innerHTML = `
    ${projectText}
    Периметр: <strong>${round(result.perimeter)} м</strong>,
    чистая площадь стен: <strong>${round(result.wallAreaNet)} м²</strong>,
    объем стен: <strong>${round(result.wallVolume)} м³</strong>,
    объем фундаментной плиты: <strong>${round(result.slabVolume)} м³</strong>.
  `;
  summary.classList.remove("muted");
});

setupActionButtons();
setupInputValidationHints();
setActionButtonsState(false);
setupRevealAnimations();
