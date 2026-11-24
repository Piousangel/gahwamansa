import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Image, Pressable, StyleSheet, useWindowDimensions, View} from 'react-native';
import {StepHeader} from './StepHeader';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {Button, DsScreen, Text, useAudience, type DockProps} from '../../ui/ds';
import {AiNotice} from '../../ui/AiNotice';
import {FoldStack} from '../../ui/FoldStack';
import {shadow} from '../../ui/tokens';
import {ds, roleText} from '../../ui/ds/roles';
import {useBackAction} from '../../app/BackBar';
import {Icon} from '../../ui/assets/icons';
import {useSession} from '../../app/session';
import {appCopy, copy} from '../../copy/copy';
import {StepErrorBanner, stepErrorDock, useErrorTop} from './StepError';
import {stepA11y} from './StepHeader';
import {useFinishStep, useStepStarted} from './useFinishStep';
import {PhotoZoom} from './PhotoZoom';
import {ReadAloudNotice, ttsText, useReadAloudAction} from './ReadAloud';
import {track} from '../track';
import {kstYmd} from './stamps';
import {prefs} from '../../lib/prefs';
import {focusLater} from '../../ui/screenTitle';
import {photoFit, photoFrame} from './photoFrame';
import {usePhotoLoad} from './usePhotoLoad';

// review: 코스를 다 마친 뒤 '오늘 코스 다시 보기'(시안 P3 v4 B, 기능 회의 B2). 보기 전용 — 기록 호출 없음, 하단은 '돌아가기'.
export function PhotoStep({navigation, route}: NativeStackScreenProps<ParentParams, 'PhotoStep'>) {
  const review = !!route.params?.review;
  // 코스 진행 중 이전(바·하드웨어 뒤로가기): 확인 없이 코스 홈으로
  const toCourseHome = useCallback(() => navigation.popTo('CourseHome'), [navigation]);
  useBackAction(toCourseHome);
  const {finish, error, busy} = useFinishStep();
  const errorTop = useErrorTop(error);
  useStepStarted('photo', review); // AC-05
  const [zoom, setZoom] = useState(false);
  const [reading, setReading] = useState(false); // 읽어 주는 중: 읽는 글에 옅은 하늘 면
  const [hint, setHint] = useState(false);
  const polaroidRef = useRef<React.ComponentRef<typeof View>>(null);
  const {api, content} = useSession();
  // B1: 사진을 다 불러왔을 때만 크게 보기 진입(못 불러왔으면 진입 없음). 상태는 사진 주소에 묶임(#234 L2)
  const {aspect, loaded, failed: imageFailed, onLoad, onError} = usePhotoLoad(content?.photo?.image_url);
  // B1 첫 안내(DZ-06): 크게 보기를 한 번 열 때까지, 열지 않아도 P4 세 번째 방문까지만. 시간으로 사라지지 않는다.
  // 방문은 진행 모드 첫 진입만 센다(같은 날 다시 들어온 것·보기 전용은 세지 않음, 리뷰 L3)
  useEffect(() => {
    let alive = true;
    const visits = review ? prefs().photoVisits() : prefs().countPhotoVisit(kstYmd());
    Promise.all([prefs().zoomOpened(), visits]).then(([opened, n]) => {
      if (alive) {
        setHint(!opened && n <= 3);
      }
    });
    return () => {
      alive = false;
    };
  }, [review]);
  // 사진은 둘레 카드 없이 본문 폭을 채우고 원본 비율 그대로(photoFrame). 오너 S25 11-24: 옛 고정 높이(124/88/80) + cover 는
  // 사진을 가로 띠처럼 잘랐다. 높이 상한 = 창 높이 45%, 그리고 글자 150% 미만에서는 '질문 첫 문장까지 첫 화면'(fit, viewport 실측).
  // 단 fit 은 바닥(폭 50%·160 중 큰 값) 아래로 내리지 않는다 — 작은 화면에서 바닥에 닿으면 사진을 우선하고 질문은 접힘 아래로 간다.
  // 200%는 사진을 줄이지 않고 본문 스크롤(질문 첫 문장 보장 없음). 큰 글자에서는 사진 설명 줄을 '읽어 주세요' 아래로 미룬다
  const {fontScale, width: winW, height: winH} = useWindowDimensions();
  const large = fontScale >= 1.5;
  const audience = useAudience();
  const gap = large ? P4_LAYOUT.gap.large : P4_LAYOUT.gap.base;
  const [boxW, setBoxW] = useState(0); // 사진 칸(본문) 폭 — 그리기 전에는 창 폭에서 본문 좌우 여백을 뺀 값으로 어림
  const [viewport, setViewport] = useState(0); // R-15: 접힘에 걸치는 요소는 통째로 아래로(FoldStack)
  // 첫 화면 맞춤 실측(사진 위 끝·AI 고지·질문 첫 문장 높이). 모두 사진 높이와 무관한 값이고 같으면 setState 하지 않는다 — 측정 → 줄임 → 재측정 반복·튐 없음.
  // 질문은 문장마다 접힘 단위라(R-15, 걸치면 통째로 밀림) 첫 줄이 아니라 첫 문장 전체 높이를 남긴다. 아직 못 쟀으면 한 줄 높이로 어림
  const [measure, setMeasure] = useState<{photoTop: number; notice: number; q0: number | null} | null>(null);
  const onMeasure = useCallback(
    (top: number, h: Readonly<Record<string, number>>) => {
      if (h.header === undefined) {
        return;
      }
      const above = ['error', 'header'].filter(k => h[k] !== undefined);
      const photoTop = top + above.reduce((y, k) => y + h[k], 0) + gap * above.length;
      const notice = h.ai ?? 0;
      const q0 = h.q0 ?? null;
      setMeasure(prev => (prev && prev.photoTop === photoTop && prev.notice === notice && prev.q0 === q0 ? prev : {photoTop, notice, q0}));
    },
    [gap],
  );
  const oneLine = Number(roleText('bodyLg', audience).style.lineHeight ?? 0) * fontScale; // 글자 확대만큼 줄 높이도 커진다
  const fitH = !large && measure ? photoFit(viewport, measure.photoTop, gap, measure.notice, measure.q0 ?? oneLine) : undefined;
  const frame = photoFrame(boxW || Math.max(0, winW - ds.space.screenX[audience] * 2), aspect, winH, fitH);
  // 100%라도 질문이 길어 '읽어 주세요'가 첫 화면에 못 들면 설명 줄을 읽어 주세요 아래로(200% 순서, 시안 '질문·읽어 주세요가 첫 화면')
  // 정한 순서는 그 화면 크기·배율에서만 유지(창이 바뀌면 다시 잰다)
  const fit = `${viewport}|${large}`;
  const [lateFor, setLateFor] = useState<string | null>(null);
  const onFold = useCallback(
    (key: string | null) => {
      if (key === 'read' || /^q\d+$/.test(key ?? '')) {
        setLateFor(fit);
      }
    },
    [fit],
  );
  const late = large || lateFor === fit;
  const photo = content?.photo;
  // 회상 질문은 첫 질문 1개만 보이고 읽는다(DECISIONS 11-25 R-2 시작 빌드 다듬기). 콘텐츠는 그대로 두고 앱에서만 줄인다
  const questions = photo ? photo.recall_questions.slice(0, 1) : [];
  const read = useReadAloudAction(ttsText.photo(questions), setReading);
  if (!photo) {
    return null;
  }
  const showImage = !photo.image_url.startsWith('pending://') && !imageFailed;
  const canZoom = showImage && loaded;
  const openZoom = () => {
    setZoom(true);
    setHint(false);
    prefs().markZoomOpened();
    if (!review) {
      track(api, 'photo_zoom_opened', {day_index: content?.day_index ?? 0}); // 0034. 보기 전용은 계측 0(리드 결정, 리뷰 M2)
    }
  };
  const closeZoom = () => {
    setZoom(false);
    focusLater(() => polaroidRef.current); // 닫히면 사진으로 포커스 복귀
  };
  const go = async () => {
    if (await finish('photo')) {
      navigation.popTo('CourseHome'); // 쌓인 코스 홈으로 돌아간다(v7 navigate 는 새로 쌓을 수 있음)
    }
  };
  const readable = read.allowed && questions.length > 0;
  // 시안 P4_photo_ds4c(사진 중심 안): 위 BackLink '오늘 코스로'(U-8: 하단 링크 없음), 단계 제목 한 줄 → 큰 사진(안에 'AI가 만든 그림' 칩)
  // → 사진 설명 한 줄(없는 날은 없음) → 회상 질문 → '읽어 주세요'(질문 바로 아래 본문 보조) → 천천히 보세요. Dock 은 '다 봤어요' 하나.
  // 100%(글자 150% 미만): 단계·사진·AI 고지·질문 첫 문장이 첫 화면(fit) — 단 사진이 바닥(폭 50%·160)에 닿는 작은 화면은 사진 우선, 질문은 접힘 아래.
  // '읽어 주세요'는 첫 화면 보장 없음(사진이 커져서). 200%: 사진 상한은 100%와 같고 설명 줄은 읽어 주세요 아래, 나머지는 스크롤.
  const dock: DockProps = review
    ? {primary: {label: copy.review.back, accessibilityHint: copy.nav.back_course_a11y, onPress: toCourseHome}}
    : error
      ? stepErrorDock(error, go)
      : {primary: {label: copy.course.next.photo, loading: busy, onPress: go}};
  const aiNotice = `${appCopy.ai_photo_label}·${appCopy.not_real_place}`; // 가운뎃점 둘레 공백 없음(Noto 재렌더 #162, 리드 11-20: 360 폭 한 줄)
  const pendingText = imageFailed ? appCopy.photo_load_failed : appCopy.photo_placeholder;
  const caption = photo.caption ? <Text key="caption" testID="photo-caption" role="label">{photo.caption}</Text> : null;
  return (
    <DsScreen
      variant="step"
      back={{to: copy.course.to_home, onPress: toCourseHome}}
      stepInfo={stepA11y(copy.course.step.photo, 1, review)}
      scrollRef={errorTop}
      onViewport={setViewport}
      dock={dock}>
      {/* split="photo": 큰 사진이 첫 화면 끝에 걸쳐도 통째로 밀지 않는다(밀면 첫 화면에 단계 제목만 남는다). 사진은 스크롤로 이어 본다 */}
      <FoldStack viewport={viewport} gap={gap} testID="p4-body" onFold={onFold} onMeasure={onMeasure} split="photo">
        {!review && error ? <StepErrorBanner key="error" error={error} /> : null}
        <StepHeader key="header" name={copy.course.step.photo} n={1} review={review} compact={large} />
        {/* B1: 사진 전체가 누름 영역. 읽기 '오늘 사진, {caption}, AI가 만든 그림' + 힌트 '크게 보기'(copy 11-17: 두 번 누르라는 말은 TalkBack이 따로 읽음) */}
        {/* 바깥 칸은 본문 폭을 재는 자리(사진 틀이 좁아져도 폭 측정이 흔들리지 않게), 사진 틀은 그 안 가운데 */}
        <View key="photo" testID="photo-box" onLayout={e => setBoxW(Math.round(e.nativeEvent.layout.width))}>
          <Pressable
            ref={polaroidRef}
            testID="photo-polaroid"
            disabled={!canZoom}
            accessible={canZoom}
            accessibilityRole={canZoom ? 'button' : undefined}
            accessibilityLabel={canZoom ? copy.photo.zoom_open_a11y.split('{caption}').join(photo.caption) : undefined}
            accessibilityHint={canZoom ? copy.photo.zoom_open_hint : undefined}
            onPress={openZoom}
            style={[styles.photo, frame]}>
            {photo.image_url.startsWith('pending://') || imageFailed ? (
              // 사진 준비 중·불러오기 실패: 개발용 상자가 아니라 디자인된 빈 사진 칸(옅은 면 + 사진 아이콘 + 안내)
              <View style={styles.pending}>
                <Icon name="icon-photo" size={large ? 28 : 36} color={ds.color.inkSub} />
                {/* 큰 글자에서는 안내 글이 사진 칸을 넘을 수 있어 칸 바로 아래 한 줄로 */}
                {large ? null : <Text role="sub" tone="muted" style={styles.center}>{pendingText}</Text>}
              </View>
            ) : (
              <Image
                testID="photo-image"
                source={{uri: photo.image_url}}
                resizeMode="contain" // 틀이 사진 비율과 같아 잘리지 않는다(비율을 알기 전 기본 틀에서도 잘라 내지 않게 contain)
                style={styles.image}
                // AI 고지는 바로 아래 보이는 줄이 따로 읽힌다(같은 말을 두 번 읽지 않게)
                accessibilityLabel={photo.caption || appCopy.ai_photo_label}
                onLoad={onLoad}
                onError={onError}
              />
            )}
          </Pressable>
        </View>
        {/* AI 고지(디자인 #95 최종): 칩 없이 사진 바로 아래 고정 한 줄. 설명 유무와 상관없이 같은 자리, 실제 사진일 때만 */}
        {showImage ? <AiNotice key="ai" text={aiNotice} /> : null}
        {large && !showImage ? <Text key="pending" role="sub" tone="muted">{pendingText}</Text> : null}
        {late ? null : caption}
        {/* 회상 질문: 모든 배율에서 문장마다 한 덩어리(R-15) — 접힘에 걸치면 그 문장만 아래로 민다. 한 덩어리로 두면 320 폭 100%에서
            세 줄 묶음이 통째로 밀려 질문이 첫 화면에서 사라졌다(에뮬레이터 실측 11-20, 시안 레드라인 '질문 첫 문장이 첫 화면') */}
        {questions.map((q, i) => (
          <View key={`q${i}`} testID={i === 0 ? 'recall-questions' : undefined} style={[styles.readBar, reading ? styles.reading : null]}>
            <Text role="bodyLg">{q}</Text>
          </View>
        ))}
        {/* AP-03 읽어 주기: 질문 바로 아래 본문 보조 버튼(가로 채움). 화면 읽기 켜짐이면 없음(R16) */}
        {readable ? (
          <View key="read" testID="read-aloud" style={styles.read}>
            <Button kind="secondary" label={read.label} loading={read.busy} onPress={read.onPress} />
            <ReadAloudNotice notice={read.notice} />
          </View>
        ) : null}
        {/* 크게 보기 첫 안내(첫 3회)는 질문·읽어 주세요 아래: 시안 레드라인(질문 첫 문장이 첫 화면)을 안내 줄이 밀지 않게(에뮬레이터 실측 11-20) */}
        {canZoom && hint ? <Text key="zoom-hint" testID="zoom-hint" role="body">{copy.photo.zoom_hint}</Text> : null}
        {late ? caption : null}

        <Text key="look" role="sub" tone="muted">{appCopy.photo_look}</Text>
      </FoldStack>
      {/* 크게 보기(Modal)는 묶음 밖: 높이 0 인 자식에 간격이 붙어 사진을 불러온 뒤 내용이 내려가지 않게(PR #91 리뷰 M2) */}
      {canZoom ? <PhotoZoom visible={zoom} uri={photo.image_url} caption={photo.caption} onClose={closeZoom} /> : null}
    </DsScreen>
  );
}

/** P4 배치 값 한 곳. 사진 틀 크기는 photoFrame(원본 비율, 오너 S25 11-24 — 옛 고정 높이 124/88/80 폐기). 본문 간격 8 / 6.
 *  시안의 질문 사이 2(100%)는 쓰지 않는다: 질문을 문장마다 접힘 단위로 나눠 본문 간격(8)을 쓴다(위 주석) */
export const P4_LAYOUT = {gap: {base: 8, large: 6}} as const;

// 사진(시안 ds4c): 둘레 카드·테두리 없이 반경 22 + 그림자. 본문 간격은 P4_LAYOUT.gap — FoldStack gap
const styles = StyleSheet.create({
  // 읽어 주는 중 표시: 옅은 하늘 면(글 폭·줄바꿈이 움직이지 않게 여백 없이 면만, 리뷰). 글자 inkBody 는 infoSoft 위 허용 짝
  readBar: {borderRadius: 8},
  reading: {backgroundColor: ds.color.infoSoft},
  photo: {alignSelf: 'center', borderRadius: ds.radius.card, overflow: 'hidden', backgroundColor: ds.color.paperSoft, boxShadow: shadow.lifted},
  image: {flex: 1, alignSelf: 'stretch'},
  read: {gap: 8},
  center: {textAlign: 'center'},
  pending: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 8},
});
