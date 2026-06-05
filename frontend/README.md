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

## 백엔드 연결

기본값은 mock 데이터입니다. 백엔드와 연결하려면 `.env`를 만들고 아래처럼 설정합니다.

```bash
VITE_USE_BACKEND=true
VITE_API_BASE_URL=/api
VITE_DEMO_USER_ID=1
```

개발 서버는 `/api` 요청을 `http://localhost:5000`으로 proxy합니다.
