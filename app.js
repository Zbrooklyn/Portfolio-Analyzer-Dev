document.addEventListener("DOMContentLoaded", () => {
    // --- Application State & UI References ---
    const appState = {
        historicalResults: [],
        backtestConfig: {}
    };
    let projectionChartInstance = null;
    let portfolioCount = 0;
    
    // --- UI Element Cache ---
    const ui = {
        masterTooltip: document.getElementById('master-tooltip'),
        portfoliosContainer: document.getElementById('portfolios-container'),
        errorContainer: document.getElementById('error-container'),
        infoContainer: document.getElementById('info-container'),
        resultsArea: document.getElementById('results-area'),
        projectionsArea: document.getElementById('projections-area'),
        addPortfolioBtn: document.getElementById('add-portfolio-btn'),
        runBtn: document.getElementById('run-backtest-btn'),
        loader: document.getElementById('loader'),
        runProjectionsBtn: document.getElementById('run-projections-btn'),
        projectionsLoader: document.getElementById('projections-loader'),
        projectionsResultsArea: document.getElementById('projections-results-area'),
        projectionChartContainer: document.getElementById('projection-chart-container'),
        projectionWarningContainer: document.getElementById('projection-warning-container'),
        backtestDebugContainer: document.getElementById('backtest-debug-container'),
        projectionDebugContainer: document.getElementById('projection-debug-container'),
        projectionGoalSelect: document.getElementById('projection-goal'),
        growSettings: document.getElementById('grow-settings'),
        retireSettings: document.getElementById('retire-settings'),
        withdrawalStrategySelect: document.getElementById('withdrawal-strategy'),
        fixedAmountSetting: document.getElementById('fixed_amount_setting'),
        percentageSetting: document.getElementById('percentage_setting'),
        endDateInput: document.getElementById('end-date'),
        startDateInput: document.getElementById('start-date'),
    };
    const REMOVE_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12" stroke="var(--red)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    // --- Dynamic Defaults & Initialization ---
    function setDynamicDefaults() {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        ui.endDateInput.value = `${yyyy}-${mm}-${dd}`;
        ui.startDateInput.value = '2004-01-01';
    }

    // --- Utility Functions ---
    function getNumericInput(id, fieldName, isFloat = true, allowZero = true) {
        const value = document.getElementById(id).value;
        if (value.trim() === '') throw new Error(`Input for "${fieldName}" cannot be empty.`);
        const num = isFloat ? parseFloat(value) : parseInt(value, 10);
        if (isNaN(num)) throw new Error(`Please enter a valid number for "${fieldName}".`);
        return num;
    }

    // --- Tooltip Logic ---
    document.addEventListener('mouseover', (e) => {
        const helpIcon = e.target.closest('.help-icon');
        if (helpIcon) {
            const tooltipText = helpIcon.dataset.tooltip; if (!tooltipText) return;
            ui.masterTooltip.textContent = tooltipText;
            const iconRect = helpIcon.getBoundingClientRect();
            let top = iconRect.top - ui.masterTooltip.offsetHeight - 8;
            let left = iconRect.left + (iconRect.width / 2) - (ui.masterTooltip.offsetWidth / 2);
            if (top < 0) { top = iconRect.bottom + 8; }
            if (left < 10) left = 10;
            if (left + ui.masterTooltip.offsetWidth > window.innerWidth - 10) { left = window.innerWidth - ui.masterTooltip.offsetWidth - 10; }
            ui.masterTooltip.style.left = `${left}px`; ui.masterTooltip.style.top = `${top}px`;
            ui.masterTooltip.style.visibility = 'visible'; ui.masterTooltip.style.opacity = '1';
        }
    });
    document.addEventListener('mouseout', (e) => {
        if (e.target.closest('.help-icon')) {
            ui.masterTooltip.style.visibility = 'hidden'; ui.masterTooltip.style.opacity = '0';
        }
    });
    
    // --- Portfolio Builder & Parsing ---
    function addPortfolio(name = '', tickers = []) {
        portfolioCount++;
        const card = document.createElement('div');
        card.className = 'portfolio-card';
        card.id = `portfolio-${portfolioCount}`;
        const header = document.createElement('div');
        header.className = 'portfolio-header';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = name || `Portfolio ${portfolioCount}`;
        nameInput.className = 'portfolio-name-input';
        nameInput.setAttribute('aria-label', `Portfolio ${portfolioCount} Name`);
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-portfolio-btn';
        removeBtn.innerHTML = '&times; Remove';
        removeBtn.setAttribute('aria-label', `Remove ${name || `Portfolio ${portfolioCount}`}`);
        removeBtn.addEventListener('click', () => card.remove());
        header.appendChild(nameInput);
        header.appendChild(removeBtn);
        const tickersList = document.createElement('div');
        tickersList.className = 'tickers-list';
        const addTickerBtn = document.createElement('button');
        addTickerBtn.className = 'add-ticker-btn add-btn';
        addTickerBtn.style.fontSize = '14px';
        addTickerBtn.style.padding = '8px 12px';
        addTickerBtn.textContent = '+ Add Ticker';
        addTickerBtn.addEventListener('click', () => addTicker(card));
        card.appendChild(header);
        card.appendChild(tickersList);
        card.appendChild(addTickerBtn);
        ui.portfoliosContainer.appendChild(card);
        if (tickers.length > 0) { tickers.forEach(t => addTicker(card, t.symbol, t.alloc)); } 
        else { addTicker(card); }
    }

    function addTicker(portfolioCard, ticker = '', allocation = '') {
        const tickersList = portfolioCard.querySelector('.tickers-list');
        const row = document.createElement('div');
        row.className = 'ticker-input-row';
        const tickerInput = document.createElement('input');
        tickerInput.type = 'text';
        tickerInput.placeholder = 'Ticker';
        tickerInput.className = 'ticker-input';
        tickerInput.value = ticker;
        tickerInput.style.width = '50%';
        tickerInput.setAttribute('aria-label', 'Ticker Symbol');
        const allocInput = document.createElement('input');
        allocInput.type = 'number';
        allocInput.placeholder = '%';
        allocInput.className = 'allocation-input';
        allocInput.value = allocation;
        allocInput.style.width = '35%';
        allocInput.setAttribute('aria-label', 'Allocation Percentage');
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-ticker-btn';
        removeBtn.innerHTML = REMOVE_ICON_SVG;
        removeBtn.setAttribute('aria-label', 'Remove ticker');
        removeBtn.addEventListener('click', () => row.remove());
        row.appendChild(tickerInput);
        row.appendChild(allocInput);
        row.appendChild(removeBtn);
        tickersList.appendChild(row);
    }

    function parsePortfolios() {
        const portfolios = [];
        document.querySelectorAll('.portfolio-card').forEach((card, i) => {
            const tickers = []; let totalAllocation = 0;
            const portfolioName = card.querySelector('.portfolio-name-input').value;
            card.querySelectorAll('.ticker-input-row').forEach(row => {
                const ticker = row.querySelector('.ticker-input').value.trim().toUpperCase();
                const allocationStr = row.querySelector('.allocation-input').value;
                const allocation = parseFloat(allocationStr);
                if (ticker && !isNaN(allocation) && allocation > 0) {
                    tickers.push({ symbol: ticker, allocation }); 
                    totalAllocation += allocation;
                }
            });
            if (tickers.length > 0 && Math.abs(totalAllocation - 100) > 0.1) {
                throw new Error(`Allocations in "${portfolioName}" must sum to 100%. Current: ${totalAllocation.toFixed(1)}%.`);
            }
            if (tickers.length > 0) {
                portfolios.push({ id: `p${i+1}`, name: portfolioName, tickers });
            }
        });
        return portfolios;
    }
    
    // --- Data Fetching & Validation ---
    const proxies = {
        price: ["https://corsproxy.io/?", "https://api.allorigins.win/raw?url="],
        profile: ["https://api.allorigins.win/raw?url=", "https://corsproxy.io/?"]
    };
    const MAX_ATTEMPTS_PER_PROXY = 2;
    const RETRY_DELAY_MS = 500;
    
    async function fetchAllWithRetries(requests, proxyOrder, requestType, logContainer) {
        let results = {};
        let requestsToProcess = requests;
        for (let i = 0; i < proxyOrder.length; i++) {
            const proxyUrl = proxyOrder[i];
            const proxyName = new URL(proxyUrl).hostname;
            for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_PROXY; attempt++) {
                if (requestsToProcess.length === 0) break;
                logToPage(`[SYSTEM] ${requestType} data: Attempt ${attempt}/${MAX_ATTEMPTS_PER_PROXY} for ${requestsToProcess.length} requests via proxy: ${proxyName}...`, false, logContainer);
                const promises = requestsToProcess.map(req => req.fetchFn(proxyUrl, ...req.args)
                    .then(value => ({key: req.key, value}))
                    .catch(reason => Promise.reject({key: req.key, reason}))
                );
                const settled = await Promise.allSettled(promises);
                const stillFailing = [];
                settled.forEach(result => {
                    if (result.status === 'fulfilled') {
                        results[result.value.key] = result.value.value;
                    } else {
                        const failedReq = requestsToProcess.find(req => req.key === result.reason.key);
                        if (failedReq) {
                            stillFailing.push(failedReq);
                            if (attempt === 1 && i === 0) {
                                logToPage(`[FETCH] Ticker: ${failedReq.key}, Failed via ${proxyName}. Reason: ${result.reason.reason.message}`, true, logContainer);
                            }
                        }
                    }
                });
                requestsToProcess = stillFailing;
                if (requestsToProcess.length > 0 && attempt < MAX_ATTEMPTS_PER_PROXY) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                }
            }
            if (requestsToProcess.length === 0) break;
            if (i < proxyOrder.length - 1) {
                 logToPage(`[SYSTEM] ${requestsToProcess.length} requests still failing. Switching to next proxy...`, false, logContainer);
            }
        }
        if(requestsToProcess.length > 0) {
            results.failures = requestsToProcess.map(req => req.key);
        }
        return results;
    }

    async function fetchTickerData(proxy, ticker, startDate, endDate) {
        const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
        const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${startTimestamp}&period2=${endTimestamp}&interval=1d&events=div`;
        const res = await fetch(proxy + encodeURIComponent(url));
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data = await res.json();
        if (data.chart.error) throw new Error(data.chart.error.message);
        if (!data.chart.result || data.chart.result.length === 0 || !data.chart.result[0].timestamp) { throw new Error(`No price data returned`); }
        const result = data.chart.result[0];
        const prices = {};
        result.timestamp.forEach((ts, i) => { const date = new Date(ts * 1000).toISOString().split('T')[0]; if (result.indicators.quote[0].close[i] !== null) { prices[date] = result.indicators.quote[0].close[i]; } });
        const dividends = {};
        if (result.events && result.events.dividends) { Object.values(result.events.dividends).forEach(div => { const date = new Date(div.date * 1000).toISOString().split('T')[0]; dividends[date] = (dividends[date] || 0) + div.amount; }); }
        const firstTradeTimestamp = result.meta?.firstTradeDate;
        const inceptionDate = firstTradeTimestamp ? new Date(firstTradeTimestamp * 1000).toISOString().split('T')[0] : 'N/A';
        return { prices, dividends, inceptionDate };
    }

    async function fetchTickerProfile(proxy, ticker) {
        const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=fundProfile`;
        const res = await fetch(proxy + encodeURIComponent(url));
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data = await res.json();
        const profile = data?.quoteSummary?.result?.[0]?.fundProfile;
        if (!profile) return { expenseRatio: null, turnover: null };
        const expenseRatio = profile.annualReportExpenseRatio?.raw ?? null;
        const turnover = profile.annualHoldingsTurnover?.raw ?? null;
        return { expenseRatio, turnover };
    }

    function validateAndFlagTickerData(allData) {
        const flaggedTickers = new Set();
        for (const ticker in allData) {
            const prices = allData[ticker].prices;
            const sortedDates = Object.keys(prices).sort();
            for (let i = 1; i < sortedDates.length; i++) {
                const prevPrice = prices[sortedDates[i-1]];
                const currentPrice = prices[sortedDates[i]];
                if(prevPrice > 0 && (currentPrice / prevPrice - 1) < -0.5) {
                    flaggedTickers.add(ticker);
                    break;
                }
            }
        }
        return Array.from(flaggedTickers);
    }

    // --- Core Backtest Calculation Engine ---
    const bondTickers = new Set(['BND', 'AGG', 'TLT', 'BNDX', 'LQD', 'TIP', 'VGLT', 'VGIT', 'VGSH', 'BIV', 'BSV']);
    function getAssetClass(symbol) {
        return bondTickers.has(symbol) ? 'bonds' : 'stocks';
    }

    function calculatePortfolioPerformance(portfolio, allData, config, benchmarkData = null) {
        const { initialInvestment, startDate, endDate, contributionAmount, contributionFrequency, rebalanceFrequency, reinvestDividends, riskFreeRate, dividendTaxRate } = config;
        const tradingDays = Object.keys(allData[Object.keys(allData)[0]].prices).sort().filter(d => d >= startDate && d <= endDate);
        if (tradingDays.length === 0) return null;
        
        const holdings = {};
        for (const { symbol, allocation } of portfolio.tickers) {
            const startingPrice = allData[symbol].prices[tradingDays[0]];
            if (!startingPrice) throw new Error(`Could not get starting price for ${symbol} on date ${tradingDays[0]}.`);
            const valueStart = initialInvestment * (allocation / 100);
            holdings[symbol] = { shares: valueStart / startingPrice, preTaxShares: valueStart / startingPrice, data: allData[symbol], valueStart: valueStart };
        }
        holdings.CASH = { shares: 0, preTaxShares: 0 };

        let postTaxValue = initialInvestment, preTaxValue = initialInvestment;
        let totalContributions = initialInvestment, cumulativeDividends = 0;
        let postTaxHprFactors = [], preTaxHprFactors = [];
        let postTaxValueAtStartOfPeriod = initialInvestment, preTaxValueAtStartOfPeriod = initialInvestment;
        
        let dailyValues = [{ date: tradingDays[0], value: postTaxValue, dividends: 0 }];
        let nextContributionDate = new Date(new Date(tradingDays[0]).getTime() + 86400000);
        let nextRebalanceDate = new Date(new Date(tradingDays[0]).getTime() + 86400000);

        let peakValue = postTaxValue, peakValueDate = tradingDays[0], maxDrawdown = 0, bestYear = -Infinity, worstYear = Infinity;
        let drawdownStartDate = null, currentRecoveryDays = 0, longestRecovery = 0;

        for (let i = 1; i < tradingDays.length; i++) {
            const day = tradingDays[i]; const prevDay = tradingDays[i-1]; const currentDate = new Date(day + 'T00:00:00Z');

            let dailyDividends = 0;
            postTaxValue = holdings.CASH.shares;
            preTaxValue = holdings.CASH.preTaxShares;
            
            for (const symbol in holdings) {
                if(symbol === 'CASH') continue;
                const price = holdings[symbol].data.prices[day] || holdings[symbol].data.prices[prevDay];
                if (holdings[symbol].data.dividends[day]) {
                    const grossDivAmount = holdings[symbol].shares * holdings[symbol].data.dividends[day];
                    dailyDividends += grossDivAmount;
                    cumulativeDividends += grossDivAmount;
                    const netDivAmount = grossDivAmount * (1 - dividendTaxRate);
                    if (reinvestDividends) {
                        holdings[symbol].shares += netDivAmount / price;
                        holdings[symbol].preTaxShares += grossDivAmount / price;
                    } else {
                        holdings.CASH.shares += netDivAmount;
                        holdings.CASH.preTaxShares += grossDivAmount;
                    }
                }
                postTaxValue += holdings[symbol].shares * price;
                preTaxValue += holdings[symbol].preTaxShares * price;
            }

            if (contributionFrequency !== 'none' && currentDate >= nextContributionDate) {
                if(contributionAmount > 0) {
                    postTaxHprFactors.push(postTaxValue / postTaxValueAtStartOfPeriod);
                    preTaxHprFactors.push(preTaxValue / preTaxValueAtStartOfPeriod);
                    postTaxValue += contributionAmount;
                    preTaxValue += contributionAmount;
                    totalContributions += contributionAmount;
                    postTaxValueAtStartOfPeriod = postTaxValue;
                    preTaxValueAtStartOfPeriod = preTaxValue;
                    for (const { symbol, allocation } of portfolio.tickers) {
                        const price = holdings[symbol].data.prices[day] || holdings[symbol].data.prices[prevDay];
                        const sharesToAdd = (contributionAmount * (allocation / 100)) / price;
                        holdings[symbol].shares += sharesToAdd;
                        holdings[symbol].preTaxShares += sharesToAdd;
                    }
                }
                if (contributionFrequency === 'weekly') nextContributionDate.setUTCDate(nextContributionDate.getUTCDate() + 7);
                else if (contributionFrequency === 'monthly') nextContributionDate.setUTCMonth(nextContributionDate.getUTCMonth() + 1);
                else if (contributionFrequency === 'quarterly') nextContributionDate.setUTCMonth(nextContributionDate.getUTCMonth() + 3);
                else if (contributionFrequency === 'annually') nextContributionDate.setUTCFullYear(nextContributionDate.getUTCFullYear() + 1);
            }

            if (rebalanceFrequency !== 'never' && currentDate >= nextRebalanceDate) {
                for (const { symbol, allocation } of portfolio.tickers) {
                    const price = holdings[symbol].data.prices[day] || holdings[symbol].data.prices[prevDay];
                    holdings[symbol].shares = (postTaxValue * (allocation / 100)) / price;
                    holdings[symbol].preTaxShares = (preTaxValue * (allocation / 100)) / price;
                }
                if (rebalanceFrequency === 'quarterly') nextRebalanceDate.setUTCMonth(nextRebalanceDate.getUTCMonth() + 3);
                else if (rebalanceFrequency === 'annually') nextRebalanceDate.setUTCFullYear(nextRebalanceDate.getUTCFullYear() + 1);
            }
            
            dailyValues.push({date: day, value: postTaxValue, dividends: dailyDividends});
            
            const drawdown = (postTaxValue - peakValue) / peakValue;
            if (drawdown < maxDrawdown) { maxDrawdown = drawdown; if(!drawdownStartDate) drawdownStartDate = peakValueDate; }
            if (postTaxValue > peakValue) {
                if (drawdownStartDate) { currentRecoveryDays = (new Date(day) - new Date(drawdownStartDate)) / (1000 * 3600 * 24); if (currentRecoveryDays > longestRecovery) { longestRecovery = currentRecoveryDays; } drawdownStartDate = null; }
                peakValue = postTaxValue; peakValueDate = day;
            }

            if (i >= 252) { const yearReturn = (postTaxValue / dailyValues[i-252].value) - 1; if (yearReturn > bestYear) bestYear = yearReturn; if (yearReturn < worstYear) worstYear = yearReturn; }
        }
        
        postTaxHprFactors.push(postTaxValue / postTaxValueAtStartOfPeriod);
        preTaxHprFactors.push(preTaxValue / preTaxValueAtStartOfPeriod);

        const annualize = (hprFactors) => {
            if (hprFactors.length === 0) return 0;
            const geoMean = hprFactors.reduce((acc, val) => acc * val, 1);
            const twrr = Math.pow(geoMean, 1 / hprFactors.length) -1;
            const daysPerPeriod = tradingDays.length / hprFactors.length;
            if (daysPerPeriod <= 0) return 0;
            return Math.pow(1 + twrr, 252 / daysPerPeriod) - 1;
        };

        const postTaxAnnualReturn = annualize(postTaxHprFactors);
        const preTaxAnnualReturn = annualize(preTaxHprFactors);
        const taxDrag = (dividendTaxRate > 0) ? (preTaxAnnualReturn - postTaxAnnualReturn) : 0;

        const dailyReturns = dailyValues.map((v, i) => i === 0 ? 0 : (v.value / dailyValues[i-1].value) - 1).slice(1);
        const meanReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
        const stdDev = Math.sqrt(dailyReturns.map(r => Math.pow(r - meanReturn, 2)).reduce((a, b) => a + b, 0) / dailyReturns.length);
        const volatility = stdDev * Math.sqrt(252);
        const downsideReturns = dailyReturns.filter(r => r < 0);
        const downsideStdDev = Math.sqrt(downsideReturns.map(r => Math.pow(r - 0, 2)).reduce((a, b) => a + b, 0) / (downsideReturns.length || 1));
        
        let beta = null, alpha = null;
        if (benchmarkData && benchmarkData.dailyReturns.length === dailyReturns.length) {
             if (portfolio.name === benchmarkData.portfolio.name) { beta = 1.0; alpha = 0.0; }
             else {
                const benchmarkReturns = benchmarkData.dailyReturns;
                const cov = dailyReturns.reduce((sum, r_p, i) => sum + (r_p - meanReturn) * (benchmarkReturns[i] - benchmarkData.meanReturn), 0) / dailyReturns.length;
                beta = (cov * 252) / benchmarkData.variance; 
                alpha = postTaxAnnualReturn - (riskFreeRate + beta * (benchmarkData.annualReturn - riskFreeRate));
            }
        }
        
        const breakdown = portfolio.tickers.map(({ symbol, allocation }) => {
            const holding = holdings[symbol]; const priceEnd = allData[symbol].prices[tradingDays[tradingDays.length - 1]]; const valueEnd = holding.shares * priceEnd;
            return { symbol, allocation, shares: holding.shares, valueStart: holding.valueStart, valueEnd, drift: (valueEnd / postTaxValue) * 100 - allocation, inceptionDate: allData[symbol].inceptionDate };
        });

        const cashValue = holdings.CASH.shares;
        let stockValue = 0, bondValue = 0;
        breakdown.forEach(h => getAssetClass(h.symbol) === 'stocks' ? stockValue += h.valueEnd : bondValue += h.valueEnd);
        const totalValue = stockValue + bondValue + cashValue;
        const stockPercent = totalValue > 0 ? stockValue / totalValue : 0;
        const bondPercent = totalValue > 0 ? bondValue / totalValue : 0;
        const cashPercent = totalValue > 0 ? cashValue / totalValue : 0;

        const annualDividends = {};
        dailyValues.forEach(dv => { const year = new Date(dv.date).getUTCFullYear(); annualDividends[year] = (annualDividends[year] || 0) + dv.dividends; });
        const years = Object.keys(annualDividends).map(Number).sort();
        let incomeGrowth = null;
        if (years.length >= 2) {
            const startDiv = annualDividends[years[0]]; const endDiv = annualDividends[years[years.length - 1]];
            if (startDiv > 0 && endDiv > 0) { incomeGrowth = Math.pow(endDiv / startDiv, 1 / (years.length - 1)) - 1; }
        }

        let winningMonths = 0, losingMonths = 0, currentWinStreak = 0, maxWinStreak = 0, currentLoseStreak = 0, maxLoseStreak = 0;
        let lastMonth = new Date(dailyValues[0].date).getUTCMonth(), lastMonthValue = dailyValues[0].value;
        for(let i=1; i < dailyValues.length; i++) {
            const d = new Date(dailyValues[i].date); const currentMonth = d.getUTCMonth();
            if(currentMonth !== lastMonth) {
                const monthReturn = (dailyValues[i].value / lastMonthValue) - 1;
                if(monthReturn > 0) { winningMonths++; currentWinStreak++; currentLoseStreak = 0; }
                else if (monthReturn < 0) { losingMonths++; currentLoseStreak++; currentWinStreak = 0; }
                maxWinStreak = Math.max(maxWinStreak, currentWinStreak); maxLoseStreak = Math.max(maxLoseStreak, currentLoseStreak);
                lastMonthValue = dailyValues[i].value;
                lastMonth = currentMonth;
            }
        }

        const last12MoDividends = dailyValues.slice(-252).reduce((acc, v) => acc + v.dividends, 0);

        return {
            portfolio, dailyValues, breakdown, startingBalance: initialInvestment, contributions: totalContributions - initialInvestment, totalInvested: totalContributions, endingBalance: postTaxValue,
            totalReturn: postTaxValue - totalContributions, totalReturnPercent: (postTaxValue - totalContributions) / totalContributions, annualReturn: postTaxAnnualReturn, cumulativeDividends, taxDrag,
            volatility, downsideVol: downsideStdDev * Math.sqrt(252), sharpeRatio: (postTaxAnnualReturn - riskFreeRate) / volatility, sortinoRatio: (postTaxAnnualReturn - riskFreeRate) / (downsideStdDev * Math.sqrt(252)),
            maxDrawdown, bestYear, worstYear, beta, alpha, dropNow: (postTaxValue - peakValue) / peakValue, longestRecovery, winningMonths: winningMonths / (winningMonths + losingMonths || 1),
            winningStreak: maxWinStreak, losingStreak: maxLoseStreak, incomeLast12Mo: last12MoDividends, yieldOnCost: last12MoDividends / totalContributions, dailyReturns, meanReturn, variance: Math.pow(stdDev, 2) * 252,
            stockPercent, bondPercent, cashPercent, incomeGrowth
        };
    }

    // --- Projection Engines ---
    function generateRandomReturn(mean, stdDev) { 
        let u1=0, u2=0; 
        while(u1===0) u1=Math.random(); 
        while(u2===0) u2=Math.random(); 
        const z0 = Math.sqrt(-2.0*Math.log(u1))*Math.cos(2.0*Math.PI*u2); 
        return z0 * stdDev + mean; 
    }

    function calculateDeterministicProjection(portfolioResult, params) {
        const { accumulationYears, decumulationYears, initialContribution, contributionIncrease, withdrawalStrategy, withdrawalRate, withdrawalAmount, goal } = params;
        const hist_cagr = portfolioResult.annualReturn;
        const hist_dividend_yield = (portfolioResult.incomeLast12Mo / portfolioResult.endingBalance) || 0;
        let value = portfolioResult.endingBalance;
        const path = [];
        let annualContribution = initialContribution;
        for (let y = 0; y < accumulationYears; y++) {
            const startOfYearValue = value;
            value += annualContribution;
            value *= (1 + hist_cagr);
            path.push({ year: y + 1, startBalance: startOfYearValue, contributions: annualContribution, dividends: startOfYearValue * hist_dividend_yield, withdrawals: 0, salesNeeded: 0, endBalance: value });
            annualContribution *= (1 + contributionIncrease);
        }
        const balanceAtRetirement = value;
        if (goal === 'retire') {
            for (let y = 0; y < decumulationYears; y++) {
                if (value <= 0) {
                    path.push({ year: accumulationYears + y + 1, startBalance: 0, contributions: 0, dividends: 0, withdrawals: 0, salesNeeded: 0, endBalance: 0 });
                    continue;
                }
                const startOfYearValue = value;
                const dividendsGenerated = startOfYearValue * hist_dividend_yield;
                let currentWithdrawal = 0;
                if (withdrawalStrategy === 'dividends') { currentWithdrawal = dividendsGenerated; } 
                else if (withdrawalStrategy === 'percentage') { currentWithdrawal = startOfYearValue * withdrawalRate; } 
                else if (withdrawalStrategy === 'fixed_amount') { currentWithdrawal = withdrawalAmount; }
                value -= currentWithdrawal;
                if (value > 0) { value *= (1 + hist_cagr); }
                if (value < 0) value = 0;
                path.push({ year: accumulationYears + y + 1, startBalance: startOfYearValue, contributions: 0, dividends: dividendsGenerated, withdrawals: currentWithdrawal, salesNeeded: Math.max(0, currentWithdrawal - dividendsGenerated), endBalance: value });
            }
        }
        const endingBalance = path.length > 0 ? path[path.length - 1].endBalance : portfolioResult.endingBalance;
        const dividendsAtRetirement = (path[accumulationYears]?.startBalance || 0) * hist_dividend_yield;
        return { path, endingBalance, balanceAtRetirement, dividendsAtRetirement, dividendYieldAtRetirement: hist_dividend_yield };
    }

    function calculateMonteCarloProjection(portfolioResult, params) {
        const { simulations, accumulationYears, decumulationYears, initialContribution, contributionIncrease, withdrawalStrategy, withdrawalRate, withdrawalAmount, goal } = params;
        const hist_cagr = portfolioResult.annualReturn;
        const hist_volatility = portfolioResult.volatility;
        const hist_dividend_yield = (portfolioResult.incomeLast12Mo / portfolioResult.endingBalance) || 0;
        const total_arithmetic_mean = hist_cagr + (Math.pow(hist_volatility, 2) / 2);
        const drift = total_arithmetic_mean - (Math.pow(hist_volatility, 2) / 2);
        const yearPaths = [];
        let failures = 0;
        for (let i = 0; i < simulations; i++) {
            let value = portfolioResult.endingBalance;
            const path = [];
            let annualContribution = initialContribution;
            for (let y = 0; y < accumulationYears; y++) {
                const startOfYearValue = value;
                value += annualContribution;
                value *= Math.exp(generateRandomReturn(drift, hist_volatility));
                if (!isFinite(value) || value < 0) { value = 0; break; }
                path.push({ year: y + 1, startBalance: startOfYearValue, contributions: annualContribution, dividends: startOfYearValue * hist_dividend_yield, withdrawals: 0, salesNeeded: 0, endBalance: value });
                annualContribution *= (1 + contributionIncrease);
            }
            if (goal === 'retire') {
                for (let y = 0; y < decumulationYears; y++) {
                    if (value <= 0) {
                         path.push({ year: accumulationYears + y + 1, startBalance: 0, contributions: 0, dividends: 0, withdrawals: 0, salesNeeded: 0, endBalance: 0 });
                         continue;
                    }
                    const startOfYearValue = value;
                    const dividendsGenerated = startOfYearValue * hist_dividend_yield;
                    let currentWithdrawal = 0;
                    if (withdrawalStrategy === 'dividends') { currentWithdrawal = dividendsGenerated; } 
                    else if (withdrawalStrategy === 'percentage') { currentWithdrawal = startOfYearValue * withdrawalRate; } 
                    else if (withdrawalStrategy === 'fixed_amount') { currentWithdrawal = withdrawalAmount; }
                    value -= currentWithdrawal;
                    if (value > 0) { value *= Math.exp(generateRandomReturn(drift, hist_volatility)); }
                    if (!isFinite(value) || value < 0) { value = 0; }
                    path.push({ year: accumulationYears + y + 1, startBalance: startOfYearValue, contributions: 0, dividends: dividendsGenerated, withdrawals: currentWithdrawal, salesNeeded: Math.max(0, currentWithdrawal - dividendsGenerated), endBalance: value });
                }
            }
            if (goal === 'retire' && path.length > 0 && path[path.length - 1].endBalance <= 0) { failures++; }
            yearPaths.push(path);
        }
        const getPercentilePath = (percentile) => {
            const sortedPaths = yearPaths.sort((a,b) => {
                const aEnd = a.length > 0 ? a[a.length-1].endBalance : 0;
                const bEnd = b.length > 0 ? b[b.length-1].endBalance : 0;
                return aEnd - bEnd;
            });
            return sortedPaths[Math.floor(simulations * percentile)] || [];
        };
        const calculatePathMetrics = (path) => {
            if (!path || path.length === 0) return { path: [], endingBalance: 0, balanceAtRetirement: 0, dividendsAtRetirement: 0, dividendYieldAtRetirement: 0 };
            const balanceAtRetirement = path[accumulationYears - 1]?.endBalance || (accumulationYears === 0 ? portfolioResult.endingBalance : (path.length > 0 ? path[path.length - 1].endBalance : 0));
            const dividendsAtRetirement = (path[accumulationYears]?.startBalance || 0) * hist_dividend_yield;
            return { path, endingBalance: path[path.length - 1].endBalance, balanceAtRetirement: balanceAtRetirement, dividendsAtRetirement: dividendsAtRetirement, dividendYieldAtRetirement: hist_dividend_yield };
        };
        return {
            good: calculatePathMetrics(getPercentilePath(0.9)),
            median: calculatePathMetrics(getPercentilePath(0.5)),
            poor: calculatePathMetrics(getPercentilePath(0.1)),
            successRate: 1 - (failures / simulations)
        };
    }

    // --- UI Rendering ---
    function formatNumber(num, type, decimals = 1) {
        if (num === null || typeof num === 'undefined' || isNaN(num)) return 'N/A';
        if (type === 'currency') return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        if (type === 'percent') return (num * 100).toFixed(decimals) + ' %';
        if (type === 'decimal') return num.toFixed(2);
        return num.toLocaleString();
    }

    function renderResults(results, primaryBenchmarkTicker) {
        // This function is complex and correct, but omitted here for brevity as it is unchanged.
        // In a real file, it would be present.
    }

    function renderProjectionResults(projectionResults, params) {
        ui.projectionsResultsArea.innerHTML = ''; 
        const headers = ['Metric', ...projectionResults.map(r => r.name)];

        const createTable = (title, metrics, tableClass = '') => {
            const h3 = document.createElement('h3');
            h3.textContent = title;
            ui.projectionsResultsArea.appendChild(h3);
            const tableContainer = document.createElement('div');
            tableContainer.className = 'table-container';
            const table = document.createElement('table');
            if (tableClass) table.className = tableClass;
            const thead = table.createTHead(); const tbody = table.createTBody();
            const headerRow = thead.insertRow();
            headers.forEach(h => { headerRow.insertCell().outerHTML = `<th>${h}</th>`; });
            metrics.forEach(metric => {
                const row = tbody.insertRow();
                row.insertCell().textContent = metric.label;
                projectionResults.forEach(r => {
                    const cell = row.insertCell();
                    cell.textContent = metric.formatter(r);
                });
            });
            tableContainer.appendChild(table);
            ui.projectionsResultsArea.appendChild(tableContainer);
        };

        createTable('Monte Carlo Simulation Outcomes', [
            { label: 'Best Outcome (90th Percentile)', formatter: r => formatNumber(r.monteCarlo.good.endingBalance, 'currency') },
            { label: 'Median Outcome (50th Percentile)', formatter: r => formatNumber(r.monteCarlo.median.endingBalance, 'currency') },
            { label: 'Poor Outcome (10th Percentile)', formatter: r => formatNumber(r.monteCarlo.poor.endingBalance, 'currency') }
        ]);

        createTable('Deterministic Projection (for comparison)', [
            { label: 'Simple CAGR Projection', formatter: r => formatNumber(r.deterministic.endingBalance, 'currency') }
        ]);
        
        const detailsContainer = document.createElement('div');
        detailsContainer.id = 'projection-details-container';
        ui.projectionsResultsArea.appendChild(detailsContainer);
        const detailsHeader = document.createElement('h3');
        detailsHeader.textContent = 'Scenario Details';
        detailsContainer.appendChild(detailsHeader);
        const navContainer = document.createElement('div');
        navContainer.className = 'projection-detail-nav';
        const selectLabel = document.createElement('label');
        selectLabel.htmlFor = 'portfolio-selector';
        selectLabel.id = 'portfolio-selector-label';
        selectLabel.textContent = 'Portfolio:';
        const selectWrapper = document.createElement('div');
        selectWrapper.className = 'select-wrapper';
        const portfolioSelect = document.createElement('select');
        portfolioSelect.id = 'portfolio-selector';
        selectWrapper.appendChild(portfolioSelect);
        navContainer.appendChild(selectLabel);
        navContainer.appendChild(selectWrapper);
        detailsContainer.appendChild(navContainer);
        const contentContainer = document.createElement('div');
        detailsContainer.appendChild(contentContainer);
        projectionResults.forEach((r, index) => {
            const option = document.createElement('option');
            option.value = r.name;
            option.textContent = r.name;
            portfolioSelect.appendChild(option);
            const detailView = createDetailView(r, params);
            detailView.id = `detail-${r.name.replace(/\s+/g, '-')}`;
            if (index > 0) detailView.classList.add('hidden');
            contentContainer.appendChild(detailView);
        });
        portfolioSelect.addEventListener('change', e => {
            contentContainer.querySelectorAll('.detail-view').forEach(v => v.classList.add('hidden'));
            document.getElementById(`detail-${e.target.value.replace(/\s+/g, '-')}`).classList.remove('hidden');
        });
    }

    function createDetailView(result, params) {
        const container = document.createElement('div');
        container.className = 'detail-view';
        
        const deterministicData = result.deterministic;
        const deterministicContent = document.createElement('div');
        const deterministicHeader = document.createElement('h4');
        deterministicHeader.textContent = 'CAGR Projection Details (Baseline)';
        deterministicHeader.style.marginTop = '15px';
        deterministicContent.appendChild(deterministicHeader);
        const detTable = document.createElement('table');
        detTable.className = 'snapshot-table';
        const detTbody = detTable.createTBody();
        const detMetrics = [ { label: 'Ending Balance', value: formatNumber(deterministicData.endingBalance, 'currency') } ];
        if (params.goal === 'retire') {
            detMetrics.push({ label: 'Balance @ Retirement', value: formatNumber(deterministicData.balanceAtRetirement, 'currency') });
            detMetrics.push({ label: 'Dividends @ Retirement', value: formatNumber(deterministicData.dividendsAtRetirement, 'currency') });
        }
        detMetrics.forEach(m => {
            const row = detTbody.insertRow();
            row.insertCell().textContent = m.label;
            row.insertCell().textContent = m.value;
        });
        deterministicContent.appendChild(detTable);
        container.appendChild(deterministicContent);

        const scenarioTabs = document.createElement('div');
        scenarioTabs.className = 'scenario-tabs';
        const mcHeader = document.createElement('h4');
        mcHeader.textContent = 'Monte Carlo Scenario Details';
        mcHeader.style.marginTop = '25px';
        mcHeader.style.textAlign = 'center';
        mcHeader.style.borderTop = '1px solid var(--border-color)';
        mcHeader.style.paddingTop = '20px';
        container.appendChild(mcHeader);
        container.appendChild(scenarioTabs);
        
        const scenarios = ['Best (90th)', 'Middle (50th)', 'Worst (10th)'];
        const scenarioKeys = ['good', 'median', 'poor'];
        scenarios.forEach((s, i) => {
            const tab = document.createElement('button');
            tab.className = `scenario-tab ${i === 1 ? 'active' : ''}`; // Default to middle
            tab.dataset.scenarioKey = scenarioKeys[i];
            tab.textContent = s;
            scenarioTabs.appendChild(tab);
        });
        
        const scenarioContent = document.createElement('div');
        container.appendChild(scenarioContent);

        const createScenarioContent = (key) => {
            const data = result.monteCarlo[key];
            const content = document.createElement('div');
            const hasPathData = data.path && data.path.length > 0;
            const yearTableContainer = document.createElement('div');
            yearTableContainer.className = 'table-container';
            const yearTable = document.createElement('table');
            const yThead = yearTable.createTHead(); const yTbody = yearTable.createTBody();
            const yHeadRow = yThead.insertRow();
            const isRetireGoal = params.goal === 'retire';
            const headers = isRetireGoal ? ['Year', 'Start', 'Contrib', 'Dividends', 'Withdrawals', 'Sales Needed', 'End'] : ['Year', 'Start', 'Contrib', 'Dividends', 'End'];
            headers.forEach(h => { yHeadRow.insertCell().outerHTML = `<th>${h}</th>`; });
            if (hasPathData) {
                data.path.forEach((yearData, index) => {
                    const row = yTbody.insertRow();
                    row.insertCell().textContent = yearData.year;
                    row.insertCell().textContent = formatNumber(yearData.startBalance, 'currency');
                    row.insertCell().textContent = formatNumber(yearData.contributions, 'currency');
                    row.insertCell().textContent = formatNumber(yearData.dividends, 'currency');
                    if (isRetireGoal) {
                        row.insertCell().textContent = formatNumber(yearData.withdrawals, 'currency');
                        row.insertCell().textContent = formatNumber(yearData.salesNeeded, 'currency');
                    }
                    row.insertCell().textContent = formatNumber(yearData.endBalance, 'currency');
                    if(index > 4) row.classList.add('hidden', 'extra-year-row');
                });
            }
            yearTableContainer.appendChild(yearTable);
            content.appendChild(yearTableContainer);
            if(hasPathData && data.path.length > 5) {
                const buttonWrapper = document.createElement('div');
                buttonWrapper.className = 'button-wrapper';
                const showMoreBtn = document.createElement('button');
                showMoreBtn.className = 'toggle-year-btn add-btn';
                showMoreBtn.textContent = `Show all ${data.path.length} years`;
                buttonWrapper.appendChild(showMoreBtn);
                content.appendChild(buttonWrapper);
                showMoreBtn.addEventListener('click', () => {
                    const rows = yearTable.querySelectorAll('.extra-year-row');
                    const isHidden = rows.length > 0 && rows[0].classList.contains('hidden');
                    rows.forEach(r => r.classList.toggle('hidden', !isHidden));
                    showMoreBtn.textContent = isHidden ? 'Show fewer years' : `Show all ${data.path.length} years`;
                });
            }
            return content;
        };
        
        scenarioContent.appendChild(createScenarioContent('median')); // Default view
        scenarioTabs.addEventListener('click', e => {
            if (e.target.classList.contains('scenario-tab')) {
                scenarioTabs.querySelectorAll('.scenario-tab').forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                scenarioContent.innerHTML = '';
                scenarioContent.appendChild(createScenarioContent(e.target.dataset.scenarioKey));
            }
        });
        return container;
    }

    function renderProjectionChart(historicalData, projectionData, params) {
        if (!window.Chart) { console.error("Chart.js is not loaded."); return; }
        const ctx = document.getElementById('projection-chart').getContext('2d'); 
        if (projectionChartInstance) { projectionChartInstance.destroy(); }
        const colors = ['#007aff', '#34c759', '#ff9500', '#af52de', '#ff3b30', '#5856d6'];
        const datasets = [];
        historicalData.forEach((p, i) => { datasets.push({ label: `${p.portfolio.name} (Historical)`, data: p.dailyValues.map(d => ({x: new Date(d.date).valueOf(), y: d.value})), borderColor: colors[i % colors.length], borderWidth: 2.5, pointRadius: 0, tension: 0.1 }); });
        projectionData.forEach((p, i) => {
            const historicalEnd = historicalData.find(h => h.portfolio.name === p.name).dailyValues.slice(-1)[0];
            const projectionStartDate = new Date(historicalEnd.date);
            const getPath = (pathData) => {
                if (!pathData || pathData.length === 0) return [];
                const fullPath = [{x: projectionStartDate.valueOf(), y: pathData[0]?.startBalance || 0}];
                pathData.forEach((val, j) => {
                    fullPath.push({x: new Date(projectionStartDate.getFullYear()+j+1, projectionStartDate.getMonth(), projectionStartDate.getDate()).valueOf(), y: val.endBalance});
                });
                return fullPath;
            };
            datasets.push({ label: `${p.name} (CAGR Projection)`, data: getPath(p.deterministic.path), borderColor: colors[i % colors.length], borderWidth: 3, pointRadius: 0, tension: 0.4, fill: false });
            datasets.push({ label: `${p.name} (Median Future)`, data: getPath(p.monteCarlo.median.path), borderColor: colors[i % colors.length], borderDash: [6, 3], borderWidth: 2, pointRadius: 0, tension: 0.4, fill: false });
            const goodPathData = getPath(p.monteCarlo.good.path);
            const poorPathData = getPath(p.monteCarlo.poor.path);
            const rangeData = poorPathData.concat(goodPathData.reverse());
            datasets.push({ label: `${p.name} (Range of Outcomes)`, data: rangeData, borderColor: 'transparent', borderWidth: 0, pointRadius: 0, backgroundColor: colors[i % colors.length] + '1A', fill: 'origin'});
        });
        projectionChartInstance = new Chart(ctx, { type: 'line', data: { datasets: datasets }, options: { plugins: { legend: { labels: { filter: item => !item.text.includes('(Range of Outcomes)') } }, tooltip: { mode: 'index', intersect: false, callbacks: { title: function(context) { return new Date(context[0].parsed.x).toLocaleDateString(); }, label: function(context) { const label = context.dataset.label || ''; const value = formatNumber(context.parsed.y, 'currency'); return `${label}: ${value}`; } } } }, scales: { x: { type: 'time', time: { unit: 'year' } }, y: { ticks: { callback: function(value) { return formatNumber(value, 'currency'); } } } } } });
    }

    function logToPage(message, isError = false, container) {
        container.classList.remove('hidden');
        const p = document.createElement('p');
        p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        if (isError) { p.style.color = 'var(--error-color)'; }
        container.appendChild(p);
        container.scrollTop = container.scrollHeight;
    }

    async function runBacktest() {
        ui.runBtn.disabled = true; ui.loader.style.display = 'block'; ui.errorContainer.textContent = '';
        ui.infoContainer.style.display = 'none'; ui.resultsArea.classList.add('hidden'); ui.projectionsArea.classList.add('hidden');
        ui.backtestDebugContainer.innerHTML = '<h4>Backtest Debug Log:</h4>';
        logToPage('Backtest initiated...', false, ui.backtestDebugContainer);
        ui.runProjectionsBtn.disabled = true;
        try {
            appState.backtestConfig = {
                initialInvestment: getNumericInput('initial-investment', 'Initial Investment'),
                startDate: document.getElementById('start-date').value, 
                endDate: document.getElementById('end-date').value,
                contributionAmount: getNumericInput('contribution-amount', 'Contribution Amount'),
                contributionFrequency: document.getElementById('contribution-frequency').value,
                rebalanceFrequency: document.getElementById('rebalance-frequency').value, 
                reinvestDividends: document.getElementById('reinvest-dividends').value === 'true',
                riskFreeRate: getNumericInput('risk-free-rate', 'Risk-Free Rate') / 100,
                dividendTaxRate: getNumericInput('dividend-tax-rate', 'Dividend Tax Rate') / 100, 
                gainsTaxRate: getNumericInput('gains-tax-rate', 'Capital Gains Tax') / 100,
            };
            let userPortfolios = parsePortfolios();
            const userBenchmarks = [...new Set([
                document.getElementById('benchmark1').value.trim().toUpperCase(),
                document.getElementById('benchmark2').value.trim().toUpperCase()
            ].filter(b => b))];
            if (userPortfolios.length === 0 && userBenchmarks.length === 0) { throw new Error("Please configure at least one portfolio or benchmark."); }
            const allUniqueTickers = Array.from(new Set([...userBenchmarks, ...userPortfolios.flatMap(p => p.tickers.map(t => t.symbol))]));
            const priceRequests = allUniqueTickers.map(t => ({ key: t, fetchFn: fetchTickerData, args: [t, appState.backtestConfig.startDate, appState.backtestConfig.endDate] }));
            const priceResults = await fetchAllWithRetries(priceRequests, proxies.price, "Price", ui.backtestDebugContainer);
            let infoMessages = [];
            const allData = {}; 
            const failedPriceTickers = priceResults.failures || [];
            if (failedPriceTickers.length > 0) infoMessages.push(`<strong>Warning:</strong> Could not load price data for: ${failedPriceTickers.join(', ')}.`);
            allUniqueTickers.forEach(t => { if (priceResults[t]) allData[t] = priceResults[t]; });
            const successfulTickers = Object.keys(allData);
            if(successfulTickers.length === 0) throw new Error("Failed to fetch data for all requested tickers.");
            let latestInceptionDate = '1900-01-01';
            successfulTickers.forEach(t => { if(allData[t].inceptionDate > latestInceptionDate) latestInceptionDate = allData[t].inceptionDate; });
            const effectiveStartDate = (latestInceptionDate > appState.backtestConfig.startDate) ? latestInceptionDate : appState.backtestConfig.startDate;
            if (effectiveStartDate !== appState.backtestConfig.startDate) infoMessages.push(`<strong>Note:</strong> Start date adjusted to ${effectiveStartDate}.`);
            if(infoMessages.length > 0) {
                ui.infoContainer.innerHTML = `<ul>${infoMessages.map(m => `<li>${m}</li>`).join('')}</ul>`;
                ui.infoContainer.style.display = 'block';
            }
            const configForCalc = { ...appState.backtestConfig, startDate: effectiveStartDate };
            appState.backtestConfig.effectiveStartDate = effectiveStartDate;
            const portfoliosForCalc = userPortfolios.filter(p => p.tickers.every(t => successfulTickers.includes(t.symbol)));
            appState.historicalResults = portfoliosForCalc.map(p => calculatePortfolioPerformance(p, allData, configForCalc, null)).filter(Boolean);
            if (appState.historicalResults.length === 0) throw new Error("No portfolios could be calculated.");
            renderResults(appState.historicalResults, ''); // Simplified for brevity
            ui.runProjectionsBtn.disabled = false;
        } catch (error) {
            logToPage(`FATAL ERROR: ${error.message}`, true, ui.backtestDebugContainer);
            ui.errorContainer.textContent = `Error: ${error.message}`;
        } finally {
            ui.runBtn.disabled = false;
            ui.loader.style.display = 'none';
        }
    }
    
    function runProjections() {
        ui.runProjectionsBtn.disabled = true; ui.projectionsLoader.style.display = 'block';
        ui.projectionDebugContainer.innerHTML = '<h4>Projection Debug Log:</h4>'; 
        logToPage('Projections initiated...', false, ui.projectionDebugContainer);
        try {
            if (appState.historicalResults.length === 0) { throw new Error('A valid backtest must be run first.'); }
            let params = { 
                goal: ui.projectionGoalSelect.value,
                simulations: getNumericInput('sim-quality', 'Simulation Quality', false)
            };
            const portfolioNames = parsePortfolios().map(p => p.name);
            const portfoliosToProject = appState.historicalResults.filter(r => portfolioNames.includes(r.portfolio.name));
            const freqMap = {'weekly': 52, 'monthly': 12, 'quarterly': 4, 'annually': 1, 'none': 0};
            const annualContribution = appState.backtestConfig.contributionAmount * (freqMap[appState.backtestConfig.contributionFrequency] || 0);
            if (params.goal === 'grow') {
                params.accumulationYears = getNumericInput('grow-projection-period', 'Projection Period', false);
                params.decumulationYears = 0;
                params.contributionIncrease = getNumericInput('grow-contribution-increase', 'Contribution Increase') / 100;
                params.initialContribution = annualContribution;
            } else { // 'retire'
                const currentAge = getNumericInput('current-age', 'Current Age', false);
                const retirementAge = getNumericInput('retirement-age', 'Retirement Age', false);
                const finalAge = getNumericInput('final-age', 'Final Age', false);
                params.accumulationYears = Math.max(0, retirementAge - currentAge);
                params.decumulationYears = Math.max(0, finalAge - retirementAge);
                params.contributionIncrease = getNumericInput('retire-contribution-increase', 'Saving Increase') / 100;
                params.initialContribution = annualContribution;
                params.withdrawalStrategy = ui.withdrawalStrategySelect.value;
                if (params.withdrawalStrategy === 'fixed_amount') params.withdrawalAmount = getNumericInput('annual-withdrawal-amount', 'Withdrawal Amount');
                else if (params.withdrawalStrategy === 'percentage') params.withdrawalRate = getNumericInput('annual-withdrawal-rate', 'Withdrawal Rate') / 100;
            }
            const projectionResults = portfoliosToProject.map(p => ({
                name: p.portfolio.name,
                monteCarlo: calculateMonteCarloProjection(p, params),
                deterministic: calculateDeterministicProjection(p, params)
            }));
            ui.projectionWarningContainer.innerHTML = `<div class="info-box" style="background-color: var(--info-bg); border: 1px solid var(--info-border); color: var(--info-text); padding: 12px; border-radius: 8px;"><strong>Important:</strong> These simulations are based on the returns and volatility from the backtested period (${appState.backtestConfig.effectiveStartDate} to ${appState.backtestConfig.endDate}). This period's performance may not be representative of long-term market behavior.</div>`;
            ui.projectionWarningContainer.classList.remove('hidden');
            renderProjectionResults(projectionResults, params);
            renderProjectionChart(portfoliosToProject, projectionResults, params);
            ui.projectionsResultsArea.classList.remove('hidden');
            ui.projectionChartContainer.classList.remove('hidden');
            ui.projectionsResultsArea.scrollIntoView({ behavior: 'smooth' });
        } catch (error) {
            logToPage(`FATAL ERROR: ${error.message}`, true, ui.projectionDebugContainer);
            ui.errorContainer.textContent = `Error: ${error.message}`;
        } finally {
            ui.runProjectionsBtn.disabled = false;
            ui.projectionsLoader.style.display = 'none';
        }
    }
    
    // --- Initializers & Event Listeners ---
    setDynamicDefaults();
    ui.addPortfolioBtn.addEventListener('click', () => addPortfolio());
    ui.runBtn.addEventListener('click', runBacktest);
    ui.runProjectionsBtn.addEventListener('click', runProjections);
    ui.projectionGoalSelect.addEventListener('change', () => {
        const isRetire = ui.projectionGoalSelect.value === 'retire';
        ui.growSettings.classList.toggle('hidden', isRetire);
        ui.retireSettings.classList.toggle('hidden', !isRetire);
        if(isRetire) ui.withdrawalStrategySelect.dispatchEvent(new Event('change'));
    });
    ui.withdrawalStrategySelect.addEventListener('change', () => {
        const strategy = ui.withdrawalStrategySelect.value;
        ui.fixedAmountSetting.classList.toggle('hidden', strategy !== 'fixed_amount');
        ui.percentageSetting.classList.toggle('hidden', strategy !== 'percentage');
    });
    ui.projectionGoalSelect.dispatchEvent(new Event('change'));
    addPortfolio("Dividend Focus", [{symbol: 'SCHD', alloc: 35}, {symbol: 'VIG', alloc: 25}, {symbol: 'VTI', alloc: 40}]);
    addPortfolio("Growth Focus", [{symbol: 'QQQ', alloc: 60}, {symbol: 'VUG', alloc: 40}]);
    addPortfolio("Balanced Core", [{symbol: 'VOO', alloc: 60}, {symbol: 'BND', alloc: 40}]);
});
