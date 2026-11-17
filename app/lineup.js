// 조편성: 참가자·코트·게임 수·우선 경기 방식에 맞춰 복식 대진을 짜 줌 (AI 없이, 휴대폰 안에서만 계산)
(function () {
  const KEY = "raon_lineup_v1";
  const MEMBERS = [
    ["류경진", "남"], ["유환준", "남"], ["권정석", "남"], ["송지수", "여"], ["김경채", "여"],
    ["김정화", "여"], ["최은미", "여"], ["최경훈", "남"], ["최명화", "여"],
  ];
  const TYPES = ["혼복", "남복", "여복"];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const toMin = (t) => { const [h, m] = String(t || "0:0").split(":").map(Number); return h * 60 + (m || 0); };
  const toTime = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
  const todayKST = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

  function defaults() {
    return {
      date: todayKST(), courts: 2, games: 4, start: "18:30", len: 30, gap: 10,
      prio: ["혼복", "남복", "여복"],
      people: MEMBERS.map(([name, g]) => ({ id: name, name, g, guest: false, on: false, from: 1, to: 0 }))
        .concat([1, 2, 3, 4].map((i) => ({ id: "게스트" + i, name: "게스트" + i, g: "남", guest: true, on: false, from: 1, to: 0 }))),
      result: null,
    };
  }
  let st = load();
  function load() {
    const d = defaults();
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!s) return d;
      const byId = Object.fromEntries((s.people || []).map((p) => [p.id, p]));
      d.people = d.people.map((p) => Object.assign(p, byId[p.id] ? { on: !!byId[p.id].on, from: byId[p.id].from || 1, to: byId[p.id].to || 0, ...(p.guest ? { name: byId[p.id].name || p.name, g: byId[p.id].g || p.g } : {}) } : {}));
      ["courts", "games", "start", "len", "gap", "prio", "result"].forEach((k) => { if (s[k] != null) d[k] = s[k]; });
      d.date = todayKST(); // 날짜는 열 때마다 오늘로 (바꿀 수 있음)
      if (s.result && s.date) d.date = s.date;
      return d;
    } catch (e) { return d; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* 저장 불가 */ } }

  const gameTimes = () => Array.from({ length: st.games }, (_, i) => {
    const s = toMin(st.start) + i * (Number(st.len) + Number(st.gap));
    return `${toTime(s)}~${toTime(s + Number(st.len))}`;
  });

  // ---------- 대진 계산 ----------
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pkey = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
  const PERMS = (arr) => arr.length <= 1 ? [arr] : arr.flatMap((x, i) => PERMS(arr.filter((_, j) => j !== i)).map((r) => [x, ...r]));

  function splitTeams(four, type, hist) {
    // 4명을 2:2로 나누는 3가지 중, 같은 짝이 덜 반복되는 쪽
    const [a, b, c, d] = four;
    let opts = [[[a, b], [c, d]], [[a, c], [b, d]], [[a, d], [b, c]]];
    if (type === "혼복") opts = opts.filter(([t1, t2]) => t1[0].g !== t1[1].g && t2[0].g !== t2[1].g);
    let best = null, bs = Infinity;
    for (const o of shuffle(opts)) {
      const s = (hist.partner[pkey(o[0][0].id, o[0][1].id)] || 0) + (hist.partner[pkey(o[1][0].id, o[1][1].id)] || 0);
      if (s < bs) { bs = s; best = o; }
    }
    return best;
  }
  function partition(players, order) {
    let M = shuffle(players.filter((p) => p.g === "남")), F = shuffle(players.filter((p) => p.g === "여"));
    const courts = [];
    while (M.length + F.length >= 4) {
      let done = false;
      for (const t of order) {
        if (t === "혼복" && M.length >= 2 && F.length >= 2) { courts.push({ type: t, ps: [M.pop(), F.pop(), M.pop(), F.pop()] }); done = true; break; }
        if (t === "남복" && M.length >= 4) { courts.push({ type: t, ps: [M.pop(), M.pop(), M.pop(), M.pop()] }); done = true; break; }
        if (t === "여복" && F.length >= 4) { courts.push({ type: t, ps: [F.pop(), F.pop(), F.pop(), F.pop()] }); done = true; break; }
      }
      if (!done) { const rest = shuffle(M.concat(F)); courts.push({ type: "자유", ps: rest.slice(0, 4) }); const ids = new Set(rest.slice(0, 4)); M = M.filter((p) => !ids.has(p)); F = F.filter((p) => !ids.has(p)); }
    }
    return courts;
  }
  function build() {
    const prio = st.prio.filter((t) => TYPES.includes(t));
    const orders = PERMS(prio).sort((a, b) => prio.indexOf(a[0]) - prio.indexOf(b[0]));
    const people = st.people.filter((p) => p.on);
    const played = {}, restedLast = {};
    const hist = { partner: {}, opp: {} };
    people.forEach((p) => { played[p.id] = 0; restedLast[p.id] = false; });
    const times = gameTimes();
    const games = [];
    for (let g = 1; g <= st.games; g++) {
      const avail = people.filter((p) => g >= (Number(p.from) || 1) && (!Number(p.to) || g <= Number(p.to)));
      const nCourts = Math.min(Number(st.courts) || 1, Math.floor(avail.length / 4));
      if (!nCourts) { games.push({ no: g, time: times[g - 1], courts: [], rest: avail.map((p) => p.name), short: true }); continue; }
      let best = null, bs = Infinity;
      for (let tr = 0; tr < 300; tr++) {
        const pick = avail.map((p) => ({ p, k: played[p.id] * 10 - (restedLast[p.id] ? 6 : 0) + Math.random() * 9 }))
          .sort((a, b) => a.k - b.k).slice(0, nCourts * 4).map((x) => x.p);
        const pickSet = new Set(pick);
        let score = 0;
        pick.forEach((p) => { score += played[p.id] * 40; });
        avail.forEach((p) => { if (!pickSet.has(p) && restedLast[p.id]) score += 60; });
        for (const order of (tr % 3 === 0 ? orders : [orders[0]])) {
          const courts = partition(pick, order).map((c) => ({ type: c.type, teams: splitTeams(c.ps, c.type, hist) }));
          let s = score;
          courts.forEach((c) => {
            s += c.type === "자유" ? 80 : prio.indexOf(c.type) * 15;
            c.teams.forEach((t) => { s += (hist.partner[pkey(t[0].id, t[1].id)] || 0) * 25; });
            c.teams[0].forEach((x) => c.teams[1].forEach((y) => { s += (hist.opp[pkey(x.id, y.id)] || 0) * 4; }));
          });
          if (s < bs) { bs = s; best = { courts, pick: pickSet }; }
        }
      }
      best.courts.forEach((c) => {
        c.teams.forEach((t) => { const k = pkey(t[0].id, t[1].id); hist.partner[k] = (hist.partner[k] || 0) + 1; });
        c.teams[0].forEach((x) => c.teams[1].forEach((y) => { const k = pkey(x.id, y.id); hist.opp[k] = (hist.opp[k] || 0) + 1; }));
      });
      people.forEach((p) => { restedLast[p.id] = false; });
      avail.forEach((p) => { if (best.pick.has(p)) played[p.id]++; else restedLast[p.id] = true; });
      games.push({
        no: g, time: times[g - 1],
        courts: best.courts.map((c) => ({ type: c.type, teams: c.teams.map((t) => t.map((x) => x.name)) })),
        rest: avail.filter((p) => !best.pick.has(p)).map((p) => p.name),
      });
    }
    st.result = { games, count: people.map((p) => ({ name: p.name, n: played[p.id] })), at: Date.now() };
    save();
  }

  // ---------- 스코어 · 기록 ----------
  const scored = (c) => c.score && c.score[0] !== "" && c.score[1] !== "" && c.score[0] != null && c.score[1] != null;
  // rows: [{team_a, team_b, score_a, score_b}] → 사람별 경기·승·무·패·득실
  function tally(rows) {
    const t = {};
    const add = (name, my, op) => {
      const x = t[name] || (t[name] = { name, n: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 });
      x.n++; x.gf += my; x.ga += op;
      if (my > op) x.w++; else if (my < op) x.l++; else x.d++;
    };
    rows.forEach((r) => { r.team_a.forEach((n) => add(n, r.score_a, r.score_b)); r.team_b.forEach((n) => add(n, r.score_b, r.score_a)); });
    return Object.values(t).sort((a, b) => (b.w / b.n) - (a.w / a.n) || (b.gf - b.ga) - (a.gf - a.ga) || b.n - a.n);
  }
  function dayRows() {
    const out = [];
    (st.result ? st.result.games : []).forEach((g) => g.courts.forEach((c, i) => {
      if (scored(c)) out.push({ game_no: g.no, court_no: i + 1, match_type: c.type === "자유" ? "복식" : c.type, team_a: c.teams[0], team_b: c.teams[1], score_a: Number(c.score[0]), score_b: Number(c.score[1]) });
    }));
    return out;
  }
  const pct = (x) => x.n ? Math.round((x.w / x.n) * 100) + "%" : "-";
  const diff = (x) => { const d = x.gf - x.ga; return (d > 0 ? "+" : "") + d; };
  function tableHtml(list) {
    if (!list.length) return `<div class="note">아직 스코어가 없어요.</div>`;
    return `<table class="lu-tbl"><thead><tr><th>이름</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>승률</th><th>득실</th></tr></thead><tbody>
      ${list.map((x) => `<tr><td>${esc(x.name)}</td><td>${x.n}</td><td>${x.w}</td><td>${x.d}</td><td>${x.l}</td><td><b>${pct(x)}</b></td><td>${diff(x)}</td></tr>`).join("")}</tbody></table>`;
  }
  let hist = null; // 서버에 저장된 전체 기록 (한 번 불러오면 기억)

  function kakaoText() {
    const r = st.result; if (!r) return "";
    const d = st.date ? `${Number(st.date.slice(5, 7))}/${Number(st.date.slice(8, 10))} ` : "";
    const lines = [`🎾 ${d}라온 조편성`];
    r.games.forEach((g) => {
      lines.push("", `[${g.no}게임] ${g.time}`);
      if (g.short) lines.push(" 인원 부족 (4명 미만)");
      g.courts.forEach((c, i) => {
        const sc = scored(c) ? ` ${c.teams[0].join("·")} ${c.score[0]} : ${c.score[1]} ${c.teams[1].join("·")}` : ` ${c.teams[0].join("·")} vs ${c.teams[1].join("·")}`;
        lines.push(` ${i + 1}코트(${c.type === "자유" ? "복식" : c.type})${sc}`);
      });
      if (g.rest.length) lines.push(` 쉼: ${g.rest.join(", ")}`);
    });
    const day = tally(dayRows());
    if (day.length) {
      lines.push("", "📊 오늘 결과 (승-무-패 · 득실)");
      day.forEach((x) => lines.push(` ${x.name} ${x.w}-${x.d}-${x.l} (${diff(x)})`));
    }
    return lines.join("\n");
  }

  // ---------- 화면 ----------
  function render(view, ui) {
    const toast = (ui && ui.toast) || alert;
    const G = Number(st.games) || 1;
    const opt = (n, v, label) => `<option value="${n}" ${String(v) === String(n) ? "selected" : ""}>${label}</option>`;
    const on = st.people.filter((p) => p.on);
    const mCnt = on.filter((p) => p.g === "남").length, fCnt = on.length - mCnt;
    const row = (p, i) => `<div class="lu-p ${p.on ? "on" : ""}">
        <label class="lu-name"><input type="checkbox" data-lu-on="${i}" ${p.on ? "checked" : ""}>
          ${p.guest ? `<input class="lu-gname" data-lu-name="${i}" value="${esc(p.name)}" aria-label="게스트 이름">` : `<b>${esc(p.name)}</b>`}</label>
        ${p.guest ? `<select data-lu-g="${i}" aria-label="성별">${opt("남", p.g, "남")}${opt("여", p.g, "여")}</select>` : `<span class="lu-g ${p.g === "남" ? "m" : "f"}">${p.g}</span>`}
        <select data-lu-from="${i}" aria-label="몇 게임부터" ${p.on ? "" : "disabled"}>${Array.from({ length: G }, (_, k) => opt(k + 1, p.from, `${k + 1}게임부터`)).join("")}</select>
        <select data-lu-to="${i}" aria-label="몇 게임까지" ${p.on ? "" : "disabled"}>${opt(0, p.to, "끝까지")}${Array.from({ length: G }, (_, k) => opt(k + 1, p.to, `${k + 1}게임까지`)).join("")}</select>
      </div>`;
    const prioSel = (i) => `<select data-lu-prio="${i}">${TYPES.map((t) => opt(t, st.prio[i], t)).join("")}${i > 0 ? opt("", st.prio[i] || "", "사용 안 함") : ""}</select>`;
    const r = st.result;
    const res = r ? `
      <div class="section-title"><span>📋 조편성 결과${st.date ? " · " + esc(st.date) : ""}</span></div>
      ${r.games.map((g) => `<div class="card lu-game">
        <div class="lu-gh"><b>${g.no}게임</b><span>${esc(g.time)}</span></div>
        ${g.short ? `<div class="note">인원이 4명보다 적어 경기를 짤 수 없어요.</div>` : ""}
        ${g.courts.map((c, i) => {
          const ok = scored(c), a = ok ? Number(c.score[0]) : 0, b = ok ? Number(c.score[1]) : 0;
          const tag = (me, op) => ok ? (me > op ? `<em class="win">승</em>` : me < op ? `<em class="lose">패</em>` : `<em>무</em>`) : "";
          const sv = (k) => c.score && c.score[k] != null ? esc(c.score[k]) : "";
          return `<div class="lu-court"><span class="lu-ct t-${esc(c.type)}">${i + 1}코트 · ${c.type === "자유" ? "복식" : esc(c.type)}</span>
          <div class="lu-vs">
            <span class="${ok && a > b ? "w" : ""}">${c.teams[0].map(esc).join(" · ")} ${tag(a, b)}</span>
            <span class="lu-score"><input type="number" inputmode="numeric" min="0" max="99" data-lu-sc="${g.no}-${i}-0" value="${sv(0)}" aria-label="왼쪽 팀 점수"><b>:</b><input type="number" inputmode="numeric" min="0" max="99" data-lu-sc="${g.no}-${i}-1" value="${sv(1)}" aria-label="오른쪽 팀 점수"></span>
            <span class="${ok && b > a ? "w" : ""}">${tag(b, a)} ${c.teams[1].map(esc).join(" · ")}</span>
          </div></div>`;
        }).join("")}
        ${g.rest.length ? `<div class="lu-rest">쉼: ${g.rest.map(esc).join(", ")}</div>` : ""}
      </div>`).join("")}
      <div class="card"><p class="step">사람별 게임 수</p><div class="lu-count">${r.count.map((c) => `<span>${esc(c.name)} <b>${c.n}</b></span>`).join("")}</div></div>
      <div class="card"><p class="step">📊 오늘 결과 <span class="lu-sum">스코어 넣은 ${dayRows().length}경기</span></p>
        ${tableHtml(tally(dayRows()))}
        <div class="btns"><button class="btn att" id="luSave" ${dayRows().length ? "" : "disabled"}>${r.savedAt ? "✓ 저장됨 · 다시 저장" : "오늘 결과 기록에 저장"}</button></div>
        <p class="note">저장하면 누적 기록에 들어가요. 같은 날짜로 다시 저장하면 그날 기록을 새로 덮어써요.</p>
      </div>
      <div class="btns"><button class="btn ghost" id="luAgain">🔀 다시 짜기</button><button class="btn primary" id="luCopy">카톡용 복사</button></div>` : "";
    const histHtml = `<div class="section-title"><span>🏆 누적 기록</span><button class="smallbtn" id="luHist">${hist ? "새로고침" : "불러오기"}</button></div>
      <div class="card">${hist ? (hist.length ? `<p class="note" style="margin-top:0">${esc(hist[0].play_date)} ~ ${esc(hist[hist.length - 1].play_date)} · ${new Set(hist.map((m) => m.play_date)).size}일 · ${hist.length}경기</p>${tableHtml(tally(hist))}` : `<div class="note">저장된 기록이 아직 없어요.</div>`) : `<div class="note">'불러오기'를 누르면 지금까지 저장한 경기 기록을 사람별로 모아 보여 줘요.</div>`}</div>`;

    view.innerHTML = `
      <div class="card">
        <p class="step">🎾 조편성</p>
        <div class="row2">
          <div class="field"><label>날짜</label><input type="date" id="luDate" value="${esc(st.date)}"></div>
          <div class="field"><label>코트 수</label><select id="luCourts">${[1, 2, 3, 4, 5, 6].map((n) => opt(n, st.courts, n + "면")).join("")}</select></div>
        </div>
        <div class="row2">
          <div class="field"><label>총 게임 수</label><select id="luGames">${Array.from({ length: 10 }, (_, k) => opt(k + 1, st.games, `${k + 1}게임`)).join("")}</select></div>
          <div class="field"><label>첫 게임 시작</label><input type="time" id="luStart" step="300" value="${esc(st.start)}"></div>
        </div>
        <div class="row2">
          <div class="field"><label>한 게임 (분)</label><input type="number" id="luLen" min="5" max="120" step="5" value="${esc(st.len)}"></div>
          <div class="field"><label>쉬는 시간 (분)</label><input type="number" id="luGap" min="0" max="60" step="5" value="${esc(st.gap)}"></div>
        </div>
        <div class="lu-times">${gameTimes().map((t, i) => `<span>${i + 1}게임 ${t}</span>`).join("")}</div>
      </div>

      <div class="card">
        <p class="step">우선 경기 방식</p>
        <div class="row3">${[0, 1, 2].map((i) => `<div class="field"><label>${i + 1}순위</label>${prioSel(i)}</div>`).join("")}</div>
        <p class="note">1순위로 최대한 짜고, 남녀 수가 안 맞으면 다음 순위로 짜요. 어느 것도 안 되면 '복식'(섞어서)으로 짜요.</p>
      </div>

      <div class="card">
        <p class="step">참가자 <span class="lu-sum">${on.length}명 (남 ${mCnt} · 여 ${fCnt})</span></p>
        <div class="lu-quick"><button class="smallbtn" id="luAll">회원 전체 선택</button><button class="smallbtn" id="luNone">모두 해제</button></div>
        ${st.people.map(row).join("")}
        <p class="note">늦게 오는 사람은 '○게임부터', 일찍 가는 사람은 '○게임까지'로 정해 주세요. 게스트 이름은 눌러서 바꿀 수 있어요.</p>
        <div class="btns"><button class="btn primary" id="luRun" ${on.length < 4 ? "disabled" : ""}>${on.length < 4 ? "4명 이상 골라 주세요" : "조 짜기"}</button></div>
      </div>
      ${res}
      ${histHtml}`;

    const rerender = () => render(view, ui);
    const setNum = (id, k, min, max) => { const el = view.querySelector(id); el.onchange = () => { let v = Number(el.value); if (!(v >= min)) v = min; if (v > max) v = max; st[k] = v; save(); rerender(); }; };
    view.querySelector("#luDate").onchange = (e) => { st.date = e.target.value; save(); };
    setNum("#luCourts", "courts", 1, 6);
    view.querySelector("#luGames").onchange = (e) => {
      st.games = Number(e.target.value);
      st.people.forEach((p) => { if (p.from > st.games) p.from = 1; if (p.to > st.games) p.to = 0; });
      save(); rerender();
    };
    view.querySelector("#luStart").onchange = (e) => { if (e.target.value) { st.start = e.target.value; save(); rerender(); } };
    setNum("#luLen", "len", 5, 120);
    setNum("#luGap", "gap", 0, 60);
    view.querySelectorAll("[data-lu-prio]").forEach((el) => el.onchange = () => {
      const i = Number(el.dataset.luPrio), v = el.value;
      const p = st.prio.slice(); const j = p.indexOf(v);
      if (v && j >= 0 && j !== i) p[j] = p[i] || ""; // 같은 방식이 겹치면 자리 바꾸기
      p[i] = v;
      st.prio = p.filter((x, k) => x || k > 0); if (!st.prio[0]) st.prio[0] = "혼복";
      save(); rerender();
    });
    view.querySelectorAll("[data-lu-on]").forEach((el) => el.onchange = () => { st.people[Number(el.dataset.luOn)].on = el.checked; save(); rerender(); });
    view.querySelectorAll("[data-lu-name]").forEach((el) => el.onchange = () => { const v = el.value.trim(); st.people[Number(el.dataset.luName)].name = v || st.people[Number(el.dataset.luName)].id; save(); rerender(); });
    view.querySelectorAll("[data-lu-g]").forEach((el) => el.onchange = () => { st.people[Number(el.dataset.luG)].g = el.value; save(); rerender(); });
    view.querySelectorAll("[data-lu-from]").forEach((el) => el.onchange = () => { const p = st.people[Number(el.dataset.luFrom)]; p.from = Number(el.value); if (p.to && p.to < p.from) p.to = p.from; save(); rerender(); });
    view.querySelectorAll("[data-lu-to]").forEach((el) => el.onchange = () => { const p = st.people[Number(el.dataset.luTo)]; p.to = Number(el.value); if (p.to && p.to < p.from) p.from = p.to; save(); rerender(); });
    view.querySelector("#luAll").onclick = () => { st.people.forEach((p) => { if (!p.guest) p.on = true; }); save(); rerender(); };
    view.querySelector("#luNone").onclick = () => { st.people.forEach((p) => { p.on = false; }); save(); rerender(); };
    const store = ui && ui.store;
    view.querySelectorAll("[data-lu-sc]").forEach((el) => el.onchange = () => {
      const [g, i, k] = el.dataset.luSc.split("-").map(Number);
      const c = st.result.games[g - 1].courts[i];
      c.score = c.score || ["", ""];
      const v = el.value.trim();
      c.score[k] = v === "" ? "" : Math.max(0, Math.min(99, Math.round(Number(v)) || 0));
      st.result.savedAt = null;
      save();
      const y = window.scrollY; rerender(); window.scrollTo(0, y);
    });
    const svb = view.querySelector("#luSave");
    if (svb) svb.onclick = async () => {
      if (!st.date) return toast("날짜를 먼저 넣어 주세요.");
      try {
        svb.disabled = true;
        await store.saveDayMatches(st.date, dayRows());
        st.result.savedAt = Date.now(); save();
        hist = await store.listMatches();
        toast(`${st.date} 경기 ${dayRows().length}개를 저장했어요.`);
      } catch (e) { toast("저장 실패: " + e.message); }
      const y = window.scrollY; rerender(); window.scrollTo(0, y);
    };
    view.querySelector("#luHist").onclick = async () => {
      try { hist = await store.listMatches(); } catch (e) { return toast("불러오기 실패: " + e.message); }
      const y = window.scrollY; rerender(); window.scrollTo(0, y);
    };
    const run = () => {
      if (dayRows().length && !st.result.savedAt && !confirm("입력한 스코어가 아직 저장되지 않았어요. 새로 짜면 스코어가 지워져요. 계속할까요?")) return;
      const names = st.people.filter((p) => p.on).map((p) => p.name);
      if (new Set(names).size !== names.length) return toast("같은 이름이 두 번 있어요. 게스트 이름을 바꿔 주세요.");
      build(); rerender();
      const g = view.querySelector(".lu-game"); if (g) g.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    view.querySelector("#luRun").onclick = run;
    const ag = view.querySelector("#luAgain"); if (ag) ag.onclick = run;
    const cp = view.querySelector("#luCopy");
    if (cp) cp.onclick = async () => {
      const text = kakaoText();
      try { await navigator.clipboard.writeText(text); toast("복사했어요. 카톡에 붙여 넣으세요."); }
      catch (e) { window.prompt("아래 글을 길게 눌러 복사하세요.", text); }
    };
  }

  window.RaonLineup = { render, _build: build, _state: () => st, _text: kakaoText };
})();
