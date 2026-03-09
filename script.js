const coins = {
  AUR: { name: "Aurora", price: 148.0, history: [] },
  NEX: { name: "Nexa", price: 82.0, history: [] }
};

const portfolio = {
  cash: 10000,
  holdings: { AUR: 0, NEX: 0 }
};

const state = {
  rules: [],
  isBotRunning: false,
  priceTimer: null,
  botTimer: null,
  tick: 0
};

const dom = {
  coinCards: document.getElementById("coinCards"),
  chart: document.getElementById("priceChart"),
  addRuleBtn: document.getElementById("addRuleBtn"),
  toggleBotBtn: document.getElementById("toggleBotBtn"),
  rulesContainer: document.getElementById("rulesContainer"),
  ruleTemplate: document.getElementById("ruleTemplate"),
  activityLog: document.getElementById("activityLog"),
  marketStatus: document.getElementById("marketStatus"),
  cashValue: document.getElementById("cashValue"),
  aurHoldings: document.getElementById("aurHoldings"),
  nexHoldings: document.getElementById("nexHoldings"),
  totalValue: document.getElementById("totalValue")
};

const chartCtx = dom.chart.getContext("2d");

function fmtMoney(value) {
  return `$${value.toFixed(2)}`;
}

function fmtUnits(value) {
  return value.toFixed(4);
}

function createCoinCards() {
  dom.coinCards.innerHTML = "";

  Object.keys(coins).forEach((symbol) => {
    const card = document.createElement("article");
    card.className = "coin-card";
    card.dataset.symbol = symbol;

    card.innerHTML = `
      <div class="coin-symbol">${symbol} · ${coins[symbol].name}</div>
      <div class="coin-price" data-role="price"></div>
      <div class="coin-change" data-role="change"></div>
    `;

    dom.coinCards.append(card);
  });
}

function pushHistory() {
  state.tick += 1;
  Object.values(coins).forEach((coin) => {
    coin.history.push(coin.price);
    if (coin.history.length > 80) coin.history.shift();
  });
}

function updatePrices() {
  Object.entries(coins).forEach(([symbol, coin]) => {
    const previous = coin.price;
    const pctMove = (Math.random() * 4.4 - 2.2) / 100;
    const nextPrice = Math.max(4, previous * (1 + pctMove));
    coin.price = Number(nextPrice.toFixed(2));

    const card = dom.coinCards.querySelector(`[data-symbol="${symbol}"]`);
    const priceEl = card.querySelector('[data-role="price"]');
    const changeEl = card.querySelector('[data-role="change"]');
    const changePct = ((coin.price - previous) / previous) * 100;

    priceEl.textContent = fmtMoney(coin.price);
    changeEl.textContent = `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`;
    changeEl.className = `coin-change ${changePct >= 0 ? "up" : "down"}`;

    card.classList.remove("flash-up", "flash-down");
    card.classList.add(changePct >= 0 ? "flash-up" : "flash-down");
    setTimeout(() => card.classList.remove("flash-up", "flash-down"), 900);
  });

  pushHistory();
  drawChart();
  renderPortfolio();
}

function drawChart() {
  const { width, height } = dom.chart;
  chartCtx.clearRect(0, 0, width, height);

  const series = Object.values(coins).flatMap((coin) => coin.history);
  if (!series.length) return;

  const min = Math.min(...series) * 0.98;
  const max = Math.max(...series) * 1.02;
  const range = Math.max(1, max - min);

  chartCtx.strokeStyle = "#dce5f2";
  chartCtx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = (height / 4) * i;
    chartCtx.beginPath();
    chartCtx.moveTo(0, y);
    chartCtx.lineTo(width, y);
    chartCtx.stroke();
  }

  const drawLine = (history, color) => {
    if (history.length < 2) return;
    chartCtx.beginPath();
    chartCtx.lineWidth = 2.5;
    chartCtx.strokeStyle = color;

    history.forEach((value, idx) => {
      const x = (idx / (history.length - 1)) * (width - 26) + 13;
      const y = height - ((value - min) / range) * (height - 26) - 13;
      if (idx === 0) chartCtx.moveTo(x, y);
      else chartCtx.lineTo(x, y);
    });

    chartCtx.stroke();
  };

  drawLine(coins.AUR.history, "#0b5fff");
  drawLine(coins.NEX.history, "#f59e0b");

  chartCtx.fillStyle = "#44516c";
  chartCtx.font = "600 12px Manrope";
  chartCtx.fillText(`AUR ${fmtMoney(coins.AUR.price)}`, 14, 20);
  chartCtx.fillText(`NEX ${fmtMoney(coins.NEX.price)}`, 160, 20);
}

function addRule(defaults = {}) {
  const id = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const rule = {
    id,
    action: defaults.action || "buy",
    coin: defaults.coin || "AUR",
    trigger: defaults.trigger || "below",
    price: Number(defaults.price || 100),
    amount: Number(defaults.amount || 100),
    lastExecutedTick: -100
  };

  state.rules.push(rule);
  renderRules();
}

function removeRule(id) {
  state.rules = state.rules.filter((rule) => rule.id !== id);
  renderRules();
}

function renderRules() {
  dom.rulesContainer.innerHTML = "";

  state.rules.forEach((rule) => {
    const node = dom.ruleTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = rule.id;

    node.querySelectorAll("[data-field]").forEach((input) => {
      const field = input.dataset.field;
      input.value = rule[field];
      input.addEventListener("input", () => {
        const current = state.rules.find((item) => item.id === rule.id);
        if (!current) return;
        const value = input.type === "number" ? Number(input.value) : input.value;
        current[field] = value;
      });
    });

    node.querySelector('[data-action="remove"]').addEventListener("click", () => {
      removeRule(rule.id);
    });

    dom.rulesContainer.append(node);
  });

  if (!state.rules.length) {
    const empty = document.createElement("p");
    empty.className = "activity-item note";
    empty.textContent = "No rules yet. Add one to automate trades.";
    dom.rulesContainer.append(empty);
  }
}

function evaluateRules() {
  if (!state.isBotRunning) return;

  state.rules.forEach((rule) => {
    const coin = coins[rule.coin];
    if (!coin) return;

    const isMatch = rule.trigger === "below" ? coin.price <= rule.price : coin.price >= rule.price;
    const cooldownDone = state.tick - rule.lastExecutedTick >= 2;
    if (!isMatch || !cooldownDone) return;

    if (rule.action === "buy") {
      executeBuy(rule, coin.price);
    } else {
      executeSell(rule, coin.price);
    }
  });

  renderPortfolio();
}

function executeBuy(rule, price) {
  const spend = Math.min(Math.max(0, rule.amount), portfolio.cash);
  if (spend <= 0) {
    addActivity(`BUY skipped: not enough cash for ${rule.coin}`, "note");
    return;
  }

  const units = spend / price;
  portfolio.cash -= spend;
  portfolio.holdings[rule.coin] += units;
  rule.lastExecutedTick = state.tick;

  addActivity(`BUY ${rule.coin} ${fmtUnits(units)} @ ${fmtMoney(price)} (spent ${fmtMoney(spend)})`, "buy");
}

function executeSell(rule, price) {
  const owned = portfolio.holdings[rule.coin];
  const unitsToSell = Math.min(Math.max(0, rule.amount), owned);
  if (unitsToSell <= 0) {
    addActivity(`SELL skipped: no ${rule.coin} holdings`, "note");
    return;
  }

  const proceeds = unitsToSell * price;
  portfolio.holdings[rule.coin] -= unitsToSell;
  portfolio.cash += proceeds;
  rule.lastExecutedTick = state.tick;

  addActivity(`SELL ${rule.coin} ${fmtUnits(unitsToSell)} @ ${fmtMoney(price)} (received ${fmtMoney(proceeds)})`, "sell");
}

function renderPortfolio() {
  const aurVal = portfolio.holdings.AUR * coins.AUR.price;
  const nexVal = portfolio.holdings.NEX * coins.NEX.price;
  const total = portfolio.cash + aurVal + nexVal;

  dom.cashValue.textContent = fmtMoney(portfolio.cash);
  dom.aurHoldings.textContent = `${fmtUnits(portfolio.holdings.AUR)} (${fmtMoney(aurVal)})`;
  dom.nexHoldings.textContent = `${fmtUnits(portfolio.holdings.NEX)} (${fmtMoney(nexVal)})`;
  dom.totalValue.textContent = fmtMoney(total);
}

function addActivity(message, type) {
  const item = document.createElement("li");
  item.className = `activity-item ${type}`;
  item.textContent = `${new Date().toLocaleTimeString()} - ${message}`;

  dom.activityLog.prepend(item);
  while (dom.activityLog.children.length > 12) {
    dom.activityLog.removeChild(dom.activityLog.lastElementChild);
  }
}

function setBotRunning(next, options = {}) {
  const { silent = false } = options;
  state.isBotRunning = next;
  dom.toggleBotBtn.textContent = next ? "Stop Bot" : "Start Bot";
  dom.toggleBotBtn.classList.toggle("btn-primary", !next);
  dom.toggleBotBtn.classList.toggle("btn-secondary", next);
  dom.marketStatus.textContent = next ? "Running" : "Paused";
  dom.marketStatus.classList.toggle("stopped", !next);

  if (!silent) {
    addActivity(next ? "Bot started" : "Bot stopped", "note");
  }
}

function bootstrap() {
  createCoinCards();
  addRule({ action: "buy", coin: "AUR", trigger: "below", price: 140, amount: 400 });
  addRule({ action: "sell", coin: "NEX", trigger: "above", price: 90, amount: 1.2 });

  for (let i = 0; i < 22; i += 1) {
    updatePrices();
  }

  setBotRunning(false, { silent: true });
  renderPortfolio();

  dom.addRuleBtn.addEventListener("click", () => addRule());
  dom.toggleBotBtn.addEventListener("click", () => setBotRunning(!state.isBotRunning));

  state.priceTimer = setInterval(updatePrices, 2400);
  state.botTimer = setInterval(evaluateRules, 1000);
}

bootstrap();
