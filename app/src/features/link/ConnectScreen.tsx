import React, {useEffect, useRef, useState} from 'react';
import {LayoutChangeEvent, StyleSheet, useWindowDimensions, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Icon} from '../../ui/assets/icons';
import {focusLater} from '../../ui/screenTitle';
import {CommonActions} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useSession} from '../../app/session';
import {Screen, SCREEN_FADE_H, type ScreenScroll} from '../../ui/Screen';
import {color, layout, radius} from '../../ui/tokens';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {CodeEntry} from './CodeEntry';
import {TextLink} from './TextLink';
import {BackBar} from '../../app/BackBar';
import {formatCode} from '../../ui/codeInputLogic';
import {firstBlockGuess, keyFor, pickStage, type Stage} from './p1Stage';
import {KEY_MIN, KEYS_GAP_MAX} from './keypadFit';
import {copy, offlineMessage, reasonToMessage, withTitle, Message} from '../../copy/copy';
import {useConnectFlow} from './useConnectFlow';
import {LegalText} from '../../ui/LegalText';
import {Banner} from '../../ui/Banner';
import {legalLinks, useLegalOpen} from '../../shared/legalLinks';
import {consumeInvite, subscribeInvite} from '../../lib/linkSources';
import type {Prefill} from './useConnectFlow';
import type {ConnectState, FailKind} from './connectMachine';

// 안내 패널 문구: 번호 문제는 기존 확정 문구(5절, copy-v3 11-3 "P1c 만료·사용됨" 재사용), 잠김은 rate_limited, 인터넷·서버는 공통
function failMessage(reason: FailKind): Message {
  if (reason === 'offline') {
    return offlineMessage;
  }
  if (reason === 'server') {
    return copy.errors.server;
  }
  return reasonToMessage(reason === 'locked' ? 'rate_limited' : reason);
}

// 번호 칸 묶음 읽기(라이터 확정 11-2 #12)
function groupA11y(code: string): string {
  const g = copy.connect.code_group_a11y;
  return code.length === 0 ? g.empty : code.length >= 6 ? g.full : g.partial.split('{n}').join(String(code.length));
}

// 약관 한 줄(11-1 #1). 감사 M7: 두 낱말은 링크 모양(주소가 정해지면, ⑥a 방침 호스팅)
// legal 을 넘기면(번호 화면) 확인 중 줄·오프라인 Banner 는 호출부가 본문에 둔다(재확인 6 L27: 하단 고정을 키워 키패드 판정을 흔들지 않게)
function LegalLine({legal: given}: {legal?: ReturnType<typeof useLegalOpen>}) {
  const own = useLegalOpen(); // 앱 안 웹 화면(재확인 3 M5), 안 닿으면 Banner(재확인 4 M7, 앱 정보 행과 같은 모양)
  const legal = given ?? own;
  return (
    <>
      <LegalText testID="legal-line" style={styles.legal} text={copy.legal.agree_parent} links={legalLinks()} onOpen={legal.open} />
      {/* 재확인 6 L23: 연결 확인(최대 4초) 동안 진행 한 줄 */}
      {!given && legal.busy ? <Text20 testID="legal-busy" style={styles.legal} accessibilityLiveRegion="polite">{copy.app.loading}</Text20> : null}
      {!given && legal.offline ? <Banner testID="legal-offline" kind="offline" text={copy.app_info.link_offline} /> : null}
    </>
  );
}

// P1 번호 쓰기 v4 + P1c 연결 확인(시안 P1_connect_v4·P1c_confirm, ease-and-joy A④⑤). 문구는 copy-v3 11절 우선.
// 6자리를 다 쓰면 300ms 뒤 저절로 확인("다음" 없음), 맞으면 누가 보낸 번호인지 보여 주고 [이 번호로 연결하기]를 눌러야 연결(자동 연결 금지).
// 맞지 않으면 숫자는 그대로 두고 칸 아래 한 줄. 상태 전이는 connectMachine·useConnectFlow.
export function ConnectScreen({navigation, route}: NativeStackScreenProps<ParentParams, 'Connect'>) {
  const {api, resetRole} = useSession();
  // 코스 홈·설정에서 "번호 쓰기"로 왔으면 이전은 그 화면으로, 처음 화면에서 왔으면 역할 선택으로(QA B2)
  const fromCourse = route.params?.from === 'course';
  const back = fromCourse ? () => navigation.goBack() : resetRole;
  // 번호가 맞으면 스택을 [번호, 동의]로 정리한다(코스 홈에서 왔어도 미리보기 코스 홈·번호 화면이 뒤에 남지 않게, 리뷰 ③)
  const toConsent = () => navigation.dispatch(CommonActions.reset({index: 1, routes: [{name: 'Connect'}, {name: 'Consent'}]}));
  // 밖에서 들어온 번호: 처음엔 경로 값, 화면이 떠 있는 동안 새 링크가 오면 그 번호(AP-09, 리뷰 H1).
  // initialParams 는 경로를 처음 만들 때만 쓰이므로 링크 저장소를 직접 구독한다. 지금 값(구독 즉시 1회)·지움(visible false)은 무시
  const [prefill, setPrefill] = useState<Prefill | undefined>(route.params?.prefill);
  useEffect(() => {
    let first = true;
    const off = subscribeInvite(b => {
      if (!first && b.visible && b.code && b.source) {
        const next = {code: b.code, source: b.source};
        setPrefill(prev => (prev && prev.code === next.code && prev.source === next.source ? prev : next));
      }
    });
    first = false;
    return off;
  }, []);
  const flow = useConnectFlow(api, prefill);
  const {state, edit, redeem, retry} = flow;
  // 미리 채운 번호는 한 번 쓰면 기기에서 지운다(연결됨·쓸 수 없는 번호·다른 번호 쓰기). 띠도 함께 사라진다.
  // 실패는 그 번호의 결과일 때만(연결 중 새 링크가 와 있으면 그 새 번호는 지우지 않고 실패 뒤에 적용, 리뷰 M1)
  const prefillDone =
    !!prefill &&
    (state.kind === 'ok' ||
      (state.kind === 'failed' && state.code === prefill.code && (state.reason === 'expired' || state.reason === 'used' || state.reason === 'not_parent_device' || state.reason === 'already_linked')) ||
      (state.kind === 'idle' && state.inline === 'invalid' && state.code === prefill.code));
  useEffect(() => {
    if (prefillDone) {
      consumeInvite().catch(() => {});
    }
  }, [prefillDone]);
  const other = () => {
    if (prefill && state.kind !== 'redeeming') {
      consumeInvite().catch(() => {});
    }
    flow.other();
  };

  // 공간 단계(디자인 9절 H3, b2cc65d): 0 그대로 → 1 제목 28→22 → 2 약관 줄 본문 끝 → 3 링크 줄도 키패드 아래(하단 고정 없음)
  //   → 4 키 64 + 보통 배치·묶음 간격 12. 판정은 순수 함수 pickStage(창·글자 배율·inset·문구, 표 __tests__/p1Stage.test.ts).
  //   실측 기대(에뮬레이터 p1-fit 11-19, dev-app-notes 표): 411×914 0단계, 360×740 3단계, 360×640·320×640 4단계, 글자 2.0 은 4단계.
  //   9절 적용 범위(리드 결정 11-19): '칸 + 키 1~9 첫 화면'은 글자 150%까지, 200%는 '모든 키를 스크롤로 누를 수 있음'.
  // 안전망(리드 결정 11-19): 본문은 단계와 상관없이 늘 스크롤할 수 있다. 0·1단계도 내용이 창보다 크면 저절로 스크롤되고, 맞으면 스크롤이 없다.
  //   키패드는 띄워 두지 않고(overflow hidden 없음) 보통 배치라 어림이 틀려도 키가 잘리지 않는다(최악이어도 '0' 줄을 스크롤로 누른다).
  // 사후 검증(재확인 4 H5): 그린 뒤 첫 화면 묶음이 예정 높이보다 크면(넘침) ① 잰 넘침만큼 키 높이를 줄이고(64 이상이면 그 단계 유지)
  //   ② 64로도 안 되면 한 단계 올리고 ③ 그래도 넘치면 4단계. 올리기만 하고 최대 2회라 진동이 없다. 이벤트가 안 와도 지금 단계 그대로(안전망이 받친다).
  const {height: winH, width: winW, fontScale} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const input = {
    windowH: winH,
    windowW: winW,
    fontScale,
    insets: {top: insets.top, bottom: insets.bottom},
    text: {
      title: copy.connect.title,
      safe: copy.safe.money,
      below: copy.connect.auto_hint,
      legal: copy.legal.agree_parent,
      links: [copy.connect.no_code_link, copy.connect.view_course] as [string, string],
    },
  };
  const picked = pickStage(input);
  const inputKey = `${winH}|${winW}|${fontScale}|${insets.top}|${insets.bottom}`;
  // 사후 검증 결과(판정 입력이 바뀌면 무효): bumps 0~2, key = 그 단계에서 줄인 키 높이
  const [adj, setAdj] = useState<{for: string; bumps: number; key?: {level: number; k: number}} | null>(null);
  const a = adj?.for === inputKey ? adj : null;
  const bumps = a?.bumps ?? 0;
  const level = (bumps === 0 ? picked.level : bumps === 1 ? Math.min(4, picked.level + 1) : 4) as Stage['level'];
  const baseKey = level === picked.level ? picked.keyH : keyFor(level, input);
  const keyH = level >= 4 ? KEY_MIN : a?.key && a.key.level === level ? a.key.k : baseKey;
  const [help, setHelp] = useState(false);
  const legal = useLegalOpen(); // 약관 줄 링크(앱 안 웹 화면), 오프라인 Banner 는 본문에(L27)
  const legalInBody = level >= 2;
  const noDock = level >= 3;
  const overflow = level >= 4;
  const scroll = level >= 2;
  const scrollRef = useRef<ScreenScroll>(null);
  // 첫 화면 묶음의 예정 높이: 0·1단계 = 창 − 위 여백 − 아래 여백, 2·3단계 = 창 − 위 여백 − 흐림(− 하단 고정 없으면 아래 inset).
  // 잰 본문 창이 있으면 그것, 없으면 같은 식의 어림(그리기용. 판정은 pickStage)
  const dockConfig = noDock ? 2 : legalInBody ? 1 : 0;
  const [view, setView] = useState<{h: number; dock: number; for: string} | null>(null);
  const viewH = view && view.dock === dockConfig && view.for === inputKey ? view.h : 0; // 다른 구성·다른 판정 입력에서 잰 창은 쓰지 않는다
  const firstH = viewH > 0 ? Math.max(0, viewH - FIRST_PAD - SCREEN_FADE_H - (noDock ? insets.bottom : 0)) : firstBlockGuess(level, input);
  const fillExpected = viewH > 0 ? viewH - FIRST_PAD - BODY_BOTTOM : 0;
  const onViewport = (h: number) => setView(v => (v && v.h === h && v.dock === dockConfig && v.for === inputKey ? v : {h, dock: dockConfig, for: inputKey}));

  // 재확인 5 M9: 넘침은 묶음 컨테이너 높이(minHeight·flexGrow 로 늘어난 값)가 아니라 **내용 높이**로 잰다.
  //   내용 아래 끝 = 키패드 영역의 위치 y(제목·안심 줄 높이로만 정해짐) + 키패드 실제 높이(키 높이로만 정해짐).
  //   둘 다 창 높이·어림 minHeight·하단 고정(오프라인 Banner 등)과 무관하므로, 창이 바뀌어도 옛 컨테이너 높이로 잘못 판정하지 않는다.
  // 재확인 6 L26: 영역 y 는 제목 크기(0단계 28 / 1단계 이상 22)·묶음 간격(4단계 12)에만 달려 있다 → 단계 대신 그 '모양'을 기록한다
  const areaShape = level === 0 ? 0 : level >= 4 ? 2 : 1;
  const [areaAt, setAreaAt] = useState<{y: number; shape: number; for: string} | null>(null);
  const [pad, setPad] = useState<{h: number; keyH: number; for: string} | null>(null);
  useEffect(() => {
    if (overflow || viewH === 0 || !areaAt || !pad) {
      return;
    }
    if (areaAt.for !== inputKey || areaAt.shape !== areaShape || pad.for !== inputKey || pad.keyH !== keyH) {
      return; // 지금 판정 입력·단계·키 높이로 그린 내용일 때만
    }
    const expected = scroll ? firstH : fillExpected; // 첫 화면 묶음이 차지할 수 있는 높이(이 구성의 창 기준)
    const over = areaAt.y + pad.h - expected;
    if (over <= 1) {
      return;
    }
    const k = Math.floor(keyH - over / 4); // 넘친 만큼 키 4줄에서 덜어 낸다(키패드 나머지 높이는 실제 그대로)
    if (k >= KEY_MIN && k < keyH) {
      setAdj({for: inputKey, bumps, key: {level, k}});
    } else {
      setAdj({for: inputKey, bumps: Math.min(2, bumps + 1)});
    }
  }, [areaAt, pad, level, areaShape, keyH, viewH, overflow, scroll, firstH, fillExpected, inputKey, bumps]);
  // 디자인 결정(11-19, 키패드 남는 높이): 키는 늘리지 않는다(64~68, 모든 줄 같은 높이). 키패드 영역에 남는 높이는
  //   ① 칸(과 칸 아래 줄)과 키 사이 여백에 최대 24 → ② 그래도 남으면 키패드 묶음 위·아래로 반씩(영역 가운데 정렬).
  //   키패드 내용 높이(pad)는 여백을 뺀 값으로 기록해 여백이 넘침 판정·여백 계산을 흔들지 않는다.
  const [areaH, setAreaH] = useState<{h: number; for: string} | null>(null);
  const spare = !overflow && areaH?.for === inputKey && pad && pad.for === inputKey && pad.keyH === keyH ? areaH.h - pad.h : 0;
  const keysGap = Math.round(Math.min(KEYS_GAP_MAX, Math.max(0, spare)));
  const onArea = (e: LayoutChangeEvent) => {
    const y = e.nativeEvent.layout.y;
    const h = e.nativeEvent.layout.height;
    setAreaAt(cur => (cur && cur.y === y && cur.shape === areaShape && cur.for === inputKey ? cur : {y, shape: areaShape, for: inputKey}));
    setAreaH(cur => (cur && cur.h === h && cur.for === inputKey ? cur : {h, for: inputKey}));
  };
  const onPad = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height - keysGap;
    setPad(v => (v && v.h === h && v.keyH === keyH && v.for === inputKey ? v : {h, keyH, for: inputKey}));
  };

  // 4단계 접힘 경계(리드 결정 L25·디자인 #54, RULES-V4 R-15 '모든 배율에서 접힘 경계는 줄·요소 경계'):
  //   첫 화면 끝(스크롤 창 아래 끝)이 키 줄을 반쯤 가르면, 그 줄 앞에 여백을 넣어 줄 전체를 접힘 밖으로 민다. 키 높이 64 는 그대로.
  //   접힘 바로 위 '더 있음' 흐림(28) 구간에는 키가 걸치지 않게 한다. 줄 위치는 여백을 뺀 값으로 기록해 여백이 판정을 흔들지 않는다.
  const [rows, setRows] = useState<{for: string; key: number; y: Record<number, {y: number; h: number}>} | null>(null);
  const [fold, setFold] = useState<{for: string; before: number; h: number} | null>(null);
  const foldGap = overflow && fold?.for === inputKey ? {before: fold.before, h: fold.h} : undefined;
  const onRowLayout = (row: number, y: number, h: number) => {
    const base = y - (foldGap && row >= foldGap.before ? foldGap.h : 0);
    setRows(cur => {
      const same = cur && cur.for === inputKey && cur.key === keyH;
      const prev = same ? cur.y[row] : undefined;
      if (prev && prev.y === base && prev.h === h) {
        return cur;
      }
      return {for: inputKey, key: keyH, y: {...(same ? cur.y : {}), [row]: {y: base, h}}};
    });
  };
  useEffect(() => {
    if (!overflow || viewH === 0 || !areaAt || areaAt.for !== inputKey || areaAt.shape !== areaShape || !rows || rows.for !== inputKey || rows.key !== keyH) {
      return;
    }
    const top = FIRST_PAD + areaAt.y; // 키패드 위 끝(본문 안 y)
    const foldAt = viewH; // 첫 화면 끝 = 스크롤 창 아래 끝(제스처 막대는 투명해 그 밑 내용도 보인다 — 에뮬레이터 실측 11-19)
    // '더 있음' 흐림 시작. 3버튼 내비(inset 48)는 불투명 버튼이 창 아래를 덮어 그 밑 줄을 누르면 시스템 버튼이 눌린다(재확인 7 M10)
    //   → 흐림과 시스템 버튼 중 큰 쪽 위에서 끝나지 않는 줄은 접힘 밖으로 민다. 제스처 내비(inset 작음)는 28 그대로
    const fadeAt = foldAt - Math.max(SCREEN_FADE_H, insets.bottom);
    let next: {before: number; h: number} | null = null;
    for (const r of [1, 2, 3, 4]) {
      const at = rows.y[r];
      if (!at) {
        return; // 네 줄을 다 잰 뒤에
      }
      const rowTop = top + at.y;
      if (rowTop + at.h > fadeAt) {
        next = rowTop >= foldAt ? null : {before: r, h: Math.ceil(foldAt - rowTop)}; // 반쯤 걸린 줄 → 접힘 밖으로
        break;
      }
    }
    const cur = fold?.for === inputKey ? fold : null;
    if ((next?.before ?? 0) !== (cur?.before ?? 0) || Math.abs((next?.h ?? 0) - (cur?.h ?? 0)) > 1) {
      setFold(next ? {for: inputKey, ...next} : null);
    }
  }, [overflow, viewH, areaAt, areaShape, rows, keyH, inputKey, fold, insets.bottom]);

  const ok = state.kind === 'ok';
  const groupRef = useRef<React.ComponentRef<typeof View>>(null);
  const isInvalid = state.kind === 'idle' && state.inline === 'invalid';
  useEffect(() => (isInvalid ? focusLater(() => groupRef.current) : undefined), [isInvalid]);
  useEffect(() => {
    if (ok) {
      toConsent();
    }
    // 연결되면 한 번만 넘어간다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok]);

  if (state.kind === 'confirm' || state.kind === 'redeeming') {
    // key: 같은 화면 안 분기라도 새 Screen 으로 마운트해 제목에 포커스(talkback R2, 리뷰 M2)
    return <ConfirmView key="confirm" state={state} typed={!prefill || prefill.code !== state.code} onYes={redeem} onOther={other} />;
  }
  if (state.kind === 'failed') {
    const m = failMessage(state.reason);
    const onFailButton = () => {
      if (state.reason === 'already_linked') {
        toConsent();
      } else if (state.reason === 'not_parent_device') {
        resetRole(); // "처음 화면에서 다시 골라 주세요"
      } else {
        retry(); // 인터넷·서버면 같은 단계 다시, 번호 문제면 비우고 번호 쓰기로
      }
    };
    return (
      <Screen key="failed" top={<BackBar onBack={state.step === 'redeem' ? other : back} />} bottom={<BigButton variant="secondary" label={m.button} onPress={onFailButton} />}>
        <View testID="connect-failed" accessibilityLiveRegion="polite" style={styles.failed}>
          <Text20 size={28} weight="bold" accessibilityRole="header" style={styles.title}>{m.title}</Text20>
          <Text20>{m.body}</Text20>
        </View>
      </Screen>
    );
  }

  const checking = state.kind === 'peeking' || ok;
  const invalid = state.kind === 'idle' && state.inline === 'invalid';
  // 칸 바로 아래 한 줄: 기본 안내 / 확인 중 / 맞지 않음(숫자는 그대로).
  // 항상 마운트된 live region 하나에 글만 바꾼다(새로 붙은 노드는 기기에 따라 안 읽힘, 리뷰 M2·R11)
  const below = (
    <View testID="connect-below" accessibilityLiveRegion="polite" style={styles.belowRow}>
      {invalid ? <Icon name="icon-warning" size={24} color={color.dangerInk} /> : null}
      <Text20
        testID={checking ? 'connect-checking' : invalid ? 'connect-invalid' : 'connect-hint'}
        weight={checking || invalid ? 'bold' : undefined}
        style={[styles.flex, checking ? styles.title : invalid ? styles.invalid : styles.sub]}>
        {checking ? copy.connect.checking : invalid ? copy.connect.invalid_inline : copy.connect.auto_hint}
      </Text20>
    </View>
  );
  // 링크 두 개: 가운데 정렬, 간격 24, 64 터치(시안 P1_connect_v4)
  const links = (
    <View testID="connect-links" style={styles.links}>
      <TextLink label={copy.connect.no_code_link} touch={64} onPress={() => setHelp(h => !h)} />
      <TextLink label={copy.connect.view_course} touch={64} onPress={() => (fromCourse ? navigation.popTo('CourseHome') : navigation.navigate('CourseHome'))} />
    </View>
  );

  return (
    <Screen
      key="entry"
      fill={!scroll}
      scrollEnabled
      fillScrollable // 안전망: 0·1단계(fill)도 내용이 창보다 크면 스크롤(맞으면 스크롤이 생기지 않는다)
      dense={overflow}
      onViewport={onViewport}
      scrollRef={scrollRef}
      top={<BackBar onBack={back} />}
      bottom={
        noDock ? undefined : (
          <>
            {links}
            {legalInBody ? null : <LegalLine legal={legal} />}
          </>
        )
      }>
      {/* 첫 화면 묶음: 0·1단계는 본문(fill)을 채우고, 2·3단계는 잰 창 높이로 고정(그 아래 약관·링크는 스크롤 밖), 4단계는 보통 배치 */}
      <View
        testID="connect-first"
        style={[styles.first, overflow ? styles.firstDense : null, scroll && !overflow ? {minHeight: firstH} : null, !scroll ? styles.fillFirst : null]}>
        <Text20 size={level >= 1 ? 22 : 28} weight="bold" accessibilityRole="header" textBreakStrategy="balanced" style={styles.title}>
          {TITLE}
        </Text20>
        {/* 안심 줄은 모든 글자 크기·좁은 화면에서도 유지(UX U4, 동결 시안 P1_connect_v4) */}
        <Text20 testID="connect-safe">{copy.safe.money}</Text20>
        {/* 키패드는 보통 배치(띄우지 않음, 잘라 내지 않음): 남는 높이를 차지하되 키패드보다 작아지지 않는다 → 넘치면 본문이 스크롤된다(안전망) */}
        <View testID="keypad-area" style={overflow ? null : styles.area} onLayout={onArea}>
          {/* 키패드 내용 높이(늘어나지 않는 감싸개)로 넘침을 잰다(재확인 5 M9) */}
          <View testID="keypad-content" onLayout={onPad}>
            <CodeEntry value={state.code} onChange={edit} keyHeight={keyH} groupLabel={groupA11y(state.code)} belowCells={below} groupRef={groupRef} foldGap={foldGap} onRowLayout={onRowLayout} keysGap={keysGap} />
          </View>
        </View>
      </View>
      {/* 스크롤 단계: 읽기·시선 순서 제목 → 안심 줄 → 칸 → 키 → 링크 → 약관(talkback 기준표 P1) */}
      {noDock ? links : null}
      {/* 재리뷰 L2·재확인 4 M6: '번호가 없어요' 안내는 어느 단계에서도 묶음 밖(키패드 아래)에 두고, 열면 보이게 스크롤한다(키 공간을 줄이지 않음) */}
      {help ? (
        // showRange 의 y 는 본문 contentContainer 기준 — 이 줄은 본문 바로 아래 자식이어야 한다(재확인 2 L9)
        <Text20 testID="connect-help" accessibilityLiveRegion="polite" onLayout={e => scrollRef.current?.showRange(e.nativeEvent.layout.y, e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
          {copy.connect.no_code_help}
        </Text20>
      ) : null}
      {legalInBody ? <LegalLine legal={legal} /> : null}
      {/* 재확인 6 L27·L23: 약관 링크 확인 중 줄·오프라인 Banner 는 늘 본문(하단 고정을 키우지 않아 키패드 판정을 흔들지 않음) */}
      {legal.busy ? <Text20 testID="legal-busy" style={styles.legal} accessibilityLiveRegion="polite">{copy.app.loading}</Text20> : null}
      {legal.offline ? (
        <View onLayout={e => scrollRef.current?.showRange(e.nativeEvent.layout.y, e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
          <Banner testID="legal-offline" kind="offline" text={copy.app_info.link_offline} />
        </View>
      ) : null}
    </Screen>
  );
}

// P1c 연결 확인(시안 P1c_confirm): 제목 · 카드({호칭} 폰으로 보낸 번호예요 + 큰 번호) · 안심 줄 / [이 번호로 연결하기] · 약관 줄 · 다른 번호 쓰기
// typed: 손으로 쓴 번호(링크로 받은 번호가 아님) → 제목 '이 번호가 맞나요?', 단서 줄은 '{호칭} 폰으로 만든 번호예요'(copy 11-19, 감사 L6)
function ConfirmView({state, typed, onYes, onOther}: {state: Extract<ConnectState, {kind: 'confirm' | 'redeeming'}>; typed: boolean; onYes: () => void; onOther: () => void}) {
  const c = copy.connect_confirm;
  const busy = state.kind === 'redeeming';
  const a11y = copy.code.show_a11y.split('{앞}').join(state.code.slice(0, 3).split('').join(' ')).split('{뒤}').join(state.code.slice(3).split('').join(' '));
  return (
    <Screen
      top={<BackBar onBack={busy ? noop : onOther} />}
      bottom={
        <>
          <BigButton label={c.yes} loading={busy} loadingLabel={c.busy} onPress={onYes} />
          <LegalLine />
          <View style={styles.links}>
            <TextLink label={c.other} touch={64} disabled={busy} onPress={onOther} />
          </View>
        </>
      }>
      <Text20 size={30} weight="bold" accessibilityRole="header" style={styles.title}>{typed ? c.title_typed : c.title}</Text20>
      <View testID="confirm-card" style={styles.card}>
        {state.title ? (
          <Text20 testID="confirm-from" size={22} style={styles.center}>{withTitle(typed ? c.from_typed : c.from, state.title)}</Text20>
        ) : null}
        <View testID="confirm-code" accessible accessibilityLabel={a11y}>
          <Text20 size={52} weight="bold" style={styles.code}>{formatCode(state.code)}</Text20>
        </View>
      </View>
      <Text20>{copy.safe.money}</Text20>
    </Screen>
  );
}

// "써 주세요"가 갈라져 "주세요"만 다음 줄에 남지 않게 붙인다(QA P1#5)
const TITLE = copy.connect.title.replace('써 주세요', '써\u00A0주세요');
// 연결 중 이전(리뷰 M1): 화면을 바꾸지 않고 하드웨어 뒤로도 삼킨다
const noop = () => {};
// 본문 위 여백(layout.bodyPadding.top). 첫 화면 묶음 = 창 높이 − 이 여백
const FIRST_PAD = layout.bodyPadding.top;
// 0·1단계(Screen fill) 본문 아래 여백 8(ui/Screen styles.fill). 묶음 예정 높이 = 창 − 위 여백 − 이것
const BODY_BOTTOM = 8;

const styles = StyleSheet.create({
  area: {flexGrow: 1, justifyContent: 'center'}, // 남는 높이를 차지하되 키패드보다 작아지지 않는다(줄어들지 않음). 칸·키 사이 여백 뒤 남는 높이는 위·아래 반씩
  first: {gap: 16},
  firstDense: {gap: 12},
  fillFirst: {flexGrow: 1}, // 0·1단계: 창을 채우되 내용보다 작아지지 않는다(넘치면 본문 스크롤)
  links: {flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', columnGap: 24},
  title: {color: color.inkTitle},
  sub: {color: color.inkSub},
  invalid: {color: color.dangerInk},
  legal: {textAlign: 'center', color: color.ink, marginBottom: 4},
  belowRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  flex: {flex: 1},
  failed: {gap: 8},
  card: {backgroundColor: color.card, borderWidth: 3, borderColor: color.action, borderRadius: radius.card, padding: 20, gap: 10},
  center: {textAlign: 'center', color: color.inkTitle},
  code: {letterSpacing: 6, textAlign: 'center', color: color.inkTitle},
});
