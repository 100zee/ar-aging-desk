/* ===== 샘플 데이터 생성기 =====
   거래선·금액은 모두 가상. 시드가 고정이라 매번 같은 파일이 나온다.
   결과는 엑셀 시트와 같은 모양(행 배열)이라 업로드 파일과 똑같이 parser를 거친다. */

function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SAMPLE_BASE = dn(2026, 5, 30); // 2026-06-30
const SAMPLE_FILE = 'sample_262Q_open_items.xlsx';
const SAMPLE_ACCOUNTS = [
  ['11141110', '외상매출금 국판', '외상매출금', '외상매출금 내수'],
  ['11141150', '외상매출금 직수출', '외상매출금', '외상매출금 수출'],
  ['11141170', '외상매출금 LOCAL', '외상매출금', '외상매출금 수출'],
  ['11141190', '외상매출금 기타', '외상매출금', '외상매출금 내수'],
  ['11143130', '받을어음타수', '외상매출금', '외상매출금 내수'],
  ['11143170', '전자어음타수', '외상매출금', '외상매출금 내수'],
  ['11143150', '구매카드', '외상매출금', '외상매출금 내수'],
  ['11145110', '미수금', '미수금', '미수금'],
  ['11145210', '미수금-리베이트', '미수금', '미수금'],
  ['21151110', '선수금', '선수금', '선수금']
];
const SAMPLE_PAYT = [['D030', '월말', 30], ['D060', '월말', 60], ['D045', '증빙일', 45], ['D090', '월말', 90], ['E030', '증빙일', 30], ['E060', '증빙일', 60], ['E090', '증빙일', 90], ['E120', '증빙일', 120]];
const SAMPLE_FX = { USD: 1385.2, EUR: 1512.6, JPY: 9.48 };
const SAMPLE_RATES = [0.005, 0.01, 0.03, 0.1, 0.3];

function buildSample() {
  const rnd = makeRng(20260630);
  const U = (a, b) => a + rnd() * (b - a);
  const I = (a, b) => Math.floor(U(a, b + 1));
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const gauss = () => { const u = Math.max(rnd(), 1e-9), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const base = SAMPLE_BASE;
  const pay = new Map(SAMPLE_PAYT.map(p => [p[0], { base: p[1], days: p[2] }]));
  const dueOf = (doc, pt) => { const p = pay.get(pt); return (p.base === '월말' ? eomonth(doc) : doc) + p.days; };

  /* ---- 거래선 ---- */
  const preK = ['한빛', '다온', '이음', '늘봄', '청솔', '미래', '누리', '새길', '보람', '한결', '바른', '온누리', '가람', '세움', '푸른', '하늘', '솔빛', '금강', '태양', '동해', '서해', '남산', '북악', '대한', '신성', '우진', '성원', '동성', '한울', '아름', '초록', '새봄', '은하', '별빛', '해든', '다솜', '라온', '미소', '소망', '희망'];
  const sufK = ['포장', '지류', '인쇄', '라벨', 'P&P', '지업', '문구', '산업', '팩', '페이퍼', '컨버팅', '패키지'];
  const preE = ['NOVA', 'ORION', 'ATLAS', 'SUMMIT', 'VERTEX', 'KESTREL', 'MOSAIC', 'LUMEN', 'BAYLINE', 'CEDAR', 'HARBOR', 'PINNACLE', 'MERIDIAN', 'SILVERLINE', 'NORTHWIND', 'BLUEPEAK', 'REDWOOD', 'ASTER', 'CORAL', 'FALCON', 'GRANITE', 'HORIZON', 'IRIS', 'JADE', 'KITE', 'LOTUS', 'MAPLE', 'NEXUS', 'OAKRIDGE', 'POLARIS', 'QUARTZ', 'RIVERSTONE', 'SAPPHIRE', 'TERRA', 'UNITY', 'VALLEY', 'WILLOW', 'ZENITH', 'ARCADIA', 'BEACON'];
  const sufE = ['PACKAGING LTD', 'PRINT GMBH', 'PAPER S A', 'CONVERTING LLC', 'GRAPHICS PTY LTD'];
  const custs = [];
  for (let i = 0; i < 106; i++) {
    const n = preK[i % 40] + sufK[(i * 7 + Math.floor(i / 40) * 5) % 12];
    const f = i % 5;
    const name = f < 2 ? '(주)' + n : f === 2 ? n + '(주)' : f === 3 ? '주식회사 ' + n : '(유)' + n;
    custs.push({ code: String(110101 + i * 3), name, region: '내수', team: pick(['영업1팀', '영업2팀', '영업3팀']), term: pick(['D030', 'D060', 'D060', 'D045', 'D090']), cur: 'KRW' });
  }
  for (let i = 0; i < 40; i++) {
    const suf = sufE[i % 5];
    custs.push({ code: String(206101 + i * 2), name: preE[i] + ' ' + suf, region: '수출', team: i % 2 ? '해외영업1팀' : '해외영업2팀', term: pick(['E060', 'E090', 'E090', 'E120', 'E030']), cur: /GMBH|S A/.test(suf) ? 'EUR' : i % 13 === 7 ? 'JPY' : 'USD' });
  }
  for (const c of custs) {
    c.w = Math.exp(gauss() * 0.85);
    const r = rnd();
    c.profile = r < 0.85 ? 'good' : 'slow';
    c.grade = '정상'; c.limitF = U(1.25, 2.6);
    c.rating = pick(['A+', 'A', 'A', 'A-', 'BBB+', 'BBB', 'BB']);
  }
  const dom = custs.filter(c => c.region === '내수'), exp = custs.filter(c => c.region === '수출');
  // 이야기가 되도록 몇 곳은 성격을 정해 둔다
  Object.assign(exp[0], { w: 5.5, profile: 'bad', limitF: 0.74 });
  Object.assign(exp[1], { w: 3.2, profile: 'bad', grade: '주의' });
  Object.assign(exp[9], { w: 0.9, profile: 'veryBad' });
  Object.assign(exp[10], { profile: 'good', grade: '주의' });
  Object.assign(exp[7], { w: 1.6, limitF: 0.93 });
  Object.assign(exp[17], { w: 1.2, profile: 'bad' });
  Object.assign(dom[33], { w: 1.1, profile: 'bad', grade: '주의' });
  Object.assign(dom[2], { w: 1.8, profile: 'bad' });
  Object.assign(dom[6], { w: 1.4, profile: 'veryBad', grade: '부실' });
  Object.assign(dom[5], { w: 1.5, profile: 'good', grade: '부실' });
  Object.assign(dom[4], { w: 1.6, profile: 'good', grade: '주의' });
  Object.assign(dom[10], { profile: 'good', grade: '주의' });
  Object.assign(dom[13], { w: 0.4, profile: 'dead', grade: '대손' });
  Object.assign(dom[1], { w: 2.4, profile: 'good', limitF: 0.84 });
  Object.assign(dom[12], { w: 0.5, profile: 'good', limitF: 0.88 });
  Object.assign(dom[27], { profile: 'slow', grade: '주의' });

  /* ---- 전표 ---- */
  const raw = [];
  const acctName = new Map(SAMPLE_ACCOUNTS.map(a => [a[0], a[1]]));
  const histRate = cur => SAMPLE_FX[cur] * (1 + gauss() * 0.018);
  function ageFor(profile, T) {
    const r = rnd();
    if (profile === 'good') return r < 0.94 ? I(0, Math.min(T + 18, 118)) : I(T + 18, Math.min(T + 70, 119));
    if (profile === 'slow') return r < 0.68 ? I(0, T + 20) : r < 0.975 ? I(Math.min(T + 20, 110), 119) : I(120, 210);
    if (profile === 'bad') return r < 0.5 ? I(0, T + 15) : r < 0.74 ? I(Math.min(T + 15, 100), 119) : I(120, 430);
    if (profile === 'veryBad') return r < 0.15 ? I(0, 59) : r < 0.25 ? I(60, 119) : I(120, 520);
    return I(200, 640); // dead
  }
  function push(o) {
    const doc = o.doc;
    let clear = null;
    const r = rnd();
    if (o.allowClear !== false && doc < base && r < 0.0085) clear = doc + I(1, base - doc); // 기준일 전에 이미 반제
    else if (r < 0.1) clear = base + I(1, 45); // 기준일 이후 반제(기준일 현재는 미결)
    const cur = o.cur || 'KRW';
    let docAmt = o.krw, local = o.krw;
    if (cur !== 'KRW') { const h = histRate(cur); docAmt = Math.round(o.krw / h * 100) / 100; local = Math.round(docAmt * h); }
    raw.push([o.acct, acctName.get(o.acct), o.text, o.cust ? o.cust.code : '', o.cust ? (o.custName || o.cust.name) : '', o.cust ? o.cust.term : '', o.payT === undefined ? (o.cust ? o.cust.term : '') : o.payT,
      doc, local, docAmt, cur, o.due, clear]);
  }
  const ym = d => { const x = new Date(d * DAY); return String(x.getUTCFullYear()).slice(2) + '.' + String(x.getUTCMonth() + 1).padStart(2, '0'); };
  const totW = { 내수: dom.reduce((t, c) => t + c.w, 0), 수출: exp.reduce((t, c) => t + c.w, 0) };
  for (const c of custs) {
    const isDom = c.region === '내수';
    const nRows = Math.max(3, Math.round(c.w / totW[c.region] * (isDom ? 3260 : 1010)));
    const avg = (isDom ? 30e6 : 52e6) * U(0.6, 1.4);
    const T = pay.get(c.term).days;
    // 마스터와 표기가 다른 거래선명(㈜·공백)
    const variant = isDom && dom.indexOf(c) % 9 === 0 ? (c.name.includes('(주)') ? c.name.replace('(주)', '㈜') : c.name.replace(' ', '  ')) : null;
    for (let k = 0; k < nRows; k++) {
      const age = ageFor(c.profile, T);
      const doc = base - age;
      let acct, cur = 'KRW';
      if (isDom) { const r = rnd(); acct = r < 0.86 ? '11141110' : r < 0.89 ? '11141190' : r < 0.9 ? '11143130' : r < 0.975 ? '11143170' : '11143150'; }
      else if (rnd() < 0.06) acct = '11141170';
      else { acct = '11141150'; cur = c.cur; }
      let krw = Math.round(avg * U(0.25, 1.75) / 1000) * 1000, text = (isDom ? '제품매출 ' : 'EXPORT SALES ') + ym(doc);
      if (rnd() < 0.032) { krw = -Math.round(krw * U(0.05, 0.4) / 1000) * 1000; text = pick(['매출할인 ', '반품 ', '단가소급 ']) + ym(doc); }
      const payT = rnd() < 0.05 ? '' : c.term;
      const due = rnd() < 0.012 ? null : dueOf(doc, c.term);
      push({ acct, text, cust: c, custName: variant && rnd() < 0.7 ? variant : null, payT, doc, krw, cur, due });
    }
  }
  // 마스터에 없는 거래선
  const ghosts = [{ code: '110951', name: '(주)신일포장', term: 'D060' }, { code: '110952', name: '대명지류(주)', term: 'D030' }];
  ghosts.forEach((g, gi) => { for (let k = 0; k < 4 - gi; k++) { const doc = base - I(0, 80); push({ acct: '11141110', text: '제품매출 ' + ym(doc), cust: g, doc, krw: Math.round(U(8e6, 26e6) / 1000) * 1000, due: dueOf(doc, g.term), allowClear: false }); } });
  // 미수금: 기타 미수, 제품매출 오분류 5건, 거래선 없는 항목
  const misc = ['설비 매각대금', '임대료', '보험금 청구', '스크랩 매각', '용역대금', '운송비 대납'];
  for (let k = 0; k < 26; k++) { const doc = base - I(3, 200); const c = k < 9 ? null : pick(dom); push({ acct: '11145110', text: pick(misc), cust: c, payT: '', doc, krw: Math.round(U(4e6, 60e6) / 1000) * 1000, due: c ? doc + 30 : null, allowClear: false }); }
  for (let k = 0; k < 5; k++) { const c = dom[15 + k * 9]; const doc = base - I(5, 70); push({ acct: '11145110', text: '제품매출 ' + ym(doc) + ' 오기표', cust: c, doc, krw: Math.round(U(25e6, 65e6) / 1000) * 1000, due: dueOf(doc, c.term), allowClear: false }); }
  for (let k = 0; k < 12; k++) { const c = k < 4 ? exp[k * 3] : pick(dom); const doc = base - I(10, 150); push({ acct: '11145210', text: '판매장려금 환급', cust: c, payT: '', doc, krw: Math.round(U(5e6, 40e6) / 1000) * 1000, cur: k < 4 ? c.cur : 'KRW', due: doc + 60, allowClear: false }); }
  // 선수금(음수). 외화분은 비화폐성이라 환산하지 않는다
  for (let k = 0; k < 40; k++) { const c = k < 10 ? pick(exp) : pick(dom); const doc = base - I(0, 120); push({ acct: '21151110', text: '선수금 입금', cust: c, payT: '', doc, krw: -Math.round(U(20e6, 180e6) / 1000) * 1000, cur: k < 10 ? c.cur : 'KRW', due: doc, allowClear: false }); }

  /* ---- 시산표: 기준일 현재 미결 잔액(화폐성 외화는 기말환율 평가 후) ---- */
  const tbSum = new Map(SAMPLE_ACCOUNTS.map(a => [a[0], 0]));
  for (const r of raw) {
    const [acct, , , , , , , doc, local, docAmt, cur, , clear] = r;
    if (doc > base || (clear != null && clear <= base)) continue;
    const reval = cur !== 'KRW' && acct !== '21151110';
    tbSum.set(acct, tbSum.get(acct) + (reval ? Math.round(docAmt * SAMPLE_FX[cur]) : local));
  }

  /* ---- 거래선 마스터: 여신한도는 실제 잔액 × 배수 ---- */
  const arByCust = new Map();
  for (const r of raw) {
    const [acct, , , cust, , , , doc, local, docAmt, cur, , clear] = r;
    if (!/^1114/.test(acct) || doc > base || (clear != null && clear <= base)) continue;
    arByCust.set(cust, (arByCust.get(cust) || 0) + (cur !== 'KRW' ? docAmt * SAMPLE_FX[cur] : local));
  }
  const master = custs.map(c => [c.code, c.name, c.region, c.team, c.rating, Math.max(1e8, Math.round((arByCust.get(c.code) || 0) * c.limitF / 1e8) * 1e8), c.grade]);

  const serial = d => d == null ? null : d + 25569;
  const sheets = {
    RAW_채권원장: [['계정코드', '계정명', '텍스트', '거래선코드', '거래선명', '지급조건-마스터', 'PayT', '증빙일', '현지통화금액', '전표통화금액', '통화', '순만기일', '반제일']]
      .concat(raw.map(r => [r[0], r[1], r[2], r[3], r[4], r[5], r[6], serial(r[7]), r[8], r[9], r[10], serial(r[11]), serial(r[12])])),
    거래선마스터: [['거래선코드', '거래선명', '구분', '영업팀', '신용등급', '여신한도(원)', '관리등급']].concat(master),
    기준정보: buildConfigSheet(),
    시산표: [['계정코드', '계정명', '잔액(원)']].concat(SAMPLE_ACCOUNTS.map(a => [a[0], a[1], tbSum.get(a[0])]))
  };
  sheets.전분기_요약 = buildPriorSheet(sheets, rnd);
  return sheets;

  function buildConfigSheet() {
    const g = [['기준일', serial(base)], [], ['계정코드', '계정명', '대분류', '소분류', '', 'PayT', '기산기준', '일수', '', '통화', '기말환율', '', '구분', '설정률', '', '소분류', '매출액']];
    const rateRows = BUCKETS.map((b, i) => [b, SAMPLE_RATES[i]]).concat([['부실', 0.5], ['대손', 1]]);
    for (let i = 0; i < 10; i++) {
      const a = SAMPLE_ACCOUNTS[i] || ['', '', '', ''], p = SAMPLE_PAYT[i] || ['', '', ''], f = Object.entries(SAMPLE_FX)[i] || ['', ''], r = rateRows[i] || ['', ''];
      g.push([a[0], a[1], a[2], a[3], '', p[0], p[1], p[2], '', f[0], f[1], '', r[0], r[1], '', '', '']);
    }
    return g; // 매출액은 분석 후 채운다(buildPriorSheet)
  }
}

/* 전분기 요약과 분기 매출액은 당분기 분석 결과를 바탕으로 그럴듯하게 만든다 */
function buildPriorSheet(sheets, rnd) {
  const W0 = parseBook(sheets).W;
  const A = analyze(W0);
  const cfg = sheets.기준정보;
  const salesDom = Math.round(A.bySub[SUBS[0]].total * 91 / 55.4 / 1e8) * 1e8;
  const salesExp = Math.round(A.bySub[SUBS[1]].total * 91 / 79.2 / 1e8) * 1e8;
  cfg[3][15] = SUBS[0]; cfg[3][16] = salesDom;
  cfg[4][15] = SUBS[1]; cfg[4][16] = salesExp;
  cfg[5][15] = '분기일수'; cfg[5][16] = 91;

  const f = [[0.93, 1.06, 0.92, 0.83, 0.8], [0.94, 0.95, 0.9, 0.88, 0.85]];
  const rows = [['소분류', ...BUCKETS, '충당금']];
  SUBS.forEach((s, i) => {
    const b = A.bySub[s].buckets.map((v, j) => Math.round(v * f[i][j] / 1000) * 1000);
    rows.push([s, ...b, Math.round(A.bySub[s].prov * 0.9 / 1000) * 1000]);
  });
  rows.push([]);
  rows.push(['거래선코드', '거래선명', '120일 이상 잔액']);
  let k = 0;
  for (const c of A.custMap.values()) {
    if (c.b[4] <= 0) continue;
    k++;
    if (k % 6 === 2) continue; // 이번 분기 신규 발생
    const fac = c.grade === '대손' ? 1 : k % 5 === 0 ? 1.12 + rnd() * 0.2 : 0.62 + rnd() * 0.3;
    rows.push([c.code, c.name, Math.round(c.b[4] * fac / 1000) * 1000]);
  }
  // 전분기엔 있었는데 이번 분기에 해소된 곳
  const clean = [...A.custMap.values()].filter(c => c.b[4] === 0 && c.total > 3e8).slice(0, 3);
  for (const c of clean) rows.push([c.code, c.name, Math.round(c.total * (0.08 + rnd() * 0.1) / 1000) * 1000]);
  return rows;
}

function sampleWorkbookFile(sheets) {
  const wb = XLSX.utils.book_new();
  const dateCols = { RAW_채권원장: [7, 11, 12], 기준정보: [] };
  for (const [name, aoa] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = 1; R <= range.e.r; R++) for (let C = 0; C <= range.e.c; C++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (!cell || cell.t !== 'n') continue;
      if ((dateCols[name] || []).includes(C) || (name === '기준정보' && R === 0 && C === 1)) cell.z = 'yyyy-mm-dd';
      else if (Math.abs(cell.v) >= 1000) cell.z = '#,##0';
    }
    if (name === '기준정보') { const c = ws['B1']; if (c) c.z = 'yyyy-mm-dd'; }
    ws['!cols'] = aoa[0].map(() => ({ wch: 14 }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  XLSX.writeFile(wb, SAMPLE_FILE);
}
