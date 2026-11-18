import React, {useCallback, useMemo, useState} from 'react';
import {FlatList, Pressable, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {copy} from '../copy/copy';
import {Text20} from '../ui/Text20';
import {color, radius, size, space} from '../ui/tokens';
import {ossRows, type OssRow} from '../lib/ossLicenses';
import {BackBar} from './BackBar';

// 오픈소스 라이선스(AU-06, 시안 P13_more '앱 정보 → 오픈소스 라이선스', 자녀 C7 도 같은 화면). 어르신·자녀 스택 공용 라우트 'Oss'.
// 안내 한 줄(app_info.oss_intro) + 행(이름·라이선스), 누르면 그 자리에서 전문(없으면 라이선스 주소)을 펼친다.
// 목록은 빌드 산출물(src/oss/*.generated.json): JS 패키지 + Android 네이티브. 이름·라이선스 이름은 원문 그대로(번역하지 않음).
export function OssScreen() {
  const insets = useSafeAreaInsets();
  const rows = useMemo(() => ossRows(), []);
  const [open, setOpen] = useState<string | null>(null);
  const renderItem = useCallback(
    ({item}: {item: OssRow}) => <Row row={item} open={open === item.key} onToggle={() => setOpen(k => (k === item.key ? null : item.key))} />,
    [open],
  );
  return (
    <View style={[styles.root, {paddingTop: Math.max(space.topSafeMin, insets.top + space.md)}]}>
      <FlatList
        testID="oss-list"
        data={rows}
        keyExtractor={r => r.key}
        renderItem={renderItem}
        extraData={open}
        initialNumToRender={20}
        contentContainerStyle={[styles.content, {paddingBottom: insets.bottom + space.xxl}]}
        ListHeaderComponent={
          <View style={styles.head}>
            <BackBar />
            <Text20 size={28} weight="bold" accessibilityRole="header" style={styles.title}>
              {copy.app_info.oss}
            </Text20>
            <Text20 style={styles.sub}>{copy.app_info.oss_intro}</Text20>
          </View>
        }
      />
    </View>
  );
}

function Row({row, open, onToggle}: {row: OssRow; open: boolean; onToggle: () => void}) {
  const body = row.text ?? row.url;
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${row.name} ${row.version}, ${row.license}`}
        accessibilityState={body ? {expanded: open} : {disabled: true}}
        disabled={!body}
        onPress={onToggle}
        style={({pressed}) => [styles.rowHead, pressed ? styles.pressed : null]}>
        <Text20 weight="bold">{`${row.name} ${row.version}`}</Text20>
        <Text20 style={styles.sub}>{row.license}</Text20>
      </Pressable>
      {open && body ? (
        <Text20 selectable testID="oss-text" style={styles.text}>
          {body}
        </Text20>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: color.paper},
  content: {paddingHorizontal: space.screenX, gap: space.sm},
  head: {gap: space.sm, paddingBottom: space.md},
  title: {color: color.inkTitle},
  sub: {color: color.inkSub},
  row: {backgroundColor: color.card, borderRadius: radius.card, paddingHorizontal: space.lg},
  rowHead: {minHeight: size.touchMin, paddingVertical: space.md, justifyContent: 'center'},
  pressed: {opacity: 0.6},
  text: {paddingBottom: space.lg},
});
