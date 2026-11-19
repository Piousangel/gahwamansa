import React from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import {assetRegistry, AssetName} from './registry';
import {color} from '../tokens';

type Props = {name: AssetName; width?: number; height?: number; label?: string};

export function AssetPlaceholder({name, width, height, label}: Props) {
  const source = assetRegistry[name];
  if (source) {
    return <Image source={source} style={{width, height}} />;
  }
  return (
    <View testID="asset-placeholder" style={[styles.box, {width, height}]}>
      <Text style={styles.text}>{label ?? `[아이콘: ${name}]`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: color.placeholder, borderWidth: 2, borderColor: color.action,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', padding: 8,
  },
  text: {fontSize: 20, color: color.inkBody},
});
