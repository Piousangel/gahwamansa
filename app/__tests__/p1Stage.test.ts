// P1 공간 단계 순수 함수 표(리드 결정 11-19): 폭 320/360/411 × 높이 640/740/914 × 글자 1.0/1.3/1.5/2.0, 제스처 내비(위·아래 inset 24).
// 값이 바뀌면(문구·수치 변경) 이 표를 같이 고치고 에뮬레이터 실측(e2e/audit/p1-fit.yaml)으로 확인한다.
import {copy} from '../src/copy/copy';
import {areaFor, belowLineH, pickStage, type StageInput} from '../src/features/link/p1Stage';
import {KEYPAD_FIXED} from '../src/features/link/keypadFit';

const text: StageInput['text'] = {
  title: copy.connect.title,
  safe: copy.safe.money,
  below: copy.connect.auto_hint,
  legal: copy.legal.agree_parent,
  links: [copy.connect.no_code_link, copy.connect.view_course],
};
const at = (w: number, h: number, f: number, bottom = 24): StageInput => ({windowH: h, windowW: w, fontScale: f, insets: {top: 24, bottom}, text});
const S = (x: StageInput) => {
  const s = pickStage(x);
  return `${s.level}/${s.keyH}`;
};

// 단계/키 높이. 글자 1.0 1.3 1.5 2.0 순
const TABLE: Record<string, [string, string, string, string]> = {
  '320x640': ['4/64', '4/64', '4/64', '4/64'],
  '320x740': ['3/68', '4/64', '4/64', '4/64'],
  '320x914': ['0/68', '3/68', '3/68', '4/64'],
  '360x640': ['4/64', '4/64', '4/64', '4/64'],
  '360x740': ['3/68', '4/64', '4/64', '4/64'],
  '360x914': ['0/68', '2/68', '3/68', '4/64'],
  '411x640': ['4/64', '4/64', '4/64', '4/64'],
  '411x740': ['3/68', '4/64', '4/64', '4/64'],
  '411x914': ['0/68', '1/64', '3/68', '4/64'], // 11-25 #279 라이터 확정(31자): 약관 줄을 줄여 34자 때 1.3의 2단계가 main 과 같은 1단계로 돌아옴
};

describe('pickStage 표(제스처 내비)', () => {
  for (const [size, want] of Object.entries(TABLE)) {
    const [w, h] = size.split('x').map(Number);
    test(size, () => {
      expect([1, 1.3, 1.5, 2].map(f => S(at(w, h, f)))).toEqual(want);
    });
  }
});

describe('pickStage 성질', () => {
  test('고른 단계에서는 키 4줄이 영역에 들어가고(키 64~68), 그 앞 단계에서는 들어가지 않는다', () => {
    for (const w of [320, 360, 411]) {
      for (const h of [640, 740, 914]) {
        for (const f of [1, 1.3, 1.5, 2]) {
          const x = at(w, h, f);
          const s = pickStage(x);
          const need = (k: number) => KEYPAD_FIXED + belowLineH(x) + 4 * k;
          if (s.level < 4) {
            expect(s.keyH).toBeGreaterThanOrEqual(64);
            expect(s.keyH).toBeLessThanOrEqual(68);
            expect(need(s.keyH)).toBeLessThanOrEqual(areaFor(s.level, x));
          }
          for (let l = 0; l < Math.min(s.level, 4); l++) {
            expect(need(64)).toBeGreaterThan(areaFor(l, x));
          }
        }
      }
    }
  });

  test('글자가 커지거나 화면이 작아지면 단계가 내려가지 않는다(단조)', () => {
    for (const w of [320, 360, 411]) {
      for (const h of [640, 740, 914]) {
        const lv = [1, 1.3, 1.5, 2].map(f => pickStage(at(w, h, f)).level);
        expect([...lv].sort((a, b) => a - b)).toEqual(lv);
      }
    }
    for (const f of [1, 1.3, 1.5, 2]) {
      const lv = [914, 740, 640].map(h => pickStage(at(360, h, f)).level);
      expect([...lv].sort((a, b) => a - b)).toEqual(lv);
    }
  });

  test('3버튼 내비(아래 inset 48)는 제스처보다 단계가 내려가지 않는다', () => {
    for (const w of [320, 360, 411]) {
      for (const h of [640, 740, 914]) {
        for (const f of [1, 1.3, 1.5, 2]) {
          expect(pickStage(at(w, h, f, 48)).level).toBeGreaterThanOrEqual(pickStage(at(w, h, f)).level);
        }
      }
    }
  });

  test('갤럭시 S25(411×891, 글자 1.0)는 0단계', () => {
    expect(pickStage(at(411, 891, 1)).level).toBe(0);
  });
});
