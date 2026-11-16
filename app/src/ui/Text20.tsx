import React from 'react';
import {Text, TextProps, StyleSheet} from 'react-native';
import {color, MIN_BODY_FONT} from './tokens';

type Props = TextProps & {size?: number; weight?: 'normal' | 'bold'};

export function Text20({size = MIN_BODY_FONT, weight, style, ...rest}: Props) {
  return (
    <Text
      {...rest}
      style={[
        styles.base,
        {fontSize: Math.max(MIN_BODY_FONT, size), lineHeight: Math.max(MIN_BODY_FONT, size) * 1.4},
        weight ? {fontWeight: weight} : null,
        style,
      ]}
    />
  );
}
const styles = StyleSheet.create({base: {color: color.ink}});
