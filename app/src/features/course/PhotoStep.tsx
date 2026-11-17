import React, {useState} from 'react';
import {Image, StyleSheet, View} from 'react-native';
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
import {useFinishStep} from './useFinishStep';

export function PhotoStep({navigation}: NativeStackScreenProps<ParentParams, 'PhotoStep'>) {
  // 코스 진행 중 이전(바·하드웨어 뒤로가기): 확인 없이 코스 홈으로
  const toCourseHome = () => navigation.popTo('CourseHome');
  const {finish, error, busy} = useFinishStep();
  const [imageFailed, setImageFailed] = useState(false);
  const {content} = useSession();
  const photo = content?.photo;
  if (!photo) {
    return null;
  }
  const showImage = !photo.image_url.startsWith('pending://') && !imageFailed;
  const go = async () => {
    if (await finish('photo')) {
      navigation.popTo('CourseHome'); // 쌓인 코스 홈으로 돌아간다(v7 navigate 는 새로 쌓을 수 있음)
    }
  };
  return (
    <Screen
      top={<BackBar course onBack={toCourseHome} />}
      bottom={
        error ? <StepError error={error} onRetry={go} /> : <BigButton label={copy.course.next.photo} loading={busy} onPress={go} />
      }>
      <View style={styles.polaroid}>
        {photo.image_url.startsWith('pending://') || imageFailed ? (
          // 사진 준비 중·불러오기 실패: 개발용 상자가 아니라 디자인된 빈 사진 칸(옅은 면 + 사진 아이콘 + 안내)
          <View style={[styles.photo, styles.pending]}>
            <Icon name="icon-photo" size={40} color={color.inkSub} />
            <Text20 style={styles.pendingText}>{imageFailed ? appCopy.photo_load_failed : appCopy.photo_placeholder}</Text20>
          </View>
        ) : (
          <Image source={{uri: photo.image_url}} style={styles.photo} accessibilityLabel={photo.caption} onError={() => setImageFailed(true)} />
        )}
        <Text20 size={32} style={styles.caption}>{photo.caption}</Text20>
      </View>
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
  pending: {alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12},
  pendingText: {textAlign: 'center', color: color.inkSub},
});
