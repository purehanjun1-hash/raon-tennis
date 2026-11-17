// 데이터 저장소: Supabase 모드와 체험(로컬) 모드를 같은 방식으로 다룹니다.
(function () {
  const STATUSES = ["확정", "예정", "확인 필요", "취소"];
  const SEED_VENUES = ["수목원 테니스장", "스포원 테니스장", "송정 테니스장"];

  function uid() {
    return (crypto.randomUUID && crypto.randomUUID()) ||
      "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
  function nowIso() { return new Date().toISOString(); }

  function toMin(t) {
    const [h, m] = String(t).slice(0, 5).split(":").map(Number);
    return h * 60 + m;
  }
  // 같은 날짜 + 같은 장소 + 같은 코트 + 시간 겹침 (취소된 예약은 제외)
  function findConflict(list, r, ignoreId) {
    if (r.status === "취소") return null;
    const s = toMin(r.start_time), e = toMin(r.end_time);
    const court = String(r.court_number || "").trim();
    return list.find((x) =>
      x.id !== ignoreId &&
      x.status !== "취소" &&
      x.reservation_date === r.reservation_date &&
      x.venue_id === r.venue_id &&
      String(x.court_number || "").trim() === court &&
      toMin(x.start_time) < e && s < toMin(x.end_time)
    ) || null;
  }

  function validate(r) {
    if (!r.reservation_date) return "날짜를 입력해 주세요.";
    if (!r.start_time || !r.end_time) return "시작·종료 시간을 입력해 주세요.";
    if (toMin(r.end_time) <= toMin(r.start_time)) return "종료 시간은 시작 시간보다 늦어야 해요.";
    if (!r.venue_id) return "장소를 선택해 주세요.";
    if (!String(r.court_number || "").trim()) return "코트 번호를 입력해 주세요.";
    if (!STATUSES.includes(r.status)) return "상태를 선택해 주세요.";
    return null;
  }

  function pickFields(r) {
    const f = {
      reservation_date: r.reservation_date,
      start_time: String(r.start_time).slice(0, 5),
      end_time: String(r.end_time).slice(0, 5),
      venue_id: r.venue_id,
      court_number: String(r.court_number || "").trim(),
      reserved_by: (r.reserved_by || "").trim(),
      status: r.status,
      memo: (r.memo || "").trim(),
    };
    // AI 분석으로 들어온 예약: 원본 메시지와 신뢰도 보관
    if (r.source_message) f.source_message = String(r.source_message);
    if (r.confidence !== undefined && r.confidence !== null && r.confidence !== "") f.confidence = Number(r.confidence);
    return f;
  }
  // 참석 일정: 시간·장소·코트는 비워도 됨 (예약에 연결하면 예약 정보를 따라감)
  function pickAttendance(a) {
    const t = (v) => (v ? String(v).slice(0, 5) : null);
    const f = {
      attend_date: a.attend_date,
      start_time: t(a.start_time), end_time: t(a.end_time),
      venue_id: a.venue_id || null,
      court_number: (a.court_number || "").trim() || null,
      reservation_id: a.reservation_id || null,
      member_name: (a.member_name || "").trim() || "유환준",
      memo: (a.memo || "").trim(),
    };
    if (!f.attend_date) throw new Error("날짜를 입력해 주세요.");
    if (f.start_time && f.end_time && toMin(f.end_time) <= toMin(f.start_time)) throw new Error("종료 시간은 시작 시간보다 늦어야 해요.");
    return f;
  }
  const normAtt = (a) => Object.assign({}, a, { start_time: a.start_time ? String(a.start_time).slice(0, 5) : null, end_time: a.end_time ? String(a.end_time).slice(0, 5) : null });
  function normalize(r) {
    return Object.assign({}, r, {
      start_time: String(r.start_time).slice(0, 5),
      end_time: String(r.end_time).slice(0, 5),
    });
  }
  function reasonFor(before, after) {
    if (!before) return "등록";
    if (before.status !== "취소" && after.status === "취소") return "취소";
    if (before.status === "취소" && after.status !== "취소") return "취소 해제";
    return "수정";
  }

  // ---------------- 체험(로컬) 모드 ----------------
  class LocalStore {
    constructor() { this.mode = "local"; this.key = "raon_tennis_v1"; }
    _load() {
      let d = null;
      try { d = JSON.parse(localStorage.getItem(this.key)); } catch (e) { d = null; }
      if (!d) {
        d = { venues: [], reservations: [], history: [] };
        SEED_VENUES.forEach((n) => d.venues.push({ id: uid(), venue_name: n, address: "", court_information: [], created_at: nowIso() }));
        this._save(d);
      }
      return d;
    }
    _save(d) { try { localStorage.setItem(this.key, JSON.stringify(d)); } catch (e) { /* 저장 불가 */ } }
    async init() { this._load(); return { needsLogin: false }; }
    async user() { return { email: "체험 모드" }; }
    async login() { return null; }
    async logout() {}
    async listVenues() { return this._load().venues.slice().sort((a, b) => a.created_at.localeCompare(b.created_at)); }
    async saveVenue(v) {
      const d = this._load();
      const name = (v.venue_name || "").trim();
      if (!name) throw new Error("장소 이름을 입력해 주세요.");
      if (v.id) {
        const x = d.venues.find((y) => y.id === v.id);
        Object.assign(x, { venue_name: name, address: v.address || "", court_information: v.court_information || [] });
      } else {
        d.venues.push({ id: uid(), venue_name: name, address: v.address || "", court_information: v.court_information || [], created_at: nowIso() });
      }
      this._save(d);
    }
    async listReservations() { return this._load().reservations.map(normalize); }
    async saveReservation(input) {
      const d = this._load();
      const r = pickFields(input);
      const err = validate(r); if (err) throw new Error(err);
      const c = findConflict(d.reservations, r, input.id);
      if (c) throw Object.assign(new Error("겹치는 예약이 이미 있어요."), { conflict: c });
      if (input.id) {
        const x = d.reservations.find((y) => y.id === input.id);
        const before = Object.assign({}, x);
        Object.assign(x, r, { updated_at: nowIso() });
        d.history.push({ id: uid(), reservation_id: x.id, previous_data: before, updated_data: Object.assign({}, x), change_reason: reasonFor(before, x), changed_at: nowIso() });
        this._save(d); return x;
      }
      const x = Object.assign({ id: uid(), source_message: null, confidence: null, created_at: nowIso(), updated_at: nowIso() }, r);
      d.reservations.push(x);
      d.history.push({ id: uid(), reservation_id: x.id, previous_data: null, updated_data: Object.assign({}, x), change_reason: "등록", changed_at: nowIso() });
      this._save(d); return x;
    }
    async history(id) {
      return this._load().history.filter((h) => h.reservation_id === id).sort((a, b) => b.changed_at.localeCompare(a.changed_at));
    }
    async listAttendance() { return (this._load().attendance || []).map(normAtt); }
    async addAttendance(a) {
      const d = this._load(); d.attendance = d.attendance || [];
      const f = pickAttendance(a);
      if (f.reservation_id && d.attendance.some((x) => x.reservation_id === f.reservation_id && x.member_name === f.member_name)) throw new Error("이미 참석으로 표시된 예약이에요.");
      const x = Object.assign({ id: uid(), created_at: nowIso() }, f); d.attendance.push(x); this._save(d); return x;
    }
    async removeAttendance(id) { const d = this._load(); d.attendance = (d.attendance || []).filter((x) => x.id !== id); this._save(d); }
    async analyze() { throw new Error("체험 모드에서는 AI 분석을 쓸 수 없어요. 서버(Supabase)에 연결해야 해요."); }
    async createImport() { return null; }
    async updateImport() {}
  }

  // ---------------- Supabase 모드 ----------------
  class SupabaseStore {
    constructor(url, key) {
      this.mode = "supabase";
      this.sb = window.supabase.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
    }
    _check(res) {
      if (res.error) {
        const e = res.error;
        if (e.code === "23P01") throw new Error("겹치는 예약이 이미 있어요. (같은 날짜·장소·코트·시간)");
        if (e.code === "42501" || /row-level security/i.test(e.message)) throw new Error("권한이 없어요. 다시 로그인해 주세요.");
        throw new Error(e.message || "서버 오류가 났어요.");
      }
      return res.data;
    }
    async init() {
      const { data } = await this.sb.auth.getSession();
      return { needsLogin: !data.session };
    }
    async user() { const { data } = await this.sb.auth.getUser(); return data.user; }
    async login(email, password) {
      const { error } = await this.sb.auth.signInWithPassword({ email, password });
      if (error) return "이메일 또는 비밀번호가 맞지 않아요.";
      return null;
    }
    async logout() { await this.sb.auth.signOut(); }
    async listVenues() { return this._check(await this.sb.from("venues").select("*").order("created_at")); }
    async saveVenue(v) {
      const name = (v.venue_name || "").trim();
      if (!name) throw new Error("장소 이름을 입력해 주세요.");
      const row = { venue_name: name, address: v.address || "", court_information: v.court_information || [] };
      if (v.id) this._check(await this.sb.from("venues").update(row).eq("id", v.id));
      else this._check(await this.sb.from("venues").insert(row));
    }
    async listReservations() {
      return this._check(await this.sb.from("reservations").select("*").order("reservation_date").order("start_time")).map(normalize);
    }
    async saveReservation(input, currentList) {
      const r = pickFields(input);
      const err = validate(r); if (err) throw new Error(err);
      const c = findConflict(currentList || [], r, input.id);
      if (c) throw Object.assign(new Error("겹치는 예약이 이미 있어요."), { conflict: c });
      if (input.id) return normalize(this._check(await this.sb.from("reservations").update(r).eq("id", input.id).select().single()));
      return normalize(this._check(await this.sb.from("reservations").insert(r).select().single()));
    }
    async history(id) {
      return this._check(await this.sb.from("reservation_history").select("*").eq("reservation_id", id).order("changed_at", { ascending: false }));
    }
    async listAttendance() { return this._check(await this.sb.from("attendance").select("*").order("attend_date")).map(normAtt); }
    async addAttendance(a) {
      const res = await this.sb.from("attendance").insert(pickAttendance(a)).select().single();
      if (res.error && res.error.code === "23505") throw new Error("이미 참석으로 표시된 예약이에요.");
      return normAtt(this._check(res));
    }
    async removeAttendance(id) { this._check(await this.sb.from("attendance").delete().eq("id", id)); }
    // AI 분석 (서버 함수 호출). payload: { today, venues, existing, messages }
    async analyze(payload) {
      const { data, error } = await this.sb.functions.invoke("analyze-messages", { body: payload });
      if (error) {
        let msg = "AI 분석 중 오류가 났어요.";
        try { const b = await error.context.json(); if (b && b.error) msg = b.error; } catch (e) { /* 본문 없음 */ }
        const err = new Error(msg);
        err.status = error.context && error.context.status; // 없으면 연결 오류
        throw err;
      }
      return data;
    }
    async createImport(fileName) {
      const row = this._check(await this.sb.from("message_imports").insert({ file_name: fileName, import_status: "분석 중" }).select().single());
      return row.id;
    }
    async updateImport(id, status) {
      if (!id) return;
      await this.sb.from("message_imports").update({ import_status: status, processed_at: new Date().toISOString() }).eq("id", id);
    }
  }

  const cfg = window.RAON_CONFIG || {};
  const useSb = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase;
  window.RaonStore = useSb ? new SupabaseStore(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : new LocalStore();
  window.RaonStore.STATUSES = STATUSES;
  window.RaonStore.findConflict = findConflict;
})();
