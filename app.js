'use strict';
/* ============================================================
   Symbio 700 HVAC Simulator — educational tool
   Based on: "SYMBIO 700 INFORMATION & TROUBLESHOOTING MANUAL"
   (February 2022, unofficial). Manual pages cited throughout.
   ============================================================ */

/* ---------------- persistence ---------------- */
const LS_KEY = 'symbio700sim_v1';
function saveState() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      config: S.config, settings: S.settings, filterHours: S.filterHours,
      stats: S.stats, alarmHistory: S.alarmHistory.slice(-100)
    }));
  } catch (e) {}
}
function loadPersisted() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_KEY));
    if (d && d.config) { S.config = Object.assign({}, S.config, d.config); }
    if (d && d.settings) { S.settings = Object.assign({}, S.settings, d.settings); }
    if (d && typeof d.filterHours === 'number') S.filterHours = d.filterHours;
    if (d && d.stats) S.stats = d.stats;
    if (d && Array.isArray(d.alarmHistory)) S.alarmHistory = d.alarmHistory;
  } catch (e) {}
}

/* ---------------- default configuration (Utilities > Edit Configuration, manual p.162) ---------------- */
const DEFAULT_CONFIG = {
  systemType: 'CVZT',
  spaceController: 'Conventional TSTAT',
  indoorFanType: 'Multi Speed',
  refrigerationSystem: 'Heat Pump',
  refrigerant: 'R410A',
  tonnage: '7.5',
  circuits: 'Dual',
  voltage: '208/230-60',
  efficiency: 'Standard',
  evaporatorDefrost: 'Not Installed',
  primaryHeatingSource: 'Electric',
  primaryHeatingType: 'Staged',
  primaryHeatingStages: '2',
  secondaryHeatingSource: 'Not Installed',
  frostat: 'Not Installed',
  humiditySensor: 'Installed',
  co2Sensor: 'Not Installed',
  dischargeTempSensor: 'Installed',
  externalAutoStop: 'Not Installed',
  ventilationOverride: 'Not Installed',
  alarmIndicator: 'Installed',
  demandManagement: 'None',
  supplyAirTempering: 'Disabled'
};

/* ---------------- default settings (manual p.121-123 defaults marked *) ---------------- */
const DEFAULT_SETTINGS = {
  arbitrationMethodRequest: 'Standalone Control',
  emergencyOverrideBAS: 'Normal',
  heatCoolModeRequest: 'Auto',
  occupancyRequest: 'Auto',
  occupiedBypassTime: 120,
  occupiedStandbyCooling: 78,
  occupiedStandbyHeating: 67,
  coolHighLimit: 90, coolLowLimit: 50, heatHighLimit: 80, heatLowLimit: 50,
  supplyFanConfig: 'Cycling',
  timedOverrideRequest: 'Idle',
  unitStopCommand: 'Auto',
  unoccupiedCooling: 85, unoccupiedHeating: 60,
  vvztDATControlMode: 'Auto',
  demandShedOffset: 0,
  filterRuntimeHoursSetpoint: 2000,
  fanMaxSpeed: 100, fanMinSpeed: 0, fanSpeedCommand: 0, fanSpeedCommandEnable: 'Disabled',
  compressorCoolingPGain: 80, compressorCoolingResetTime: 500,
  coolingCapacityEnable: 100, coolingCapacitySetpointBAS: 0, coolingCapacitySetpointEnableBAS: 'Disabled',
  coolingDemandLimitEnable: 0, coolingLockoutBAS: 'Normal',
  dischargeAirCoolingSetpoint: 55, datMaxCoolLimit: 104, datMinCoolLimit: 50,
  auxHeatingPGain: 80, auxHeatingResetTime: 500,
  heatLockoutCommand: 'Normal', heatPrimaryEnableBAS: 100,
  hpHeatingLockoutSetpoint: -40,
  heatingCapacitySetpointBAS: 0, heatingCapacitySetpointEnableBAS: 'Disabled',
  heatingDemandLimitEnable: 100, supplyAirTemperingEnable: 'Disable',
  serviceTestStateRequest: 'Inactive', performanceTestStateRequest: 'Inactive', serviceTestTimeout: 60,
  backlightTimeout: 30, displayUnits: 'F', scrollingSpeed: 5
};

/* ---------------- sim state ---------------- */
function mkComp() {
  return {
    cmd: 0, prove: 1, rt: 0, st: 0,
    provingTrips: 0, lpcTrips: 0,
    disabledUntil: 0, lpcBypassUntil: 0,
    lockout: '',            // '', 'proving', 'lpc', 'hpc', 'contactor'
    onTime: 0, offTime: -99999, startTrialTime: 0
  };
}
const S = {
  simTime: 0, speed: 1, power: true,
  config: JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
  settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
  oat: 42, oatSensorOk: true, spaceTemp: 74, spaceHumidity: 48, co2: 600, loadF: 0,
  occupancy: 'Occupied',
  tstat: { g: 0, y1: 0, y2: 0, w1: 0, w2: 0, x2: 0 },
  mode: 'Idle', coolStage: 0, heatStage: 0, capacityPct: 0,
  comps: [mkComp(), mkComp()],
  condFans: [{ cmd: 0, rt: 0, st: 0 }, { cmd: 0, rt: 0, st: 0 }],
  supplyFan: { cmd: 0, speed: 0, rt: 0, st: 0, offAt: 0 },
  eheat: [{ cmd: 0, rt: 0, st: 0 }, { cmd: 0, rt: 0, st: 0 }],
  switchValves: [0, 0], // 1 = cooling position
  defrost: [mkDefrost(), mkDefrost()],
  dat: 72,
  filterHours: 1240,
  stats: {
    c1rt: 0, c1st: 0, c2rt: 0, c2st: 0, f1rt: 0, f1st: 0, f2rt: 0, f2st: 0,
    sfrt: 0, sfst: 0, eh1rt: 0, eh1st: 0, eh2rt: 0, eh2st: 0
  },
  alarms: [], alarmHistory: [],
  test: { state: 'Inactive', startedAt: 0 },
  faults: {
    prov1: false, prov2: false, weld1: false, weld2: false,
    lpc1: false, lpc2: false, hpc1: false, hpc2: false,
    oatSensor: false, coilSensor1: false, coilSensor2: false,
    phaseMonitor: false, fanVFD: false
  },
  hpLockout: false, edc: { acc: 0, offUntil: 0 }, firstDefrost: [false, false],
  seqTrips: { cool: [0, 0], heat: [0, 0] }
};
function mkDefrost() {
  return { active: false, coilTemp: 30, frost: 0, dctd: 10, initiateDT: 18, dryTimer: 0, runTime: 0, heatAccum: 0, mode: 'demand' };
}

/* ---------------- helpers ---------------- */
const $ = s => document.querySelector(s);
const fmt = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toFixed(d);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600);
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' }[c])); }
function hhmmss(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s2 = sec % 60;
  return (h ? h + 'h ' : '') + (h || m ? m + 'm ' : '') + s2 + 's';
}

/* ---------------- alarms / diagnostics ---------------- */
const ALARM_CATS = { crit: 'Critical', svc: 'Service Required', adv: 'Advisory', info: 'Information' };
function raiseAlarm(id, name, cat, detail, page) {
  if (S.alarms.some(a => a.id === id)) return;
  S.alarms.push({ id, name, cat, detail, page, since: S.simTime });
  updateAlarmBadge();
  if (S.route && S.route.startsWith('#/alarms') && typeof render === 'function') render();
}
function clearAlarm(id, cleared) {
  const i = S.alarms.findIndex(a => a.id === id);
  if (i < 0) return;
  const a = S.alarms[i];
  S.alarms.splice(i, 1);
  S.alarmHistory.push({ name: a.name, cat: a.cat, since: a.since, until: S.simTime, how: cleared || 'Auto-Reset' });
  updateAlarmBadge();
}
function diagnosticReset() {
  // Service > Diagnostics > Reset Diagnostic (manual p.160): clears trips AND lockouts
  for (const a of [...S.alarms]) clearAlarm(a.id, 'Diagnostic Reset');
  S.comps.forEach((c, i) => {
    c.lockout = ''; c.provingTrips = 0; c.lpcTrips = 0; c.disabledUntil = 0;
    S.seqTrips.cool[i] = 0; S.seqTrips.heat[i] = 0;
  });
  toast('Diagnostic Reset complete — all trips and lockouts cleared (manual p.160)');
}
function updateAlarmBadge() {
  const n = S.alarms.length;
  const b = $('#alarmBadge'); b.textContent = n; b.classList.toggle('show', n > 0);
}

/* ---------------- control logic ---------------- */
function setpoints() {
  const occ = S.occupancy === 'Occupied';
  return {
    cool: occ ? 72 : S.settings.unoccupiedCooling,
    heat: occ ? 70 : S.settings.unoccupiedHeating
  };
}
function lpcBypassDelay() { // manual p.35
  if (!S.oatSensorOk) return 0;
  if (S.oat < 40) return 60;
  if (S.oat < 50) return 30;
  return 0;
}
function provingOf(i) { // compressor proving input state (1 = closed)
  const c = S.comps[i];
  const x = i + 1;
  if (S.faults['weld' + x]) return 1;                 // welded contactor: always closed
  if (S.faults['prov' + x]) return 0;                 // stuck open from startup
  if (S.faults['prov' + x + 'b']) return c.onTime > 30 ? 0 : 1; // opens after 30 s of run
  return c.cmd;                                     // healthy: follows command
}

function tick(dt) {
  if (!S.power) { allOff(); return; }
  S.simTime += dt;

  const sp = setpoints();
  const mode = S.settings.heatCoolModeRequest;
  const cfg = S.config;

  /* --- thermostat / zone sensor inputs (manual p.85, p.153) --- */
  const t = S.tstat;
  const coolMode = mode === 'Auto' || mode === 'Cool';
  const heatMode = mode === 'Auto' || mode === 'Heat';
  if (cfg.spaceController === 'Conventional TSTAT') {
    t.y1 = coolMode && S.spaceTemp >= sp.cool + 1 ? 1 : (S.spaceTemp <= sp.cool - 0.5 ? 0 : t.y1 && coolMode ? 1 : 0);
    t.y2 = coolMode && S.spaceTemp >= sp.cool + 2.5 ? 1 : (S.spaceTemp <= sp.cool + 1 ? 0 : t.y2 && coolMode ? 1 : 0);
    t.w1 = heatMode && S.spaceTemp <= sp.heat - 1 ? 1 : (S.spaceTemp >= sp.heat + 0.5 ? 0 : t.w1 && heatMode ? 1 : 0);
    t.w2 = heatMode && S.spaceTemp <= sp.heat - 2.5 ? 1 : (S.spaceTemp >= sp.heat - 1 ? 0 : t.w2 && heatMode ? 1 : 0);
    t.g = (t.y1 || t.w1 || S.settings.supplyFanConfig === 'Continuous') ? 1 : 0;
  } else {
    // Zone sensor: PI control, ±1°F band, 3°F recovery (manual p.85)
    t.y1 = coolMode && S.spaceTemp >= sp.cool + 1 ? 1 : (S.spaceTemp <= sp.cool - 0.2 ? 0 : t.y1 && coolMode ? 1 : 0);
    t.y2 = coolMode && S.spaceTemp >= sp.cool + 2.2 ? 1 : (S.spaceTemp <= sp.cool + 0.8 ? 0 : t.y2 && coolMode ? 1 : 0);
    t.w1 = heatMode && S.spaceTemp <= sp.heat - 1 ? 1 : (S.spaceTemp >= sp.heat + 0.2 ? 0 : t.w1 && heatMode ? 1 : 0);
    t.w2 = heatMode && S.spaceTemp <= sp.heat - 2.2 ? 1 : (S.spaceTemp >= sp.heat - 0.8 ? 0 : t.w2 && heatMode ? 1 : 0);
    t.g = 1; // zone sensor: fan runs with occupancy
  }
  if (S.spaceTemp > sp.cool + 3) t.y1 = coolMode ? 1 : t.y1; // recovery (p.85)
  if (S.spaceTemp < sp.heat - 3) t.w1 = heatMode ? 1 : t.w1;

  /* --- test mode override (manual p.131, p.164) --- */
  let testOverride = null;
  if (S.settings.serviceTestStateRequest !== 'Inactive') {
    testOverride = S.settings.serviceTestStateRequest;
    if (S.simTime - S.test.startedAt > S.settings.serviceTestTimeout * 60) {
      S.settings.serviceTestStateRequest = 'Inactive';
      toast('Service Test timed out after ' + S.settings.serviceTestTimeout + ' minutes (manual p.131)');
    }
  }

  /* --- heating / cooling stage request --- */
  let coolCall = t.y1, heatCall = t.w1;
  if (testOverride === 'Cool 1') { coolCall = 1; t.y1 = 1; }
  if (testOverride === 'Cool 2') { coolCall = 1; t.y2 = 1; }
  if (testOverride && testOverride.startsWith('Heat')) { heatCall = 1; t.w1 = 1; if (testOverride !== 'Heat 1') t.w2 = 1; }
  if (testOverride === 'Emergency Heat') { heatCall = 1; t.x2 = 1; }

  const stop = S.settings.unitStopCommand === 'Stop';
  if (stop) { coolCall = 0; heatCall = 0; }

  /* --- heat pump heating lockout (manual p.55) --- */
  S.hpLockout = false;
  if (cfg.refrigerationSystem === 'Heat Pump' && heatCall) {
    if (S.oatSensorOk) {
      if (S.oat <= S.settings.hpHeatingLockoutSetpoint) S.hpLockout = true;
      else if (S.oat > S.settings.hpHeatingLockoutSetpoint + 5) S.hpLockout = false;
      else S.hpLockout = S.hpLockoutPrev || S.oat <= S.settings.hpHeatingLockoutSetpoint;
    }
  }
  S.hpLockoutPrev = S.hpLockout;
  if (S.hpLockout) heatCall = 0; // aux heat will carry the load below

  /* --- mode & stage determination --- */
  let wantCool = coolCall && !heatCall;
  let wantHeat = heatCall;
  if (cfg.systemType === 'VVZT' && wantCool) {
    // variable capacity: 0-100% by space error (educational PI)
    const err = clamp(S.spaceTemp - sp.cool, 0, 4);
    S.capacityPct = clamp(err / 3 * 100, 0, 100);
  }

  let stage = 0;
  if (wantCool) stage = t.y2 ? 2 : 1;
  if (testOverride === 'Cool 1') stage = 1;
  if (testOverride === 'Cool 2') stage = 2;
  if (cfg.circuits === 'Single') stage = Math.min(stage, 1);

  /* --- compressor commands (manual p.34-37, p.84) --- */
  const inDefrost = S.defrost.some(d => d.active);
  for (let i = 0; i < 2; i++) {
    const c = S.comps[i];
    if (c.lockout) { c.cmd = 0; continue; }
    if (S.simTime < c.disabledUntil) { c.cmd = 0; continue; }

    let want = 0;
    if (wantCool && (stage >= i + 1 || (cfg.circuits === 'Single' && stage >= 1 && i === 0))) want = 1;
    if (wantHeat && !S.hpLockout && cfg.refrigerationSystem === 'Heat Pump') want = 1;
    if (testOverride === 'Defrost' && cfg.refrigerationSystem === 'Heat Pump') want = 1;
    if (S.defrost[i].active) want = 1; // compressors run through defrost (p.58)
    if (inDefrost && !S.defrost[i].active && cfg.refrigerationSystem === 'Heat Pump' && wantHeat) want = 1;

    // LPC is normally closed; open = fault. LPC open does NOT inhibit startup (p.35)
    if (want && !c.cmd) {
      if (S.simTime - c.offTime < 300) want = 0; // anti-short-cycle 5 min
    }
    if (want && !c.cmd) {
      c.cmd = 1; c.st++; S.stats['c' + (i + 1) + 'st']++;
      c.startTrialTime = S.simTime; c.onTime = 0; c.startProveClosed = false;
      c.lpcBypassUntil = S.simTime + lpcBypassDelay();
      // startup proving check happens below (5 s)
    } else if (!want && c.cmd) {
      if (c.onTime < 180 && !c.lockout) { /* min on time honored by simply stopping */ }
      c.cmd = 0; c.offTime = S.simTime;
    }
    if (c.cmd) { c.onTime += dt; c.rt += dt; S.stats['c' + (i + 1) + 'rt'] = c.rt; }
    c.prove = provingOf(i);
    if (c.cmd && c.prove) c.startProveClosed = true;
    if (c.cmd && c.onTime > 60) clearAlarm('provtrip' + (i + 1), 'Auto-Reset (restart)');
  }

  /* --- proving & protection diagnostics (manual p.34) --- */
  for (let i = 0; i < 2; i++) {
    const c = S.comps[i];
    const x = i + 1;
    if (c.cmd && c.prove === 0) {
      if (S.simTime - c.startTrialTime >= 5) {
        // ran >5 s with proving open (or never closed at start)
        const seq = wantCool ? 'cool' : 'heat';
        if (S.simTime - c.startTrialTime <= 6 && !c.startProveClosed) {
          // startup: proving never closed within 5 s → Proving Lockout (p.34)
          tripCircuit(i, 'proving');
          raiseAlarm('provlock' + x, 'Compressor ' + x + ' Proving Lockout', 'crit',
            'Proving input did not CLOSE within 5 seconds at compressor startup. Circuit locked out until a Diagnostic Reset. (manual p.34)', 34);
          c.lockout = 'proving';
        } else {
          tripCircuit(i, 'proving');
          raiseAlarm('provtrip' + x, 'Compressor ' + x + ' Proving Trip', 'svc',
            'Proving input OPENed while commanded ON. Circuit disabled 15 minutes; 4 trips = lockout. (manual p.34)', 34);
          S.seqTrips[seq][i]++;
          c.provingTrips++;
          if (c.provingTrips >= 4) {
            raiseAlarm('provlock' + x, 'Compressor ' + x + ' Proving Lockout', 'crit',
              '4 Proving Trips in one operating sequence. Circuit locked out until a Diagnostic Reset. (manual p.34)', 34);
            c.lockout = 'proving';
            c.provingTrips = 0;
          }
        }
      }
    }
    if (!c.cmd && c.prove === 1) {
      // contactor closed with no command — Contactor Failure after 5 s (p.34)
      c.weldTime = (c.weldTime || 0) + dt;
      if (c.weldTime >= 5) {
        raiseAlarm('cf' + x, 'Compressor ' + x + ' Contactor Failure (Manual Reset)', 'crit',
          'Proving input ACTIVE while command is Inactive. Circuit de-energized and locked out until a Diagnostic Reset. (manual p.34)', 34);
        c.lockout = 'contactor';
        c.cmd = 0;
      }
    } else c.weldTime = 0;

    // LPC (manual p.35-37)
    if (S.faults['lpc' + x] && c.cmd && S.simTime >= c.lpcBypassUntil) {
      const hpHeatIgnore = cfg.refrigerationSystem === 'Heat Pump' && wantHeat && (S.oat < 0 || c.inDefrostNow);
      if (!hpHeatIgnore) {
        tripCircuit(i, 'lpc');
        raiseAlarm('lpc' + x, 'Circuit ' + x + ' LPC Trip', 'svc',
          'Low pressure cutout input OPEN. Circuit disabled 3 minutes; 4 trips = Low Pressure Lockout. (manual p.35)', 35);
        c.lpcTrips++;
        if (c.lpcTrips >= 4) {
          raiseAlarm('lpclock' + x, 'Circuit ' + x + ' Low Pressure Lockout (Manual Reset)', 'crit',
            '4 LPC trips without a 3-minute minimum run. Circuit locked out until a Diagnostic Reset. (manual p.37)', 37);
          c.lockout = 'lpc';
        }
      }
    }
    // successful 3-minute run resets LPC trip count (p.35)
    if (c.cmd && c.onTime >= 180 && c.lpcTrips > 0 && !S.faults['lpc' + x]) { c.lpcTrips = 0; clearAlarm('lpc' + x, 'Auto-Reset (3-min run)'); }

    // HPC — high pressure cutout (manual p.34)
    if (S.faults['hpc' + x] && c.cmd) {
      tripCircuit(i, 'hpc');
      raiseAlarm('hpc' + x, 'Circuit ' + x + ' High Pressure Lockout (Manual Reset)', 'crit',
        'High pressure cutout input OPEN. Circuit locked out until a Diagnostic Reset. (manual p.34)', 34);
      c.lockout = 'hpc';
    }
  }

  /* --- defrost (manual p.56-58) --- */
  if (cfg.refrigerationSystem === 'Heat Pump') {
    for (let i = 0; i < 2; i++) runDefrost(i, dt, wantHeat);
  }

  /* --- evaporator defrost control, cooling (manual p.98) --- */
  if (cfg.evaporatorDefrost === 'Enabled' && wantCool) {
    const lowAmb = cfg.circuits === 'Dual' ? 40 : 55;
    if (S.oat < lowAmb && S.comps.some(c => c.cmd)) {
      S.edc.acc += dt;
      if (S.edc.acc >= 600) {
        S.edc.acc = 0; S.edc.offUntil = S.simTime + 180;
        toast('Evaporator Defrost Control: compressors OFF for 3 min (manual p.98)');
      }
    }
  }
  const edcHold = S.simTime < S.edc.offUntil;
  if (edcHold) S.comps.forEach(c => { c.cmd = 0; });

  /* --- switchover valves --- */
  const heatPumpHeating = wantHeat && !S.hpLockout && cfg.refrigerationSystem === 'Heat Pump';
  for (let i = 0; i < 2; i++) {
    S.switchValves[i] = S.defrost[i].active ? 1 : (heatPumpHeating ? 0 : (wantCool ? 1 : S.switchValves[i]));
  }

  /* --- electric heat / auxiliary heat --- */
  let eh1 = 0, eh2 = 0;
  if (cfg.primaryHeatingSource === 'Electric') {
    eh1 = (wantHeat && t.w1) || t.x2 ? 1 : 0;
    eh2 = (wantHeat && t.w2) || t.x2 ? 1 : 0;
    if (cfg.primaryHeatingStages === '1') eh2 = 0;
  }
  const defrostActive = S.defrost.some(d => d.active);
  if (defrostActive || S.hpLockout) eh1 = 1; // aux heat during defrost / HP lockout (p.55, p.58)
  if (testOverride === 'Emergency Heat') { eh1 = 1; eh2 = 1; }
  setEheat(0, eh1, dt); setEheat(1, eh2, dt);

  /* --- condenser fans (manual p.83) --- */
  for (let i = 0; i < 2; i++) {
    let f = S.comps[i].cmd ? 1 : 0;
    if (S.defrost[i].active) f = 0; // fans off in defrost (p.58)
    if (S.comps[i].cmd && f) { S.condFans[i].rt += dt; }
    if (f && !S.condFans[i].cmd) S.condFans[i].st++;
    S.condFans[i].cmd = f;
  }

  /* --- supply fan (manual p.85, p.90-91) --- */
  const fan = S.supplyFan;
  let fanCmd = t.g || S.comps.some(c => c.cmd) || eh1 || eh2 || testOverride === 'Fan On';
  if (S.settings.supplyFanConfig === 'Continuous') fanCmd = 1;
  if (S.faults.fanVFD && fanCmd) {
    raiseAlarm('fanfail', 'Supply Fan Failure', 'crit',
      'VFD communication lost — supply fan failure diagnostic. (manual p.95)', 95);
  }
  if (!S.faults.fanVFD) clearAlarm('fanfail');
  if (S.faults.phaseMonitor) {
    raiseAlarm('phase', 'Phase Monitor Fault', 'crit',
      'Phase monitor OK input lost. Unit will not run. (manual p.51-52)', 51);
    fanCmd = 0; S.comps.forEach(c => c.cmd = 0);
  } else if (S.alarms.some(a => a.id === 'phase')) clearAlarm('phase');
  if (fanCmd) { if (!fan.cmd) { fan.st++; S.stats.sfst = fan.st; } fan.cmd = 1; fan.rt += dt; S.stats.sfrt = fan.rt; fan.offAt = S.simTime; }
  else if (fan.cmd) fan.cmd = 1; // 45 s off delay
  if (!fanCmd && S.simTime - fan.offAt > 45) fan.cmd = 0;
  // fan speed
  if (cfg.indoorFanType === 'Single Speed') fan.speed = fan.cmd ? 100 : 0;
  else if (cfg.indoorFanType === 'Multi Speed') {
    const maxStage = Math.max(stage, eh1 + eh2 > 0 ? 1 : 0);
    fan.speed = fan.cmd ? (maxStage >= 2 || eh1 || eh2 ? 100 : (stage === 0 ? 50 : 60)) : 0;
  } else { // variable speed VFD
    const mn = S.settings.fanMinSpeed, mx = S.settings.fanMaxSpeed;
    const cap = cfg.systemType === 'VVZT' && wantCool ? S.capacityPct : (stage / 2) * 100;
    fan.speed = fan.cmd ? Math.round(clamp(mn + (mx - mn) * (cap / 100), 0, 100)) : 0;
  }

  /* --- space temperature physics (simplified educational model) --- */
  const tons = parseFloat(cfg.tonnage) || 7.5;
  let heatFlow = S.loadF; // °F per hour from internal gains
  let coolFrac = 0, heatFrac = 0;
  if (wantCool) coolFrac = cfg.systemType === 'VVZT' ? S.capacityPct / 100 : stage / 2;
  if (S.comps.some(c => c.cmd) && !wantCool && !heatPumpHeating) coolFrac = 0;
  if (heatPumpHeating && S.comps.some(c => c.cmd)) heatFrac = 0.8; // HP compressor heating
  const ehFrac = (eh1 + eh2) * (cfg.primaryHeatingSource === 'Electric' ? 1 : 0) * 0.6;
  if (defrostActive) { coolFrac = 0; heatFrac = 0; }
  const coolRate = coolFrac * tons * 0.55; // °F/hr per stage-equivalent
  const heatRate = heatFrac * tons * 0.5 + ehFrac * tons * 0.6;
  if (S.spaceTemp > sp.cool + 3 || S.spaceTemp < sp.heat - 3) { /* recovery handled in staging */ }
  S.spaceTemp += (heatFlow + heatRate - coolRate) * dt / 3600;
  S.spaceTemp = clamp(S.spaceTemp, 35, 110);
  // discharge air temp (educational)
  let datTarget = S.spaceTemp;
  if (coolFrac > 0) datTarget = S.spaceTemp - 22 * coolFrac;
  if (heatFrac > 0 || ehFrac > 0) datTarget = S.spaceTemp + 48 * Math.max(heatFrac, ehFrac);
  if (defrostActive) datTarget = S.spaceTemp - 15;
  S.dat += (datTarget - S.dat) * clamp(dt / 60, 0, 1);

  // humidity drifts toward 50 when cooling, up when humid weather
  S.spaceHumidity += ((S.oat > 70 ? 55 : 45) - S.spaceHumidity) * dt / 7200 - (coolFrac > 0 ? dt / 3600 : 0);
  S.spaceHumidity = clamp(S.spaceHumidity, 20, 80);
  S.co2 += ((S.occupancy === 'Occupied' ? 750 : 450) - S.co2) * dt / 1800;

  /* --- filter hours --- */
  if (fan.cmd) S.filterHours += dt / 3600;
  if (S.settings.filterRuntimeHoursSetpoint > 0 && S.filterHours >= S.settings.filterRuntimeHoursSetpoint) {
    raiseAlarm('filter', 'Maintenance Required (Filter)', 'adv',
      'Filter runtime hours reached the Filter Runtime Hours Setpoint. Reset the filter timer in Service > Statistics Reset. (manual p.158, p.160)', 158);
  }

  /* --- coil temps & frost (educational) --- */
  for (let i = 0; i < 2; i++) {
    const d = S.defrost[i];
    if (!S.faults['coilSensor' + (i + 1)]) {
      if (d.active) { d.coilTemp += dt * 0.12; }
      else {
        const target = S.oat - d.dctd;
        d.coilTemp += (target - d.coilTemp) * clamp(dt / 300, 0, 1);
      }
      d.coilTemp = clamp(d.coilTemp, -30, 120);
    }
  }

  /* --- test mode alarm --- */
  if (S.settings.serviceTestStateRequest !== 'Inactive') {
    raiseAlarm('testmode', 'Service Test Mode Active', 'info',
      'Test state: ' + S.settings.serviceTestStateRequest + '. Times out after ' + S.settings.serviceTestTimeout + ' minutes. (manual p.131)', 131);
  } else clearAlarm('testmode');
  if (stop) raiseAlarm('stopped', 'Unit Stopped', 'info', 'Unit Stop Command is active. (Settings > System)', 157);
  else clearAlarm('stopped');
  if (S.occupancy === 'Unoccupied') raiseAlarm('unocc', 'Unoccupied', 'info', 'Unit is unoccupied; setback setpoints are active. (manual p.121)', 121);
  else clearAlarm('unocc');

  /* --- stats & timers --- */
  if (!S.alarms.some(a => a.id === 'filter')) { /* keep */ }
  for (const a of [...S.alarms]) {
    if (a.id.startsWith('lpc')) {
      const i = +a.id.slice(3) - 1;
      if (S.simTime >= S.comps[i].disabledUntil + 0 && !S.faults['lpc' + (i + 1)] && a.id.startsWith('lpc')) {
        // 3-minute event timeout expired and fault removed (p.35)
        if (S.simTime - S.comps[i].lpcTripAt > 180) clearAlarm(a.id);
      }
    }
  }
  function noop() {}
}

function tripCircuit(i, why) {
  const c = S.comps[i];
  c.cmd = 0; c.offTime = S.simTime; c.onTime = 0;
  if (why === 'proving') c.disabledUntil = S.simTime + 900; // 15 min (p.34)
  if (why === 'lpc') { c.disabledUntil = S.simTime + 180; c.lpcTripAt = S.simTime; } // 3 min (p.35)
}
function setEheat(i, on, dt) {
  const e = S.eheat[i];
  if (on && !e.cmd) { e.st++; S.stats['eh' + (i + 1) + 'st'] = e.st; }
  e.cmd = on;
  if (on) { e.rt += dt; S.stats['eh' + (i + 1) + 'rt'] = e.rt; }
}
function allOff() {
  S.comps.forEach(c => c.cmd = 0);
  S.eheat.forEach(e => e.cmd = 0);
  S.supplyFan.cmd = 0; S.supplyFan.speed = 0;
  S.condFans.forEach(f => f.cmd = 0);
  Object.keys(S.tstat).forEach(k => S.tstat[k] = 0);
}

/* ---------------- demand defrost (manual p.56-58) ---------------- */
function runDefrost(i, dt, heatingActive) {
  const d = S.defrost[i];
  const c = S.comps[i];
  const sensorFail = S.faults['coilSensor' + (i + 1)] || S.faults.oatSensor;
  const hpHeating = heatingActive && c.cmd;

  if (d.active) {
    // termination: OCT > OAT+47, limited 57-72 (p.56)
    d.runTime += dt; d.heatAccum = 0;
    const dtt = clamp((S.oatSensorOk ? S.oat : 40) + 47, 57, 72);
    if (d.coilTemp > dtt || d.runTime > 900) {
      d.active = false; d.runTime = 0; d.frost = 0; d.dctd = 10;
      d.dryTimer = 0; c.inDefrostNow = false;
      toast('Circuit ' + (i + 1) + ' defrost terminated (manual p.56)');
    }
    return;
  }

  if (!hpHeating) { d.dryTimer = 0; d.runTime = 0; return; }
  d.heatAccum += dt;

  if (sensorFail) { d.mode = 'default'; }
  if (d.mode === 'default' || S.faults.oatSensor || S.faults['coilSensor' + (i + 1)]) {
    // Default mode: 5-minute defrost after each 30 minutes of compressor heating (p.57)
    if (d.heatAccum >= 1800) { startDefrost(i); d.heatAccum = 0; }
    return;
  }

  const permit = S.oat < 52 && d.coilTemp < 33; // p.56
  if (permit) {
    d.frost = clamp(d.frost + dt / 3600 * 1.4, 0, 1); // frost builds under permit conditions
    d.dctd = 10 + 14 * d.frost;
  }
  if (!S.firstDefrost[i]) {
    // first defrost after power-up: 30 min runtime under permit (p.56)
    if (permit) d.runTime += dt;
    if (d.runTime >= 1800 && permit) { startDefrost(i); S.firstDefrost[i] = true; d.runTime = 0; }
    return;
  }
  // subsequent: 12-min dry coil, then initiate when DT reaches 1.8x dry-coil DT (p.56)
  d.dryTimer += dt;
  if (d.dryTimer >= 720) {
    if (d.dryTimer <= 720 + dt) d.initiateDT = d.dctd * 1.8; // computed once at 12-min mark
    if (permit && d.dctd >= d.initiateDT) { startDefrost(i); d.dryTimer = 0; }
  }
}
function startDefrost(i) {
  const d = S.defrost[i];
  d.active = true; d.runTime = 0; d.dryTimer = 0;
  S.comps[i].inDefrostNow = true;
  toast('Circuit ' + (i + 1) + ' defrost initiated (manual p.56)');
}
