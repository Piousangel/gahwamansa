/**
 * @jest-environment node
 */
// Dock 상한 예산(SUMMARY 2-4·Q1 '그래도 넘치면 페이드 + 테스트 실패', RULES-V4 dock.lastResort).
// 화면의 Dock 구성(실제 문구)을 320×640·360×780 × 글자 1.0·1.3·1.5·2.0 × audience 로 추정해,
// note → 보조를 본문으로 보낸 뒤에도 상한(높이 × 40%, intro 0.6)을 넘으면 실패한다.
// 추정은 글자 폭 근사(ui/ds/dockLayout)라 실기기 Maestro 캡처를 대신하지 못한다 — 대신 새 문구·새 슬롯이 상한을 깨는 것을 PR 에서 막는다.
declare const __dirname: string;
const fs: {readFileSync(p: string, e: string): string; readdirSync(p: string, o: {withFileTypes: true}): {name: string; isDirectory(): boolean}[]} = require('fs');
const path: {join(...p: string[]): string; relative(a: string, b: string): string} = require('path');
import {copy} from '../src/copy/copy';
import type {DockProps} from '../src/ui/ds';
import {planDock} from '../src/ui/ds/dockLayout';
import {dockRatioFor, type ScreenVariant} from '../src/ui/ds/Screen';
import type {Audience} from '../src/ui/tokensV4';

const noop = () => {};
type Case = {name: string; screen: string; variant: ScreenVariant; audience: Audience; dock: DockProps};

/**
 * 화면 Dock 사례. 화면이 DsScreen dock 을 쓰기 시작하면 그 파일 이름(screen)으로 여기 한 줄을 더한다(아래 '사례 누락' 테스트가 강제).
 * 지금은 화면 적용 전이라 빌드 1 대상 화면의 예정 구성(SUMMARY 4-1, 시안 v4 묶음 1)을 미리 넣어 문구 길이를 지킨다.
 */
const DOCK_CASES: Case[] = [
  {
    name: 'C0 로그인 고르기(카카오·구글 + 이메일 링크)',
    screen: 'ChildLogin',
    variant: 'form',
    audience: 'child',
    dock: {
      primary: {social: [{provider: 'kakao', label: copy.login.kakao, onPress: noop}, {provider: 'google', label: copy.login.google, onPress: noop}]},
      secondary: {kind: 'text', label: copy.login.email_link, onPress: noop},
    },
  },
  {
    name: 'C0 이메일 입력',
    screen: 'ChildLogin',
    variant: 'form',
    audience: 'child',
    dock: {primary: {label: copy.login.send, onPress: noop}},
  },
  {
    name: 'C2 재연결 번호(번호 보내기 + 돌아가기)',
    screen: 'CodeShow',
    variant: 'form',
    audience: 'child',
    dock: {primary: {label: copy.code.send, onPress: noop}, secondary: {label: copy.code.wait, onPress: noop}},
  },
  {
    name: 'P9·C8 계정 지우기(안 지울래요 + 위험 외곽선, 어르신)',
    screen: 'DeleteAccountScreen',
    variant: 'form',
    audience: 'elder',
    dock: {primary: {label: copy.delete.parent.cancel, onPress: noop}, secondary: {kind: 'danger', label: copy.delete.parent.yes, onPress: noop}},
  },
  {
    name: 'C8 계정 지우기(자녀)',
    screen: 'DeleteAccountScreen',
    variant: 'form',
    audience: 'child',
    dock: {primary: {label: copy.delete.child.cancel, onPress: noop}, secondary: {kind: 'danger', label: copy.delete.child.danger, onPress: noop}},
  },
  {
    name: '계정 지운 뒤(처음으로)',
    screen: 'DeleteDoneScreen',
    variant: 'form',
    audience: 'elder',
    dock: {primary: {label: copy.delete.parent.back, onPress: noop}},
  },
  {
    name: 'CG 어르신 폰 막음(알겠어요 하나)',
    screen: 'ChildGate',
    variant: 'form',
    audience: 'child',
    dock: {primary: {label: copy.login.blocked_parent_device.button, onPress: noop}},
  },
  {
    name: 'C1 호칭 고르기(번호 만들기 하나)',
    screen: 'RelationScreen',
    variant: 'form',
    audience: 'child',
    dock: {primary: {label: copy.relation.next, onPress: noop}},
  },
  {
    name: 'C3 연결 기다리는 중(번호 보내기 + 복사하기)',
    screen: 'ChildWaitScreen',
    variant: 'step',
    audience: 'child',
    dock: {primary: {label: copy.child.wait.resend, onPress: noop}, secondary: {kind: 'text', label: copy.child.wait.copy, onPress: noop}},
  },
  {
    name: 'P2 동의(좋아요 + 싫어요 같은 높이, 150% 이상은 본문 끝 — N-12)',
    screen: 'ConsentScreen',
    variant: 'intro',
    audience: 'elder',
    dock: {primary: {label: copy.consent.accept, onPress: noop}, secondary: {label: copy.consent.decline, onPress: noop}, even: true},
  },
  {
    name: 'P7 완료(알겠어요)',
    screen: 'CourseDone',
    variant: 'step',
    audience: 'elder',
    dock: {primary: {label: copy.done.button, onPress: noop}},
  },
  {
    name: 'P4 사진 보기(다 봤어요 하나, 시안 ds4c)',
    screen: 'PhotoStep',
    variant: 'step',
    audience: 'elder',
    dock: {primary: {label: copy.course.next.photo, onPress: noop}},
  },
  {
    name: 'P5 둘 중 고르기(정했어요, 비활성 이유 포함)',
    screen: 'QuestionStep',
    variant: 'step',
    audience: 'elder',
    dock: {primary: {label: copy.course.next.question, onPress: noop, disabled: true, disabledReason: copy.question.need_choice}},
  },
  {
    name: 'P6 자판 쓰기(비활성 이유 포함)',
    screen: 'KeyboardStep',
    variant: 'step',
    audience: 'elder',
    dock: {
      primary: {label: copy.keyboard.finish, onPress: noop, disabled: true, disabledReason: copy.keyboard.sub},
      note: {text: copy.course.to_home, onPress: noop},
    },
  },
  {
    name: 'P5 따라 쓰기',
    screen: 'HangulStep',
    variant: 'step',
    audience: 'elder',
    dock: {primary: {label: copy.course.next.hangul, onPress: noop}, note: {text: copy.course.to_home, onPress: noop}},
  },
];

const SIZES = [
  {width: 320, height: 640},
  {width: 360, height: 780},
];
const SCALES = [1, 1.3, 1.5, 2];

describe('Dock 예산(320×640·360×780 × 1.0~2.0)', () => {
  test.each(DOCK_CASES.map(c => [c.name, c] as const))('%s: 보낼 슬롯을 보낸 뒤 상한 안', (_n, c) => {
    const over: string[] = [];
    for (const s of SIZES) {
      for (const fontScale of SCALES) {
        // DsScreen 과 같은 비율: SocialGroup 이면 0.4(R-12, 리뷰 M1), 아니면 variant
        const r = planDock(c.dock, {...s, fontScale, audience: c.audience}, dockRatioFor(c.variant, c.dock));
        if (!r.fits) {
          over.push(`${s.width}×${s.height} ×${fontScale}: ${Math.round(r.total)} > ${r.cap} (spill ${r.spill})`);
        }
      }
    }
    expect(over).toEqual([]);
  });

  test('C0 로그인(SocialGroup)은 0.4 로 재고, 200%에서는 이메일 링크가 본문으로 간다(B1 모양 금지)', () => {
    const c0 = DOCK_CASES[0];
    expect(dockRatioFor(c0.variant, c0.dock)).toBe(0.4);
    const r = planDock(c0.dock, {width: 320, height: 640, fontScale: 2, audience: 'child'}, dockRatioFor(c0.variant, c0.dock));
    expect(r.cap).toBe(256);
    expect(r.spill).toBeGreaterThanOrEqual(1);
    expect(r.fits).toBe(true);
  });

  test('과적한 Dock 은 이 테스트가 실패로 잡는다(장치 확인)', () => {
    const stuffed: DockProps = {
      primary: {label: '아주 아주 긴 주 버튼 문구가 여러 줄로 넘어가서 상한을 넘어요 정말 길어요', onPress: noop, disabled: true, disabledReason: '이유도 아주 길게 여러 줄로 써 두었어요 그래서 더 커져요'},
      secondary: {label: '보조', onPress: noop},
    };
    const r = planDock(stuffed, {width: 320, height: 640, fontScale: 2, audience: 'elder'});
    expect(r.fits).toBe(false);
  });
});

describe('사례 누락', () => {
  // src 안에서 <DsScreen ... dock= 를 쓰는 화면 파일은 DOCK_CASES 에 screen 이름이 있어야 한다
  function files(dir: string): string[] {
    return fs.readdirSync(dir, {withFileTypes: true}).flatMap(d => {
      const p = path.join(dir, d.name);
      return d.isDirectory() ? files(p) : /\.tsx$/.test(d.name) ? [p] : [];
    });
  }
  test('DsScreen dock 을 쓰는 화면은 모두 예산 사례가 있다', () => {
    const src = path.join(__dirname, '../src');
    const users = files(src)
      .filter(f => !f.includes('/src/ui/'))
      .filter(f => /<DsScreen[\s\S]*?\bdock=/.test(fs.readFileSync(f, 'utf8')))
      .map(f => path.relative(src, f).replace(/^.*\//, '').replace(/\.tsx$/, ''));
    const known = new Set(DOCK_CASES.map(c => c.screen));
    expect(users.filter(u => !known.has(u))).toEqual([]);
  });
});
