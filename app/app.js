// 라온 테니스 AI 매니저 - Phase 1 화면
(function () {
  const store = window.RaonStore;
  const STATUSES = store.STATUSES;
  const $ = (s, el = document) => el.querySelector(s);
  const view = $("#view");

  // ---------- 한국 시간(KST) 날짜 도우미 ----------
  // 날짜는 "YYYY-MM-DD" 문자열로만 다룹니다. 계산은 UTC 기준 Date로 해서 기기 시간대 영향을 받지 않게 합니다.
  const kstFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
  const todayKST = () => kstFmt.format(new Date());
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const fmt = (dt) => dt.toISOString().slice(0, 10);
  const addDays = (s, n) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return fmt(d); };
  const dow = (s) => parse(s).getUTCDay();
  const DOW = ["일", "월", "화", "수", "목", "금", "토"];
  const labelDate = (s) => { const d = parse(s); return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${DOW[d.getUTCDay()]})`; };
  const labelLong = (s) => { const d = parse(s); return `${d.getUTCFullYear()}년 ` + labelDate(s); };
  const kstDateTime = (iso) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sClass = (st) => "s-" + String(st).split(" ")[0];

  // ---------- 상태 ----------
  const state = {
    tab: "calendar",
    calMode: "month",
    cursor: todayKST(),     // 보고 있는 달/주 기준 날짜
    selected: todayKST(),   // 선택된 날짜
    venues: [],
    reservations: [],
    attendance: [],         // 내 참석 일정 (달력의 빨간 점)
    listFilter: { status: "전체", scope: "upcoming" },
  };
  const venueName = (id) => (state.venues.find((v) => v.id === id) || {}).venue_name || "(삭제된 장소)";
  const byTime = (a, b) => (a.reservation_date + a.start_time).localeCompare(b.reservation_date + b.start_time);
  const onDate = (d) => state.reservations.filter((r) => r.reservation_date === d).sort(byTime);

  // ---------- 내 참석 일정 ----------
  const ME_KEY = "raon_me";
  const me = () => { try { return localStorage.getItem(ME_KEY) || "유환준"; } catch (e) { return "유환준"; } };
  // 참석이 예약에 연결돼 있으면 예약의 시간·장소·코트를 따라감
  const attView = (a) => {
    const r = a.reservation_id ? state.reservations.find((x) => x.id === a.reservation_id) : null;
    return { start: r ? r.start_time : a.start_time, end: r ? r.end_time : a.end_time, venue_id: r ? r.venue_id : a.venue_id, court: r ? r.court_number : a.court_number, res: r };
  };
  const myAtt = (d) => state.attendance.filter((a) => a.attend_date === d && a.member_name === me())
    .sort((a, b) => String(attView(a).start || "99").localeCompare(String(attView(b).start || "99")));
  // 일요일은 정기 모임: 따로 저장하지 않아도 참석으로 봄 (빨간 점) — 2026년 11월 말까지만
  const SUN_UNTIL = "2026-11-30";
  const isSun = (d) => d <= SUN_UNTIL && parse(d).getUTCDay() === 0;
  const hasAtt = (d) => isSun(d) || myAtt(d).length > 0;
  const sunCard = () => `<div class="res att">
      <span class="bar"></span>
      <span class="main">
        <div class="t">🙋 참석 · 일요일 정기 참석</div>
        <div class="sub">11월 말까지 일요일은 참석으로 표시돼요.</div>
      </span>
    </div>`;
  // 그날의 참석 카드들: 일요일인데 따로 넣은 참석이 없으면 정기 참석 카드
  const attCards = (d) => { const a = myAtt(d); return a.length ? a.map((x) => attCard(x)).join("") : isSun(d) ? sunCard() : ""; };
  const myAttFor = (resId) => state.attendance.find((a) => a.reservation_id === resId && a.member_name === me());
  function attCard(a, showDate) {
    const v = attView(a);
    const time = v.start ? `${v.start}${v.end ? "~" + v.end : ""}` : "시간 미정";
    const place = [v.venue_id ? venueName(v.venue_id) : "", v.court ? `${v.court}번 코트` : ""].filter(Boolean).join(" · ");
    return `<div class="res att">
      <span class="bar"></span>
      <span class="main">
        <div class="t">🙋 참석 · ${esc((showDate ? labelDate(a.attend_date) + " " : "") + time)}</div>
        <div class="sub">${esc(place || "장소 미정")}${v.res && v.res.status === "취소" ? " · ⚠ 예약이 취소됨" : ""}</div>
        ${a.memo ? `<div class="sub">📝 ${esc(a.memo)}</div>` : ""}
      </span>
      <span><button class="smallbtn" data-attdel="${esc(a.id)}">참석 취소</button></span>
    </div>`;
  }

  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.remove("hidden");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add("hidden"), 2200);
  }

  async function reload() {
    try {
      [state.venues, state.reservations] = await Promise.all([store.listVenues(), store.listReservations()]);
    } catch (e) { toast(e.message); }
    try { state.attendance = await store.listAttendance(); } catch (e) { state.attendance = []; }
  }

  // ---------- 예약 카드 ----------
  function resCard(r, showDate) {
    const when = (showDate ? labelDate(r.reservation_date) + " · " : "") + `${r.start_time}~${r.end_time}`;
    return `<button class="res ${sClass(r.status)} ${r.status === "취소" ? "cancelled" : ""}" data-res="${esc(r.id)}">
      <span class="bar"></span>
      <span class="main">
        <div class="t">${esc(when)}</div>
        <div class="sub">${esc(venueName(r.venue_id))} · ${esc(r.court_number)}번 코트${r.reserved_by ? " · " + esc(r.reserved_by) : ""}${myAttFor(r.id) ? ` · <b class="attmark">🙋 내 참석</b>` : ""}</div>
        ${r.memo ? `<div class="sub">📝 ${esc(r.memo)}</div>` : ""}
      </span>
      <span><span class="chip">${esc(r.status)}</span></span>
    </button>`;
  }
  const legend = () => `<div class="legend">${STATUSES.map((s) => `<span class="${sClass(s)}"><i class="dot"></i>${s}</span>`).join("")}<span><i class="dot att"></i>내 참석</span></div>`;

  // ---------- 캘린더 ----------
  function renderCalendar() {
    const c = parse(state.cursor);
    const y = c.getUTCFullYear(), m = c.getUTCMonth();
    const today = todayKST();
    let title, body;

    if (state.calMode === "month") {
      title = `${y}년 ${m + 1}월`;
      const first = fmt(new Date(Date.UTC(y, m, 1)));
      const start = addDays(first, -dow(first));
      let cells = DOW.map((d, i) => `<div class="dow ${i === 0 ? "sun" : i === 6 ? "sat" : ""}">${d}</div>`).join("");
      for (let i = 0; i < 42; i++) {
        const d = addDays(start, i);
        const dt = parse(d);
        if (i === 35 && dt.getUTCMonth() !== m) break; // 6번째 줄이 필요 없으면 생략
        const list = onDate(d);
        const att = hasAtt(d) ? `<i class="dot att"></i>` : "";
        const dots = att + list.slice(0, 4).map((r) => `<i class="dot ${sClass(r.status)}"></i>`).join("");
        const more = list.length > 4 ? `<span class="more">+${list.length - 4}</span>` : "";
        const cls = ["day", dt.getUTCMonth() !== m ? "other" : "", d === today ? "today" : "", d === state.selected ? "sel" : "", dt.getUTCDay() === 0 ? "sun" : dt.getUTCDay() === 6 ? "sat" : ""].join(" ");
        cells += `<button class="${cls}" data-date="${d}"><span class="n">${dt.getUTCDate()}</span><span class="dots">${dots}${more}</span></button>`;
      }
      body = `<div class="grid">${cells}</div>`;
    } else {
      const start = addDays(state.cursor, -dow(state.cursor));
      const end = addDays(start, 6);
      const s = parse(start), e = parse(end);
      title = `${s.getUTCMonth() + 1}/${s.getUTCDate()} ~ ${e.getUTCMonth() + 1}/${e.getUTCDate()}`;
      body = "";
      for (let i = 0; i < 7; i++) {
        const d = addDays(start, i);
        const list = onDate(d);
        body += `<div class="week-day"><h3 class="${d === today ? "today" : ""}">${labelDate(d)}${d === today ? " · 오늘" : ""}</h3>
          ${attCards(d)}
          ${list.length ? list.map((r) => resCard(r)).join("") : `<div class="empty">예약 없음</div>`}</div>`;
      }
    }

    const sel = onDate(state.selected);
    const selAtt = attCards(state.selected);
    view.innerHTML = `
      <div class="card">
        <div class="cal-head">
          <button class="iconbtn" data-nav="-1" aria-label="이전">‹</button>
          <h2>${title}</h2>
          <button class="iconbtn" data-nav="1" aria-label="다음">›</button>
        </div>
        <div class="cal-head">
          <div class="seg"><button data-mode="month" class="${state.calMode === "month" ? "on" : ""}">월간</button><button data-mode="week" class="${state.calMode === "week" ? "on" : ""}">주간</button></div>
          <button class="todaybtn" data-today>오늘</button>
        </div>
        ${body}
        ${legend()}
      </div>
      ${state.calMode === "month" ? `
        <div class="section-title"><span>${labelDate(state.selected)} · ${esc(me())} 참석</span><button class="smallbtn" data-attadd="${state.selected}">🙋 참석 추가</button></div>
        ${selAtt || `<div class="note" style="margin:0 0 8px">이 날은 참석 일정이 없어요.</div>`}
        <div class="section-title"><span>${labelDate(state.selected)} 예약 ${sel.length}건</span></div>
        ${sel.length ? sel.map((r) => resCard(r)).join("") : `<div class="empty-box">이 날은 예약이 없어요.<br>오른쪽 아래 ＋ 버튼으로 추가할 수 있어요.</div>`}` : ""}
    `;
  }

  // ---------- 예약 목록 ----------
  function renderList() {
    const f = state.listFilter;
    const today = todayKST();
    let list = state.reservations.slice();
    if (f.scope === "upcoming") list = list.filter((r) => r.reservation_date >= today);
    else if (f.scope === "past") list = list.filter((r) => r.reservation_date < today);
    if (f.status !== "전체") list = list.filter((r) => r.status === f.status);
    list.sort(byTime);
    if (f.scope === "past") list.reverse();

    let groups = "", lastMonth = "";
    list.forEach((r) => {
      const mo = r.reservation_date.slice(0, 7);
      if (mo !== lastMonth) { groups += `<div class="month-group"><h3>${Number(mo.slice(0, 4))}년 ${Number(mo.slice(5))}월</h3></div>`; lastMonth = mo; }
      groups += resCard(r, true);
    });

    view.innerHTML = `
      <div class="card filters">
        <div class="field" style="margin:0"><label>기간</label>
          <select id="fScope">
            <option value="upcoming" ${f.scope === "upcoming" ? "selected" : ""}>오늘 이후</option>
            <option value="past" ${f.scope === "past" ? "selected" : ""}>지난 예약</option>
            <option value="all" ${f.scope === "all" ? "selected" : ""}>전체</option>
          </select></div>
        <div class="field" style="margin:0"><label>상태</label>
          <select id="fStatus">${["전체"].concat(STATUSES).map((s) => `<option ${f.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
      </div>
      <div class="section-title"><span>예약 ${list.length}건</span></div>
      ${list.length ? groups : `<div class="empty-box">조건에 맞는 예약이 없어요.</div>`}
    `;
    $("#fScope").onchange = (e) => { f.scope = e.target.value; renderList(); };
    $("#fStatus").onchange = (e) => { f.status = e.target.value; renderList(); };
  }

  // ---------- 설정 / 장소 관리 ----------
  async function renderSettings() {
    const u = await store.user();
    const venues = state.venues.map((v) => {
      const courts = (v.court_information || []).join(", ");
      return `<div class="venue"><div><div class="name">${esc(v.venue_name)}</div>
        <div class="sub">${courts ? "코트: " + esc(courts) : "코트 번호 미등록"}${v.address ? " · " + esc(v.address) : ""}</div></div>
        <button class="smallbtn" data-venue="${esc(v.id)}">수정</button></div>`;
    }).join("");
    view.innerHTML = `
      <div class="section-title"><span>장소 관리</span><button class="smallbtn" data-venue="">＋ 장소 추가</button></div>
      <div class="card">${venues || `<div class="empty-box">등록된 장소가 없어요.</div>`}</div>
      <div class="section-title"><span>내 이름 (참석 일정)</span></div>
      <div class="card">
        <div class="field" style="margin-bottom:6px"><input id="meName" value="${esc(me())}" placeholder="예: 유환준"></div>
        <p class="note">달력의 빨간 점(내 참석)은 이 이름으로 저장·표시돼요.</p>
      </div>
      ${store.mode === "local" ? "" : `
      <div class="section-title"><span>📲 카톡 알림 자동 수집 (갤럭시)</span></div>
      <div class="card">
        <p class="note" style="margin-top:0">갤럭시에 뜨는 <b>라온 단톡방 알림</b>을 자동으로 받아, 앱을 열면 예약 관련 글만 AI가 분석해 <b>제안</b>으로 보여 줘요. (승인은 지금처럼 직접)</p>
        <div class="field"><label>라온 단톡방 이름 (카톡 방 이름에 들어 있는 글자)</label><input id="roomName" placeholder="예: 라온" value=""></div>
        <div class="stat" id="inboxStat">불러오는 중…</div>
        <label class="chkline"><input type="checkbox" id="autoInbox" ${autoInbox() ? "checked" : ""}> 앱을 열 때 새 알림을 자동으로 AI 분석</label>
        <div class="btns"><button class="btn ghost" id="newToken">🔑 연결 코드 새로 만들기</button></div>
        <div id="tokenBox"></div>
        <p class="note">폰 설정은 <b>MacroDroid</b> 앱으로 해요. 연결 코드를 만든 뒤 안내대로 따라 하세요.</p>
      </div>`}
      <div class="section-title"><span>계정 · 데이터</span></div>
      <div class="card">
        ${store.mode === "local"
          ? `<p class="note"><b>체험 모드</b>입니다. 예약은 <b>이 기기 브라우저에만</b> 저장돼요. 인터넷 서버(Supabase)를 연결하면 폰·PC 어디서나 같은 예약이 보입니다.</p>`
          : `<p class="note">로그인: <b>${esc(u && u.email)}</b><br>예약은 인터넷 서버(Supabase)에 저장됩니다.</p>
             <div class="btns"><button class="btn ghost" id="logout">로그아웃</button></div>`}
        <p class="note">모든 날짜·시간은 한국 시간(KST) 기준입니다.</p>
      </div>
    `;
    const mn = $("#meName"); if (mn) mn.onchange = () => { const v = mn.value.trim(); if (!v) return; try { localStorage.setItem(ME_KEY, v); } catch (e) { /* 저장 불가 */ } toast("이름을 저장했어요."); };
    const lo = $("#logout"); if (lo) lo.onclick = async () => { await store.logout(); location.reload(); };
    if (store.mode !== "local") bindNotify();
  }

  // ---------- 카톡 알림 자동 수집 (Phase 5) ----------
  const AUTO_KEY = "raon_auto_inbox";
  const autoInbox = () => { try { return localStorage.getItem(AUTO_KEY) !== "0"; } catch (e) { return true; } };
  const fmtKST = (iso) => new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(0, 16).replace("T", " ");
  async function sha256hex(t) {
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
    return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  async function bindNotify() {
    const rn = $("#roomName"), st = $("#inboxStat");
    let cfg = { room_name: "", token_hash: "" };
    try {
      cfg = await store.getNotifyConfig();
      const s2 = await store.inboxStats();
      state.inboxNew = s2.newCount;
      if (st) st.innerHTML = `연결 코드: <b>${cfg.token_hash ? "있음" : "아직 없음"}</b> · 마지막 수신: <b>${s2.last ? esc(fmtKST(s2.last)) : "없음"}</b> · 분석 기다리는 메시지 <b>${s2.newCount}</b>개`;
    } catch (e) { if (st) st.textContent = "불러오지 못했어요: " + e.message + " (서버 설정 SQL이 필요할 수 있어요)"; }
    if (rn) {
      rn.value = cfg.room_name || "";
      rn.onchange = async () => {
        try { await store.setNotifyConfig({ room_name: rn.value.trim() }); toast("단톡방 이름을 저장했어요."); } catch (e) { toast(e.message); }
      };
    }
    const ai = $("#autoInbox"); if (ai) ai.onchange = () => { try { localStorage.setItem(AUTO_KEY, ai.checked ? "1" : "0"); } catch (e) { /* 저장 불가 */ } };
    const nt = $("#newToken");
    if (nt) nt.onclick = async () => {
      if (!(rn && rn.value.trim())) { toast("먼저 라온 단톡방 이름을 넣어 주세요."); if (rn) rn.focus(); return; }
      if (cfg.token_hash && !confirm("새 코드를 만들면 예전 코드는 더 이상 쓸 수 없어요. 폰 MacroDroid의 주소도 새로 바꿔야 해요. 계속할까요?")) return;
      const bytes = crypto.getRandomValues(new Uint8Array(18));
      const token = [...bytes].map((x) => x.toString(16).padStart(2, "0")).join("");
      try {
        await store.setNotifyConfig({ room_name: rn.value.trim(), token_hash: await sha256hex(token) });
        cfg.token_hash = "set";
      } catch (e) { return toast(e.message); }
      const url = `${store.notifyUrl()}?token=${token}`;
      $("#tokenBox").innerHTML = `<div class="tokenbox">
        <p class="step" style="margin-top:0">연결 주소 (MacroDroid에 넣을 주소)</p>
        <div class="tokenurl">${esc(url)}</div>
        <div class="btns"><button class="btn primary" id="copyUrl">📋 연결 주소 복사</button><button class="btn ghost" id="testUrl">연결 시험</button></div>
        <p class="note">⚠ 이 주소는 지금만 보여요. 다른 사람에게 보내지 마세요. (잃어버리면 새로 만들면 돼요)</p>
        <ol class="howto">
          <li>Play 스토어에서 <b>MacroDroid</b> 설치 → 열기</li>
          <li><b>매크로 추가</b> → 트리거 <b>＋</b> → <b>기기 이벤트(또는 알림)</b> → <b>알림</b> → <b>알림 수신</b> → 앱 <b>카카오톡</b> 선택 → 알림 접근 권한 허용</li>
          <li>액션 <b>＋</b> → <b>웹 상호작용(인터넷)</b> → <b>HTTP 요청</b> → 방식 <b>POST</b> → URL에 위 주소 붙여넣기</li>
          <li>같은 화면의 <b>쿼리 매개변수</b>(Query parameters)에 3개 추가:<br>
            <code>title</code> = (… 눌러) <b>알림 제목</b><br><code>text</code> = <b>알림 텍스트</b><br><code>sub</code> = <b>알림 서브텍스트</b></li>
          <li>매크로 이름 "라온 알림" → 저장. 단톡방에 글이 오면 위 '마지막 수신' 시각이 바뀌어요.</li>
        </ol>
      </div>`;
      $("#copyUrl").onclick = async () => {
        try { await navigator.clipboard.writeText(url); toast("연결 주소를 복사했어요."); } catch (e) { window.prompt("길게 눌러 복사하세요.", url); }
      };
      $("#testUrl").onclick = async () => {
        try {
          const r = await fetch(url + "&test=1", { method: "POST" }).then((x) => x.json());
          toast(r.ok ? `연결 OK · 단톡방 이름: ${r.room || "(없음)"}` : "연결 실패: " + (r.error || ""));
        } catch (e) { toast("연결 실패: " + e.message); }
      };
    };
  }

  // 새로 받은 카톡 알림을 AI 분석 (자동 또는 버튼)
  // 연결해 둔 카톡 알림이 3일 넘게 안 들어오면 화면 위에 경고 (MacroDroid 꺼짐·체험 종료 등)
  const ALIVE_DAYS = 3, HUSH_KEY = "raon_inbox_warn_hush";
  async function checkInboxAlive(last) {
    const old = document.getElementById("inboxWarn"); if (old) old.remove();
    let cfg;
    try { cfg = await store.getNotifyConfig(); } catch (e) { return; }
    if (!cfg || !cfg.token_hash) return; // 연결 안 했으면 경고 안 함
    const ref = Date.parse(last || cfg.updated_at || 0);
    const days = (Date.now() - ref) / 86400e3;
    if (!(days > ALIVE_DAYS)) return;
    try { if (localStorage.getItem(HUSH_KEY) === todayKST()) return; } catch (e) { /* 무시 */ }
    const bar = document.createElement("div");
    bar.id = "inboxWarn"; bar.className = "warnbar";
    bar.innerHTML = `<span>⚠ 카톡 알림이 <b>${Math.floor(days)}일째</b> 안 들어와요. MacroDroid '라온 알림'이 켜져 있는지 확인해 주세요.</span>
      <button type="button" class="smallbtn" data-warn="go">확인하기</button><button type="button" class="warnx" data-warn="hush" aria-label="오늘은 그만 보기">✕</button>`;
    bar.addEventListener("click", (e) => {
      const b = e.target.closest("[data-warn]"); if (!b) return;
      e.stopPropagation();
      if (b.dataset.warn === "hush") { try { localStorage.setItem(HUSH_KEY, todayKST()); } catch (er) { /* 무시 */ } bar.remove(); return; }
      state.tab = "settings"; render();
    });
    document.querySelector(".topbar").after(bar);
  }

  let inboxChecking = false, inboxCheckedAt = 0;
  async function analyzeInbox(auto) {
    if (store.mode === "local" || imp.busy || inboxChecking) return;
    inboxChecking = true;
    try {
      let rows;
      try { rows = await store.listInbox(); } catch (e) { if (!auto) toast(e.message); return; }
      state.inboxNew = rows.length;
      if (!rows.length) { if (!auto) toast("새로 받은 카톡 알림이 없어요."); return; }
      imp.fileName = "카톡 알림 " + fmtKST(rows[rows.length - 1].received_at);
      imp.messages = rows.map((r, i) => ({ id: i, sent_at: fmtKST(r.received_at), author: r.sender || "(보낸 사람 모름)", text: r.body }));
      imp.fromDate = imp.messages[0].sent_at.slice(0, 10);
      imp.resume = null; imp.error = "";
      const cand = candidates();
      if (!cand.length) {
        await store.markInbox(rows.map((r) => r.id)); state.inboxNew = 0;
        if (!auto) toast("새 알림 중 예약 관련 글은 없었어요.");
        if (state.tab === "import") renderImport();
        return;
      }
      if (auto) toast(`카톡 알림 ${cand.length}개를 AI가 분석하고 있어요…`);
      await runAnalysis();
      if (!imp.error && !imp.resume) { await store.markInbox(rows.map((r) => r.id)); state.inboxNew = 0; }
      render();
    } finally { inboxChecking = false; inboxCheckedAt = Date.now(); }
  }
  function inboxCard() {
    if (store.mode === "local") return "";
    const n = state.inboxNew || 0;
    return `<div class="card">
      <p class="step">📲 카톡 알림으로 받은 메시지</p>
      <div class="stat">분석 기다리는 새 메시지 <b>${n}</b>개</div>
      <div class="btns"><button class="btn ${n ? "primary" : "ghost"}" id="inboxRun" ${imp.busy ? "disabled" : ""}>${imp.busy ? "분석 중…" : "📲 새 알림 지금 분석하기"}</button></div>
      <p class="note">설정 → '카톡 알림 자동 수집'에서 연결하면, 갤럭시에 뜬 라온 단톡방 알림이 여기로 들어와요.</p>
    </div>`;
  }

  // ---------- 팝업(시트) ----------
  const sheet = $("#sheet");
  function openSheet(html) { $(".sheet-body", sheet).innerHTML = html; sheet.classList.remove("hidden"); }
  function closeSheet() { sheet.classList.add("hidden"); }
  $(".sheet-backdrop", sheet).onclick = closeSheet;

  function courtField(venueId, value) {
    const v = state.venues.find((x) => x.id === venueId);
    const courts = (v && v.court_information) || [];
    if (courts.length) {
      const opts = courts.map((c) => `<option ${String(c) === String(value) ? "selected" : ""}>${esc(c)}</option>`).join("");
      const extra = value && !courts.map(String).includes(String(value)) ? `<option selected>${esc(value)}</option>` : "";
      return `<select name="court_number" required><option value="">선택</option>${opts}${extra}</select>`;
    }
    return `<input name="court_number" inputmode="numeric" placeholder="예: 2" value="${esc(value || "")}" required>`;
  }

  // opts: { title, extra: {source_message, confidence}, onSaved(saved) } - AI 제안 승인할 때 사용
  function openForm(r, opts) {
    opts = opts || {};
    const isEdit = !!(r && r.id);
    // AI 제안은 빈 칸을 임의로 채우지 않음 (관리자가 직접 확인해서 넣도록)
    const base = opts.extra
      ? { reservation_date: "", start_time: "", end_time: "", venue_id: "", court_number: "", reserved_by: "", status: "확인 필요", memo: "" }
      : { reservation_date: state.selected, start_time: "10:00", end_time: "12:00", venue_id: (state.venues[0] || {}).id, court_number: "", reserved_by: "", status: "확정", memo: "" };
    const d = Object.assign({}, base);
    Object.entries(r || {}).forEach(([k, v]) => { if (v !== null && v !== undefined) d[k] = v; });
    openSheet(`
      <h2>${opts.title || (isEdit ? "예약 수정" : "예약 추가")}<button class="close" data-close>×</button></h2>
      <form id="resForm" novalidate>
        <div id="formErr"></div>
        <div class="field"><label>날짜</label><input type="date" name="reservation_date" value="${esc(d.reservation_date)}" required></div>
        <div class="row2">
          <div class="field"><label>시작 시간</label><input type="time" name="start_time" step="600" value="${esc(d.start_time)}" required></div>
          <div class="field"><label>종료 시간</label><input type="time" name="end_time" step="600" value="${esc(d.end_time)}" required></div>
        </div>
        <div class="row2">
          <div class="field"><label>장소</label><select name="venue_id" required>${d.venue_id ? "" : `<option value="">선택</option>`}${state.venues.map((v) => `<option value="${esc(v.id)}" ${v.id === d.venue_id ? "selected" : ""}>${esc(v.venue_name)}</option>`).join("")}</select></div>
          <div class="field"><label>코트 번호</label><span id="courtWrap">${courtField(d.venue_id, d.court_number)}</span></div>
        </div>
        <div class="field"><label>예약자 (실제로 예약한 회원)</label><input name="reserved_by" placeholder="예: 김철수" value="${esc(d.reserved_by)}"></div>
        <div class="field"><label>상태</label>
          <div class="status-pick">${STATUSES.map((s) => `<button type="button" class="${sClass(s)} ${s === d.status ? "on" : ""}" data-status="${s}">${s}</button>`).join("")}</div>
          <input type="hidden" name="status" value="${esc(d.status)}">
        </div>
        <div class="field"><label>비고</label><textarea name="memo" placeholder="추가 안내사항">${esc(d.memo)}</textarea></div>
        <div class="btns"><button class="btn primary" type="submit">${isEdit ? "수정 저장" : "예약 등록"}</button></div>
      </form>`);
    const form = $("#resForm");
    form.venue_id.onchange = () => { $("#courtWrap").innerHTML = courtField(form.venue_id.value, ""); };
    form.querySelectorAll("[data-status]").forEach((b) => b.onclick = () => {
      form.querySelectorAll("[data-status]").forEach((x) => x.classList.remove("on"));
      b.classList.add("on"); form.status.value = b.dataset.status;
    });
    form.onsubmit = async (e) => {
      e.preventDefault();
      const data = Object.assign(Object.fromEntries(new FormData(form).entries()), opts.extra || {});
      if (isEdit) data.id = d.id;
      const btn = form.querySelector("[type=submit]"); btn.disabled = true;
      try {
        const saved = await store.saveReservation(data, state.reservations);
        await reload();
        closeSheet();
        if (opts.onSaved) { opts.onSaved(saved); toast("반영했어요."); render(); return; }
        state.selected = saved.reservation_date; state.cursor = saved.reservation_date;
        toast(isEdit ? "수정했어요." : "예약을 등록했어요.");
        render();
      } catch (err) {
        let msg = esc(err.message);
        if (err.conflict) {
          const c = err.conflict;
          msg += `<br>· ${esc(labelDate(c.reservation_date))} ${esc(c.start_time)}~${esc(c.end_time)} ${esc(venueName(c.venue_id))} ${esc(c.court_number)}번 코트${c.reserved_by ? " (" + esc(c.reserved_by) + ")" : ""} [${esc(c.status)}]`;
        }
        $("#formErr").innerHTML = `<div class="err">${msg}</div>`;
        $("#formErr").scrollIntoView({ behavior: "smooth" });
      } finally { btn.disabled = false; }
    };
  }

  function summarize(x) {
    if (!x) return "";
    return `${x.reservation_date} ${String(x.start_time).slice(0, 5)}~${String(x.end_time).slice(0, 5)} · ${venueName(x.venue_id)} ${x.court_number}번 · ${x.reserved_by || "예약자 없음"} · ${x.status}`;
  }

  async function openDetail(id) {
    const r = state.reservations.find((x) => x.id === id);
    if (!r) return;
    let hist = [];
    try { hist = await store.history(id); } catch (e) { /* 이력 불러오기 실패해도 상세는 표시 */ }
    openSheet(`
      <h2>예약 상세<button class="close" data-close>×</button></h2>
      <div class="card ${sClass(r.status)}">
        <dl class="kv">
          <dt>상태</dt><dd><span class="chip">${esc(r.status)}</span></dd>
          <dt>날짜</dt><dd>${esc(labelLong(r.reservation_date))}</dd>
          <dt>시간</dt><dd>${esc(r.start_time)} ~ ${esc(r.end_time)}</dd>
          <dt>장소</dt><dd>${esc(venueName(r.venue_id))}</dd>
          <dt>코트</dt><dd>${esc(r.court_number)}번</dd>
          <dt>예약자</dt><dd>${esc(r.reserved_by || "-")}</dd>
          <dt>비고</dt><dd>${esc(r.memo || "-")}</dd>
        </dl>
        ${r.source_message ? `<div class="section-title" style="margin-top:12px"><span>카톡 원본 (AI 분석${r.confidence != null ? ", 신뢰도 " + Math.round(r.confidence * 100) + "%" : ""})</span></div><div class="quote">${esc(r.source_message)}</div>` : ""}
      </div>
      <div class="btns">
        ${r.status !== "취소" ? (myAttFor(r.id)
          ? `<button class="btn att-on" data-attres="${esc(r.id)}">🙋 참석 중 · 누르면 참석 취소</button>`
          : `<button class="btn att" data-attres="${esc(r.id)}">🙋 이 예약에 참석</button>`) : ""}
        <button class="btn primary" data-edit="${esc(r.id)}">수정</button>
        ${r.status === "취소"
          ? `<button class="btn ghost" data-restore="${esc(r.id)}">취소 되돌리기 (확정으로)</button>`
          : `<button class="btn danger" data-cancel="${esc(r.id)}">예약 취소</button>`}
      </div>
      <div class="section-title"><span>변경 이력</span></div>
      <div class="card">${hist.length ? hist.map((h) => `
        <div class="hist"><b>${esc(h.change_reason)}</b> <span class="when">${esc(kstDateTime(h.changed_at))}</span>
          ${h.previous_data ? `<div>전: ${esc(summarize(h.previous_data))}</div>` : ""}
          <div>${h.previous_data ? "후: " : ""}${esc(summarize(h.updated_data))}</div></div>`).join("") : `<div class="note">이력이 없어요.</div>`}
      </div>`);
  }

  async function setStatus(id, status, msg) {
    const r = state.reservations.find((x) => x.id === id);
    try {
      await store.saveReservation(Object.assign({}, r, { status }), state.reservations);
      await reload(); toast(msg); render(); openDetail(id);
    } catch (err) { toast(err.message); }
  }

  // 참석 추가: 그날 예약 중에서 고르거나, 예약 없이 직접 입력
  function openAttForm(date) {
    const dayRes = onDate(date).filter((r) => r.status !== "취소" && !myAttFor(r.id));
    openSheet(`
      <h2>🙋 참석 추가<button class="close" data-close>×</button></h2>
      <form id="attForm" novalidate>
        <div id="attErr"></div>
        <div class="field"><label>날짜</label><input type="date" name="attend_date" value="${esc(date)}" required></div>
        <div class="field"><label>어느 예약에 참석하나요?</label>
          <select name="reservation_id">
            <option value="">예약 없이 직접 입력</option>
            ${dayRes.map((r) => `<option value="${esc(r.id)}">${esc(r.start_time)}~${esc(r.end_time)} ${esc(venueName(r.venue_id))} ${esc(r.court_number)}번${r.reserved_by ? " (" + esc(r.reserved_by) + ")" : ""}</option>`).join("")}
          </select></div>
        <div id="attManual">
          <div class="row2">
            <div class="field"><label>시작 시간 (선택)</label><input type="time" name="start_time" step="600" value="20:00"></div>
            <div class="field"><label>종료 시간 (선택)</label><input type="time" name="end_time" step="600" value="22:00"></div>
          </div>
          <div class="row2">
            <div class="field"><label>장소 (선택)</label><select name="venue_id"><option value="">미정</option>${state.venues.map((v) => `<option value="${esc(v.id)}">${esc(v.venue_name)}</option>`).join("")}</select></div>
            <div class="field"><label>코트 (선택)</label><input name="court_number" placeholder="예: 2"></div>
          </div>
        </div>
        <div class="field"><label>메모 (선택)</label><input name="memo" placeholder="예: 게스트 1명"></div>
        <div class="btns"><button class="btn att" type="submit">참석으로 저장</button></div>
      </form>`);
    const f = $("#attForm");
    const sync = () => { $("#attManual").style.display = f.reservation_id.value ? "none" : ""; };
    f.reservation_id.onchange = sync; sync();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(f).entries());
      if (data.reservation_id) { data.start_time = data.end_time = data.venue_id = data.court_number = ""; }
      data.member_name = me();
      try {
        await store.addAttendance(data);
        await reload(); closeSheet(); state.selected = data.attend_date; state.cursor = data.attend_date; toast("참석으로 표시했어요."); render();
      } catch (err) { $("#attErr").innerHTML = `<div class="err">${esc(err.message)}</div>`; }
    };
  }
  async function toggleResAttend(resId) {
    const r = state.reservations.find((x) => x.id === resId); if (!r) return;
    const cur = myAttFor(resId);
    try {
      if (cur) { await store.removeAttendance(cur.id); toast("참석을 취소했어요."); }
      else { await store.addAttendance({ attend_date: r.reservation_date, reservation_id: r.id, member_name: me() }); toast("참석으로 표시했어요."); }
      await reload(); render(); openDetail(resId);
    } catch (err) { toast(err.message); }
  }
  async function removeAtt(id) {
    if (!confirm("이 참석 일정을 지울까요?")) return;
    try { await store.removeAttendance(id); await reload(); toast("참석을 취소했어요."); render(); } catch (err) { toast(err.message); }
  }

  function openVenueForm(id) {
    const v = state.venues.find((x) => x.id === id) || { venue_name: "", address: "", court_information: [] };
    openSheet(`
      <h2>${id ? "장소 수정" : "장소 추가"}<button class="close" data-close>×</button></h2>
      <form id="venueForm">
        <div id="vErr"></div>
        <div class="field"><label>장소 이름</label><input name="venue_name" value="${esc(v.venue_name)}" placeholder="예: 수목원 테니스장" required></div>
        <div class="field"><label>주소 (선택)</label><input name="address" value="${esc(v.address || "")}"></div>
        <div class="field"><label>코트 번호 (쉼표로 구분)</label><input name="courts" value="${esc((v.court_information || []).join(", "))}" placeholder="예: 1, 2, 3, 4"></div>
        <p class="note">코트 번호를 등록하면 예약할 때 목록에서 고를 수 있어요. 비워 두면 직접 입력해요.</p>
        <div class="btns"><button class="btn primary" type="submit">저장</button></div>
      </form>`);
    $("#venueForm").onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      const courts = f.courts.value.split(",").map((s) => s.trim()).filter(Boolean);
      try {
        await store.saveVenue({ id, venue_name: f.venue_name.value, address: f.address.value.trim(), court_information: courts });
        await reload(); closeSheet(); toast("저장했어요."); render();
      } catch (err) { $("#vErr").innerHTML = `<div class="err">${esc(err.message)}</div>`; }
    };
  }

  // ---------- 게시판 일정 → 내 참석 찾기 (AI 없이) ----------
  const board = { text: "", items: [], extra: [], done: false };
  const shortName = (v) => v.venue_name.replace(/\s*테니스장\s*$/, "").trim();
  function analyzeBoard() {
    const name = me();
    const entries = RaonKakao.parseBoard(board.text, todayKST());
    const dates = new Set(entries.map((e) => e.date));
    board.items = entries.filter((e) => e.peopleText.includes(name)).map((e) => {
      const hits = state.venues.filter((v) => shortName(v) && e.placeText.includes(shortName(v)));
      const venue = hits.length === 1 ? hits[0] : null; // 장소가 여러 개면 정하지 않음
      const matches = venue ? state.reservations.filter((r) => r.reservation_date === e.date && r.venue_id === venue.id && r.status !== "취소"
        && (!e.courts.length || e.courts.includes(String(r.court_number))) && !myAttFor(r.id)) : [];
      const already = myAtt(e.date).length > 0;
      return Object.assign({}, e, {
        venue_id: venue ? venue.id : "",
        matches, link: matches.length ? matches[0].id : "",
        others: e.people.filter((x) => !x.includes(name)),
        already, checked: !already,
      });
    });
    // 게시판에는 내 이름이 없는데 참석으로 표시된 날
    board.extra = state.attendance.filter((a) => a.member_name === name && dates.has(a.attend_date)
      && !entries.some((e) => e.date === a.attend_date && e.peopleText.includes(name)));
    board.done = true;
  }
  function boardCard() {
    const it = board.items;
    const rows = it.map((e, i) => {
      const where = [e.placeText || (e.noCourt ? "코트 없음" : "장소 미정"), e.courts.length ? e.courts.join(",") + "번" : ""].filter(Boolean).join(" ");
      const pick = e.matches.length
        ? `<select data-blink="${i}">${e.matches.map((r) => `<option value="${esc(r.id)}" ${r.id === e.link ? "selected" : ""}>${esc(r.start_time)}~${esc(r.end_time)} ${esc(venueName(r.venue_id))} ${esc(r.court_number)}번 (${esc(r.reserved_by || "-")})</option>`).join("")}<option value="" ${e.link ? "" : "selected"}>예약에 연결 안 함</option></select>`
        : `<div class="note">연결할 예약이 없어요. 날짜만 참석으로 넣어요.</div>`;
      return `<div class="prop s-확정" style="border-left-color:var(--att)">
        <div class="top"><label style="display:flex;gap:8px;align-items:center;font-weight:700">
          <input type="checkbox" data-bchk="${i}" ${e.checked ? "checked" : ""} ${e.already ? "disabled" : ""}> ${esc(labelDate(e.date))} · ${esc(where)}</label>
          ${e.already ? `<span class="conf">이미 참석 표시됨</span>` : ""}</div>
        ${e.others.length ? `<div class="reason">함께: ${esc(e.others.join(", "))}</div>` : ""}
        ${e.already ? "" : pick}
      </div>`;
    }).join("");
    const n = it.filter((e) => e.checked && !e.already).length;
    return `<div class="card">
      <p class="step">📋 게시판 일정으로 내 참석 찾기</p>
      <p class="note">카톡 게시판 '상세보기'의 일정 글을 길게 눌러 복사한 뒤 아래에 붙여 넣으세요. <b>${esc(me())}</b> 이름이 있는 날을 찾아 참석으로 넣어 드려요. (AI를 쓰지 않아 비용이 없어요)</p>
      <div class="field"><textarea id="boardText" rows="6" placeholder="🎾11/27(금) 송정/2&#10;유환준 김정화 권정석">${esc(board.text)}</textarea></div>
      <div class="btns"><button class="btn ghost" id="boardRun">내 참석 찾기</button></div>
      ${board.done ? `
        <div class="stat" style="margin-top:10px">내 이름이 있는 날 <b>${it.length}</b>개</div>
        ${rows}
        ${board.extra.length ? `<div class="warn">⚠ 게시판에는 이름이 없는데 참석으로 표시된 날: ${board.extra.map((a) => esc(labelDate(a.attend_date))).join(", ")} (달력에서 확인해 주세요)</div>` : ""}
        ${n ? `<div class="btns"><button class="btn att" id="boardSave">선택한 ${n}개 참석으로 저장</button></div>` : ""}` : ""}
    </div>`;
  }
  function bindBoard() {
    const ta = $("#boardText"); if (!ta) return;
    ta.oninput = () => { board.text = ta.value; };
    $("#boardRun").onclick = () => { board.text = ta.value; analyzeBoard(); renderImport(); };
    view.querySelectorAll("[data-bchk]").forEach((c) => c.onchange = () => { board.items[Number(c.dataset.bchk)].checked = c.checked; renderImport(); });
    view.querySelectorAll("[data-blink]").forEach((sel) => sel.onchange = () => { board.items[Number(sel.dataset.blink)].link = sel.value; });
    const sv = $("#boardSave"); if (sv) sv.onclick = saveBoard;
  }
  async function saveBoard() {
    const list = board.items.filter((e) => e.checked && !e.already);
    let ok = 0; const fails = [];
    for (const e of list) {
      const memo = [e.others.length ? "함께: " + e.others.join(", ") : "", !e.link && !e.venue_id && e.placeText ? "장소: " + e.placeText : "", "(게시판)"].filter(Boolean).join(" · ");
      const data = e.link
        ? { attend_date: e.date, reservation_id: e.link, member_name: me(), memo }
        : { attend_date: e.date, venue_id: e.venue_id, court_number: e.courts.join(","), member_name: me(), memo };
      try { await store.addAttendance(data); ok++; } catch (err) { fails.push(labelDate(e.date) + ": " + err.message); }
    }
    await reload();
    analyzeBoard(); renderImport();
    toast(fails.length ? `${ok}개 저장, ${fails.length}개 실패` : `${ok}개를 참석으로 표시했어요.`);
  }

  // ---------- AI 분석 (카카오톡 TXT) ----------
  const IMP_KEY = "raon_import_v1";
  const ACT_LABEL = { create: "새 예약", update: "변경", cancel: "취소", duplicate: "이미 등록됨" };
  const imp = { fileName: "", messages: [], fromDate: addDays(todayKST(), -14), proposals: [], busy: false, error: "", progress: "" };
  imp.resume = null; // 중간에 멈춘 분석을 이어서 하기 위한 정보 { file, run, lastId }
  // 등록 전에 이미 취소된 새 예약은 승인할 필요 없음
  const tidyProp = (p) => { if (p.state === "pending" && p.action === "create" && p.status === "취소") p.state = "dropped"; return p; };
  try { const saved = JSON.parse(localStorage.getItem(IMP_KEY)); if (saved && Array.isArray(saved.proposals)) { imp.proposals = saved.proposals.map(tidyProp); imp.fileName = saved.fileName || ""; imp.resume = saved.resume || null; } } catch (e) { /* 저장된 것 없음 */ }
  function saveImp() { try { localStorage.setItem(IMP_KEY, JSON.stringify({ fileName: imp.fileName, proposals: imp.proposals, resume: imp.resume })); } catch (e) { /* 저장 불가 */ } }
  const resumeInfo = () => (imp.resume && imp.resume.file === imp.fileName && imp.messages.length ? imp.resume : null);

  const candidates = () => imp.messages.filter((m) => m.sent_at.slice(0, 10) >= imp.fromDate && RaonKakao.isCandidate(m, state.venues.map((v) => v.venue_name)));
  const withWeekday = (s) => s ? `${s.slice(0, 10)}(${DOW[dow(s.slice(0, 10))]})${s.slice(10)}` : s;

  function propSummary(p) {
    const parts = [];
    parts.push(p.reservation_date ? labelDate(p.reservation_date) : "날짜 ?");
    parts.push(`${p.start_time || "?"}~${p.end_time || "?"}`);
    parts.push(p.venue_id ? venueName(p.venue_id) : "장소 ?");
    parts.push(p.court_number ? `${p.court_number}번 코트` : "코트 ?");
    parts.push(p.reserved_by || "예약자 ?");
    return parts.join(" · ");
  }
  // 승인 후 저장될 최종 값
  function propFinal(p) {
    const target = p.target_reservation_id ? state.reservations.find((x) => x.id === p.target_reservation_id) : null;
    const fields = {};
    ["reservation_date", "start_time", "end_time", "venue_id", "court_number", "reserved_by", "status"].forEach((k) => { if (p[k] !== null && p[k] !== undefined && p[k] !== "") fields[k] = p[k]; });
    if (p.action === "cancel") return target ? Object.assign({}, target, { status: "취소" }) : null;
    if (p.action === "update") return target ? Object.assign({}, target, fields, { id: target.id }) : null;
    return Object.assign({ reservation_date: null, start_time: null, end_time: null, venue_id: null, court_number: null, reserved_by: null, status: "확인 필요", memo: "" }, fields);
  }
  function propProblems(p) {
    const probs = [];
    const target = p.target_reservation_id ? state.reservations.find((x) => x.id === p.target_reservation_id) : null;
    if ((p.action === "update" || p.action === "cancel" || p.action === "duplicate") && !target) probs.push("연결할 기존 예약을 찾지 못했어요.");
    if (p.action === "duplicate") return probs;
    const f = propFinal(p);
    if (f && p.action !== "cancel") {
      const missing = [["reservation_date", "날짜"], ["start_time", "시작 시간"], ["end_time", "종료 시간"], ["venue_id", "장소"], ["court_number", "코트"]].filter(([k]) => !f[k]).map(([, n]) => n);
      if (missing.length) probs.push("빠진 정보: " + missing.join(", "));
      if (!f.reserved_by) probs.push("예약자가 불명확해요.");
      if (!missing.length) {
        const c = store.findConflict(state.reservations, f, f.id);
        if (c) probs.push(`겹치는 예약: ${labelDate(c.reservation_date)} ${c.start_time}~${c.end_time} ${venueName(c.venue_id)} ${c.court_number}번 (${c.reserved_by || "-"})`);
      }
    }
    if (p.status === "확인 필요") probs.push("AI가 '확인 필요'로 판단했어요.");
    if (typeof p.confidence === "number" && p.confidence < 0.7) probs.push("AI 신뢰도가 낮아요.");
    return probs;
  }

  function renderImport() {
    if (store.mode === "local") {
      view.innerHTML = boardCard() + `<div class="card"><p class="note"><b>체험 모드</b>에서는 AI 분석을 쓸 수 없어요. 서버(Supabase)에 연결된 앱에서 사용해 주세요.</p></div>`;
      bindBoard();
      return;
    }
    const cand = imp.messages.length ? candidates() : [];
    const pending = imp.proposals.filter((p) => p.state === "pending");
    view.innerHTML = inboxCard() + boardCard() + `
      <div class="card">
        <p class="step">1단계 · 카카오톡 대화 파일 고르기</p>
        <label class="filebtn">📄 ${imp.messages.length ? esc(imp.fileName) + " (다시 고르기)" : "대화 내보내기 TXT 파일 선택"}<input type="file" id="kakaoFile" accept=".txt,text/plain"></label>
        <p class="note">카카오톡 단체방 → 메뉴(≡) → 설정(⚙) → <b>대화 내보내기</b> → <b>텍스트만 보내기</b>로 만든 파일이에요.</p>
      </div>
      ${imp.messages.length ? `
      <div class="card">
        <p class="step">2단계 · 분석할 기간</p>
        <div class="field"><label>이 날짜 이후 메시지만</label><input type="date" id="fromDate" value="${esc(imp.fromDate)}"></div>
        <div class="stat">전체 메시지 <b>${imp.messages.length}</b>개 중 예약 관련으로 보이는 메시지 <b>${cand.length}</b>개</div>
        <p class="note">AI에는 예약 관련으로 보이는 메시지만 보내요. 잡담 같은 다른 대화는 보내지도, 저장하지도 않아요.</p>
        ${(() => { const rs = resumeInfo(); const left = rs ? cand.filter((m) => m.id > rs.lastId).length : cand.length;
          return `<div class="btns"><button class="btn primary" id="runAI" ${imp.busy || !left ? "disabled" : ""}>${imp.busy ? "AI가 분석하는 중… " + esc(imp.progress) : rs ? `▶ 멈춘 곳부터 이어서 분석하기 (남은 ${left}개)` : `🤖 AI로 분석하기 (${cand.length}개)`}</button>
          ${rs && !imp.busy ? `<button class="btn ghost" id="restartAI">처음부터 다시 분석</button>` : ""}</div>`; })()}
        ${imp.error ? `<div class="err" style="margin-top:10px">${esc(imp.error)}</div>` : ""}
      </div>` : ""}
      ${imp.proposals.length ? `
      <div class="section-title"><span>3단계 · AI 제안 확인 (남은 것 ${pending.length}개)</span>${pending.length ? "" : `<button class="smallbtn" id="clearProps">목록 비우기</button>`}</div>
      <p class="note">아래 제안은 아직 예약에 반영되지 않았어요. 하나씩 확인하고 <b>승인</b>해야 캘린더에 들어가요.</p>
      ${(() => { const n = sureProps().length, o = oldProps().length; if (imp.busy || (!n && !o)) return "";
        return `<div class="card">
        ${o ? `<p class="note">이번 달(${Number(monthStart().slice(5, 7))}월) 이전 날짜의 지난 예약 제안 ${o}개는 등록할 필요가 없으면 한 번에 정리할 수 있어요.</p>
        <div class="btns"><button class="btn ghost" id="dropOld">🗂 지난 예약 제안 ${o}개 모두 무시</button></div>` : ""}
        ${n ? `<p class="note" style="margin-top:10px">이번 달 이후 예약 중 신뢰도 ${Math.round(SURE_CONF * 100)}% 이상이고 경고가 하나도 없는 <b>확정</b> 제안 ${n}개는 한꺼번에 승인할 수 있어요. 나머지는 하나씩 확인해 주세요.</p>
        <div class="btns"><button class="btn primary" id="bulkApprove">✅ 확실한 확정 ${n}개 한꺼번에 승인</button></div>` : ""}
        </div>`; })()}
      ${imp.proposals.map(propCard).join("")}` : ""}
    `;
    bindBoard();
    const ir = $("#inboxRun"); if (ir) ir.onclick = () => analyzeInbox(false);
    const fi = $("#kakaoFile");
    if (fi) fi.onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const text = await file.text();
      const msgs = RaonKakao.parse(text);
      if (!msgs.length) { toast("카카오톡 대화 형식을 찾지 못했어요. 내보내기한 TXT 파일인지 확인해 주세요."); return; }
      imp.fileName = file.name; imp.messages = msgs; imp.error = "";
      const last = msgs[msgs.length - 1].sent_at.slice(0, 10);
      if (imp.fromDate > last) imp.fromDate = addDays(last, -14);
      renderImport();
    };
    const fd = $("#fromDate"); if (fd) fd.onchange = (e) => { imp.fromDate = e.target.value || imp.fromDate; renderImport(); };
    const run = $("#runAI"); if (run) run.onclick = runAnalysis;
    const rst = $("#restartAI"); if (rst) rst.onclick = () => { if (confirm("처음부터 다시 분석할까요? (비용이 다시 들어요)")) { imp.resume = null; saveImp(); renderImport(); } };
    const ba = $("#bulkApprove"); if (ba) ba.onclick = bulkApprove;
    const dro = $("#dropOld"); if (dro) dro.onclick = () => {
      const list = oldProps();
      if (!confirm(`이번 달 이전 날짜의 제안 ${list.length}개를 모두 '무시'로 정리할까요?`)) return;
      list.forEach((p) => { p.state = "rejected"; }); saveImp(); renderImport(); toast(`${list.length}개를 정리했어요.`);
    };
    const cp = $("#clearProps"); if (cp) cp.onclick = () => { imp.proposals = []; saveImp(); renderImport(); };
  }

  function propCard(p, i) {
    const f = propFinal(p);
    const target = p.target_reservation_id ? state.reservations.find((x) => x.id === p.target_reservation_id) : null;
    const probs = p.state === "pending" ? propProblems(p) : [];
    const st = p.action === "cancel" ? "취소" : (f && f.status) || p.status;
    const conf = typeof p.confidence === "number" ? `신뢰도 ${Math.round(p.confidence * 100)}%` : "";
    const quote = (p.msgs || []).map((m) => `<b>${esc(m.author)}</b> · ${esc(withWeekday(m.sent_at))}\n${esc(m.text)}`).join("\n\n");
    let body;
    if (p.action === "create") body = `<div class="line">${esc(propSummary(f))}</div>`;
    else body = `${target ? `<div class="before">기존: ${esc(summarize(target))}</div>` : ""}
      ${p.action === "duplicate" ? `<div class="line">이미 캘린더에 있는 예약이에요.</div>` : `<div class="line">→ ${p.action === "cancel" ? "취소로 변경" : esc(propSummary(f || p))}</div>`}`;
    let actions = "";
    if (p.state === "pending") {
      if (p.action === "duplicate") actions = `<div class="btns"><button class="btn ghost" data-pdone="${i}">확인했어요</button></div>`;
      else {
        const canApprove = f && !probs.some((x) => /빠진 정보|찾지 못|겹치는/.test(x));
        actions = `<div class="btns3">
          <button class="btn primary" data-papprove="${i}" ${canApprove ? "" : "disabled"}>승인</button>
          <button class="btn ghost" data-pedit="${i}">고쳐서 승인</button>
          <button class="btn ghost" data-preject="${i}">무시</button></div>`;
      }
    } else actions = `<div class="donelabel">${p.state === "applied" ? "✅ 반영됨" : p.state === "rejected" ? "무시함" : p.state === "dropped" ? "등록 안 함 · 뒤 메시지에서 취소됐어요" : "확인함"}</div>`;
    return `<div class="prop ${sClass(st)} ${p.state !== "pending" ? "done" : ""}">
      <div class="top"><span class="act ${p.action}">${ACT_LABEL[p.action] || p.action}</span><span class="chip">${esc(st)}</span><span class="conf">${conf}</span></div>
      ${body}
      ${quote ? `<div class="quote">${quote}</div>` : ""}
      ${probs.map((x) => `<div class="warn">⚠ ${esc(x)}</div>`).join("")}
      ${p.reason ? `<div class="reason">AI 판단: ${esc(p.reason)}</div>` : ""}
      ${actions}
    </div>`;
  }

  const PFIELDS = ["reservation_date", "start_time", "end_time", "venue_id", "court_number", "reserved_by", "status"];
  // 뒤 묶음의 변경·취소·재언급(it)을 앞 묶음에서 찾은 제안(p)에 합친다
  function mergeInto(p, it, msgs) {
    p.message_ids = (p.message_ids || []).concat(it.message_ids || []);
    p.msgs = (p.msgs || []).concat(msgs).sort((a, b) => (a.sent_at < b.sent_at ? -1 : 1));
    if (it.reason) p.reason = [p.reason, it.reason].filter(Boolean).join(" / ");
    if (it.action === "duplicate") return;
    if (typeof it.confidence === "number") p.confidence = Math.min(typeof p.confidence === "number" ? p.confidence : 1, it.confidence);
    if (it.action === "cancel") {
      p.status = "취소";
      if (p.action === "create") p.state = "dropped"; // 등록 전에 취소된 예약은 등록하지 않음
      else p.action = "cancel";
    } else { // update
      PFIELDS.forEach((k) => { if (it[k] !== null && it[k] !== undefined && it[k] !== "") p[k] = it[k]; });
      if (p.state === "dropped") p.state = "pending";
      if (p.action === "cancel") p.action = "update";
    }
  }

  const rImp = () => { if (state.tab === "import") renderImport(); };
  async function runAnalysis() {
    const rs = resumeInfo();
    const cand = rs ? candidates().filter((m) => m.id > rs.lastId) : candidates();
    if (!cand.length || imp.busy) return;
    const runId = rs ? rs.run : Date.now();
    imp.busy = true; imp.error = ""; imp.progress = ""; rImp();
    let importId = null;
    try { importId = await store.createImport(imp.fileName); } catch (e) { /* 기록 실패해도 분석은 진행 */ }
    const venues = state.venues.map((v) => ({ id: v.id, name: v.venue_name, courts: v.court_information || [] }));
    const base = state.reservations
      .filter((r) => r.status !== "취소" && r.reservation_date >= addDays(imp.fromDate, -7))
      .map((r) => ({ id: r.id, date: r.reservation_date, start: r.start_time, end: r.end_time, venue_id: r.venue_id, court: r.court_number, reserved_by: r.reserved_by, status: r.status }));
    const today = todayKST();
    const BATCH = 50;
    // 이어서 할 때는 지난번에 찾은 제안부터 이어 붙인다 (묶음 사이 연결 유지)
    const found = rs ? imp.proposals.filter((p) => p.run === runId) : [];
    const others = imp.proposals.filter((p) => !found.includes(p) && p.state === "pending");
    const publish = () => { imp.proposals = found.concat(others); saveImp(); };
    // 서버 예약 + 앞 묶음에서 찾은 제안을 반영한 '지금까지 알려진 예약' 목록
    const knownExisting = () => {
      const list = base.map((r) => Object.assign({}, r));
      found.forEach((p, k) => {
        if (p.state !== "pending") return;
        if (p.action === "create") {
          list.push({ id: "new-" + k, date: p.reservation_date, start: p.start_time, end: p.end_time, venue_id: p.venue_id, court: p.court_number, reserved_by: p.reserved_by, status: p.status, note: "같은 대화에서 앞서 찾은 예약(아직 등록 전)" });
          return;
        }
        const i = list.findIndex((r) => r.id === p.target_reservation_id);
        if (i < 0) return;
        if (p.action === "cancel") list.splice(i, 1);
        else if (p.action === "update") {
          const r = list[i];
          [["reservation_date", "date"], ["start_time", "start"], ["end_time", "end"], ["venue_id", "venue_id"], ["court_number", "court"], ["reserved_by", "reserved_by"], ["status", "status"]]
            .forEach(([a, b]) => { if (p[a]) r[b] = p[a]; });
        }
      });
      return list;
    };
    const queue = [];
    for (let i = 0; i < cand.length; i += BATCH) queue.push(cand.slice(i, i + BATCH));
    let done = 0, waits = 0;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
      while (queue.length) {
        const chunk = queue.shift();
        imp.progress = `(${done}/${cand.length})`;
        rImp();
        let res;
        try {
          res = await store.analyze({
            today: `${today}(${DOW[dow(today)]})`,
            venues, existing: knownExisting(),
            messages: chunk.map((m) => ({ id: m.id, sent_at: withWeekday(m.sent_at), author: m.author, text: m.text })),
          });
        } catch (e) {
          // AI 서버가 바쁨/요청 많음: 기다렸다가 같은 묶음 다시
          if ((e.status === 429 || e.status === 503) && waits < 6) {
            waits++; queue.unshift(chunk);
            imp.progress = `(${done}/${cand.length}) 잠시 기다리는 중…`; rImp();
            await sleep(30000); continue;
          }
          // 시간 초과·응답 너무 김 등: 묶음을 반으로 나눠 다시 시도
          if (e.status !== 401 && e.status !== 500 && e.status !== 429 && e.status !== 503 && chunk.length > 10) {
            const h = Math.ceil(chunk.length / 2);
            queue.unshift(chunk.slice(0, h), chunk.slice(h));
            continue;
          }
          throw e;
        }
        done += chunk.length; waits = 0;
        (res.items || []).forEach((it) => {
          const msgs = (it.message_ids || []).map((id) => imp.messages[id]).filter(Boolean)
            .map((m) => ({ author: m.author, sent_at: m.sent_at, text: m.text }));
          if (it.venue_id && !state.venues.some((v) => v.id === it.venue_id)) it.venue_id = null;
          const tid = it.target_reservation_id;
          let host = null;
          if (it.action !== "create" && tid) {
            if (/^new-\d+$/.test(tid)) host = found[Number(tid.slice(4))] || null;
            else host = found.find((p) => p.state === "pending" && p.action !== "duplicate" && p.target_reservation_id === tid) || null;
          }
          if (host) return mergeInto(host, it, msgs);
          if (tid && /^new-/.test(tid)) it.target_reservation_id = null;
          found.push(tidyProp(Object.assign({}, it, { msgs, state: "pending", run: runId })));
        });
        imp.resume = { file: imp.fileName, run: runId, lastId: chunk[chunk.length - 1].id };
        publish(); // 묶음마다 저장 → 중간에 멈춰도 이어서 가능
      }
      imp.resume = null;
      publish();
      const n = found.filter((p) => p.state === "pending").length;
      await store.updateImport(importId, `완료: 제안 ${n}개`);
      toast(n ? `AI 제안 ${n}개를 찾았어요.` : "예약 관련 내용을 찾지 못했어요.");
    } catch (e) {
      imp.error = e.message + (found.length ? ` (그 전까지 찾은 제안은 아래에 있어요. 잠시 뒤 '이어서 분석하기'를 누르면 멈춘 곳부터 계속해요.)` : "");
      await store.updateImport(importId, "오류: " + e.message);
      publish();
    } finally {
      imp.busy = false; imp.progress = ""; rImp();
    }
  }

  function sourceText(p) {
    return (p.msgs || []).map((m) => `[${m.sent_at}] ${m.author}: ${m.text}`).join("\n");
  }
  // 한꺼번에 승인 대상: 새 예약/변경, 최종 상태 '확정', 신뢰도 높음, 경고 없음
  const SURE_CONF = 0.8;
  const monthStart = () => todayKST().slice(0, 8) + "01"; // 이번 달 1일
  const propDate = (p) => { const f = propFinal(p); return (f && f.reservation_date) || p.reservation_date || ""; };
  // 이번 달보다 앞선 날짜의 제안(지난 예약) — 등록할 필요 없음
  const oldProps = () => imp.proposals.filter((p) => p.state === "pending" && propDate(p) && propDate(p) < monthStart());
  function sureProps() {
    return imp.proposals.filter((p) => {
      if (p.state !== "pending" || (p.action !== "create" && p.action !== "update")) return false;
      if (propDate(p) < monthStart()) return false;
      if (typeof p.confidence !== "number" || p.confidence < SURE_CONF) return false;
      const f = propFinal(p);
      return f && f.status === "확정" && propProblems(p).length === 0;
    });
  }
  async function bulkApprove() {
    const list = sureProps();
    if (!list.length) return;
    const months = {};
    list.forEach((p) => { const m = (propFinal(p).reservation_date || "").slice(5, 7); months[m] = (months[m] || 0) + 1; });
    const mtxt = Object.keys(months).sort().map((m) => `${Number(m)}월 ${months[m]}개`).join(", ");
    if (!confirm(`확실한 확정 제안 ${list.length}개(${mtxt})를 캘린더에 등록할까요?
(등록 후에도 예약마다 수정·취소할 수 있어요.)`)) return;
    imp.busy = true; renderImport();
    const current = state.reservations.slice();
    let ok = 0; const fails = [];
    for (const p of list) {
      try {
        const saved = await store.saveReservation(Object.assign({}, propFinal(p), { source_message: sourceText(p), confidence: p.confidence }), current);
        if (saved) { const i = current.findIndex((x) => x.id === saved.id); if (i >= 0) current[i] = saved; else current.push(saved); }
        p.state = "applied"; ok++;
      } catch (e) { fails.push(e.message); }
    }
    saveImp(); imp.busy = false;
    await reload(); render();
    toast(fails.length ? `${ok}개 등록, ${fails.length}개는 겹치는 예약 등으로 못 했어요(아래에 남아 있어요).` : `${ok}개를 캘린더에 등록했어요.`);
  }
  async function approveProp(i) {
    const p = imp.proposals[i];
    const f = propFinal(p);
    try {
      await store.saveReservation(Object.assign({}, f, { source_message: sourceText(p), confidence: p.confidence }), state.reservations);
      p.state = "applied"; saveImp(); await reload(); toast("반영했어요."); render();
    } catch (e) { toast(e.message); }
  }
  function editProp(i) {
    const p = imp.proposals[i];
    let r = propFinal(p);
    if (!r) { // 기존 예약을 못 찾으면 새 예약으로 등록
      r = {};
      ["reservation_date", "start_time", "end_time", "venue_id", "court_number", "reserved_by", "status"].forEach((k) => { r[k] = p[k]; });
    }
    openForm(r, {
      title: "AI 제안 고쳐서 승인",
      extra: { source_message: sourceText(p), confidence: p.confidence },
      onSaved: () => { p.state = "applied"; saveImp(); },
    });
  }

  // ---------- 클릭 처리 ----------
  document.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    const ds = t.dataset;
    if (ds.close !== undefined) return closeSheet();
    if (ds.tab) { state.tab = ds.tab; return render(); }
    if (ds.date) {
      state.selected = ds.date;
      if (ds.date.slice(0, 7) !== state.cursor.slice(0, 7)) state.cursor = ds.date;
      return render();
    }
    if (ds.nav) {
      const n = Number(ds.nav);
      if (state.calMode === "month") {
        const c = parse(state.cursor); state.cursor = fmt(new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + n, 1)));
      } else state.cursor = addDays(state.cursor, 7 * n);
      return render();
    }
    if (ds.mode) { state.calMode = ds.mode; state.cursor = state.selected; return render(); }
    if (ds.today !== undefined) { state.cursor = state.selected = todayKST(); return render(); }
    if (ds.attadd) return openAttForm(ds.attadd);
    if (ds.attdel) return removeAtt(ds.attdel);
    if (ds.attres) return toggleResAttend(ds.attres);
    if (ds.res) return openDetail(ds.res);
    if (ds.edit) return openForm(state.reservations.find((x) => x.id === ds.edit));
    if (ds.cancel) { if (confirm("이 예약을 취소할까요?\n(삭제되지 않고 '취소' 상태로 기록이 남아요.)")) setStatus(ds.cancel, "취소", "예약을 취소했어요."); return; }
    if (ds.restore) return setStatus(ds.restore, "확정", "취소를 되돌렸어요.");
    if (ds.venue !== undefined) return openVenueForm(ds.venue || null);
    if (ds.papprove) return approveProp(Number(ds.papprove));
    if (ds.pedit) return editProp(Number(ds.pedit));
    if (ds.preject) { imp.proposals[Number(ds.preject)].state = "rejected"; saveImp(); return renderImport(); }
    if (ds.pdone) { imp.proposals[Number(ds.pdone)].state = "seen"; saveImp(); return renderImport(); }
  });
  $("#fab").onclick = () => openForm(null);

  function render() {
    document.querySelectorAll(".bottomnav button, .topicon").forEach((b) => b.classList.toggle("active", b.dataset.tab === state.tab));
    const ib = document.querySelector('.bottomnav [data-tab="import"]');
    if (ib) { const n = imp.proposals.filter((p) => p.state === "pending").length; ib.dataset.count = n ? String(n) : ""; }
    $("#fab").classList.toggle("hidden", state.tab === "settings" || state.tab === "import" || state.tab === "lineup");
    if (state.tab === "lineup") return window.RaonLineup.render(view, { toast, store });
    if (state.tab === "calendar") renderCalendar();
    else if (state.tab === "list") renderList();
    else if (state.tab === "import") renderImport();
    else renderSettings();
  }

  // ---------- 로그인 ----------
  function renderLogin() {
    document.querySelector(".bottomnav").style.display = "none";
    $("#fab").classList.add("hidden");
    view.innerHTML = `
      <div class="card login">
        <h2>관리자 로그인</h2>
        <form id="loginForm">
          <div id="lErr"></div>
          <div class="field"><label>이메일</label><input type="email" name="email" autocomplete="username" required></div>
          <div class="field"><label>비밀번호</label><input type="password" name="password" autocomplete="current-password" required></div>
          <div class="btns"><button class="btn primary" type="submit">로그인</button></div>
        </form>
      </div>`;
    $("#loginForm").onsubmit = async (e) => {
      e.preventDefault();
      const err = await store.login(e.target.email.value.trim(), e.target.password.value);
      if (err) { $("#lErr").innerHTML = `<div class="err">${esc(err)}</div>`; return; }
      location.reload();
    };
  }

  // ---------- 시작 ----------
  (async function start() {
    $("#modeBadge").textContent = store.mode === "local" ? "체험 모드" : "서버 연결됨";
    const { needsLogin } = await store.init();
    if (needsLogin) return renderLogin();
    await reload();
    render();
    if (store.mode !== "local") {
      const check = async () => {
        if (Date.now() - inboxCheckedAt < 60000) return;
        try { const s2 = await store.inboxStats(); state.inboxNew = s2.newCount; checkInboxAlive(s2.last); } catch (e) { return; }
        if (state.inboxNew && autoInbox()) analyzeInbox(true);
        else if (state.tab === "import") renderImport();
      };
      check();
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
    }
  })();

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    // 새 버전이 올라오면 자동으로 한 번 새로고침
    const hadCtl = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadCtl && !reloaded) { reloaded = true; location.reload(); } });
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((reg) => reg.update()).catch(() => {});
  }
})();
