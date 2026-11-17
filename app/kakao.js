// 카카오톡 대화 내보내기(TXT) 해석기
// 지원 형식: PC(Windows/Mac) 내보내기, 안드로이드/아이폰 내보내기
// 결과: [{ id, sent_at: "YYYY-MM-DD HH:MM", author, text }]  (모두 한국 시간 기준 그대로)
(function () {
  const pad = (n) => String(n).padStart(2, "0");
  function to24(ampm, h) {
    h = Number(h);
    if (ampm === "오전") return h === 12 ? 0 : h;
    if (ampm === "오후") return h === 12 ? 12 : h + 12;
    return h; // 24시간 형식
  }

  // PC: "--------------- 2026년 11월 15일 토요일 ---------------"
  const RE_PC_DATE = /^-{3,}\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일.*-{3,}\s*$/;
  // PC: "[홍길동] [오전 9:12] 내용"
  const RE_PC_MSG = /^\[(.+?)\]\s\[(오전|오후)?\s?(\d{1,2}):(\d{2})\]\s?(.*)$/;
  // 모바일: "2026년 11월 15일 오전 9:12, 홍길동 : 내용"  또는  "2026. 11. 15. 오전 9:12, 홍길동 : 내용"
  const RE_MOBILE_MSG = /^(\d{4})[년.]\s*(\d{1,2})[월.]\s*(\d{1,2})[일.]?\s*(오전|오후)?\s*(\d{1,2}):(\d{2}),\s(.+?)\s:\s(.*)$/;
  // 모바일 시스템 줄(입장/퇴장 등): 날짜+시간으로 시작하지만 " : "가 없음
  const RE_MOBILE_SYS = /^(\d{4})[년.]\s*(\d{1,2})[월.]\s*(\d{1,2})[일.]?\s*(오전|오후)?\s*(\d{1,2}):(\d{2})[,:]/;
  // 날짜만 있는 줄: "2026년 11월 15일 토요일"
  const RE_DATE_ONLY = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*\S+요일\s*$/;

  function parse(raw) {
    const lines = String(raw).replace(/^\uFEFF/, "").split(/\r?\n/);
    const out = [];
    let curDate = null;
    let last = null;
    for (const line of lines) {
      let m;
      if ((m = line.match(RE_PC_DATE)) || (m = line.match(RE_DATE_ONLY))) {
        curDate = `${m[1]}-${pad(m[2])}-${pad(m[3])}`; last = null; continue;
      }
      if ((m = line.match(RE_MOBILE_MSG))) {
        const d = `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
        last = { id: out.length, sent_at: `${d} ${pad(to24(m[4], m[5]))}:${m[6]}`, author: m[7].trim(), text: m[8] };
        out.push(last); curDate = d; continue;
      }
      if (RE_MOBILE_SYS.test(line)) { last = null; continue; }
      if (curDate && (m = line.match(RE_PC_MSG))) {
        last = { id: out.length, sent_at: `${curDate} ${pad(to24(m[2], m[3]))}:${m[4]}`, author: m[1].trim(), text: m[5] };
        out.push(last); continue;
      }
      // 여러 줄 메시지의 다음 줄
      if (last && line.trim() !== "") last.text += "\n" + line;
    }
    return out;
  }

  // 예약과 관련 있어 보이는 메시지만 고르기 (AI에는 이것만 보냄 - 개인정보 최소화)
  function isCandidate(msg, venueNames) {
    const t = msg.text;
    if (/^(사진|동영상|이모티콘|파일:|삭제된 메시지입니다)/.test(t.trim())) return false;
    // 경기 대진표는 코트 예약과 관계없음 (총무님 확인) — AI에 보내지 않음
    if (/대진표/.test(t)) return false;
    const venueHit = (venueNames || []).some((v) => {
      const short = v.replace(/\s*테니스장\s*$/, "").trim();
      return short && t.includes(short);
    });
    return venueHit || /(예약|코트|취소|변경|연기|미뤄|미루|당겨|앞당|양도|잡았|잡아|성공|\d{1,2}\s*시|\d{1,2}:\d{2})/.test(t);
  }

  window.RaonKakao = { parse, isCandidate };
})();
