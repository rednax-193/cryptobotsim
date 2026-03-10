const coins = {
  // Existing coins in the project
  AUR: { name: "Aurora", price: 148.0, history: [], volatilityPct: 2.2, category: "core" },
  NEX: { name: "Nexa", price: 82.0, history: [], volatilityPct: 2.6, category: "core" },

  // New meme coins (integrated into the same market update + bot rule system)
  DRKT: { name: "DogeRocket", price: 0.084, history: [], volatilityPct: 8.5, category: "meme" },
  PEPM: { name: "PepeMoon", price: 0.017, history: [], volatilityPct: 10.0, category: "meme" },
  BANA: { name: "BananaCoin", price: 0.42, history: [], volatilityPct: 7.5, category: "meme" },
  CATT: { name: "CatToken", price: 0.0064, history: [], volatilityPct: 12.0, category: "meme" }
};

const portfolio = {
  cash: 10000,
  holdings: {}
};

const state = {
  rules: [],
  isBotRunning: false,
  priceTimer: null,
  botTimer: null,
  tick: 0,
  chartSymbol: "AUR"
};

const dom = {
  coinCards: document.getElementById("coinCards"),
  chart: document.getElementById("priceChart"),
  chartCoinSelect: document.getElementById("chartCoinSelect"),
  addRuleBtn: document.getElementById("addRuleBtn"),
  toggleBotBtn: document.getElementById("toggleBotBtn"),
  rulesContainer: document.getElementById("rulesContainer"),
  ruleTemplate: document.getElementById("ruleTemplate"),
  activityLog: document.getElementById("activityLog"),
  marketStatus: document.getElementById("marketStatus"),
  cashValue: document.getElementById("cashValue"),
  portfolioRows: document.getElementById("portfolioRows"),
  totalValue: document.getElementById("totalValue")
};

const chartCtx = dom.chart.getContext("2d");

function fmtMoney(value) {
  return `$${value.toFixed(2)}`;
}

function fmtPrice(value) {
  const abs = Math.abs(value);
  if (abs >= 1) return `$${value.toFixed(2)}`;
  if (abs >= 0.1) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(6)}`;
}

function fmtUnits(value) {
  return value.toFixed(4);
}

function coinSymbols() {
  return Object.keys(coins);
}

function ensurePortfolioHasAllCoins() {
  for (const symbol of coinSymbols()) {
    if (typeof portfolio.holdings[symbol] !== "number") portfolio.holdings[symbol] = 0;
  }
}

function createMarketCards() {
  dom.coinCards.innerHTML = "";

  coinSymbols().forEach((symbol) => {
    const coin = coins[symbol];
    const card = document.createElement("article");
    card.className = "coin-card";
    card.dataset.symbol = symbol;

    card.innerHTML = `
      <div class="coin-top">
        <div>
          <div class="coin-symbol">${symbol}</div>
          <div class="coin-name">${coin.name}</div>
        </div>
        <span class="chip ${coin.category === "meme" ? "meme" : ""}">${coin.category === "meme" ? "Meme" : "Core"}</span>
      </div>
      <div class="coin-price" data-role="price"></div>
      <div class="coin-change" data-role="change"></div>
      <div class="coin-holdings">Hold: <span data-role="holdings"></span></div>
      <div class="trade-row">
        <div class="trade-input">
          <input data-role="tradeAmount" type="number" min="0" step="0.0001" value="250" aria-label="Trade amount" />
          <select data-role="tradeUnit" aria-label="Trade unit">
            <option value="usd">USD</option>
            <option value="coin">${symbol}</option>
          </select>
        </div>
        <button class="btn-trade buy" data-action="buy" type="button">Buy</button>
        <button class="btn-trade sell" data-action="sell" type="button">Sell</button>
      </div>
    `;

    card.querySelector('[data-action="buy"]').addEventListener("click", () => {
      placeManualOrder(symbol, "buy", card);
    });
    card.querySelector('[data-action="sell"]').addEventListener("click", () => {
      placeManualOrder(symbol, "sell", card);
    });

    dom.coinCards.append(card);
  });
}

function createPortfolioRows() {
  dom.portfolioRows.innerHTML = "";

  coinSymbols().forEach((symbol) => {
    const coin = coins[symbol];
    const row = document.createElement("article");
    row.className = "portfolio-row";
    row.dataset.symbol = symbol;

    row.innerHTML = `
      <div class="portfolio-meta">
        <strong>${symbol} · ${coin.name}</strong>
        <span><span data-role="units"></span> · <span data-role="value"></span></span>
      </div>
      <div class="portfolio-actions">
        <div class="trade-input">
          <input data-role="tradeAmount" type="number" min="0" step="0.0001" value="250" aria-label="Trade amount" />
          <select data-role="tradeUnit" aria-label="Trade unit">
            <option value="usd">USD</option>
            <option value="coin">${symbol}</option>
          </select>
        </div>
        <div class="portfolio-buttons">
          <button class="btn-trade buy" data-action="buy" type="button">Buy</button>
          <button class="btn-trade sell" data-action="sell" type="button">Sell</button>
        </div>
      </div>
    `;

    row.querySelector('[data-action="buy"]').addEventListener("click", () => {
      placeManualOrder(symbol, "buy", row);
    });
    row.querySelector('[data-action="sell"]').addEventListener("click", () => {
      placeManualOrder(symbol, "sell", row);
    });

    dom.portfolioRows.append(row);
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
    const vol = typeof coin.volatilityPct === "number" ? coin.volatilityPct : 2.2;
    const pctMove = (Math.random() * (vol * 2) - vol) / 100;
    const nextPrice = Math.max(coin.category === "meme" ? 0.000001 : 4, previous * (1 + pctMove));
    coin.price = Number(nextPrice.toFixed(coin.category === "meme" ? 6 : 2));

    const card = dom.coinCards.querySelector(`[data-symbol="${symbol}"]`);
    if (!card) return;
    const priceEl = card.querySelector('[data-role="price"]');
    const changeEl = card.querySelector('[data-role="change"]');
    const holdEl = card.querySelector('[data-role="holdings"]');
    const changePct = ((coin.price - previous) / previous) * 100;

    priceEl.textContent = fmtPrice(coin.price);
    changeEl.textContent = `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`;
    changeEl.className = `coin-change ${changePct >= 0 ? "up" : "down"}`;
    holdEl.textContent = fmtUnits(portfolio.holdings[symbol] || 0);

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

  const coin = coins[state.chartSymbol];
  if (!coin || coin.history.length < 2) return;
  const series = coin.history;

  const min = Math.min(...series) * 0.995;
  const max = Math.max(...series) * 1.005;
  const range = Math.max(1, max - min);

  chartCtx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  chartCtx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = (height / 4) * i;
    chartCtx.beginPath();
    chartCtx.moveTo(0, y);
    chartCtx.lineTo(width, y);
    chartCtx.stroke();
  }

  chartCtx.beginPath();
  chartCtx.lineWidth = 2.75;
  chartCtx.strokeStyle = "#3b82f6";
  series.forEach((value, idx) => {
    const x = (idx / (series.length - 1)) * (width - 26) + 13;
    const y = height - ((value - min) / range) * (height - 26) - 13;
    if (idx === 0) chartCtx.moveTo(x, y);
    else chartCtx.lineTo(x, y);
  });
  chartCtx.stroke();

  chartCtx.fillStyle = "rgba(234, 240, 255, 0.9)";
  chartCtx.font = "800 12px Manrope";
  chartCtx.fillText(`${state.chartSymbol} ${fmtPrice(coins[state.chartSymbol].price)}`, 14, 20);
}

function addRule(defaults = {}) {
  const id = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const rule = {
    id,
    action: defaults.action || "buy",
    coin: defaults.coin || coinSymbols()[0],
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

    const coinSelect = node.querySelector('[data-field="coin"]');
    coinSelect.innerHTML = coinSymbols()
      .map((symbol) => `<option value="${symbol}">${symbol} · ${coins[symbol].name}</option>`)
      .join("");
    coinSelect.value = rule.coin;

    node.querySelectorAll("[data-field]").forEach((input) => {
      const field = input.dataset.field;
      if (field === "coin") return;
      input.value = rule[field];
    });

    node.querySelectorAll("[data-field]").forEach((input) => {
      const field = input.dataset.field;
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
  ensurePortfolioHasAllCoins();
  const spend = Math.min(Math.max(0, rule.amount), portfolio.cash);
  if (spend <= 0) {
    addActivity(`BUY skipped: not enough cash for ${rule.coin}`, "note");
    return;
  }

  const units = spend / price;
  portfolio.cash -= spend;
  portfolio.holdings[rule.coin] += units;
  rule.lastExecutedTick = state.tick;

  addActivity(`BUY ${rule.coin} ${fmtUnits(units)} @ ${fmtPrice(price)} (spent ${fmtMoney(spend)})`, "buy");
}

function executeSell(rule, price) {
  ensurePortfolioHasAllCoins();
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

  addActivity(`SELL ${rule.coin} ${fmtUnits(unitsToSell)} @ ${fmtPrice(price)} (received ${fmtMoney(proceeds)})`, "sell");
}

function renderPortfolio() {
  ensurePortfolioHasAllCoins();
  let total = portfolio.cash;
  coinSymbols().forEach((symbol) => {
    total += (portfolio.holdings[symbol] || 0) * coins[symbol].price;
  });

  dom.cashValue.textContent = fmtMoney(portfolio.cash);
  dom.totalValue.textContent = fmtMoney(total);

  coinSymbols().forEach((symbol) => {
    const row = dom.portfolioRows.querySelector(`[data-symbol="${symbol}"]`);
    if (!row) return;
    const units = portfolio.holdings[symbol] || 0;
    const value = units * coins[symbol].price;
    row.querySelector('[data-role="units"]').textContent = `${fmtUnits(units)} units`;
    row.querySelector('[data-role="value"]').textContent = `${fmtMoney(value)}`;
  });
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
  dom.marketStatus.textContent = next ? "Bot Running" : "Bot Paused";
  dom.marketStatus.classList.toggle("stopped", !next);

  if (!silent) {
    addActivity(next ? "Bot started" : "Bot stopped", "note");
  }
}

function placeManualOrder(symbol, side, containerEl) {
  ensurePortfolioHasAllCoins();
  const amountEl = containerEl.querySelector('[data-role="tradeAmount"]');
  const unitEl = containerEl.querySelector('[data-role="tradeUnit"]');
  const amount = Number(amountEl.value);
  const unit = unitEl.value === "usd" ? "usd" : "coin";
  const price = coins[symbol].price;

  if (!Number.isFinite(amount) || amount <= 0) {
    addActivity(`${side.toUpperCase()} skipped: invalid amount`, "note");
    return;
  }

  if (side === "buy") {
    const spend = unit === "usd" ? amount : amount * price;
    const actualSpend = Math.min(spend, portfolio.cash);
    if (actualSpend <= 0) {
      addActivity(`BUY ${symbol} skipped: not enough cash`, "note");
      return;
    }
    const units = actualSpend / price;
    portfolio.cash -= actualSpend;
    portfolio.holdings[symbol] += units;
    addActivity(`BUY ${symbol} ${fmtUnits(units)} @ ${fmtPrice(price)} (spent ${fmtMoney(actualSpend)})`, "buy");
  } else {
    const unitsToSell = unit === "coin" ? amount : amount / price;
    const actualUnits = Math.min(unitsToSell, portfolio.holdings[symbol] || 0);
    if (actualUnits <= 0) {
      addActivity(`SELL ${symbol} skipped: no holdings`, "note");
      return;
    }
    const proceeds = actualUnits * price;
    portfolio.holdings[symbol] -= actualUnits;
    portfolio.cash += proceeds;
    addActivity(`SELL ${symbol} ${fmtUnits(actualUnits)} @ ${fmtPrice(price)} (received ${fmtMoney(proceeds)})`, "sell");
  }

  renderPortfolio();
  const card = dom.coinCards.querySelector(`[data-symbol="${symbol}"]`);
  if (card) card.querySelector('[data-role="holdings"]').textContent = fmtUnits(portfolio.holdings[symbol] || 0);
}

function hydrateChartSelect() {
  const symbols = coinSymbols();
  if (!symbols.includes(state.chartSymbol)) state.chartSymbol = symbols[0];

  dom.chartCoinSelect.innerHTML = symbols
    .map((symbol) => `<option value="${symbol}">${symbol} · ${coins[symbol].name}</option>`)
    .join("");
  dom.chartCoinSelect.value = state.chartSymbol;
  dom.chartCoinSelect.addEventListener("change", () => {
    state.chartSymbol = dom.chartCoinSelect.value;
    drawChart();
  });
}

function bootstrap() {
  ensurePortfolioHasAllCoins();
  createMarketCards();
  createPortfolioRows();
  hydrateChartSelect();
  addRule({ action: "buy", coin: "AUR", trigger: "below", price: 140, amount: 400 });
  addRule({ action: "sell", coin: "NEX", trigger: "above", price: 90, amount: 1.2 });
  addRule({ action: "buy", coin: "PEPM", trigger: "below", price: 0.015, amount: 250 });

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
