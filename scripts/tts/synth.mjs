// 미리 생성 음성 합성(Google Cloud Text-to-Speech, Chirp 3 HD). 설명·순서는 scripts/tts/README.md.
// 인증: 키 파일·토큰을 저장소나 채팅에 두지 않는다. 사용자가 직접 `gcloud auth application-default login` 한 뒤 실행하면,
//       이 스크립트가 `gcloud auth application-default print-access-token` 으로 짧은 토큰을 받아 메모리에서만 쓴다(출력·저장 안 함).
// 보내는 것: lines.mjs 가 모은 고정 문구(콘텐츠 시드·copy)뿐. 사용자 데이터 0.
//
// 사용:
//   node scripts/tts/synth.mjs --dry-run                 문장 수·문자 수·예상 비용·앱 크기만(네트워크 없음)
//   node scripts/tts/synth.mjs --samples [--dry-run]     보이스 후보 6개 × 같은 글 3개 → content/audio-raw/tts-samples/
//          [--voices Kore,Aoede,...] [--rate 1.0]
//   node scripts/tts/synth.mjs --voice ko-KR-Chirp3-HD-Kore [--rate 1.0] [--batch 묶음.json]
//          전 문장 생성(content/audio-raw/tts/, 이미 있으면 건너뜀) → 음량 맞춤(ffmpeg 있으면 -16 LUFS·모노 48kbps)
//          → app/src/assets/voice/ 설치 + app/src/audio/voiceClips.generated.ts 갱신 + 안 쓰는 옛 파일 삭제
//   node scripts/tts/synth.mjs --voice ... --install-only  API 호출 없이 이미 받은 원본으로 설치만 다시
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync, copyFileSync} from 'node:fs';
import {join} from 'node:path';
import {allLines, loadCopy, privacyProblems, root} from './lines.mjs';
import {readTextBuilders} from '../../app/src/audio/readText.ts';

export const PROJECT = 'gahwa-mansaseong';
export const ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';
/** 가격(공식 https://cloud.google.com/text-to-speech/pricing, 2026-11-19 확인): Chirp 3 HD 월 100만 자 무료, 넘으면 문자당 $0.00003. 공백·줄바꿈 포함 */
export const PRICE = {perChar: 0.00003, freeCharsPerMonth: 1_000_000, checked: '2026-11-19'};
/** 샘플 후보(공식 보이스 표 https://cloud.google.com/text-to-speech/docs/chirp3-hd 의 이름 + ko-KR). 여 4·남 2 — 어르신께 차분한 쪽 위주 */
export const SAMPLE_VOICES = ['Kore', 'Aoede', 'Leda', 'Sulafat', 'Charon', 'Orus'];
/** 설치 파일 형식: MP3 모노 48kbps(말소리에 충분). 크기 추정용 초당 바이트와 한국어 읽기 속도(추정 6.5자/초, 속도 1.0) */
export const OUT = {bitrateKbps: 48, bytesPerSec: 6000, charsPerSec: 6.5, lufs: -16};

export const RAW_DIR = join(root, 'content/audio-raw/tts');
export const SAMPLE_DIR = join(root, 'content/audio-raw/tts-samples');
export const ASSET_DIR = join(root, 'app/src/assets/voice');
export const GENERATED = join(root, 'app/src/audio/voiceClips.generated.ts');

/** 파일 이름 = sha256(보이스, 속도, 문장) 앞 16자리. 문장·보이스·속도 중 하나라도 바뀌면 새 파일(옛 파일은 설치 때 지움) */
export function clipName(voice, rate, text) {
  return `${createHash('sha256').update(`${voice}\n${rate}\n${text}`).digest('hex').slice(0, 16)}.mp3`;
}

export const fullVoice = (v) => (v.includes('-') ? v : `ko-KR-Chirp3-HD-${v}`);

export function estimate(chars) {
  const seconds = chars / OUT.charsPerSec;
  return {
    chars,
    costIfOverFree: chars * PRICE.perChar,
    seconds,
    bytes: Math.round(seconds * OUT.bytesPerSec),
  };
}

/** 샘플 글 3개: 사진 질문(1일), 둘 중 고르기(1일), 낱말(17일 학교종 — 음절 나열이 가장 어색한 틀) */
export function sampleTexts(copy, content) {
  const b = readTextBuilders(copy.tts.read);
  const d1 = content.find((c) => c.day === 1);
  const word = content.find((c) => c.keyword === '학교종') ?? content.find((c) => c.keyword);
  return [
    b.photo(d1.recall_questions),
    b.question(d1.prompt, d1.option_a, d1.option_b),
    b.word(word.keyword, Array.from(word.keyword)),
  ];
}

function accessToken() {
  try {
    return execFileSync('gcloud', ['auth', 'application-default', 'print-access-token'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.error('gcloud 가 없어요. scripts/tts/README.md 1단계(설치)를 먼저 해 주세요.');
    } else {
      console.error('로그인 정보가 없어요. 터미널에서 직접: gcloud auth application-default login  (README 2단계)');
    }
    process.exit(1);
  }
}

async function synthesize(token, voice, rate, text) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`, 'x-goog-user-project': PROJECT, 'Content-Type': 'application/json; charset=utf-8'},
    body: JSON.stringify({
      input: {text},
      voice: {languageCode: 'ko-KR', name: voice},
      audioConfig: {audioEncoding: 'MP3', speakingRate: rate, sampleRateHertz: 24000},
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (/SERVICE_DISABLED|has not been used|is disabled/i.test(body)) {
      console.error(`Text-to-Speech API 가 꺼져 있어요(프로젝트 ${PROJECT}). README 3단계: gcloud services enable texttospeech.googleapis.com --project ${PROJECT}`);
    } else if (res.status === 403 || res.status === 401) {
      console.error(`권한 오류 HTTP ${res.status}. README 2단계(로그인·quota 프로젝트)를 확인해 주세요.`);
    } else {
      console.error(`합성 실패 HTTP ${res.status}: ${body.slice(0, 300)}`);
    }
    process.exit(1);
  }
  const {audioContent} = await res.json();
  return Buffer.from(audioContent, 'base64');
}

const hasFfmpeg = () => {
  try {
    execFileSync('ffmpeg', ['-version'], {stdio: 'ignore'});
    return true;
  } catch {
    return false;
  }
};

/** 원본 → 설치 파일. ffmpeg 가 있으면 -16 LUFS·모노·48kbps, 없으면 그대로 복사(경고) */
function normalizeInto(src, dst, ffmpeg) {
  if (!ffmpeg) {
    copyFileSync(src, dst);
    return;
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-af', `loudnorm=I=${OUT.lufs}:TP=-1.5:LRA=11`, '-ac', '1', '-ar', '24000', '-b:a', `${OUT.bitrateKbps}k`, dst]);
}

export function generatedSource(meta, entries) {
  const lit = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const rows = entries.map((e) => `  ${lit(e.text)}: require('../assets/voice/${e.file}'),`).join('\n');
  return `// 자동 생성 파일: scripts/tts/synth.mjs --install 이 덮어쓴다. 손으로 고치지 않는다.
// 미리 생성 음성(Google Cloud TTS Chirp 3 HD) 문장 → 번들 자산. 키는 readText.normalizeSentence 로 맞춘 문장 그대로.
// 비어 있으면(보이스를 아직 고르지 않음) 모든 읽기가 기기 TTS 로 간다.
export const VOICE_CLIPS_META: {voice: string | null; speakingRate: number; count: number} = ${JSON.stringify(meta).replace(/"(\w+)":/g, '$1: ').replace(/,/g, ', ').replace(/"/g, "'")};

export const VOICE_CLIPS: Record<string, number> = {${rows ? `\n${rows}\n` : ''}};
`;
}

const fmtKB = (b) => `${(b / 1024).toFixed(0)}KB`;
const usd = (n) => `$${n.toFixed(2)}`;

async function main() {
  const argv = process.argv.slice(2);
  const opt = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
  const dry = argv.includes('--dry-run');
  const rate = Number(opt('--rate', '1.0'));
  if (!(rate >= 0.25 && rate <= 2)) {
    console.error('--rate 는 0.25~2.0');
    process.exit(2);
  }
  const batches = argv.flatMap((a, i) => (argv[i - 1] === '--batch' ? [a] : []));
  const lines = allLines({batches});
  const problems = privacyProblems(lines);
  if (problems.length > 0) {
    console.error(`보내면 안 되는 글이 있어 멈춰요:\n${problems.join('\n')}`);
    process.exit(1);
  }

  if (argv.includes('--samples')) {
    const {loadContent} = await import('./lines.mjs');
    const texts = sampleTexts(loadCopy(), loadContent({batches}));
    const voices = opt('--voices', SAMPLE_VOICES.join(',')).split(',').map((v) => fullVoice(v.trim()));
    const chars = texts.reduce((n, t) => n + t.length, 0) * voices.length;
    const e = estimate(chars);
    console.log(`샘플: 보이스 ${voices.length}개 × 글 ${texts.length}개 = 파일 ${voices.length * texts.length}개, ${chars}자`);
    texts.forEach((t, i) => console.log(`  글 ${i + 1}: ${t}`));
    console.log(`예상 비용: 무료 한도(월 ${PRICE.freeCharsPerMonth.toLocaleString()}자) 안이면 $0, 넘으면 ${usd(e.costIfOverFree)} (가격 ${PRICE.checked} 확인)`);
    if (dry) return;
    const token = accessToken();
    for (const v of voices) {
      const dir = join(SAMPLE_DIR, `rate-${rate}`, v);
      mkdirSync(dir, {recursive: true});
      for (let i = 0; i < texts.length; i++) {
        writeFileSync(join(dir, `${i + 1}.mp3`), await synthesize(token, v, rate, texts[i]));
      }
      console.log(`  ✓ ${v}`);
    }
    console.log(`\n듣기: open ${join(SAMPLE_DIR, `rate-${rate}`)}   (보이스 폴더마다 1·2·3.mp3)`);
    return;
  }

  const chars = lines.reduce((n, l) => n + l.text.length, 0);
  const e = estimate(chars);
  const voiceArg = opt('--voice');
  console.log(`읽을 문장 ${lines.length}개 · ${chars}자 (콘텐츠 ${new Set(lines.flatMap((l) => l.sources.filter((s) => s.startsWith('day')).map((s) => s.split('.')[0]))).size}일치 + 응원)`);
  console.log(`예상 비용: 무료 한도(월 ${PRICE.freeCharsPerMonth.toLocaleString()}자) 안이면 $0, 넘으면 ${usd(e.costIfOverFree)} (Chirp 3 HD $30/100만 자, ${PRICE.checked} 확인)`);
  console.log(`예상 길이·앱 크기: 약 ${Math.round(e.seconds)}초 → MP3 모노 ${OUT.bitrateKbps}kbps 약 ${fmtKB(e.bytes)} (추정 ${OUT.charsPerSec}자/초)`);
  const days = new Set(lines.flatMap((l) => l.sources.filter((s) => s.startsWith('day')).map((s) => s.split('.')[0]))).size || 1;
  const perDay = chars / days; // 응원 몫이 조금 섞인 상한 쪽 추정
  console.log(`하루치 평균: 약 ${Math.round(perDay)}자 ≈ ${fmtKB(estimate(perDay).bytes)} · 1년치(365일) 약 ${Math.round(perDay * 365).toLocaleString()}자 ≈ ${(estimate(perDay * 365).bytes / 1048576).toFixed(1)}MB, 무료 한도 넘으면 ${usd(estimate(perDay * 365).costIfOverFree)}`);
  if (dry) return;
  if (!voiceArg) {
    console.error('\n--voice 를 주세요(샘플을 듣고 고른 이름, 예: --voice Kore). 비용만 보려면 --dry-run');
    process.exit(2);
  }
  const voice = fullVoice(voiceArg);
  const plan = lines.map((l) => ({text: l.text, file: clipName(voice, rate, l.text)}));
  mkdirSync(RAW_DIR, {recursive: true});
  if (!argv.includes('--install-only')) {
    const todo = plan.filter((p) => !existsSync(join(RAW_DIR, p.file)));
    console.log(`\n${voice} · 속도 ${rate}: 새로 만들 ${todo.length}개(이미 있음 ${plan.length - todo.length}개)`);
    if (todo.length > 0) {
      const token = accessToken();
      for (const [i, p] of todo.entries()) {
        writeFileSync(join(RAW_DIR, p.file), await synthesize(token, voice, rate, p.text));
        if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${todo.length}`);
      }
    }
  }
  const missing = plan.filter((p) => !existsSync(join(RAW_DIR, p.file)));
  if (missing.length > 0) {
    console.error(`원본이 없는 문장 ${missing.length}개(--install-only 전에 한 번 생성하세요)`);
    process.exit(1);
  }
  const ffmpeg = hasFfmpeg();
  if (!ffmpeg) console.warn('ffmpeg 가 없어 음량 맞춤 없이 원본을 그대로 넣어요(brew install ffmpeg 권장)');
  mkdirSync(ASSET_DIR, {recursive: true});
  const keep = new Set(plan.map((p) => p.file));
  for (const p of plan) normalizeInto(join(RAW_DIR, p.file), join(ASSET_DIR, p.file), ffmpeg);
  let removed = 0;
  for (const f of readdirSync(ASSET_DIR)) {
    if (f.endsWith('.mp3') && !keep.has(f)) {
      unlinkSync(join(ASSET_DIR, f));
      removed++;
    }
  }
  writeFileSync(GENERATED, generatedSource({voice, speakingRate: rate, count: plan.length}, plan));
  const total = plan.reduce((n, p) => n + statSync(join(ASSET_DIR, p.file)).size, 0);
  writeFileSync(join(RAW_DIR, 'review.tsv'), `file\ttext\n${plan.map((p) => `${p.file}\t${p.text}`).join('\n')}\n`);
  console.log(`\n설치: app/src/assets/voice/ ${plan.length}개 · 실제 ${fmtKB(total)} (옛 파일 ${removed}개 삭제), voiceClips.generated.ts 갱신`);
  console.log(`발음 검수 목록: content/audio-raw/tts/review.tsv — 옛 낱말·사투리는 꼭 귀로 확인. 틀린 문장은 README '다시 만들기'`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
