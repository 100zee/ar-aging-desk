/* ===== Aging engine: pure functions, no DOM ===== */
const BUCKETS = ['29일 이하', '30~59일', '60~89일', '90~119일', '120일 이상'];
const DISC = ['만기미도래', '3개월 이하', '3~6개월', '6~12개월', '12개월 초과', '만기없음'];
const SUBS = ['외상매출금 내수', '외상매출금 수출'];

/* ---- dates as UTC day numbers ---- */
const DAY = 86400000;
function dn(y, m, d) { return Math.round(Date.UTC(y, m, d) / DAY); }
function toDn(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) { if (isNaN(v)) return null; return dn(v.getFullYear(), v.getMonth(), v.getDate()); }
  if (typeof v === 'number') return Math.round(v) - 25569; // excel serial
  const s = String(v).trim().replace(/\./g, '-').replace(/\//g, '-');
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return dn(+m[1], +m[2] - 1, +m[3]);
  if (/^\d{8}$/.test(s)) return dn(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
  return null;
}
function ymd(n) { if (n == null) return ''; const d = new Date(n * DAY); return d.toISOString().slice(0, 10); }
function eomonth(n) { const d = new Date(n * DAY); return dn(d.getUTCFullYear(), d.getUTCMonth() + 1, 0); }
function addMonths(n, k) {
  const d = new Date(n * DAY); const y = d.getUTCFullYear(), m = d.getUTCMonth() + k, day = d.getUTCDate();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return dn(y, m, Math.min(day, last));
}
function code(v) { if (v === null || v === undefined) return ''; let s = String(v).trim(); if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, ''); return s; }
function num(v) { if (v === null || v === undefined || v === '') return 0; if (typeof v === 'number') return v; const n = parseFloat(String(v).replace(/,/g, '')); return isNaN(n) ? 0 : n; }
function normName(s) { return String(s || '').replace(/㈜/g, '(주)').replace(/\s+/g, ' ').trim(); }

function bucketOf(days) { return days <= 29 ? 0 : days <= 59 ? 1 : days <= 89 ? 2 : days <= 119 ? 3 : 4; }
function discOf(due, base) {
  if (due == null) return 5;
  if (due >= base) return 0; // 기준일 당일 만기 = 미도래(경과일 0)
  if (due >= addMonths(base, -3)) return 1;
  if (due >= addMonths(base, -6)) return 2;
  if (due >= addMonths(base, -12)) return 3;
  return 4;
}

/* ---- main analysis ----
   W = { raw:[{...}], master:[{...}], config:{baseDate, accounts, payTerms, fx, bucketRates, gradeRates, sales, salesDays}, tb:[{code,name,amount}], prior:{bySub:{sub:{buckets:[5],prov}}, over120:[{code,name,amount}]} } */
function analyze(W, baseOverride) {
  const C = W.config;
  const base = baseOverride != null ? baseOverride : C.baseDate;
  const acc = new Map(C.accounts.map(a => [a.code, a]));
  const pay = new Map(C.payTerms.map(p => [p.code, p]));
  const fx = new Map(Object.entries(C.fx));
  const master = new Map(W.master.map(m => [m.code, m]));
  const reclassTo = (C.accounts.find(a => /국판/.test(a.name)) || C.accounts.find(a => a.sub === SUBS[0]) || {}).code;
  const findings = { reclass: [], dueFilled: [], payFilled: [], unregistered: new Map(), nameDiff: new Map(), noCust: [], negative: [], fxRows: [], futureDoc: [], clearedBefore: [], noRule: [], unknownAcct: [] };

  const rows = W.raw.map((r, i) => {
    const o = { i, ...r };
    const a0 = acc.get(r.acct);
    if (!a0) findings.unknownAcct.push(o);
    o.big0 = a0 ? a0.big : '미분류';
    // 포함여부
    if (r.docDate != null && r.docDate > base) { o.incl = false; o.exReason = '기준일 이후 발생'; findings.futureDoc.push(o); }
    else if (r.clearDate != null && r.clearDate <= base) { o.incl = false; o.exReason = '기준일 이전 반제'; findings.clearedBefore.push(o); }
    else { o.incl = true; o.exReason = ''; }
    // 재분류
    o.finalAcct = r.acct;
    if (o.big0 === '미수금' && /제품매출/.test(r.text || '') && reclassTo) { o.finalAcct = reclassTo; if (o.incl) findings.reclass.push(o); }
    const a = acc.get(o.finalAcct) || { name: r.acctName, big: '미분류', sub: '미분류' };
    o.finalName = a.name; o.big = a.big; o.sub = a.sub;
    // 환산: 선수금(비화폐성)은 거래일 환율 유지
    const isFx = r.cur && r.cur !== 'KRW';
    const nonMonetary = o.big0 === '선수금';
    o.rate = 1;
    if (isFx && !nonMonetary && fx.has(r.cur)) { o.rate = fx.get(r.cur); o.amt = Math.round(r.docAmt * o.rate); }
    else o.amt = r.local;
    if (isFx && o.incl) findings.fxRows.push(o);
    // 지급조건·만기
    o.payEff = r.payT || r.payTM || '';
    if (!r.payT && r.payTM && o.incl) findings.payFilled.push(o);
    if (r.dueDate != null) { o.due = r.dueDate; o.dueSrc = 'SAP'; }
    else {
      const p = pay.get(o.payEff);
      if (p && r.docDate != null) { o.due = (p.base === '월말' ? eomonth(r.docDate) : r.docDate) + p.days; o.dueSrc = 'PayT 산정'; if (o.incl) findings.dueFilled.push(o); }
      else { o.due = null; o.dueSrc = '없음'; if (o.incl && o.big === '외상매출금') findings.noRule.push(o); }
    }
    o.age = base - r.docDate;
    o.over = o.due == null ? null : base - o.due;
    o.matured = o.over != null && o.over > 0;
    o.bucket = bucketOf(o.age);
    o.disc = discOf(o.due, base);
    // 거래선
    const m = master.get(r.cust);
    o.custName = m ? m.name : normName(r.custName);
    o.grade = m ? m.grade : (r.cust ? '미등록' : '');
    o.region = m ? m.region : '';
    if (o.incl) {
      if (!r.cust) findings.noCust.push(o);
      else if (!m) { const u = findings.unregistered.get(r.cust) || { code: r.cust, name: r.custName, n: 0, amt: 0 }; u.n++; u.amt += o.amt; findings.unregistered.set(r.cust, u); }
      else if (r.custName && r.custName !== m.name) { const k = r.cust; const u = findings.nameDiff.get(k) || { code: k, raw: r.custName, master: m.name, n: 0 }; u.n++; findings.nameDiff.set(k, u); }
      if (o.big === '외상매출금' && o.amt < 0) findings.negative.push(o);
    }
    // 충당금
    o.prov = 0;
    if (o.incl && (o.big === '외상매출금' || o.big === '미수금') && r.cust && o.amt > 0) {
      let rate = C.bucketRates[o.bucket];
      if (m && C.gradeRates[m.grade] != null) rate = C.gradeRates[m.grade];
      o.provRate = rate; o.prov = Math.round(o.amt * rate);
    }
    return o;
  });

  const inc = rows.filter(r => r.incl);
  const ar = inc.filter(r => r.big === '외상매출금');

  // 소분류 × 구간
  const bySub = {};
  for (const s of SUBS) bySub[s] = { buckets: [0, 0, 0, 0, 0], disc: [0, 0, 0, 0, 0, 0], total: 0, prov: 0, n: 0 };
  for (const r of ar) { const b = bySub[r.sub]; if (!b) continue; b.buckets[r.bucket] += r.amt; b.disc[r.disc] += r.amt; b.total += r.amt; b.prov += r.prov; b.n++; }
  const arTotal = SUBS.reduce((s, k) => s + bySub[k].total, 0);
  const ar120 = SUBS.reduce((s, k) => s + bySub[k].buckets[4], 0);
  const provAR = SUBS.reduce((s, k) => s + bySub[k].prov, 0);

  // 기타(미수금·선수금)
  const others = {};
  for (const r of inc) if (r.big !== '외상매출금') { const k = r.big; const o = others[k] || (others[k] = { buckets: [0, 0, 0, 0, 0], total: 0, n: 0, prov: 0 }); o.buckets[r.bucket] += r.amt; o.total += r.amt; o.n++; o.prov += r.prov; }

  // 거래선별 (소분류별 피벗)
  const pivot = {};
  for (const s of SUBS) pivot[s] = new Map();
  for (const r of ar) {
    const p = pivot[r.sub]; if (!p) continue;
    const key = r.cust || '(거래선 없음)';
    const c = p.get(key) || { code: key, name: r.custName || '(거래선 없음)', grade: r.grade, buckets: [0, 0, 0, 0, 0], total: 0, prov: 0 };
    c.buckets[r.bucket] += r.amt; c.total += r.amt; c.prov += r.prov; p.set(key, c);
  }
  const pivots = {};
  for (const s of SUBS) pivots[s] = [...pivot[s].values()].sort((a, b) => b.total - a.total);

  // 거래선 전체 (매출채권 기준)
  const custMap = new Map();
  for (const r of ar) {
    if (!r.cust) continue;
    const c = custMap.get(r.cust) || { code: r.cust, name: r.custName, grade: r.grade, region: r.region, total: 0, b: [0, 0, 0, 0, 0], overdue: 0, over90: 0, recent: 0 };
    c.total += r.amt; c.b[r.bucket] += r.amt;
    if (r.over != null && r.over > 0) c.overdue += r.amt;
    if (r.over != null && r.over > 90) c.over90 += r.amt;
    custMap.set(r.cust, c);
  }

  // 120일 이상 vs 전분기
  const prior120 = new Map((W.prior?.over120 || []).map(p => [p.code, p]));
  const risk120 = [];
  const seen = new Set();
  for (const c of custMap.values()) if (c.b[4] > 0) {
    const p = prior120.get(c.code); seen.add(c.code);
    const prev = p ? p.amount : 0;
    let st = !p ? '신규' : c.b[4] > prev * 1.0001 ? '증가' : c.b[4] < prev * 0.9999 ? '감소' : '동일';
    risk120.push({ code: c.code, name: c.name, grade: c.grade, cur: c.b[4], prev, diff: c.b[4] - prev, total: c.total, status: st });
  }
  for (const p of prior120.values()) if (!seen.has(p.code)) {
    const c = custMap.get(p.code);
    risk120.push({ code: p.code, name: c ? c.name : (master.get(p.code)?.name || p.name), grade: master.get(p.code)?.grade || '', cur: 0, prev: p.amount, diff: -p.amount, total: c ? c.total : 0, status: '해소' });
  }
  risk120.sort((a, b) => b.cur - a.cur || b.prev - a.prev);

  // 여신한도 초과
  const credit = [];
  for (const c of custMap.values()) {
    const m = master.get(c.code); if (!m || !m.limit) continue;
    if (c.total > m.limit) credit.push({ code: c.code, name: c.name, grade: m.grade, rating: m.rating, team: m.team, limit: m.limit, used: c.total, over: c.total - m.limit, ratio: c.total / m.limit });
  }
  credit.sort((a, b) => b.over - a.over);

  // 관리등급 vs 실제 연체
  const gradeIssues = [];
  for (const c of custMap.values()) {
    const m = master.get(c.code); if (!m || c.total <= 0) continue;
    const s120 = c.b[4] / c.total, sOver = c.overdue / c.total, sRecent = (c.b[0] + c.b[1]) / c.total;
    let sug = '', why = '';
    if (m.grade === '정상' && c.b[4] > 0 && s120 >= 0.5) { sug = '부실'; why = `120일 이상 비중 ${(s120 * 100).toFixed(0)}%`; }
    else if (m.grade === '정상' && c.b[4] > 0 && s120 >= 0.2) { sug = '주의'; why = `120일 이상 비중 ${(s120 * 100).toFixed(0)}%`; }
    else if (m.grade === '정상' && c.over90 / c.total >= 0.3) { sug = '주의'; why = `만기 90일 초과 비중 ${(c.over90 / c.total * 100).toFixed(0)}%`; }
    else if (m.grade === '주의' && c.b[4] === 0 && sOver < 0.1) { sug = '정상'; why = `120일 이상 없음, 만기경과 비중 ${(sOver * 100).toFixed(0)}%`; }
    else if ((m.grade === '부실' || m.grade === '대손') && sRecent >= 0.5) { sug = '주의'; why = `59일 이하 신규채권 비중 ${(sRecent * 100).toFixed(0)}% (거래 지속 중)`; }
    if (sug) gradeIssues.push({ code: c.code, name: c.name, grade: m.grade, sug, why, total: c.total, b120: c.b[4], overdue: c.overdue, dir: rankG(sug) > rankG(m.grade) ? '상향' : '하향' });
  }
  gradeIssues.sort((a, b) => (a.dir === b.dir ? b.total - a.total : a.dir === '상향' ? -1 : 1));

  // DSO
  const dso = {};
  for (const s of SUBS) { const sales = C.sales[s] || 0; dso[s] = sales ? bySub[s].total / (sales / (C.salesDays || 91)) : null; }
  const salesAll = SUBS.reduce((t, s) => t + (C.sales[s] || 0), 0);
  dso.all = salesAll ? arTotal / (salesAll / (C.salesDays || 91)) : null;

  // 계정대사
  const recon = [];
  const codes = [...new Set([...C.accounts.map(a => a.code), ...W.raw.map(r => r.acct)])];
  const tbMap = new Map((W.tb || []).map(t => [t.code, t]));
  for (const cd of codes) {
    const rs = rows.filter(r => r.acct === cd);
    if (!rs.length && !tbMap.has(cd)) continue;
    const rawSum = rs.reduce((t, r) => t + r.local, 0);
    const exSum = rs.filter(r => !r.incl).reduce((t, r) => t + r.local, 0);
    const reval = rs.filter(r => r.incl).reduce((t, r) => t + (r.amt - r.local), 0);
    const analysis = rawSum - exSum + reval;
    const tb = tbMap.has(cd) ? tbMap.get(cd).amount : null;
    const reclOut = rs.filter(r => r.incl && r.finalAcct !== cd).reduce((t, r) => t + r.amt, 0);
    recon.push({ code: cd, name: acc.get(cd)?.name || tbMap.get(cd)?.name || rs[0]?.acctName || '', big: acc.get(cd)?.big || '', n: rs.length, rawSum, exSum, reval, analysis, tb, diff: tb == null ? null : analysis - tb, reclOut });
  }

  // 전분기 비교
  const compare = {};
  for (const s of SUBS) {
    const p = W.prior?.bySub?.[s];
    compare[s] = { cur: bySub[s].buckets.slice(), prev: p ? p.buckets.slice() : null, curProv: bySub[s].prov, prevProv: p ? p.prov : null };
  }

  return { base, rows, inc, ar, bySub, others, arTotal, ar120, provAR, pivots, custMap, risk120, credit, gradeIssues, dso, recon, compare, findings, reclassTo, hasPrior: !!W.prior, hasTB: !!(W.tb && W.tb.length), sales: C.sales, salesDays: C.salesDays || 91 };
}
function rankG(g) { return { '정상': 0, '주의': 1, '부실': 2, '대손': 3 }[g] ?? 0; }

/* ---- 데이터 점검 목록 ---- */
function checks(A) {
  const F = A.findings, sum = a => a.reduce((t, r) => t + r.amt, 0);
  const L = [];
  L.push({ key: 'clr', sev: F.clearedBefore.length ? 'warn' : 'ok', title: '기준일 이전에 이미 반제된 항목', n: F.clearedBefore.length, amt: F.clearedBefore.reduce((t, r) => t + r.local, 0), how: '미결 항목이 아니므로 연령분석·대사에서 제외' });
  if (F.futureDoc.length) L.push({ key: 'fut', sev: 'warn', title: '증빙일이 기준일 이후인 항목', n: F.futureDoc.length, amt: F.futureDoc.reduce((t, r) => t + r.local, 0), how: '기준일 현재 발생 전이므로 제외' });
  L.push({ key: 'rcl', sev: F.reclass.length ? 'warn' : 'ok', title: '미수금으로 잘못 계상된 제품매출', n: F.reclass.length, amt: sum(F.reclass), how: `외상매출금(${A.reclassTo})으로 재분류해 연령분석에 포함. 시산표 대사는 원계정 기준 유지` });
  L.push({ key: 'fx', sev: 'info', title: '외화 채권 기말 환산', n: F.fxRows.length, amt: F.fxRows.reduce((t, r) => t + (r.amt - r.local), 0), amtLabel: '평가차액', how: '화폐성 채권은 기말환율로 환산. 선수금은 비화폐성이라 거래 당시 금액 유지' });
  L.push({ key: 'due', sev: F.dueFilled.length ? 'info' : 'ok', title: '순만기일이 비어 있는 항목', n: F.dueFilled.length, amt: sum(F.dueFilled), how: 'PayT 규칙(월말·증빙일 기산 + 일수)으로 만기일 산정' });
  L.push({ key: 'pay', sev: F.payFilled.length ? 'info' : 'ok', title: '전표 PayT가 비어 있는 항목', n: F.payFilled.length, amt: sum(F.payFilled), how: '거래선 마스터 지급조건으로 대체' });
  const un = [...F.unregistered.values()];
  L.push({ key: 'unr', sev: un.length ? 'warn' : 'ok', title: '마스터에 없는 거래선코드', n: un.reduce((t, u) => t + u.n, 0), amt: un.reduce((t, u) => t + u.amt, 0), how: '분석에는 포함하되 등급·한도 판단 불가. 마스터 등록 요청 필요', detail: un.map(u => `${u.code} ${u.name}`) });
  const nd = [...F.nameDiff.values()];
  L.push({ key: 'nam', sev: nd.length ? 'info' : 'ok', title: '전표 거래선명이 마스터와 다름', n: nd.reduce((t, u) => t + u.n, 0), amt: null, how: '공백·㈜ 표기 차이 등. 보고서는 마스터 거래선명 사용', detail: nd.slice(0, 8).map(u => `${u.code}: "${u.raw}" → "${u.master}"`) });
  L.push({ key: 'neg', sev: 'info', title: '음수(대변) 매출채권', n: F.negative.length, amt: sum(F.negative), how: '반품·매출할인. 잔액에는 반영, 충당금 계산에서는 0 처리' });
  L.push({ key: 'nc', sev: F.noCust.length ? 'info' : 'ok', title: '거래선코드가 없는 항목', n: F.noCust.length, amt: sum(F.noCust), how: '거래선별 분석·충당금 대상에서 제외, 계정 합계에는 포함' });
  if (F.noRule.length) L.push({ key: 'nr', sev: 'warn', title: '만기일을 정할 수 없는 매출채권', n: F.noRule.length, amt: sum(F.noRule), how: '공시용 연령표에서 "만기없음"으로 분류' });
  if (F.unknownAcct.length) L.push({ key: 'ua', sev: 'warn', title: '계정 매핑에 없는 계정', n: F.unknownAcct.length, amt: F.unknownAcct.reduce((t, r) => t + r.local, 0), how: '미분류로 두고 연령분석에서 제외' });
  return L;
}

/* ---- 자동 코멘트 ---- */
function insights(A) {
  const out = [];
  const share = A.arTotal ? A.ar120 / A.arTotal : 0;
  // 전분기 대비
  if (A.hasPrior) {
    let prevTot = 0, prev120 = 0;
    for (const s of SUBS) { const p = A.compare[s].prev; if (p) { prevTot += p.reduce((a, b) => a + b, 0); prev120 += p[4]; } }
    if (prevTot) out.push({ k: 'trend', v: { prevTot, prev120, curTot: A.arTotal, cur120: A.ar120 } });
  }
  out.share = share;
  return out;
}

if (typeof module !== 'undefined') module.exports = { analyze, checks, insights, toDn, ymd, code, num, normName, BUCKETS, DISC, SUBS, dn, eomonth, addMonths };
