// 라온 테니스: 갤럭시 카톡 알림 받기 (Phase 5)
// 폰의 MacroDroid가 카톡 알림이 뜰 때마다 이 주소로 보냅니다.
//   POST https://<프로젝트>.supabase.co/functions/v1/kakao-notify?token=<연결 코드>&title=..&text=..&sub=..
//   (값은 주소 뒤 쿼리, JSON 본문, 폼 본문 어느 것으로 보내도 됩니다)
// - 연결 코드는 앱 설정에서 만들고, DB에는 해시만 저장됩니다. 코드가 맞지 않으면 거절합니다.
// - 앱 설정의 '단톡방 이름'이 알림 제목/서브텍스트에 들어 있는 것만 저장합니다. (다른 대화는 저장하지 않음)
// - 이 함수는 로그인 없이 호출되므로 대시보드에서 'Verify JWT'를 꺼 둡니다.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "content-type, x-raon-token" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST" && req.method !== "GET") return json({ ok: false, error: "method" }, 405);
  const p: Record<string, string> = Object.fromEntries(new URL(req.url).searchParams);
  if (req.method === "POST") {
    const raw = (await req.text()).slice(0, 20000);
    if (raw.trim()) {
      try {
        const o = JSON.parse(raw);
        if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) p[k] = String(v ?? "");
      } catch {
        for (const [k, v] of new URLSearchParams(raw)) p[k] = v;
      }
    }
  }

  const token = (p.token || req.headers.get("x-raon-token") || "").trim();
  if (!token) return json({ ok: false, error: "연결 코드가 없어요" }, 401);
  const { data: cfg, error: cfgErr } = await sb.from("notify_config").select("room_name, token_hash").eq("id", 1).maybeSingle();
  if (cfgErr) return json({ ok: false, error: "설정을 읽지 못했어요" }, 500);
  if (!cfg || !cfg.token_hash || (await sha256(token)) !== cfg.token_hash) return json({ ok: false, error: "연결 코드가 맞지 않아요" }, 401);

  const clip = (s: string | undefined, n: number) => String(s || "").trim().slice(0, n);
  const title = clip(p.title, 200), sub = clip(p.sub, 200);
  let text = clip(p.text || p.big, 4000);
  // 테스트 신호 (앱/폰 설정 확인용)
  if (p.test === "1") return json({ ok: true, test: true, room: cfg.room_name });
  if (!text) return json({ ok: true, skipped: "empty" });

  const room = String(cfg.room_name || "").trim();
  if (!room) return json({ ok: true, skipped: "room not set" }); // 방 이름을 정하기 전에는 아무것도 저장하지 않음
  if (![title, sub].some((x) => x.includes(room))) return json({ ok: true, skipped: "other room" });

  // 단톡방 알림은 보통 제목=보낸 사람, 서브텍스트=방 이름. 제목이 방 이름이면 '보낸사람 : 내용' 형태를 나눔
  let sender = title;
  if (title.includes(room)) {
    const m = text.match(/^(.{1,20}?)\s*:\s*([\s\S]+)$/);
    if (m) { sender = m[1].trim(); text = m[2].trim(); } else sender = "";
  }

  // 같은 알림이 여러 번 오는 경우(알림 갱신) 10분 안 중복은 버림
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: dup } = await sb.from("kakao_inbox").select("id").eq("sender", sender).eq("body", text).gte("received_at", since).limit(1);
  if (dup && dup.length) return json({ ok: true, skipped: "duplicate" });

  const { error } = await sb.from("kakao_inbox").insert({ room: sub || title, sender, body: text, raw_title: title, raw_sub: sub });
  if (error) return json({ ok: false, error: "저장하지 못했어요" }, 500);
  return json({ ok: true, saved: true });
});
