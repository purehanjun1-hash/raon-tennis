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
    listFilter: { status: "전체", scope: "upcoming" },
  };
  const venueName = (id) => (state.venues.find((v) => v.id === id) || {}).venue_name || "(삭제된 장소)";
  const byTime = (a, b) => (a.reservation_date + a.start_time).localeCompare(b.reservation_date + b.start_time);
  const onDate = (d) => state.reservations.filter((r) => r.reservation_date === d).sort(byTime);

  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.remove("hidden");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add("hidden"), 2200);
  }

  async function reload() {
    try {
      [state.venues, state.reservations] = await Promise.all([store.listVenues(), store.listReservations()]);
    } catch (e) { toast(e.message); }
  }

  // ---------- 예약 카드 ----------
  function resCard(r, showDate) {
    const when = (showDate ? labelDate(r.reservation_date) + " · " : "") + `${r.start_time}~${r.end_time}`;
    return `<button class="res ${sClass(r.status)} ${r.status === "취소" ? "cancelled" : ""}" data-res="${esc(r.id)}">
      <span class="bar"></span>
      <span class="main">
        <div class="t">${esc(when)}</div>
        <div class="sub">${esc(venueName(r.venue_id))} · ${esc(r.court_number)}번 코트${r.reserved_by ? " · " + esc(r.reserved_by) : ""}</div>
        ${r.memo ? `<div class="sub">📝 ${esc(r.memo)}</div>` : ""}
      </span>
      <span><span class="chip">${esc(r.status)}</span></span>
    </button>`;
  }
  const legend = () => `<div class="legend">${STATUSES.map((s) => `<span class="${sClass(s)}"><i class="dot"></i>${s}</span>`).join("")}</div>`;

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
        const dots = list.slice(0, 4).map((r) => `<i class="dot ${sClass(r.status)}"></i>`).join("");
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
          ${list.length ? list.map((r) => resCard(r)).join("") : `<div class="empty">예약 없음</div>`}</div>`;
      }
    }

    const sel = onDate(state.selected);
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
      <div class="section-title"><span>계정 · 데이터</span></div>
      <div class="card">
        ${store.mode === "local"
          ? `<p class="note"><b>체험 모드</b>입니다. 예약은 <b>이 기기 브라우저에만</b> 저장돼요. 인터넷 서버(Supabase)를 연결하면 폰·PC 어디서나 같은 예약이 보입니다.</p>`
          : `<p class="note">로그인: <b>${esc(u && u.email)}</b><br>예약은 인터넷 서버(Supabase)에 저장됩니다.</p>
             <div class="btns"><button class="btn ghost" id="logout">로그아웃</button></div>`}
        <p class="note">모든 날짜·시간은 한국 시간(KST) 기준입니다.</p>
      </div>
    `;
    const lo = $("#logout"); if (lo) lo.onclick = async () => { await store.logout(); location.reload(); };
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

  function openForm(r) {
    const isEdit = !!(r && r.id);
    const d = Object.assign({ reservation_date: state.selected, start_time: "10:00", end_time: "12:00", venue_id: (state.venues[0] || {}).id, court_number: "", reserved_by: "", status: "확정", memo: "" }, r || {});
    openSheet(`
      <h2>${isEdit ? "예약 수정" : "예약 추가"}<button class="close" data-close>×</button></h2>
      <form id="resForm" novalidate>
        <div id="formErr"></div>
        <div class="field"><label>날짜</label><input type="date" name="reservation_date" value="${esc(d.reservation_date)}" required></div>
        <div class="row2">
          <div class="field"><label>시작 시간</label><input type="time" name="start_time" step="600" value="${esc(d.start_time)}" required></div>
          <div class="field"><label>종료 시간</label><input type="time" name="end_time" step="600" value="${esc(d.end_time)}" required></div>
        </div>
        <div class="row2">
          <div class="field"><label>장소</label><select name="venue_id" required>${state.venues.map((v) => `<option value="${esc(v.id)}" ${v.id === d.venue_id ? "selected" : ""}>${esc(v.venue_name)}</option>`).join("")}</select></div>
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
      const data = Object.fromEntries(new FormData(form).entries());
      if (isEdit) data.id = d.id;
      const btn = form.querySelector("[type=submit]"); btn.disabled = true;
      try {
        const saved = await store.saveReservation(data, state.reservations);
        await reload();
        closeSheet();
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
      </div>
      <div class="btns">
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
    if (ds.res) return openDetail(ds.res);
    if (ds.edit) return openForm(state.reservations.find((x) => x.id === ds.edit));
    if (ds.cancel) { if (confirm("이 예약을 취소할까요?\n(삭제되지 않고 '취소' 상태로 기록이 남아요.)")) setStatus(ds.cancel, "취소", "예약을 취소했어요."); return; }
    if (ds.restore) return setStatus(ds.restore, "확정", "취소를 되돌렸어요.");
    if (ds.venue !== undefined) return openVenueForm(ds.venue || null);
  });
  $("#fab").onclick = () => openForm(null);

  function render() {
    document.querySelectorAll(".bottomnav button").forEach((b) => b.classList.toggle("active", b.dataset.tab === state.tab));
    $("#fab").classList.toggle("hidden", state.tab === "settings");
    if (state.tab === "calendar") renderCalendar();
    else if (state.tab === "list") renderList();
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
  })();

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
