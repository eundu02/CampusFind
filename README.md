# CampusFind

동국대학교 WISE캠퍼스 위치 기반 분실물 찾기 및 보상 시스템입니다.

## Frontend

- React + Vite 기반 모바일 우선 UI
- 분실물 리스트, 캠퍼스 지도, 쪽지함, 마이페이지 화면 제공
- 지도 핀은 `주웠어요`는 느낌표, `찾아주세요`는 물음표로 구분
- 사진 GPS 메타데이터가 있으면 습득 위치를 자동 설정하고, 없으면 선택한 건물 위치를 사용
- 기본값은 발표용 mock 데이터이며, `.env`에서 `VITE_USE_BACKEND=true`로 바꾸면 백엔드 API를 호출

```bash
cd frontend
npm install
npm run dev
```

## Backend 연동

프론트엔드는 아래 API 형식에 맞춰 변환 레이어를 포함합니다.

- `GET /api/items`: 게시글 목록 조회
- `POST /api/images/upload`: 이미지 업로드
- `POST /api/items`: 게시글 등록
- `POST /api/rooms`: 쪽지방 생성
- `POST /api/rooms/:id/messages`: 쪽지 전송

로컬에서 프론트와 백엔드를 같이 실행할 때는 Vite proxy가 `/api` 요청을 `http://localhost:5000`으로 넘깁니다.
