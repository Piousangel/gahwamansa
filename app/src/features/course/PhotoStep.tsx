import React, {useState} from 'react';
import {Image, StyleSheet} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {AssetPlaceholder} from '../../ui/assets/AssetPlaceholder';
import {useSession} from '../../app/session';
import {appCopy, copy} from '../../copy/copy';
import {StepError} from './StepError';
import {useFinishStep} from './useFinishStep';

export function PhotoStep({navigation}: NativeStackScreenProps<ParentParams, 'PhotoStep'>) {
  const {finish, error} = useFinishStep();
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
    <Screen>
      {photo.image_url.startsWith('pending://') || imageFailed ? (
        <AssetPlaceholder name="photo-day1" width={300} height={260} label={imageFailed ? appCopy.photo_load_failed : appCopy.photo_placeholder} />
      ) : (
        <Image source={{uri: photo.image_url}} style={styles.photo} accessibilityLabel={photo.caption} onError={() => setImageFailed(true)} />
      )}
      {showImage ? <Text20>{appCopy.ai_photo_label}</Text20> : null}
      <Text20 size={32}>{photo.caption}</Text20>
      <Text20>{appCopy.photo_look}</Text20>
      {photo.recall_questions.map(q => (
        <Text20 key={q} size={24}>{q}</Text20>
      ))}
      <BigButton label={copy.course.next.photo} onPress={go} />
      <StepError error={error} onRetry={go} />
    </Screen>
  );
}

const styles = StyleSheet.create({photo: {width: 300, height: 260}});
