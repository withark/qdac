# NextAuth / 소셜 로그인 환경 변수

## 필수 환경 변수

| 변수명 | 설명 | 예시 값 |
|--------|------|---------|
| `NEXTAUTH_URL` | 앱의 canonical URL (운영 도메인 기준 고정). **코드에서 변경 금지.** | `https://www.planic.cloud` |
| `NEXTAUTH_SECRET` | 세션 암호화용 시크릿. 32자 이상 권장. | `openssl rand -base64 32` 로 생성 |
| `GOOGLE_CLIENT_ID` | Google Cloud Console > 사용자 인증 정보 > OAuth 2.0 클라이언트 ID (플래닉 전용 권장) | `123456-xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | 위 클라이언트의 비밀번호 | `GOCSPX-xxxxxxxx` |

## 선택 소셜 로그인 (Kakao/Naver)

| 변수명 | 설명 |
|--------|------|
| `KAKAO_CLIENT_ID` | Kakao Developers OAuth 앱 키 |
| `KAKAO_CLIENT_SECRET` | Kakao OAuth 시크릿 |
| `NAVER_CLIENT_ID` | Naver Developers OAuth 클라이언트 ID |
| `NAVER_CLIENT_SECRET` | Naver OAuth 클라이언트 시크릿 |

## 아이디/비밀번호 로그인(임시 운영)

| 변수명 | 설명 |
|--------|------|
| `ENABLE_EMAIL_PASSWORD_AUTH` | 서버에서 아이디/비밀번호 로그인/가입 활성 (`1`) |
| `NEXT_PUBLIC_ENABLE_CREDENTIAL_AUTH` | 클라이언트 UI에서 아이디/비밀번호 탭 노출 (`1`) |
| `AUTH_SOCIAL_ONLY` | 아이디/비밀번호 로그인 강제 비활성 (`1`) |
| `NEXT_PUBLIC_AUTH_SOCIAL_ONLY` | 클라이언트 UI에서도 소셜-only 강제 (`1`) |

`AUTH_SOCIAL_ONLY=1`이면 credential 관련 활성화 변수보다 우선 적용됩니다.

### 구글 로그인 화면에 예전 서비스명(예: 쿼닥)이 뜰 때

- 표시 이름은 **OAuth 동의 화면의 앱 이름**에서 옵니다. [GOOGLE_OAUTH_PLANIC.md](./GOOGLE_OAUTH_PLANIC.md)에서 프로젝트 확인·플래닉 브랜딩·전용 Client ID 재발급 절차를 참고하세요.

## 로컬 개발

`.env.local` 예시:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev-secret-min-32-characters-long-here
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
# KAKAO_CLIENT_ID=...
# KAKAO_CLIENT_SECRET=...
# NAVER_CLIENT_ID=...
# NAVER_CLIENT_SECRET=...
# ENABLE_EMAIL_PASSWORD_AUTH=1
# NEXT_PUBLIC_ENABLE_CREDENTIAL_AUTH=1
# AUTH_SOCIAL_ONLY=1
# NEXT_PUBLIC_AUTH_SOCIAL_ONLY=1
```

Google Cloud Console에서 "승인된 리디렉션 URI"에 다음을 등록:

- 개발: `http://localhost:3000/api/auth/callback/google`
- 운영(권장): `https://www.planic.cloud/api/auth/callback/google`
- **NEXTAUTH_URL을 `https://planic.cloud`로 둔 경우** 동일하게 추가: `https://planic.cloud/api/auth/callback/google`

### 로그인 후에도 /generate 가 막힐 때 (apex vs www)

- `NEXTAUTH_URL=https://planic.cloud` 이면 OAuth 콜백·세션 쿠키가 **apex**에만 붙을 수 있음.
- 그런데 사이트는 **www.planic.cloud**로 리다이렉트되면, 브라우저는 **호스트 전용 쿠키를 www로 보내지 않아** middleware가 항상 비로그인으로 판단함.
- **권장:** `NEXTAUTH_URL=https://www.planic.cloud` + Google 리디렉션 URI도 www만 사용.
- 코드 쪽에서는 **Vercel Production** 이고 `NEXTAUTH_URL`이 `https://planic.cloud` / `https://www.planic.cloud` 일 때만 세션 쿠키에 **`Domain=.planic.cloud`** + 이름 `next-auth.session-token`(접두사 없음, 브라우저 호환)을 씀. **Preview 배포에는 적용하지 않음.**
- **운영 Production 빌드** 시 `NEXTAUTH_SECRET` 이 없으면 `prebuild` 단계에서 빌드 실패(미들웨어·세션 영구 불능 방지).

### Google Console (리스크 제거)

- 운영 클라이언트에 **최소** 다음 URI 등록:
  - `https://www.planic.cloud/api/auth/callback/google`
  - `https://planic.cloud/api/auth/callback/google` (apex로 들어와도 콜백 가능하도록)

## Vercel 설정

1. Vercel 대시보드 → 프로젝트 선택 → **Settings** → **Environment Variables**
2. 아래 이름으로 추가 (이름을 정확히 맞춤):

| Vercel 변수 이름 | 값 |
|------------------|-----|
| `NEXTAUTH_URL` | 운영: `https://www.planic.cloud` (고정). Preview 등: 해당 배포 URL |
| `NEXTAUTH_SECRET` | 32자 이상 랜덤 문자열 |
| `GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 클라이언트 시크릿 |
| `KAKAO_CLIENT_ID` | Kakao OAuth 클라이언트 ID (선택) |
| `KAKAO_CLIENT_SECRET` | Kakao OAuth 클라이언트 시크릿 (선택) |
| `NAVER_CLIENT_ID` | Naver OAuth 클라이언트 ID (선택) |
| `NAVER_CLIENT_SECRET` | Naver OAuth 클라이언트 시크릿 (선택) |
| `ENABLE_EMAIL_PASSWORD_AUTH` | 아이디/비밀번호 로그인 활성 (임시 운영 시) |
| `NEXT_PUBLIC_ENABLE_CREDENTIAL_AUTH` | 클라이언트 아이디/비밀번호 폼 노출 |
| `AUTH_SOCIAL_ONLY` | 소셜-only 강제 전환 |
| `NEXT_PUBLIC_AUTH_SOCIAL_ONLY` | 클라이언트에서도 소셜-only 강제 |

3. **Production / Preview / Development** 에서 필요한 환경에 체크 후 Save.
4. 재배포 후 로그인 동작 확인.

## 환경 변수 누락 시 증상 (참고)

| 변수 | 누락 시 대표 증상 |
|------|-------------------|
| `NEXTAUTH_URL` | 콜백 후 리다이렉트 오류, 세션 쿠키 도메인 불일치 |
| `NEXTAUTH_SECRET` | 세션 암호화 실패, NextAuth 경고/에러 |
| `GOOGLE_CLIENT_ID` | Google 로그인 버튼 클릭 시 "client_id is required" 등 OAuth 에러 |
| `GOOGLE_CLIENT_SECRET` | Google 인증 후 콜백 단계에서 토큰 교환 실패 |
| `KAKAO_CLIENT_ID`/`KAKAO_CLIENT_SECRET` | Kakao 로그인 버튼 클릭 시 OAuth 초기화/토큰 교환 실패 |
| `NAVER_CLIENT_ID`/`NAVER_CLIENT_SECRET` | Naver 로그인 버튼 클릭 시 OAuth 초기화/토큰 교환 실패 |
