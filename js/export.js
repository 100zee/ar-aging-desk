/* ===== 엑셀 내보내기 (금액 단위: 원) ===== */
function exportWorkbook(A, W, CK) {
  const won = n => Math.round(n);
  const D = derive(A, W, n => Math.round(n).toLocaleString('en-US') + '원');
  const P = v => ({ v, z: '0.0%' });
  const DT = d => (d == null ? null : { v: d + 25569, z: 'yyyy-mm-dd' });
  const wb = XLSX.utils.book_new();
  function add(name, aoa, widths) {
    const ws = XLSX.utils.aoa_to_sheet(aoa.map(row => (row || []).map(v => (v && typeof v === 'object' ? v.v : v))));
    aoa.forEach((row, r) => (row || []).forEach((v, c) => {
      const ref = XLSX.utils.encode_cell({ r, c }), cell = ws[ref];
      if (!cell || cell.t !== 'n') return;
      cell.z = v && typeof v === 'object' ? v.z : Number.isInteger(cell.v) ? '#,##0' : '#,##0.0';
    }));
    ws['!cols'] = (widths || []).map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  const title = (t, extra) => [[t], [`기준일 ${ymd(A.base)} · ${D.q} · 단위 원${extra ? ' · ' + extra : ''}`], []];

  /* 요약 */
  const s = title('매출채권 연령분석 요약');
  s.push(['항목', '당분기', '전분기', '증감']);
  s.push(['총 매출채권', won(A.arTotal), D.hasPrev ? won(D.prevTot) : null, D.hasPrev ? won(A.arTotal - D.prevTot) : null]);
  s.push(['120일 이상', won(A.ar120), D.hasPrev ? won(D.prev120) : null, D.hasPrev ? won(A.ar120 - D.prev120) : null]);
  s.push(['120일 이상 비중', P(D.share), D.prevShare != null ? P(D.prevShare) : null, D.prevShare != null ? P(D.share - D.prevShare) : null]);
  s.push(['대손충당금(매출채권)', won(A.provAR), D.prevProv ? won(D.prevProv) : null, D.prevProv ? won(A.provAR - D.prevProv) : null]);
  s.push(['DSO 전체(일)', A.dso.all != null ? +A.dso.all.toFixed(1) : null]);
  for (const sub of SUBS) s.push([`DSO ${sub}(일)`, A.dso[sub] != null ? +A.dso[sub].toFixed(1) : null]);
  s.push([]);
  s.push(['소분류', ...BUCKETS, '합계', '충당금']);
  for (const sub of SUBS) s.push([sub, ...A.bySub[sub].buckets.map(won), won(A.bySub[sub].total), won(A.bySub[sub].prov)]);
  for (const [k, o] of Object.entries(A.others)) s.push([k, ...o.buckets.map(won), won(o.total), won(o.prov)]);
  s.push([]);
  s.push(['주요 이슈']);
  D.issues.forEach(i => s.push([i.tag, i.title, i.body]));
  s.push([]);
  s.push(['권고사항']);
  D.recs.forEach((r, i) => s.push([i + 1, stripTags(r)]));
  if (D.cmpNote) s.push([], [D.cmpNote]);
  add('요약', s, [22, 16, 16, 16, 16, 16, 16, 16]);

  /* 내수·수출 연령분석 */
  SUBS.forEach((sub, i) => {
    const a = title(`${sub} 거래선별 연령분석`, '발생기준');
    a.push(['거래선코드', '거래선명', '관리등급', ...BUCKETS, '합계', '구성비', '충당금']);
    const T = A.bySub[sub].total;
    for (const c of A.pivots[sub]) a.push([c.code, c.name, c.grade, ...c.buckets.map(won), won(c.total), P(T ? c.total / T : 0), won(c.prov)]);
    a.push(['', '합계', '', ...A.bySub[sub].buckets.map(won), won(T), P(1), won(A.bySub[sub].prov)]);
    add(['내수 연령분석', '수출 연령분석'][i], a, [12, 30, 9, 14, 14, 14, 14, 14, 15, 9, 14]);
  });

  /* 공시용 */
  const d = title('공시용 연령표', '만기경과 기준');
  d.push(['소분류', ...DISC, '합계']);
  for (const sub of SUBS) d.push([sub, ...A.bySub[sub].disc.map(won), won(A.bySub[sub].total)]);
  d.push(['합계', ...DISC.map((_, j) => won(sumArr(SUBS.map(x => A.bySub[x].disc[j])))), won(A.arTotal)]);
  add('공시용', d, [18, 14, 14, 14, 14, 14, 14, 15]);

  /* 전분기비교 */
  const c = title(`전분기(${D.pq}) 대비 구간별 증감`);
  if (D.hasPrev) {
    c.push(['구간', ...SUBS.flatMap(x => [`${x} ${D.pq}`, `${x} ${D.q}`, '증감', '증감률'])]);
    const rowOf = (label, f) => [label, ...SUBS.flatMap(x => { const p = f(A.compare[x].prev || [0, 0, 0, 0, 0]), q = f(A.compare[x].cur); return [won(p), won(q), won(q - p), p ? P(q / p - 1) : null]; })];
    BUCKETS.forEach((b, j) => c.push(rowOf(b, arr => arr[j])));
    c.push(rowOf('합계', sumArr));
    c.push(['충당금', ...SUBS.flatMap(x => { const p = A.compare[x].prevProv || 0, q = A.compare[x].curProv; return [won(p), won(q), won(q - p), p ? P(q / p - 1) : null]; })]);
    if (D.cmpNote) c.push([], [D.cmpNote]);
  } else c.push(['전분기 요약 자료가 없어요.']);
  add('전분기비교', c, [14, 16, 16, 14, 9, 16, 16, 14, 9]);

  /* 리스크분석 */
  const r = title('리스크 거래선');
  r.push(['[120일 이상 채권 보유 거래선]']);
  r.push(['거래선코드', '거래선명', '구분', '관리등급', D.pq, D.q, '증감', '변동', '총 채권', '총 채권 대비']);
  A.risk120.forEach(x => r.push([x.code, x.name, D.regionOf(x.code), x.grade, won(x.prev), won(x.cur), won(x.diff), x.status, won(x.total), x.total > 0 ? P(x.cur / x.total) : null]));
  r.push([], ['[여신한도 초과]']);
  r.push(['거래선코드', '거래선명', '관리등급', '신용등급', '영업팀', '여신한도', '사용액', '초과액', '사용률']);
  A.credit.forEach(x => r.push([x.code, x.name, x.grade, x.rating, x.team, won(x.limit), won(x.used), won(x.over), P(x.ratio)]));
  r.push([], ['[매출채권 회전일수]']);
  r.push(['구분', '기말 매출채권', '분기 매출액', '일수', 'DSO(일)', '평균 약정일']);
  SUBS.forEach(x => r.push([x, won(A.bySub[x].total), A.sales[x] || null, A.salesDays, A.dso[x] != null ? +A.dso[x].toFixed(1) : null, D.avgTerm[x] != null ? +D.avgTerm[x].toFixed(1) : null]));
  r.push(['전체', won(A.arTotal), sumArr(SUBS.map(x => A.sales[x] || 0)) || null, A.salesDays, A.dso.all != null ? +A.dso.all.toFixed(1) : null]);
  r.push([], ['[관리등급 조정 의견]']);
  r.push(['거래선코드', '거래선명', '현재', '제안', '방향', '근거', '채권 잔액', '120일 이상', '만기경과']);
  A.gradeIssues.forEach(g => r.push([g.code, g.name, g.grade, g.sug, g.dir, g.why, won(g.total), won(g.b120), won(g.overdue)]));
  add('리스크분석', r, [12, 30, 10, 10, 14, 14, 14, 10, 14, 12]);

  /* 계정대사 */
  const k = title('계정대사', '원계정 기준(재분류 전)');
  k.push(['계정코드', '계정명', '대분류', '건수', 'RAW 합계', '(−) 제외', '(+) 외화평가', '분석 대상', '시산표', '차이', '재분류로 나간 금액']);
  A.recon.forEach(x => k.push([x.code, x.name, x.big, x.n, won(x.rawSum), won(-x.exSum), won(x.reval), won(x.analysis), x.tb == null ? null : won(x.tb), x.diff == null ? null : won(x.diff), won(x.reclOut)]));
  const tk = f => won(sumArr(A.recon.map(f)));
  k.push(['', '합계', '', sumArr(A.recon.map(x => x.n)), tk(x => x.rawSum), tk(x => -x.exSum), tk(x => x.reval), tk(x => x.analysis), tk(x => x.tb || 0), tk(x => x.diff || 0), tk(x => x.reclOut)]);
  add('계정대사', k, [12, 22, 12, 8, 16, 14, 14, 16, 16, 12, 14]);

  /* 제외항목 */
  const e = title('제외 항목');
  e.push(['계정코드', '거래선코드', '거래선명', '텍스트', '증빙일', '반제일', '통화', '현지통화금액', '제외 사유']);
  A.rows.filter(x => !x.incl).forEach(x => e.push([x.acct, x.cust, x.custName, x.text, DT(x.docDate), DT(x.clearDate), x.cur, won(x.local), x.exReason]));
  add('제외항목', e, [12, 12, 28, 24, 12, 12, 8, 16, 18]);

  /* 데이터점검 */
  const ck = title('데이터 점검');
  ck.push(['구분', '수준', '점검 항목', '건수', '금액', '처리']);
  CK.forEach(x => ck.push([CHECK_TAG[x.key] || '확인', x.sev, x.title, x.n, x.amt == null ? null : won(x.amt), x.how]));
  const det = CK.filter(x => x.detail && x.detail.length);
  if (det.length) { ck.push([]); det.forEach(x => { ck.push([`[${x.title}]`]); x.detail.forEach(t => ck.push(['', '', t])); }); }
  add('데이터점검', ck, [10, 8, 34, 10, 16, 60]);

  /* 채권원장분석 */
  const L = [['계정코드', '분석계정', '분석계정명', '대분류', '소분류', '거래선코드', '거래선명', '관리등급', '텍스트', '증빙일', '만기일', '만기 출처', 'PayT(적용)', '통화', '전표통화금액', '적용환율', '현지통화금액', '분석금액', '경과일', '발생구간', '만기경과일', '공시구간', '충당금률', '충당금', '포함', '제외 사유']];
  A.rows.forEach(x => L.push([x.acct, x.finalAcct, x.finalName, x.big, x.sub, x.cust, x.custName, x.grade, x.text, DT(x.docDate), DT(x.due), x.dueSrc, x.payEff, x.cur, x.docAmt, x.rate, won(x.local), won(x.amt), x.age, BUCKETS[x.bucket], x.over, DISC[x.disc], x.provRate != null ? P(x.provRate) : null, won(x.prov), x.incl ? 'Y' : 'N', x.exReason]));
  add('채권원장분석', L, [11, 11, 18, 11, 16, 11, 26, 8, 22, 11, 11, 10, 9, 6, 14, 10, 14, 14, 7, 11, 9, 11, 8, 12, 5, 16]);

  XLSX.writeFile(wb, `AR_aging_${D.q}_${ymd(A.base)}.xlsx`);
}
