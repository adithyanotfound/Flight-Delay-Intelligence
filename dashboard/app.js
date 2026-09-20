/**
 * Flight Delay Intelligence - Production Real-Time Analytics Engine
 * Multi-Year BTS Operations Engine (2023 through September 20, 2026)
 * - Clean SVG USA Map with State Boundaries from MiraWision/usa-map-react (No Animations)
 * - Easily Scannable Root Cause Delay Drivers
 * - OpenRouter AI OCC Recommendations (gpt-4o-mini via .env)
 * - Instant BTS Data Sync through Today
 */

document.addEventListener('DOMContentLoaded', async () => {
  const loadingBar = document.getElementById('queryLoadingBar');

  // Filter controls
  const dateStartEl = document.getElementById('dateStart');
  const dateEndEl = document.getElementById('dateEnd');
  const monthSlider = document.getElementById('monthRangeSlider');
  const sliderFeedback = document.getElementById('sliderFeedback');
  const resetDatesBtn = document.getElementById('resetDatesBtn');
  const resetAllBtn = document.getElementById('resetAllFiltersBtn');
  const datePresetBtns = document.querySelectorAll('.preset-btn');

  const filterAirline = document.getElementById('filterAirline');
  const filterOrigin = document.getElementById('filterOrigin');
  const filterDest = document.getElementById('filterDest');
  const filterDay = document.getElementById('filterDay');
  const filterHour = document.getElementById('filterHour');

  // Sync Buttons
  const syncBtnHeader = document.getElementById('syncDataBtn');
  const syncBtnSidebar = document.getElementById('syncDataBtnSidebar');

  // AI OCC Recommendations
  const regenerateRecsBtn = document.getElementById('regenerateRecsBtn');
  const aiStatusBar = document.getElementById('aiStatusBar');
  const aiStatusText = document.getElementById('aiStatusText');
  const toastNotification = document.getElementById('toastNotification');

  let currentData = null;
  let debounceTimer = null;
  let usaStatePaths = null;

  // Accurate SVG coordinates for major airport hubs on 959x593 USA coordinate grid
  const AIRPORT_POSITIONS = {
    SEA: { x: 122, y: 54 },
    SFO: { x: 46, y: 232 },
    LAX: { x: 92, y: 316 },
    DEN: { x: 334, y: 258 },
    DFW: { x: 472, y: 396 },
    ORD: { x: 598, y: 198 },
    ATL: { x: 692, y: 386 },
    MIA: { x: 786, y: 536 },
    JFK: { x: 832, y: 188 },
    EWR: { x: 824, y: 198 }
  };

  /**
   * Toggle dashboard-wide skeleton loader states smoothly
   */
  function setDashboardLoading(isLoading) {
    const cards = document.querySelectorAll('.kpi-card, .chart-card');
    if (loadingBar) {
      if (isLoading) loadingBar.classList.add('active');
      else loadingBar.classList.remove('active');
    }

    cards.forEach(card => {
      if (isLoading) card.classList.add('is-loading');
      else card.classList.remove('is-loading');
    });
  }

  // Activate skeleton loader immediately on load
  setDashboardLoading(true);

  // Preload USA State Paths from MiraWision/usa-map-react
  await loadUsaStatePaths();
  await initFilterOptions();
  await triggerQuery();
  setupEventListeners();
  setupRecommendationsEngine();
  setupSyncHandler();
  setupSimulator();
  setupResizeHandler();

  /**
   * Display temporary toast notification (clean, no emoji)
   */
  function showToast(message, type = 'info', duration = 3500) {
    if (!toastNotification) return;
    toastNotification.textContent = message;
    toastNotification.className = `toast-notification show toast-${type}`;
    setTimeout(() => {
      toastNotification.classList.remove('show');
    }, duration);
  }

  /**
   * Preload accurate USA State Paths from MiraWision/usa-map-react
   */
  async function loadUsaStatePaths() {
    try {
      const res = await fetch('assets/usa-state-paths.json');
      if (res.ok) {
        usaStatePaths = await res.json();
      }
    } catch (e) {
      console.warn('Could not load usa-state-paths.json:', e);
    }
  }

  /**
   * Load airline and airport options from database
   */
  async function initFilterOptions() {
    try {
      const res = await fetch('/api/options');
      if (!res.ok) return;
      const opts = await res.json();

      if (opts.min_date && opts.max_date) {
        dateStartEl.min = opts.min_date;
        dateStartEl.max = opts.max_date;
        dateEndEl.min = opts.min_date;
        dateEndEl.max = opts.max_date;
        dateStartEl.value = opts.min_date;
        dateEndEl.value = opts.max_date;
      }

      if (opts.airlines && opts.airlines.length > 0) {
        filterAirline.innerHTML = '<option value="ALL">All Airlines</option>';
        opts.airlines.forEach(a => {
          const opt = document.createElement('option');
          opt.value = a.code;
          opt.textContent = `${a.name} (${a.code}) - ${a.count.toLocaleString()} flts`;
          filterAirline.appendChild(opt);
        });
      }

      if (opts.airports && opts.airports.length > 0) {
        filterOrigin.innerHTML = '<option value="ALL">All Airports</option>';
        filterDest.innerHTML = '<option value="ALL">All Destinations</option>';
        opts.airports.forEach(a => {
          const opt1 = document.createElement('option');
          opt1.value = a.code;
          opt1.textContent = `${a.name} (${a.code}) - ${a.count.toLocaleString()} flts`;
          filterOrigin.appendChild(opt1);

          const opt2 = document.createElement('option');
          opt2.value = a.code;
          opt2.textContent = `${a.name} (${a.code})`;
          filterDest.appendChild(opt2);
        });
      }
    } catch (e) {
      console.warn('Using local fallback options:', e);
    }
  }

  /**
   * Execute real-time query against /api/filter
   */
  async function triggerQuery() {
    setDashboardLoading(true);

    const params = new URLSearchParams({
      start_date: dateStartEl.value || '2023-01-01',
      end_date: dateEndEl.value || '2026-09-20',
      airline: filterAirline.value || 'ALL',
      origin: filterOrigin.value || 'ALL',
      dest: filterDest.value || 'ALL',
      day: filterDay.value || 'ALL',
      hour: filterHour.value || 'ALL'
    });

    try {
      const resp = await fetch(`/api/filter?${params.toString()}`);
      if (!resp.ok) throw new Error('Query error');
      currentData = await resp.json();
      renderDashboard(currentData);
    } catch (err) {
      console.error('Failed to query /api/filter:', err);
    } finally {
      setDashboardLoading(false);
    }
  }


  /**
   * Render all dashboard components
   */
  function renderDashboard(data) {
    renderKPIs(data.kpi);
    renderTrendChart(data.monthly_trend);
    renderScannableDelayDrivers(data.delay_drivers_expanded || { drivers: data.delay_drivers, summary: {} });
    renderUsaMap(data.airports);
    renderHeatmap(data.heatmap);
    renderScatterPlot(data.scatter_regression);
    renderFeatureImportance(data.model.feature_importance);
    renderModelPrediction(data.model);

    // Update Header Metadata
    const periodEl = document.getElementById('metaActivePeriod');
    if (periodEl) {
      periodEl.textContent = `Period: ${dateStartEl.value} to ${dateEndEl.value}`;
    }
    const sampleEl = document.getElementById('filteredSampleCount');
    if (sampleEl && data.kpi) {
      sampleEl.textContent = data.kpi.total_flights.toLocaleString();
    }
    const recordNote = document.getElementById('metaRecordCount');
    if (recordNote && data.kpi) {
      recordNote.textContent = `${data.kpi.total_flights.toLocaleString()} Flight Records Filtered`;
    }

    // Auto-generate AI recommendations if not already present
    if (data.recommendations && data.recommendations.length > 0) {
      renderRecommendationsList(data.recommendations);
    } else {
      generateAIRecommendations(false);
    }
  }

  /**
   * Render Top 5 KPI Cards
   */
  function renderKPIs(kpi) {
    document.getElementById('valOtp').textContent = `${kpi.on_time_arrival_pct}%`;
    document.getElementById('valArrDelay').textContent = `${kpi.avg_arrival_delay_min} min`;
    document.getElementById('valDepDelay').textContent = `${kpi.avg_departure_delay_min} min`;
    document.getElementById('valCancel').textContent = `${kpi.cancellation_rate_pct}%`;
    document.getElementById('valTotalFlights').textContent = kpi.total_flights.toLocaleString();
  }

  /**
   * Render On-Time Performance Trend (Dual-Axis Combo Chart)
   */
  function renderTrendChart(trendData) {
    const canvas = document.getElementById('trendCanvas');
    if (!canvas || !trendData) return;
    const ctx = canvas.getContext('2d');
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 28, right: 38, bottom: 28, left: 38 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const maxDelayAxis = 120;
    const months = trendData.map(d => d.month);
    const n = months.length;
    const stepX = chartW / n;

    // Draw horizontal gridlines
    ctx.strokeStyle = '#F1F5F9';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#94A3B8';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';

    for (let pct = 0; pct <= 100; pct += 20) {
      const y = padding.top + chartH - (pct / 100) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();

      ctx.fillText(`${pct}%`, padding.left - 6, y + 3.5);
    }

    // Right axis labels
    ctx.textAlign = 'left';
    for (let del = 0; del <= 120; del += 30) {
      const y = padding.top + chartH - (del / maxDelayAxis) * chartH;
      ctx.fillText(`${del}`, padding.left + chartW + 6, y + 3.5);
    }

    // 1. Draw Columns: Average Arrival Delay (teal columns)
    const barWidth = Math.min(22, stepX * 0.55);
    trendData.forEach((d, i) => {
      const x = padding.left + i * stepX + (stepX - barWidth) / 2;
      const barH = (d.avg_arr_delay / maxDelayAxis) * chartH;
      const y = padding.top + chartH - barH;

      ctx.fillStyle = '#64B5F6';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, barWidth, barH, [2, 2, 0, 0]);
      } else {
        ctx.rect(x, y, barWidth, barH);
      }
      ctx.fill();

      // Label above bar
      ctx.fillStyle = '#475569';
      ctx.font = '600 9.5px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(d.avg_arr_delay)}`, x + barWidth / 2, y - 4);

      // Month name
      ctx.fillStyle = '#64748B';
      ctx.font = '500 10px Inter, sans-serif';
      ctx.fillText(d.month, padding.left + i * stepX + stepX / 2, padding.top + chartH + 16);
    });

    // 2. Draw Line & Markers: On-Time Arrival % (Navy Line)
    ctx.strokeStyle = '#0B3C6D';
    ctx.lineWidth = 2.2;
    ctx.beginPath();

    const points = trendData.map((d, i) => {
      const cx = padding.left + i * stepX + stepX / 2;
      const cy = padding.top + chartH - (d.on_time_pct / 100) * chartH;
      return { x: cx, y: cy, val: d.on_time_pct };
    });

    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    points.forEach(p => {
      ctx.fillStyle = '#0B3C6D';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0B3C6D';
      ctx.font = '700 9.5px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(p.val)}%`, p.x, p.y - 7);
    });
  }

  /**
   * Render Clean & Easily Scannable Delay Drivers
   */
  function renderScannableDelayDrivers(expData) {
    const list = document.getElementById('driversList');
    if (!list) return;
    list.innerHTML = '';

    const summary = expData.summary || {};
    const drivers = expData.drivers || [];

    // 1. Update High-Level Metric Pill Values
    const totalBadge = document.getElementById('driversTotalMinutesBadge');
    if (totalBadge && summary.total_delay_minutes !== undefined) {
      const totalMin = summary.total_delay_minutes;
      const totalHrs = Math.round(totalMin / 60);
      totalBadge.textContent = `Total: ${totalMin.toLocaleString()} min (${totalHrs.toLocaleString()} hrs)`;
    }

    const valControllable = document.getElementById('valControllablePct');
    if (valControllable && summary.controllable_pct !== undefined) {
      valControllable.textContent = `${summary.controllable_pct}%`;
    }

    const valExternal = document.getElementById('valExternalPct');
    if (valExternal && summary.external_pct !== undefined) {
      valExternal.textContent = `${summary.external_pct}%`;
    }

    const valCascading = document.getElementById('valCascadingMult');
    if (valCascading && summary.cascading_multiplier !== undefined) {
      valCascading.textContent = summary.cascading_multiplier;
    }

    // Curated delay driver visual colors
    const colorMap = {
      'Air Carrier': '#0B3C6D',
      'Late Aircraft': '#1D63A3',
      'NAS (ATC)': '#0284C7',
      'Weather': '#F59E0B',
      'Security': '#94A3B8',
      'Other': '#CBD5E1'
    };

    // Filter to significant drivers for high scannability
    const displayDrivers = drivers.filter(d => d.percentage > 0.1);

    displayDrivers.forEach(d => {
      const item = document.createElement('div');
      item.className = 'driver-scannable-item';
      
      const barColor = colorMap[d.category] || d.color || '#0B3C6D';
      const minText = d.minutes !== undefined ? `${d.minutes.toLocaleString()} min` : '';

      item.innerHTML = `
        <div class="driver-title-row">
          <span class="driver-main-name">${d.category}</span>
          <div class="driver-num-wrap">
            <span class="driver-minutes-num">${minText}</span>
            <span class="driver-pct-num">${d.percentage}%</span>
          </div>
        </div>
        <div class="driver-bar-track">
          <div class="driver-bar-fill" style="width: ${Math.min(100, d.percentage)}%; background-color: ${barColor};"></div>
        </div>
      `;
      list.appendChild(item);
    });
  }

  /**
   * Render Clean USA Map from MiraWision/usa-map-react (No Animations)
   */
  function renderUsaMap(airports) {
    const svg = document.getElementById('usMapSvg');
    const tooltip = document.getElementById('mapTooltip');
    if (!svg) return;

    svg.setAttribute('viewBox', '0 0 959 593');

    // 1. Draw USA state paths from MiraWision/usa-map-react
    let statesSvg = '';
    if (usaStatePaths) {
      statesSvg = Object.entries(usaStatePaths).map(([code, pathData]) => {
        return `<path id="${code}" class="us-state-path" d="${pathData}" data-state="${code}" />`;
      }).join('');
    }

    // 2. Draw solid, static airport hub pins (no animations)
    let nodesSvg = '';
    (airports || []).forEach(apt => {
      const pos = AIRPORT_POSITIONS[apt.code] || { x: 480, y: 290 };
      const radius = 6.5;

      nodesSvg += `
        <g class="airport-node" data-code="${apt.code}" data-name="${apt.name}" data-city="${apt.city}" data-state="${apt.state}" data-delay="${apt.avg_delay}" data-tier="${apt.tier}">
          <circle class="airport-pin" cx="${pos.x}" cy="${pos.y}" r="${radius}" fill="${apt.color}" />
          <text class="airport-label" x="${pos.x + 8}" y="${pos.y + 3.5}">${apt.code}</text>
        </g>
      `;
    });

    svg.innerHTML = `
      <g class="us-states-layer">${statesSvg}</g>
      <g class="us-airports-layer">${nodesSvg}</g>
    `;

    // 3. Interactive tooltips & click-to-filter
    const nodes = svg.querySelectorAll('.airport-node');
    nodes.forEach(node => {
      node.addEventListener('mouseenter', (e) => {
        const code = node.getAttribute('data-code');
        const name = node.getAttribute('data-name');
        const city = node.getAttribute('data-city');
        const state = node.getAttribute('data-state');
        const delay = node.getAttribute('data-delay');
        const tier = node.getAttribute('data-tier');

        tooltip.innerHTML = `
          <strong>${code} - ${name}</strong><br>
          <span style="color:#94A3B8;">${city}, ${state}</span><br>
          Avg. Arrival Delay: <strong>${delay} min</strong> (${tier})<br>
          <em style="font-size:9.5px;color:#38BDF8;">Click to filter by ${code}</em>
        `;
        tooltip.style.display = 'block';
      });

      node.addEventListener('mousemove', (e) => {
        const rect = svg.getBoundingClientRect();
        tooltip.style.left = `${e.clientX - rect.left + 12}px`;
        tooltip.style.top = `${e.clientY - rect.top + 10}px`;
      });

      node.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
      });

      node.addEventListener('click', () => {
        const code = node.getAttribute('data-code');
        filterOrigin.value = code;
        triggerQuery();
        showToast(`Filtered dashboard to ${code} airport`, 'info');
      });
    });
  }

  /**
   * Render 2D Heatmap Grid (Day of Week vs Departure Hour)
   */
  function renderHeatmap(heatmapData) {
    const grid = document.getElementById('heatmapGrid');
    if (!grid || !heatmapData) return;
    grid.innerHTML = '';

    const hours = heatmapData.hours;
    const matrix = heatmapData.matrix;

    const headerRow = document.createElement('div');
    headerRow.className = 'heatmap-header-row';
    hours.forEach(h => {
      const cell = document.createElement('div');
      cell.className = 'heatmap-header-cell';
      cell.textContent = `${h}`;
      headerRow.appendChild(cell);
    });
    grid.appendChild(headerRow);

    function getHeatmapColor(val) {
      if (val < 10) return '#FFF7ED';
      if (val < 20) return '#FED7AA';
      if (val < 35) return '#FDBA74';
      if (val < 50) return '#FB923C';
      if (val < 65) return '#EA580C';
      if (val < 80) return '#C2410C';
      return '#7F1D1D';
    }

    matrix.forEach(row => {
      const dayRow = document.createElement('div');
      dayRow.className = 'heatmap-day-row';

      const label = document.createElement('span');
      label.className = 'heatmap-day-label';
      label.textContent = row.day;
      dayRow.appendChild(label);

      const cellsContainer = document.createElement('div');
      cellsContainer.className = 'heatmap-cells-container';

      row.values.forEach((val, hIdx) => {
        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        cell.style.backgroundColor = getHeatmapColor(val);
        cell.title = `${row.day} @ ${hours[hIdx]}:00 - Avg Delay: ${val} min`;
        cell.addEventListener('click', () => {
          filterDay.value = row.day;
          filterHour.value = String(hours[hIdx]);
          triggerQuery();
          showToast(`Filtered to ${row.day} at ${hours[hIdx]}:00`, 'info');
        });
        cellsContainer.appendChild(cell);
      });

      dayRow.appendChild(cellsContainer);
      grid.appendChild(dayRow);
    });
  }

  /**
   * Render Scatter Plot with Real Linear Regression
   */
  function renderScatterPlot(regressionData) {
    const canvas = document.getElementById('scatterCanvas');
    if (!canvas || !regressionData) return;
    const ctx = canvas.getContext('2d');

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 12, right: 16, bottom: 26, left: 32 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const maxVal = 320;

    // Update R2 badge
    const badge = document.getElementById('r2Badge');
    if (badge && regressionData.r2 !== undefined) {
      badge.textContent = `R² = ${regressionData.r2.toFixed(2)}`;
    }

    ctx.strokeStyle = '#F1F5F9';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#94A3B8';
    ctx.font = '9.5px Inter, sans-serif';

    for (let v = 0; v <= 300; v += 100) {
      const y = padding.top + chartH - (v / maxVal) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();

      ctx.textAlign = 'right';
      ctx.fillText(`${v}`, padding.left - 4, y + 3.5);

      const x = padding.left + (v / maxVal) * chartW;
      ctx.textAlign = 'center';
      ctx.fillText(`${v}`, x, padding.top + chartH + 16);
    }

    ctx.fillStyle = '#64748B';
    ctx.font = '500 9.5px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Departure Delay (min)', padding.left + chartW / 2, padding.top + chartH + 24);

    ctx.save();
    ctx.translate(10, padding.top + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Arrival Delay (min)', 0, 0);
    ctx.restore();

    // Scatter Dots
    const points = regressionData.points || [];
    ctx.fillStyle = '#1D63A3';
    ctx.globalAlpha = 0.55;

    points.forEach(p => {
      const x = padding.left + (Math.max(0, p.dep_delay) / maxVal) * chartW;
      const y = padding.top + chartH - (Math.max(0, p.arr_delay) / maxVal) * chartH;

      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalAlpha = 1.0;

    // Linear Regression Line
    const slope = regressionData.slope || 0.94;
    const intercept = regressionData.intercept || 2.1;

    const x1 = 0;
    const y1_val = intercept;
    const x2 = 300;
    const y2_val = slope * x2 + intercept;

    const px1 = padding.left + (x1 / maxVal) * chartW;
    const py1 = padding.top + chartH - (y1_val / maxVal) * chartH;
    const px2 = padding.left + (x2 / maxVal) * chartW;
    const py2 = padding.top + chartH - (y2_val / maxVal) * chartH;

    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(px1, py1);
    ctx.lineTo(px2, py2);
    ctx.stroke();
  }

  /**
   * Render ML Prediction Model Card
   */
  function renderModelPrediction(model) {
    const valEl = document.getElementById('mlProbValue');
    const badgeEl = document.getElementById('mlRiskBadge');

    if (valEl && model.predicted_probability !== undefined) {
      valEl.textContent = `${model.predicted_probability}%`;
    }

    if (badgeEl && model.risk_tier) {
      badgeEl.textContent = model.risk_tier;
      if (model.risk_tier === 'High Risk') {
        badgeEl.style.background = '#FEE2E2';
        badgeEl.style.color = '#DC2626';
      } else if (model.risk_tier === 'Moderate Risk') {
        badgeEl.style.background = '#FEF3C7';
        badgeEl.style.color = '#D97706';
      } else {
        badgeEl.style.background = '#DCFCE7';
        badgeEl.style.color = '#16A34A';
      }
    }
  }

  /**
   * Render ML Feature Importance Horizontal Bars
   */
  function renderFeatureImportance(features) {
    const list = document.getElementById('importanceList');
    if (!list || !features) return;
    list.innerHTML = '';

    const colors = ['#0B3C6D', '#1D63A3', '#4A90E2', '#7BB4EC', '#BCE0FD'];

    features.forEach((f, i) => {
      const row = document.createElement('div');
      row.className = 'importance-row';
      row.innerHTML = `
        <span class="importance-name">${f.feature}</span>
        <div class="importance-track">
          <div class="importance-fill" style="width: ${f.importance * 260}%; background-color: ${colors[i % colors.length]};"></div>
        </div>
        <span class="importance-val">${f.importance.toFixed(2)}</span>
      `;
      list.appendChild(row);
    });
  }

  /**
   * Render Operational Recommendations Cards (Clean SVG icons, zero emoji)
   */
  function renderRecommendationsList(recs) {
    const container = document.getElementById('recommendationsList');
    if (!container || !recs || recs.length === 0) return;
    container.innerHTML = '';

    const iconMap = {
      clock: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
      pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>',
      gear: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>',
      plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z"/>',
      alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>'
    };

    recs.forEach(r => {
      const iconPath = iconMap[r.icon] || iconMap.clock;
      const cleanTitle = (r.title || '').replace(/\*\*/g, '').replace(/^[0-9]+\.\s*/, '').trim();
      const card = document.createElement('div');
      card.className = 'recommendation-item';
      card.innerHTML = `
        <div class="rec-icon-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${iconPath}
          </svg>
        </div>
        <div class="rec-content">
          <h3 class="rec-title">${r.id || ''}. ${cleanTitle}</h3>
          <p class="rec-desc">${r.description}</p>
        </div>
      `;
      container.appendChild(card);
    });
  }

  /**
   * Generate Live AI Recommendations using OpenRouter (Key from .env)
   */
  async function generateAIRecommendations(interactive = true) {
    if (!currentData || !currentData.kpi) return;

    const dot = aiStatusBar ? aiStatusBar.querySelector('.ai-status-dot') : null;
    if (dot) dot.className = 'ai-status-dot dot-loading';
    if (aiStatusText) aiStatusText.textContent = 'Generating AI recommendations via OpenRouter...';

    const kpi = currentData.kpi;
    const drivers = (currentData.delay_drivers_expanded && currentData.delay_drivers_expanded.drivers) || [];
    const getPct = (cat) => {
      const f = drivers.find(d => d.category.toLowerCase().includes(cat.toLowerCase()));
      return f ? f.percentage : 25.0;
    };

    const payload = {
      metrics: {
        airline: filterAirline.options[filterAirline.selectedIndex]?.text || 'All Airlines',
        origin: filterOrigin.options[filterOrigin.selectedIndex]?.text || 'All Airports',
        date_range: `${dateStartEl.value} to ${dateEndEl.value}`,
        on_time_pct: kpi.on_time_arrival_pct,
        arr_delay: kpi.avg_arrival_delay_min,
        dep_delay: kpi.avg_departure_delay_min,
        carrier_pct: getPct('Carrier'),
        late_ac_pct: getPct('Late Aircraft'),
        nas_pct: getPct('NAS'),
        weather_pct: getPct('Weather')
      }
    };

    const recCard = document.getElementById('aiRecsCard');
    if (recCard) recCard.classList.add('is-loading');

    try {
      const resp = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resJson = await resp.json();
      if (resp.ok && resJson.status === 'success' && resJson.recommendations) {
        renderRecommendationsList(resJson.recommendations);
        if (aiStatusText) aiStatusText.textContent = `Generated at ${new Date().toLocaleTimeString()} (Active Network Envelope)`;
        if (dot) dot.className = 'ai-status-dot';
        if (interactive) showToast('AI recommendations updated successfully', 'success');
      } else {
        throw new Error(resJson.error || resJson.message || 'Failed to call OpenRouter');
      }
    } catch (err) {
      console.warn('OpenRouter call error:', err);
      if (aiStatusText) aiStatusText.textContent = `Notice: ${err.message}. Showing heuristic OCC recommendations.`;
      if (dot) dot.className = 'ai-status-dot';
      renderDefaultRecommendations();
      if (interactive) showToast(`Notice: ${err.message}`, 'error', 4000);
    } finally {
      if (recCard) recCard.classList.remove('is-loading');
    }
  }


  /**
   * Smart fallback recommendations
   */
  function renderDefaultRecommendations() {
    renderRecommendationsList([
      {
        id: 1,
        icon: 'clock',
        title: 'Protect High-Risk Departure Windows',
        description: 'Increase ramp staffing and priority ground monitoring during the 4 PM – 8 PM evening rush when network delay compounding peaks.'
      },
      {
        id: 2,
        icon: 'pin',
        title: 'Target Hub Turn Bottlenecks',
        description: 'Implement tactical turn mitigation at high-delay hub stations (ORD, ATL, EWR) to prevent outbound pushback holds.'
      },
      {
        id: 3,
        icon: 'gear',
        title: 'Expand Turnaround Buffers',
        description: 'Add 10-15 min turnaround padding on aircraft pairings exhibiting high late-aircraft delay propagation to eliminate cascading tails.'
      }
    ]);
  }

  /**
   * Setup OpenRouter Recommendations Action
   */
  function setupRecommendationsEngine() {
    if (regenerateRecsBtn) {
      regenerateRecsBtn.addEventListener('click', () => generateAIRecommendations(true));
    }
  }

  /**
   * Setup Sync Button (Till Today: Sept 20, 2026)
   */
  function setupSyncHandler() {
    const handleSync = async () => {
      [syncBtnHeader, syncBtnSidebar].forEach(b => {
        if (b) b.classList.add('syncing');
      });

      showToast('Synchronizing flight operations dataset through Sept 20, 2026...', 'info', 3500);

      try {
        const res = await fetch('/api/sync', { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
          showToast(`Synced ${data.total_records.toLocaleString()} BTS flight operations spanning ${data.min_date} through ${data.max_date}`, 'success', 4000);
          dateStartEl.value = data.min_date;
          dateEndEl.value = data.max_date;
          triggerQuery();
        } else {
          throw new Error(data.error || 'Sync returned error');
        }
      } catch (e) {
        showToast(`Sync notice: ${e.message}`, 'info');
      } finally {
        setTimeout(() => {
          [syncBtnHeader, syncBtnSidebar].forEach(b => {
            if (b) b.classList.remove('syncing');
          });
        }, 800);
      }
    };

    if (syncBtnHeader) syncBtnHeader.addEventListener('click', handleSync);
    if (syncBtnSidebar) syncBtnSidebar.addEventListener('click', handleSync);
  }

  /**
   * Setup Slicers & Presets Event Listeners
   */
  function setupEventListeners() {
    // 1. Date inputs
    dateStartEl.addEventListener('change', () => {
      updateActivePresetBadge();
      debouncedQuery();
    });

    dateEndEl.addEventListener('change', () => {
      updateActivePresetBadge();
      debouncedQuery();
    });

    // 2. Date presets
    datePresetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        datePresetBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const preset = btn.getAttribute('data-preset');
        if (preset === 'all') {
          dateStartEl.value = '2023-01-01';
          dateEndEl.value = '2026-09-20';
          if (monthSlider) monthSlider.value = 45;
          if (sliderFeedback) sliderFeedback.textContent = 'Showing: Full Horizon (2023 - 2026)';
        } else if (preset === '2026') {
          dateStartEl.value = '2026-01-01';
          dateEndEl.value = '2026-09-20';
          if (monthSlider) monthSlider.value = 45;
          if (sliderFeedback) sliderFeedback.textContent = 'Showing: 2026 YTD (Till Today)';
        } else if (preset === '2023') {
          dateStartEl.value = '2023-01-01';
          dateEndEl.value = '2023-12-31';
          if (monthSlider) monthSlider.value = 12;
          if (sliderFeedback) sliderFeedback.textContent = 'Showing: 2023 Full Year Baseline';
        }
        triggerQuery();
      });
    });

    // 3. Month/Year Timeline Slider
    if (monthSlider) {
      monthSlider.addEventListener('input', () => {
        const val = parseInt(monthSlider.value);
        dateStartEl.value = '2023-01-01';
        if (val <= 12) {
          const m = String(val).padStart(2, '0');
          dateEndEl.value = `2023-${m}-28`;
          if (sliderFeedback) sliderFeedback.textContent = `Showing: Jan 2023 to Month ${val} (2023)`;
        } else if (val <= 24) {
          const m = String(val - 12).padStart(2, '0');
          dateEndEl.value = `2024-${m}-28`;
          if (sliderFeedback) sliderFeedback.textContent = `Showing: 2023 to Month ${val - 12} (2024)`;
        } else if (val <= 36) {
          const m = String(val - 24).padStart(2, '0');
          dateEndEl.value = `2025-${m}-28`;
          if (sliderFeedback) sliderFeedback.textContent = `Showing: 2023 to Month ${val - 24} (2025)`;
        } else {
          dateEndEl.value = '2026-09-20';
          if (sliderFeedback) sliderFeedback.textContent = 'Showing: Full Horizon (through Sept 20, 2026)';
        }
        debouncedQuery();
      });
    }

    // 4. Reset Dates Button
    resetDatesBtn.addEventListener('click', () => {
      dateStartEl.value = '2023-01-01';
      dateEndEl.value = '2026-09-20';
      if (monthSlider) monthSlider.value = 45;
      if (sliderFeedback) sliderFeedback.textContent = 'Showing: Full Horizon (2023 - 2026)';
      updateActivePresetBadge('all');
      triggerQuery();
    });

    // 5. Reset All Filters Button
    resetAllBtn.addEventListener('click', () => {
      dateStartEl.value = '2023-01-01';
      dateEndEl.value = '2026-09-20';
      if (monthSlider) monthSlider.value = 45;
      if (sliderFeedback) sliderFeedback.textContent = 'Showing: Full Horizon (2023 - 2026)';
      filterAirline.value = 'ALL';
      filterOrigin.value = 'ALL';
      filterDest.value = 'ALL';
      filterDay.value = 'ALL';
      filterHour.value = 'ALL';
      updateActivePresetBadge('all');
      triggerQuery();
      showToast('Reset all slicers to full horizon', 'info');
    });

    // 6. Select dropdowns
    [filterAirline, filterOrigin, filterDest, filterDay, filterHour].forEach(sel => {
      sel.addEventListener('change', () => triggerQuery());
    });
  }

  function updateActivePresetBadge(activePreset) {
    datePresetBtns.forEach(btn => {
      if (activePreset && btn.getAttribute('data-preset') === activePreset) {
        btn.classList.add('active');
      } else if (activePreset) {
        btn.classList.remove('active');
      }
    });
  }

  function debouncedQuery() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      triggerQuery();
    }, 250);
  }

  /**
   * Interactive Simulator Modal Logic
   */
  function setupSimulator() {
    const modal = document.getElementById('simulatorModal');
    const openBtn = document.getElementById('openSimulatorBtn');
    const closeBtn = document.getElementById('closeSimulatorBtn');

    if (openBtn && modal) openBtn.addEventListener('click', () => modal.classList.add('open'));
    if (closeBtn && modal) closeBtn.addEventListener('click', () => modal.classList.remove('open'));
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
      });
    }

    const depSlider = document.getElementById('simDepDelay');
    const depLabel = document.getElementById('simDepDelayLabel');
    const distSlider = document.getElementById('simDistance');
    const distLabel = document.getElementById('simDistLabel');
    const simOrigin = document.getElementById('simOrigin');
    const simHour = document.getElementById('simHour');
    const simDay = document.getElementById('simDay');

    const resProb = document.getElementById('simResProb');
    const resBadge = document.getElementById('simResBadge');
    const resRec = document.getElementById('simRecommendation');

    function calculateRisk() {
      const depDelay = parseInt(depSlider.value);
      const dist = parseInt(distSlider.value);
      const origin = simOrigin.value;
      const hour = parseInt(simHour.value);
      const day = parseInt(simDay.value);

      depLabel.textContent = `${depDelay} min`;
      if (distLabel) distLabel.textContent = `${dist} miles`;

      const originRiskMap = {
        ATL: 0.28, ORD: 0.32, JFK: 0.34, EWR: 0.35, DFW: 0.25,
        LAX: 0.22, SFO: 0.24, DEN: 0.21, SEA: 0.16, MIA: 0.23
      };
      const origRisk = originRiskMap[origin] || 0.22;

      let score = -1.8;
      score += 0.052 * depDelay;
      score += 3.2 * origRisk;
      score += 0.038 * (hour >= 15 && hour <= 21 ? hour : hour * 0.4);
      score += 0.08 * (day === 5 ? 2 : 1);
      score += 0.00015 * dist;

      const prob = Math.round((1 / (1 + Math.exp(-score))) * 100);
      resProb.textContent = `${prob}%`;

      if (prob >= 60) {
        resBadge.textContent = 'High Risk';
        resBadge.style.background = '#FEE2E2';
        resBadge.style.color = '#DC2626';
        resRec.innerHTML = `<strong>Operations Recommendation:</strong> Critical delay propagation risk. Prioritize gate pushback hold, notify station turn coordinator, and protect tight passenger connections at ${origin}.`;
      } else if (prob >= 35) {
        resBadge.textContent = 'Moderate Risk';
        resBadge.style.background = '#FEF3C7';
        resBadge.style.color = '#D97706';
        resRec.innerHTML = `<strong>Operations Recommendation:</strong> Monitor turn turnaround buffer. Streamline catering and ground baggage dispatch to preserve on-time flight arrival.`;
      } else {
        resBadge.textContent = 'Low Risk';
        resBadge.style.background = '#DCFCE7';
        resBadge.style.color = '#16A34A';
        resRec.innerHTML = `<strong>Operations Recommendation:</strong> Flight operating within standard on-time envelope. Standard gate dispatch procedure.`;
      }
    }

    [depSlider, distSlider, simOrigin, simHour, simDay].forEach(el => {
      if (el) el.addEventListener('input', calculateRisk);
    });

    calculateRisk();
  }

  /**
   * Resize Redraw Handler
   */
  function setupResizeHandler() {
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (currentData) {
          renderTrendChart(currentData.monthly_trend);
          renderScatterPlot(currentData.scatter_regression);
          renderUsaMap(currentData.airports);
        }
      }, 150);
    });
  }
});
