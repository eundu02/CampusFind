# CampusFind Frontend

동국대학교 WISE캠퍼스 분실물 찾기 서비스의 프론트엔드입니다.

## 실행

```bash
npm install
npm run dev
```

## 화면 구성

- 분실물 리스트: 검색, 카테고리, 습득/요청/사례금 필터
- 캠퍼스 지도: 확대/축소, 드래그 이동, 습득/요청 핀 구분
- 쪽지함: 받은 쪽지, 보낸 쪽지, 안 읽은 쪽지 수
- 마이페이지: 프로필 사진, 닉네임, 내 게시글, 이용 규칙
- JWT 인증: 로그인, 회원가입, 로그아웃, 보호 API 인증 헤더 전송

## 백엔드 연결

기본값은 mock 데이터입니다. 백엔드와 연결하려면 `.env`를 만들고 아래처럼 설정합니다.

```bash
VITE_USE_BACKEND=true
VITE_API_BASE_URL=/api
VITE_DEMO_USER_ID=1
VITE_KAKAO_MAP_APP_KEY=your_kakao_javascript_key
```

개발 서버는 `/api` 요청을 `http://localhost:5000`으로 proxy합니다.

로그인과 회원가입은 `/api/auth/login`, `/api/auth/signup`을 호출합니다. 성공 시 JWT를 localStorage에 저장하고 게시글 등록, 이미지 업로드, 쪽지 API 호출에 `Authorization: Bearer <token>` 헤더를 붙입니다.

## 카카오맵 설정

`VITE_KAKAO_MAP_APP_KEY`가 설정되어 있으면 Kakao Maps JavaScript SDK를 불러와 실제 지도에 핀을 표시합니다. 앱키가 없거나 SDK 로드에 실패하면 `public/assets/campus-map-base.png` 정적 지도 fallback을 사용합니다.

Kakao Developers에서 개발 주소와 배포 주소를 JavaScript 키 허용 도메인에 등록해야 합니다.
