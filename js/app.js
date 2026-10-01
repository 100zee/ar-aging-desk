/* ===== 화면 ===== */
const BCOL = ['var(--b0)', 'var(--b1)', 'var(--b2)', 'var(--b3)', 'var(--b4)'];
const UNITS = { won: { d: 1, label: '원', dec: 0 }, m: { d: 1e6, label: '백만원', dec: 0 }, e: { d: 1e8, label: '억원', dec: 1 } };
const PAGES = [
  { id: 'summary', name: '요약 보고', ico: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>' },
  { id: 'aging', name: '연령분석표', ico: '<path d="M3 6h18"/><path d="M3 12h12"/><path d="M3 18h7"/>' },
  { id: 'risk', name: '리스크 거래선', ico: '<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4"/><path d="M12 17.5v.5"/>' },
  { id: 'recon', name: '대사 · 데이터 점검', ico: '<path d="m5 12 4 4L19 6"/>' }
];
const LOGO = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9FD8C8" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 20h16"/><path d="M6 16v-3"/><path d="M10 16V9"/><path d="M14 16v-5"/><path d="M18 16V5"/></svg>';

const S = { W: null, notices: [], meta: null, file: null, isSample: false, base: null, A: null, CK: null, D: null, unit: 'm', tab: 0, q: '', open: {}, error: '' };
let lastSheets = null;
const root = document.getElementById('app');

/* ---- 숫자 ---- */
function F(n, extra) {
  if (n == null || !isFinite(n)) return '–';
  const u = UNITS[S.unit], dec = S.unit === 'won' ? 0 : u.dec + (extra || 0);
  const v = n / u.d, r = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (v < 0 && Number(r.replace(/,/g, '')) !== 0 ? '−' : '') + r;
}
const FZ = (n, extra) => (!n ? '–' : F(n, extra));
const SG = (n, extra) => (n > 0 ? '+' : '') + F(n, extra);
const tone = d => (d > 0 ? 'up' : d < 0 ? 'dn' : 'nt');
const route = () => (location.hash.replace(/^#\/?/, '') || 'summary');

/* ---- 계산 ---- */
function load(sheets, file, isSample) {
  const P = parseBook(sheets);
  Object.assign(S, { W: P.W, notices: P.notices, meta: P.meta, file, isSample, base: P.W.config.baseDate, tab: 0, q: '', open: {}, error: '' });
  lastSheets = sheets;
  recompute();
}
function recompute() {
  S.A = analyze(S.W, S.base);
  S.CK = checks(S.A);
  S.D = derive(S.A, S.W, n => F(n));
}

/* ---- 공통 조각 ---- */
const icon = (paths, size = 18, sw = 1.8) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const chipG = g => (g ? `<span class="chip g-${esc(g)}">${esc(g)}</span>` : '');
const dotB = i => `<span class="dot" style="background:${BCOL[i]}"></span>`;

function sidebar(active) {
  const fileName = S.isSample ? SAMPLE_FILE : (S.file || '');
  return `<nav class="side" aria-label="주 메뉴">
  <div class="brand"><div class="brand-ico">${LOGO}</div><div style="display:flex;flex-direction:column;line-height:1.25"><span style="font-weight:700;font-size:15px;color:#FFFFFF">채권연령 분석기</span><span class="num" style="font-size:11px;color:#8FA59C;letter-spacing:.06em">AR AGING DESK</span></div></div>
  <div class="nav">${PAGES.map(p => `<a href="#/${p.id}" class="${p.id === active ? 'on' : ''}"${p.id === active ? ' aria-current="page"' : ''}>${icon(p.ico)}${p.name}</a>`).join('')}</div>
  <div class="side-foot">
    <div style="display:flex;flex-direction:column;gap:6px">
      <label for="base-date" class="cap" style="letter-spacing:.04em">분석 기준일</label>
      <input id="base-date" class="date-in" type="date" value="${ymd(S.base)}" data-base>
      <span class="cap">바꾸면 경과일·구간·충당금이 다시 계산돼요</span>
      ${S.base !== S.W.config.baseDate ? `<button type="button" class="linkbtn" data-act="base-reset">원래 기준일(${ymd(S.W.config.baseDate)})로</button>` : ''}
    </div>
    <div style="border-top:1px solid #2A3D37;padding-top:14px;display:flex;flex-direction:column;gap:4px">
      <span class="cap">불러온 파일</span>
      <span style="font-size:13px;color:#FFFFFF;word-break:break-all">${esc(fileName)}</span>
      <span class="num cap">${S.meta.rows.toLocaleString('en-US')}행 · 시트 ${S.meta.sheets}개</span>
      <button type="button" class="linkbtn" data-act="home" style="margin-top:4px">다른 파일 올리기</button>
    </div>
  </div></nav>`;
}
function mobileBar(active) {
  return `<div class="mbar"><span style="font-weight:700">채권연령 분석기</span>
  <select aria-label="화면 선택" data-nav>${PAGES.map(p => `<option value="${p.id}"${p.id === active ? ' selected' : ''}>${p.name}</option>`).join('')}</select>
  <input type="date" aria-label="분석 기준일" value="${ymd(S.base)}" data-base>
  <button type="button" class="linkbtn" style="color:#9FD8C8" data-act="home">다른 파일</button></div>`;
}
function header(title, caption) {
  return `<header class="head">
  <div style="display:flex;flex-direction:column;gap:4px">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="lbl">${caption}</span>${S.isSample ? '<span class="chip acc">샘플 데이터</span>' : ''}${S.base !== S.W.config.baseDate ? '<span class="chip sev-warn">기준일 변경됨</span>' : ''}</div>
    <h1 class="page">${title}</h1>
  </div>
  <div class="head-tools">
    <div class="seg" role="group" aria-label="금액 단위">${Object.entries(UNITS).map(([k, u]) => `<button type="button" class="${S.unit === k ? 'on' : ''}" aria-pressed="${S.unit === k}" data-act="unit" data-v="${k}">${u.label}</button>`).join('')}</div>
    <button type="button" class="btn btn-p" data-act="export">${icon('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>', 16, 2)}엑셀로 내보내기</button>
  </div></header>`;
}
function noticeBox() {
  const list = S.notices.slice();
  if (S.base !== S.W.config.baseDate && S.A.hasTB) list.push(`시산표·전분기 자료는 원래 기준일(${ymd(S.W.config.baseDate)}) 기준이라 대사 차이와 증감은 참고로만 보세요.`);
  if (!list.length) return '';
  return `<div class="notice" role="status">${icon('<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16.5v.5"/>', 18, 2)}<ul>${list.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>`;
}
function shell(active, body) {
  return `<div class="shell">${sidebar(active)}<div style="min-width:0">${mobileBar(active)}<main class="main" id="main"><div class="wrap">${body}</div></main></div></div>`;
}
const U = () => UNITS[S.unit].label;

/* ---- 시작 화면 ---- */
function pageUpload() {
  const sheets = [['RAW_채권원장', 'SAP 미결항목', '필수'], ['거래선마스터', '구분·등급·여신한도', '필수'], ['기준정보', '기준일·환율·PayT·설정률·매출액', '권장'], ['시산표', '계정대사용', '선택'], ['전분기_요약', '전분기 비교용', '선택']];
  return `<div style="min-height:100vh;display:flex;flex-direction:column">
  <header style="display:flex;align-items:center;justify-content:space-between;padding:20px clamp(16px,4vw,40px);gap:12px;flex-wrap:wrap">
    <div style="display:flex;align-items:center;gap:10px"><div class="brand-ico" style="background:#13201B">${LOGO}</div><span style="font-weight:700;font-size:16px">채권연령 분석기</span></div>
    <span style="font-size:12.5px;color:var(--muted)">파일은 브라우저 안에서만 처리되고 서버로 보내지 않아요</span>
  </header>
  <main style="flex:1;display:flex;align-items:center;justify-content:center;padding:24px 16px 64px">
  <div class="two" style="width:100%;max-width:980px;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:40px;align-items:center">
    <div style="display:flex;flex-direction:column;gap:18px">
      <span class="lbl" style="color:var(--accent)">매출채권 연령분석 · AGING</span>
      <h1 class="hero" style="margin:0;font-size:40px;line-height:1.2;font-weight:700;letter-spacing:-.03em">SAP 미결항목을 올리면<br>연령분석 보고서가 나와요</h1>
      <p style="margin:0;font-size:15px;color:var(--ink2);max-width:44ch">기준일 이전 반제 제외, 외화 환산, 만기일 보정, 시산표 대사까지 한 번에 처리하고 리스크 거래선을 찾아줘요.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button type="button" class="btn btn-p" data-act="sample">샘플 데이터로 둘러보기</button>
        <button type="button" class="btn btn-g" data-act="dl-sample">샘플 엑셀 받기</button>
      </div>
      <span style="font-size:12.5px;color:var(--muted)">샘플은 가상의 거래선·금액으로 만든 파일이에요. 받아서 양식 참고용으로 쓰세요.</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:14px">
      ${S.error ? `<div class="err" role="alert">${esc(S.error)}</div>` : ''}
      <label for="file-in" class="drop" id="drop">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 18v-6"/><path d="m9 15 3-3 3 3"/></svg>
        <span style="font-weight:600;font-size:15px">엑셀 파일을 여기에 끌어다 놓기</span>
        <span style="font-size:12.5px;color:var(--muted)">또는 클릭해서 선택 · .xlsx</span>
        <input id="file-in" type="file" accept=".xlsx,.xlsm,.xls" style="position:absolute;width:1px;height:1px;opacity:0">
      </label>
      <div id="format" class="card" style="padding:16px 18px;display:flex;flex-direction:column;gap:8px">
        <span class="lbl">필요한 시트</span>
        ${sheets.map(s => `<div style="display:flex;justify-content:space-between;gap:10px;font-size:13px"><span><span class="num" style="font-weight:500">${s[0]}</span> <span style="color:var(--muted)">· ${s[1]}</span></span><span class="chip ${s[2] === '필수' ? 'sev-crit' : s[2] === '권장' ? 'sev-warn' : 'g-정상'}">${s[2]}</span></div>`).join('')}
      </div>
    </div>
  </div></main></div>`;
}

/* ---- 요약 보고 ---- */
function pageSummary() {
  const A = S.A, D = S.D;
  const neutral = 'neutral', bad = 'bad';
  const prov = A.provAR;
  const kpis = [
    { label: '총 매출채권', value: F(A.arTotal), unit: U(), delta: D.hasPrev ? spct(A.arTotal / D.prevTot - 1) : '전분기 없음', cls: neutral, note: D.hasPrev ? `전분기 ${F(D.prevTot)}` : '' },
    { label: '120일 이상 비중', value: (D.share * 100).toFixed(1), unit: '%', delta: D.prevShare != null ? ((D.share - D.prevShare) >= 0 ? '+' : '−') + Math.abs((D.share - D.prevShare) * 100).toFixed(1) + '%p' : '전분기 없음', cls: D.prevShare != null && D.share > D.prevShare ? bad : D.prevShare != null ? 'goodc' : neutral, note: `${F(A.ar120)} · ${D.n120}개 거래선` },
    { label: '대손충당금', value: F(prov), unit: U(), delta: D.prevProv ? spct(prov / D.prevProv - 1) : '전분기 없음', cls: D.prevProv && prov > D.prevProv ? bad : neutral, note: `채권 대비 ${pct(A.arTotal ? prov / A.arTotal : 0)}` },
    { label: '매출채권 회전일수', value: A.dso.all != null ? A.dso.all.toFixed(1) : '–', unit: '일', delta: A.dso[SUBS[0]] != null ? `내수 ${A.dso[SUBS[0]].toFixed(1)}` : '매출액 없음', cls: neutral, note: A.dso[SUBS[1]] != null ? `수출 ${A.dso[SUBS[1]].toFixed(1)}일` : '' }
  ];
  const max = Math.max(1, ...SUBS.map(s => Math.max(A.bySub[s].total, A.compare[s].prev ? sumArr(A.compare[s].prev) : 0)));
  const bar = (label, arr) => {
    const t = sumArr(arr);
    if (t <= 0) return `<div style="display:grid;grid-template-columns:52px minmax(0,1fr) 84px;align-items:center;gap:10px"><span style="font-size:12px;color:var(--muted)">${label}</span><span style="font-size:12px;color:var(--muted)">자료 없음</span><span></span></div>`;
    const segs = arr.map((v, i) => v > 0 ? `<div title="${BUCKETS[i]} ${F(v)} (${pct(v / t)})" style="flex:${v} 1 0;min-width:2px;background:${BCOL[i]}"></div>` : '').join('');
    return `<div style="display:grid;grid-template-columns:52px minmax(0,1fr) 84px;align-items:center;gap:10px">
      <span style="font-size:12px;color:var(--muted)">${label}</span>
      <div style="height:22px;display:flex"><div style="display:flex;gap:2px;height:22px;width:${(t / max * 100).toFixed(2)}%;border-radius:4px;overflow:hidden">${segs}</div></div>
      <span class="num" style="font-size:13px;text-align:right">${F(t)}</span></div>`;
  };
  const chart = SUBS.map(s => `<div style="display:flex;flex-direction:column;gap:8px"><div style="font-size:13.5px;font-weight:600">${s}</div>${bar(D.q, A.bySub[s].buckets)}${A.compare[s].prev ? bar(D.pq, A.compare[s].prev) : ''}</div>`).join('');
  const d120 = D.hasPrev ? A.ar120 - D.prev120 : null;

  let cmp = '';
  if (D.hasPrev) {
    const cell = (p, c, i, isTot) => {
      const d = c - p, r = p ? d / p : null, cls = !isTot && i >= 3 ? tone(d) : 'nt';
      return `<td class="num">${F(p)}</td><td class="num">${F(c)}</td><td class="num ${cls}">${SG(d)}</td><td class="num ${cls}">${spct(r)}</td>`;
    };
    const rows = BUCKETS.map((n, i) => `<tr><td class="l"><span style="display:inline-flex;align-items:center;gap:8px">${dotB(i)}${n}</span></td>${SUBS.map(s => { const c = A.compare[s]; return c.prev ? cell(c.prev[i], c.cur[i], i) : '<td colspan="4" class="zero">–</td>'; }).join('')}</tr>`).join('');
    const tot = `<tr class="tot"><td class="l">합계</td>${SUBS.map(s => { const c = A.compare[s]; return c.prev ? cell(sumArr(c.prev), sumArr(c.cur), 0, true) : '<td colspan="4">–</td>'; }).join('')}</tr>`;
    cmp = `<section class="card" style="padding:22px 24px;display:flex;flex-direction:column;gap:14px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap"><h2 class="sec">전분기(${D.pq}) 대비 구간별 증감</h2><span style="font-size:12.5px;color:var(--muted)">단위 ${U()}</span></div>
    <div class="scroll"><table><thead>
      <tr><th class="l" rowspan="2" style="vertical-align:bottom">구간</th>${SUBS.map(s => `<th colspan="4" class="c" style="border-bottom:1px solid var(--hair)">${s}</th>`).join('')}</tr>
      <tr>${SUBS.map(() => `<th>${D.pq}</th><th>${D.q}</th><th>증감</th><th>증감률</th>`).join('')}</tr>
    </thead><tbody>${rows}${tot}</tbody></table></div>
    ${D.cmpNote ? `<p class="note" style="max-width:80ch">${esc(D.cmpNote)}</p>` : ''}</section>`;
  }

  return header('요약 보고', `${D.q} · 기준일 ${ymd(A.base)}`) + noticeBox() + `
  <section class="kpis" aria-label="핵심 수치">${kpis.map(k => `<div class="card" style="padding:18px 20px;display:flex;flex-direction:column;gap:6px">
    <span class="lbl">${k.label}</span>
    <div style="display:flex;align-items:baseline;gap:6px;min-width:0"><span class="num" style="font-size:clamp(22px,2.4vw,30px);font-weight:600;letter-spacing:-.03em;overflow-wrap:anywhere">${k.value}</span><span style="font-size:13px;color:var(--muted)">${k.unit}</span></div>
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12.5px;color:var(--ink2)"><span class="chip ${k.cls}">${k.delta}</span><span>${k.note}</span></div></div>`).join('')}</section>
  <section class="two" style="grid-template-columns:minmax(0,1.65fr) minmax(0,1fr)">
    <div class="card" style="padding:22px 24px;display:flex;flex-direction:column;gap:18px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div><h2 class="sec">발생기준 연령 구성</h2><p class="sub">외상매출금(어음·구매카드 포함), 단위 ${U()} · 막대 길이는 잔액 규모</p></div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--ink2)">${BUCKETS.map((n, i) => `<span style="display:inline-flex;align-items:center;gap:6px">${dotB(i)}${n}</span>`).join('')}</div>
      </div>
      ${chart}
      <div style="border-top:1px solid var(--hair);padding-top:12px;display:flex;gap:20px;flex-wrap:wrap;font-size:12.5px;color:var(--ink2)">
        <span>120일 이상 <b class="num" style="color:var(--ink)">${F(A.ar120)}</b>${D.hasPrev ? ` (전분기 ${F(D.prev120)}, <span class="${tone(d120)}">${spct(D.prev120 ? d120 / D.prev120 : null)}</span>)` : ''}</span>
        <span>수출 120일 이상 비중 <b class="num" style="color:var(--ink)">${pct(D.subShare[1])}</b>, 내수 <b class="num" style="color:var(--ink)">${pct(D.subShare[0])}</b></span>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="card" style="padding:20px 22px;display:flex;flex-direction:column;gap:14px">
        <h2 class="sec">이번 분기 주요 이슈</h2>
        ${D.issues.map(i => `<div style="display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:start"><span class="chip ${i.cls}">${i.tag}</span><div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:13.5px;font-weight:600">${esc(i.title)}</span><span style="font-size:12.5px;color:var(--ink2)">${esc(i.body)}</span></div></div>`).join('')}
      </div>
      <div class="card" style="padding:20px 22px;display:flex;flex-direction:column;gap:12px">
        <h2 class="sec">권고사항</h2>
        ${D.recs.length ? `<ol style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--ink2)">${D.recs.map(r => `<li>${r.replace(/<b>/g, '<b style="color:var(--ink)">')}</li>`).join('')}</ol>` : '<span style="font-size:13px;color:var(--ink2)">특별히 조치할 항목이 없어요.</span>'}
      </div>
    </div>
  </section>${cmp}`;
}

/* ---- 연령분석표 ---- */
function pageAging() {
  const A = S.A, D = S.D, sub = SUBS[S.tab], B = A.bySub[sub], T = B.total;
  const q = S.q.trim().toLowerCase();
  const all = A.pivots[sub];
  const list = q ? all.filter(c => (c.name || '').toLowerCase().includes(q) || String(c.code).toLowerCase().includes(q)) : all;
  const LIMIT = 15, showAll = q || S.open.allCust;
  const shown = showAll ? list : list.slice(0, LIMIT);
  const row = (c, i) => `<tr><td class="l num" style="color:var(--muted)">${i + 1}</td>
    <td class="l" style="white-space:normal;min-width:180px"><div style="display:flex;flex-direction:column"><span style="font-weight:500">${esc(c.name)}</span><span class="num" style="font-size:11.5px;color:var(--muted)">${esc(c.code)}</span></div></td>
    <td class="l">${chipG(c.grade)}</td>
    ${c.buckets.map((v, j) => `<td class="num ${!v ? 'zero' : j === 4 && v > 0 ? 'hot' : ''}">${FZ(v)}</td>`).join('')}
    <td class="num" style="font-weight:600">${F(c.total)}</td><td class="num" style="color:var(--ink2)">${pct(T ? c.total / T : null)}</td>
    <td class="l">${distBar(c.buckets)}</td></tr>`;
  const rest = list.slice(shown.length);
  const restB = [0, 1, 2, 3, 4].map(j => sumArr(rest.map(c => c.buckets[j])));
  const restRow = rest.length ? `<tr class="sub"><td></td><td class="l">그 외 ${rest.length}개 거래선 <button type="button" class="linkbtn" data-act="toggle" data-k="allCust">전체 보기</button></td><td></td>${restB.map(v => `<td class="num">${F(v)}</td>`).join('')}<td class="num">${F(sumArr(restB))}</td><td class="num">${pct(T ? sumArr(restB) / T : null)}</td><td class="l">${distBar(restB)}</td></tr>` : '';
  const qB = [0, 1, 2, 3, 4].map(j => sumArr(list.map(c => c.buckets[j])));
  const totB = q ? qB : B.buckets;
  const totRow = `<tr class="tot"><td></td><td class="l">${q ? `검색 결과 합계 (${list.length}곳)` : '합계'}</td><td></td>${totB.map(v => `<td class="num">${F(v)}</td>`).join('')}<td class="num">${F(sumArr(totB))}</td><td class="num">${pct(T ? sumArr(totB) / T : null)}</td><td class="l">${distBar(totB)}</td></tr>`;
  const disc = SUBS.map(s => `<tr><td class="l">${s}</td>${A.bySub[s].disc.map(v => `<td class="num">${F(v)}</td>`).join('')}<td class="num" style="font-weight:600">${F(A.bySub[s].total)}</td></tr>`).join('');
  const discT = [0, 1, 2, 3, 4, 5].map(j => sumArr(SUBS.map(s => A.bySub[s].disc[j])));

  return header('연령분석표', `${D.q} · 발생기준 (기준일 − 증빙일)`) + `
  <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
    <div class="seg" role="tablist" aria-label="소분류">${SUBS.map((s, i) => `<button type="button" role="tab" class="${S.tab === i ? 'on' : ''}" aria-selected="${S.tab === i}" data-act="tab" data-v="${i}">${s}</button>`).join('')}</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><label for="cust-q" class="lbl">거래선 검색</label><input id="cust-q" class="search" type="search" placeholder="거래선명 또는 코드" value="${esc(S.q)}" data-search></div>
  </div>
  <section class="strip" aria-label="구간 합계">${B.buckets.map((v, i) => `<div>
    <span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)">${dotB(i)}${BUCKETS[i]}</span>
    <span class="num" style="font-size:20px;font-weight:600">${F(v)}</span>
    <span class="num" style="font-size:12px;color:var(--ink2)">${pct(T ? v / T : null)}</span>
    <div style="height:4px;background:var(--hair);border-radius:2px"><div style="height:4px;border-radius:2px;background:${BCOL[i]};width:${T && v > 0 ? (v / T * 100).toFixed(1) : 0}%"></div></div></div>`).join('')}</section>
  <section class="card" style="padding:8px 0 4px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;padding:14px 20px 6px;gap:12px;flex-wrap:wrap">
      <h2 class="sec">거래선별 연령분석 · ${sub}</h2>
      <span style="font-size:12.5px;color:var(--muted)">합계 기준 내림차순 · 단위 ${U()} · ${all.length}개 거래선${S.open.allCust && !q ? ` · <button type="button" class="linkbtn" data-act="toggle" data-k="allCust">상위 ${LIMIT}개만</button>` : ''}</span>
    </div>
    <div class="scroll"><table>
      <thead><tr><th class="l" style="width:28px">#</th><th class="l">거래선</th><th class="l">관리등급</th>${BUCKETS.map(b => `<th>${b}</th>`).join('')}<th>합계</th><th>구성비</th><th class="l" style="width:150px">구간 분포</th></tr></thead>
      <tbody>${shown.map(row).join('') || `<tr><td colspan="11" class="l" style="color:var(--muted)">'${esc(S.q)}'에 맞는 거래선이 없어요.</td></tr>`}${restRow}${totRow}</tbody>
    </table></div>
  </section>
  <section class="card" style="padding:20px 24px;display:flex;flex-direction:column;gap:12px">
    <div><h2 class="sec">공시용 연령표</h2><p class="sub">만기경과 기준 · 순만기일이 없으면 PayT 규칙으로 산정 · 단위 ${U()}</p></div>
    <div class="scroll"><table>
      <thead><tr><th class="l">소분류</th>${DISC.map(d => `<th>${d}</th>`).join('')}<th>합계</th></tr></thead>
      <tbody>${disc}<tr class="tot"><td class="l">합계</td>${discT.map(v => `<td class="num">${F(v)}</td>`).join('')}<td class="num">${F(sumArr(discT))}</td></tr></tbody>
    </table></div>
  </section>`;
}
function distBar(b) {
  const pos = b.map(v => Math.max(0, v));
  if (!sumArr(pos)) return '';
  return `<div style="display:flex;gap:1px;height:10px;width:140px">${pos.map((v, j) => v ? `<div style="flex:${v} 1 0;background:${BCOL[j]}"></div>` : '').join('')}</div>`;
}

/* ---- 리스크 거래선 ---- */
function pageRisk() {
  const A = S.A, D = S.D;
  const counts = {}; A.risk120.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
  const LIM = 10, r120 = S.open.all120 ? A.risk120 : A.risk120.slice(0, LIM);
  const credit = S.open.allCredit ? A.credit : A.credit.slice(0, 6);
  const dsoCell = (label, v, s, gap) => `<div style="display:flex;flex-direction:column;gap:2px;min-width:0"><span class="lbl">${label}</span>
    <span class="num" style="font-size:26px;font-weight:600;${gap != null && gap > 10 ? 'color:var(--crit)' : ''}">${v != null ? v.toFixed(1) : '–'}<span style="font-size:13px;color:var(--muted);font-weight:400"> 일</span></span>
    <span class="num" style="font-size:12px;color:var(--ink2);overflow-wrap:anywhere">${s}</span></div>`;
  const salesAll = sumArr(SUBS.map(s => A.sales[s] || 0));
  const formula = (bal, sales) => sales ? `${F(bal)} ÷ (${F(sales)} ÷ ${A.salesDays})` : '매출액 없음';

  return header('리스크 거래선', `${D.q} · 매출채권 기준`) + `
  <section class="card" style="padding:20px 24px;display:flex;flex-direction:column;gap:14px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <div><h2 class="sec">120일 이상 채권 보유 거래선</h2><p class="sub">${A.hasPrior ? '전분기 요약과 거래선코드로 비교' : '전분기 요약이 없어 모두 신규로 표시'} · 단위 ${U()}</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${['신규', '증가', '감소', '해소', '동일'].filter(k => counts[k]).map(k => `<span class="chip s-${k}">${k} ${counts[k]}</span>`).join('')}</div>
    </div>
    <div class="scroll"><table>
      <thead><tr><th class="l">거래선</th><th class="l">구분</th><th class="l">관리등급</th><th>${D.pq}</th><th>${D.q}</th><th>증감</th><th class="l">변동</th><th>총 채권 대비</th></tr></thead>
      <tbody>${r120.map(r => `<tr><td class="l" style="font-weight:500">${esc(r.name)}</td><td class="l" style="color:var(--ink2)">${D.regionOf(r.code)}</td><td class="l">${chipG(r.grade)}</td>
        <td class="num">${FZ(r.prev)}</td><td class="num" style="font-weight:600">${FZ(r.cur)}</td><td class="num ${tone(r.diff)}">${SG(r.diff)}</td><td class="l"><span class="chip s-${r.status}">${r.status}</span></td><td class="num" style="color:var(--ink2)">${r.total > 0 ? pct(r.cur / r.total, 0) : '–'}</td></tr>`).join('') || '<tr><td colspan="8" class="l" style="color:var(--muted)">120일 이상 채권을 가진 거래선이 없어요.</td></tr>'}</tbody>
    </table></div>
    ${A.risk120.length > LIM ? `<span style="font-size:12px;color:var(--muted)">${A.risk120.length}개 거래선 중 ${r120.length}개 표시 · <button type="button" class="linkbtn" data-act="toggle" data-k="all120">${S.open.all120 ? '상위만 보기' : '전체 보기'}</button></span>` : ''}
  </section>
  <section class="two" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)">
    <div class="card" style="padding:20px 24px;display:flex;flex-direction:column;gap:16px">
      <div><h2 class="sec">여신한도 초과 ${A.credit.length ? `<span class="chip sev-crit" style="vertical-align:middle">${A.credit.length}곳</span>` : ''}</h2><p class="sub">여신사용액 = 매출채권 잔액 (선수금 차감 없음) · 단위 ${U()}</p></div>
      ${credit.map(c => { const lim = (c.limit / c.used * 100).toFixed(1); return `<div style="display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;flex-wrap:wrap"><span style="font-weight:600;font-size:13.5px">${esc(c.name)} <span style="margin-left:4px">${chipG(c.grade)}</span></span><span class="num" style="font-size:13px;color:var(--crit);font-weight:600">${pct(c.ratio, 0)}</span></div>
        <div style="position:relative;height:12px;background:var(--hair);border-radius:3px" role="img" aria-label="한도 ${F(c.limit)}, 사용 ${F(c.used)}">
          <div style="position:absolute;inset:0;border-radius:3px;background:linear-gradient(90deg,var(--b2) 0 ${lim}%,var(--crit) ${lim}% 100%)"></div>
          <div style="position:absolute;top:-3px;bottom:-3px;width:2px;background:var(--ink);left:calc(${lim}% - 1px)"></div></div>
        <div class="num" style="display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--ink2);flex-wrap:wrap"><span>사용 ${F(c.used)} / 한도 ${F(c.limit)}</span><span>초과 ${F(c.over)}</span></div></div>`; }).join('') || '<span style="font-size:13px;color:var(--ink2)">여신한도를 넘은 거래선이 없어요.</span>'}
      ${A.credit.length > 6 ? `<button type="button" class="linkbtn" style="align-self:flex-start" data-act="toggle" data-k="allCredit">${S.open.allCredit ? '접기' : `${A.credit.length}곳 모두 보기`}</button>` : ''}
      ${A.credit.length ? `<div style="display:flex;gap:14px;font-size:12px;color:var(--ink2);flex-wrap:wrap"><span style="display:inline-flex;align-items:center;gap:6px"><span class="dot" style="background:var(--b2)"></span>한도 내</span><span style="display:inline-flex;align-items:center;gap:6px"><span class="dot" style="background:var(--crit)"></span>초과분</span><span style="display:inline-flex;align-items:center;gap:6px"><span style="width:2px;height:12px;background:var(--ink)"></span>한도</span></div>` : ''}
    </div>
    <div class="card" style="padding:20px 24px;display:flex;flex-direction:column;gap:14px">
      <div><h2 class="sec">매출채권 회전일수 (DSO)</h2><p class="sub">기말 매출채권 ÷ (분기 매출액 ÷ ${A.salesDays}일) · 단위 ${U()}</p></div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">
        ${dsoCell('내수', A.dso[SUBS[0]], formula(A.bySub[SUBS[0]].total, A.sales[SUBS[0]]), D.dsoGap[0])}
        ${dsoCell('수출', A.dso[SUBS[1]], formula(A.bySub[SUBS[1]].total, A.sales[SUBS[1]]), D.dsoGap[1])}
        ${dsoCell('전체', A.dso.all, formula(A.arTotal, salesAll))}
      </div>
      ${D.dsoNote ? `<p class="note">${esc(D.dsoNote)}</p>` : ''}
    </div>
  </section>
  <section class="card" style="padding:20px 24px;display:flex;flex-direction:column;gap:14px">
    <div><h2 class="sec">관리등급 조정 의견</h2><p class="sub">기준: 정상인데 120일 이상 비중 20% 이상 → 주의, 50% 이상 → 부실 / 주의인데 120일 이상 없고 만기경과 10% 미만 → 정상 / 부실·대손인데 59일 이하 비중 50% 이상 → 재검토</p></div>
    <div class="scroll"><table>
      <thead><tr><th class="l">거래선</th><th class="l">현재 → 제안</th><th class="l">근거</th><th>채권 잔액</th><th>120일 이상</th></tr></thead>
      <tbody>${A.gradeIssues.map(g => `<tr><td class="l" style="font-weight:500">${esc(g.name)}</td>
        <td class="l"><span style="display:inline-flex;align-items:center;gap:6px">${chipG(g.grade)}${icon('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>', 14, 2)}${chipG(g.sug)}</span></td>
        <td class="l" style="white-space:normal;color:var(--ink2);min-width:200px">${esc(g.why)}</td><td class="num">${F(g.total)}</td><td class="num">${FZ(g.b120)}</td></tr>`).join('') || '<tr><td colspan="5" class="l" style="color:var(--muted)">조정 의견이 없어요.</td></tr>'}</tbody>
    </table></div>
  </section>`;
}

/* ---- 대사 · 데이터 점검 ---- */
function pageRecon() {
  const A = S.A, D = S.D, F1 = n => FZ(n, 1);
  const rc = A.recon;
  const diffs = rc.filter(r => r.diff != null && Math.round(r.diff) !== 0);
  const tot = k => sumArr(rc.map(r => r[k] || 0));
  const tbAll = rc.every(r => r.tb != null);
  const recRows = rc.map(r => `<tr><td class="l"><div style="display:flex;flex-direction:column"><span style="font-weight:500">${esc(r.name)}</span><span class="num" style="font-size:11.5px;color:var(--muted)">${esc(r.code)}</span></div></td>
    <td class="num">${F1(r.rawSum)}</td><td class="num ${r.exSum ? '' : 'zero'}">${r.exSum ? F(-r.exSum, 1) : '–'}</td><td class="num ${r.reval ? '' : 'zero'}">${r.reval ? SG(r.reval, 1) : '–'}</td>
    <td class="num" style="font-weight:600">${F1(r.analysis)}</td><td class="num">${r.tb == null ? '<span style="color:var(--muted)">없음</span>' : F1(r.tb)}</td>
    <td class="num ${r.diff == null ? 'zero' : Math.round(r.diff) === 0 ? 'dn' : 'up'}">${r.diff == null ? '–' : Math.round(r.diff) === 0 ? '0' : F(r.diff, 1)}</td></tr>`).join('');
  const recTot = `<tr class="tot"><td class="l">합계</td><td class="num">${F1(tot('rawSum'))}</td><td class="num">${F(-tot('exSum'), 1)}</td><td class="num">${SG(tot('reval'), 1)}</td><td class="num">${F1(tot('analysis'))}</td><td class="num">${tbAll ? F1(tot('tb')) : '–'}</td><td class="num">${tbAll ? (Math.round(tot('diff')) === 0 ? '0' : F(tot('diff'), 1)) : '–'}</td></tr>`;
  const badge = !A.hasTB ? '<span class="chip neutral">시산표 없음</span>'
    : diffs.length ? `<span class="chip sev-crit">차이 있는 계정 ${diffs.length}개</span>`
      : `<span class="chip sev-ok">${icon('<path d="m5 12 4 4L19 6"/>', 12, 3)}${rc.length}개 계정 차이 0</span>`;
  const Fi = A.findings;
  const rclAmt = sumArr(Fi.reclass.map(r => r.amt));
  const ex = A.rows.filter(r => !r.incl);
  const exAmt = sumArr(ex.map(r => r.local));
  const exBy = k => Fi[k];
  const exList = S.open.ex ? `<div class="scroll" style="max-height:360px;overflow-y:auto"><table><thead><tr><th class="l">계정</th><th class="l">거래선</th><th class="l">증빙일</th><th class="l">반제일</th><th>금액</th></tr></thead><tbody>${ex.slice(0, 300).map(r => `<tr><td class="l num">${esc(r.acct)}</td><td class="l" style="white-space:normal">${esc(r.custName || '–')}</td><td class="l num">${ymd(r.docDate)}</td><td class="l num">${ymd(r.clearDate)}</td><td class="num">${F(r.local, 1)}</td></tr>`).join('')}</tbody></table></div>${ex.length > 300 ? '<span style="font-size:12px;color:var(--muted)">300건까지 표시 · 전체는 엑셀의 제외항목 시트에서 확인</span>' : ''}` : '';
  const rates = S.W.config.bucketRates.map((r, i) => `${BUCKETS[i]} ${pct(r, 1)}`).join(' · ');

  return header('대사 · 데이터 점검', `${D.q} · 시산표 ${ymd(S.W.config.baseDate)}`) + noticeBox() + `
  <section class="card" style="padding:20px 24px;display:flex;flex-direction:column;gap:14px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <div><h2 class="sec">계정대사 · 시산표 잔액과 비교</h2><p class="sub">원계정 기준 (재분류 전) · 단위 ${U()}</p></div>${badge}
    </div>
    <div class="scroll"><table>
      <thead><tr><th class="l">계정</th><th>RAW 합계</th><th>(−) 제외 항목</th><th>(+) 외화 평가</th><th>분석 대상</th><th>시산표</th><th>차이</th></tr></thead>
      <tbody>${recRows}${recTot}</tbody>
    </table></div>
    <p class="note">선수금은 비화폐성 항목이라 기말환율로 다시 환산하지 않아요.${Fi.reclass.length ? ` 미수금 중 제품매출 ${Fi.reclass.length}건(${F(rclAmt, 1)})은 분석에서만 외상매출금 국판(${esc(A.reclassTo)})으로 옮기고, 시산표 대사는 원계정 그대로 둬요.` : ''}</p>
  </section>
  <section class="two" style="grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)">
    <div class="card" style="padding:20px 24px;display:flex;flex-direction:column;gap:4px">
      <h2 class="sec" style="margin-bottom:8px">데이터 점검 결과</h2>
      ${S.CK.map(c => `<div style="display:grid;grid-template-columns:52px minmax(0,1fr) auto;gap:12px;align-items:start;padding:10px 0;border-top:1px solid var(--hair)">
        <span class="chip sev-${c.sev}" style="justify-content:center">${CHECK_TAG[c.key] || '확인'}</span>
        <div style="display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-size:13.5px;font-weight:600">${esc(c.title)}</span><span style="font-size:12.5px;color:var(--ink2)">${esc(c.how)}</span>
          ${c.detail && c.detail.length ? `<span class="num" style="font-size:11.5px;color:var(--muted);overflow-wrap:anywhere;white-space:pre-wrap">${c.detail.map(esc).join(' · ')}</span>` : ''}</div>
        <div class="num" style="display:flex;flex-direction:column;align-items:flex-end;font-size:12.5px"><span style="font-weight:600">${checkCount(c, A)}</span><span style="color:var(--muted)">${c.amt == null ? '' : c.key === 'fx' ? SG(c.amt, 1) : F(c.amt, 1)}</span></div></div>`).join('')}
    </div>
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="card" style="padding:20px 24px;display:flex;flex-direction:column;gap:12px">
        <h2 class="sec">제외 항목</h2>
        <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><span class="num" style="font-size:26px;font-weight:600">${ex.length}<span style="font-size:13px;color:var(--muted);font-weight:400"> 건</span></span><span class="num" style="font-size:15px;color:var(--ink2)">${F(exAmt, 1)} ${U()}</span></div>
        <table><thead><tr><th class="l">제외 기준</th><th>건수</th><th>금액</th></tr></thead><tbody>
          <tr><td class="l" style="white-space:normal">반제일 ≤ 기준일 (이미 회수됨)</td><td class="num">${exBy('clearedBefore').length}</td><td class="num">${F(sumArr(exBy('clearedBefore').map(r => r.local)), 1)}</td></tr>
          <tr><td class="l" style="white-space:normal">증빙일 &gt; 기준일 (기준일 이후 발생)</td><td class="num">${exBy('futureDoc').length}</td><td class="num">${F(sumArr(exBy('futureDoc').map(r => r.local)), 1)}</td></tr>
        </tbody></table>
        ${ex.length ? `<button type="button" class="linkbtn" style="align-self:flex-start" data-act="toggle" data-k="ex">${S.open.ex ? '전표 목록 접기' : `제외 항목 ${ex.length}건 전표 보기`}</button>` : ''}
        ${exList}
      </div>
      <div class="card" style="padding:20px 24px;display:flex;flex-direction:column;gap:10px">
        <h2 class="sec">적용한 분석 기준</h2>
        <dl style="margin:0;display:grid;grid-template-columns:88px minmax(0,1fr);gap:8px 12px;font-size:12.5px">
          <dt style="color:var(--muted)">대상</dt><dd style="margin:0">기준일(${ymd(A.base)}) 현재 반제되지 않은 미결항목</dd>
          <dt style="color:var(--muted)">발생기준</dt><dd style="margin:0">기준일 − 증빙일, 5구간</dd>
          <dt style="color:var(--muted)">공시용</dt><dd style="margin:0">기준일 − 만기일, 6구간 (달력 개월)</dd>
          <dt style="color:var(--muted)">외화</dt><dd style="margin:0">화폐성 채권만 기말환율 환산 (${Object.entries(S.W.config.fx).map(([k, v]) => `${k} ${v.toLocaleString('en-US')}`).join(', ') || '환율 없음'})</dd>
          <dt style="color:var(--muted)">충당금</dt><dd style="margin:0">${rates}. 부실 ${pct(S.W.config.gradeRates['부실'], 0)}, 대손 ${pct(S.W.config.gradeRates['대손'], 0)} 우선. 음수·선수금·거래선 없음 제외</dd>
        </dl>
      </div>
    </div>
  </section>`;
}

/* ---- 렌더 ---- */
function render() {
  const r = route();
  if (!S.W || r === 'upload') { root.innerHTML = pageUpload(); document.title = '채권연령 분석기'; bindDrop(); return; }
  const page = { summary: pageSummary, aging: pageAging, risk: pageRisk, recon: pageRecon }[r] || pageSummary;
  const active = PAGES.find(p => p.id === r) ? r : 'summary';
  root.innerHTML = shell(active, page());
  document.title = `${PAGES.find(p => p.id === active).name} · 채권연령 분석기`;
}

/* ---- 이벤트 ---- */
function busy(on, msg) {
  let el = document.getElementById('busy');
  if (on && !el) { el = document.createElement('div'); el.id = 'busy'; el.className = 'busy'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  if (el) { if (on) el.textContent = msg || '계산 중…'; else el.remove(); }
}
function go(id) { if (route() === id) render(); else location.hash = '#/' + id; }
function startSample() {
  busy(true, '샘플 데이터 만드는 중…');
  setTimeout(() => {
    try { load(buildSample(), SAMPLE_FILE, true); go('summary'); } catch (e) { S.error = e.message; render(); console.error(e); }
    busy(false);
  }, 20);
}
function readFile(file) {
  if (!file) return;
  if (typeof XLSX === 'undefined') { S.error = '엑셀 라이브러리(SheetJS)를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'; render(); return; }
  busy(true, `${file.name} 읽는 중…`);
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const wb = XLSX.read(new Uint8Array(fr.result), { type: 'array' });
      load(workbookToSheets(wb), file.name, false);
      go('summary');
    } catch (e) { S.error = e.message || String(e); console.error(e); render(); }
    busy(false);
  };
  fr.onerror = () => { S.error = '파일을 읽지 못했어요.'; busy(false); render(); };
  fr.readAsArrayBuffer(file);
}
function bindDrop() {
  const d = document.getElementById('drop'); if (!d) return;
  ['dragenter', 'dragover'].forEach(t => d.addEventListener(t, e => { e.preventDefault(); d.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => d.addEventListener(t, e => { e.preventDefault(); d.classList.remove('over'); }));
  d.addEventListener('drop', e => readFile(e.dataTransfer.files[0]));
  document.getElementById('file-in').addEventListener('change', e => readFile(e.target.files[0]));
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act;
  if (act === 'unit') { S.unit = b.dataset.v; S.D = derive(S.A, S.W, n => F(n)); render(); }
  else if (act === 'tab') { S.tab = +b.dataset.v; S.q = ''; render(); }
  else if (act === 'toggle') { S.open[b.dataset.k] = !S.open[b.dataset.k]; render(); }
  else if (act === 'sample') startSample();
  else if (act === 'dl-sample') { if (typeof XLSX === 'undefined') { S.error = '엑셀 라이브러리를 불러오지 못했어요.'; render(); return; } sampleWorkbookFile(buildSample()); }
  else if (act === 'home') { S.error = ''; location.hash = '#/upload'; }
  else if (act === 'base-reset') { S.base = S.W.config.baseDate; recompute(); render(); }
  else if (act === 'export') {
    if (typeof XLSX === 'undefined') { alert('엑셀 라이브러리를 불러오지 못했어요.'); return; }
    b.disabled = true; setTimeout(() => { try { exportWorkbook(S.A, S.W, S.CK); } finally { b.disabled = false; } }, 10);
  }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches('[data-base]')) {
    const v = toDn(t.value); if (v == null) return;
    busy(true); setTimeout(() => { S.base = v; recompute(); render(); busy(false); }, 10);
  } else if (t.matches('[data-nav]')) go(t.value);
});
document.addEventListener('input', e => {
  if (!e.target.matches('[data-search]')) return;
  S.q = e.target.value;
  const pos = e.target.selectionStart;
  render();
  const el = document.getElementById('cust-q'); if (el) { el.focus(); el.setSelectionRange(pos, pos); }
});
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
render();
