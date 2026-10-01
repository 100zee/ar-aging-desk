/* ===== 보고서 문구·파생 수치 (화면과 엑셀이 같이 쓴다) ===== */

function qLabel(d) { const x = new Date(d * DAY); return String(x.getUTCFullYear()).slice(2) + (Math.floor(x.getUTCMonth() / 3) + 1) + 'Q'; }
function prevQLabel(d) { const x = new Date(d * DAY); return qLabel(dn(x.getUTCFullYear(), Math.floor(x.getUTCMonth() / 3) * 3, 0)); }
function sumArr(a) { return a.reduce((s, x) => s + x, 0); }
function pct(x, d) { return x == null || !isFinite(x) ? '–' : (x * 100).toFixed(d == null ? 1 : d) + '%'; }
function spct(x) { return x == null || !isFinite(x) ? '–' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x * 100).toFixed(1) + '%'; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function stripTags(s) { return String(s).replace(/<[^>]+>/g, ''); }

/* F: 금액 포맷 함수(단위 반영) */
function derive(A, W, F) {
  const D = { q: qLabel(A.base), pq: prevQLabel(A.base) };
  const master = new Map(W.master.map(m => [m.code, m]));
  D.regionOf = c => (master.get(c) || {}).region || '';

  let prevTot = 0, prev120 = 0, prevProv = 0, hasPrev = false;
  for (const s of SUBS) { const c = A.compare[s]; if (c.prev) { hasPrev = true; prevTot += sumArr(c.prev); prev120 += c.prev[4]; prevProv += c.prevProv || 0; } }
  Object.assign(D, { hasPrev, prevTot, prev120, prevProv });
  D.share = A.arTotal ? A.ar120 / A.arTotal : 0;
  D.prevShare = prevTot ? prev120 / prevTot : null;
  D.n120 = A.risk120.filter(r => r.cur > 0).length;
  D.subShare = SUBS.map(s => A.bySub[s].total ? A.bySub[s].buckets[4] / A.bySub[s].total : 0);

  // 금액가중 평균 약정일(만기일 − 증빙일)
  D.avgTerm = {};
  for (const s of SUBS) {
    let w = 0, t = 0;
    for (const r of A.ar) { if (r.sub !== s || r.amt <= 0 || r.due == null || r.docDate == null) continue; w += r.amt; t += r.amt * (r.due - r.docDate); }
    D.avgTerm[s] = w ? t / w : null;
  }

  /* 주요 이슈 */
  const issues = [];
  const tops = A.risk120.filter(r => r.cur > 0);
  if (tops.length) {
    const t = tops[0], reg = D.regionOf(t.code);
    issues.push({ tag: '120일+', cls: 'sev-crit', title: (reg ? reg + ' ' : '') + '장기채권 집중', body: `${t.name} ${F(t.cur)} (전분기 ${t.prev ? F(t.prev) : '없음'}). 120일 이상의 ${pct(t.cur / A.ar120, 0)}가 한 거래선` });
  } else issues.push({ tag: '120일+', cls: 'sev-ok', title: '120일 이상 채권 없음', body: '장기 미회수 채권이 없어요.' });
  if (A.credit.length) {
    issues.push({ tag: '여신', cls: 'sev-warn', title: `여신한도 초과 ${A.credit.length}곳, 합계 ${F(sumArr(A.credit.map(c => c.over)))}`, body: A.credit.slice(0, 3).map(c => `${c.name} ${pct(c.ratio, 0)}`).join(', ') });
  } else issues.push({ tag: '여신', cls: 'sev-ok', title: '여신한도 초과 없음', body: '모든 거래선이 한도 안에 있어요.' });
  if (A.gradeIssues.length) {
    const k = A.gradeIssues.filter(g => g.grade === '정상' && g.total && g.b120 / g.total >= 0.2).length;
    const up = A.gradeIssues.filter(g => g.dir === '상향').length;
    issues.push({ tag: '등급', cls: 'sev-info', title: `관리등급과 실제 연체 불일치 ${A.gradeIssues.length}곳`, body: k ? `정상 등급인데 120일 이상 비중 20%를 넘는 곳 ${k}곳 포함` : `상향 ${up}곳 · 하향 ${A.gradeIssues.length - up}곳` });
  } else issues.push({ tag: '등급', cls: 'sev-ok', title: '관리등급과 연체 수준 일치', body: '조정이 필요한 거래선이 없어요.' });
  D.issues = issues;

  /* 권고사항 (HTML, 이름은 escape) */
  const recs = [];
  const c0 = A.credit[0], r0 = tops[0];
  if (c0) {
    const has120 = A.risk120.find(r => r.code === c0.code && r.cur > 0);
    recs.push(`<b>${esc(c0.name)}</b> ` + (has120 ? '신규 출하 전 여신 승인 재검토, 120일 이상분 분할상환 협의' : `여신한도 ${pct(c0.ratio, 0)} 사용 중. 한도 증액 심사 또는 출하 조정`));
  }
  if (r0 && (!c0 || r0.code !== c0.code)) recs.push(`<b>${esc(r0.name)}</b> 120일 이상 ${F(r0.cur)} 회수 계획 수립, 담보·분할상환 협의`);
  const ups = A.gradeIssues.filter(g => g.dir === '상향');
  if (ups.length) {
    let extra = 0;
    for (const g of ups) {
      const rate = W.config.gradeRates[g.sug]; if (rate == null) continue;
      for (const r of A.ar) if (r.cust === g.code && r.amt > 0) extra += r.amt * rate - r.prov;
    }
    recs.push(`관리등급 <b>${ups.length}개 거래선 상향</b> 반영 후 충당금 재산정` + (extra > 0 ? ` (추가 설정 약 ${F(extra)})` : ''));
  }
  const F0 = A.findings;
  if (F0.reclass.length) recs.push(`미수금 오분류 재발 방지: 제품매출은 <b>매출채권 계정</b>으로만 기표하도록 통제 (이번 분기 ${F0.reclass.length}건, ${F(sumArr(F0.reclass.map(r => r.amt)))})`);
  if (F0.unregistered.size) recs.push(`마스터 미등록 거래선 <b>${F0.unregistered.size}곳</b> 등록 요청 (등급·여신한도 판단 불가)`);
  D.recs = recs.slice(0, 4);

  /* 전분기 대비 증감 원인 */
  if (hasPrev) {
    const d120 = A.ar120 - prev120;
    if (d120 > 0) {
      const inc = A.risk120.filter(r => r.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 3);
      const incSum = sumArr(inc.map(r => r.diff));
      D.cmpNote = `증감 원인: 120일 이상이 전분기보다 ${F(d120)} 늘었어요. ` + (incSum <= d120
        ? `이 중 ${F(incSum)}가 ${inc.map(r => r.name).join('·')} ${inc.length}곳에서 발생.`
        : `증가가 큰 곳은 ${inc.map(r => `${r.name}(+${F(r.diff)})`).join(', ')}이고, 감소·해소분이 일부를 상쇄했어요.`);
    } else {
      const dec = A.risk120.filter(r => r.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 3);
      D.cmpNote = `120일 이상이 전분기보다 ${F(-d120)} 줄었어요.` + (dec.length ? ` 감소·해소가 큰 곳: ${dec.map(r => r.name).join('·')}.` : '');
    }
  }

  /* DSO 해설 */
  const gaps = SUBS.map(s => A.dso[s] != null && D.avgTerm[s] != null ? A.dso[s] - D.avgTerm[s] : null);
  D.dsoGap = gaps;
  const terms = SUBS.map((s, i) => D.avgTerm[s] != null ? `${['내수', '수출'][i]} 약 ${Math.round(D.avgTerm[s])}일` : null).filter(Boolean);
  if (terms.length && gaps.some(g => g != null)) {
    const worst = gaps[0] == null ? 1 : gaps[1] == null ? 0 : gaps[1] > gaps[0] ? 1 : 0;
    const g = gaps[worst];
    D.dsoNote = `금액가중 평균 약정일은 ${terms.join(', ')}이에요. ` + (g > 7 ? `${['내수', '수출'][worst]} 회전일수가 약정일보다 ${Math.round(g)}일 길어 회수 지연이 섞여 있어요.` : '두 부문 모두 약정일 범위 안에서 회수되고 있어요.');
  }
  return D;
}

const CHECK_TAG = { clr: '제외', fut: '제외', rcl: '재분류', fx: '환산', due: '보정', pay: '보정', unr: '확인', nam: '표기', neg: '참고', nc: '참고', nr: '확인', ua: '확인' };
function checkCount(c, A) {
  if (c.key === 'unr') return `${A.findings.unregistered.size}곳 ${c.n}건`;
  if (c.key === 'nam') return `${A.findings.nameDiff.size}곳`;
  return `${c.n.toLocaleString('en-US')}건`;
}
