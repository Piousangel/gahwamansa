import {copy} from '../copy/copy';
import type {ParentParams} from './ParentStack';
import type {ChildParams} from './ChildStack';

// 뒤로 바·BackLink 는 목적지 이름만 쓴다(전문가 리뷰 W-09·A5, '‹ 이전' 없앰).
// 화면(route) 이름 → '…로' 문구. 스택에 화면을 더하면 이 표에 없다고 타입 오류가 난다(빠뜨리면 '이전'으로 돌아갈 길이 없다).
// 자녀 탭(Tabs) 위에서 연 화면은 그 탭(앨범·지난 날) 이름으로 돌아간다.
export type RouteName = Exclude<keyof ParentParams | keyof ChildParams, 'Tabs'> | 'Album' | 'Past';

const to = copy.nav.to;
export const BACK_TO: Record<RouteName, string> = {
  Connect: to.Connect, Consent: to.Consent, CourseHome: to.CourseHome, PhotoStep: to.PhotoStep, QuestionStep: to.QuestionStep,
  KeyboardStep: to.KeyboardStep, CourseDone: to.CourseDone, History: to.History, HistoryDay: to.HistoryDay, Settings: to.Settings,
  Family: to.Family, DeleteAccount: to.DeleteAccount, DeleteDone: to.DeleteDone, PushPermission: to.PushPermission, Web: to.Web,
  Oss: to.Oss, FamilyPreview: to.FamilyPreview, Gate: to.Gate, Login: to.Login, LoginEmail: to.LoginEmail, LoginCode: to.LoginCode,
  Relation: to.Relation,
  // [라이터 확인] Code '번호로'·Wait '기다리는 화면으로' — NAMES.md 와 대조 전(W-09 리뷰). 화면 제목(C3 '연결 기다리는 중' 등)에 맞출지 정한다
  Code: to.Code, Wait: to.Wait, AppInfo: to.AppInfo, Album: to.Album, Past: to.Past,
};

type NavRoute = {name: string; state?: NavState};
type NavState = {index?: number; routes: NavRoute[]};

/** 스택에서 바로 아래 화면의 목적지 문구. 아래 화면이 없거나 표에 없으면 null(그때 뒤로 바는 숨는다) */
export function backDestination(state: NavState | undefined): string | null {
  if (!state || state.routes.length < 2) {
    return null;
  }
  const index = state.index ?? state.routes.length - 1;
  let prev: NavRoute | undefined = state.routes[index - 1];
  // 탭처럼 안에 상태가 있으면 그 안에서 보고 있던 화면
  while (prev?.state && prev.state.routes.length > 0) {
    prev = prev.state.routes[prev.state.index ?? 0];
  }
  // 탭 상태가 아직 부모 상태에 실리지 않았으면(처음 그린 직후) 첫 탭(앨범)
  const name = prev?.name === 'Tabs' ? 'Album' : prev?.name;
  return (name && (BACK_TO as Record<string, string>)[name]) ?? null;
}
