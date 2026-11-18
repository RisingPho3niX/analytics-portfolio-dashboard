const categories = [
  { name: "Technology", price: 640 },
  { name: "Home & Living", price: 390 },
  { name: "Apparel", price: 180 },
  { name: "Accessories", price: 95 },
];

const regions = ["North", "South", "East", "West"];
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function createDemoRecords() {
  const records = [];

  for (let month = 0; month < 12; month += 1) {
    for (let regionIndex = 0; regionIndex < regions.length; regionIndex += 1) {
      for (let categoryIndex = 0; categoryIndex < categories.length; categoryIndex += 1) {
        const units =
          12 +
          ((month * 7 + regionIndex * 5 + categoryIndex * 3) % 19) +
          (month >= 9 ? 4 : 0);
        const price = categories[categoryIndex].price;
        const regionalFactor = [1.12, 0.93, 1.04, 0.86][regionIndex];
        const revenue = Math.round(units * price * regionalFactor);

        records.push({
          month,
          quarter: `Q${Math.floor(month / 3) + 1}`,
          region: regions[regionIndex],
          category: categories[categoryIndex].name,
          units,
          orders: Math.max(1, Math.round(units * 0.72)),
          revenue,
        });
      }
    }
  }

  return records;
}

const records = createDemoRecords();
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("en-US");

const periodFilter = document.querySelector("#period-filter");
const categoryFilter = document.querySelector("#category-filter");
const regionFilter = document.querySelector("#region-filter");
const trendChart = document.querySelector("#trend-chart");
const categoryChart = document.querySelector("#category-chart");
const regionTable = document.querySelector("#region-table");
const analystNote = document.querySelector("#analyst-note");

function populateFilters() {
  categories.forEach(({ name }) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    categoryFilter.append(option);
  });

  regions.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    regionFilter.append(option);
  });
}

function getFilteredRecords() {
  return records.filter((record) => {
    const matchesPeriod = periodFilter.value === "all" || record.quarter === periodFilter.value;
    const matchesCategory = categoryFilter.value === "all" || record.category === categoryFilter.value;
    const matchesRegion = regionFilter.value === "all" || record.region === regionFilter.value;
    return matchesPeriod && matchesCategory && matchesRegion;
  });
}

function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const groupKey = item[key];
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), item]);
    return groups;
  }, new Map());
}

function sum(items, field) {
  return items.reduce((total, item) => total + item[field], 0);
}

function aggregate(items, key, field, keyOrder = []) {
  const groups = groupBy(items, key);
  const orderedKeys = keyOrder.length ? keyOrder : [...groups.keys()];
  return orderedKeys.map((name) => ({
    name,
    value: sum(groups.get(name) ?? [], field),
  }));
}

function renderKpis(filtered) {
  const revenue = sum(filtered, "revenue");
  const units = sum(filtered, "units");
  const orders = sum(filtered, "orders");

  document.querySelector("#revenue-kpi").textContent = currency.format(revenue);
  document.querySelector("#units-kpi").textContent = number.format(units);
  document.querySelector("#orders-kpi").textContent = number.format(orders);
  document.querySelector("#aov-kpi").textContent = currency.format(orders ? revenue / orders : 0);
}

function renderTrend(filtered) {
  const monthIndexes = [...new Set(filtered.map(({ month }) => month))];
  const monthly = aggregate(filtered, "month", "revenue", monthIndexes);
  const values = monthly.map(({ value }) => value);
  const maxValue = Math.max(...values, 0);
  const hasData = maxValue > 0;

  document.querySelector("#trend-empty").hidden = hasData;
  trendChart.hidden = !hasData;
  if (!hasData) return;

  const width = 620;
  const height = 178;
  const left = 43;
  const right = 10;
  const top = 11;
  const bottom = 25;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const ceiling = Math.ceil(maxValue / 10000) * 10000 || 1;
  const points = monthly.map(({ name, value }, index) => ({
    x: left + (plotWidth * index) / (values.length - 1),
    y: top + plotHeight - (value / ceiling) * plotHeight,
    month: name,
    value,
  }));
  const line = points.map(({ x, y }, index) => `${index ? "L" : "M"}${x},${y}`).join(" ");
  const area = `${line} L${points.at(-1).x},${top + plotHeight} L${points[0].x},${top + plotHeight} Z`;
  const grid = Array.from({ length: 4 }, (_, index) => {
    const y = top + (plotHeight * index) / 3;
    const amount = ceiling - (ceiling * index) / 3;
    return `
      <line class="chart-gridline" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"></line>
      <text class="chart-axis-label" x="${left - 7}" y="${y + 3}" text-anchor="end">${formatAxis(amount)}</text>
    `;
  }).join("");
  const labels = points.map(({ x, month }) => `
    <text class="chart-x-label" x="${x}" y="${height - 5}" text-anchor="middle">${monthNames[month]}</text>
  `).join("");
  const dots = points.map(({ x, y, month, value }) => `
    <circle class="trend-point" cx="${x}" cy="${y}" r="3">
      <title>${monthNames[month]}: ${currency.format(value)}</title>
    </circle>
  `).join("");

  trendChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="trend-title trend-description">
      <title id="trend-title">Monthly revenue trend</title>
      <desc id="trend-description">${monthly.map(({ name, value }) => `${monthNames[name]} ${currency.format(value)}`).join(", ")}</desc>
      <defs>
        <linearGradient id="area-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#6d98f4" stop-opacity=".2"></stop>
          <stop offset="100%" stop-color="#6d98f4" stop-opacity="0"></stop>
        </linearGradient>
      </defs>
      ${grid}
      <path class="trend-area" d="${area}"></path>
      <path class="trend-line" d="${line}"></path>
      ${dots}
      ${labels}
    </svg>
  `;
}

function renderCategories(filtered) {
  const totals = aggregate(filtered, "category", "revenue", categories.map(({ name }) => name));
  const maxValue = Math.max(...totals.map(({ value }) => value), 0);
  const hasData = maxValue > 0;

  document.querySelector("#category-empty").hidden = hasData;
  categoryChart.hidden = !hasData;
  if (!hasData) return;

  categoryChart.innerHTML = totals.filter(({ value }) => value > 0).map(({ name, value }) => `
    <div class="category-row">
      <div class="category-label-line">
        <span>${name}</span>
        <strong>${currency.format(value)}</strong>
      </div>
      <div class="category-track" aria-hidden="true">
        <div class="category-fill" style="width: ${(value / maxValue) * 100}%"></div>
      </div>
    </div>
  `).join("");
}

function renderRegions(filtered) {
  const totals = aggregate(filtered, "region", "revenue", regions);
  const maxRevenue = Math.max(...totals.map(({ value }) => value), 0);
  const totalRevenue = sum(filtered, "revenue");

  document.querySelector("#region-empty").hidden = totalRevenue > 0;
  document.querySelector(".table-scroll").hidden = totalRevenue === 0;
  regionTable.innerHTML = totals
    .map(({ name, value }) => {
      const regionRecords = filtered.filter((record) => record.region === name);
      const share = totalRevenue ? (value / totalRevenue) * 100 : 0;
      return `
        <tr>
          <td>${name}</td>
          <td>${currency.format(value)}</td>
          <td>
            <span class="share-cell">
              <span class="share-track" aria-hidden="true"><span class="share-fill" style="display:block;width:${share}%"></span></span>
              ${share.toFixed(0)}%
            </span>
          </td>
          <td>${number.format(sum(regionRecords, "units"))}</td>
        </tr>
      `;
    })
    .join("");

  return { totals, maxRevenue };
}

function renderAnalystNote(filtered, regionSummary) {
  if (!filtered.length) {
    analystNote.textContent = "No transactions match the current filters. Try another selection to explore the sample.";
    return;
  }

  const bestRegion = regionSummary.totals.reduce((best, current) =>
    current.value > best.value ? current : best,
  );
  const bestCategory = aggregate(filtered, "category", "revenue").reduce((best, current) =>
    current.value > best.value ? current : best,
  );
  const totalRevenue = sum(filtered, "revenue");
  const regionShare = totalRevenue ? Math.round((bestRegion.value / totalRevenue) * 100) : 0;

  analystNote.innerHTML = `
    <strong>${bestRegion.name}</strong> contributes ${regionShare}% of revenue in this view.
    <strong>${bestCategory.name}</strong> is the leading category at
    <strong>${currency.format(bestCategory.value)}</strong>. Use the filters to compare another slice of the synthetic dataset.
  `;
}

function formatAxis(value) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(value % 1000000 ? 1 : 0)}m`;
  if (value >= 1000) return `$${Math.round(value / 1000)}k`;
  return currency.format(value);
}

function updateDashboard() {
  const filtered = getFilteredRecords();
  renderKpis(filtered);
  renderTrend(filtered);
  renderCategories(filtered);
  const regionSummary = renderRegions(filtered);
  renderAnalystNote(filtered, regionSummary);
}

populateFilters();
updateDashboard();

[periodFilter, categoryFilter, regionFilter].forEach((filter) => {
  filter.addEventListener("change", updateDashboard);
});

document.querySelector("#reset-filters").addEventListener("click", () => {
  periodFilter.value = "all";
  categoryFilter.value = "all";
  regionFilter.value = "all";
  updateDashboard();
});
