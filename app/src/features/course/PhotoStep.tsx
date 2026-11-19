import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Image, Pressable, StyleSheet, useWindowDimensions, View} from 'react-native';
import {StepHeader} from './StepHeader';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {DsScreen, Text, type DockProps} from '../../ui/ds';
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
  const [reading, setReading] = useState(false); // 읽어 주는 중: 읽는 글 왼쪽 하늘색 막대
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
  // 사진 높이는 화면 높이의 28% 이하(QA B4: 작은 화면에서 회상 질문이 더 보이게). 카드 폭 = 사진 폭 = 사진 높이 x 272/236(v4 카드는 안쪽 여백 없음)
  const {height: winH} = useWindowDimensions();
  const frameW = Math.min(300, Math.floor((winH * 0.28 * 272) / 236));
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
  // 시안 P4(ds4b): 위 BackLink '오늘 코스로'(U-8: 하단 링크 삭제), 단계 제목 한 줄, 사진 카드(안에 AI 고지), 천천히 보세요, 회상 질문.
  // Dock = 주 '다 봤어요' + 보조 '읽어 주세요'(AP-03, 화면 읽기 켜짐이면 없음). 보기 전용은 주 '돌아가기'만
  const readSlot: DockProps['secondary'] = readable ? {label: read.label, loading: read.busy, onPress: read.onPress, testID: 'read-aloud'} : undefined;
  const dock: DockProps = review
    ? {primary: {label: copy.review.back, accessibilityHint: copy.nav.back_course_a11y, onPress: toCourseHome}, secondary: readSlot}
    : error
      ? stepErrorDock(error, go, readSlot)
      : {primary: {label: copy.course.next.photo, loading: busy, onPress: go}, secondary: readSlot};
  return (
    <DsScreen
      variant="step"
      back={{label: copy.course.to_home, onPress: toCourseHome}}
      header={<StepHeader name={copy.course.step.photo} n={1} review={review} />}
      stepInfo={stepA11y(copy.course.step.photo, 1, review)}
      scrollRef={errorTop}
      dock={dock}>
      {!review && error ? <StepErrorBanner error={error} /> : null}
      {/* B1: 사진 카드 전체가 누름 영역. 읽기 '오늘 사진, {caption}, AI가 만든 그림' + 힌트 '크게 보기'(copy 11-17: 두 번 누르라는 말은 TalkBack이 따로 읽음) */}
      <Pressable
        ref={polaroidRef}
        testID="photo-polaroid"
        disabled={!canZoom}
        accessible={canZoom}
        accessibilityRole={canZoom ? 'button' : undefined}
        accessibilityLabel={canZoom ? copy.photo.zoom_open_a11y.split('{caption}').join(photo.caption) : undefined}
        accessibilityHint={canZoom ? copy.photo.zoom_open_hint : undefined}
        onPress={openZoom}
        style={[styles.card, {maxWidth: frameW}]}>
        {photo.image_url.startsWith('pending://') || imageFailed ? (
          // 사진 준비 중·불러오기 실패: 개발용 상자가 아니라 디자인된 빈 사진 칸(옅은 면 + 사진 아이콘 + 안내)
          <View style={[styles.photo, styles.pending]}>
            <Icon name="icon-photo" size={40} color={ds.color.inkSub} />
            <Text role="sub" tone="muted" style={styles.center}>{imageFailed ? appCopy.photo_load_failed : appCopy.photo_placeholder}</Text>
          </View>
        ) : (
          <Image
            testID="photo-image"
            source={{uri: photo.image_url}}
            style={styles.photo}
            accessibilityLabel={photo.caption}
            onLoad={() => setLoaded(true)}
            onError={() => setImageFailed(true)}
          />
        )}
        {/* 카드 아래 칸(시안 ds4b: 사진 밑 안쪽 8/14): 사진 설명(콘텐츠라 유지 — 시안 보드는 자리표시 사진이라 설명이 없다) +
            AI 고지(늘 보이게): 실사풍이라 "실제 장소가 아니에요"를 같이 쓴다 */}
        <View style={styles.cardLabel}>
          <Text role="bodyLg">{photo.caption}</Text>
          {showImage ? <Text role="sub" tone="muted">{`${appCopy.ai_photo_label} · ${appCopy.not_real_place}`}</Text> : null}
        </View>
      </Pressable>
      {canZoom && hint ? <Text testID="zoom-hint" role="body">{copy.photo.zoom_hint}</Text> : null}
      {canZoom ? <PhotoZoom visible={zoom} uri={photo.image_url} caption={photo.caption} onClose={closeZoom} /> : null}
      <Text role="body">{appCopy.photo_look}</Text>
      {photo.recall_questions.length > 0 ? (
        <View testID="recall-questions" style={[styles.readBar, reading ? styles.reading : null]}>
          {photo.recall_questions.map(q => (
            <Text key={q} role="bodyLg">{q}</Text>
          ))}
        </View>
      ) : null}
      {readable ? <ReadAloudNotice notice={read.notice} /> : null}
    </DsScreen>
  );
}

// 사진 카드(시안 P4 ds4b): 흰 면 + line 테두리 1.5 + 반경 22, 사진 위·AI 고지 아래(안쪽 8/14). 사진 비율 272:236 유지
const styles = StyleSheet.create({
  // 읽어 주는 중: 읽는 글 왼쪽에 하늘색 막대(글자 스타일을 바꾸지 않고 표시)
  // 읽어 주는 중 표시: 왼쪽 막대. 자리는 늘 두고 색만 바꿔 글 폭·줄바꿈이 움직이지 않게(리뷰)
  readBar: {borderLeftWidth: 4, borderLeftColor: 'transparent', paddingLeft: 10},
  reading: {borderLeftColor: ds.color.info},
  card: {alignSelf: 'center', width: '100%', backgroundColor: ds.color.card, borderWidth: 1.5, borderColor: ds.color.line, borderRadius: ds.radius.card, overflow: 'hidden'},
  photo: {width: '100%', aspectRatio: 272 / 236, backgroundColor: ds.color.paperSoft},
  cardLabel: {paddingVertical: 8, paddingHorizontal: 14, gap: 2},
  center: {textAlign: 'center'},
  pending: {alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12},
});
