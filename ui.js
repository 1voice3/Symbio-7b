'use strict';
/* ============================================================
   UI layer: router, screens, bindings, search, manual viewer
   ============================================================ */

/* ---------------- router ---------------- */
const TABS = ['home', 'status', 'settings', 'service', 'alarms', 'utilities'];
S.route = '#/home';
let uiUpdaters = [];

function parseHash() {
  const h = location.hash || '#/home';
  if (h.startsWith('#/manual')) return { view: 'manual' };
  const parts = h.replace(/^#\//, '').split('/');
  return { view: parts[0] || 'home', sub: parts[1] || '' };
}
function go(hash) { location.hash = hash; }

function render() {
  const r = parseHash();
  S.route = location.hash || '#/home';
  uiUpdaters = [];
  const view = $('#view');
  view.scrollTop = 0;
  document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === (r.view === 'trainer' || r.view === 'bluetooth' ? '' : r.view)));
  $('#btnBack').style.display = 'none';
  if (r.view === 'manual') return; // handled by manual viewer
  const fn = ({
    home: scrHome, status: scrMenu, settings: scrMenu, service: scrMenu,
    utilities: scrMenu, alarms: scrAlarms, bluetooth: scrBluetooth, trainer: scrTrainer
  })[r.view] || scrHome;
  fn(r, view);
}

/* ---------------- generic menu screen ---------------- */
function itemPage(sectionKey, idx) {
  const m = MENU[sectionKey];
  if (sectionKey === 'status/activeSetpoints') return idx < 27 ? 151 : 152;
  if (sectionKey === 'status/system') return idx < 18 ? 152 : 153;
  return m.p;
}
function crumb(parts) {
  return '<div class="crumbbar">' + parts.map((p, i) =>
    `<div class="c ${i === parts.length - 1 ? 'on' : ''}" data-go="${parts.slice(0, i + 1).map(encodeURIComponent).join('/')}">${esc(p)}</div>`).join('<span style="color:var(--dim)">›</span>') + '</div>';
}
function manualPill(page, label, q) {
  const query = encodeURIComponent(q || label || '');
  return `<span class="pill" data-manual="${page}" data-q="${query}">📖 p.${page}</span>`;
}

function scrMenu(r, view) {
  const top = r.view;
  const key = r.sub ? top + '/' + r.sub : top;
  const m = MENU[key];
  if (!m) { view.innerHTML = '<div class="empty">Unknown menu</div>'; return; }
  const submenus = Object.keys(MENU).filter(k => k.startsWith(top + '/') && k.split('/').length === 2);
  let html = crumb(['Home', m.t === 'HOME' ? 'Home' : cap(top), ...(r.sub ? [m.t] : [])]);
  if (top === 'status') html = crumb(['Home', 'Status', ...(r.sub ? [m.t] : [])]);
  if (top === 'settings') html = crumb(['Home', 'Settings', ...(r.sub ? [m.t] : [])]);
  if (top === 'service') html = crumb(['Home', 'Service', ...(r.sub ? [m.t] : [])]);
  if (top === 'utilities') html = crumb(['Home', 'Utilities', ...(r.sub ? [m.t] : [])]);

  if (!r.sub && submenus.length) {
    html += `<div class="card"><div class="hd"><span class="n">${cap(top)} Menu</span>${manualPill(m.p, m.t)}</div>`;
    for (const s of submenus) {
      const sm = MENU[s];
      html += `<div class="row" data-go="${s}"><span class="nm">${esc(sm.t)}</span><span class="vl">›</span></div>`;
    }
    html += '</div>';
    if (top === 'status') html += `<div class="note">Status menus mirror the Symbio 700 onboard UI (manual p.148-156).</div>`;
    if (top === 'settings') html += `<div class="note">Setpoints and requests. Defaults from manual p.121-123 (marked * in the manual).</div>`;
    if (top === 'service') html += `<div class="note">Service menus (manual p.160-161). Diagnostics reset clears trips and lockouts (p.34-37).</div>`;
  } else {
    const isEdit = key === 'utilities/editConfiguration';
    if (isEdit) {
      html += `<div class="card"><div class="hd"><span class="n">Edit Configuration</span>${manualPill(162, 'Edit Configuration')}</div>
      <div class="note" style="border:none">“Think very hard before trying to use this feature for configuring the unit! The preferred method is the Phone App.” — manual p.149</div>`;
      html += `<div class="btnrow"><button class="btn amber" id="clearReconfig">Clear & Reconfig.</button></div>`;
    } else {
      html += `<div class="card"><div class="hd"><span class="n">${esc(m.t)}</span>${manualPill(m.p, m.t)}</div>`;
    }
    if (key === 'service/diagnostics') {
      html += `<div class="row" data-act="diagreset"><span class="nm">Reset Diagnostic<span class="note">Clears all trips and lockouts (manual p.160)</span></span><span class="vl edit">GO</span></div>`;
      html += `<div class="row" style="cursor:default"><span class="nm">Active Diagnostics<span class="note">Alarm categories: Critical / Service Required / Advisory / Information (p.129)</span></span><span class="vl" id="diagCount"></span></div>`;
      uiUpdaters.push(() => { const el = $('#diagCount'); if (el) { el.textContent = S.alarms.length; el.className = 'vl ' + (S.alarms.length ? 'alarm' : 'on'); } });
    } else if (key === 'service/test') {
      for (const [i, it] of m.items.entries()) {
        html += testRow(it, i);
      }
    } else if (key === 'service/statisticsReset') {
      for (const it of m.items) html += statRow(it);
    } else {
      for (const [i, it] of m.items.entries()) {
        html += itemRow(it, key, i);
      }
    }
    html += '</div>';
  }
  view.innerHTML = html;
  bindCommon(view);
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function itemRow(name, sectionKey, idx) {
  const pg = itemPage(sectionKey, idx);
  const bind = bindItem(name, sectionKey);
  const cls = bind.cls || 'vl';
  const id = 'iv' + sectionKey.replace(/\//g, '_') + '_' + idx;
  if (bind.edit) {
    uiUpdaters.push(() => { const el = $('#' + id); if (el) el.textContent = bind.get(); });
    return `<div class="row" data-edit="${esc(name)}" data-sec="${sectionKey}"><span class="nm">${esc(name)}</span><span class="vl edit" id="${id}">${esc(bind.get())}</span>${manualPill(pg, name)}</div>`;
  }
  if (bind.act) {
    return `<div class="row" data-act="${esc(name)}"><span class="nm">${esc(name)}<span class="note">${esc(bind.note || '')}</span></span><span class="vl edit">${esc(bind.act)}</span>${manualPill(pg, name)}</div>`;
  }
  uiUpdaters.push(() => { const el = $('#' + id); if (el) { el.textContent = bind.get(); el.className = 'vl ' + (bind.cls2 ? bind.cls2() : bind.cls || ''); } });
  return `<div class="row" style="cursor:default"><span class="nm">${esc(name)}</span><span class="vl" id="${id}">${esc(bind.get())}</span>${manualPill(pg, name)}</div>`;
}

function testRow(name, i) {
  if (name === 'Service Test State Request') {
    const opts = ['Inactive', 'Fan On', 'Cool 1', 'Cool 2', 'Heat 1', 'Heat 2', 'Heat 3', 'Heat 4', 'Defrost', 'Emergency Heat'];
    const id = 'tstState';
    uiUpdaters.push(() => { const el = $('#' + id); if (el) el.textContent = S.settings.serviceTestStateRequest; });
    return `<div class="row" data-act="edittest"><span class="nm">Service Test State Request<span class="note">Fan On, Cool 1-2, Heat 1-4, Defrost, Emergency Heat (manual p.131)</span></span><span class="vl edit" id="${id}">${S.settings.serviceTestStateRequest}</span>${manualPill(131, 'Service Test Mode')}</div>`;
  }
  if (name === 'Performance Test State Request') {
    const id = 'tstPerf';
    uiUpdaters.push(() => { const el = $('#' + id); if (el) el.textContent = S.settings.performanceTestStateRequest; });
    return `<div class="row" data-act="editperf"><span class="nm">Performance Test State Request<span class="note">“DO NOT USE PERFORMANCE TEST!” — manual p.164</span></span><span class="vl edit" id="${id}">${S.settings.performanceTestStateRequest}</span>${manualPill(164, 'Test Mode')}</div>`;
  }
  const id = 'tstTo';
  uiUpdaters.push(() => { const el = $('#' + id); if (el) el.textContent = S.settings.serviceTestTimeout + ' min'; });
  return `<div class="row" data-act="edittestto"><span class="nm">Service Test Timeout (Minutes)<span class="note">Default 60 min, then reverts to Inactive (manual p.131)</span></span><span class="vl edit" id="${id}">${S.settings.serviceTestTimeout} min</span>${manualPill(131, 'Service Test Mode')}</div>`;
}

function statRow(name) {
  const map = {
    'Compressor 1 Run Time Reset': () => { S.comps[0].rt = 0; S.stats.c1rt = 0; },
    'Compressor 1 Starts Reset': () => { S.comps[0].st = 0; S.stats.c1st = 0; },
    'Compressor 2 Run Time Reset': () => { S.comps[1].rt = 0; S.stats.c2rt = 0; },
    'Compressor 2 Starts Reset': () => { S.comps[1].st = 0; S.stats.c2st = 0; },
    'Condenser Fan 1 Run Time Reset': () => { S.condFans[0].rt = 0; S.stats.f1rt = 0; },
    'Condenser Fan 1 Starts Reset': () => { S.condFans[0].st = 0; S.stats.f1st = 0; },
    'Condenser Fan 2 Run Time Reset': () => { S.condFans[1].rt = 0; S.stats.f2rt = 0; },
    'Condenser Fan 2 Starts Reset': () => { S.condFans[1].st = 0; S.stats.f2st = 0; },
    'Electric Heat Stage 1 Run Time Reset': () => { S.eheat[0].rt = 0; S.stats.eh1rt = 0; },
    'Electric Heat Stage 1 Starts Reset': () => { S.eheat[0].st = 0; S.stats.eh1st = 0; },
    'Electric Heat Stage 2 Run Time Reset': () => { S.eheat[1].rt = 0; S.stats.eh2rt = 0; },
    'Electric Heat Stage 2 Starts Reset': () => { S.eheat[1].st = 0; S.stats.eh2st = 0; },
    'Filter Timer Reset': () => { S.filterHours = 0; clearAlarm('filter', 'Filter Timer Reset'); },
    'Supply Fan Run Time Reset': () => { S.supplyFan.rt = 0; S.stats.sfrt = 0; },
    'Supply Fan Starts Reset': () => { S.supplyFan.st = 0; S.stats.sfst = 0; }
  };
  const fn = map[name];
  return `<div class="row" data-act="statreset" data-name="${esc(name)}"><span class="nm">${esc(name)}</span><span class="vl edit">RESET</span>${manualPill(160, name)}</div>`;
}

/* ---------------- item bindings ---------------- */
function onoff(v) { return v ? 'On' : 'Off'; }
function bindItem(name, sectionKey) {
  const t = S.tstat, sp = setpoints(), cfg = S.config, st = S.settings;
  const B = {
    /* HOME (p.150) */
    'Cooling Capacity Status %': { get: () => (cfg.systemType === 'VVZT' ? fmt(S.capacityPct, 0) : fmt((S.coolStage || 0) / 2 * 100, 0)) + '%', cls2: () => 'vl ' + (S.comps.some(c => c.cmd) ? 'on' : 'off') },
    'Heat Cool Mode Status': { get: () => S.mode, cls: 'vl' },
    'Heat Secondary Capacity Status': { get: () => onoff(S.eheat[1].cmd), cls2: () => 'vl ' + (S.eheat[1].cmd ? 'on' : 'off') },
    'Heating Capacity Primary Status': { get: () => onoff(S.eheat[0].cmd || (S.comps.some(c => c.cmd) && S.mode === 'Heat')), cls2: () => 'vl ' + (S.eheat[0].cmd ? 'on' : 'off') },
    'Occupancy Status': { get: () => S.occupancy },
    'Space Temperature Active': { get: () => fmt(S.spaceTemp) + ' °F' },
    'Space Temperature Setpoint Active': { get: () => fmt(S.mode === 'Cool' ? sp.cool : sp.heat) + ' °F' },
    'Supply Fan Speed Status': { get: () => fmt(S.supplyFan.speed, 0) + '%' },
    'Thermostat G Input': tstatB('g'), 'Thermostat W1/O Input': tstatB('w1'), 'Thermostat W2 Input': tstatB('w2'),
    'Thermostat X2 Input': tstatB('x2'), 'Thermostat Y1 Input': tstatB('y1'), 'Thermostat Y2 Input': tstatB('y2'),
    /* Status > System (p.152-153) */
    'Outdoor Air Temperature Active': { get: () => S.oatSensorOk ? fmt(S.oat) + ' °F' : 'Alarm', cls2: () => 'vl ' + (S.oatSensorOk ? '' : 'alarm') },
    'Outdoor Air Temperature Arbitrator': { get: () => S.oatSensorOk ? fmt(S.oat) + ' °F' : '—' },
    'Outdoor Air Temperature BAS': { get: () => S.oatSensorOk ? fmt(S.oat) + ' °F' : '—' },
    'Outdoor Air Temperature Local': { get: () => S.oatSensorOk ? fmt(S.oat) + ' °F' : '—' },
    'Phase Monitor Status': { get: () => S.faults.phaseMonitor ? 'Fault' : 'OK', cls2: () => 'vl ' + (S.faults.phaseMonitor ? 'alarm' : 'on') },
    'Space Temperature Active ': { get: () => fmt(S.spaceTemp) + ' °F' },
    'Space Temperature Arbitrator': { get: () => fmt(S.spaceTemp) + ' °F' },
    'Space Temperature BAS': { get: () => fmt(S.spaceTemp) + ' °F' },
    'Space Temperature Input': { get: () => fmt(S.spaceTemp) + ' °F' },
    'Space Temperature Local': { get: () => fmt(S.spaceTemp) + ' °F' },
    'Space Temperature Setpoint BAS': { get: () => fmt(sp.cool) + ' °F' },
    'Space Temperature Setpoint Input': { get: () => fmt(sp.cool) + ' °F' },
    'Space Humidity Active': { get: () => cfg.humiditySensor === 'Installed' ? fmt(S.spaceHumidity, 0) + ' %RH' : 'Not Installed', cls2: () => 'vl ' + (cfg.humiditySensor === 'Installed' ? '' : 'off') },
    'Space Humidity Arbitrator': { get: () => cfg.humiditySensor === 'Installed' ? fmt(S.spaceHumidity, 0) + ' %RH' : '—' },
    'Space Humidity BAS': { get: () => cfg.humiditySensor === 'Installed' ? fmt(S.spaceHumidity, 0) + ' %RH' : '—' },
    'Space Humidity Input': { get: () => cfg.humiditySensor === 'Installed' ? fmt(S.spaceHumidity, 0) + ' %RH' : '—' },
    'Space CO2 Concentration Active': { get: () => cfg.co2Sensor === 'Installed' ? fmt(S.co2, 0) + ' ppm' : 'Not Installed', cls2: () => 'vl ' + (cfg.co2Sensor === 'Installed' ? '' : 'off') },
    'Space CO2 Concentration Arbitrator': { get: () => cfg.co2Sensor === 'Installed' ? fmt(S.co2, 0) + ' ppm' : '—' },
    'Space CO2 Concentration BAS': { get: () => cfg.co2Sensor === 'Installed' ? fmt(S.co2, 0) + ' ppm' : '—' },
    'Space CO2 Concentration Input': { get: () => cfg.co2Sensor === 'Installed' ? fmt(S.co2, 0) + ' ppm' : '—' },
    'Space Temp Cooling Setpoint Status': { get: () => fmt(sp.cool) + ' °F' },
    'Space Temp Heating Setpoint Status': { get: () => fmt(sp.heat) + ' °F' },
    'System Mode Switch Local': { get: () => st.heatCoolModeRequest },
    'System Mode Switch Input': { get: () => st.heatCoolModeRequest },
    'System Mode Switch Air-Fi': { get: () => '—' },
    'Occupancy Input': { get: () => S.occupancy },
    'Occupancy Input Active': { get: () => S.occupancy },
    'Occupancy Status ': { get: () => S.occupancy },
    'Timed Override Status Active': { get: () => st.timedOverrideRequest },
    'Timed Override Timer Is Active': { get: () => 'No' },
    'Unit Stop Source': { get: () => st.unitStopCommand === 'Stop' ? 'Unit Stop Command' : 'None' },
    'Supply Fan Configuration Status': { get: () => st.supplyFanConfig },
    'Supply Air Tempering Status': { get: () => st.supplyAirTemperingEnable === 'Enable' ? 'Enabled' : 'Disabled' },
    'Demand Limit Input': { get: () => 'Not Limited' },
    'Equipment Shutdown Input Status': { get: () => 'OK' },
    'Alarm Indicator Status': { get: () => S.alarms.length ? 'Active' : 'Off', cls2: () => 'vl ' + (S.alarms.length ? 'alarm' : 'off') },
    /* Status > Indoor (p.154) */
    'Discharge Air Temperature Local': { get: () => cfg.dischargeTempSensor === 'Installed' ? fmt(S.dat) + ' °F' : 'Not Installed', cls2: () => 'vl ' + (cfg.dischargeTempSensor === 'Installed' ? '' : 'off') },
    'Filter Runtime Hours': { get: () => fmt(S.filterHours, 0) + ' h', cls2: () => 'vl ' + (st.filterRuntimeHoursSetpoint > 0 && S.filterHours >= st.filterRuntimeHoursSetpoint ? 'alarm' : '') },
    'Run Time - Supply Fan (Hours)': { get: () => fmt(S.supplyFan.rt / 3600, 1) + ' h' },
    'Starts - Supply Fan': { get: () => S.supplyFan.st },
    'Supply Fan Current': { get: () => S.supplyFan.cmd ? fmt(4 + S.supplyFan.speed / 100 * 6, 1) + ' A' : '0 A' },
    'Supply Fan Output Status': { get: () => onoff(S.supplyFan.cmd), cls2: () => 'vl ' + (S.supplyFan.cmd ? 'on' : 'off') },
    'Supply Fan Power': { get: () => S.supplyFan.cmd ? fmt(S.supplyFan.speed / 100 * 3.7, 1) + ' kW' : '0 kW' },
    'Supply Fan Signal Command Status': { get: () => fmt(S.supplyFan.speed, 0) + '%' },
    'Supply Fan Speed Status': { get: () => fmt(S.supplyFan.speed, 0) + '%', cls2: () => 'vl ' + (S.supplyFan.cmd ? 'on' : 'off') },
    /* Status > Refrigeration (p.155) */
    'Circuit 1 Defrost Status': defB(0), 'Circuit 2 Defrost Status': defB(1),
    'Circuit 1 LPC Status': { get: () => S.comps[0].cmd ? (S.faults.lpc1 ? 'Open (Alarm)' : 'Closed') : (S.faults.lpc1 ? 'Open' : 'Closed'), cls2: () => 'vl ' + (S.faults.lpc1 ? 'alarm' : 'on') },
    'Circuit 2 LPC Status': { get: () => S.comps[1].cmd ? (S.faults.lpc2 ? 'Open (Alarm)' : 'Closed') : (S.faults.lpc2 ? 'Open' : 'Closed'), cls2: () => 'vl ' + (S.faults.lpc2 ? 'alarm' : 'on') },
    'Coil Temperature Sensor 1': { get: () => S.faults.coilSensor1 ? 'Failed' : fmt(S.defrost[0].coilTemp) + ' °F', cls2: () => 'vl ' + (S.faults.coilSensor1 ? 'alarm' : '') },
    'Coil Temperature Sensor 2': { get: () => S.faults.coilSensor2 ? 'Failed' : fmt(S.defrost[1].coilTemp) + ' °F', cls2: () => 'vl ' + (S.faults.coilSensor2 ? 'alarm' : '') },
    'Compressor 1 Command Status': cmdB(0), 'Compressor 2 Command Status': cmdB(1),
    'Compressor 1 Proving Status': provB(0), 'Compressor 2 Proving Status': provB(1),
    'Compressor 1 Unloader Command Status': { get: () => S.coolStage >= 2 && S.comps[0].cmd ? 'Active' : 'Inactive' },
    'Compressor 2 Unloader Command Status': { get: () => S.coolStage >= 2 && S.comps[1].cmd ? 'Active' : 'Inactive' },
    'Condenser Fan 1 Command Status': fanB(0), 'Condenser Fan 2 Command Status': fanB(1),
    'Cooling Capacity Status': { get: () => fmt(S.coolStage / 2 * 100, 0) + '%' },
    'Defrost Status': { get: () => S.defrost.some(d => d.active) ? 'Active' : 'Inactive', cls2: () => 'vl ' + (S.defrost.some(d => d.active) ? 'warn' : 'off') },
    'Evaporator Defrost Status': { get: () => S.simTime < S.edc.offUntil ? 'Active (3 min)' : 'Inactive' },
    'FroStat Input': { get: () => cfg.frostat === 'Installed' ? (S.frost ? 'Closed' : 'Open') : 'Not Installed' },
    'Refrigerant Type': { get: () => cfg.refrigerant },
    'Run Time - Compressor 1 (Hours)': { get: () => fmt(S.comps[0].rt / 3600, 1) + ' h' },
    'Run Time - Compressor 2 (Hours)': { get: () => fmt(S.comps[1].rt / 3600, 1) + ' h' },
    'Run Time - Condenser Fan 1 (Hours)': { get: () => fmt(S.condFans[0].rt / 3600, 1) + ' h' },
    'Run Time - Condenser Fan 2 (Hours)': { get: () => fmt(S.condFans[1].rt / 3600, 1) + ' h' },
    'Starts - Compressor 1': { get: () => S.comps[0].st },
    'Starts - Compressor 2': { get: () => S.comps[1].st },
    'Starts - Condenser Fan 1': { get: () => S.condFans[0].st },
    'Starts - Condenser Fan 2': { get: () => S.condFans[1].st },
    'Switchover Valve 1 Command Status': svB(0), 'Switchover Valve 2 Command Status': svB(1),
    /* Status > Heat (p.156) */
    'Electric Heat Stage 1 Status': ehB(0), 'Electric Heat Stage 2 Status': ehB(1),
    'Run Time - Electric Heat Stage 1 (Hours)': { get: () => fmt(S.eheat[0].rt / 3600, 1) + ' h' },
    'Run Time - Electric Heat Stage 2 (Hours)': { get: () => fmt(S.eheat[1].rt / 3600, 1) + ' h' },
    'Starts - Electric Heat Stage 1': { get: () => S.eheat[0].st },
    'Starts - Electric Heat Stage 2': { get: () => S.eheat[1].st },
    /* Active Setpoints (p.151-152) */
    'Space Temperature Setpoint Active': { get: () => fmt(sp.cool) + ' °F (cool) / ' + fmt(sp.heat) + ' °F (heat)' },
    'Space Temperature Cooling Setpoint Input Active': { get: () => fmt(sp.cool) + ' °F' },
    'Space Temperature Heating Setpoint Input Active': { get: () => fmt(sp.heat) + ' °F' },
    'Discharge Air Cooling Setpoint (Target) - Active': { get: () => fmt(st.dischargeAirCoolingSetpoint) + ' °F' },
    'Discharge Air Temperature Maximum Cool Limit - Active': { get: () => fmt(st.datMaxCoolLimit) + ' °F' },
    'Discharge Air Temperature Minimum Cool Limit - Active': { get: () => fmt(st.datMinCoolLimit) + ' °F' },
    'Heat Cool Mode Request - Active': { get: () => st.heatCoolModeRequest },
    'Heat Pump Heating Lockout Setpoint - Active': { get: () => fmt(st.hpHeatingLockoutSetpoint, 0) + ' °F' },
    'Heat Lockout Command - Active': { get: () => st.heatLockoutCommand },
    'Heat Primary Enable BAS - Active': { get: () => st.heatPrimaryEnableBAS + '%' },
    'Occupancy Request Active': { get: () => st.occupancyRequest },
    'Cooling Capacity Enable - Active': { get: () => st.coolingCapacityEnable + '%' },
    'Cooling Lockout BAS - Active': { get: () => st.coolingLockoutBAS },
    'Supply Fan Maximum Speed Setpoint - Active': { get: () => st.fanMaxSpeed + '%' },
    'Supply Fan Minimum Speed Setpoint - Active': { get: () => st.fanMinSpeed + '%' },
    'Supply Fan Speed Command - Active': { get: () => st.fanSpeedCommand + '%' },
    'Supply Fan Speed Command Enable - Active': { get: () => st.fanSpeedCommandEnable },
    'Filter Runtime Hours Setpoint - Active': { get: () => fmt(st.filterRuntimeHoursSetpoint, 0) + ' h' },
    'VVZT DAT Control Mode – Active': { get: () => st.vvztDATControlMode },
    'Demand Limit Request - Active': { get: () => 'Not Limited' },
    'Emergency Override BAS - Active': { get: () => st.emergencyOverrideBAS },
    'Occupied Standby Cooling Setpoint BAS - Active': { get: () => fmt(st.occupiedStandbyCooling) + ' °F' },
    'Occupied Standby Heating Setpoint BAS - Active': { get: () => fmt(st.occupiedStandbyHeating) + ' °F' },
    'Demand Shed Offset Setpoint - Active': { get: () => st.demandShedOffset + '%' },
    'Cooling Capacity Setpoint BAS - Active': { get: () => st.coolingCapacitySetpointBAS + '%' },
    'Heating Capacity Setpoint BAS - Active': { get: () => st.heatingCapacitySetpointBAS + '%' },
    'Supply Fan Configuration Status ': { get: () => st.supplyFanConfig },
    'Supply Air Tempering Enable - Active': { get: () => st.supplyAirTemperingEnable },
    'Cooling Demand Limit Capacity Enable Setpoint - Active': { get: () => st.coolingDemandLimitEnable + '%' },
    'Heating Demand Limit Capacity Enable Setpoint - Active': { get: () => st.heatingDemandLimitEnable + '%' },
    'Cooling Capacity Setpoint Enable BAS - Active': { get: () => st.coolingCapacitySetpointEnableBAS },
    'Heating Capacity Setpoint Enable BAS - Active': { get: () => st.heatingCapacitySetpointEnableBAS },
    'Supply Fan Maximum Output Signal - Active': { get: () => st.fanMaxSpeed + '%' },
    'Supply Fan Minimum Output Signal - Active': { get: () => st.fanMinSpeed + '%' }
  };
  if (B[name]) return B[name];

  /* Settings bindings — editable */
  const SB = SETTINGS_BIND[name];
  if (SB && sectionKey.startsWith('settings')) {
    return { edit: true, get: () => SB.display ? SB.display() : String(S.settings[SB.key]) };
  }
  if (SB && sectionKey.startsWith('service/test')) {
    return { edit: true, get: () => String(S.settings[SB.key]) };
  }
  if (CONFIG_BIND[name] && sectionKey === 'utilities/editConfiguration') {
    return { edit: true, get: () => String(S.config[CONFIG_BIND[name].key]) };
  }
  if (CONFIG_BIND[name] && sectionKey === 'utilities/activeConfiguration') {
    const k = CONFIG_BIND[name].key;
    const label = { systemType: 'System Type', spaceController: 'Space Controller', indoorFanType: 'Indoor Fan Type', refrigerationSystem: 'Refrigeration System', refrigerant: 'Refrigerant', circuits: 'Refrigeration Circuit', evaporatorDefrost: 'Evaporator Defrost', primaryHeatingSource: 'Primary Heating Source', frostat: 'Frostat', humiditySensor: 'Humidity Sensor', co2Sensor: 'CO2 Sensor', dischargeTempSensor: 'Discharge Temperature Sensor', externalAutoStop: 'External Auto / Stop', ventilationOverride: 'Ventilation Override', alarmIndicator: 'Alarm Indicator', demandManagement: 'Demand Management', supplyAirTempering: 'Supply Air Tempering', tonnage: 'Tonnage', voltage: 'Voltage', primaryHeatingStages: 'Primary Heating Stages', secondaryHeatingSource: 'Secondary Heating Source' }[k];
    if (label) return { get: () => String(S.config[k]) };
  }
  if (sectionKey === 'service/optionsModules') return { get: () => name.includes('Communication') ? 'OK' : '—' };
  if (sectionKey === 'service/modbus') return { get: () => S.faults.fanVFD ? 'Lost' : 'OK', cls2: () => 'vl ' + (S.faults.fanVFD ? 'alarm' : 'on') };
  if (sectionKey === 'utilities/about') return { get: () => 'v4.2.1 (simulator)' };
  if (sectionKey === 'utilities/display') return {
    edit: true, get: () => name === 'Backlight Timeout' ? st.backlightTimeout + ' s' : name === 'Display Units' ? '°' + st.displayUnits : String(st.scrollingSpeed)
  };
  if (sectionKey === 'utilities/dateTime') return { get: () => name === 'Current Time' ? new Date().toLocaleTimeString() : 'Eastern (America/New_York)' };
  if (sectionKey === 'utilities/lon') return { act: 'SEND', note: 'Service Pin message (manual p.163)' };
  return { get: () => '—' };
}
function tstatB(k) { return { get: () => onoff(S.tstat[k]), cls2: () => 'vl ' + (S.tstat[k] ? 'on' : 'off') }; }
function cmdB(i) { return { get: () => onoff(S.comps[i].cmd), cls2: () => 'vl ' + (S.comps[i].cmd ? 'on' : 'off') }; }
function provB(i) { return { get: () => S.comps[i].cmd ? (S.comps[i].prove ? 'Closed' : 'OPEN (ALARM)') : (S.comps[i].prove ? 'Closed' : 'Open'), cls2: () => 'vl ' + (S.comps[i].cmd && !S.comps[i].prove ? 'alarm' : 'on') }; }
function fanB(i) { return { get: () => onoff(S.condFans[i].cmd), cls2: () => 'vl ' + (S.condFans[i].cmd ? 'on' : 'off') }; }
function ehB(i) { return { get: () => onoff(S.eheat[i].cmd), cls2: () => 'vl ' + (S.eheat[i].cmd ? 'warn' : 'off') }; }
function svB(i) { return { get: () => S.switchValves[i] ? 'Cooling' : 'Heating' }; }
function defB(i) { return { get: () => S.defrost[i].active ? 'ACTIVE' : 'Inactive', cls2: () => 'vl ' + (S.defrost[i].active ? 'warn' : 'off') }; }

/* ---------------- settings bindings (editable) ---------------- */
const SETTINGS_BIND = {
  'Heat Cool Mode Request': { key: 'heatCoolModeRequest', type: 'enum', opts: ['Auto', 'Heat', 'Cool'] },
  'Occupancy Request': { key: 'occupancyRequest', type: 'enum', opts: ['Auto', 'Occupied', 'Unoccupied'] },
  'Occupied Bypass Time': { key: 'occupiedBypassTime', type: 'num', min: 0, max: 999, step: 1, unit: ' min' },
  'Occupied Standby Cooling Setpoint BAS': { key: 'occupiedStandbyCooling', type: 'num', min: 50, max: 99, step: 1, unit: ' °F' },
  'Occupied Standby Heating Setpoint BAS': { key: 'occupiedStandbyHeating', type: 'num', min: 55, max: 80, step: 1, unit: ' °F' },
  'Occupied Standby Offset': { key: 'occupiedStandbyHeating', type: 'num', min: 0, max: 10, step: 1, unit: ' °F', display: () => '2 °F' },
  'Space Cooling Setpoint High Limit BAS': { key: 'coolHighLimit', type: 'num', min: 60, max: 99, step: 1, unit: ' °F' },
  'Space Cooling Setpoint Low Limit BAS': { key: 'coolLowLimit', type: 'num', min: 45, max: 70, step: 1, unit: ' °F' },
  'Space Heating Setpoint High Limit BAS': { key: 'heatHighLimit', type: 'num', min: 60, max: 95, step: 1, unit: ' °F' },
  'Space Heating Setpoint Low Limit BAS': { key: 'heatLowLimit', type: 'num', min: 40, max: 75, step: 1, unit: ' °F' },
  'Supply Fan Configuration Command': { key: 'supplyFanConfig', type: 'enum', opts: ['Continuous', 'Cycling'] },
  'Timed Override Request': { key: 'timedOverrideRequest', type: 'enum', opts: ['Idle', 'Active'] },
  'Unit Stop Command': { key: 'unitStopCommand', type: 'enum', opts: ['Auto', 'Stop'] },
  'Unoccupied Cooling Setpoint': { key: 'unoccupiedCooling', type: 'num', min: 70, max: 99, step: 1, unit: ' °F' },
  'Unoccupied Heating Setpoint': { key: 'unoccupiedHeating', type: 'num', min: 45, max: 75, step: 1, unit: ' °F' },
  'VVZT DAT Control Mode': { key: 'vvztDATControlMode', type: 'enum', opts: ['Auto', 'Manual'] },
  'Emergency Override BAS': { key: 'emergencyOverrideBAS', type: 'enum', opts: ['Normal', 'Pressurize', 'Depressurize', 'Purge', 'Shutdown'] },
  'Arbitration Method Request': { key: 'arbitrationMethodRequest', type: 'enum', opts: ['Standalone Control', 'Enable External / BAS Control'] },
  'Demand Shed Offset Setpoint': { key: 'demandShedOffset', type: 'num', min: 0, max: 100, step: 1, unit: '%' },
  'Filter Runtime Hours Setpoint': { key: 'filterRuntimeHoursSetpoint', type: 'num', min: 0, max: 20000, step: 100, unit: ' h' },
  'Supply Fan Maximum Speed Setpoint': { key: 'fanMaxSpeed', type: 'num', min: 67, max: 100, step: 1, unit: '%' },
  'Supply Fan Minimum Speed Setpoint': { key: 'fanMinSpeed', type: 'num', min: 0, max: 100, step: 1, unit: '%' },
  'Supply Fan Speed Command': { key: 'fanSpeedCommand', type: 'num', min: 0, max: 100, step: 1, unit: '%' },
  'Supply Fan Speed Command Enable': { key: 'fanSpeedCommandEnable', type: 'enum', opts: ['Enabled', 'Disabled'] },
  'Compressor Cooling P-Gain (%/F)': { key: 'compressorCoolingPGain', type: 'num', min: 1, max: 200, step: 1, unit: '%' },
  'Compressor Cooling P-Gain - 1 (%/F)': { key: 'compressorCoolingPGain', type: 'num', min: 1, max: 200, step: 1, unit: '%' },
  'Compressor Cooling P-Gain - 2 (%/F)': { key: 'compressorCoolingPGain', type: 'num', min: 1, max: 200, step: 1, unit: '%' },
  'Compressor Cooling Reset Time (seconds)': { key: 'compressorCoolingResetTime', type: 'num', min: 10, max: 5000, step: 10, unit: ' s' },
  'Compressor Cooling Reset Time - 1 (seconds)': { key: 'compressorCoolingResetTime', type: 'num', min: 10, max: 5000, step: 10, unit: ' s' },
  'Compressor Cooling Reset Time - 2 (seconds)': { key: 'compressorCoolingResetTime', type: 'num', min: 10, max: 5000, step: 10, unit: ' s' },
  'Cooling Capacity Enable': { key: 'coolingCapacityEnable', type: 'num', min: 0, max: 100, step: 1, unit: '%' },
  'Cooling Capacity Setpoint BAS': { key: 'coolingCapacitySetpointBAS', type: 'num', min: 0, max: 100, step: 1, unit: '%' },
  'Cooling Capacity Setpoint Enable BAS': { key: 'coolingCapacitySetpointEnableBAS', type: 'enum', opts: ['Enabled', 'Disabled'] },
  'Cooling Demand Limit Capacity Enable Setpoint': { key: 'coolingDemandLimitEnable', type: 'num', min: 0, max: 100, step: 1, unit: '%' },
  'Cooling Lockout BAS': { key: 'coolingLockoutBAS', type: 'enum', opts: ['Normal', 'Locked out'] },
  'Discharge Air Cooling Setpoint (Target)': { key: 'dischargeAirCoolingSetpoint', type: 'num', min: 40, max: 70, step: 1, unit: ' °F' },
  'Discharge Air Temperature Maximum Cool Limit': { key: 'datMaxCoolLimit', type: 'num', min: 80, max: 130, step: 1, unit: ' °F' },
  'Discharge Air Temperature Minimum Cool Limit': { key: 'datMinCoolLimit', type: 'num', min: 40, max: 70, step: 1, unit: ' °F' },
  'Auxiliary Heating P-Gain (%/F)': { key: 'auxHeatingPGain', type: 'num', min: 1, max: 200, step: 1, unit: '%' },
  'Auxiliary Heating Reset Time (seconds)': { key: 'auxHeatingResetTime', type: 'num', min: 10, max: 5000, step: 10, unit: ' s' },
  'Heat Lockout Command': { key: 'heatLockoutCommand', type: 'enum', opts: ['Normal', 'Locked out'] },
  'Heat Primary Enable BAS': { key: 'heatPrimaryEnableBAS', type: 'num', min: 0, max: 100, step: 1, unit: '%' },
  'Heat Pump Heating Lockout Setpoint': { key: 'hpHeatingLockoutSetpoint', type: 'num', min: -40, max: 50, step: 1, unit: ' °F' },
  'Heating Capacity Setpoint BAS': { key: 'heatingCapacitySetpointBAS', type: 'num', min: 0, max: 100, step: 1, unit: '%' },
  'Heating Capacity Setpoint Enable BAS': { key: 'heatingCapacitySetpointEnableBAS', type: 'enum', opts: ['Enabled', 'Disabled'] },
  'Heating Demand Limit Capacity Enable Setpoint': { key: 'heatingDemandLimitEnable', type: 'num', min: 0, max: 100, step: 1, unit: '%' },
  'Supply Air Tempering Enable': { key: 'supplyAirTemperingEnable', type: 'enum', opts: ['Enable', 'Disable'] },
  'Service Test Timeout (Minutes)': { key: 'serviceTestTimeout', type: 'num', min: 5, max: 480, step: 5, unit: ' min' }
};

/* ---------------- configuration bindings (Utilities > Edit Configuration, p.162) ---------------- */
const CONFIG_BIND = {
  'System Type - CVZT, VVZT': { key: 'systemType', opts: ['CVZT', 'VVZT'] },
  'Space Controller - Conventional TSTAT, Single Setpoint Zone Sensor, Dual Setpoint Zone Sensor': { key: 'spaceController', opts: ['Conventional TSTAT', 'Single Setpoint Zone Sensor', 'Dual Setpoint Zone Sensor'] },
  'Indoor Fan Type – CV - Single Speed, Multi Speed, VV – Variable Speed': { key: 'indoorFanType', opts: ['Single Speed', 'Multi Speed', 'Variable Speed'] },
  'Refrigeration System - Cooling Only, Heat Pump': { key: 'refrigerationSystem', opts: ['Cooling Only', 'Heat Pump'] },
  'Refrigerant - R22, R410A': { key: 'refrigerant', opts: ['R22', 'R410A'] },
  'Tonnage - R-22 - 7.5, 10, 15, 20, R-410A - 6, 6.25, 7.5, 8.33, 10, 12.5, 15, 20 (+25 for TTA)': { key: 'tonnage', opts: ['6', '6.25', '7.5', '8.33', '10', '12.5', '15', '20', '25'] },
  'Refrigeration Circuit - Single, Dual': { key: 'circuits', opts: ['Single', 'Dual'] },
  'Voltage - 208/230 -60, 380/415-50, 380/60, 460/60, 575/60': { key: 'voltage', opts: ['208/230-60', '380/415-50', '380/60', '460/60', '575/60'] },
  'Efficiency - Standard,': { key: 'efficiency', opts: ['Standard'] },
  'Evaporator Defrost - Installed, Not Installed': { key: 'evaporatorDefrost', opts: ['Installed', 'Not Installed'] },
  'Primary Heating Source - Not Installed, Electric, Heat Pump': { key: 'primaryHeatingSource', opts: ['Not Installed', 'Electric', 'Heat Pump'] },
  'Primary Heating Type - Staged': { key: 'primaryHeatingType', opts: ['Staged'] },
  'Primary Heating Stages - 1, 2': { key: 'primaryHeatingStages', opts: ['1', '2'] },
  'Secondary Heating Type - Not Installed, Electric': { key: 'secondaryHeatingSource', opts: ['Not Installed', 'Electric'] },
  'Frostat - Installed, Not Installed': { key: 'frostat', opts: ['Installed', 'Not Installed'] },
  'Humidity Sensor - Installed, Not Installed': { key: 'humiditySensor', opts: ['Installed', 'Not Installed'] },
  'CO2 Sensor - Installed, Not Installed': { key: 'co2Sensor', opts: ['Installed', 'Not Installed'] },
  'Discharge Temp Sensor - Installed, Not Installed': { key: 'dischargeTempSensor', opts: ['Installed', 'Not Installed'] },
  'External Auto Stop - Installed, Not Installed': { key: 'externalAutoStop', opts: ['Installed', 'Not Installed'] },
  'Ventilation Override - Installed, Not Installed': { key: 'ventilationOverride', opts: ['Installed', 'Not Installed'] },
  'Alarm Indicator - Installed, Not Installed': { key: 'alarmIndicator', opts: ['Installed', 'Not Installed'] },
  'Demand Management - None, Demand Limit, Demand Shed': { key: 'demandManagement', opts: ['None', 'Demand Limit', 'Demand Shed'] },
  'Supply Air Tempering - Disabled': { key: 'supplyAirTempering', opts: ['Disabled', 'Enabled'] }
};

/* ---------------- HOME screen ---------------- */
function scrHome(r, view) {
  const sp = setpoints();
  const t = S.tstat;
  const alarmCount = S.alarms.length;
  let html = crumb(['Home']);
  html += `
  <div class="card">
    <div class="hd"><span class="n">Unit Status</span>${manualPill(150, 'HOME')}</div>
    <div class="hero"><div><div class="lbl">Space Temperature Active</div><div class="big" id="hSpace">${fmt(S.spaceTemp)}<span class="unit">°F</span></div></div>
    <div><div class="lbl">Mode</div><div class="big" id="hMode" style="font-size:22px;padding-top:12px">${esc(S.mode)}</div></div></div>
    <div class="tiles">
      <div class="tile"><div class="k">Cooling Setpoint</div><div class="v">${fmt(sp.cool)}<small> °F</small></div></div>
      <div class="tile"><div class="k">Heating Setpoint</div><div class="v">${fmt(sp.heat)}<small> °F</small></div></div>
      <div class="tile"><div class="k">Outdoor Air Temp</div><div class="v" id="hOat">${fmt(S.oat)}<small> °F</small></div></div>
      <div class="tile"><div class="k">Active Alarms</div><div class="v" id="hAl" style="color:${alarmCount ? 'var(--red)' : 'var(--green)'}">${alarmCount}</div></div>
    </div>
  </div>
  <div class="card">
    <div class="hd"><span class="n">Thermostat Inputs</span>${manualPill(150, 'Thermostat Y1 Input')}</div>
    <div class="leds">
      ${led('G', 'g')}${led('Y1', 'y1')}${led('Y2', 'y2')}${led('W1/O', 'w1')}${led('W2', 'w2')}${led('X2', 'x2')}
    </div>
  </div>
  <div class="card">
    <div class="hd"><span class="n">Capacity & Fans</span>${manualPill(150, 'Cooling Capacity Status %')}</div>
    <div class="kv"><span class="k">Cooling Capacity Status %</span><span class="v" id="hCap">0%</span></div>
    <div class="kv"><span class="k">Supply Fan Speed Status</span><span class="v" id="hFan">0%</span></div>
    <div class="kv"><span class="k">Compressor 1 Command / Proving</span><span class="v" id="hC1">Off</span></div>
    <div class="kv"><span class="k">Compressor 2 Command / Proving</span><span class="v" id="hC2">Off</span></div>
    <div class="kv"><span class="k">Electric Heat Stage 1 / 2</span><span class="v" id="hEH">Off / Off</span></div>
    <div class="kv"><span class="k">Defrost Status (Ckt 1 / Ckt 2)</span><span class="v" id="hDF">—</span></div>
  </div>
  <div class="card">
    <div class="hd"><span class="n">Menus</span>${manualPill(148, 'Symbio 700 UC Onboard User Interface Menu Structure')}</div>
    <div class="row" data-go="status"><span class="nm">Status — Active Setpoints, System, Indoor, Refrigeration, Heat</span><span class="vl">›</span></div>
    <div class="row" data-go="settings"><span class="nm">Settings — System, Indoor, Refrigeration, Heat</span><span class="vl">›</span></div>
    <div class="row" data-go="service"><span class="nm">Service — Diagnostics, Test, Statistics Reset, Options Modules, Modbus</span><span class="vl">›</span></div>
    <div class="row" data-go="alarms"><span class="nm">Alarms — Critical, Service Required, Advisory, Information</span><span class="vl">›</span></div>
    <div class="row" data-go="utilities"><span class="nm">Utilities — About, Config, Display, Date and Time, LON</span><span class="vl">›</span></div>
    <div class="row" data-go="bluetooth"><span class="nm">Bluetooth — wake radio & pair the phone app</span><span class="vl">›</span></div>
  </div>`;
  view.innerHTML = html;
  uiUpdaters.push(updateHome);
  bindCommon(view);
}
function led(label, key) {
  return `<div class="led"><div class="k">${label}</div><div class="v" id="led_${key}">—</div></div>`;
}
function updateHome() {
  const sp = setpoints();
  const set = (id, v, cls) => { const el = $(id); if (el) { el.textContent = v; if (cls !== undefined) el.className = 'v ' + cls; } };
  set('#hSpace', fmt(S.spaceTemp) + '°F');
  set('#hOat', fmt(S.oat) + '°F');
  set('#hAl', String(S.alarms.length), S.alarms.length ? '' : '');
  const el = $('#hAl'); if (el) el.style.color = S.alarms.length ? 'var(--red)' : 'var(--green)';
  const m = $('#hMode'); if (m) m.textContent = S.mode;
  for (const k of ['g', 'y1', 'y2', 'w1', 'w2', 'x2']) {
    const e = $('#led_' + k); if (e) { e.textContent = S.tstat[k] ? 'ON' : 'off'; e.className = 'v ' + (S.tstat[k] ? 'on' : 'off'); }
  }
  set('#hCap', (S.config.systemType === 'VVZT' ? fmt(S.capacityPct, 0) : fmt(S.coolStage / 2 * 100, 0)) + '%');
  set('#hFan', fmt(S.supplyFan.speed, 0) + '%');
  set('#hC1', (S.comps[0].cmd ? 'On' : 'Off') + ' / ' + (S.comps[0].prove ? 'Closed' : 'OPEN'));
  set('#hC2', (S.comps[1].cmd ? 'On' : 'Off') + ' / ' + (S.comps[1].prove ? 'Closed' : 'OPEN'));
  set('#hEH', (S.eheat[0].cmd ? 'On' : 'Off') + ' / ' + (S.eheat[1].cmd ? 'On' : 'Off'));
  set('#hDF', (S.defrost[0].active ? 'ACTIVE' : '—') + ' / ' + (S.defrost[1].active ? 'ACTIVE' : '—'));
}
function computeMode() {
  // drive S.mode for display
  if (S.settings.serviceTestStateRequest !== 'Inactive') S.mode = 'Test: ' + S.settings.serviceTestStateRequest;
  else if (S.settings.unitStopCommand === 'Stop') S.mode = 'Stopped';
  else if (S.hpLockout) S.mode = 'Heat (HP Lockout)';
  else if (S.defrost.some(d => d.active)) S.mode = 'Defrost';
  else if (S.eheat.some(e => e.cmd)) S.mode = 'Heat';
  else if (S.comps.some(c => c.cmd) && S.tstat.y1) S.mode = 'Cool';
  else if (S.comps.some(c => c.cmd) && S.tstat.w1) S.mode = 'Heat';
  else S.mode = 'Idle';
}

/* ---------------- Alarms screen (manual p.129) ---------------- */
function scrAlarms(r, view) {
  let html = crumb(['Home', 'Alarms']);
  html += `<div class="card"><div class="hd"><span class="n">ALARMS</span>${manualPill(129, 'ALARMS')}</div>
  <div class="note" style="border:none">Categories: Critical, Service Required, Advisory, Information (manual p.129). You can clear the Alarm History in TU.</div>`;
  const cats = [['crit', 'Critical'], ['svc', 'Service Required'], ['adv', 'Advisory'], ['info', 'Information']];
  for (const [k, label] of cats) {
    const list = S.alarms.filter(a => a.cat === k);
    html += `<div class="row" style="cursor:default"><span class="nm"><b>${label}</b> <span style="color:var(--dim)">(${list.length})</span></span></div>`;
    if (!list.length) html += `<div class="empty" style="padding:6px 14px 12px">No active ${label.toLowerCase()} alarms</div>`;
    for (const a of list) {
      html += `<div class="alarm ${k}"><div class="an">${esc(a.name)}</div><div class="ad">${esc(a.detail)}</div>
      <div class="at">Active for ${hhmmss(S.simTime - a.since)} · <span class="pill" data-manual="${a.page}" data-q="${esc(a.name)}">📖 manual p.${a.page}</span></div></div>`;
    }
  }
  html += `<div class="btnrow"><button class="btn" id="btnDiagReset">Reset Diagnostic</button><button class="btn sec" id="btnClearHist">Clear Alarm History</button></div></div>`;
  html += `<div class="card"><div class="hd"><span class="n">Alarm History</span>${manualPill(129, 'ALARMS')}</div><div id="histList">`;
  if (!S.alarmHistory.length) html += '<div class="empty">History is empty</div>';
  for (const h of S.alarmHistory.slice(-25).reverse()) {
    html += `<div class="kv"><span class="k">${esc(h.name)}<br><span style="color:var(--dim)">${ALARM_CATS[h.cat]} · cleared by ${esc(h.how)}</span></span><span class="v">${hhmmss(h.since)} → ${hhmmss(h.until)}</span></div>`;
  }
  html += '</div></div>';
  view.innerHTML = html;
  const bd = $('#btnDiagReset'); if (bd) bd.onclick = () => { diagnosticReset(); render(); };
  const bc = $('#btnClearHist'); if (bc) bc.onclick = () => { S.alarmHistory = []; toast('Alarm History cleared (done in TU — manual p.101, p.129)'); render(); };
  uiUpdaters.push(() => {});
  bindCommon(view);
}

/* ---------------- Bluetooth screen (manual p.103, p.106-107) ---------------- */
S.ble = { state: 'off', passkey: null };
function scrBluetooth(r, view) {
  let html = crumb(['Home', 'Bluetooth']);
  html += `<div class="card"><div class="hd"><span class="n">Bluetooth</span>${manualPill(106, 'Bluetooth Connection & Pairing')}</div>
  <div class="note" style="border:none">The BLE radio is OFF unless woken by the Bluetooth button (manual p.106). Pairing validates a common 6-digit passkey on the controller and the phone.</div>
  <div class="kv"><span class="k">Bluetooth LED</span><span class="v" id="bleLed">${S.ble.state === 'paired' ? 'Solid ON' : S.ble.state === 'advertising' ? 'Flashing' : 'OFF'}</span></div>
  <div class="kv"><span class="k">BLE Radio</span><span class="v" id="bleState">${S.ble.state === 'off' ? 'OFF' : S.ble.state === 'advertising' ? 'Awake — waiting to pair' : 'Connected (Trane-<serial>)'}</span></div>
  <div id="bleExtra">`;
  if (S.ble.state === 'advertising') {
    html += `<div class="kv"><span class="k">Passkey (shown on both devices)</span><span class="v">${S.ble.passkey}</span></div>
    <div class="btnrow"><button class="btn" id="blePair">Pair (Enter on controller)</button></div>`;
  }
  if (S.ble.state === 'paired') {
    html += `<div class="btnrow"><button class="btn sec" id="bleDisc">Disconnect</button></div>`;
  }
  html += `</div><div class="btnrow">`;
  if (S.ble.state === 'off') html += `<button class="btn" id="bleWake">Wake BLE Radio (Bluetooth button)</button>`;
  html += `</div></div>
  <div class="card"><div class="hd"><span class="n">Connection Requirements</span>${manualPill(106, 'Connection Requirements')}</div>
  <div class="kv"><span class="k">Radio</span><span class="v">Bluetooth 5.0 (BLE 4.2+ required)</span></div>
  <div class="kv"><span class="k">Android</span><span class="v">V5.0 Lollipop or later</span></div>
  <div class="kv"><span class="k">Apple iOS</span><span class="v">iOS 10; iPhone 6 or newer</span></div>
  <div class="kv"><span class="k">Max devices</span><span class="v">10 in Bluetooth device list</span></div></div>`;
  view.innerHTML = html;
  const w = $('#bleWake'); if (w) w.onclick = () => {
    S.ble.state = 'advertising';
    S.ble.passkey = String(Math.floor(100000 + Math.random() * 900000));
    toast('BLE radio awake — LED flashing (manual p.106)');
    render();
  };
  const p = $('#blePair'); if (p) p.onclick = () => {
    S.ble.state = 'paired';
    toast('Passkey validated — secure connection established (manual p.106)');
    render();
  };
  const d = $('#bleDisc'); if (d) d.onclick = () => { S.ble.state = 'off'; render(); };
  bindCommon(view);
}

/* ---------------- Trainer screen (simulator controls) ---------------- */
const FAULTS = [
  ['prov1', 'Compressor 1 Proving stuck OPEN at startup', 34, 'Startup with proving open → Proving Lockout (manual-reset) after 5 s.'],
  ['prov1b', 'Compressor 1 Proving opens after 30 s of run', 34, 'Proving Trip: circuit off, 15-min disable, 4 trips → Proving Lockout.'],
  ['prov2', 'Compressor 2 Proving stuck OPEN at startup', 34, 'Same behavior on circuit 2.'],
  ['weld1', 'Compressor 1 Contactor welded CLOSED', 34, 'Proving active with no command → Contactor Failure (manual reset) after 5 s.'],
  ['weld2', 'Compressor 2 Contactor welded CLOSED', 34, 'Same behavior on circuit 2.'],
  ['lpc1', 'Circuit 1 LPC switch OPEN', 35, 'LPC Trip after bypass delay (60 s <40°F, 30 s 40–50°F, 0 s ≥50°F); 3-min disable; 4 trips → Low Pressure Lockout.'],
  ['lpc2', 'Circuit 2 LPC switch OPEN', 35, 'Same behavior on circuit 2.'],
  ['hpc1', 'Circuit 1 HPC switch OPEN', 34, 'High pressure cutout → immediate shutdown, manual-reset lockout.'],
  ['hpc2', 'Circuit 2 HPC switch OPEN', 34, 'Same behavior on circuit 2.'],
  ['oatSensor', 'Outdoor Air Temperature sensor failure', 57, 'Defrost reverts to Default Mode (5-min defrost per 30 min of heating); HP Heating Lockout disabled (p.55).'],
  ['coilSensor1', 'Coil Temperature Sensor 1 failure', 57, 'Defrost reverts to Default Mode when paired with OAT sensor logic.'],
  ['coilSensor2', 'Coil Temperature Sensor 2 failure', 57, 'Independent-circuit defrost falls back per sensor state.'],
  ['phaseMonitor', 'Phase Monitor failure', 51, 'Critical alarm — unit will not run.'],
  ['fanVFD', 'Supply Fan VFD communication lost', 95, 'Supply Fan Failure diagnostic.']
];
function scrTrainer(r, view) {
  let html = crumb(['Home', 'Simulator Controls']);
  html += `<div class="card"><div class="hd"><span class="n">Environment</span><span class="sub">simulator-only</span></div>
  <div class="row" style="cursor:default"><span class="nm">Outdoor Air Temperature <span class="vl" id="trOatV">${fmt(S.oat)}°F</span></span></div>
  <div style="padding:2px 14px 12px"><input type="range" id="trOat" min="-20" max="110" step="1" value="${S.oat}"></div>
  <div class="row" style="cursor:default"><span class="nm">Indoor Load <span class="vl" id="trLoadV">${S.loadF >= 0 ? '+' : ''}${fmt(S.loadF) }°F/hr</span></span></div>
  <div style="padding:2px 14px 12px"><input type="range" id="trLoad" min="-6" max="6" step="0.5" value="${S.loadF}"></div>
  <div class="row" style="cursor:default"><span class="nm">Space Temperature (override)</span></div>
  <div style="padding:2px 14px 12px"><input type="range" id="trSpace" min="50" max="95" step="0.5" value="${S.spaceTemp}"></div>
  <div class="row" style="cursor:default"><span class="nm">Sim Speed</span><span class="vl" id="trSpd">${S.speed}x</span></div>
  <div class="btnrow" style="padding-top:4px">
    <button class="btn sec sm" data-spd="1">1x</button><button class="btn sec sm" data-spd="5">5x</button>
    <button class="btn sec sm" data-spd="30">30x</button><button class="btn sec sm" data-spd="120">120x</button>
  </div>
  <div class="row" style="cursor:default"><span class="nm">Power</span><span class="switch ${S.power ? 'on' : ''}" id="trPower"></span></div>
  <div class="row" style="cursor:default"><span class="nm">Occupancy</span><span class="vl edit" id="trOcc">${S.occupancy}</span></div>
  </div>`;
  html += `<div class="card"><div class="hd"><span class="n">Fault Injection</span><span class="sub">watch the manual’s diagnostics play out</span></div>`;
  for (const [key, label, page, desc] of FAULTS) {
    const on = !!S.faults[key];
    html += `<div class="row" style="cursor:default"><span class="nm">${esc(label)}<span class="note">${esc(desc)}</span></span>
      <span class="switch ${on ? 'on' : ''}" data-fault="${key}"></span>${manualPill(page, label.split(' ').slice(0, 2).join(' '))}</div>`;
  }
  html += `</div>`;
  html += `<div class="card"><div class="hd"><span class="n">Reset</span></div>
  <div class="btnrow"><button class="btn sec" id="trResetAll">Clear all faults & alarms</button></div></div>`;
  view.innerHTML = html;
  const oatEl = $('#trOat');
  if (oatEl) oatEl.oninput = () => { S.oat = +oatEl.value; $('#trOatV').textContent = fmt(S.oat) + '°F'; };
  const loadEl = $('#trLoad');
  if (loadEl) loadEl.oninput = () => { S.loadF = +loadEl.value; $('#trLoadV').textContent = (S.loadF >= 0 ? '+' : '') + fmt(S.loadF) + '°F/hr'; };
  const spEl = $('#trSpace');
  if (spEl) spEl.oninput = () => { S.spaceTemp = +spEl.value; };
  view.querySelectorAll('[data-spd]').forEach(b => b.onclick = () => { S.speed = +b.dataset.spd; $('#trSpd').textContent = S.speed + 'x'; });
  const pw = $('#trPower'); if (pw) pw.onclick = () => { S.power = !S.power; pw.classList.toggle('on', S.power); };
  const oc = $('#trOcc'); if (oc) oc.onclick = () => { S.occupancy = S.occupancy === 'Occupied' ? 'Unoccupied' : 'Occupied'; oc.textContent = S.occupancy; };
  view.querySelectorAll('[data-fault]').forEach(sw => sw.onclick = () => {
    const k = sw.dataset.fault;
    S.faults[k] = !S.faults[k];
    sw.classList.toggle('on', S.faults[k]);
  });
  const ra = $('#trResetAll'); if (ra) ra.onclick = () => {
    for (const k in S.faults) S.faults[k] = false;
    diagnosticReset();
    view.querySelectorAll('[data-fault]').forEach(s => s.classList.remove('on'));
    render();
  };
  bindCommon(view);
}

/* ---------------- dialogs ---------------- */
function openModal(html) {
  $('#modal').innerHTML = html;
  $('#modalbg').classList.add('show');
}
function closeModal() { $('#modalbg').classList.remove('show'); }
function editSetting(name) {
  const sb = SETTINGS_BIND[name];
  if (!sb) return;
  if (sb.type === 'enum') {
    openModal(`<div class="mh">${esc(name)}</div><div class="ms">Select a value (manual p.121-123)</div>
      ${sb.opts.map(o => `<div class="row" data-setval="${esc(o)}"><span class="nm">${esc(o)}</span>${S.settings[sb.key] === o ? '<span class="vl on">●</span>' : ''}</div>`).join('')}
      <div class="btnrow"><button class="btn sec" onclick="closeModal()">Cancel</button></div>`);
    $('#modal').querySelectorAll('[data-setval]').forEach(r => r.onclick = () => {
      S.settings[sb.key] = r.dataset.setval;
      if (sb.key === 'serviceTestStateRequest' && r.dataset.setval !== 'Inactive') S.test.startedAt = S.simTime;
      saveState(); closeModal(); render();
    });
  } else {
    openModal(`<div class="mh">${esc(name)}</div><div class="ms">Range ${sb.min}–${sb.max}${sb.unit || ''}</div>
      <input type="number" id="numIn" value="${S.settings[sb.key]}" min="${sb.min}" max="${sb.max}" step="${sb.step}">
      <div class="btnrow"><button class="btn" id="numOk">Save</button><button class="btn sec" onclick="closeModal()">Cancel</button></div>`);
    $('#numOk').onclick = () => {
      const v = clamp(+$('#numIn').value || 0, sb.min, sb.max);
      S.settings[sb.key] = v; saveState(); closeModal(); render();
    };
  }
}
function editConfig(name) {
  const cb = CONFIG_BIND[name];
  if (!cb) return;
  openModal(`<div class="mh">${esc(name.split(' - ')[0])}</div><div class="ms">Edit Configuration (manual p.162) — changing values reconfigures the simulated unit</div>
    ${cb.opts.map(o => `<div class="row" data-setcfg="${esc(o)}"><span class="nm">${esc(o)}</span>${S.config[cb.key] === o ? '<span class="vl on">●</span>' : ''}</div>`).join('')}
    <div class="btnrow"><button class="btn sec" onclick="closeModal()">Cancel</button></div>`);
  $('#modal').querySelectorAll('[data-setcfg]').forEach(r => r.onclick = () => {
    S.config[cb.key] = r.dataset.setcfg;
    saveState(); closeModal(); render();
    toast('Configuration updated — Active Configuration (manual p.161)');
  });
}
function editDisplay(name) {
  if (name === 'Display Units') {
    openModal(`<div class="mh">Display Units</div><div class="ms">Utilities > Display (manual p.163)</div>
      <div class="row" data-du="F"><span class="nm">°F</span>${S.settings.displayUnits === 'F' ? '<span class="vl on">●</span>' : ''}</div>
      <div class="row" data-du="C"><span class="nm">°C</span>${S.settings.displayUnits === 'C' ? '<span class="vl on">●</span>' : ''}</div>`);
    $('#modal').querySelectorAll('[data-du]').forEach(r => r.onclick = () => { S.settings.displayUnits = r.dataset.du; closeModal(); render(); });
  } else if (name === 'Backlight Timeout') {
    openModal(`<div class="mh">Backlight Timeout</div><div class="ms">Utilities > Display (manual p.163)</div>
      <input type="number" id="numIn" value="${S.settings.backlightTimeout}" min="5" max="300">
      <div class="btnrow"><button class="btn" id="numOk">Save</button><button class="btn sec" onclick="closeModal()">Cancel</button></div>`);
    $('#numOk').onclick = () => { S.settings.backlightTimeout = clamp(+$('#numIn').value || 30, 5, 300); closeModal(); render(); };
  } else {
    openModal(`<div class="mh">Scrolling Speed</div><div class="ms">Lower # = faster scrolling (manual p.163)</div>
      <input type="number" id="numIn" value="${S.settings.scrollingSpeed}" min="1" max="10">
      <div class="btnrow"><button class="btn" id="numOk">Save</button><button class="btn sec" onclick="closeModal()">Cancel</button></div>`);
    $('#numOk').onclick = () => { S.settings.scrollingSpeed = clamp(+$('#numIn').value || 5, 1, 10); closeModal(); render(); };
  }
}

/* ---------------- common event binding ---------------- */
function bindCommon(view) {
  view.querySelectorAll('[data-go]').forEach(el => el.onclick = () => {
    const target = el.dataset.go;
    if (target.includes('/')) go('#/' + target);
    else go('#/' + target);
  });
  view.querySelectorAll('[data-manual]').forEach(el => el.onclick = e => {
    e.stopPropagation();
    openManual(+el.dataset.manual, el.dataset.q || '');
  });
  view.querySelectorAll('[data-edit]').forEach(el => el.onclick = () => {
    const name = el.dataset.edit, sec = el.dataset.sec;
    if (sec === 'utilities/editConfiguration') editConfig(name);
    else if (sec === 'utilities/display') editDisplay(name);
    else editSetting(name);
  });
  view.querySelectorAll('[data-act]').forEach(el => el.onclick = () => {
    const a = el.dataset.act;
    if (a === 'diagreset') { diagnosticReset(); render(); }
    else if (a === 'edittest') editSetting('Service Test State Request');
    else if (a === 'editperf') {
      openModal(`<div class="mh">Performance Test State Request</div><div class="ms">“Down Arrow to Service Test – DO NOT USE PREFORMANCE TEST!” — manual p.164</div>
        <div class="row" data-pv="Inactive"><span class="nm">Inactive</span>${S.settings.performanceTestStateRequest === 'Inactive' ? '<span class="vl on">●</span>' : ''}</div>
        <div class="row" data-pv="Active"><span class="nm">Active</span>${S.settings.performanceTestStateRequest === 'Active' ? '<span class="vl on">●</span>' : ''}</div>`);
      $('#modal').querySelectorAll('[data-pv]').forEach(r => r.onclick = () => {
        S.settings.performanceTestStateRequest = r.dataset.pv; closeModal(); render();
        if (r.dataset.pv === 'Active') toast('Performance Test active (educational simulation)');
      });
    }
    else if (a === 'edittestto') editSetting('Service Test Timeout (Minutes)');
    else if (a === 'statreset') {
      const name = el.dataset.name;
      openModal(`<div class="mh">${esc(name)}</div><div class="ms">Statistics Reset (manual p.160)</div>
        <div class="btnrow"><button class="btn" id="stOk">Reset</button><button class="btn sec" onclick="closeModal()">Cancel</button></div>`);
      $('#stOk').onclick = () => {
        const map = {
          'Compressor 1 Run Time Reset': () => { S.comps[0].rt = 0; S.stats.c1rt = 0; },
          'Compressor 1 Starts Reset': () => { S.comps[0].st = 0; S.stats.c1st = 0; },
          'Compressor 2 Run Time Reset': () => { S.comps[1].rt = 0; S.stats.c2rt = 0; },
          'Compressor 2 Starts Reset': () => { S.comps[1].st = 0; S.stats.c2st = 0; },
          'Condenser Fan 1 Run Time Reset': () => { S.condFans[0].rt = 0; S.stats.f1rt = 0; },
          'Condenser Fan 1 Starts Reset': () => { S.condFans[0].st = 0; S.stats.f1st = 0; },
          'Condenser Fan 2 Run Time Reset': () => { S.condFans[1].rt = 0; S.stats.f2rt = 0; },
          'Condenser Fan 2 Starts Reset': () => { S.condFans[1].st = 0; S.stats.f2st = 0; },
          'Electric Heat Stage 1 Run Time Reset': () => { S.eheat[0].rt = 0; S.stats.eh1rt = 0; },
          'Electric Heat Stage 1 Starts Reset': () => { S.eheat[0].st = 0; S.stats.eh1st = 0; },
          'Electric Heat Stage 2 Run Time Reset': () => { S.eheat[1].rt = 0; S.stats.eh2rt = 0; },
          'Electric Heat Stage 2 Starts Reset': () => { S.eheat[1].st = 0; S.stats.eh2st = 0; },
          'Filter Timer Reset': () => { S.filterHours = 0; clearAlarm('filter', 'Filter Timer Reset'); },
          'Supply Fan Run Time Reset': () => { S.supplyFan.rt = 0; S.stats.sfrt = 0; },
          'Supply Fan Starts Reset': () => { S.supplyFan.st = 0; S.stats.sfst = 0; }
        };
        (map[name] || (() => {}))();
        saveState(); closeModal(); render();
        toast(name + ' — done');
      };
    }
    else if (a === 'SEND') { toast('Service Pin message sent (manual p.163)'); }
  });
  const cr = view.querySelector('#clearReconfig');
  if (cr) cr.onclick = () => {
    openModal(`<div class="mh">Clear & Reconfig.</div><div class="ms">Clears the configuration and returns the simulated unit to factory defaults (manual p.162).</div>
      <div class="btnrow"><button class="btn danger" id="crOk">Clear & Reconfig.</button><button class="btn sec" onclick="closeModal()">Cancel</button></div>`);
    $('#crOk').onclick = () => {
      S.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      saveState(); closeModal(); render();
      toast('Configuration cleared — reconfigure via Edit Configuration (p.162)');
    };
  };
}

/* ---------------- search ---------------- */
function norm(s) { return String(s).toLowerCase().replace(/\s+/g, ' ').trim(); }
function doSearch(qRaw) {
  const res = $('#searchresults');
  const q = norm(qRaw);
  if (q.length < 2) { res.innerHTML = '<div class="empty">Type at least 2 characters — try “compressor proving”, “defrost”, “alarms”, “lpc”, “humidity”…</div>'; return; }
  let html = '';

  /* topics */
  const topics = TOPICS.filter(t => t.keys.some(k => k.includes(q) || q.includes(k)));
  if (topics.length) {
    html += '<div class="sgroup">Key Topics</div>';
    for (const t of topics.slice(0, 8)) {
      html += `<div class="sres"><div class="rt">${esc(t.keys[0].replace(/^\w/, c => c.toUpperCase()))}</div>
      <div class="rp">${pathHtml(t.path)}</div><div class="rx">${esc(t.desc)}</div>
      <div class="racts"><button class="btn" data-sgo="${t.path.join('/')}">Open in Simulator</button><button class="btn amber" data-sman="${t.page}" data-sq="${esc(t.keys[0])}">Manual p.${t.page}</button></div></div>`;
    }
  }

  /* menu items */
  const menuHits = [];
  for (const [key, m] of Object.entries(MENU)) {
    const parts = key.split('/');
    for (const it of m.items) {
      if (norm(it).includes(q)) {
        menuHits.push({ name: it, path: parts[0] === 'home' ? ['Home'] : [cap(parts[0]), ...(parts[1] ? [MENU[key].t] : [])], page: m.p });
      }
    }
  }
  if (menuHits.length) {
    html += '<div class="sgroup">Controller Menu Items</div>';
    for (const h of menuHits.slice(0, 12)) {
      html += `<div class="sres"><div class="rt">${esc(h.name)}</div><div class="rp">${pathHtml(h.path)}</div>
      <div class="racts"><button class="btn" data-sgo="${h.path.map(encodeURIComponent).join('/')}">Open in Simulator</button><button class="btn amber" data-sman="${h.page}" data-sq="${esc(h.name)}">Manual p.${h.page}</button></div></div>`;
    }
  }

  /* manual sections (TOC) */
  const tocHits = TOC.filter(t => norm(t.t).includes(q));
  if (tocHits.length) {
    html += '<div class="sgroup">Manual Sections</div>';
    for (const t of tocHits.slice(0, 12)) {
      html += `<div class="sres"><div class="rt">${esc(t.t)}</div><div class="rp">Manual section · page ${t.p}</div>
      <div class="racts"><button class="btn amber" data-sman="${t.p}" data-sq="${esc(t.t)}">Open Manual p.${t.p}</button></div></div>`;
    }
  }

  /* full text pages */
  const pageHits = [];
  for (const [pg, txt] of Object.entries(PAGES)) {
    const n = norm(txt);
    const idx = n.indexOf(q);
    if (idx >= 0) pageHits.push({ pg: +pg, excerpt: n.slice(Math.max(0, idx - 60), idx + q.length + 80) });
  }
  if (pageHits.length) {
    html += `<div class="sgroup">Manual Pages (${pageHits.length})</div>`;
    for (const h of pageHits.slice(0, 20)) {
      html += `<div class="sres"><div class="rp">Manual page ${h.pg}</div><div class="rx">…${markHit(h.excerpt, q)}…</div>
      <div class="racts"><button class="btn amber" data-sman="${h.pg}" data-sq="${esc(qRaw)}">Open Manual p.${h.pg}</button></div></div>`;
    }
    if (pageHits.length > 20) html += `<div class="empty">…and ${pageHits.length - 20} more pages</div>`;
  }
  if (!html) html = `<div class="empty">No matches for “${esc(qRaw)}”. Try a shorter fragment of the term.</div>`;
  res.innerHTML = html;
  res.querySelectorAll('[data-sgo]').forEach(b => b.onclick = () => {
    closeSearch();
    go('#/' + b.dataset.sgo.toLowerCase());
  });
  res.querySelectorAll('[data-sman]').forEach(b => b.onclick = () => {
    closeSearch();
    openManual(+b.dataset.sman, b.dataset.sq || qRaw);
  });
}
function pathHtml(path) {
  return '<span class="pathchip">' + path.map(p => `<span>${esc(p)}</span>`).join('') + '</span>';
}
function markHit(text, q) {
  const n = norm(text);
  const i = n.indexOf(q);
  if (i < 0) return esc(text);
  return esc(text.slice(0, i)) + '<b>' + esc(text.slice(i, i + q.length)) + '</b>' + esc(text.slice(i + q.length));
}
function openSearch() { $('#searchwrap').classList.add('show'); $('#searchInput').focus(); }
function closeSearch() { $('#searchwrap').classList.remove('show'); }

/* ---------------- manual viewer (PDF.js) ---------------- */
const MV = { pdf: null, page: 1, q: '', scale: 1, matches: [], matchIdx: 0, rendering: false, returnHash: null };
pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/pdfjs/pdf.worker.min.js';

async function openManual(page, q) {
  MV.returnHash = (location.hash && !location.hash.startsWith('#/manual')) ? location.hash : (MV.returnHash || '#/home');
  MV.page = clamp(page || 1, 1, 225);
  MV.q = q || '';
  $('#manualview').classList.add('show');
  const h = '#/manual?p=' + MV.page + (MV.q ? '&q=' + encodeURIComponent(MV.q) : '');
  if (location.hash !== h) location.hash = h;
  if (!MV.pdf) {
    showMNote('Loading manual…');
    try {
      MV.pdf = await pdfjsLib.getDocument({ url: 'manual.pdf' }).promise;
    } catch (e) {
      showMNote('Could not load manual.pdf — make sure it is uploaded next to index.html');
      return;
    }
  }
  await renderManualPage();
}
function showMNote(msg) {
  const n = $('#mNote'); n.textContent = msg; n.style.display = 'block';
  clearTimeout(n._h); n._h = setTimeout(() => n.style.display = 'none', 3500);
}
async function renderManualPage() {
  if (MV.rendering || !MV.pdf) return;
  MV.rendering = true;
  try {
    const pg = await MV.pdf.getPage(MV.page);
    const wrap = $('#mWrap'), canvas = $('#mCanvas'), layer = $('#mLayer');
    const availW = Math.min(window.innerWidth - 28, 732);
    const baseScale = availW / 612;
    const scale = baseScale * MV.scale;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rv = pg.getViewport({ scale: scale * dpr });
    canvas.width = rv.width; canvas.height = rv.height;
    canvas.style.width = Math.round(scale * 612) + 'px'; canvas.style.height = Math.round(scale * 792) + 'px';
    wrap.style.width = Math.round(scale * 612) + 'px'; wrap.style.height = Math.round(scale * 792) + 'px';
    layer.innerHTML = '';
    await pg.render({ canvasContext: canvas.getContext('2d'), viewport: rv }).promise;
    // text layer
    const tc = await pg.getTextContent();
    const v2 = pg.getViewport({ scale });
    for (const item of tc.items) {
      if (!item.str) continue; // keep whitespace items: they carry word spaces
      const tx = pdfjsLib.Util.transform(v2.transform, item.transform);
      const span = document.createElement('span');
      span.textContent = item.str;
      const fontH = Math.hypot(tx[2], tx[3]);
      span.style.left = tx[4] + 'px';
      span.style.top = (tx[5] - fontH) + 'px';
      span.style.fontSize = fontH + 'px';
      span.style.transform = `skewX(${Math.atan2(tx[1], tx[0]) * -1}rad)`;
      span._m = { x0: tx[4], x1: tx[4] + (item.width || 0) * scale, y: tx[5], fs: fontH || 11 };
      layer.appendChild(span);
    }
    if (MV.q) highlightManual(MV.q);
    $('#mPageInput').value = MV.page;
  } catch (e) { /* page render error */ }
  MV.rendering = false;
}
function buildLayerText(spans) {
  // position-aware concatenation of NORMALIZED text with offset maps back to raw text
  let full = '';
  const map = [];
  const normSpan = raw => {
    let n = ''; const rawMap = [];
    let i = 0;
    while (i < raw.length) {
      if (/\s/.test(raw[i])) {
        let j = i; while (j < raw.length && /\s/.test(raw[j])) j++;
        n += ' '; rawMap.push(i); i = j;
      } else { n += raw[i].toLowerCase(); rawMap.push(i); i++; }
    }
    return { n, rawMap };
  };
  for (let i = 0; i < spans.length; i++) {
    const sp = spans[i], m = sp._m;
    if (i > 0) {
      const p = spans[i - 1]._m;
      const sameLine = Math.abs(p.y - m.y) < 2;
      const gap = m.x0 - p.x1;
      const needsSpace = !(sameLine && gap < Math.max(6, m.fs * 0.9));
      if (needsSpace) { map.push({ sep: true, start: full.length, nLen: 1 }); full += ' '; }
    }
    const ns = normSpan(sp.textContent);
    map.push({ span: sp, start: full.length, nLen: ns.n.length, rawMap: ns.rawMap });
    full += ns.n;
  }
  return { full: full, map: map };
}
function wrapInSpan(sp, rawMap, a, b) {
  // a, b are normalized offsets; convert to raw offsets then wrap
  if (a >= rawMap.length) return;
  const rawStart = rawMap[a];
  const rawEnd = b >= rawMap.length ? sp.textContent.length : rawMap[b];
  const nodes = Array.from(sp.childNodes);
  let base = 0;
  for (let n of nodes) {
    if (n.nodeType !== 3) continue;
    const len = n.textContent.length;
    if (base + len <= rawStart || base >= rawEnd) { base += len; continue; }
    let relStart = Math.max(rawStart, base) - base;
    let relEnd = Math.min(rawEnd, base + len) - base;
    let target = n;
    if (relStart > 0) target = n.splitText(relStart);
    if (relEnd - relStart < target.textContent.length) target.splitText(relEnd - relStart);
    const mk = document.createElement('mark');
    sp.insertBefore(mk, target);
    mk.appendChild(target);
    base += len;
  }
}
function highlightManual(qRaw) {
  const layer = $('#mLayer');
  const spans = [...layer.children].filter(s => s._m);
  const norm = s => s.toLowerCase().replace(/\s+/g, ' ');
  const q = norm(qRaw).trim();
  if (!q) return;
  const built = buildLayerText(spans);
  const nf = built.full; // already normalized
  const matches = [];
  let i = 0;
  while ((i = nf.indexOf(q, i)) !== -1) { matches.push(i); i += Math.max(1, Math.floor(q.length / 2)); }
  MV.matches = matches; MV.matchIdx = 0;
  if (!matches.length) {
    showMNote('“' + qRaw + '” not found on page ' + MV.page + ' — check surrounding pages or use Find on the next page');
    return;
  }
  for (const m of matches) {
    const end = m + q.length;
    for (const seg of built.map) {
      if (seg.sep) continue;
      if (seg.start + seg.nLen <= m || seg.start >= end) continue;
      wrapInSpan(seg.span, seg.rawMap, Math.max(0, m - seg.start), Math.min(seg.nLen, end - seg.start));
    }
  }
  const first = layer.querySelector('mark');
  if (first) { first.classList.add('pulse'); first.scrollIntoView({ block: 'center' }); }
  showMNote(matches.length + ' match' + (matches.length > 1 ? 'es' : '') + ' for “' + qRaw + '” on page ' + MV.page);
}
function jumpMatch(dir) {
  const marks = [...$('#mLayer').querySelectorAll('mark')];
  if (!marks.length) return;
  MV.matchIdx = (MV.matchIdx + dir + marks.length) % marks.length;
  marks[MV.matchIdx].scrollIntoView({ block: 'center' });
  marks.forEach(m => m.classList.remove('pulse'));
  marks[MV.matchIdx].classList.add('pulse');
}
function closeManual() {
  $('#manualview').classList.remove('show');
  const back = MV.returnHash || '#/home';
  if (location.hash.startsWith('#/manual')) history.length > 1 ? history.back() : (location.hash = back);
}

/* ---------------- boot ---------------- */
function boot() {
  loadPersisted();
  updateAlarmBadge();
  // tab bar
  document.querySelectorAll('#tabbar button').forEach(b => b.onclick = () => go('#/' + b.dataset.tab));
  $('#btnSearch').onclick = openSearch;
  $('#searchClose').onclick = closeSearch;
  $('#searchInput').oninput = e => doSearch(e.target.value);
  $('#searchInput').onkeydown = e => { if (e.key === 'Enter') e.target.blur(); };
  $('#btnTrainer').onclick = () => go('#/trainer');
  $('#btnBack').onclick = () => history.back();
  $('#modalbg').onclick = e => { if (e.target === $('#modalbg')) closeModal(); };

  // manual viewer controls
  $('#mBack').onclick = closeManual;
  $('#mPrev').onclick = () => { MV.page = clamp(MV.page - 1, 1, 225); renderManualPage(); };
  $('#mNext').onclick = () => { MV.page = clamp(MV.page + 1, 1, 225); renderManualPage(); };
  $('#mPageInput').onchange = e => { MV.page = clamp(+e.target.value || 1, 1, 225); renderManualPage(); };
  $('#mZoomIn').onclick = () => { MV.scale = clamp(MV.scale * 1.25, 0.6, 4); renderManualPage(); };
  $('#mZoomOut').onclick = () => { MV.scale = clamp(MV.scale / 1.25, 0.6, 4); renderManualPage(); };
  $('#mFindNext').onclick = () => jumpMatch(1);
  $('#mFindPrev').onclick = () => jumpMatch(-1);
  $('#mOpenPdf').onclick = () => window.open('manual.pdf', '_blank');

  // deep link to manual?
  if (location.hash.startsWith('#/manual')) {
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    openManual(+params.get('p') || 1, params.get('q') || '');
  } else {
    render();
  }

  // simulation loop
  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.min(dt, 1);
    if ($('#manualview').classList.contains('show')) { /* keep sim running */ }
    tick(dt * S.speed);
    computeMode();
    S.coolStage = S.tstat.y2 ? 2 : S.tstat.y1 ? 1 : 0;
    for (const u of uiUpdaters) { try { u(); } catch (e) {} }
  }, 250);
  setInterval(saveState, 10000);
  window.addEventListener('hashchange', () => {
    if (location.hash.startsWith('#/manual')) {
      const params = new URLSearchParams(location.hash.split('?')[1] || '');
      const p = +params.get('p') || 1, q = params.get('q') || '';
      if ($('#manualview').classList.contains('show') && p === MV.page && q === MV.q) return;
      openManual(p, q);
    } else {
      $('#manualview').classList.remove('show');
      render();
    }
  });
}
document.addEventListener('DOMContentLoaded', boot);
