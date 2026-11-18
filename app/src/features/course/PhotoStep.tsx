import React, {useEffect, useRef, useState} from 'react';
import {Image, Pressable, StyleSheet, useWindowDimensions, View} from 'react-native';
import {StepHeader} from './StepHeader';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {Screen} from '../../ui/Screen';
import {BackBar} from '../../app/BackBar';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {color, shadow} from '../../ui/tokens';
import {Icon} from '../../ui/assets/icons';
import {useSession} from '../../app/session';
import {appCopy, copy} from '../../copy/copy';
import {StepError} from './StepError';
import {ToCourseHomeLink} from './ToCourseHomeLink';
import {useFinishStep} from './useFinishStep';
import {PhotoZoom} from './PhotoZoom';
import {track} from './track';
import {kstYmd} from './stamps';
import {prefs} from '../../lib/prefs';
import {focusLater} from '../../ui/screenTitle';

// review: 코스를 다 마친 뒤 '오늘 코스 다시 보기'(시안 P3 v4 B, 기능 회의 B2). 보기 전용 — 기록 호출 없음, 하단은 '돌아가기'.
export function PhotoStep({navigation, route}: NativeStackScreenProps<ParentParams, 'PhotoStep'>) {
  const review = !!route.params?.review;
  // 코스 진행 중 이전(바·하드웨어 뒤로가기): 확인 없이 코스 홈으로
  const toCourseHome = () => navigation.popTo('CourseHome');
  const {finish, error, busy} = useFinishStep();
  const [imageFailed, setImageFailed] = useState(false);
  const [loaded, setLoaded] = useState(false); // B1: 사진을 다 불러왔을 때만 크게 보기 진입(못 불러왔으면 진입 없음)
  const [zoom, setZoom] = useState(false);
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
  // 사진 높이는 화면 높이의 28% 이하(QA B4: 작은 화면에서 회상 질문이 더 보이게). 틀 폭 = 사진 높이 x 272/236 + 안쪽 14x2
  const {height: winH} = useWindowDimensions();
  const frameW = Math.min(300, Math.floor((winH * 0.28 * 272) / 236) + 28);
  const photo = content?.photo;
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
  return (
    <Screen
      top={
        <>
          <BackBar course onBack={toCourseHome} />
          <StepHeader name={copy.course.step.photo} n={1} review={review} />
        </>
      }
      bottom={
        review ? (
          <BigButton label={copy.review.back} accessibilityLabel={copy.nav.back_course_a11y} onPress={toCourseHome} />
        ) : error ? (
          <StepError error={error} onRetry={go} />
        ) : (
          <>
            <BigButton label={copy.course.next.photo} loading={busy} onPress={go} />
            <ToCourseHomeLink onPress={toCourseHome} disabled={busy} />
          </>
        )
      }>
      {/* B1: 폴라로이드 전체(캡션 포함)가 누름 영역. 읽기 '오늘 사진, {caption}, AI가 만든 그림' + 힌트 '크게 보기'(copy 11-17: 두 번 누르라는 말은 TalkBack이 따로 읽음) */}
      <Pressable
        ref={polaroidRef}
        testID="photo-polaroid"
        disabled={!canZoom}
        accessible={canZoom}
        accessibilityRole={canZoom ? 'button' : undefined}
        accessibilityLabel={canZoom ? copy.photo.zoom_open_a11y.split('{caption}').join(photo.caption) : undefined}
        accessibilityHint={canZoom ? copy.photo.zoom_open_hint : undefined}
        onPress={openZoom}
        style={[styles.polaroid, {maxWidth: frameW}]}>
        {photo.image_url.startsWith('pending://') || imageFailed ? (
          // 사진 준비 중·불러오기 실패: 개발용 상자가 아니라 디자인된 빈 사진 칸(옅은 면 + 사진 아이콘 + 안내)
          <View style={[styles.photo, styles.pending]}>
            <Icon name="icon-photo" size={40} color={color.inkSub} />
            <Text20 style={styles.pendingText}>{imageFailed ? appCopy.photo_load_failed : appCopy.photo_placeholder}</Text20>
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
        <Text20 size={32} style={styles.caption}>{photo.caption}</Text20>
      </Pressable>
      {canZoom && hint ? <Text20 testID="zoom-hint" weight="bold" style={styles.hint}>{copy.photo.zoom_hint}</Text20> : null}
      {canZoom ? <PhotoZoom visible={zoom} uri={photo.image_url} caption={photo.caption} onClose={closeZoom} /> : null}
      {/* AI 고지(늘 보이게): 실사풍이라 "실제 장소가 아니에요"를 같이 쓴다 */}
      {showImage ? <Text20 style={styles.sub}>{`${appCopy.ai_photo_label} · ${appCopy.not_real_place}`}</Text20> : null}
      <Text20 size={22}>{appCopy.photo_look}</Text20>
      {photo.recall_questions.map(q => (
        <Text20 key={q} size={24} weight="bold">{q}</Text20>
      ))}
    </Screen>
  );
}

// 폴라로이드(명세 §6) 최소 적용: 흰 틀·안쪽 14·lifted 그림자. 기울기·테이프는 장식이라 빌드 1에서 생략.
const styles = StyleSheet.create({
  polaroid: {alignSelf: 'center', width: '100%', maxWidth: 300, backgroundColor: color.card, padding: 14, borderRadius: 4, boxShadow: shadow.lifted, gap: 8},
  photo: {width: '100%', aspectRatio: 272 / 236, backgroundColor: color.paperSoft, borderRadius: 2},
  caption: {textAlign: 'center'},
  sub: {color: color.inkSub},
  hint: {textAlign: 'center', color: color.ink},
  pending: {alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12},
  pendingText: {textAlign: 'center', color: color.inkSub},
});
