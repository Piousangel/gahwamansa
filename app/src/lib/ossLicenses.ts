// 오픈소스 라이선스 목록(AU-06). 생성 파일 두 개(src/oss/*.generated.json, 의존성을 바꾸면 `npm run oss`, release 빌드·jest 가 최신인지 검사)를
// 화면용 한 목록으로. React 를 모른다. 파일이 커서(약 280KB) 화면을 열 때 처음 읽는다.
export type OssRow = {
  key: string;
  name: string;
  version: string;
  /** 라이선스 이름(SPDX 또는 POM 이름). 여럿이면 ' / ' 로 */
  license: string;
  /** 전문(JS 패키지 LICENSE 파일). 없으면 null → 주소가 있으면 주소를 보여 준다 */
  text: string | null;
  url: string | null;
};

type JsList = {packages: {name: string; version: string; license: string; text: string | null}[]; texts: Record<string, string>};
type AndroidList = {packages: {name: string; version: string; licenses: {name: string; url: string}[]}[]};
/** 번들 글꼴(F-01). SIL OFL 1.1 은 글꼴과 함께 저작권·라이선스 전문을 배포하라고 한다 — 손으로 관리(src/oss/fonts.json) */
type FontList = {fonts: {name: string; version: string; license: string; copyright: string; text: string}[]};

export function buildOssRows(js: JsList, android: AndroidList, fonts: FontList = {fonts: []}): OssRow[] {
  const rows: OssRow[] = [
    ...js.packages.map(p => ({
      key: `js:${p.name}@${p.version}`,
      name: p.name,
      version: p.version,
      license: p.license,
      text: p.text ? js.texts[p.text] ?? null : null,
      url: null,
    })),
    ...android.packages.map(p => ({
      key: `android:${p.name}@${p.version}`,
      name: p.name,
      version: p.version,
      license: p.licenses.map(l => l.name || l.url).join(' / ') || 'UNKNOWN',
      text: null,
      url: p.licenses.find(l => /^https?:\/\//.test(l.url))?.url ?? null,
    })),
    ...fonts.fonts.map(f => ({
      key: `font:${f.name}`,
      name: f.name,
      version: f.version,
      license: f.license,
      text: `${f.copyright}\n\n${f.text}`,
      url: null,
    })),
  ];
  return rows.sort((a, b) => a.name.localeCompare(b.name, 'en') || a.version.localeCompare(b.version, 'en'));
}

let cache: OssRow[] | null = null;
export function ossRows(): OssRow[] {
  if (!cache) {
    cache = buildOssRows(require('../oss/js.generated.json'), require('../oss/android.generated.json'), require('../oss/fonts.json'));
  }
  return cache;
}
