import React, {useEffect, useRef, useState} from 'react';
import {Modal, ScrollView, StyleSheet, View} from 'react-native';
import {useIsFocused} from '@react-navigation/native';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {color, radius, shadow} from '../../ui/tokens';
import {copy} from '../../copy/copy';
import {isCheerKey, type MyCheers} from '../../api/contract/cheers';
import {SunSmile} from './sunArt';
import {useFocusOnOpen} from './a11yFocus';
import type {Api} from '../types';

// P8 응원 도착(시안 P8_cheer): 코스 홈을 열면 안 읽은 응원(get_my_cheers)을 대화상자로 한 번 보여 준다.
// - 서버 확정 키(api/contract/cheers.ts) 4개만 보여 준다. 모르는 키는 건너뛴다.
// - 바깥을 눌러도 닫히지 않고 "알겠어요"로만 닫힌다(읽음 처리). 안드로이드 뒤로가기도 "알겠어요"와 같다(닫을 길을 막지 않음).
// - 받아 오지 못하거나 보여 줄 글이 없으면 조용히 아무것도 하지 않는다(장식이라 코스를 막지 않음).
// TODO(U0 공용 Dialog): U0 줄의 ui/Dialog 가 합쳐지면 이 틀을 그것으로 교체(포커스 가둠·제목 포커스 포함).
export function CheerDialog({api, enabled}: {api: Api; enabled: boolean}) {
  const focused = useIsFocused();
  const [batch, setBatch] = useState<MyCheers['cheers']>([]);
  const asked = useRef(false);
  const titleRef = useFocusOnOpen(batch.length > 0 && focused); // R12: 첫 포커스는 제목
  useEffect(() => {
    if (!enabled || asked.current) {
      return;
    }
    asked.current = true; // 앱을 연 뒤 한 번만 묻는다
    let alive = true;
    api
      .getMyCheers()
      .then(r => alive && setBatch(r.cheers))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [api, enabled]);

  const lines = batch.flatMap(c => (isCheerKey(c.message_key) ? [copy.cheers[c.message_key]] : []));
  const close = () => {
    const ids = batch.map(c => c.id); // 확인한 묶음 전체(모르는 키 포함). 그 사이 새로 온 응원은 다음에 보인다
    setBatch([]);
    api.markCheersRead(ids).catch(() => {}); // 실패하면 다음에 다시 보인다
  };
  if (lines.length === 0) {
    return null;
  }
  const title = lines.length === 1 ? copy.cheer.title : copy.cheer.title_many.split('{n}').join(String(lines.length));
  return (
    <Modal visible={focused} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.scrim}>
        <View style={styles.box} accessibilityViewIsModal>
          <ScrollView bounces={false} contentContainerStyle={styles.body}>
            <View style={styles.sun}>
              <SunSmile size={88} />
            </View>
            <View ref={titleRef} accessible accessibilityRole="header" accessibilityLabel={title}>
              <Text20 size={32} weight="bold" style={styles.title}>{title}</Text20>
            </View>
            {lines.map((t, i) => (
              <View key={`${i}-${t}`} style={styles.line}>
                <Text20 size={22} style={styles.lineText}>{t}</Text20>
              </View>
            ))}
            {/* TODO(읽어주기): 오디오 스파이크 결론 뒤 이 자리에 '읽어 주세요'(화면 읽기 켜짐이면 숨김 R16). 그 전엔 그리지 않음 */}
            <BigButton label={copy.cheer.button} onPress={close} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {flex: 1, backgroundColor: shadow.scrim, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32},
  box: {maxHeight: '100%', backgroundColor: color.card, borderRadius: radius.sheet, boxShadow: shadow.dialog},
  body: {paddingVertical: 24, paddingHorizontal: 20, gap: 12},
  sun: {alignItems: 'center'},
  title: {color: color.inkTitle, textAlign: 'center'},
  line: {backgroundColor: color.actionSoft, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 16},
  lineText: {color: color.inkTitle},
});
