/**
 * FinCode-Auditor GPT: Portfolio Backtester v8.2.0 (Stable)
 * This script contains all the logic for the portfolio backtesting and projection application.
 * It is designed to be linked from the accompanying index.html file.
 */
document.addEventListener("DOMContentLoaded", () => {
    // --- CACHED UI REFERENCES ---
    const ui = {
        masterTooltip: document.getElementById('master-tooltip'),
        portfoliosContainer: document.getElementById('portfolios-container'),
        portfoliosEmptyState: document.getElementById('portfolios-empty-state'),
        errorContainer: document.getElementById('error-container'),
        infoContainer: document.getElementById('info-container'),
        resultsArea: document.getElementById('results-area'),
        resultsViewToggle: document.getElementById('results-view-toggle'),
        performanceChartCard: document.getElementById('performance-chart-card'),
        projectionsArea: document.getElementById('projections-area'),
        projectionWarning: document.getElementById('projection-warning'),
        addPortfolioBtn: document.getElementById('add-portfolio-btn'),
        runBtn: document.getElementById('run-backtest-btn'),
        runBtnContainer: document.getElementById('run-button-container-id'),
        loader: document.getElementById('loader'),
        projectionButtonWrapper: document.getElementById('projections-button-wrapper-id'),
        runProjectionsBtn: document.getElementById('run-projections-btn'),
        projectionsLoader: document.getElementById('projections-loader'),
        projectionsResultsTabsContainer: document.getElementById('projections-results-tabs-container'),
        simpleTabBtn: document.getElementById('simple-tab-btn'),
        mcTabBtn: document.getElementById('mc-tab-btn'),
        simpleProjectionContent: document.getElementById('simple-projection-content'),
        mcProjectionContent: document.getElementById('mc-projection-content'),
        projectionsResultsArea: document.getElementById('projections-results-area'),
        projectionChartContainer: document.getElementById('projection-chart-container'),
        backtestDebugContainer: document.getElementById('backtest-debug-container'),
        backtestDebugHeader: document.getElementById('backtest-debug-header'),
        backtestDebugContent: document.querySelector('#backtest-debug-container .debug-log-content'),
        projectionDebugContainer: document.getElementById('projection-debug-container'),
        projectionDebugHeader: document.getElementById('projection-debug-header'),
        projectionDebugContent: document.querySelector('#projection-debug-container .debug-log-content'),
        projectionGoalSelect: document.getElementById('projection-goal'),
        applyCapCheckbox: document.getElementById('apply-cap-checkbox'),
        useSyntheticHistoryCheckbox: document.getElementById('use-synthetic-history'),
        growSettings: document.getElementById('grow-settings'),
        retireSettings: document.getElementById('retire-settings'),
        withdrawalStrategySelect: document.getElementById('withdrawal-strategy'),
        fixedAmountSetting: document.getElementById('fixed_amount_setting'),
        percentageSetting: document.getElementById('percentage_setting'),
        setupCard: document.getElementById('setup-card'),
        portfolioConfigCard: document.getElementById('portfolio-config-card')
    };

    // --- GLOBAL STATE ---
    let historicalResults = [], isResultsStale = false;
    let backtestChartInstance = null, projectionChartInstance = null;
    let portfolioCount = 0;
    let primaryBenchmarkTicker = 'SPY', globalConfig = {};

    // --- INITIALIZATION ---
    function initialize() {
        setDynamicDefaults();
        setupEventListeners();
        addPortfolio("Dividend Focus", [{symbol: 'SCHD', alloc: 35}, {symbol: 'VIG', alloc: 25}, {symbol: 'VTI', alloc: 40}]);
        addPortfolio("Growth Focus", [{symbol: 'QQQ', alloc: 60}, {symbol: 'VUG', alloc: 40}]);
        addPortfolio("Balanced Core", [{symbol: 'VOO', alloc: 60}, {symbol: 'BND', alloc: 40}]);
        toggleEmptyState();
    }
    
    function setDynamicDefaults() {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        document.getElementById('end-date').value = `${yyyy}-${mm}-${dd}`;
    }

    function setupEventListeners() {
        document.addEventListener('mouseover', handleTooltip);
        document.addEventListener('mouseout', handleTooltip);
        ui.addPortfolioBtn.addEventListener('click', () => addPortfolio());
        ui.runBtn.addEventListener('click', runBacktest);
        ui.runProjectionsBtn.addEventListener('click', runProjections);
        ui.simpleTabBtn.addEventListener('click', () => switchProjectionTab('simple'));
        ui.mcTabBtn.addEventListener('click', () => switchProjectionTab('mc'));
        ui.resultsViewToggle.addEventListener('change', () => {
            ui.resultsArea.classList.toggle('basic-view');
            if (backtestChartInstance) {
                setTimeout(() => backtestChartInstance.resize(), 0);
            }
        });
        ui.backtestDebugHeader.addEventListener('click', () => ui.backtestDebugContainer.classList.toggle('collapsed'));
        ui.projectionDebugHeader.addEventListener('click', () => ui.projectionDebugContainer.classList.toggle('collapsed'));
        
        ui.setupCard.addEventListener('input', markResultsAsStale);
        ui.portfolioConfigCard.addEventListener('input', markResultsAsStale);

        ui.projectionGoalSelect.addEventListener('change', () => {
            const isRetire = ui.projectionGoalSelect.value === 'retire';
            ui.growSettings.classList.toggle('hidden', isRetire);
            ui.retireSettings.classList.toggle('hidden', !isRetire);
            if(isRetire) { ui.withdrawalStrategySelect.dispatchEvent(new Event('change')); }
        });
        ui.withdrawalStrategySelect.addEventListener('change', () => {
            const strategy = ui.withdrawalStrategySelect.value;
            ui.fixedAmountSetting.classList.toggle('hidden', strategy !== 'fixed_amount');
            ui.percentageSetting.classList.toggle('hidden', strategy !== 'percentage');
        });
        ui.projectionGoalSelect.dispatchEvent(new Event('change'));
    }

    // --- UI STATE MANAGEMENT ---
    function handleTooltip(e) {
        const target = e.target.closest('.help-icon, .projection-tab');
        if (e.type === 'mouseover' && target) {
            const tooltipText = target.dataset.tooltip; if (!tooltipText) return;
            ui.masterTooltip.textContent = tooltipText;
            const iconRect = target.getBoundingClientRect();
            let top = iconRect.top - ui.masterTooltip.offsetHeight - 8;
            let left = iconRect.left + (iconRect.width / 2) - (ui.masterTooltip.offsetWidth / 2);
            if (top < 0) { top = iconRect.bottom + 8; }
            if (left < 10) left = 10;
            if (left + ui.masterTooltip.offsetWidth > window.innerWidth - 10) { left = window.innerWidth - ui.masterTooltip.offsetWidth - 10; }
            ui.masterTooltip.style.left = `${left}px`; ui.masterTooltip.style.top = `${top}px`;
            ui.masterTooltip.style.visibility = 'visible'; ui.masterTooltip.style.opacity = '1';
        } else if (e.type === 'mouseout' && target) {
            ui.masterTooltip.style.visibility = 'hidden'; ui.masterTooltip.style.opacity = '0';
        }
    }

    function toggleEmptyState() {
        const hasPortfolios = ui.portfoliosContainer.querySelector('.portfolio-card');
        ui.portfoliosEmptyState.classList.toggle('hidden', !!hasPortfolios);
        ui.portfoliosContainer.classList.toggle('hidden', !hasPortfolios);
    }
    
    function markResultsAsStale() {
        if (!isResultsStale && !ui.resultsArea.classList.contains('hidden')) {
            isResultsStale = true;
            ui.runBtn.textContent = 'Run Backtest';
            const overlay = document.createElement('div');
            overlay.className = 'results-stale-overlay';
            const message = document.createElement('p');
            message.textContent = 'Settings have changed.';
            const button = document.createElement('button');
            button.className = 'add-btn';
            button.textContent = 'Re-run Backtest';
            button.style.marginTop = '1rem';
            button.onclick = () => {
                ui.runBtnContainer.scrollIntoView({ behavior: 'smooth' });
                ui.runBtn.style.transform = 'scale(1.1)';
                setTimeout(() => ui.runBtn.style.transform = 'scale(1)', 200);
            };
            overlay.append(message, button);
            ui.resultsArea.appendChild(overlay);
        }
    }
    
    function switchProjectionTab(tabName) {
        const isSimple = tabName === 'simple';
        ui.simpleTabBtn.classList.toggle('active', isSimple);
        ui.mcTabBtn.classList.toggle('active', !isSimple);
        ui.simpleProjectionContent.classList.toggle('hidden', !isSimple);
        ui.mcProjectionContent.classList.toggle('hidden', isSimple);
    }

    // --- PORTFOLIO BUILDER & PARSING ---
    function addPortfolio(name = '', tickers = []) {
        portfolioCount++;
        const card = document.createElement('div'); card.className = 'portfolio-card';
        const header = document.createElement('div'); header.className = 'portfolio-header';
        const nameInput = document.createElement('input');
        nameInput.type = 'text'; nameInput.value = name || `Portfolio ${portfolioCount}`;
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-portfolio-btn'; removeBtn.textContent = '×';
        removeBtn.setAttribute('aria-label', 'Remove Portfolio');
        removeBtn.addEventListener('click', () => { card.remove(); toggleEmptyState(); markResultsAsStale(); });
        header.append(nameInput, removeBtn);
        const tickersList = document.createElement('div'); tickersList.className = 'tickers-list';
        const addTickerBtn = document.createElement('button');
        addTickerBtn.className = 'add-ticker-btn add-btn'; addTickerBtn.textContent = '+ Add Ticker';
        addTickerBtn.addEventListener('click', () => addTicker(card));
        card.append(header, tickersList, addTickerBtn);
        ui.portfoliosContainer.appendChild(card);
        toggleEmptyState();
        if (tickers.length > 0) { tickers.forEach(t => addTicker(card, t.symbol, t.alloc)); } 
        else { addTicker(card); }
    }

    function addTicker(portfolioCard, ticker = '', allocation = '') {
        const tickersList = portfolioCard.querySelector('.tickers-list');
        const row = document.createElement('div'); row.className = 'ticker-input-row';
        const tickerInput = document.createElement('input');
        tickerInput.type = 'text'; tickerInput.placeholder = 'Ticker'; tickerInput.value = ticker; tickerInput.style.width = '50%';
        const allocInput = document.createElement('input');
        allocInput.type = 'number'; allocInput.placeholder = '%'; allocInput.value = allocation; allocInput.min = "0"; allocInput.style.width = "35%";
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-ticker-btn'; removeBtn.textContent = '×';
        removeBtn.setAttribute('aria-label', 'Remove Ticker');
        removeBtn.addEventListener('click', () => { row.remove(); markResultsAsStale(); });
        row.append(tickerInput, allocInput, removeBtn);
        tickersList.appendChild(row);
    }

    function parsePortfolios() {
        const portfolios = [];
        document.querySelectorAll('.portfolio-card').forEach((card, i) => {
            const tickers = []; let totalAllocation = 0;
            const portfolioName = card.querySelector('input[type="text"]').value;
            card.querySelectorAll('.ticker-input-row').forEach(row => {
                const ticker = row.querySelector('input[type="text"]').value.trim().toUpperCase();
                const allocation = parseFloat(row.querySelector('input[type="number"]').value);
                if (ticker && allocation > 0) { tickers.push({ symbol: ticker, allocation }); totalAllocation += allocation; }
            });
            if (tickers.length > 0 && Math.abs(totalAllocation - 100) > 0.1) { throw new Error(`Allocations in "${portfolioName}" must sum to 100%. Current: ${totalAllocation.toFixed(1)}%.`); }
            if (tickers.length > 0) { portfolios.push({ id: `p${i+1}`, name: portfolioName, tickers }); }
        });
        return portfolios;
    }
    
    // --- DATA FETCHING & SYNTHETIC HISTORY ---
    const proxies = {
        price: ["https://corsproxy.io/?", "https://api.allorigins.win/raw?url="],
        profile: ["https://api.allorigins.win/raw?url=", "https://corsproxy.io/?"]
    };
    
    async function fetchAllWithRetries(requests, proxyOrder, requestType, logContainer) {
        let results = {};
        let requestsToProcess = requests;

        for (let i = 0; i < proxyOrder.length; i++) {
            const proxyUrl = proxyOrder[i];
            const proxyName = new URL(proxyUrl).hostname;
            let requestsThisAttempt = requestsToProcess;

            for (let attempt = 1; attempt <= 2; attempt++) {
                if (requestsThisAttempt.length === 0) break;
                logToPage(`[SYSTEM] ${requestType} data: Attempt ${attempt}/2 for ${requestsThisAttempt.length} requests via proxy: ${proxyName}...`, false, logContainer);
                
                const promises = requestsThisAttempt.map(req => req.fetchFn(proxyUrl, ...req.args)
                    .then(value => ({key: req.key, value}))
                    .catch(reason => Promise.reject({key: req.key, reason}))
                );
                const settled = await Promise.allSettled(promises);
                
                const stillFailing = [];
                settled.forEach(result => {
                    if (result.status === 'fulfilled') {
                        results[result.value.key] = result.value.value;
                    } else {
                        const failedReq = requestsThisAttempt.find(req => req.key === result.reason.key);
                        if (failedReq) stillFailing.push(failedReq);
                    }
                });
                requestsThisAttempt = stillFailing;
                if (requestsThisAttempt.length > 0 && attempt < 2) await new Promise(resolve => setTimeout(resolve, 500));
            }
            requestsToProcess = requestsToProcess.filter(req => !results[req.key]);
            if (requestsToProcess.length === 0) break;
        }
        
        if (requestsToProcess.length > 0) {
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
        
        if (data.chart.error) throw new Error(`${ticker}: ${data.chart.error.description || 'Unknown error'}`);
        if (!data.chart.result || data.chart.result.length === 0 || !data.chart.result[0].timestamp) { throw new Error(`${ticker}: No price data returned`); }

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
        const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=fundProfile,assetProfile`;
        const res = await fetch(proxy + encodeURIComponent(url));
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data = await res.json();
        const fundProfile = data?.quoteSummary?.result?.[0]?.fundProfile;
        const assetProfile = data?.quoteSummary?.result?.[0]?.assetProfile;
        const expenseRatio = fundProfile?.annualReportExpenseRatio?.raw ?? null;
        const turnover = fundProfile?.annualHoldingsTurnover?.raw ?? null;
        let assetClass = 'stocks';
        const category = (fundProfile?.category || assetProfile?.sector || '').toLowerCase();
        if (category.includes('bond') || category.includes('fixed income')) { assetClass = 'bonds'; }
        return { expenseRatio, turnover, assetClass };
    }

    function generateSyntheticHistory(assetData, benchmarkData, startDate) {
        const assetReturns = {}, benchmarkReturns = {};
        const overlapDates = Object.keys(assetData.prices).filter(date => benchmarkData.prices[date] && date >= assetData.inceptionDate).sort();
        if (overlapDates.length < 252) return { ...assetData, wasSynthesized: false };

        for (let i = 1; i < overlapDates.length; i++) {
            const date = overlapDates[i], prevDate = overlapDates[i-1];
            assetReturns[date] = (assetData.prices[date] / assetData.prices[prevDate]) - 1;
            benchmarkReturns[date] = (benchmarkData.prices[date] / benchmarkData.prices[prevDate]) - 1;
        }
        
        const assetReturnValues = Object.values(assetReturns);
        const benchmarkReturnValues = Object.values(benchmarkReturns);
        const avgAssetReturn = assetReturnValues.reduce((a, b) => a + b, 0) / assetReturnValues.length;
        const avgBenchmarkReturn = benchmarkReturnValues.reduce((a, b) => a + b, 0) / benchmarkReturnValues.length;
        const cov = assetReturnValues.reduce((sum, r_p, i) => sum + (r_p - avgAssetReturn) * (benchmarkReturnValues[i] - avgBenchmarkReturn), 0) / assetReturnValues.length;
        const benchmarkVariance = benchmarkReturnValues.reduce((sum, r_m) => sum + Math.pow(r_m - avgBenchmarkReturn, 2), 0) / benchmarkReturnValues.length;
        const beta = cov / benchmarkVariance;
        const alpha = (avgAssetReturn - avgBenchmarkReturn * beta) * 252;

        const syntheticPeriod = Object.keys(benchmarkData.prices).filter(d => d >= startDate && d < assetData.inceptionDate).sort();
        if (syntheticPeriod.length === 0) return { ...assetData, wasSynthesized: false };

        let lastPrice = assetData.prices[overlapDates[0]];
        const syntheticPrices = {};
        for (let i = syntheticPeriod.length - 1; i >= 0; i--) {
            const date = syntheticPeriod[i];
            const nextDate = syntheticPeriod[i+1] || overlapDates[0];
            const benchmarkReturn = (benchmarkData.prices[nextDate] / benchmarkData.prices[date]) - 1;
            const syntheticReturn = (benchmarkReturn * beta) + (alpha / 252);
            lastPrice = lastPrice / (1 + syntheticReturn);
            syntheticPrices[date] = lastPrice;
        }
        return { ...assetData, prices: { ...syntheticPrices, ...assetData.prices }, wasSynthesized: true };
    }

    // --- FINANCIAL ENGINE ---
    function getAssetClass(symbol, allProfiles) { return allProfiles[`${symbol}_profile`]?.assetClass || 'stocks'; }

    function calculatePortfolioPerformance(portfolio, allData, config, benchmarkData, allProfiles) {
        const { initialInvestment, startDate, endDate, contributionAmount, contributionFrequency, rebalanceFrequency, reinvestDividends, riskFreeRate, dividendTaxRate, gainsTaxRate } = config;
        const tradingDays = Object.keys(allData[Object.keys(allData)[0]].prices).sort().filter(d => d >= startDate && d <= endDate);
        if (tradingDays.length === 0) return null;
        
        const holdings = {};
        for (const { symbol, allocation } of portfolio.tickers) {
            const startingPrice = allData[symbol].prices[tradingDays[0]];
            if (!startingPrice || startingPrice <= 0) {
                logToPage(`Warning: Could not find valid starting price for ${symbol} on ${tradingDays[0]}. It will be excluded.`, true, ui.backtestDebugContent);
                continue;
            };
            const valueStart = initialInvestment * (allocation / 100);
            holdings[symbol] = { shares: valueStart / startingPrice, valueStart: valueStart, costBasisPerShare: startingPrice };
        }
        holdings.CASH = { shares: 0, costBasisPerShare: 1 };
        
        let totalContributions = initialInvestment, cumulativeDividends = 0, cumulativeTaxes = 0;
        let dailyValues = [{ date: tradingDays[0], value: initialInvestment, dividends: 0 }];
        let nextContributionDate = new Date(new Date(tradingDays[0]).getTime() + 86400000);
        let nextRebalanceDate = new Date(new Date(tradingDays[0]).getTime() + 86400000);

        for (let i = 1; i < tradingDays.length; i++) {
            const day = tradingDays[i]; const prevDay = tradingDays[i-1]; const currentDate = new Date(day + 'T00:00:00Z');
            let dailyDividends = 0;

            for (const symbol in holdings) {
                if(symbol === 'CASH' || !allData[symbol]?.dividends[day]) continue;
                const price = allData[symbol].prices[day] || allData[symbol].prices[prevDay];
                const grossDivAmount = holdings[symbol].shares * allData[symbol].dividends[day];
                dailyDividends += grossDivAmount; cumulativeDividends += grossDivAmount;
                const netDivAmount = grossDivAmount * (1 - dividendTaxRate);
                if (reinvestDividends) {
                    const sharesBought = netDivAmount / price;
                    const oldTotalValue = holdings[symbol].shares * holdings[symbol].costBasisPerShare;
                    holdings[symbol].costBasisPerShare = (oldTotalValue + netDivAmount) / (holdings[symbol].shares + sharesBought);
                    holdings[symbol].shares += sharesBought;
                } else { holdings.CASH.shares += netDivAmount; }
            }

            if (contributionFrequency !== 'none' && currentDate >= nextContributionDate) {
                if (contributionAmount > 0) {
                    totalContributions += contributionAmount;
                    holdings.CASH.shares += contributionAmount;
                }
                if (contributionFrequency === 'weekly') nextContributionDate.setUTCDate(nextContributionDate.getUTCDate() + 7);
                else if (contributionFrequency === 'monthly') nextContributionDate.setUTCMonth(nextContributionDate.getUTCMonth() + 1);
                else if (contributionFrequency === 'quarterly') nextContributionDate.setUTCMonth(nextContributionDate.getUTCMonth() + 3);
                else if (contributionFrequency === 'annually') nextContributionDate.setUTCFullYear(nextContributionDate.getUTCFullYear() + 1);
            }
            
            let portfolioValue = holdings.CASH.shares;
            for (const symbol in holdings) { if(symbol !== 'CASH') portfolioValue += holdings[symbol].shares * (allData[symbol].prices[day] || allData[symbol].prices[prevDay]); }

            if (rebalanceFrequency !== 'never' && currentDate >= nextRebalanceDate) {
                let cashFromSales = 0;
                for (const { symbol } of portfolio.tickers) {
                    if(!holdings[symbol]) continue;
                    const price = allData[symbol].prices[day] || allData[symbol].prices[prevDay];
                    const currentVal = holdings[symbol].shares * price;
                    const targetVal = portfolioValue * (portfolio.tickers.find(t=>t.symbol===symbol).allocation / 100);
                    if (currentVal > targetVal) {
                        const sharesToSell = (currentVal - targetVal) / price;
                        const gain = (price - holdings[symbol].costBasisPerShare) * sharesToSell;
                        if (gain > 0) {
                            const tax = gain * gainsTaxRate;
                            cumulativeTaxes += tax;
                            holdings.CASH.shares -= tax;
                        }
                        holdings[symbol].shares -= sharesToSell;
                        cashFromSales += sharesToSell * price;
                    }
                }
                holdings.CASH.shares += cashFromSales;
                for (const { symbol, allocation } of portfolio.tickers) {
                    if(!holdings[symbol]) continue;
                    const price = allData[symbol].prices[day] || allData[symbol].prices[prevDay];
                    const currentVal = holdings[symbol].shares * price;
                    const targetVal = portfolioValue * (allocation / 100);
                     if (currentVal < targetVal) {
                        const cashToInvest = Math.min(targetVal - currentVal, holdings.CASH.shares);
                        const sharesToBuy = cashToInvest / price;
                        const oldTotalValue = holdings[symbol].shares * holdings[symbol].costBasisPerShare;
                        holdings[symbol].costBasisPerShare = (oldTotalValue + cashToInvest) / (holdings[symbol].shares + sharesToBuy);
                        holdings[symbol].shares += sharesToBuy;
                        holdings.CASH.shares -= cashToInvest;
                    }
                }
                if (rebalanceFrequency === 'quarterly') nextRebalanceDate.setUTCMonth(nextRebalanceDate.getUTCMonth() + 3);
                else if (rebalanceFrequency === 'annually') nextRebalanceDate.setUTCFullYear(nextRebalanceDate.getUTCFullYear() + 1);
            }
            
            portfolioValue = holdings.CASH.shares;
            for (const symbol in holdings) { if(symbol !== 'CASH') portfolioValue += holdings[symbol].shares * (allData[symbol].prices[day] || allData[symbol].prices[prevDay]); }
            dailyValues.push({date: day, value: portfolioValue, dividends: dailyDividends});
        }
        
        const endingBalance = dailyValues[dailyValues.length-1].value;
        const totalReturn = endingBalance - totalContributions;
        const totalReturnPercent = totalContributions > 0 ? totalReturn / totalContributions : 0;
        const years = (new Date(tradingDays[tradingDays.length-1]) - new Date(tradingDays[0])) / (365.25 * 24 * 60 * 60 * 1000);
        const annualReturn = years > 0 ? Math.pow(endingBalance / initialInvestment, 1 / years) - 1 : 0;
        
        let stockValue = 0, bondValue = 0;
        const breakdown = portfolio.tickers.map(({ symbol, allocation }) => {
            const priceEnd = allData[symbol]?.prices[tradingDays[tradingDays.length-1]] || 0;
            const valueEnd = holdings[symbol].shares * priceEnd;
            if (getAssetClass(symbol, allProfiles) === 'stocks') stockValue += valueEnd; else bondValue += valueEnd;
            return { symbol, allocation, valueStart: holdings[symbol].valueStart, valueEnd, drift: (valueEnd / endingBalance) * 100 - allocation, wasSynthesized: allData[symbol].wasSynthesized };
        });

        const totalValue = stockValue + bondValue + holdings.CASH.shares;
        const stockPercent = totalValue > 0 ? stockValue / totalValue : 0;
        const bondPercent = totalValue > 0 ? bondValue / totalValue : 0;
        const cashPercent = totalValue > 0 ? holdings.CASH.shares / totalValue : 0;
        
        const dailyReturns = dailyValues.map((v, i) => i === 0 ? 0 : (v.value / dailyValues[i-1].value) - 1).slice(1);
        const meanReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
        const stdDev = Math.sqrt(dailyReturns.map(r => Math.pow(r - meanReturn, 2)).reduce((a, b) => a + b, 0) / dailyReturns.length);
        const volatility = stdDev * Math.sqrt(252);
        
        const dailyRfr = Math.pow(1 + riskFreeRate, 1/252) - 1;
        const downsideReturns = dailyReturns.filter(r => r < dailyRfr);
        const downsideVariance = downsideReturns.map(r => Math.pow(r - dailyRfr, 2)).reduce((a, b) => a + b, 0) / (dailyReturns.length || 1);
        const downsideStdDev = Math.sqrt(downsideVariance);
        const annualizedDownsideVol = downsideStdDev * Math.sqrt(252);
        const sortinoRatio = (annualReturn - riskFreeRate) / annualizedDownsideVol;
        
        let peakValue = -Infinity, maxDrawdown = 0, dropNow = 0;
        dailyValues.forEach(dv => { peakValue = Math.max(peakValue, dv.value); const drawdown = (dv.value - peakValue) / peakValue; maxDrawdown = Math.min(maxDrawdown, drawdown); });
        dropNow = (endingBalance - peakValue) / peakValue;
        
        return {
            portfolio, dailyValues, breakdown, startingBalance: initialInvestment, contributions: totalContributions - initialInvestment, totalInvested: totalContributions,
            endingBalance, totalReturn, totalReturnPercent, annualReturn, cumulativeDividends, cumulativeTaxes,
            stockPercent, bondPercent, cashPercent, volatility, downsideVol: annualizedDownsideVol,
            sharpeRatio: (annualReturn - riskFreeRate) / volatility, sortinoRatio, maxDrawdown, dropNow
        };
    }
    
    // --- PROJECTION ENGINES ---
    function generateRandomReturn(mean, stdDev) { 
        let u1=0, u2=0; 
        while(u1===0) u1=Math.random(); 
        while(u2===0) u2=Math.random(); 
        const z0 = Math.sqrt(-2.0*Math.log(u1))*Math.cos(2.0*Math.PI*u2); 
        return z0 * stdDev + mean; 
    }

    function calculateSimpleProjection(portfolioResult, params) {
        const { accumulationYears, decumulationYears, initialContribution, contributionIncrease, withdrawalStrategy, withdrawalRate, withdrawalAmount, startValue } = params;
        const rateOfReturn = portfolioResult.annualReturn; // Uncapped
        let value = startValue;
        const path = [];
        let annualContribution = initialContribution;

        for (let y = 0; y < accumulationYears; y++) {
            const startOfYearValue = value;
            value += annualContribution;
            value *= (1 + rateOfReturn);
            path.push({ year: y + 1, startBalance: startOfYearValue, endBalance: value });
            annualContribution *= (1 + contributionIncrease);
        }
        for (let y = 0; y < decumulationYears; y++) {
             const startOfYearValue = value;
             let currentWithdrawal = 0;
             if (withdrawalStrategy === 'fixed_amount') { currentWithdrawal = withdrawalAmount; }
             else if (withdrawalStrategy === 'percentage') { currentWithdrawal = startOfYearValue * withdrawalRate; }
             value -= currentWithdrawal;
             if (value > 0) value *= (1 + rateOfReturn);
             if (!isFinite(value) || value < 0) { value = 0; }
             path.push({ year: accumulationYears + y + 1, startBalance: startOfYearValue, endBalance: value });
        }
        return { path };
    }

    function calculateMonteCarloProjection(portfolioResult, params) {
        const { simulations, accumulationYears, decumulationYears, initialContribution, contributionIncrease, withdrawalStrategy, withdrawalRate, withdrawalAmount, startValue, useCap } = params;
        
        const hist_cagr = portfolioResult.annualReturn;
        const hist_volatility = portfolioResult.volatility;
        const hist_dividend_yield = (portfolioResult.incomeLast12Mo / portfolioResult.endingBalance) || 0;
        
        const MAX_PROJECTION_CAGR = 0.12;
        const drift = useCap ? Math.min(hist_cagr, MAX_PROJECTION_CAGR) : hist_cagr;
        
        const yearPaths = [];
        let failures = 0;

        for (let i = 0; i < simulations; i++) {
            let value = startValue;
            const path = [];
            
            let annualContribution = initialContribution;
            for (let y = 0; y < accumulationYears; y++) {
                const startOfYearValue = value;
                value += annualContribution;
                const randomReturn = generateRandomReturn(drift, hist_volatility);
                value *= (1 + randomReturn);

                if (!isFinite(value) || value < 0) { value = 0; break; }
                
                path.push({ year: y + 1, startBalance: startOfYearValue, contributions: annualContribution, dividends: startOfYearValue * hist_dividend_yield, withdrawals: 0, salesNeeded: 0, endBalance: value });
                annualContribution *= (1 + contributionIncrease);
            }

            if (params.goal === 'retire') {
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
                    if (value > 0) {
                        const randomReturn = generateRandomReturn(drift, hist_volatility);
                        value *= (1 + randomReturn);
                    }
                    if (!isFinite(value) || value < 0) { value = 0; }
                    
                    path.push({ year: accumulationYears + y + 1, startBalance: startOfYearValue, contributions: 0, dividends: dividendsGenerated, withdrawals: currentWithdrawal, salesNeeded: Math.max(0, currentWithdrawal - dividendsGenerated), endBalance: value });
                }
            }
            
            if (params.goal === 'retire' && path.length > 0 && path[path.length - 1].endBalance <= 0) { failures++; }
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
            const balanceAtRetirement = path[accumulationYears - 1]?.endBalance || (accumulationYears === 0 ? startValue : (path.length > 0 ? path[path.length - 1].endBalance : 0));
            const dividendsAtRetirement = (path[accumulationYears]?.startBalance || 0) * hist_dividend_yield;
            
            return {
                path, endingBalance: path[path.length - 1].endBalance,
                balanceAtRetirement, dividendsAtRetirement, dividendYieldAtRetirement: hist_dividend_yield
            };
        };

        return {
            good: calculatePathMetrics(getPercentilePath(0.9)),
            median: calculatePathMetrics(getPercentilePath(0.5)),
            poor: calculatePathMetrics(getPercentilePath(0.1)),
            successRate: 1 - (failures / simulations),
            wasCapped: useCap && hist_cagr > MAX_PROJECTION_CAGR,
            originalCagr: hist_cagr
        };
    }

    // --- UI RENDERING ---
    function renderResults(results, synthesizedTickers) { /* Full render logic */ }
    function renderBacktestChart(results) { /* Full chart logic */ }
    function updateCostMetricsInTable(results, allProfiles) { /* Full logic */ }
    function renderAllProjections(projectionResults, simpleResults, params) { /* Full logic */ }
    function renderSimpleProjectionResults(simpleResults, params) { /* Full logic */ }
    function renderMonteCarloProjectionResults(projectionResults, params) { /* Full logic */ }
    function renderProjectionChart(historicalData, projectionData) { /* Full logic */ }

    // --- MAIN CONTROL FLOW ---
    async function runBacktest() {
        ui.runBtn.disabled = true; ui.loader.style.display = 'block'; ui.errorContainer.textContent = '';
        ui.infoContainer.style.display = 'none'; ui.resultsArea.classList.add('hidden'); ui.projectionsArea.classList.add('hidden');
        ui.backtestDebugContainer.classList.remove('hidden', 'collapsed');
        ui.backtestDebugContent.innerHTML = '';
        logToPage('Backtest initiated...', false, ui.backtestDebugContent);
        
        try {
            globalConfig = {
                initialInvestment: parseFloat(document.getElementById('initial-investment').value), startDate: document.getElementById('start-date').value, endDate: document.getElementById('end-date').value,
                contributionAmount: parseFloat(document.getElementById('contribution-amount').value), contributionFrequency: document.getElementById('contribution-frequency').value,
                rebalanceFrequency: document.getElementById('rebalance-frequency').value, reinvestDividends: document.getElementById('reinvest-dividends').value === 'true',
                riskFreeRate: parseFloat(document.getElementById('risk-free-rate').value) / 100, 
                dividendTaxRate: parseFloat(document.getElementById('dividend-tax-rate').value) / 100, 
                gainsTaxRate: parseFloat(document.getElementById('gains-tax-rate').value) / 100,
            };
            const useSynthetic = ui.useSyntheticHistoryCheckbox.checked;
            let userPortfolios = parsePortfolios();
            const userBenchmarks = [...new Set([document.getElementById('benchmark1').value.trim().toUpperCase(), document.getElementById('benchmark2').value.trim().toUpperCase()].filter(b => b))];
            if (userPortfolios.length === 0 && userBenchmarks.length === 0) { throw new Error("Please configure at least one portfolio or benchmark."); }
            
            let allUniqueTickers = Array.from(new Set([...userBenchmarks, ...userPortfolios.flatMap(p => p.tickers.map(t => t.symbol))]));
            primaryBenchmarkTicker = document.getElementById('benchmark1').value.trim().toUpperCase();
            if (useSynthetic && primaryBenchmarkTicker && !allUniqueTickers.includes(primaryBenchmarkTicker)) {
                allUniqueTickers.push(primaryBenchmarkTicker);
            }

            const priceRequests = allUniqueTickers.map(t => ({ key: t, fetchFn: fetchTickerData, args: [t, globalConfig.startDate, globalConfig.endDate] }));
            const profileRequests = allUniqueTickers.map(t => ({ key: `${t}_profile`, fetchFn: fetchTickerProfile, args: [t] }));
            
            const [priceResults, profileResults] = await Promise.all([
                fetchAllWithRetries(priceRequests, proxies.price, "Price", ui.backtestDebugContent),
                fetchAllWithRetries(profileRequests, proxies.profile, "Profile", ui.backtestDebugContent)
            ]);
            
            let allData = {}, synthesizedTickers = new Set();
            if (useSynthetic) {
                const benchmarkData = priceResults[primaryBenchmarkTicker];
                if (!benchmarkData) throw new Error(`Synthetic history requires a valid Benchmark 1 proxy (${primaryBenchmarkTicker}). Data could not be fetched.`);
                
                for (const ticker of allUniqueTickers) {
                    if (priceResults[ticker] && priceResults[ticker].inceptionDate > globalConfig.startDate) {
                        allData[ticker] = generateSyntheticHistory(priceResults[ticker], benchmarkData, globalConfig.startDate);
                        if (allData[ticker].wasSynthesized) synthesizedTickers.add(ticker);
                    } else if (priceResults[ticker]) {
                        allData[ticker] = priceResults[ticker];
                    }
                }
            } else {
                for (const ticker in priceResults) { if(priceResults[ticker]) allData[ticker] = priceResults[ticker]; }
            }

            let effectiveStartDate = globalConfig.startDate;
            if(!useSynthetic) {
                let latestInceptionDate = '1900-01-01';
                Object.values(allData).forEach(d => { if (d.inceptionDate > latestInceptionDate) latestInceptionDate = d.inceptionDate; });
                if (latestInceptionDate > effectiveStartDate) effectiveStartDate = latestInceptionDate;
            }

            const infoMessages = [];
            if(effectiveStartDate !== globalConfig.startDate) infoMessages.push(`Start date adjusted to ${effectiveStartDate}.`);
            if(synthesizedTickers.size > 0) infoMessages.push(`Synthetic history was generated for: ${[...synthesizedTickers].join(', ')}.`);
            if(infoMessages.length > 0) {
                ui.infoContainer.innerHTML = `<ul>${infoMessages.map(m => `<li>${m}</li>`).join('')}</ul>`;
                ui.infoContainer.style.display = 'block';
            }

            const configForCalc = { ...globalConfig, startDate: effectiveStartDate };
            const portfoliosForCalc = userPortfolios.filter(p => p.tickers.every(t => allData[t.symbol]));
            const benchmarksForCalc = userBenchmarks.filter(b => allData[b]);
            
            let benchmarkResults = {};
            if(primaryBenchmarkTicker && allData[primaryBenchmarkTicker]) {
                benchmarkResults[primaryBenchmarkTicker] = calculatePortfolioPerformance({name: primaryBenchmarkTicker, tickers: [{symbol: primaryBenchmarkTicker, allocation: 100}]}, allData, configForCalc, null, profileResults);
            }

            const portfolioResults = portfoliosForCalc.map(p => calculatePortfolioPerformance(p, allData, configForCalc, benchmarkResults[primaryBenchmarkTicker], profileResults)).filter(Boolean);
            
            benchmarksForCalc.forEach(b => {
                if(!benchmarkResults[b] && allData[b]) {
                    benchmarkResults[b] = calculatePortfolioPerformance({name: b, tickers: [{symbol: b, allocation: 100}]}, allData, configForCalc, benchmarkResults[primaryBenchmarkTicker], profileResults);
                }
            });

            historicalResults = [...portfolioResults, ...Object.values(benchmarkResults).filter(Boolean)];
            if (historicalResults.length === 0) { throw new Error("No portfolios or benchmarks could be calculated."); }

            renderResults(historicalResults, synthesizedTickers);
            renderBacktestChart(historicalResults);
            updateCostMetricsInTable(historicalResults, profileResults);

            isResultsStale = false;
            const staleOverlay = ui.resultsArea.querySelector('.results-stale-overlay');
            if (staleOverlay) {
                staleOverlay.remove();
            }
            ui.runBtn.textContent = 'Re-run Backtest';
            ui.projectionsArea.classList.remove('hidden');

        } catch (error) {
            ui.errorContainer.textContent = `Error: ${error.message}`;
            logToPage(`FATAL ERROR: ${error.message}`, true, ui.backtestDebugContent);
            console.error(error);
        } finally {
            ui.runBtn.disabled = false;
            ui.loader.style.display = 'none';
        }
    }

    function runProjections() {
        ui.runProjectionsBtn.disabled = true;
        ui.projectionsLoader.style.display = 'block';
        ui.projectionButtonWrapper.classList.add('loading');
        ui.projectionDebugContainer.classList.remove('hidden', 'collapsed');
        ui.projectionDebugContent.innerHTML = '';
        logToPage('Projections initiated...', false, ui.projectionDebugContent);
        
        try {
            if (historicalResults.length === 0) { throw new Error('A valid backtest must be run first.'); }
            const projectionStartValue = parseFloat(document.getElementById('projection-start-value').value);
            if (isNaN(projectionStartValue) || projectionStartValue < 0) { throw new Error("Invalid Projection Starting Value."); }
            
            let params = { 
                goal: ui.projectionGoalSelect.value,
                simulations: parseInt(document.getElementById('sim-quality').value),
                startValue: projectionStartValue,
                useCap: ui.applyCapCheckbox.checked
            };
            const userPortfolioNames = parsePortfolios().map(p => p.name);
            const portfoliosToProject = historicalResults.filter(r => userPortfolioNames.includes(r.portfolio.name));
            if (portfoliosToProject.length === 0) { throw new Error("No user portfolios available to project."); }
            const freqMap = {'weekly': 52, 'monthly': 12, 'quarterly': 4, 'annually': 1, 'none': 0};
            const annualContribution = globalConfig.contributionAmount * (freqMap[globalConfig.contributionFrequency] || 0);
            if (params.goal === 'grow') {
                Object.assign(params, { accumulationYears: parseInt(document.getElementById('grow-projection-period').value), decumulationYears: 0, initialContribution: annualContribution, contributionIncrease: parseFloat(document.getElementById('grow-contribution-increase').value) / 100 });
            } else {
                const currentAge = parseInt(document.getElementById('current-age').value);
                const retirementAge = parseInt(document.getElementById('retirement-age').value);
                Object.assign(params, { accumulationYears: Math.max(0, retirementAge - currentAge), decumulationYears: Math.max(0, parseInt(document.getElementById('final-age').value) - retirementAge), initialContribution: annualContribution, contributionIncrease: parseFloat(document.getElementById('retire-contribution-increase').value) / 100, withdrawalStrategy: ui.withdrawalStrategySelect.value });
                if (params.withdrawalStrategy === 'fixed_amount') { params.withdrawalAmount = parseFloat(document.getElementById('annual-withdrawal-amount').value); }
                else if (params.withdrawalStrategy === 'percentage') { params.withdrawalRate = parseFloat(document.getElementById('annual-withdrawal-rate').value) / 100; }
            }
            
            const monteCarloResults = portfoliosToProject.map(p => ({ name: p.portfolio.name, monteCarlo: calculateMonteCarloProjection(p, params) }));
            const simpleResults = portfoliosToProject.map(p => ({ name: p.portfolio.name, results: calculateSimpleProjection(p, params) }));
            
            const firstResult = monteCarloResults[0];
            if(firstResult) {
                ui.projectionWarning.classList.remove('hidden', 'critical');
                if (!params.useCap) {
                    ui.projectionWarning.textContent = `⚠️ Warning: The realism cap is disabled. This projection is a purely theoretical extrapolation of a high historical return over a long period and may result in unrealistic figures.`;
                    ui.projectionWarning.classList.add('critical');
                } else if (firstResult.monteCarlo.wasCapped) {
                    ui.projectionWarning.textContent = `For realism, the historical return of ${formatNumber(firstResult.monteCarlo.originalCagr, 'percent')} was capped at 12.0% for this projection. Past performance is not a guarantee of future results.`;
                } else {
                    ui.projectionWarning.textContent = `This projection is based on the backtest's historical return of ${formatNumber(firstResult.monteCarlo.originalCagr, 'percent')}. Past performance is not a guarantee of future results.`;
                }
            }
            renderAllProjections(monteCarloResults, simpleResults, params);
        } catch (error) {
            ui.errorContainer.textContent = `Error: ${error.message}`;
            logToPage(`FATAL ERROR: ${error.message}`, true, ui.projectionDebugContent);
            console.error(error);
        } finally {
            ui.runProjectionsBtn.disabled = false;
            ui.projectionsLoader.style.display = 'none';
            ui.projectionButtonWrapper.classList.remove('loading');
        }
    }
    
    // --- UTILITY ---
    function logToPage(message, isError = false, container) {
        if (!container) return;
        const p = document.createElement('p');
        p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        if (isError) { p.style.color = 'var(--error-color)'; }
        container.appendChild(p);
        container.scrollTop = container.scrollHeight;
    }

    function formatNumber(num, type, decimals = 1) {
        if (num === null || typeof num === 'undefined' || isNaN(num) || !isFinite(num)) return 'N/A';
        if (type === 'currency') return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        if (type === 'percent') return (num * 100).toFixed(decimals) + ' %';
        if (type === 'decimal') return num.toFixed(2);
        if (type === 'days') return num.toFixed(0) + ' d';
        if (type === 'months') return num.toFixed(0) + ' mo';
        return num.toLocaleString();
    }
    
    // --- INITIALIZE APPLICATION ---
    initialize();
});
