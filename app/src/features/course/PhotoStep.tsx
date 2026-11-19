import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Image, Pressable, StyleSheet, useWindowDimensions, View} from 'react-native';
import {StepHeader} from './StepHeader';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {Button, DsScreen, Text, type DockProps} from '../../ui/ds';
import {AiNotice} from '../../ui/AiNotice';
import {FoldStack} from '../../ui/FoldStack';
import {shadow} from '../../ui/tokens';
import {ds} from '../../ui/ds/roles';
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

// review: 코스를 다 마친 뒤 '오늘 코스 다시 보기'(시안 P3 v4 B, 기능 회의 B2). 보기 전용 — 기록 호출 없음, 하단은 '돌아가기'.
export function PhotoStep({navigation, route}: NativeStackScreenProps<ParentParams, 'PhotoStep'>) {
  const review = !!route.params?.review;
  // 코스 진행 중 이전(바·하드웨어 뒤로가기): 확인 없이 코스 홈으로
  const toCourseHome = useCallback(() => navigation.popTo('CourseHome'), [navigation]);
  useBackAction(toCourseHome);
  const {finish, error, busy} = useFinishStep();
  const errorTop = useErrorTop(error);
  useStepStarted('photo', review); // AC-05
  const [imageFailed, setImageFailed] = useState(false);
  const [loaded, setLoaded] = useState(false); // B1: 사진을 다 불러왔을 때만 크게 보기 진입(못 불러왔으면 진입 없음)
  const [zoom, setZoom] = useState(false);
  const [reading, setReading] = useState(false); // 읽어 주는 중: 읽는 글에 옅은 하늘 면
  const [hint, setHint] = useState(false);
  const polaroidRef = useRef<React.ComponentRef<typeof View>>(null);
  const {api, content} = useSession();
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
  // 시안 P4_photo_ds4c(#95 최종): 사진은 둘레 카드 없이 가로를 채운다. 높이는 P4_LAYOUT(설명 없는 날 124 / 있는 날 88, 글자 150% 이상 80 — 200% 보드).
  // 큰 글자에서 질문 첫 문장과 AI 고지가 첫 화면에 들게 사진을 줄이고, 사진 설명 줄은 '읽어 주세요' 아래로 미룬다
  const {fontScale} = useWindowDimensions();
  const large = fontScale >= 1.5;
  const hasCaption = !!content?.photo?.caption;
  const photoH = large ? P4_LAYOUT.photo.large : hasCaption ? P4_LAYOUT.photo.withCaption : P4_LAYOUT.photo.noCaption;
  const [viewport, setViewport] = useState(0); // R-15: 접힘에 걸치는 요소는 통째로 아래로(FoldStack)
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
  const read = useReadAloudAction(photo ? ttsText.photo(photo.recall_questions) : '', setReading);
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
  const readable = read.allowed && photo.recall_questions.length > 0;
  // 시안 P4_photo_ds4c(사진 중심 안): 위 BackLink '오늘 코스로'(U-8: 하단 링크 없음), 단계 제목 한 줄 → 큰 사진(안에 'AI가 만든 그림' 칩)
  // → 사진 설명 한 줄(없는 날은 없음) → 회상 질문 → '읽어 주세요'(질문 바로 아래 본문 보조) → 천천히 보세요. Dock 은 '다 봤어요' 하나.
  // 100%: 사진·단계·질문·읽어 주세요가 첫 화면. 200%: 사진 100, 설명 줄은 읽어 주세요 아래(질문 첫 문장이 첫 화면에).
  const dock: DockProps = review
    ? {primary: {label: copy.review.back, accessibilityHint: copy.nav.back_course_a11y, onPress: toCourseHome}}
    : error
      ? stepErrorDock(error, go)
      : {primary: {label: copy.course.next.photo, loading: busy, onPress: go}};
  const aiNotice = `${appCopy.ai_photo_label} · ${appCopy.not_real_place}`;
  const pendingText = imageFailed ? appCopy.photo_load_failed : appCopy.photo_placeholder;
  const caption = photo.caption ? <Text key="caption" testID="photo-caption" role="label">{photo.caption}</Text> : null;
  return (
    <DsScreen
      variant="step"
      back={{label: copy.course.to_home, onPress: toCourseHome}}
      stepInfo={stepA11y(copy.course.step.photo, 1, review)}
      scrollRef={errorTop}
      onViewport={setViewport}
      dock={dock}>
      <FoldStack viewport={viewport} gap={large ? P4_LAYOUT.gap.large : P4_LAYOUT.gap.base} testID="p4-body" onFold={onFold}>
        {!review && error ? <StepErrorBanner key="error" error={error} /> : null}
        <StepHeader key="header" name={copy.course.step.photo} n={1} review={review} compact={large} />
        {/* B1: 사진 전체가 누름 영역. 읽기 '오늘 사진, {caption}, AI가 만든 그림' + 힌트 '크게 보기'(copy 11-17: 두 번 누르라는 말은 TalkBack이 따로 읽음) */}
        <Pressable
          key="photo"
          ref={polaroidRef}
          testID="photo-polaroid"
          disabled={!canZoom}
          accessible={canZoom}
          accessibilityRole={canZoom ? 'button' : undefined}
          accessibilityLabel={canZoom ? copy.photo.zoom_open_a11y.split('{caption}').join(photo.caption) : undefined}
          accessibilityHint={canZoom ? copy.photo.zoom_open_hint : undefined}
          onPress={openZoom}
          style={[styles.photo, {height: photoH}]}>
          {photo.image_url.startsWith('pending://') || imageFailed ? (
            // 사진 준비 중·불러오기 실패: 개발용 상자가 아니라 디자인된 빈 사진 칸(옅은 면 + 사진 아이콘 + 안내)
            <View style={styles.pending}>
              <Icon name="icon-photo" size={large ? 28 : 36} color={ds.color.inkSub} />
              {/* 큰 글자(사진 100)에서는 안내 글이 사진 칸을 넘으므로 칸 바로 아래 한 줄로 */}
              {large ? null : <Text role="sub" tone="muted" style={styles.center}>{pendingText}</Text>}
            </View>
          ) : (
            <Image
              testID="photo-image"
              source={{uri: photo.image_url}}
              resizeMode="cover"
              style={styles.image}
              // AI 고지는 바로 아래 보이는 줄이 따로 읽힌다(같은 말을 두 번 읽지 않게)
              accessibilityLabel={photo.caption || appCopy.ai_photo_label}
              onLoad={() => setLoaded(true)}
              onError={() => setImageFailed(true)}
            />
          )}
        </Pressable>
        {/* AI 고지(디자인 #95 최종): 칩 없이 사진 바로 아래 고정 한 줄. 설명 유무와 상관없이 같은 자리, 실제 사진일 때만 */}
        {showImage ? <AiNotice key="ai" text={aiNotice} /> : null}
        {large && !showImage ? <Text key="pending" role="sub" tone="muted">{pendingText}</Text> : null}
        {canZoom && hint ? <Text key="zoom-hint" testID="zoom-hint" role="body">{copy.photo.zoom_hint}</Text> : null}
        {late ? null : caption}
        {/* 회상 질문: 100%는 한 덩어리(질문 사이 간격 없이 — 시안). 큰 글자는 문장마다 한 덩어리로 나눠(R-15) 접힘에 걸치면 그 문장만 아래로 —
            200%에서도 첫 문장이 첫 화면에 든다 */}
        {(large ? photo.recall_questions.map(q => [q]) : photo.recall_questions.length ? [photo.recall_questions] : []).map((qs, i) => (
          <View key={`q${i}`} testID={i === 0 ? 'recall-questions' : undefined} style={[styles.readBar, reading ? styles.reading : null]}>
            {qs.map(q => (
              <Text key={q} role="bodyLg">{q}</Text>
            ))}
          </View>
        ))}
        {/* AP-03 읽어 주기: 질문 바로 아래 본문 보조 버튼(가로 채움). 화면 읽기 켜짐이면 없음(R16) */}
        {readable ? (
          <View key="read" testID="read-aloud" style={styles.read}>
            <Button kind="secondary" label={read.label} loading={read.busy} onPress={read.onPress} />
            <ReadAloudNotice notice={read.notice} />
          </View>
        ) : null}
        {late ? caption : null}

        <Text key="look" role="sub" tone="muted">{appCopy.photo_look}</Text>
      </FoldStack>
      {/* 크게 보기(Modal)는 묶음 밖: 높이 0 인 자식에 간격이 붙어 사진을 불러온 뒤 내용이 내려가지 않게(PR #91 리뷰 M2) */}
      {canZoom ? <PhotoZoom visible={zoom} uri={photo.image_url} caption={photo.caption} onClose={closeZoom} /> : null}
    </DsScreen>
  );
}

/** P4 배치 값 한 곳(시안 P4_photo_ds4c, 디자인 #95 최종). 사진은 글자 상자가 아니라 사진 틀이라 높이를 정한다.
 *  사진: 100% 설명 없는 날 124 / 있는 날 88(같은 레드라인 — 질문 첫 문장·고지가 첫 화면), 글자 150% 이상 80. 본문 간격 8 / 6, 질문 사이 2(100%) */
export const P4_LAYOUT = {photo: {noCaption: 124, withCaption: 88, large: 80}, gap: {base: 8, large: 6}, questionsGap: 2} as const;

// 사진(시안 ds4c): 둘레 카드·테두리 없이 반경 22 + 그림자. 본문 간격은 P4_LAYOUT.gap — FoldStack gap
const styles = StyleSheet.create({
  // 읽어 주는 중 표시: 옅은 하늘 면(글 폭·줄바꿈이 움직이지 않게 여백 없이 면만, 리뷰). 글자 inkBody 는 infoSoft 위 허용 짝
  readBar: {borderRadius: 8, gap: P4_LAYOUT.questionsGap},
  reading: {backgroundColor: ds.color.infoSoft},
  photo: {alignSelf: 'stretch', borderRadius: ds.radius.card, overflow: 'hidden', backgroundColor: ds.color.paperSoft, boxShadow: shadow.lifted},
  image: {flex: 1, alignSelf: 'stretch'},
  read: {gap: 8},
  center: {textAlign: 'center'},
  pending: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 8},
});
