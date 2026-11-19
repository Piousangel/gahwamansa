import React, {useState} from 'react';
import {Animated, Image, StyleSheet, View} from 'react-native';
import {Text} from '../../ui/ds';
import {ds} from '../../ui/ds/roles';
import {shadow} from '../../ui/tokens';
import {Icon} from '../../ui/assets/icons';
import {SealStamp, Tape} from '../../ui/assets/album';
import {appCopy} from '../../copy/copy';

/** P7 앨범 마운트 값 한 곳(시안 P7_album_ds4, 디자인 #95 최종). 큰 글자 = 글자 150% 이상(200% 보드) */
export const P7_MOUNT = {
  width: {base: 236, large: 272},
  photoH: {base: 150, large: 96},
  pad: {x: 14, top: 14, bottom: 12},
  tilt: '-3deg',
  tape: {w: 92, h: 26, top: -12, tilt: '3deg'},
  // 도장: 사진 오른쪽 아래 모서리(100%) — 200%는 캡션 두 줄이 길어져 겹치므로 캡션 위(사진 오른쪽 위)로 올린다(#95)
  seal: {size: 116, right: -26, top: {base: 90, large: -2}, tilt: '-8deg'},
  inkRatio: 60 / 64, // 번짐 원 지름 = 도장 칸 × 60/64(시안 SVG r=30)
  margin: {top: 8, bottom: 22},
} as const;

export type MountMotion = {
  /** 사진·테이프·캡션(0~300ms 페이드) */
  mount: Animated.Value;
  seal: {opacity: Animated.Value; scale: Animated.Value; squash: Animated.Value};
  /** 번짐 원(없으면 그리지 않음: 동작 줄이기) */
  ink?: {opacity: Animated.Value; scale: Animated.Value};
};

/**
 * 사진 한 장(마운트 모서리) + 테이프 + 큰 인장 '家'. 캡션 두 줄 'AI가 만든 그림 / 실제 장소가 아니에요'(sub, 법무 고지, #95).
 * 장식(사진·테이프·도장)은 화면 읽기에서 숨기고 캡션만 읽는다. 사진이 아직 없으면(pending·실패) 옅은 면 + 사진 아이콘.
 */
export function AlbumMount({photoUrl, large, motion}: {photoUrl: string | null; large: boolean; motion: MountMotion}) {
  const [failed, setFailed] = useState(false);
  const w = large ? P7_MOUNT.width.large : P7_MOUNT.width.base;
  const photoH = large ? P7_MOUNT.photoH.large : P7_MOUNT.photoH.base;
  const show = !!photoUrl && !photoUrl.startsWith('pending://') && !failed;
  const ink = P7_MOUNT.seal.size * P7_MOUNT.inkRatio;
  return (
    <View testID="p7-mount" style={[styles.wrap, {width: w}]}>
      <Animated.View testID="p7-mount-fade" style={{opacity: motion.mount}}>
        <View style={styles.card}>
          <View style={[styles.photo, {height: photoH}]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {show ? (
              <Image testID="p7-photo" source={{uri: photoUrl as string}} resizeMode="cover" style={styles.image} onError={() => setFailed(true)} />
            ) : (
              <View testID="p7-photo-pending" style={styles.pending}>
                <Icon name="icon-photo" size={36} color={ds.color.inkSub} />
              </View>
            )}
          </View>
          <Text testID="p7-ai-caption" role="sub" style={styles.caption}>{`${appCopy.ai_photo_label}\n${appCopy.not_real_place}`}</Text>
        </View>
        <View style={styles.tape} pointerEvents="none">
          <Tape width={P7_MOUNT.tape.w} height={P7_MOUNT.tape.h} />
        </View>
      </Animated.View>
      <View
        testID="p7-seal-slot"
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.seal, {top: large ? P7_MOUNT.seal.top.large : P7_MOUNT.seal.top.base}]}>
        {motion.ink ? (
          <Animated.View
            testID="p7-ink"
            style={[styles.ink, {width: ink, height: ink, borderRadius: ink / 2, opacity: motion.ink.opacity, transform: [{scale: motion.ink.scale}]}]}
          />
        ) : null}
        <Animated.View testID="p7-seal" style={{opacity: motion.seal.opacity, transform: [{scale: motion.seal.scale}, {scaleY: motion.seal.squash}]}}>
          <SealStamp size={P7_MOUNT.seal.size} />
        </Animated.View>
      </View>
    </View>
  );
}

const S = P7_MOUNT.seal.size;
const styles = StyleSheet.create({
  wrap: {alignSelf: 'center', marginTop: P7_MOUNT.margin.top, marginBottom: P7_MOUNT.margin.bottom},
  card: {
    backgroundColor: ds.color.card,
    paddingHorizontal: P7_MOUNT.pad.x,
    paddingTop: P7_MOUNT.pad.top,
    paddingBottom: P7_MOUNT.pad.bottom,
    borderRadius: 6,
    boxShadow: shadow.lifted,
    transform: [{rotate: P7_MOUNT.tilt}],
  },
  photo: {borderRadius: 4, overflow: 'hidden', backgroundColor: ds.color.paperSoft},
  image: {flex: 1, alignSelf: 'stretch'},
  pending: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  caption: {marginTop: 8},
  tape: {position: 'absolute', top: P7_MOUNT.tape.top, left: '50%', marginLeft: -P7_MOUNT.tape.w / 2, transform: [{rotate: P7_MOUNT.tape.tilt}]},
  seal: {position: 'absolute', right: P7_MOUNT.seal.right, width: S, height: S, alignItems: 'center', justifyContent: 'center', transform: [{rotate: P7_MOUNT.seal.tilt}]},
  ink: {position: 'absolute', backgroundColor: ds.color.brandSealDeep},
});
