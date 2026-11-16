# 나노바나나(Gemini) 이미지 프롬프트 모음 (2026-11-17)

사용자가 Gemini(나노바나나)로 이미지를 만들어 주시는 방식. **사용자 몫**: 이미지 생성, 상업 이용 약관 확인(미확인), 최종 선택. **리드 몫**: 프롬프트 설계, 결과 일관성 점검, 앱·캔버스 반영, 배경 제거·크기 규격 안내.

## 0. 먼저 알아둘 점
- **UI 아이콘은 AI 이미지로 만들지 않는 것을 권한다.** 래스터(PNG)라 크기마다 선이 흐려지고, 아이콘 20개를 같은 굵기·모서리로 일관되게 뽑기 어렵다. 아이콘은 팀이 SVG로 만들고, 필요하면 아래 §6의 "아이콘 콘셉트 시트"만 AI로 뽑아 **참고용**으로 쓴다.
- AI 이미지가 잘 맞는 것: **해님 캐릭터, 앨범 장식, 빈 상태·오류·축하 일러스트, 앱 아이콘 콘셉트, 스토어 그래픽**.
- AI는 **글자를 틀리게 그린다.** 모든 프롬프트에 "글자·숫자·로고 없음"을 넣고, 한글은 앱 코드에서 올린다.
- 같은 캐릭터를 여러 장 일관되게 얻으려면 **첫 시트를 만든 뒤 그 이미지를 첨부하고** "이 캐릭터와 완전히 같은 얼굴·비율·색으로"를 지시한다(§2). 한 번에 여러 표정을 시트로 뽑는 것이 가장 일관된다.
- **저작권·상표**: 기존 캐릭터(카카오프렌즈, 토스 캐릭터 등)나 유명 일러스트를 닮게 하지 않는다. 프롬프트에 브랜드 이름을 쓰지 않는다.
- 결과는 **4장씩 후보로** 만들고 고른다. 마음에 드는 1장을 기준으로 변형을 늘린다.

## 1. 공통 스타일 문단 (모든 프롬프트 앞에 붙임)
```
Warm, gentle flat illustration for a senior-friendly Korean family app.
Style: simple rounded shapes, thick soft outlines in warm brown (#744821), flat fills, very light paper-grain texture only in the background, no gradients except a faint sun glow, no harsh shadows.
Palette: cream paper #F6F3EE, warm brown #744821, sunshine yellow #FFC93C, sun-ray orange #F59E0B, blush pink #FF9E7A, soft sage green #CDEBDD, tan #A67C5A. No other saturated colors.
Mood: calm, nostalgic, kind, never childish or loud. Readable at small sizes, high clarity.
Strict rules: no text, no letters, no numbers, no logos, no watermarks, no real people, no existing characters or brands. Centered subject with generous empty margin.
```

## 2. 캐릭터 "해님" (가장 먼저)
**2-1. 표정 시트 (한 장에 여섯 표정 → 일관성 확보)**
```
[공통 스타일 문단]
Character design sheet of "Haenim", a friendly round sun mascot for an app for elderly Korean users. A round yellow face (#FFC93C) with soft rounded short rays around it (#F59E0B), simple dot eyes, tiny gentle smile, blush cheeks (#FF9E7A), thick brown outline. No arms or legs, only the face and rays.
Show exactly 6 expressions in a clean 3x2 grid on a plain cream background, same size, same proportions, same line weight: (1) calm default smile, (2) big happy praise with closed smiling eyes, (3) gently worried with slightly lowered brows (kind, not scary), (4) sleepy waiting with half-closed eyes, (5) cheering with a small floating heart, (6) thinking with eyes looking up.
Keep the face extremely simple so it stays readable at 40px. Same character in all six.
```
**2-2. 표정 하나만 크게(첨부 이미지 사용)**: 2-1 결과 1장을 첨부하고
```
Use the attached image as the exact character reference. Draw only expression number [N] ([표정 설명]) large and centered on a pure flat white background (#FFFFFF), no shadow, no ground. Keep the identical face shape, ray count, ray length, colors, outline thickness and proportions. No text.
```
**2-3. 스티커(연속일 도장)**
```
Use the attached image as the exact character reference. A round die-cut sticker of this sun character with a thick white sticker border and a very subtle soft drop shadow, shown on a flat pure white background. Make 3 variants in a row, each rotated slightly differently (-6°, +3°, +8°), same expression (calm smile). No text.
```

## 3. 앨범 장식 (각각 따로, 흰 배경)
```
[공통 스타일 문단]
A set of photo-album decorations on a pure flat white background, each separated with wide margin, no shadow on the ground: (a) four identical triangular photo corners in tan leather-paper (#A67C5A), (b) three pieces of semi-transparent masking tape in different warm beige tones, slightly torn ends, (c) a long horizontal hand-stitched wavy line in tan thread (#A67C5A) that tiles horizontally with identical ends, (d) an empty white instant-photo frame (polaroid style, thicker bottom margin) with a very soft shadow and the inside left plain light grey.
```
**종이 결(배경 질감)**: `A seamless, very subtle warm cream paper texture, almost flat (#F6F3EE) with faint fibers, tileable, no pattern, no text, low contrast.`

## 4. 빈 상태·오류·축하 일러스트 (4장, 각각 따로 요청)
```
[공통 스타일 문단]
Small spot illustration, flat white background: [장면] featuring the sun mascot as in the attached reference image (identical character). Minimal props, one clear idea. No text.
```
장면 목록: ① 오늘의 사진이 아직 없어요(빈 사진 액자를 보며 기다리는 해님), ② 인터넷이 끊겼어요(끊긴 구름/전선 앞에서 걱정하는 해님, 무섭지 않게), ③ 연결이 끊겼어요(둘로 나뉜 끈과 걱정하는 해님), ④ 오늘 다 했어요(작은 별 도장과 활짝 웃는 해님).

## 5. 앱 아이콘·스토어 그래픽 콘셉트
**런처 아이콘 콘셉트(3안 요청)**
```
[공통 스타일 문단]
App launcher icon concept, square, rounded-friendly composition: the sun mascot peeking from behind an open photo album page, bold simple shapes, 2-3 colors dominant, no text, centered with safe margin (keep important shapes inside the center 66%). Give 3 distinct compositions. Flat background in warm cream.
```
**스토어 피처 그래픽(후속)**: 1024x500 가로, 해님·앨범 장식, 글자 없음(글자는 후작업).

## 6. (참고용) 아이콘 콘셉트 시트
```
[공통 스타일 문단]
Concept sheet (reference only) of 12 simple rounded line icons for an app for elderly users, in a 4x3 grid with equal size: speaker with sound waves, check mark, left arrow, home, heart, bell, lock, refresh, camera, pencil, share arrow, warning triangle. Consistent thick brown stroke, rounded ends, no fills except tiny accents, no text.
```
이 시트는 **방향 참고용**이다. 실제 아이콘은 팀이 SVG로 같은 문법으로 다시 만든다.

## 7. 이미지 받는 방법과 규격
- 저장 위치: `design-system/assets/_incoming/` (아직 만들지 않은 폴더, 사용자가 올려 주시면 제가 정리). 파일명 `char-sheet-1.png`, `sun-happy.png`, `album-corners.png`, `empty-no-photo.png`, `appicon-1.png`처럼 내용을 적는다.
- 해상도: 가능한 가장 큰 크기(2048px 이상), PNG.
- **배경**: 투명 PNG는 생성이 불안정하므로 **순수 흰색 단색 배경**으로 받고, 제가 배경 제거·크기별 변환 방법을 안내한다. 순수 흰색이 안 나오면 그 이미지는 후보에서 제외한다.
- 앱에서의 쓰임: 해상도 3종(1x/2x/3x) PNG 또는 WebP로 변환해 번들하고, 큰 일러스트는 용량 한도(제안 300KB 이하)를 둔다.
- **사용자 확인 필요**: Gemini 생성 이미지의 **상업 이용 조건**과 AI 생성물 표기 의무(스토어 심사 포함)를 직접 확인해 주세요(제가 확인하지 못했습니다).

## 8. 검수 체크리스트 (리드가 받은 이미지에 적용)
- [ ] 6표정이 같은 캐릭터로 보이는가(얼굴 비율·광선 수·선 굵기·색)
- [ ] 40px로 줄여도 표정이 구분되는가
- [ ] 글자·숫자·워터마크·이상한 손가락이 없는가(손은 처음부터 없음)
- [ ] 걱정 표정이 어르신에게 무섭지 않은가
- [ ] 흰 배경이 순수 흰색이라 배경 제거가 되는가
- [ ] 앨범 장식이 가로 반복·모서리 부착에 쓸 수 있는가
- [ ] 기존 캐릭터·브랜드를 닮지 않았는가
- [ ] v3 팔레트(크림·갈색·노랑)에서 벗어나지 않았는가
