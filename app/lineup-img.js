// 조편성 결과를 카톡에 보내기 좋은 그림(PNG)으로 그려 줌 (휴대폰 안에서만, 서버 전송 없음)
(function () {
  const W = 1080, PAD = 48;
  const FONT = '"Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
  const C = {
    bg: "#eef4f0", card: "#ffffff", line: "#e3e8e5", text: "#1d2420", muted: "#7a847f",
    brand1: "#1f6f4a", brand2: "#34a86a", mem: "#1c5fc9", gst: "#3aa860",
    type: { 혼복: ["#efe7fb", "#6b3fc4"], 남복: ["#e6eefb", "#2f6fd6"], 여복: ["#fde8ee", "#c2395f"], 복식: ["#eef0ef", "#55605b"] },
  };
  const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  const font = (ctx, size, weight) => { ctx.font = `${weight || 400} ${size}px ${FONT}`; };
  function pill(ctx, x, y, text, bg, fg, size, align) {
    font(ctx, size, 700);
    const w = ctx.measureText(text).width + size * 1.1, h = size * 1.7;
    const left = align === "right" ? x - w : x;
    ctx.fillStyle = bg; rr(ctx, left, y, w, h, h / 2); ctx.fill();
    ctx.fillStyle = fg; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, left + w / 2, y + h / 2 + 1);
    return w;
  }
  // 글자가 너무 길면 줄여서 칸에 맞춤
  function fit(ctx, text, maxW, size, weight) {
    let s = size; font(ctx, s, weight);
    while (ctx.measureText(text).width > maxW && s > 18) { s -= 2; font(ctx, s, weight); }
    return s;
  }
  function dateLabel(d) {
    if (!d) return "";
    const t = new Date(d + "T00:00:00Z");
    return `${t.getUTCFullYear()}년 ${t.getUTCMonth() + 1}월 ${t.getUTCDate()}일 (${DAYS[t.getUTCDay()]})`;
  }

  // data: { date, courts, games:[{no,time,short,courts:[{type,teams,score}],rest}], isGuest(name), tally:[{name,w,d,l,gf,ga}] }
  function draw(data) {
    const games = data.games || [];
    const courtH = 176, gameHead = 104, restH = 64, gap = 28;
    let H = 300 + 80;
    games.forEach((g) => { H += gameHead + Math.max(1, g.courts.length) * courtH + (g.rest.length ? restH : 0) + 24 + gap; });
    const tally = data.tally || [];
    if (tally.length) H += 120 + tally.length * 58 + gap;
    H += 90;

    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);

    // 머리
    const grd = ctx.createLinearGradient(0, 0, W, 260);
    grd.addColorStop(0, C.brand1); grd.addColorStop(1, C.brand2);
    ctx.fillStyle = grd; rr(ctx, 0, -40, W, 300, 48); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.12)";
    ctx.beginPath(); ctx.arc(W - 90, 60, 150, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(W - 250, 250, 70, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    font(ctx, 30, 700); ctx.globalAlpha = .85; ctx.fillText("RAON TENNIS", PAD + 4, 86); ctx.globalAlpha = 1;
    font(ctx, 64, 800); ctx.fillText("🎾 오늘의 조편성", PAD, 166);
    font(ctx, 34, 500);
    const sub = [dateLabel(data.date), data.courts ? `코트 ${data.courts}면` : "", `${games.length}게임`].filter(Boolean).join("  ·  ");
    ctx.fillText(sub, PAD + 4, 222);

    // 범례
    let y = 300;
    font(ctx, 28, 700); ctx.textBaseline = "middle";
    ctx.fillStyle = C.mem; ctx.beginPath(); ctx.arc(PAD + 14, y + 4, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.text; ctx.fillText("회원", PAD + 34, y + 5);
    ctx.fillStyle = C.gst; ctx.beginPath(); ctx.arc(PAD + 140, y + 4, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.text; ctx.fillText("게스트", PAD + 160, y + 5);
    y += 56;

    const nameColor = (n) => (data.isGuest && data.isGuest(n) ? C.gst : C.mem);
    games.forEach((g) => {
      const ch = gameHead + Math.max(1, g.courts.length) * courtH + (g.rest.length ? restH : 0) + 24;
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,.06)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
      ctx.fillStyle = C.card; rr(ctx, PAD, y, W - PAD * 2, ch, 32); ctx.fill(); ctx.restore();
      // 게임 머리
      const gx = PAD + 32;
      ctx.fillStyle = C.brand1; rr(ctx, gx, y + 28, 150, 56, 28); ctx.fill();
      ctx.fillStyle = "#fff"; font(ctx, 32, 800); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(`${g.no}게임`, gx + 75, y + 57);
      ctx.fillStyle = C.text; font(ctx, 36, 700); ctx.textAlign = "right";
      ctx.fillText(g.time.replace("~", "  ~  "), W - PAD - 36, y + 57);
      let cy = y + gameHead;
      if (g.short || !g.courts.length) {
        ctx.fillStyle = C.muted; font(ctx, 30, 500); ctx.textAlign = "left";
        ctx.fillText("인원이 4명보다 적어 경기가 없어요", gx, cy + courtH / 2);
        cy += courtH;
      }
      g.courts.forEach((c, i) => {
        ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx, cy); ctx.lineTo(W - PAD - 32, cy); ctx.stroke();
        const t = c.type === "자유" ? "복식" : c.type;
        const [tb, tf] = C.type[t] || C.type.복식;
        const pw = pill(ctx, gx, cy + 18, `${i + 1}코트`, "#f1f3f2", C.text, 24);
        pill(ctx, gx + pw + 10, cy + 18, t, tb, tf, 24);
        const ok = c.score && c.score[0] !== "" && c.score[1] !== "" && c.score[0] != null && c.score[1] != null;
        const a = ok ? Number(c.score[0]) : 0, b = ok ? Number(c.score[1]) : 0;
        const midX = W / 2, rowY = cy + 104;
        const colW = (W - PAD * 2 - 64) / 2 - 110;
        // 왼쪽 팀
        c.teams[0].forEach((n, k) => {
          const sz = fit(ctx, n, colW, 40, 800); ctx.fillStyle = nameColor(n); ctx.textAlign = "left"; ctx.textBaseline = "middle";
          ctx.fillText(n, gx, rowY - 22 + k * 50);
          font(ctx, sz, 800);
        });
        // 오른쪽 팀
        c.teams[1].forEach((n, k) => {
          fit(ctx, n, colW, 40, 800); ctx.fillStyle = nameColor(n); ctx.textAlign = "right"; ctx.textBaseline = "middle";
          ctx.fillText(n, W - PAD - 32, rowY - 22 + k * 50);
        });
        // 가운데: VS 또는 점수
        if (ok) {
          font(ctx, 60, 800); ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillStyle = a > b ? C.brand1 : C.muted; ctx.fillText(String(a), midX - 58, rowY + 4);
          ctx.fillStyle = C.muted; font(ctx, 44, 700); ctx.fillText(":", midX, rowY);
          font(ctx, 60, 800); ctx.fillStyle = b > a ? C.brand1 : C.muted; ctx.fillText(String(b), midX + 58, rowY + 4);
          if (a !== b) pill(ctx, a > b ? midX - 58 - 34 : midX + 58 - 34, rowY + 44, "WIN", C.brand1, "#fff", 18);
        } else {
          ctx.fillStyle = "#f1f3f2"; ctx.beginPath(); ctx.arc(midX, rowY + 2, 40, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = C.muted; font(ctx, 30, 800); ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText("VS", midX, rowY + 3);
        }
        cy += courtH;
      });
      if (g.rest.length) {
        ctx.fillStyle = "#f6f8f7"; rr(ctx, gx, cy + 4, W - PAD * 2 - 64, 52, 16); ctx.fill();
        ctx.textAlign = "left"; ctx.textBaseline = "middle"; font(ctx, 28, 700);
        let x = gx + 20; ctx.fillStyle = C.muted; ctx.fillText("☕ 쉼", x, cy + 31); x += ctx.measureText("☕ 쉼").width + 18;
        g.rest.forEach((n, k) => {
          const s = n + (k < g.rest.length - 1 ? ", " : "");
          ctx.fillStyle = nameColor(n); ctx.fillText(n, x, cy + 31); x += ctx.measureText(n).width;
          if (k < g.rest.length - 1) { ctx.fillStyle = C.muted; ctx.fillText(", ", x, cy + 31); x += ctx.measureText(", ").width; }
          void s;
        });
      }
      y += ch + gap;
    });

    // 오늘 결과
    if (tally.length) {
      const th = 120 + tally.length * 58;
      ctx.fillStyle = C.card; rr(ctx, PAD, y, W - PAD * 2, th, 32); ctx.fill();
      ctx.fillStyle = C.text; font(ctx, 36, 800); ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText("📊 오늘 결과", PAD + 32, y + 50);
      const cols = [["승", 560], ["무", 650], ["패", 740], ["득실", 870]];
      font(ctx, 24, 500); ctx.fillStyle = C.muted; ctx.textAlign = "center";
      cols.forEach(([t, x]) => ctx.fillText(t, x, y + 96));
      tally.forEach((x, k) => {
        const ry = y + 140 + k * 58;
        if (k % 2 === 0) { ctx.fillStyle = "#f6f8f7"; rr(ctx, PAD + 20, ry - 26, W - PAD * 2 - 40, 52, 12); ctx.fill(); }
        ctx.textAlign = "left"; font(ctx, 30, 800); ctx.fillStyle = nameColor(x.name);
        ctx.fillText(`${k + 1}. ${x.name}`, PAD + 40, ry);
        const d = x.gf - x.ga;
        font(ctx, 30, 700); ctx.textAlign = "center";
        [[x.w, C.brand1], [x.d, C.muted], [x.l, "#c03a3a"], [(d > 0 ? "+" : "") + d, d > 0 ? C.brand1 : d < 0 ? "#c03a3a" : C.muted]]
          .forEach(([v, col], j) => { ctx.fillStyle = col; ctx.fillText(String(v), cols[j][1], ry); });
      });
      y += th + gap;
    }

    ctx.fillStyle = C.muted; font(ctx, 24, 500); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("라온 테니스 AI 매니저", W / 2, H - 50);
    return cv;
  }

  // 오늘 결과만 (경기 스코어 + 순위표) 그림
  // data: { date, matches:[{game_no,court_no,match_type,team_a,team_b,score_a,score_b}], ranks:[{name,rank,n,w,d,l,gf,ga}], total, label, isGuest(name) }
  function drawResults(data) {
    const m = data.matches || [], rk = data.ranks || [];
    const mH = 96, rH = 62, gap = 28;
    let H = 300 + 40;
    if (m.length) H += 100 + m.length * mH + gap;
    H += 150 + rk.length * rH + (data.label ? 40 : 0) + gap + 90;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    const nameColor = (n) => (data.isGuest && data.isGuest(n) ? C.gst : C.mem);

    // 머리
    const grd = ctx.createLinearGradient(0, 0, W, 260);
    grd.addColorStop(0, "#1b5e8f"); grd.addColorStop(1, C.brand2);
    ctx.fillStyle = grd; rr(ctx, 0, -40, W, 300, 48); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.12)";
    ctx.beginPath(); ctx.arc(W - 90, 60, 150, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(W - 250, 250, 70, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    font(ctx, 30, 700); ctx.globalAlpha = .85; ctx.fillText("RAON TENNIS", PAD + 4, 86); ctx.globalAlpha = 1;
    font(ctx, 64, 800); ctx.fillText("🏆 오늘의 결과", PAD, 166);
    font(ctx, 34, 500);
    ctx.fillText([dateLabel(data.date), `${data.nGames != null ? data.nGames : m.length}경기`, `${data.total || rk.length}명`].filter(Boolean).join("  ·  "), PAD + 4, 222);
    let y = 300;

    // 경기 스코어
    if (m.length) {
      const ch = 100 + m.length * mH;
      ctx.fillStyle = C.card; rr(ctx, PAD, y, W - PAD * 2, ch, 32); ctx.fill();
      ctx.fillStyle = C.text; font(ctx, 36, 800); ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText("🎾 경기 스코어", PAD + 32, y + 54);
      const midX = W / 2 + 40, colW = 250;
      m.forEach((r, k) => {
        const ry = y + 100 + k * mH + mH / 2;
        if (k % 2 === 0) { ctx.fillStyle = "#f6f8f7"; rr(ctx, PAD + 16, ry - mH / 2 + 6, W - PAD * 2 - 32, mH - 12, 16); ctx.fill(); }
        const t = r.match_type || "복식";
        const [tb, tf] = C.type[t] || C.type.복식;
        font(ctx, 24, 700); ctx.fillStyle = C.muted; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(`${r.game_no}게임`, PAD + 36, ry - 14);
        pill(ctx, PAD + 36, ry + 2, t, tb, tf, 20);
        const a = Number(r.score_a), b = Number(r.score_b);
        const team = (arr, x, align) => {
          const txt = arr.join(" · ");
          fit(ctx, txt, colW, 30, 800);
          ctx.textAlign = align; ctx.textBaseline = "middle";
          // 이름별 색: 오른쪽 정렬이면 뒤에서부터 그림
          const parts = []; arr.forEach((n, i) => { parts.push([n, nameColor(n)]); if (i < arr.length - 1) parts.push([" · ", C.muted]); });
          const total = parts.reduce((s2, [tx]) => s2 + ctx.measureText(tx).width, 0);
          let cx = align === "right" ? x - total : x;
          ctx.textAlign = "left";
          parts.forEach(([tx, col]) => { ctx.fillStyle = col; ctx.fillText(tx, cx, ry); cx += ctx.measureText(tx).width; });
        };
        team(r.team_a, midX - 90, "right");
        team(r.team_b, midX + 90, "left");
        font(ctx, 44, 800); ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = a > b ? C.brand1 : C.muted; ctx.fillText(String(a), midX - 42, ry + 2);
        ctx.fillStyle = C.muted; font(ctx, 34, 700); ctx.fillText(":", midX, ry);
        font(ctx, 44, 800); ctx.fillStyle = b > a ? C.brand1 : C.muted; ctx.fillText(String(b), midX + 42, ry + 2);
      });
      y += ch + gap;
    }

    // 순위표
    const th = 150 + rk.length * rH + (data.label ? 40 : 0);
    ctx.fillStyle = C.card; rr(ctx, PAD, y, W - PAD * 2, th, 32); ctx.fill();
    ctx.fillStyle = C.text; font(ctx, 36, 800); ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("📊 순위", PAD + 32, y + 54);
    font(ctx, 26, 700);
    ctx.fillStyle = C.mem; ctx.beginPath(); ctx.arc(W - PAD - 250, y + 54, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.text; ctx.fillText("회원", W - PAD - 232, y + 55);
    ctx.fillStyle = C.gst; ctx.beginPath(); ctx.arc(W - PAD - 140, y + 54, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.text; ctx.fillText("게스트", W - PAD - 122, y + 55);
    const cols = [["경기", 520], ["승", 610], ["무", 690], ["패", 770], ["승률", 860], ["득실", 960]];
    font(ctx, 24, 500); ctx.fillStyle = C.muted; ctx.textAlign = "center";
    cols.forEach(([t, x]) => ctx.fillText(t, x, y + 112));
    rk.forEach((x, k) => {
      const ry = y + 160 + k * rH;
      if (k % 2 === 0) { ctx.fillStyle = "#f6f8f7"; rr(ctx, PAD + 16, ry - 28, W - PAD * 2 - 32, 56, 12); ctx.fill(); }
      const medal = x.rank === 1 ? "🥇" : x.rank === 2 ? "🥈" : x.rank === 3 ? "🥉" : String(x.rank);
      font(ctx, 30, 800); ctx.textAlign = "center"; ctx.fillStyle = C.text; ctx.fillText(medal, PAD + 56, ry + 1);
      ctx.textAlign = "left"; fit(ctx, x.name, 300, 32, 800); ctx.fillStyle = nameColor(x.name); ctx.fillText(x.name, PAD + 100, ry + 1);
      const d = x.gf - x.ga, pc = x.n ? Math.round((x.w / x.n) * 100) + "%" : "-";
      font(ctx, 30, 700); ctx.textAlign = "center";
      [[x.n, C.text], [x.w, C.brand1], [x.d, C.muted], [x.l, "#c03a3a"], [pc, C.text], [(d > 0 ? "+" : "") + d, d > 0 ? C.brand1 : d < 0 ? "#c03a3a" : C.muted]]
        .forEach(([v, col], j) => { ctx.fillStyle = col; ctx.fillText(String(v), cols[j][1], ry + 1); });
    });
    if (data.label) {
      ctx.fillStyle = C.muted; font(ctx, 24, 500); ctx.textAlign = "center";
      ctx.fillText(data.label, W / 2, y + th - 30);
    }

    ctx.fillStyle = C.muted; font(ctx, 24, 500); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("라온 테니스 AI 매니저", W / 2, H - 50);
    return cv;
  }

  window.RaonLineupImage = { draw, drawResults };
})();
