/* ===== 엑셀 → 분석 입력(W) =====
   입력은 { 시트명: 행 배열 } 형태. 업로드 파일과 샘플이 같은 경로를 탄다. */

const DEFAULT_RATES = [0.005, 0.01, 0.03, 0.1, 0.3];
const DEFAULT_GRADE_RATES = { 부실: 0.5, 대손: 1 };

function normH(s) { return String(s == null ? '' : s).replace(/[\s()（）·_\-/]/g, '').toLowerCase(); }
function cellStr(v) { return v == null ? '' : String(v).trim(); }

const SHEET_KEYS = {
  raw: ['raw채권원장', '채권원장', 'raw'],
  master: ['거래선마스터', '거래처마스터', '마스터'],
  config: ['기준정보'],
  tb: ['시산표'],
  prior: ['전분기요약', '전분기']
};
const RAW_COLS = {
  acct: ['계정코드', 'g/l계정', '계정'], acctName: ['계정명', '계정과목'], text: ['텍스트', '적요'],
  cust: ['거래선코드', '거래처코드', '고객코드', '고객'], custName: ['거래선명', '거래처명', '고객명'],
  payTM: ['지급조건마스터'], payT: ['payt', '지급조건'],
  docDate: ['증빙일', '증빙일자'], local: ['현지통화금액', '현지통화액', '금액현지통화'], docAmt: ['전표통화금액', '전표통화액', '금액전표통화'],
  cur: ['통화', '전표통화'], dueDate: ['순만기일', '만기일'], clearDate: ['반제일', '반제일자', '정리일']
};
const MASTER_COLS = {
  code: ['거래선코드', '거래처코드'], name: ['거래선명', '거래처명'], region: ['구분', '내수수출'], team: ['영업팀', '담당팀'],
  rating: ['신용등급'], limit: ['여신한도원', '여신한도'], grade: ['관리등급', '등급']
};
const TB_COLS = { code: ['계정코드'], name: ['계정명'], amount: ['잔액원', '잔액', '금액'] };

function findSheet(sheets, key) {
  const names = Object.keys(sheets);
  for (const k of SHEET_KEYS[key]) { const hit = names.find(n => normH(n) === k); if (hit) return hit; }
  for (const k of SHEET_KEYS[key]) { const hit = names.find(n => normH(n).includes(k)); if (hit) return hit; }
  return null;
}

/* 머리글 행 찾기: 앞쪽 20행 중 별칭이 가장 많이 맞는 행 */
function locateHeader(aoa, spec) {
  let best = { row: -1, map: {}, hits: 0 };
  for (let r = 0; r < Math.min(aoa.length, 20); r++) {
    const row = (aoa[r] || []).map(normH);
    const map = {}; let hits = 0;
    for (const [key, aliases] of Object.entries(spec)) {
      for (const a of aliases) { const c = row.indexOf(a); if (c >= 0 && !Object.values(map).includes(c)) { map[key] = c; hits++; break; } }
    }
    if (hits > best.hits) best = { row: r, map, hits };
  }
  return best;
}
function readTable(aoa, spec, required, sheetName) {
  const h = locateHeader(aoa, spec);
  const miss = required.filter(k => h.map[k] == null);
  if (h.row < 0 || miss.length) throw new Error(`'${sheetName}' 시트에서 필수 열을 찾지 못했어요: ${miss.map(k => spec[k][0]).join(', ')}`);
  const out = [];
  for (let r = h.row + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    if (row.every(v => v == null || v === '')) continue;
    const o = {};
    for (const [k, c] of Object.entries(h.map)) o[k] = row[c];
    out.push(o);
  }
  return out;
}

function parseRate(v) {
  if (v == null || v === '') return null;
  let n = typeof v === 'number' ? v : parseFloat(String(v).replace('%', ''));
  if (isNaN(n)) return null;
  if (typeof v === 'string' && v.includes('%')) n /= 100; else if (n > 1) n /= 100;
  return n;
}
function bucketIndexOf(label) {
  const s = normH(label); const m = s.match(/\d+/);
  if (!m || !/일/.test(s)) return -1;
  const n = +m[0];
  return n < 30 ? 0 : n < 60 ? 1 : n < 90 ? 2 : n < 120 ? 3 : 4;
}

/* 기준정보: 표 여러 개가 옆으로 붙어 있는 시트 */
function parseConfig(aoa, notices) {
  const C = { baseDate: null, accounts: [], payTerms: [], fx: {}, bucketRates: null, gradeRates: {}, sales: {}, salesDays: 91 };
  const cells = [];
  aoa.forEach((row, r) => (row || []).forEach((v, c) => { if (typeof v === 'string') cells.push({ r, c, k: normH(v) }); }));
  const at = (r, c) => (aoa[r] || [])[c];
  const find = k => cells.find(x => x.k === k);
  const colNear = (r, c, aliases, from = -3, to = 6) => { for (let d = from; d <= to; d++) { const k = normH(at(r, c + d)); if (aliases.includes(k)) return c + d; } return -1; };
  const down = (r, c, fn) => { for (let i = r + 1; i < aoa.length; i++) { const v = at(i, c); if (v == null || v === '') break; fn(i, v); } };

  const bd = find('기준일');
  if (bd) { const v = at(bd.r, bd.c + 1) != null && at(bd.r, bd.c + 1) !== '' ? at(bd.r, bd.c + 1) : at(bd.r + 1, bd.c); C.baseDate = toDn(v); }

  const ac = find('계정코드');
  if (ac) {
    const cn = colNear(ac.r, ac.c, ['계정명']), cb = colNear(ac.r, ac.c, ['대분류']), cs = colNear(ac.r, ac.c, ['소분류']);
    down(ac.r, ac.c, (i, v) => C.accounts.push({ code: code(v), name: cellStr(at(i, cn)), big: cellStr(at(i, cb)) || '미분류', sub: cellStr(at(i, cs)) || cellStr(at(i, cb)) }));
  }
  const pt = find('payt');
  if (pt) {
    const cb = colNear(pt.r, pt.c, ['기산기준', '기산', '기준']), cd = colNear(pt.r, pt.c, ['일수', '기간']);
    down(pt.r, pt.c, (i, v) => C.payTerms.push({ code: code(v), base: /월말/.test(cellStr(at(i, cb))) ? '월말' : '증빙일', days: num(at(i, cd)) }));
  }
  const fx = find('통화');
  if (fx) {
    const cr = colNear(fx.r, fx.c, ['기말환율', '환율']);
    down(fx.r, fx.c, (i, v) => { const rate = num(at(i, cr)); if (rate) C.fx[cellStr(v).toUpperCase()] = rate; });
  }
  const rt = find('설정률');
  if (rt) {
    const rates = DEFAULT_RATES.slice(); let got = 0;
    down(rt.r, rt.c - 1, (i, label) => {
      const rate = parseRate(at(i, rt.c)); if (rate == null) return;
      const b = bucketIndexOf(label);
      if (b >= 0) { rates[b] = rate; got++; }
      else if (/부실|대손/.test(cellStr(label))) C.gradeRates[cellStr(label)] = rate;
    });
    if (got) C.bucketRates = rates;
  }
  const sl = find('매출액');
  if (sl) {
    down(sl.r, sl.c - 1, (i, label) => {
      const k = normH(label), v = num(at(i, sl.c));
      if (/일수/.test(k)) { if (v) C.salesDays = v; return; }
      const sub = SUBS.find(s => normH(s) === k) || (/수출/.test(k) ? SUBS[1] : /내수/.test(k) ? SUBS[0] : null);
      if (sub) C.sales[sub] = v;
    });
  }
  return C;
}

/* 기준정보가 없을 때 계정명으로 짐작하는 매핑 */
function guessAccount(code, name) {
  const n = name || '';
  if (/선수/.test(n)) return { code, name: n, big: '선수금', sub: '선수금' };
  if (/미수/.test(n)) return { code, name: n, big: '미수금', sub: '미수금' };
  if (/수출|local|export/i.test(n)) return { code, name: n, big: '외상매출금', sub: SUBS[1] };
  return { code, name: n, big: '외상매출금', sub: SUBS[0] };
}
function quarterEndOf(d) {
  const x = new Date(d * DAY);
  return dn(x.getUTCFullYear(), Math.floor(x.getUTCMonth() / 3) * 3 + 3, 0);
}

function parsePrior(aoa) {
  const P = { bySub: {}, over120: [] };
  for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const keys = row.map(normH);
    const bcols = row.map(bucketIndexOf);
    if (keys.some(k => k === '소분류' || k === '구분') && bcols.filter(b => b >= 0).length >= 4) {
      const lc = keys.findIndex(k => k === '소분류' || k === '구분'), pc = keys.findIndex(k => /충당금/.test(k));
      for (let i = r + 1; i < aoa.length; i++) {
        const lab = cellStr((aoa[i] || [])[lc]); if (!lab) break;
        const sub = SUBS.find(s => normH(s) === normH(lab)); if (!sub) continue;
        const b = [0, 0, 0, 0, 0]; bcols.forEach((bi, c) => { if (bi >= 0) b[bi] += num(aoa[i][c]); });
        P.bySub[sub] = { buckets: b, prov: pc >= 0 ? num(aoa[i][pc]) : 0 };
      }
    }
    const cc = keys.indexOf('거래선코드');
    if (cc >= 0) {
      const nc = keys.indexOf('거래선명');
      let ac = keys.findIndex(k => /120/.test(k)); if (ac < 0) ac = keys.findIndex(k => /잔액|금액/.test(k));
      for (let i = r + 1; i < aoa.length; i++) {
        const cd = code((aoa[i] || [])[cc]); if (!cd) break;
        P.over120.push({ code: cd, name: cellStr(aoa[i][nc]), amount: num(aoa[i][ac]) });
      }
    }
  }
  return Object.keys(P.bySub).length || P.over120.length ? P : null;
}

function parseBook(sheets) {
  const notices = [];
  const nRaw = findSheet(sheets, 'raw'), nMaster = findSheet(sheets, 'master');
  if (!nRaw) throw new Error("'RAW_채권원장' 시트가 없어요. SAP 미결항목을 이 이름의 시트에 넣어 주세요.");
  if (!nMaster) throw new Error("'거래선마스터' 시트가 없어요. 거래선 구분·등급·여신한도가 필요해요.");

  const raw = readTable(sheets[nRaw], RAW_COLS, ['acct', 'docDate', 'local'], nRaw)
    .filter(r => code(r.acct))
    .map(r => ({
      acct: code(r.acct), acctName: cellStr(r.acctName), text: cellStr(r.text), cust: code(r.cust), custName: cellStr(r.custName),
      payTM: code(r.payTM), payT: code(r.payT), docDate: toDn(r.docDate), local: num(r.local), docAmt: r.docAmt == null || r.docAmt === '' ? num(r.local) : num(r.docAmt),
      cur: cellStr(r.cur).toUpperCase() || 'KRW', dueDate: toDn(r.dueDate), clearDate: toDn(r.clearDate)
    }));
  if (!raw.length) throw new Error(`'${nRaw}' 시트에 전표 행이 없어요.`);
  const noDoc = raw.filter(r => r.docDate == null).length;
  if (noDoc) notices.push(`증빙일을 읽지 못한 행 ${noDoc}건은 120일 이상 구간으로 잡혀요. 날짜 형식을 확인해 주세요.`);

  const master = readTable(sheets[nMaster], MASTER_COLS, ['code', 'name'], nMaster)
    .filter(m => code(m.code))
    .map(m => ({ code: code(m.code), name: normName(m.name), region: /수출/.test(cellStr(m.region)) ? '수출' : '내수', team: cellStr(m.team), rating: cellStr(m.rating), limit: num(m.limit), grade: cellStr(m.grade) || '정상' }));

  const nCfg = findSheet(sheets, 'config');
  const C = nCfg ? parseConfig(sheets[nCfg], notices) : { baseDate: null, accounts: [], payTerms: [], fx: {}, bucketRates: null, gradeRates: {}, sales: {}, salesDays: 91 };
  if (!nCfg) notices.push('기준정보 시트가 없어 기본값으로 계산했어요.');
  if (C.baseDate == null) {
    const maxDoc = Math.max(...raw.map(r => r.docDate).filter(d => d != null));
    C.baseDate = quarterEndOf(maxDoc);
    notices.push(`기준일이 없어 ${ymd(C.baseDate)}(마지막 증빙일이 속한 분기말)로 잡았어요. 사이드바에서 바꿀 수 있어요.`);
  }
  if (!C.accounts.length) {
    const seen = new Map(); raw.forEach(r => { if (!seen.has(r.acct)) seen.set(r.acct, guessAccount(r.acct, r.acctName)); });
    C.accounts = [...seen.values()];
    notices.push('계정 매핑이 없어 계정명으로 대분류·소분류를 짐작했어요(선수/미수/수출 키워드).');
  }
  if (!C.bucketRates) { C.bucketRates = DEFAULT_RATES.slice(); if (nCfg) notices.push('충당금 설정률이 없어 기본값(0.5%·1%·3%·10%·30%)을 썼어요.'); }
  for (const [g, v] of Object.entries(DEFAULT_GRADE_RATES)) if (C.gradeRates[g] == null) C.gradeRates[g] = v;
  const curs = [...new Set(raw.filter(r => r.cur !== 'KRW').map(r => r.cur))];
  const noFx = curs.filter(c => C.fx[c] == null);
  if (noFx.length) notices.push(`기말환율이 없는 통화(${noFx.join(', ')})는 장부 원화금액 그대로 썼어요.`);
  if (!C.payTerms.length) notices.push('PayT 규칙이 없어 순만기일이 빈 항목은 만기없음으로 분류돼요.');
  if (!SUBS.some(s => C.sales[s])) notices.push('분기 매출액이 없어 매출채권 회전일수(DSO)는 계산하지 않았어요.');

  const nTb = findSheet(sheets, 'tb');
  const tb = nTb ? readTable(sheets[nTb], TB_COLS, ['code', 'amount'], nTb).filter(t => code(t.code)).map(t => ({ code: code(t.code), name: cellStr(t.name), amount: num(t.amount) })) : [];
  if (!nTb) notices.push('시산표 시트가 없어 계정대사는 분석 금액만 보여 줘요.');
  const nPrior = findSheet(sheets, 'prior');
  const prior = nPrior ? parsePrior(sheets[nPrior]) : null;
  if (!prior) notices.push('전분기 요약이 없어 전분기 비교는 비워 뒀어요.');

  const W = { raw, master, config: C, tb, prior };
  const meta = { rows: raw.length, sheets: Object.keys(sheets).length };
  return { W, notices, meta };
}

/* SheetJS 워크북 → { 시트명: 행 배열 } */
function workbookToSheets(wb) {
  const out = {};
  for (const n of wb.SheetNames) out[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: true });
  return out;
}
