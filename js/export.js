/* ===== 엑셀 내보내기 (금액 단위: 원, 서식 포함) =====
   서식은 xlsx-js-style(SheetJS 호환 포크)로 입힌다. */

const XC = { ink: '15201C', muted: '5F6B66', line: 'DCE2DF', hair: 'EDF0EE', accent: '0F5F58', accentSoft: 'E2EEEB', zebra: 'F6F8F7', crit: 'A92B2B', good: '1B6533', bucket: ['86B6EF', '5598E7', '2A78D6', '1C5CAB', '0D366B'] };
const XCHIP = {
  정상: ['EEF1EF', '45524D'], 주의: ['FFF1D2', '7E5200'], 부실: ['FBE8E6', 'A92B2B'], 대손: ['5E1A1A', 'FFFFFF'], 미등록: [null, '5F6B66'],
  신규: ['FBE8E6', 'A92B2B'], 증가: ['FFF1D2', '7E5200'], 감소: ['E3F1E6', '1B6533'], 해소: ['E3F1E6', '1B6533'], 동일: ['EEF1EF', '45524D'],
  warn: ['FFF1D2', '7E5200', '확인'], info: ['E7EEF8', '1C4F8F', '참고'], ok: ['E3F1E6', '1B6533', '정상'], crit: ['FBE8E6', 'A92B2B', '위험']
};
const XNUM = { n: '#,##0;-#,##0;"–"', d: '#,##0.0;-#,##0.0;"–"', p: '0.0%', f1: '0.0', dt: 'yyyy-mm-dd', diff: '#,##0;-#,##0;0' };
const xThin = c => ({ style: 'thin', color: { rgb: c } });
const xStyleCache = new Map();
function xs(o) {
  const key = JSON.stringify(o);
  if (xStyleCache.has(key)) return xStyleCache.get(key);
  const s = {
    font: { name: '맑은 고딕', sz: o.sz || 10, bold: !!o.bold, color: { rgb: o.color || XC.ink } },
    alignment: { horizontal: o.h || 'left', vertical: 'center', wrapText: !!o.wrap },
    border: o.border || undefined
  };
  if (o.fill) s.fill = { patternType: 'solid', fgColor: { rgb: o.fill } };
  xStyleCache.set(key, s);
  return s;
}

class SheetBuilder {
  constructor(name) { this.name = name; this.rows = []; this.merges = []; this.heights = {}; this.widths = []; this.hot = new Set(); this.zebra = 0; this.hdrRow = null; this.filter = false; this.lastCol = 0; }
  get r() { return this.rows.length; }
  push(cells, height) { if (height) this.heights[this.r] = height; this.rows.push(cells); this.lastCol = Math.max(this.lastCol, cells.length - 1); }
  blank() { this.push([]); }
  title(text, sub) {
    this.push([{ v: text, s: xs({ sz: 16, bold: true }) }], 28);
    this.push([{ v: sub, s: xs({ sz: 9.5, color: XC.muted }) }], 16);
    this.blank();
  }
  section(text) {
    this.push([{ v: text, s: xs({ sz: 12, bold: true, color: XC.accent, border: { bottom: { style: 'medium', color: { rgb: XC.accent } } } }) }], 22);
    this.zebra = 0;
  }
  header(labels, o = {}) {
    this.hot = new Set(o.hot || []);
    labels.forEach((l, i) => { if (/120일 이상$/.test(String(l))) this.hot.add(i); });
    this.hdrRow = this.r; this.hdrCols = labels.length; this.zebra = 0;
    this.push(labels.map(l => {
      const bi = BUCKETS.indexOf(l);
      const fill = bi >= 0 ? XC.bucket[bi] : XC.accent;
      const color = bi === 0 ? XC.ink : 'FFFFFF';
      return { v: l, s: xs({ bold: true, color, fill, h: 'center', wrap: true, border: { top: xThin(XC.line), bottom: xThin(XC.line), left: xThin('FFFFFF'), right: xThin('FFFFFF') } }) };
    }), 30);
  }
  cell(v, kind, o) {
    kind = kind || (typeof v === 'number' ? 'n' : 't');
    const border = { bottom: xThin(XC.hair) };
    const base = { border, fill: o.fill, bold: o.bold };
    if (v == null || v === '') return { v: '', t: 's', s: xs({ ...base, h: kind === 't' ? 'left' : 'center' }) };
    if (kind === 'g' || kind === 's' || kind === 'sev') {
      const chip = XCHIP[v];
      if (!chip) return { v: String(v), t: 's', s: xs({ ...base, h: 'center' }) };
      return { v: chip[2] || String(v), t: 's', s: xs({ ...base, h: 'center', bold: true, fill: chip[0] || o.fill, color: chip[1], border }) };
    }
    if (kind === 't' || kind === 'c') return { v: String(v), t: 's', s: xs({ ...base, h: kind === 'c' ? 'center' : 'left', wrap: o.wrap, color: o.color }) };
    if (kind === 'dt') return { v, t: 'n', z: XNUM.dt, s: xs({ ...base, h: 'center' }) };
    let color = o.color, bold = o.bold;
    if (kind === 'diff') { color = Math.abs(v) < 0.5 ? XC.good : XC.crit; bold = true; }
    const z = kind === 'n' && !Number.isInteger(v) ? (XNUM.amt || XNUM.n) : (XNUM[kind] || XNUM.n);
    return { v, t: 'n', z, s: xs({ ...base, bold, color, h: 'right' }) };
  }
  row(vals, kinds = [], o = {}) {
    const z = this.zebra++ % 2 === 1;
    this.push(vals.map((v, i) => {
      let k = kinds[i], extra = { fill: z ? XC.zebra : undefined };
      if ((k === 'n' || k === 'd' || (!k && typeof v === 'number')) && this.hot.has(i) && v > 0) extra = { ...extra, color: XC.crit, bold: true };
      return this.cell(v, k, extra);
    }), o.height);
  }
  total(vals, kinds = []) {
    const border = { top: { style: 'thin', color: { rgb: XC.ink } }, bottom: { style: 'thin', color: { rgb: XC.ink } } };
    this.push(vals.map((v, i) => {
      const c = this.cell(v, kinds[i], { fill: XC.accentSoft, bold: true });
      c.s = xs({ bold: true, fill: XC.accentSoft, h: c.s.alignment.horizontal, border, color: kinds[i] === 'diff' ? (Math.abs(v) < 0.5 ? XC.good : XC.crit) : undefined });
      return c;
    }), 20);
    this.zebra = 0;
  }
  /* 칩 + 병합된 본문 문장 */
  note(tag, text, span, o = {}) {
    const r = this.r, border = { bottom: xThin(XC.hair) };
    const row = [tag ? this.cell(tag.v, tag.k, {}) : { v: '', t: 's' }];
    row.push({ v: text, t: 's', s: xs({ wrap: true, border, color: o.color }) });
    for (let i = 2; i <= span; i++) row.push({ v: '', t: 's', s: xs({ border }) });
    this.merges.push({ s: { r, c: 1 }, e: { r, c: span } });
    const chars = text.length, lines = Math.max(1, Math.ceil(chars / (span * 12)));
    this.push(row, Math.max(20, lines * 15 + 4));
  }
  build() {
    const ws = {};
    this.rows.forEach((cells, r) => cells.forEach((cell, c) => {
      if (!cell) return;
      ws[XLSX.utils.encode_cell({ r, c })] = cell.t ? cell : { ...cell, t: typeof cell.v === 'number' ? 'n' : 's' };
    }));
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, this.r - 1), c: Math.max(this.lastCol, this.widths.length - 1) } });
    ws['!cols'] = this.widths.map(w => ({ wch: w }));
    ws['!rows'] = this.rows.map((_, r) => (this.heights[r] ? { hpt: this.heights[r] } : {}));
    if (this.merges.length) ws['!merges'] = this.merges;
    if (this.filter && this.hdrRow != null) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: this.hdrRow, c: 0 }, e: { r: this.r - 1, c: this.hdrCols - 1 } }) };
    ws['!views'] = [{ showGridLines: false }];
    return ws;
  }
}

function exportWorkbook(A, W, CK) {
  const UN = UNITS[S.unit] || UNITS.m;
  XNUM.amt = UN.dec ? '#,##0.0;-#,##0.0;"–"' : XNUM.n;
  const raw = n => Math.round(n);                       // 전표 단위 시트(제외항목·채권원장분석)는 항상 원
  const won = n => (n == null ? null : UN.d === 1 ? Math.round(n) : n / UN.d);
  const D = derive(A, W, n => Math.round(n / UN.d).toLocaleString('en-US') + UN.label);
  const dt = d => (d == null ? null : d + 25569);
  const wb = XLSX.utils.book_new();
  const sheet = (name, widths, fn) => { const sb = new SheetBuilder(name); sb.widths = widths; fn(sb); XLSX.utils.book_append_sheet(wb, sb.build(), name); };
  const sub = (extra, unit) => `기준일 ${ymd(A.base)} · ${D.q} · 단위 ${unit || UN.label}${extra ? ' · ' + extra : ''}`;
  const nK = (n, k) => Array(n).fill(k);

  /* 요약 */
  sheet('요약', [24, 17, 17, 17, 17, 17, 17, 17], sb => {
    sb.title('매출채권 연령분석 요약', sub());
    sb.section('핵심 수치');
    sb.header(['항목', '당분기', '전분기', '증감']);
    const kv = (label, cur, prev, kind) => sb.row([label, cur, prev, cur != null && prev != null ? cur - prev : null], ['t', kind, kind, kind]);
    kv('총 매출채권', won(A.arTotal), D.hasPrev ? won(D.prevTot) : null, 'n');
    kv('120일 이상', won(A.ar120), D.hasPrev ? won(D.prev120) : null, 'n');
    kv('120일 이상 비중', D.share, D.prevShare, 'p');
    kv('대손충당금 (매출채권)', won(A.provAR), D.prevProv ? won(D.prevProv) : null, 'n');
    sb.row(['DSO 전체 (일)', A.dso.all != null ? +A.dso.all.toFixed(1) : null], ['t', 'f1']);
    SUBS.forEach(s => sb.row([`DSO ${s} (일)`, A.dso[s] != null ? +A.dso[s].toFixed(1) : null], ['t', 'f1']));
    sb.blank();
    sb.section('발생기준 연령 구성');
    sb.header(['소분류', ...BUCKETS, '합계', '충당금']);
    SUBS.forEach(s => sb.row([s, ...A.bySub[s].buckets.map(won), won(A.bySub[s].total), won(A.bySub[s].prov)], ['t', ...nK(7, 'n')]));
    Object.entries(A.others).forEach(([k, o]) => sb.row([k, ...o.buckets.map(won), won(o.total), won(o.prov)], ['t', ...nK(7, 'n')]));
    sb.total(['외상매출금 합계', ...BUCKETS.map((_, j) => won(sumArr(SUBS.map(s => A.bySub[s].buckets[j])))), won(A.arTotal), won(A.provAR)], ['t', ...nK(7, 'n')]);
    sb.blank();
    sb.section('주요 이슈');
    D.issues.forEach(i => sb.note({ v: i.tag, k: 'c' }, `${i.title} — ${i.body}`, 7));
    sb.blank();
    sb.section('권고사항');
    D.recs.forEach((r, i) => sb.note({ v: String(i + 1), k: 'c' }, stripTags(r), 7));
    if (D.cmpNote) { sb.blank(); sb.note(null, D.cmpNote, 7, { color: XC.muted }); }
  });
  // 이슈 칩: 태그별 색
  {
    const ws = wb.Sheets['요약'];
    const colors = { '120일+': 'crit', '여신': 'warn', '등급': 'info' };
    Object.keys(ws).forEach(ref => {
      const c = ws[ref];
      if (c && c.t === 's' && colors[c.v]) { const chip = XCHIP[colors[c.v]]; c.s = xs({ bold: true, h: 'center', fill: chip[0], color: chip[1], border: { bottom: xThin(XC.hair) } }); }
    });
  }

  /* 내수·수출 연령분석 */
  SUBS.forEach((s, i) => sheet(['내수 연령분석', '수출 연령분석'][i], [13, 32, 10, 14, 14, 14, 14, 15, 16, 10, 14], sb => {
    sb.title(`${s} 거래선별 연령분석`, sub('발생기준 (기준일 − 증빙일)'));
    sb.header(['거래선코드', '거래선명', '관리등급', ...BUCKETS, '합계', '구성비', '충당금']);
    const T = A.bySub[s].total;
    A.pivots[s].forEach(c => sb.row([c.code, c.name, c.grade, ...c.buckets.map(won), won(c.total), T ? c.total / T : 0, won(c.prov)], ['c', 't', 'g', ...nK(5, 'n'), 'n', 'p', 'n']));
    sb.filter = true;
    sb.total(['', '합계', '', ...A.bySub[s].buckets.map(won), won(T), 1, won(A.bySub[s].prov)], ['t', 't', 't', ...nK(5, 'n'), 'n', 'p', 'n']);
  }));

  /* 공시용 */
  sheet('공시용', [20, 15, 15, 15, 15, 15, 15, 16], sb => {
    sb.title('공시용 연령표', sub('만기경과 기준'));
    sb.header(['소분류', ...DISC, '합계']);
    SUBS.forEach(s => sb.row([s, ...A.bySub[s].disc.map(won), won(A.bySub[s].total)], ['t', ...nK(7, 'n')]));
    sb.total(['합계', ...DISC.map((_, j) => won(sumArr(SUBS.map(x => A.bySub[x].disc[j])))), won(A.arTotal)], ['t', ...nK(7, 'n')]);
  });

  /* 전분기비교 */
  sheet('전분기비교', [16, 17, 17, 15, 10, 17, 17, 15, 10], sb => {
    sb.title(`전분기(${D.pq}) 대비 구간별 증감`, sub());
    if (!D.hasPrev) { sb.note(null, '전분기 요약 자료가 없어요.', 3); return; }
    sb.header(['구간', ...SUBS.flatMap(x => [`${x} ${D.pq}`, `${x} ${D.q}`, '증감', '증감률'])]);
    const line = (label, f, total) => {
      const vals = SUBS.flatMap(x => { const p = f(A.compare[x].prev || [0, 0, 0, 0, 0]), q = f(A.compare[x].cur); return [won(p), won(q), won(q - p), p ? q / p - 1 : null]; });
      (total ? sb.total : sb.row).call(sb, [label, ...vals], ['t', ...SUBS.flatMap(() => ['n', 'n', 'n', 'p'])]);
    };
    BUCKETS.forEach((b, j) => line(b, a => a[j]));
    line('합계', sumArr, true);
    sb.row(['충당금', ...SUBS.flatMap(x => { const p = A.compare[x].prevProv || 0, q = A.compare[x].curProv; return [won(p), won(q), won(q - p), p ? q / p - 1 : null]; })], ['t', ...SUBS.flatMap(() => ['n', 'n', 'n', 'p'])]);
    if (D.cmpNote) { sb.blank(); sb.note(null, D.cmpNote, 8, { color: XC.muted }); }
  });

  /* 리스크분석 */
  sheet('리스크분석', [14, 32, 10, 10, 15, 15, 15, 10, 15, 12], sb => {
    sb.title('리스크 거래선', sub());
    sb.section('120일 이상 채권 보유 거래선');
    sb.header(['거래선코드', '거래선명', '구분', '관리등급', D.pq, D.q, '증감', '변동', '총 채권', '총 채권 대비'], { hot: [5] });
    A.risk120.forEach(x => sb.row([x.code, x.name, D.regionOf(x.code), x.grade, won(x.prev), won(x.cur), won(x.diff), x.status, won(x.total), x.total > 0 ? x.cur / x.total : null], ['c', 't', 'c', 'g', 'n', 'n', 'n', 's', 'n', 'p']));
    sb.blank();
    sb.section('여신한도 초과');
    sb.header(['거래선코드', '거래선명', '관리등급', '신용등급', '영업팀', '여신한도', '사용액', '초과액', '사용률']);
    if (!A.credit.length) sb.note(null, '여신한도를 넘은 거래선이 없어요.', 5);
    A.credit.forEach(x => sb.row([x.code, x.name, x.grade, x.rating, x.team, won(x.limit), won(x.used), won(x.over), x.ratio], ['c', 't', 'g', 'c', 't', 'n', 'n', 'n', 'p']));
    sb.blank();
    sb.section('매출채권 회전일수 (DSO)');
    sb.header(['구분', '기말 매출채권', '분기 매출액', '일수', 'DSO (일)', '평균 약정일']);
    SUBS.forEach(x => sb.row([x, won(A.bySub[x].total), A.sales[x] ? won(A.sales[x]) : null, A.salesDays, A.dso[x] != null ? +A.dso[x].toFixed(1) : null, D.avgTerm[x] != null ? +D.avgTerm[x].toFixed(1) : null], ['t', 'n', 'n', 'n', 'f1', 'f1']));
    sb.total(['전체', won(A.arTotal), sumArr(SUBS.map(x => A.sales[x] || 0)) ? won(sumArr(SUBS.map(x => A.sales[x] || 0))) : null, A.salesDays, A.dso.all != null ? +A.dso.all.toFixed(1) : null, null], ['t', 'n', 'n', 'n', 'f1', 'f1']);
    sb.blank();
    sb.section('관리등급 조정 의견');
    sb.header(['거래선코드', '거래선명', '현재', '제안', '방향', '근거', '채권 잔액', '120일 이상', '만기경과']);
    if (!A.gradeIssues.length) sb.note(null, '조정 의견이 없어요.', 5);
    A.gradeIssues.forEach(g => sb.row([g.code, g.name, g.grade, g.sug, g.dir, g.why, won(g.total), won(g.b120), won(g.overdue)], ['c', 't', 'g', 'g', 'c', 't', 'n', 'n', 'n']));
  });

  /* 계정대사 */
  sheet('계정대사', [13, 22, 12, 8, 17, 15, 15, 17, 17, 12, 16], sb => {
    sb.title('계정대사', sub('원계정 기준 (재분류 전)'));
    sb.header(['계정코드', '계정명', '대분류', '건수', 'RAW 합계', '(−) 제외', '(+) 외화평가', '분석 대상', '시산표', '차이', '재분류로 나간 금액']);
    A.recon.forEach(x => sb.row([x.code, x.name, x.big, x.n, won(x.rawSum), won(-x.exSum), won(x.reval), won(x.analysis), x.tb == null ? null : won(x.tb), x.diff == null ? null : won(x.diff), won(x.reclOut)], ['c', 't', 'c', 'n', 'n', 'n', 'n', 'n', 'n', 'diff', 'n']));
    const tk = f => won(sumArr(A.recon.map(f)));
    sb.total(['', '합계', '', sumArr(A.recon.map(x => x.n)), tk(x => x.rawSum), tk(x => -x.exSum), tk(x => x.reval), tk(x => x.analysis), tk(x => x.tb || 0), tk(x => x.diff || 0), tk(x => x.reclOut)], ['t', 't', 't', 'n', 'n', 'n', 'n', 'n', 'n', 'diff', 'n']);
  });

  /* 제외항목 */
  sheet('제외항목', [12, 13, 30, 26, 13, 13, 8, 17, 18], sb => {
    sb.title('제외 항목', sub('', '원'));
    sb.header(['계정코드', '거래선코드', '거래선명', '텍스트', '증빙일', '반제일', '통화', '현지통화금액', '제외 사유']);
    A.rows.filter(x => !x.incl).forEach(x => sb.row([x.acct, x.cust, x.custName, x.text, dt(x.docDate), dt(x.clearDate), x.cur, raw(x.local), x.exReason], ['c', 'c', 't', 't', 'dt', 'dt', 'c', 'n', 't']));
    sb.filter = true;
  });

  /* 데이터점검 */
  sheet('데이터점검', [10, 9, 36, 10, 16, 64], sb => {
    sb.title('데이터 점검', sub());
    sb.header(['구분', '수준', '점검 항목', '건수', '금액', '처리']);
    CK.forEach(x => sb.row([CHECK_TAG[x.key] || '확인', x.sev, x.title, x.n, x.amt == null ? null : won(x.amt), x.how], ['c', 'sev', 't', 'n', 'n', 't']));
    const det = CK.filter(x => x.detail && x.detail.length);
    det.forEach(x => { sb.blank(); sb.section(x.title); x.detail.forEach(t => sb.note(null, t, 5)); });
  });

  /* 채권원장분석 */
  sheet('채권원장분석', [11, 11, 18, 11, 16, 11, 26, 9, 22, 11, 11, 10, 9, 6, 14, 10, 15, 15, 7, 11, 9, 11, 9, 13, 6, 16], sb => {
    sb.header(['계정코드', '분석계정', '분석계정명', '대분류', '소분류', '거래선코드', '거래선명', '관리등급', '텍스트', '증빙일', '만기일', '만기 출처', 'PayT(적용)', '통화', '전표통화금액', '적용환율', '현지통화금액', '분석금액', '경과일', '발생구간', '만기경과일', '공시구간', '충당금률', '충당금', '포함', '제외 사유']);
    const kinds = ['c', 'c', 't', 'c', 't', 'c', 't', 'g', 't', 'dt', 'dt', 'c', 'c', 'c', 'd', 'd', 'n', 'n', 'n', 'c', 'n', 'c', 'p', 'n', 'c', 't'];
    A.rows.forEach(x => sb.row([x.acct, x.finalAcct, x.finalName, x.big, x.sub, x.cust, x.custName, x.grade, x.text, dt(x.docDate), dt(x.due), x.dueSrc, x.payEff, x.cur, x.docAmt, x.rate, raw(x.local), raw(x.amt), x.age, BUCKETS[x.bucket], x.over, DISC[x.disc], x.provRate != null ? x.provRate : null, raw(x.prov), x.incl ? 'Y' : 'N', x.exReason], kinds));
    sb.filter = true;
  });

  XLSX.writeFile(wb, `AR_aging_${D.q}_${ymd(A.base)}.xlsx`);
}
