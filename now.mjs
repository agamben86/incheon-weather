/* 인천 11개 군·구 「지금 기온」 — 기상청 초단기실황(getUltraSrtNcst). 1시간마다 GitHub Actions 가 돌려 now.json 을 갱신한다.
 *   인천아키비스트(https://인천아키비스트.com)가 이 파일을 읽어 카드·팝업에 지금 기온을 보여 준다.
 *   키는 GitHub 비밀값 DATA_GO_KR_KEY(공공데이터포털). 실패하면 now.json 을 건드리지 않는다. 출처: 기상청 */
import fs from 'node:fs';
const KEY = process.env.DATA_GO_KR_KEY;
if (!KEY) { console.error('DATA_GO_KR_KEY 없음'); process.exit(1); }
const 대표점 = { 강화군: [37.7466, 126.488], 옹진군: [37.2526, 126.4717], 제물포구: [37.4738, 126.6216], 영종구: [37.492, 126.493], 미추홀구: [37.4638, 126.6503], 연수구: [37.41, 126.6783], 남동구: [37.4473, 126.7314], 부평구: [37.507, 126.7219], 계양구: [37.5372, 126.7377], 서해구: [37.5455, 126.676], 검단구: [37.596, 126.668] };
/** 위경도 → 기상청 격자(Lambert 정각원추, 기상청 안내서의 식 그대로) */
function 격자(lat, lon) {
  const RE = 6371.00877 / 5.0, D = Math.PI / 180, s1 = 30 * D, s2 = 60 * D, ol = 126 * D, oa = 38 * D;
  let sn = Math.log(Math.cos(s1) / Math.cos(s2)) / Math.log(Math.tan(Math.PI * 0.25 + s2 * 0.5) / Math.tan(Math.PI * 0.25 + s1 * 0.5));
  let sf = Math.tan(Math.PI * 0.25 + s1 * 0.5); sf = Math.pow(sf, sn) * Math.cos(s1) / sn;
  let ro = Math.tan(Math.PI * 0.25 + oa * 0.5); ro = RE * sf / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * D * 0.5); ra = RE * sf / Math.pow(ra, sn);
  let th = lon * D - ol; if (th > Math.PI) th -= 2 * Math.PI; if (th < -Math.PI) th += 2 * Math.PI; th *= sn;
  return [Math.floor(ra * Math.sin(th) + 43 + 0.5), Math.floor(ro - ra * Math.cos(th) + 136 + 0.5)];
}

const 지금 = new Date(Date.now() + 9 * 36e5); // 한국 시각(UTC 필드로 읽는다)
// 40분 전이면 아직 이번 시 관측이 안 나왔다 — 한 시간 앞
const 기준시각 = new Date(지금.getTime() - (지금.getUTCMinutes() < 42 ? 60 : 0) * 6e4);
const 날 = 기준시각.toISOString().slice(0, 10).replaceAll('-', ''), 시 = String(기준시각.getUTCHours()).padStart(2, '0') + '00';
const 구 = {};
for (const [g, [lat, lon]] of Object.entries(대표점)) {
  const [nx, ny] = 격자(lat, lon);
  let j;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?serviceKey=${KEY}&pageNo=1&numOfRows=20&dataType=JSON&base_date=${날}&base_time=${시}&nx=${nx}&ny=${ny}`, { signal: AbortSignal.timeout(20000) });
      j = JSON.parse(await r.text()); if (j?.response?.body?.items) break;
    } catch {}
    await new Promise((ok) => setTimeout(ok, 1500 * (i + 1)));
  }
  const 줄 = [].concat(j?.response?.body?.items?.item || []);
  const 값 = (c) => 줄.find((x) => x.category === c)?.obsrValue;
  if (값('T1H') == null) { console.error(`${g} 실황 없음 — 파일을 건드리지 않는다`); process.exit(0); }
  구[g] = { t: +값('T1H'), pty: +(값('PTY') || 0), rn1: +(값('RN1') || 0), reh: +(값('REH') || 0) };
}
fs.writeFileSync('now.json', JSON.stringify({ 때: new Date().toISOString(), 기준: `${날} ${시}`, 출처: '기상청 초단기실황', 구 }));
console.log('now', 날, 시, Object.entries(구).map(([g, x]) => `${g} ${x.t}°`).join(' · '));
