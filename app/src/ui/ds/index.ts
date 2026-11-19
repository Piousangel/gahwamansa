// 디자인 시스템 v4 공통 컴포넌트(SUMMARY 3절). 기존 ui/ 컴포넌트(Text20·BigButton·Screen·Banner 등)는 그대로 두고 병행한다.
// 화면 적용은 시안 v4 뒤 각 레인 몫. 새 화면 코드는 여기서만 가져온다: import {Text, Button, DsScreen} from '../../ui/ds'.
export {AudienceProvider, useAudience, type LayoutOnlyStyle} from './audience';
export {Text, Heading, type TextProps} from './Text';
export {Button, type ButtonProps, type ButtonKind} from './Button';
export {SocialButton, type SocialButtonProps, type SocialProvider} from './SocialButton';
export {BackLink, type BackLinkProps} from './BackLink';
export {Dock, DockSpill, type DockProps, type DockAction, type DockPrimary, type DockSecondary, type DockNote, type SocialGroup} from './Dock';
export {Field, type FieldProps, type FieldKind} from './Field';
export {Choice, type ChoiceProps, type ChoiceItem} from './Choice';
export {Card, Section} from './Card';
export {Banner, type BannerTone} from './Banner';
export {StateView, type StateViewProps, type StateKind} from './StateView';
export {DsScreen, type DsScreenProps, type ScreenVariant} from './Screen';
export type {TextRole, TextTone, Audience} from './roles';
export {MoreBand, MORE_BAND_H} from './MoreBand';
