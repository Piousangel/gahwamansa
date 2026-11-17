import type {ImageSourcePropType} from 'react-native';

// 이름 -> 파일 매핑. 전문 디자이너가 납품하면 source 에 require('./file.png')만 넣으면 교체된다.
// source 가 null 이면 AssetPlaceholder 가 라벨 박스를 보여 준다. (직접 그린 그림 금지)
export type AssetName =
  | 'sun-happy' | 'sun-glad' | 'sun-worried' | 'sun-stamp'
  | 'icon-speaker' | 'icon-check' | 'icon-back' | 'icon-home' | 'icon-report'
  | 'icon-cheer' | 'photo-day1' | 'writing-guide' | 'intro-photo';

export const assetRegistry: Record<AssetName, ImageSourcePropType | null> = {
  'sun-happy': null, 'sun-glad': null, 'sun-worried': null, 'sun-stamp': null,
  'icon-speaker': null, 'icon-check': null, 'icon-back': null, 'icon-home': null,
  'icon-report': null, 'icon-cheer': null, 'photo-day1': null, 'writing-guide': null,
  // 첫 화면 소개 사진(번들): content/photos/day-01.jpg 를 480px 로 줄인 사본(약 86KB). 네트워크 없이 바로 보인다
  'intro-photo': require('./intro-photo.jpg'),
};
