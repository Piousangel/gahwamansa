// 실행: node --no-warnings --test scripts/tts/tts.test.mjs   (네트워크 없음)
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildLines, loadContent, loadCopy, parseSeedRows, privacyProblems, allLines} from './lines.mjs';
import {clipName, estimate, fullVoice, generatedSource, sampleTexts} from './synth.mjs';
import {splitSentences} from '../../app/src/audio/readText.ts';

test('시드 해석: 숫자·문자열(\'\' 이스케이프)·array, 주석 건너뜀', () => {
  const sql = `insert into seed_photos values
  (1, 'x', '캡션', '나무', array['그때 ''우리'' 집?', '어디?']),  -- 주석 (괄호) 'x'
  (2, 'y', 'c', '종', array['a?', 'b?'])
;
insert into other values (9, 'z');`;
  assert.deepEqual(parseSeedRows(sql, 'seed_photos'), [
    [1, 'x', '캡션', '나무', ["그때 '우리' 집?", '어디?']],
    [2, 'y', 'c', '종', ['a?', 'b?']],
  ]);
});

test('실제 시드: 30일 모두 사진 질문 2개·낱말·질문·선택지가 있다', () => {
  const c = loadContent();
  assert.equal(c.length, 30);
  for (const d of c) {
    assert.equal(d.recall_questions.length, 2, `day ${d.day}`);
    assert.ok(d.keyword && d.prompt && d.option_a && d.option_b, `day ${d.day}`);
  }
});

test('문장 목록: 앱과 같은 함수로 나눈 문장이고, 중복 없고, 응원 머리말·4개가 들어 있다', () => {
  const copy = loadCopy();
  const lines = buildLines(copy, loadContent());
  const texts = lines.map((l) => l.text);
  assert.equal(new Set(texts).size, texts.length);
  for (const t of texts) assert.deepEqual(splitSentences(t), [t]); // 다시 나눠도 그대로 = 앱이 같은 키로 찾는다
  assert.ok(texts.includes('가족이 보낸 응원이에요.'));
  for (const v of Object.values(copy.cheers)) assert.ok(texts.includes(v), v);
  assert.ok(texts.includes('한 글자씩, 학, 교, 종.'));
});

test('개인정보 검사: 실제 목록은 통과, 번호·메일·자리표시는 걸린다', () => {
  assert.deepEqual(privacyProblems(allLines()), []);
  assert.equal(privacyProblems([{text: '010-1234-5678로 연락'}, {text: 'a@b.c'}, {text: '{호칭} 안녕'}]).length, 3);
});

test('파일 이름: 보이스·속도·문장이 같으면 같고, 하나라도 다르면 다르다', () => {
  const a = clipName('ko-KR-Chirp3-HD-Kore', 1, '늘 고마워요');
  assert.match(a, /^[0-9a-f]{16}\.mp3$/);
  assert.equal(a, clipName('ko-KR-Chirp3-HD-Kore', 1, '늘 고마워요'));
  assert.notEqual(a, clipName('ko-KR-Chirp3-HD-Leda', 1, '늘 고마워요'));
  assert.notEqual(a, clipName('ko-KR-Chirp3-HD-Kore', 0.9, '늘 고마워요'));
  assert.equal(fullVoice('Kore'), 'ko-KR-Chirp3-HD-Kore');
  assert.equal(fullVoice('ko-KR-Chirp3-HD-Aoede'), 'ko-KR-Chirp3-HD-Aoede');
});

test('비용·크기 추정: 문자당 $0.00003, 초당 6KB', () => {
  const e = estimate(1000);
  assert.equal(e.costIfOverFree.toFixed(2), '0.03');
  assert.ok(e.bytes > 900_000 / 1000 && e.bytes < 1_000_000);
});

test('생성 TS: 따옴표를 이스케이프하고, 비면 빈 표', () => {
  const src = generatedSource({voice: 'v', speakingRate: 1, count: 1}, [{text: "그때 '우리'", file: 'ab.mp3'}]);
  assert.match(src, /'그때 \\'우리\\'': require\('\.\.\/assets\/voice\/ab\.mp3'\),/);
  assert.match(src, /VOICE_CLIPS_META: .* = \{voice: 'v', speakingRate: 1, count: 1\};/);
  assert.match(generatedSource({voice: null, speakingRate: 1, count: 0}, []), /VOICE_CLIPS: Record<string, number> = \{\};/);
});

test('샘플 글 3개: 사진·고르기·낱말(학교종)', () => {
  const t = sampleTexts(loadCopy(), loadContent());
  assert.equal(t.length, 3);
  assert.match(t[2], /학교종/);
});
