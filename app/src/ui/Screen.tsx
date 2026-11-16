import React from 'react';
import {ScrollView, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {color} from './tokens';

export function Screen({children}: {children: React.ReactNode}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={[styles.pad, {paddingTop: 24 + insets.top, paddingBottom: 28 + insets.bottom}]}>
      {children}
    </ScrollView>
  );
}
const styles = StyleSheet.create({bg: {flex: 1, backgroundColor: color.paper}, pad: {padding: 24}});
