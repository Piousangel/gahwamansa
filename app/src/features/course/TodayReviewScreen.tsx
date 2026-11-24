import React, {useCallback, useRef, useState} from 'react';
import {Image, StyleSheet, useWindowDimensions, View} from 'react-native';
import {useSession} from '../../app/session';
import {DsScreen, Sign, SignOther, Text, useAudience, type DockProps} from '../../ui/ds';
import {ds} from '../../ui/ds/roles';
import {AiNotice} from '../../ui/AiNotice';
import {PhotoButton} from '../../ui/PhotoButton';
import {Icon} from '../../ui/assets/icons';
import {focusLater, useScreenTitleRef} from '../../ui/screenTitle';
import {appCopy, copy} from '../../copy/copy';
import {kstDateLine} from './stamps';
import {photoFrame} from './photoFrame';
import {usePhotoLoad} from './usePhotoLoad';
import {PhotoZoom} from './PhotoZoom';
import {ReadAloudNotice, useReadAloudAction} from './ReadAloud';

const c = copy.course;
const fill = (tpl: string, vars: Record<string, string>) => Object.keys(vars).reduce((s, k) => s.split(`{${k}}`).join(vars[k]), tpl);

// D-3 '오늘 코스 다시 보기' 안 A '오늘 한 장'(DECISIONS 2026-11-24, 시안 docs/design/2026-11-24-d2-d3-c4/d3-course-review.html).
// 다시 하기가 아니라 오늘 남긴 것 보기: 한 화면 세로 스크롤, 탭 0번.
// 위 BackLink '오늘 코스로' → 날짜(화면 제목) → 사진(누르면 크게, 원본 비율 — P4 와 같은 photoFrame·usePhotoLoad)
// → 사진 이름 → AI 고지 → '{질문} · 고르신 쪽' + 노랑 팻말(row, 화면당 1개 R-22) + '다른 하나 · {안 고른 쪽}'(흐린 보조 글자) → 오늘 낱말.
// Dock = '읽어 주세요'(돌아가기는 BackLink 하나 — U-8 과 같은 이유로 같은 일 하는 버튼을 둘 두지 않는다). 화면 읽기가 켜져 있으면 Dock 없음(R16).
// 보기 전용: 기록·계측 호출 0. 저장된 답이 없는 날(거부·철회·미연결)은 팻말 줄을 뺀다. D-1 '먼저 떠오른 것' 자리는 아직 없다.
// 200%: 같은 순서로 스크롤만(사진은 줄이지 않는다 — P4 의 200% 규칙은 단계 화면 버튼을 올리려는 것이라 여기는 해당 없음).
// 코스 홈 바로 위에만 쌓이므로 뒤로(BackLink·하드웨어)는 기본 goBack 그대로 코스 홈이다(app/ 의존을 늘리지 않게 내비 타입은 필요한 것만).
export function TodayReviewScreen({navigation}: {navigation: {goBack(): void}}) {
  const toCourseHome = useCallback(() => navigation.goBack(), [navigation]);
  const {content} = useSession();
  const audience = useAudience();
  const {width: winW, height: winH} = useWindowDimensions();
  const [boxW, setBoxW] = useState(0);
  const [zoom, setZoom] = useState(false);
  const photoRef = useRef<React.ComponentRef<typeof View>>(null);
  const registerTitle = useScreenTitleRef(true);
  const {aspect, loaded, failed, onLoad, onError} = usePhotoLoad(content?.photo?.image_url);
  const photo = content?.photo;
  const q = content?.question;
  const date = kstDateLine();
  const chosen = q && content?.answered_choice ? (content.answered_choice === 'A' ? q.option_a : q.option_b) : null;
  const other = q && content?.answered_choice ? (content.answered_choice === 'A' ? q.option_b : q.option_a) : null;
  const readText = photo
    ? chosen
      ? fill(c.review_read, {날짜: date, 사진: photo.caption, 답: chosen, 낱말: photo.keyword})
      : fill(c.review_read_no_choice, {날짜: date, 사진: photo.caption, 낱말: photo.keyword})
    : '';
  const read = useReadAloudAction(readText);
  if (!photo) {
    return null;
  }
  const pending = photo.image_url.startsWith('pending://') || failed;
  const canZoom = !pending && loaded;
  const frame = photoFrame(boxW || Math.max(0, winW - ds.space.screenX[audience] * 2), aspect, winH);
  const dock: DockProps | undefined = read.allowed ? {primary: {kind: 'secondary', label: read.label, loading: read.busy, onPress: read.onPress, testID: 'review-read'}} : undefined;
  return (
    <DsScreen variant="step" back={{to: c.to_home, onPress: toCourseHome}} dock={dock}>
      <View testID="today-review" style={styles.body}>
        <View ref={registerTitle} testID="review-date" accessible accessibilityRole="header" accessibilityLabel={date}>
          <Text role="heading">{date}</Text>
        </View>
        <View testID="review-photo-box" onLayout={e => setBoxW(Math.round(e.nativeEvent.layout.width))}>
          <PhotoButton
            pressRef={photoRef}
            frame={frame}
            canPress={canZoom}
            label={copy.photo.zoom_open_a11y.split('{caption}').join(photo.caption)}
            hint={copy.photo.zoom_open_hint}
            onPress={() => setZoom(true)}>
            {pending ? (
              <View style={styles.pending}>
                <Icon name="icon-photo" size={36} color={ds.color.inkSub} />
                <Text role="sub" tone="muted" style={styles.center}>{failed ? appCopy.photo_load_failed : appCopy.photo_placeholder}</Text>
              </View>
            ) : (
              <Image
                testID="photo-image"
                source={{uri: photo.image_url}}
                resizeMode="contain"
                style={styles.image}
                // 읽기는 크게 보기 버튼 이름(사진 이름·AI 포함) 또는 아래 이름·고지 줄이 맡는다 — 사진 자체는 읽지 않는다(QA-1 L1 중복)
                accessible={false}
                importantForAccessibility="no"
                onLoad={onLoad}
                onError={onError}
              />
            )}
          </PhotoButton>
        </View>
        {/* 크게 보기 버튼이 '오늘 사진, {이름}, AI가 만든 그림'을 읽으므로, 누를 수 있을 때는 이 줄들을 화면 읽기에서 뺀다(QA-1 L1) */}
        <View style={styles.tight} accessibilityElementsHidden={canZoom} importantForAccessibility={canZoom ? 'no-hide-descendants' : 'auto'}>
          {photo.caption ? <Text testID="review-caption" role="bodyLg">{photo.caption}</Text> : null}
          {pending ? null : <AiNotice text={`${appCopy.ai_photo_label}·${appCopy.not_real_place}`} />}
        </View>
        {chosen && other ? (
          <View testID="review-choice" style={styles.tight}>
            {/* 읽기: 질문 줄은 질문만('고르신 쪽'은 팻말 읽기가 말한다), 질문이 없는 날은 이 줄을 읽지 않는다. 가운뎃점은 읽기 이름에 넣지 않는다(QA-1 L1) */}
            {q?.prompt ? (
              <Text testID="review-choice-label" role="sub" tone="muted" accessibilityLabel={q.prompt}>
                {fill(c.review_choice_label, {질문: q.prompt})}
              </Text>
            ) : (
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Text testID="review-choice-label" role="sub" tone="muted">{c.review_choice_label_no_prompt}</Text>
              </View>
            )}
            <Sign size="row" label={chosen} readLabel={fill(c.review_sign_a11y, {답: chosen})} />
            <SignOther testID="review-other" label={fill(c.review_other, {답: other})} readLabel={fill(c.review_other_a11y, {답: other})} />
          </View>
        ) : null}
        <View testID="review-word" accessible accessibilityLabel={fill(c.review_word_a11y, {낱말: photo.keyword})} style={styles.tight}>
          <Text role="sub" tone="muted">{c.review_word}</Text>
          <Text role="title">{photo.keyword}</Text>
        </View>
        <ReadAloudNotice notice={read.notice} />
      </View>
      {canZoom ? (
        <PhotoZoom
          visible={zoom}
          uri={photo.image_url}
          caption={photo.caption}
          onClose={() => {
            setZoom(false);
            focusLater(() => photoRef.current);
          }}
        />
      ) : null}
    </DsScreen>
  );
}

const styles = StyleSheet.create({
  body: {gap: 16},
  tight: {gap: 6},
  image: {flex: 1, alignSelf: 'stretch'},
  pending: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 8},
  center: {textAlign: 'center'},
});
