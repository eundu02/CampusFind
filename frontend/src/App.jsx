import { useEffect, useMemo, useRef, useState } from "react";
import exifr from "exifr";
import { createItemOnApi, fetchItemsFromApi, isBackendEnabled, sendMessageOnApi } from "./api.js";
import { campusMapPoints, campusSpots, categories, findCampusMapPoint, initialItems } from "./data.js";
import {
  BackIcon,
  CloseIcon,
  InboxIcon,
  ListIcon,
  MapIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  UserIcon,
} from "./icons.jsx";

const typeLabels = {
  found: "주웠어요",
  request: "찾아주세요",
};

const quickFilters = [
  { id: "found", label: "습득" },
  { id: "request", label: "요청" },
  { id: "reward", label: "사례금" },
];

const headerTitles = {
  list: "분실물 리스트",
  map: "캠퍼스 지도",
  inbox: "쪽지함",
  profile: "마이페이지",
  "my-lost": "분실물 등록리스트",
  "my-found": "찾은 리스트",
  rules: "이용 규칙",
};

const initialMessages = [
  {
    id: 101,
    direction: "received",
    itemId: 1,
    sender: "도서관 근처 학생",
    time: "5분 전",
    unread: true,
    message: "이어폰 케이스 사진을 보니 제 물건 같습니다. 오늘 5시 이후 도서관 1층에서 확인 가능할까요?",
  },
  {
    id: 102,
    direction: "received",
    itemId: 2,
    sender: "학생회관 안내데스크",
    time: "18분 전",
    unread: true,
    message: "파란색 카드지갑과 비슷한 물건이 안내데스크에 맡겨졌습니다. 학생증 이름 일부를 확인해야 합니다.",
  },
  {
    id: 103,
    direction: "sent",
    itemId: 3,
    sender: "나",
    time: "어제",
    unread: false,
    message: "학생증 주인 확인을 위해 학과와 이름 첫 글자를 알려주세요. 확인되면 자연과학관 앞에서 전달드릴게요.",
  },
];

const serviceRules = [
  {
    title: "사례금은 자동 청구권이 아닙니다",
    body:
      "분실물을 찾아주었다고 해서 무조건 사례금을 받을 수 있는 것은 아닙니다. 사례금은 분실자가 게시글에 명시한 경우에만 약속으로 취급합니다.",
  },
  {
    title: "등록한 사례금 약속은 지켜야 합니다",
    body:
      "분실자가 사례금을 등록했고 실제 물건을 돌려받았다면 정해진 사례금을 지급해야 합니다. 반복적으로 지급을 거부하면 서비스 이용이 제한될 수 있습니다.",
  },
  {
    title: "물건 확인 후 전달합니다",
    body:
      "학생증, 지갑, 전자기기처럼 개인정보가 포함된 물건은 이름 일부나 물건 특징을 확인한 뒤 전달합니다. 확인 없이 임의로 넘기지 않습니다.",
  },
  {
    title: "개인정보는 최소한만 공유합니다",
    body:
      "게시글에는 전화번호, 학번 전체, 주소처럼 민감한 정보를 직접 공개하지 않습니다. 연락은 쪽지로 시작하고 필요한 정보만 단계적으로 공유합니다.",
  },
  {
    title: "허위 등록과 장난 제보는 제한됩니다",
    body:
      "없는 물건을 등록하거나 타인의 물건을 고의로 숨기는 행위, 반복적인 장난 쪽지는 신고 대상입니다. 운영자는 관련 게시글과 쪽지를 제한할 수 있습니다.",
  },
  {
    title: "귀중품은 공식 보관처를 우선합니다",
    body:
      "현금, 신분증, 카드, 고가 전자기기 등은 가능한 경우 학과 사무실, 학생회관 안내데스크, 분실물 담당 부서에 맡기고 보관 위치를 게시합니다.",
  },
  {
    title: "거래보다 반환이 우선입니다",
    body:
      "이 서비스의 목적은 사례금 거래가 아니라 캠퍼스 안에서 물건을 빠르게 돌려주는 것입니다. 불필요한 조건을 붙이거나 과도한 보상을 요구하지 않습니다.",
  },
];

const emptyDraft = {
  type: "found",
  title: "",
  category: "electronics",
  description: "",
  place: "도서관",
  reward: "",
  photoName: "",
  photoFile: null,
  imageLabel: "",
  color: "#3182f6",
  location: null,
  status: "idle",
};

const mapImageSize = {
  width: 1340,
  height: 1174,
};

const campusBounds = {
  north: 35.86645,
  south: 35.85805,
  west: 129.19045,
  east: 129.19815,
};

const buildingSearchSpots = [
  { id: 1, name: "학생회관", lat: 35.8620820, lng: 129.1961830 },
  { id: 3, name: "자연과학관", lat: 35.8631560, lng: 129.1965830 },
  { id: 4, name: "문무관", lat: 35.8625480, lng: 129.1972160 },
  { id: 5, name: "에너지공학관", lat: 35.8634350, lng: 129.1954990 },
  { id: 6, name: "100주년기념관", lat: 35.8643850, lng: 129.1945730 },
  { id: 7, name: "중앙도서관", lat: 35.8626220, lng: 129.1944640 },
  { id: 8, name: "원효관", lat: 35.8618370, lng: 129.1935530 },
  { id: 9, name: "진흥관", lat: 35.8632470, lng: 129.1932580 },
  { id: 10, name: "평생교육원", lat: 35.8625830, lng: 129.1918100 },
  { id: 11, name: "금장생활관 반야동", lat: 35.8636610, lng: 129.1920340 },
  { id: 12, name: "조형관", lat: 35.8631040, lng: 129.1914490 },
  { id: 13, name: "금장생활관 미륵동", lat: 35.8638620, lng: 129.1916020 },
  { id: 14, name: "금장생활관 보현동", lat: 35.8639100, lng: 129.1913520 },
  { id: 15, name: "금장생활관 금강동", lat: 35.8636720, lng: 129.1909360 },
  { id: 16, name: "대운동장", lat: 35.8606090, lng: 129.1945690 },
].map((building) => {
  const mapPoint = findCampusMapPoint(building.name);

  if (!mapPoint) return building;

  return {
    ...building,
    mapX: mapPoint.x,
    mapY: mapPoint.y,
  };
});

function App() {
  const [authMode, setAuthMode] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [activeTab, setActiveTab] = useState("list");
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [quickFilter, setQuickFilter] = useState("all");
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [sentMessages, setSentMessages] = useState([]);
  const [messages, setMessages] = useState(initialMessages);
  const [profile, setProfile] = useState({
    nickname: "동국 분실물 매니저",
    avatarUrl: "",
    avatarName: "",
  });

  useEffect(() => {
    let ignore = false;

    if (!isBackendEnabled()) return undefined;

    fetchItemsFromApi()
      .then((remoteItems) => {
        if (!ignore && remoteItems.length > 0) {
          setItems(remoteItems);
        }
      })
      .catch((error) => {
        console.warn("게시글 API를 불러오지 못해 mock 데이터를 유지합니다.", error);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items.filter((item) => {
      const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
      const matchesQuickFilter =
        quickFilter === "all" ||
        item.type === quickFilter ||
        (quickFilter === "reward" && item.reward > 0);
      const searchable = `${item.title} ${item.description} ${item.place}`.toLowerCase();
      return matchesQuickFilter && matchesCategory && searchable.includes(normalizedQuery);
    });
  }, [items, query, selectedCategory, quickFilter]);

  const stats = useMemo(() => {
    return {
      found: items.filter((item) => item.type === "found").length,
      request: items.filter((item) => item.type === "request").length,
      reward: items.filter((item) => item.reward > 0).length,
    };
  }, [items]);

  const itemById = useMemo(() => {
    return new Map(items.map((item) => [item.id, item]));
  }, [items]);

  const unreadMessages = useMemo(() => {
    return messages.filter((message) => message.direction === "received" && message.unread).length;
  }, [messages]);

  const myLostItems = useMemo(() => {
    return items.filter((item) => item.type === "request");
  }, [items]);

  const myFoundItems = useMemo(() => {
    return items.filter((item) => item.type === "found");
  }, [items]);

  async function addItem(draft) {
    const spot = campusSpots.find((item) => item.name === draft.place) ?? campusSpots[0];
    const location = draft.location ?? {
      x: spot.x,
      y: spot.y,
      lat: spot.lat,
      lng: spot.lng,
      source: "MANUAL_SELECT",
    };

    const item = {
      id: Date.now(),
      type: draft.type,
      category: draft.category,
      title: draft.title,
      description: draft.description,
      place: draft.place,
      time: "방금",
      imageLabel: draft.type === "found" ? draft.imageLabel || draft.photoName || "첨부 사진" : null,
      color: draft.color,
      location,
      reward: draft.type === "request" ? Number(draft.reward || 0) : 0,
    };

    setItems((prev) => [item, ...prev]);
    setSelectedItem(item);
    setIsCreateOpen(false);

    if (!isBackendEnabled()) return;

    try {
      const savedItem = await createItemOnApi(draft);
      if (!savedItem) return;

      setItems((prev) => prev.map((entry) => (entry.id === item.id ? savedItem : entry)));
      setSelectedItem(savedItem);
    } catch (error) {
      console.warn("게시글 API 저장에 실패해 로컬 등록 상태를 유지합니다.", error);
    }
  }

  async function sendMessage(item, message) {
    const sentMessage = {
      id: Date.now(),
      direction: "sent",
      itemId: item.id,
      sender: "나",
      time: "방금",
      unread: false,
      message,
    };

    setSentMessages((prev) => [sentMessage, ...prev]);
    setMessages((prev) => [sentMessage, ...prev]);

    if (!isBackendEnabled()) return;

    try {
      await sendMessageOnApi(item, message);
    } catch (error) {
      console.warn("쪽지 API 전송에 실패해 로컬 전송 상태를 유지합니다.", error);
    }
  }

  function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setProfile((prev) => ({
      ...prev,
      avatarUrl: URL.createObjectURL(file),
      avatarName: file.name,
    }));
  }

  function handleBack() {
    if (activeTab === "rules" || activeTab === "my-lost" || activeTab === "my-found") {
      setActiveTab("profile");
      return;
    }

    setActiveTab("list");
  }

  function completeAuth(user = {}) {
    setAuthUser({
      email: user.email ?? verifiedEmail,
      name: user.name ?? profile.nickname,
    });

    if (user.name) {
      setProfile((prev) => ({ ...prev, nickname: user.name }));
    }

    setAuthMode(null);
  }

  function openRegister() {
    setVerifiedEmail("");
    setAuthMode("register-email");
  }

  function logout() {
    setAuthUser(null);
    setActiveTab("profile");
  }

  return (
    <div className="app-shell">
      <main className={`phone-frame ${authMode ? "auth-frame" : ""}`}>
        {authMode ? (
          <AuthScreen
            mode={authMode}
            verifiedEmail={verifiedEmail}
            onClose={() => setAuthMode(null)}
            onLogin={completeAuth}
            onShowLogin={() => setAuthMode("login")}
            onShowRegister={openRegister}
            onEmailVerified={(email) => {
              setVerifiedEmail(email);
              setAuthMode("register-details");
            }}
            onRegisterComplete={completeAuth}
          />
        ) : (
          <>
            <section className="screen">
              <AppHeader
                stats={stats}
                activeTab={activeTab}
                quickFilter={quickFilter}
                hasQuery={Boolean(query)}
                onQuickFilterChange={(filter) => setQuickFilter((prev) => (prev === filter ? "all" : filter))}
                onSearch={() => {
                  setActiveTab("list");
                  setIsSearchOpen((prev) => !prev);
                }}
                onCreate={() => setIsCreateOpen(true)}
                onProfile={() => setActiveTab("profile")}
                onBack={handleBack}
              />

              {activeTab === "list" && (
                <ListView
                  key="list"
                  items={filteredItems}
                  query={query}
                  isSearchOpen={isSearchOpen}
                  selectedCategory={selectedCategory}
                  onQueryChange={setQuery}
                  onCategoryChange={setSelectedCategory}
                  onSelectItem={setSelectedItem}
                />
              )}

              {activeTab === "map" && (
                <MapView
                  key="map"
                  items={filteredItems}
                  selectedCategory={selectedCategory}
                  onCategoryChange={setSelectedCategory}
                  onSelectItem={setSelectedItem}
                />
              )}

              {activeTab === "inbox" && (
                <InboxView
                  messages={messages}
                  itemById={itemById}
                  onSelectMessage={(message) => {
                    setMessages((prev) =>
                      prev.map((item) => (item.id === message.id ? { ...item, unread: false } : item)),
                    );
                    setSelectedMessage({ ...message, unread: false });
                  }}
                />
              )}

              {activeTab === "profile" && (
                <ProfileView
                  authUser={authUser}
                  profile={profile}
                  foundCount={myFoundItems.length}
                  lostCount={myLostItems.length}
                  onAvatarChange={handleAvatarChange}
                  onNicknameChange={(nickname) => setProfile((prev) => ({ ...prev, nickname }))}
                  onLogin={() => setAuthMode("login")}
                  onRegister={openRegister}
                  onLogout={logout}
                  onNavigate={setActiveTab}
                />
              )}

              {activeTab === "my-lost" && (
                <MyItemsView
                  items={myLostItems}
                  emptyText="등록한 찾아주세요 게시글이 없습니다."
                  description="내가 잃어버려 등록한 물건을 한곳에서 확인합니다."
                  onSelectItem={setSelectedItem}
                />
              )}

              {activeTab === "my-found" && (
                <MyItemsView
                  items={myFoundItems}
                  emptyText="등록한 습득 게시글이 없습니다."
                  description="내가 주워서 등록한 물건과 보관 위치를 확인합니다."
                  onSelectItem={setSelectedItem}
                />
              )}

              {activeTab === "rules" && <RulesView />}

              {["list", "map", "inbox"].includes(activeTab) && (
                <BottomNav activeTab={activeTab} unreadCount={unreadMessages} onChange={setActiveTab} />
              )}
            </section>

            {selectedItem && (
              <DetailSheet
                item={selectedItem}
                sentCount={sentMessages.filter((message) => message.itemId === selectedItem.id).length}
                onClose={() => setSelectedItem(null)}
                onSendMessage={sendMessage}
              />
            )}

            {selectedMessage && (
              <MessageSheet
                message={selectedMessage}
                item={itemById.get(selectedMessage.itemId)}
                onClose={() => setSelectedMessage(null)}
                onOpenItem={(item) => {
                  setSelectedMessage(null);
                  setSelectedItem(item);
                }}
              />
            )}

            {isCreateOpen && (
              <CreateSheet
                onClose={() => setIsCreateOpen(false)}
                onSubmit={addItem}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function AuthScreen({
  mode,
  verifiedEmail,
  onClose,
  onLogin,
  onShowLogin,
  onShowRegister,
  onEmailVerified,
  onRegisterComplete,
}) {
  if (mode === "register-email") {
    return (
      <EmailVerificationScreen
        onClose={onClose}
        onShowLogin={onShowLogin}
        onEmailVerified={onEmailVerified}
      />
    );
  }

  if (mode === "register-details") {
    return (
      <RegisterDetailsScreen
        email={verifiedEmail}
        onClose={onClose}
        onShowLogin={onShowLogin}
        onRegisterComplete={onRegisterComplete}
      />
    );
  }

  return (
    <LoginScreen
      onClose={onClose}
      onLogin={onLogin}
      onShowRegister={onShowRegister}
    />
  );
}

function AuthShell({ title, children, footer, onClose, onSubmit }) {
  return (
    <section className="auth-screen">
      <button className="icon-button auth-close" type="button" onClick={onClose} aria-label="닫기">
        <CloseIcon />
      </button>

      <form className="auth-form" onSubmit={onSubmit}>
        <div className="auth-head">
          <p className="eyebrow">캠퍼스 분실물</p>
          <h1>{title}</h1>
        </div>
        {children}
      </form>

      <div className="auth-footer">{footer}</div>
    </section>
  );
}

function LoginScreen({ onClose, onLogin, onShowRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!isDonggukEmail(normalizedEmail)) {
      setError("동국대 이메일(@dongguk.ac.kr)만 사용할 수 있습니다.");
      return;
    }

    if (!password.trim()) {
      setError("비밀번호를 입력해 주세요.");
      return;
    }

    setError("");
    onLogin({ email: normalizedEmail });
  }

  return (
    <AuthShell
      title="로그인"
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={(
        <>
          <span>계정이 없나요?</span>
          <button className="inline-link" type="button" onClick={onShowRegister}>회원가입</button>
        </>
      )}
    >
      <div className="auth-fields">
        <label className="field">
          <span>이메일</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="student@dongguk.ac.kr"
            autoComplete="email"
          />
        </label>
        <label className="field">
          <span>비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="비밀번호"
            autoComplete="current-password"
          />
        </label>
        {error && <p className="field-error">{error}</p>}
        <button className="primary-action auth-submit" type="submit">로그인</button>
      </div>
    </AuthShell>
  );
}

function EmailVerificationScreen({ onClose, onShowLogin, onEmailVerified }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentCode, setSentCode] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function sendVerificationEmail(message = "인증번호를 발송했습니다.") {
    const normalizedEmail = email.trim().toLowerCase();

    if (!isDonggukEmail(normalizedEmail)) {
      setError("@dongguk.ac.kr 이메일만 인증할 수 있습니다.");
      setNotice("");
      return;
    }

    const nextCode = String(Math.floor(100000 + Math.random() * 900000));
    setSentCode(nextCode);
    setCode("");
    setError("");
    setNotice(message);
    window.alert(`인증번호: ${nextCode}`);
  }

  function handleSubmit(event) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!sentCode) {
      sendVerificationEmail();
      return;
    }

    if (code.trim() !== sentCode) {
      setNotice("");
      setError("인증번호가 일치하지 않습니다.");
      return;
    }

    setNotice("");
    setError("");
    onEmailVerified(normalizedEmail);
  }

  return (
    <AuthShell
      title="회원가입"
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={(
        <>
          <span>이미 계정이 있나요?</span>
          <button className="inline-link" type="button" onClick={onShowLogin}>로그인</button>
        </>
      )}
    >
      <div className="auth-fields">
        <div className="auth-step">1 / 2 이메일 인증</div>
        <label className="field">
          <span>학교 이메일</span>
          <input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setSentCode("");
              setCode("");
              setNotice("");
              setError("");
            }}
            placeholder="student@dongguk.ac.kr"
            autoComplete="email"
          />
        </label>
        {sentCode && (
          <label className="field">
            <span>인증번호</span>
            <input
              inputMode="numeric"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6자리 인증번호"
            />
          </label>
        )}
        {notice && <p className="field-success">{notice}</p>}
        {error && <p className="field-error">{error}</p>}
        <button className="primary-action auth-submit" type="submit">
          {sentCode ? "인증 확인 " : "인증번호 발송"} 
        </button>
        {sentCode && (
          <button
            className="secondary-action auth-submit"
            type="button"
            onClick={() => sendVerificationEmail("인증번호를 다시 발송했습니다.")}
          >
            인증번호 재발송
          </button>
        )}
      </div>
    </AuthShell>
  );
}

function RegisterDetailsScreen({ email, onClose, onShowLogin, onRegisterComplete }) {
  const [form, setForm] = useState({
    name: "",
    studentId: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const passwordMismatch = Boolean(form.confirmPassword) && form.password !== form.confirmPassword;

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!form.name.trim() || !form.studentId.trim() || !form.password || !form.confirmPassword) {
      setError("모든 항목을 입력해 주세요.");
      return;
    }

    if (passwordMismatch) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setError("");
    onRegisterComplete({ name: form.name.trim(), email });
  }

  return (
    <AuthShell
      title="회원가입"
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={(
        <>
          <span>이미 계정이 있나요?</span>
          <button className="inline-link" type="button" onClick={onShowLogin}>로그인</button>
        </>
      )}
    >
      <div className="auth-fields">
        <div className="auth-step">2 / 2 기본 정보</div>
        <label className="field">
          <span>이름</span>
          <input
            value={form.name}
            onChange={(event) => updateForm("name", event.target.value)}
            placeholder="홍길동"
            autoComplete="name"
          />
        </label>
        <label className="field">
          <span>학번</span>
          <input
            inputMode="numeric"
            value={form.studentId}
            onChange={(event) => updateForm("studentId", event.target.value.replace(/\D/g, ""))}
            placeholder="2026000000"
          />
        </label>
        <label className="field auth-readonly">
          <span>이메일</span>
          <input value={email} readOnly />
        </label>
        <label className="field">
          <span>비밀번호</span>
          <input
            type="password"
            value={form.password}
            onChange={(event) => updateForm("password", event.target.value)}
            placeholder="비밀번호"
            autoComplete="new-password"
          />
        </label>
        <label className="field">
          <span>비밀번호 확인</span>
          <input
            type="password"
            value={form.confirmPassword}
            onChange={(event) => updateForm("confirmPassword", event.target.value)}
            placeholder="비밀번호 확인"
            autoComplete="new-password"
          />
        </label>
        {passwordMismatch && <p className="field-error">비밀번호가 일치하지 않습니다.</p>}
        {error && !passwordMismatch && <p className="field-error">{error}</p>}
        <button className="primary-action auth-submit" type="submit">가입하기</button>
      </div>
    </AuthShell>
  );
}

function isDonggukEmail(email) {
  return /^[^\s@]+@dongguk\.ac\.kr$/.test(email);
}

function AppHeader({
  stats,
  activeTab,
  quickFilter,
  hasQuery,
  onQuickFilterChange,
  onSearch,
  onCreate,
  onProfile,
  onBack,
}) {
  const showMainActions = ["list", "map", "inbox"].includes(activeTab);
  const showBack = ["profile", "my-lost", "my-found", "rules"].includes(activeTab);
  const showSummary = activeTab === "list" || activeTab === "map";

  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">캠퍼스 분실물</p>
        <h1>{headerTitles[activeTab]}</h1>
      </div>
      <div className="header-actions">
        {showBack && (
          <button className="icon-button" type="button" onClick={onBack} aria-label="뒤로가기">
            <BackIcon />
          </button>
        )}
        {showMainActions && activeTab === "list" && (
          <button
            className={`icon-button ${hasQuery ? "selected" : ""}`}
            type="button"
            onClick={onSearch}
            aria-label="검색"
          >
            <SearchIcon />
          </button>
        )}
        {showMainActions && (
          <>
            <button className="icon-button primary" type="button" onClick={onCreate} aria-label="게시물 등록">
              <PlusIcon />
            </button>
            <button className="icon-button" type="button" onClick={onProfile} aria-label="마이페이지">
              <UserIcon />
            </button>
          </>
        )}
      </div>
      {showSummary && (
        <div className="summary-strip" aria-label="분실물 현황 필터">
          {quickFilters.map((filter) => (
            <button
              key={filter.id}
              className={quickFilter === filter.id ? "selected" : ""}
              type="button"
              onClick={() => onQuickFilterChange(filter.id)}
              aria-pressed={quickFilter === filter.id}
            >
              {filter.label} {stats[filter.id]}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}

function ListView({ items, query, isSearchOpen, selectedCategory, onQueryChange, onCategoryChange, onSelectItem }) {
  return (
    <div className="content-view">
      {(isSearchOpen || query) && (
        <div className="search-row">
          <label className="search-box">
            <SearchIcon />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="물품, 장소 검색"
              autoFocus
            />
          </label>
        </div>
      )}

      <CategoryRail selectedCategory={selectedCategory} onCategoryChange={onCategoryChange} />

      <section className="post-list" aria-label="분실물 게시글">
        {items.length > 0 ? (
          items.map((item) => (
            <PostCard key={item.id} item={item} onClick={() => onSelectItem(item)} />
          ))
        ) : (
          <div className="empty-state">검색 결과가 없습니다.</div>
        )}
      </section>
    </div>
  );
}

function CategoryRail({ selectedCategory, onCategoryChange }) {
  return (
    <div className="category-rail" aria-label="카테고리">
      {categories.map((category) => (
        <button
          key={category.id}
          className={`category-chip ${selectedCategory === category.id ? "selected" : ""}`}
          type="button"
          onClick={() => onCategoryChange(category.id)}
        >
          {category.label}
        </button>
      ))}
    </div>
  );
}

function PostCard({ item, onClick }) {
  return (
    <button className="post-card" type="button" onClick={onClick}>
      <ItemVisual item={item} />
      <span className={`status-badge ${item.type}`}>{typeLabels[item.type]}</span>
      <div className="post-copy">
        <div className="post-title-row">
          <h2>{item.title}</h2>
          {item.reward > 0 && <strong className="reward">{item.reward.toLocaleString()}원</strong>}
        </div>
        <p>{item.description}</p>
        <div className="meta-row">
          <span>{item.place}</span>
          <span>{item.time}</span>
        </div>
      </div>
    </button>
  );
}

function ItemVisual({ item }) {
  if (item.type === "request") {
    return (
      <div className="item-visual map-thumb">
        <PinIcon />
      </div>
    );
  }

  return (
    <div className="item-visual" style={{ "--item-color": item.color }}>
      <span>{item.imageLabel?.slice(0, 4)}</span>
    </div>
  );
}

function MapView({ items, selectedCategory, onCategoryChange, onSelectItem }) {
  return (
    <div className="content-view map-content">
      <CategoryRail selectedCategory={selectedCategory} onCategoryChange={onCategoryChange} />
      <section className="map-panel" aria-label="캠퍼스 지도">
        <OfficialCampusMap items={items} onSelectItem={onSelectItem} />
      </section>

      <div className="legend-row">
        <span><i className="legend-pin found">!</i>주웠어요</span>
        <span><i className="legend-pin request">?</i>찾아주세요</span>
      </div>
    </div>
  );
}

function InboxView({ messages, itemById, onSelectMessage }) {
  const receivedMessages = messages.filter((message) => message.direction === "received");
  const sentMessages = messages.filter((message) => message.direction === "sent");
  const unreadCount = receivedMessages.filter((message) => message.unread).length;

  return (
    <div className="content-view inbox-view">
      <section className="inbox-summary" aria-label="쪽지 현황">
        <div>
          <strong>{receivedMessages.length}</strong>
          <span>받은 쪽지</span>
        </div>
        <div>
          <strong>{sentMessages.length}</strong>
          <span>보낸 쪽지</span>
        </div>
        <div>
          <strong>{unreadCount}</strong>
          <span>안 읽음</span>
        </div>
      </section>

      <MessageListSection
        title="받은 쪽지"
        messages={receivedMessages}
        itemById={itemById}
        emptyText="아직 받은 쪽지가 없습니다."
        onSelectMessage={onSelectMessage}
      />
      <MessageListSection
        title="보낸 쪽지"
        messages={sentMessages}
        itemById={itemById}
        emptyText="아직 보낸 쪽지가 없습니다."
        onSelectMessage={onSelectMessage}
      />
    </div>
  );
}

function MessageListSection({ title, messages, itemById, emptyText, onSelectMessage }) {
  return (
    <section className="message-section" aria-label={title}>
      <div className="section-title-row">
        <h2>{title}</h2>
        <span>{messages.length}</span>
      </div>
      <div className="message-list">
        {messages.length > 0 ? (
          messages.map((message) => {
            const item = itemById.get(message.itemId);
            return (
              <button
                key={message.id}
                className={`message-card ${message.unread ? "unread" : ""}`}
                type="button"
                onClick={() => onSelectMessage(message)}
              >
                <div className="message-card-top">
                  <span className={`message-direction ${message.direction}`}>
                    {message.direction === "received" ? "받은 쪽지" : "보낸 쪽지"}
                  </span>
                  <span>{message.time}</span>
                </div>
                <h3>{item?.title ?? "삭제된 게시글"}</h3>
                <p>{message.message}</p>
                <div className="message-meta-row">
                  <span>{message.direction === "received" ? message.sender : "나"}</span>
                  {item && <span>{item.place}</span>}
                </div>
              </button>
            );
          })
        ) : (
          <div className="empty-state">{emptyText}</div>
        )}
      </div>
    </section>
  );
}

function ProfileView({
  authUser,
  profile,
  foundCount,
  lostCount,
  onAvatarChange,
  onNicknameChange,
  onLogin,
  onRegister,
  onLogout,
  onNavigate,
}) {
  if (!authUser) {
    return (
      <div className="content-view profile-view">
        <section className="profile-auth-panel">
          <div className="profile-auth-avatar">
            <UserIcon />
          </div>
          <div className="profile-auth-copy">
            <h2>로그인이 필요합니다</h2>
            <p>마이페이지와 내 게시글을 확인할 수 있습니다.</p>
          </div>
          <div className="profile-auth-actions">
            <button className="primary-action" type="button" onClick={onLogin}>
              로그인
            </button>
            <button className="secondary-action" type="button" onClick={onRegister}>
              회원가입
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="content-view profile-view">
      <section className="profile-card">
        <label className="avatar-edit">
          <input accept="image/*" type="file" onChange={onAvatarChange} />
          <span className="avatar-preview">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="프로필" />
            ) : (
              profile.nickname.slice(0, 2)
            )}
          </span>
          <strong>프로필사진 변경</strong>
          <small>{profile.avatarName || "이미지를 선택하면 바로 반영됩니다."}</small>
        </label>

        <label className="field">
          <span>닉네임</span>
          <input
            value={profile.nickname}
            onChange={(event) => onNicknameChange(event.target.value)}
            placeholder="닉네임을 입력하세요"
          />
        </label>
        <div className="profile-account-row">
          <span>{authUser.email}</span>
          <button className="inline-link" type="button" onClick={onLogout}>
            로그아웃
          </button>
        </div>
      </section>

      <section className="profile-menu" aria-label="마이페이지 메뉴">
        <button className="profile-menu-button" type="button" onClick={() => onNavigate("my-lost")}>
          <div>
            <strong>분실물 등록리스트</strong>
            <span>내가 찾고 있는 물건 확인</span>
          </div>
          <em>{lostCount}</em>
        </button>
        <button className="profile-menu-button" type="button" onClick={() => onNavigate("my-found")}>
          <div>
            <strong>찾은 리스트</strong>
            <span>내가 주워서 등록한 물건 확인</span>
          </div>
          <em>{foundCount}</em>
        </button>
        <button className="profile-menu-button rules" type="button" onClick={() => onNavigate("rules")}>
          <div>
            <strong>공지사항 및 이용 규칙</strong>
            <span>사례금, 보관, 개인정보 규칙 확인</span>
          </div>
          <em>필독</em>
        </button>
      </section>
    </div>
  );
}

function MyItemsView({ items, description, emptyText, onSelectItem }) {
  return (
    <div className="content-view my-items-view">
      <section className="subpage-intro">
        <p>{description}</p>
      </section>
      <section className="post-list" aria-label="내 게시글">
        {items.length > 0 ? (
          items.map((item) => <PostCard key={item.id} item={item} onClick={() => onSelectItem(item)} />)
        ) : (
          <div className="empty-state">{emptyText}</div>
        )}
      </section>
    </div>
  );
}

function RulesView() {
  return (
    <div className="content-view rules-view">
      <section className="rules-hero">
        <p>캠퍼스 분실물 서비스는 물건을 빠르게 돌려주기 위한 공간입니다.</p>
      </section>
      <section className="rule-list" aria-label="이용 규칙">
        {serviceRules.map((rule, index) => (
          <article key={rule.title} className="rule-card">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h2>{rule.title}</h2>
              <p>{rule.body}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function OfficialCampusMap({ items, onSelectItem }) {
  const [transform, setTransform] = useState({
    x: 0,
    y: 0,
    scale: 1,
    minScale: 1,
    maxScale: 3,
    ready: false,
  });
  const viewportRef = useRef(null);
  const transformRef = useRef(transform);
  const zoomAtRef = useRef(null);
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);

  function applyTransform(nextTransform) {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    const current = transformRef.current;
    const clampedTransform = constrainMapTransform({
      ...current,
      ...nextTransform,
      minScale: current.minScale,
      maxScale: current.maxScale,
      ready: true,
    }, rect);

    transformRef.current = clampedTransform;
    setTransform(clampedTransform);
  }

  function zoomAt(clientX, clientY, factor, currentTarget) {
    if (!currentTarget) return;

    const rect = currentTarget.getBoundingClientRect();
    const current = transformRef.current;
    const nextScale = clamp(current.scale * factor, current.minScale, current.maxScale);
    const pointX = clientX - rect.left;
    const pointY = clientY - rect.top;
    const scaleRatio = nextScale / current.scale;

    applyTransform({
      x: pointX - (pointX - current.x) * scaleRatio,
      y: pointY - (pointY - current.y) * scaleRatio,
      scale: nextScale,
    });
  }

  useEffect(() => {
    zoomAtRef.current = zoomAt;
  });

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    function syncViewport() {
      const rect = viewport.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const { minScale, maxScale } = getMapScaleBounds(rect);
      const current = transformRef.current;
      const zoom = current.ready ? current.scale / current.minScale : 1;
      const scale = clamp(minScale * zoom, minScale, maxScale);
      const nextTransform = constrainMapTransform({
        x: current.ready ? current.x : (rect.width - mapImageSize.width * scale) / 2,
        y: current.ready ? current.y : (rect.height - mapImageSize.height * scale) / 2,
        scale,
        minScale,
        maxScale,
        ready: true,
      }, rect);

      transformRef.current = nextTransform;
      setTransform(nextTransform);
    }

    syncViewport();
    viewport.addEventListener("wheel", handleNativeWheel, { passive: false });

    if ("ResizeObserver" in window) {
      const resizeObserver = new ResizeObserver(syncViewport);
      resizeObserver.observe(viewport);
      return () => {
        viewport.removeEventListener("wheel", handleNativeWheel);
        resizeObserver.disconnect();
      };
    }

    window.addEventListener("resize", syncViewport);
    return () => {
      viewport.removeEventListener("wheel", handleNativeWheel);
      window.removeEventListener("resize", syncViewport);
    };

    function handleNativeWheel(event) {
      event.preventDefault();
      zoomAtRef.current?.(event.clientX, event.clientY, event.deltaY < 0 ? 1.16 : 0.86, viewport);
    }
  }, []);

  function zoomFromControls(factor) {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor, viewport);
  }

  function handlePointerDown(event) {
    if (event.target.closest(".map-pin")) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (pointersRef.current.size === 1) {
      const current = transformRef.current;
      gestureRef.current = {
        mode: "drag",
        startX: event.clientX,
        startY: event.clientY,
        baseX: current.x,
        baseY: current.y,
      };
    }

    if (pointersRef.current.size === 2) {
      startPinchGesture(event.currentTarget);
    }
  }

  function handlePointerMove(event) {
    if (!pointersRef.current.has(event.pointerId)) return;

    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const gesture = gestureRef.current;
    if (!gesture) return;

    if (gesture.mode === "drag" && pointersRef.current.size === 1) {
      applyTransform({
        x: gesture.baseX + event.clientX - gesture.startX,
        y: gesture.baseY + event.clientY - gesture.startY,
        scale: transformRef.current.scale,
      });
    }

    if (gesture.mode === "pinch" && pointersRef.current.size >= 2) {
      const [first, second] = [...pointersRef.current.values()];
      const currentDistance = distanceBetween(first, second);
      const currentCenter = toLocalPoint(centerBetween(first, second), event.currentTarget);
      const current = transformRef.current;
      const nextScale = clamp(
        gesture.baseScale * (currentDistance / gesture.startDistance),
        current.minScale,
        current.maxScale,
      );

      applyTransform({
        x: currentCenter.x - gesture.baseMapX * nextScale,
        y: currentCenter.y - gesture.baseMapY * nextScale,
        scale: nextScale,
      });
    }
  }

  function handlePointerUp(event) {
    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size === 0) {
      gestureRef.current = null;
      return;
    }

    if (pointersRef.current.size === 1) {
      const [remainingPointer] = [...pointersRef.current.values()];
      const current = transformRef.current;
      gestureRef.current = {
        mode: "drag",
        startX: remainingPointer.x,
        startY: remainingPointer.y,
        baseX: current.x,
        baseY: current.y,
      };
    }
  }

  function startPinchGesture(currentTarget) {
    const [first, second] = [...pointersRef.current.values()];
    const current = transformRef.current;
    const startCenter = toLocalPoint(centerBetween(first, second), currentTarget);
    gestureRef.current = {
      mode: "pinch",
      startDistance: distanceBetween(first, second),
      baseScale: current.scale,
      baseMapX: (startCenter.x - current.x) / current.scale,
      baseMapY: (startCenter.y - current.y) / current.scale,
    };
  }

  return (
    <>
      <div
        ref={viewportRef}
        className="map-viewport"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="map-transform-layer"
          style={{
            width: `${mapImageSize.width}px`,
            height: `${mapImageSize.height}px`,
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
          }}
        >
          <img
            className="campus-map-base"
            src="/assets/campus-map-base.png"
            alt="동국대학교 WISE캠퍼스 지도"
            draggable="false"
          />
        </div>
        <div className="service-pin-layer">
          {items.map((item) => {
            const point = toCampusPoint(item.location);
            const viewportPoint = toViewportMapPoint(point, transform);
            return (
              <button
                key={item.id}
                type="button"
                className={`map-pin ${item.type}`}
                style={{ left: `${viewportPoint.x}px`, top: `${viewportPoint.y}px` }}
                onClick={() => onSelectItem(item)}
                aria-label={`${item.title} 위치`}
              >
                <span className="pin-symbol">{item.type === "found" ? "!" : "?"}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="map-controls" aria-label="지도 확대 축소">
        <button type="button" onClick={() => zoomFromControls(1.2)} aria-label="확대">
          +
        </button>
        <button type="button" onClick={() => zoomFromControls(0.84)} aria-label="축소">
          -
        </button>
      </div>
      <div className="map-source">캠퍼스 지도</div>
    </>
  );
}

function getMapScaleBounds(rect) {
  const minScale = Math.max(rect.width / mapImageSize.width, rect.height / mapImageSize.height);
  return {
    minScale,
    maxScale: Math.max(minScale * 3, 1),
  };
}

function constrainMapTransform(transform, rect) {
  const scale = clamp(transform.scale, transform.minScale, transform.maxScale);
  const scaledWidth = mapImageSize.width * scale;
  const scaledHeight = mapImageSize.height * scale;
  const x = clamp(transform.x, Math.min(rect.width - scaledWidth, 0), 0);
  const y = clamp(transform.y, Math.min(rect.height - scaledHeight, 0), 0);

  return {
    ...transform,
    x,
    y,
    scale,
  };
}

function toViewportMapPoint(point, transform) {
  return {
    x: transform.x + (point.x / 100) * mapImageSize.width * transform.scale,
    y: transform.y + (point.y / 100) * mapImageSize.height * transform.scale,
  };
}

function getViewportCenterMapPoint(transform, rect) {
  return {
    x: clamp(((rect.width / 2 - transform.x) / (mapImageSize.width * transform.scale)) * 100, 0, 100),
    y: clamp(((rect.height / 2 - transform.y) / (mapImageSize.height * transform.scale)) * 100, 0, 100),
  };
}

function getPickedLocation(point) {
  const location = toCampusLocation(point);
  const nearestSpot = getNearestCampusSpot(point);

  return {
    point,
    place: nearestSpot ? `${nearestSpot.name} 근처` : "지도 지정 위치",
    location: {
      ...location,
      mapX: point.x,
      mapY: point.y,
    },
  };
}

function toCampusLocation(point) {
  const x = clamp(point.x, 7, 93);
  const y = clamp(point.y, 8, 92);

  return {
    lat: campusBounds.north - ((y - 8) / 84) * (campusBounds.north - campusBounds.south),
    lng: campusBounds.west + ((x - 7) / 86) * (campusBounds.east - campusBounds.west),
  };
}

function getNearestCampusSpot(point) {
  const nearestMapPoint = campusMapPoints.reduce((nearest, spot) => {
    const distance = Math.hypot(point.x - spot.x, point.y - spot.y);
    if (!nearest || distance < nearest.distance) {
      return { spot, distance };
    }

    return nearest;
  }, null);

  if (nearestMapPoint && nearestMapPoint.distance < 7) {
    return nearestMapPoint.spot;
  }

  const location = toCampusLocation(point);

  return buildingSearchSpots.reduce((nearest, spot) => {
    const distance = Math.hypot(location.lat - spot.lat, location.lng - spot.lng);
    if (!nearest || distance < nearest.distance) {
      return { spot, distance };
    }

    return nearest;
  }, null)?.spot;
}

function isInsideCampusBounds({ lat, lng }) {
  return (
    lat <= campusBounds.north &&
    lat >= campusBounds.south &&
    lng >= campusBounds.west &&
    lng <= campusBounds.east
  );
}

function toCampusPoint({ lat, lng, mapX, mapY }) {
  if (Number.isFinite(mapX) && Number.isFinite(mapY)) {
    return {
      x: clamp(mapX, 0, 100),
      y: clamp(mapY, 0, 100),
      visible: true,
    };
  }

  const x = 7 + ((lng - campusBounds.west) / (campusBounds.east - campusBounds.west)) * 86;
  const y = 8 + ((campusBounds.north - lat) / (campusBounds.north - campusBounds.south)) * 84;
  const visible = isInsideCampusBounds({ lat, lng });

  return {
    x,
    y,
    visible,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distanceBetween(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function centerBetween(first, second) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

function toLocalPoint(point, element) {
  const rect = element.getBoundingClientRect();
  return {
    x: point.x - rect.left,
    y: point.y - rect.top,
  };
}

function BottomNav({ activeTab, unreadCount, onChange }) {
  return (
    <nav className="bottom-nav" aria-label="하단 메뉴">
      <button className={activeTab === "list" ? "active" : ""} type="button" onClick={() => onChange("list")}>
        <ListIcon />
        <span>리스트</span>
      </button>
      <button className={activeTab === "inbox" ? "active" : ""} type="button" onClick={() => onChange("inbox")}>
        <span className="nav-icon-wrap">
          <InboxIcon />
          {unreadCount > 0 && <i>{unreadCount}</i>}
        </span>
        <span>쪽지함</span>
      </button>
      <button className={activeTab === "map" ? "active" : ""} type="button" onClick={() => onChange("map")}>
        <MapIcon />
        <span>지도</span>
      </button>
    </nav>
  );
}

function DetailSheet({ item, sentCount, onClose, onSendMessage }) {
  const [message, setMessage] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    if (!message.trim()) return;
    onSendMessage(item, message.trim());
    setMessage("");
  }

  return (
    <div className="sheet-backdrop">
      <article className="sheet detail-sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <span className={`status-badge ${item.type}`}>{typeLabels[item.type]}</span>
          <button className="icon-button" type="button" onClick={onClose} aria-label="닫기">
            <CloseIcon />
          </button>
        </div>
        <ItemVisual item={item} />
        <h2>{item.title}</h2>
        <p>{item.description}</p>
        <dl className="detail-grid">
          <div>
            <dt>위치</dt>
            <dd>{item.place}</dd>
          </div>
          <div>
            <dt>등록</dt>
            <dd>{item.time}</dd>
          </div>
          <div>
            <dt>위치 출처</dt>
            <dd>{item.location.source === "PHOTO_METADATA" ? "사진 메타데이터" : "직접 선택"}</dd>
          </div>
          <div>
            <dt>사례금</dt>
            <dd>{item.reward > 0 ? `${item.reward.toLocaleString()}원` : "없음"}</dd>
          </div>
        </dl>
        <form className="message-form" onSubmit={handleSubmit}>
          <label>
            <span>쪽지</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="연락 가능한 시간이나 보관 장소를 남겨주세요."
            />
          </label>
          <button className="primary-action" type="submit">
            <SendIcon />
            보내기{sentCount > 0 ? ` ${sentCount}` : ""}
          </button>
        </form>
      </article>
    </div>
  );
}

function MessageSheet({ message, item, onClose, onOpenItem }) {
  return (
    <div className="sheet-backdrop">
      <article className="sheet message-sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <span className={`message-direction ${message.direction}`}>
            {message.direction === "received" ? "받은 쪽지" : "보낸 쪽지"}
          </span>
          <button className="icon-button" type="button" onClick={onClose} aria-label="닫기">
            <CloseIcon />
          </button>
        </div>

        <div className="message-thread-head">
          <h2>{item?.title ?? "삭제된 게시글"}</h2>
          <span>{message.time}</span>
        </div>
        <p className="message-body">{message.message}</p>

        <dl className="detail-grid">
          <div>
            <dt>{message.direction === "received" ? "보낸 사람" : "받는 사람"}</dt>
            <dd>{message.direction === "received" ? message.sender : "게시글 작성자"}</dd>
          </div>
          <div>
            <dt>관련 위치</dt>
            <dd>{item?.place ?? "확인 불가"}</dd>
          </div>
        </dl>

        {item && (
          <button className="primary-action" type="button" onClick={() => onOpenItem(item)}>
            관련 게시글 보기
          </button>
        )}
      </article>
    </div>
  );
}

function CreateSheet({ onClose, onSubmit }) {
  const [draft, setDraft] = useState(emptyDraft);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);

  function updateDraft(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    updateDraft("photoName", file.name);
    updateDraft("photoFile", file);
    updateDraft("imageLabel", file.name.replace(/\.[^.]+$/, ""));
    updateDraft("status", "metadata");

    try {
      const gps = await exifr.gps(file);
      if (gps?.latitude && gps?.longitude) {
        setDraft((prev) => ({
          ...prev,
          status: "metadata-success",
          location: {
            x: 45 + ((gps.longitude * 1000) % 20),
            y: 35 + ((gps.latitude * 1000) % 24),
            lat: gps.latitude,
            lng: gps.longitude,
            source: "PHOTO_METADATA",
          },
        }));
      } else {
        setDraft((prev) => ({ ...prev, status: "metadata-empty" }));
      }
    } catch {
      setDraft((prev) => ({ ...prev, status: "metadata-empty" }));
    }
  }

  function handleLocationSelect(selection) {
    setDraft((prev) => ({
      ...prev,
      place: selection.place,
      location: selection.location,
    }));
    setIsLocationPickerOpen(false);
  }

  const locationLabel = draft.location
    ? `${draft.place} (${draft.location.lat.toFixed(5)}, ${draft.location.lng.toFixed(5)})`
    : "지도에서 핀으로 위치를 지정해 주세요.";

  function handleSubmit(event) {
    event.preventDefault();
    if (!draft.title.trim() || !draft.description.trim()) return;
    onSubmit(draft);
    setDraft(emptyDraft);
  }

  return (
    <div className="sheet-backdrop">
      <form className="sheet create-sheet" onSubmit={handleSubmit}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2>게시물 등록</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="닫기">
            <CloseIcon />
          </button>
        </div>

        <div className="segmented-control">
          <button
            className={draft.type === "found" ? "active" : ""}
            type="button"
            onClick={() => setDraft({ ...emptyDraft, type: "found", category: draft.category })}
          >
            주웠어요
          </button>
          <button
            className={draft.type === "request" ? "active" : ""}
            type="button"
            onClick={() => setDraft({ ...emptyDraft, type: "request", category: draft.category })}
          >
            찾아주세요
          </button>
        </div>

        <label className="field">
          <span>제목</span>
          <input
            value={draft.title}
            onChange={(event) => updateDraft("title", event.target.value)}
            placeholder="예: 검은색 무선 이어폰 케이스"
          />
        </label>

        <label className="field">
          <span>카테고리</span>
          <select value={draft.category} onChange={(event) => updateDraft("category", event.target.value)}>
            {categories.filter((category) => category.id !== "all").map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </label>

        {draft.type === "found" ? (
          <label className="field file-field">
            <span>사진</span>
            <input accept="image/*" type="file" onChange={handlePhotoChange} />
            <strong>{draft.photoName || "사진 선택"}</strong>
            <small>{metadataText(draft.status)}</small>
          </label>
        ) : (
          <label className="field">
            <span>사례금</span>
            <input
              inputMode="numeric"
              value={draft.reward}
              onChange={(event) => updateDraft("reward", event.target.value.replace(/\D/g, ""))}
              placeholder="예: 20000"
            />
          </label>
        )}

        <section className="location-field" aria-label={draft.type === "found" ? "발견 위치" : "예상 분실 위치"}>
          <div>
            <span>{draft.type === "found" ? "발견 위치" : "예상 분실 위치"}</span>
            <strong>{locationLabel}</strong>
          </div>
          <button className="secondary-action" type="button" onClick={() => setIsLocationPickerOpen(true)}>
            지도에서 위치 지정
          </button>
        </section>

        <label className="field">
          <span>설명</span>
          <textarea
            value={draft.description}
            onChange={(event) => updateDraft("description", event.target.value)}
            placeholder="분실물의 설명과 잃어버린 상세 위치를 적어주세요."
          />
        </label>

        <button className="primary-action" type="submit">
          등록하기
        </button>
      </form>

      {isLocationPickerOpen && (
        <LocationPickerSheet
          type={draft.type}
          initialLocation={draft.location}
          initialPlace={draft.place}
          onClose={() => setIsLocationPickerOpen(false)}
          onSelect={handleLocationSelect}
        />
      )}
    </div>
  );
}

function LocationPickerSheet({ type, initialLocation, initialPlace, onClose, onSelect }) {
  const initialPoint = useMemo(() => {
    if (initialLocation?.lat && initialLocation?.lng) {
      return toCampusPoint(initialLocation);
    }

    const spot = campusSpots.find((entry) => entry.name === initialPlace) ?? campusSpots[0];
    return toCampusPoint(spot);
  }, [initialLocation, initialPlace]);
  const [transform, setTransform] = useState({
    x: 0,
    y: 0,
    scale: 1,
    minScale: 1,
    maxScale: 3,
    ready: false,
  });
  const [picked, setPicked] = useState(() => getPickedLocation(initialPoint));
  const [buildingQuery, setBuildingQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [locationNotice, setLocationNotice] = useState("현재 위치를 확인하는 중입니다.");
  const viewportRef = useRef(null);
  const transformRef = useRef(transform);
  const zoomAtRef = useRef(null);
  const moveToPointRef = useRef(null);
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);
  const normalizedBuildingQuery = buildingQuery.trim().toLowerCase();
  const buildingSuggestions = useMemo(() => {
    if (!normalizedBuildingQuery) return buildingSearchSpots;

    return buildingSearchSpots.filter((building) =>
      building.name.toLowerCase().includes(normalizedBuildingQuery),
    );
  }, [normalizedBuildingQuery]);

  function syncPicked(nextTransform, rect) {
    const point = getViewportCenterMapPoint(nextTransform, rect);
    setPicked(getPickedLocation(point));
  }

  function applyTransform(nextTransform) {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    const current = transformRef.current;
    const clampedTransform = constrainMapTransform({
      ...current,
      ...nextTransform,
      minScale: current.minScale,
      maxScale: current.maxScale,
      ready: true,
    }, rect);

    transformRef.current = clampedTransform;
    setTransform(clampedTransform);
    syncPicked(clampedTransform, rect);
  }

  function zoomAt(clientX, clientY, factor, currentTarget) {
    if (!currentTarget) return;

    const rect = currentTarget.getBoundingClientRect();
    const current = transformRef.current;
    const nextScale = clamp(current.scale * factor, current.minScale, current.maxScale);
    const pointX = clientX - rect.left;
    const pointY = clientY - rect.top;
    const scaleRatio = nextScale / current.scale;

    applyTransform({
      x: pointX - (pointX - current.x) * scaleRatio,
      y: pointY - (pointY - current.y) * scaleRatio,
      scale: nextScale,
    });
  }

  function moveToPoint(point, options = {}) {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    const current = transformRef.current;
    const nextScale = clamp(
      options.scale ?? Math.max(current.scale, current.minScale * 1.65),
      current.minScale,
      current.maxScale,
    );

    applyTransform({
      x: rect.width / 2 - (point.x / 100) * mapImageSize.width * nextScale,
      y: rect.height / 2 - (point.y / 100) * mapImageSize.height * nextScale,
      scale: nextScale,
    });
  }

  function selectBuilding(building) {
    const point = toCampusPoint(building);
    setBuildingQuery(building.name);
    setIsSearchFocused(false);
    setLocationNotice(`${building.name} 위치로 이동했습니다.`);
    moveToPoint(point);
    setPicked({
      point,
      place: building.name,
      location: {
        lat: building.lat,
        lng: building.lng,
        mapX: point.x,
        mapY: point.y,
      },
    });
  }

  useEffect(() => {
    zoomAtRef.current = zoomAt;
    moveToPointRef.current = moveToPoint;
  });

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    function syncViewport() {
      const rect = viewport.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const { minScale, maxScale } = getMapScaleBounds(rect);
      const current = transformRef.current;
      const scale = current.ready ? clamp(current.scale, minScale, maxScale) : minScale * 1.35;
      const nextTransform = constrainMapTransform({
        x: current.ready
          ? current.x
          : rect.width / 2 - (initialPoint.x / 100) * mapImageSize.width * scale,
        y: current.ready
          ? current.y
          : rect.height / 2 - (initialPoint.y / 100) * mapImageSize.height * scale,
        scale,
        minScale,
        maxScale,
        ready: true,
      }, rect);

      transformRef.current = nextTransform;
      setTransform(nextTransform);
      syncPicked(nextTransform, rect);
    }

    syncViewport();
    viewport.addEventListener("wheel", handleNativeWheel, { passive: false });

    if ("ResizeObserver" in window) {
      const resizeObserver = new ResizeObserver(syncViewport);
      resizeObserver.observe(viewport);
      return () => {
        viewport.removeEventListener("wheel", handleNativeWheel);
        resizeObserver.disconnect();
      };
    }

    window.addEventListener("resize", syncViewport);
    return () => {
      viewport.removeEventListener("wheel", handleNativeWheel);
      window.removeEventListener("resize", syncViewport);
    };

    function handleNativeWheel(event) {
      event.preventDefault();
      zoomAtRef.current?.(event.clientX, event.clientY, event.deltaY < 0 ? 1.16 : 0.86, viewport);
    }
  }, [initialPoint.x, initialPoint.y]);

  useEffect(() => {
    let ignore = false;

    if (!navigator.geolocation) {
      const noticeTimer = window.setTimeout(() => {
        setLocationNotice("현재 위치를 사용할 수 없어 기본 위치에서 시작합니다.");
      }, 0);

      return () => window.clearTimeout(noticeTimer);
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (ignore) return;

        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        if (!isInsideCampusBounds(location)) {
          setLocationNotice("현재 위치가 캠퍼스 지도 범위 밖이라 기본 위치에서 시작합니다.");
          return;
        }

        const point = toCampusPoint(location);
        setLocationNotice("현재 위치에서 시작합니다.");
        setPicked(getPickedLocation(point));
        moveToPointRef.current?.(point, { scale: transformRef.current.minScale * 1.75 });
      },
      () => {
        if (!ignore) {
          setLocationNotice("현재 위치 권한이 없어 기본 위치에서 시작합니다.");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 6000,
      },
    );

    return () => {
      ignore = true;
    };
  }, []);

  function zoomFromControls(factor) {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor, viewport);
  }

  function handlePointerDown(event) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (pointersRef.current.size === 1) {
      const current = transformRef.current;
      gestureRef.current = {
        mode: "drag",
        startX: event.clientX,
        startY: event.clientY,
        baseX: current.x,
        baseY: current.y,
      };
    }

    if (pointersRef.current.size === 2) {
      startPinchGesture(event.currentTarget);
    }
  }

  function handlePointerMove(event) {
    if (!pointersRef.current.has(event.pointerId)) return;

    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const gesture = gestureRef.current;
    if (!gesture) return;

    if (gesture.mode === "drag" && pointersRef.current.size === 1) {
      applyTransform({
        x: gesture.baseX + event.clientX - gesture.startX,
        y: gesture.baseY + event.clientY - gesture.startY,
        scale: transformRef.current.scale,
      });
    }

    if (gesture.mode === "pinch" && pointersRef.current.size >= 2) {
      const [first, second] = [...pointersRef.current.values()];
      const currentDistance = distanceBetween(first, second);
      const currentCenter = toLocalPoint(centerBetween(first, second), event.currentTarget);
      const current = transformRef.current;
      const nextScale = clamp(
        gesture.baseScale * (currentDistance / gesture.startDistance),
        current.minScale,
        current.maxScale,
      );

      applyTransform({
        x: currentCenter.x - gesture.baseMapX * nextScale,
        y: currentCenter.y - gesture.baseMapY * nextScale,
        scale: nextScale,
      });
    }
  }

  function handlePointerUp(event) {
    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size === 0) {
      gestureRef.current = null;
      return;
    }

    if (pointersRef.current.size === 1) {
      const [remainingPointer] = [...pointersRef.current.values()];
      const current = transformRef.current;
      gestureRef.current = {
        mode: "drag",
        startX: remainingPointer.x,
        startY: remainingPointer.y,
        baseX: current.x,
        baseY: current.y,
      };
    }
  }

  function startPinchGesture(currentTarget) {
    const [first, second] = [...pointersRef.current.values()];
    const current = transformRef.current;
    const startCenter = toLocalPoint(centerBetween(first, second), currentTarget);
    gestureRef.current = {
      mode: "pinch",
      startDistance: distanceBetween(first, second),
      baseScale: current.scale,
      baseMapX: (startCenter.x - current.x) / current.scale,
      baseMapY: (startCenter.y - current.y) / current.scale,
    };
  }

  function confirmLocation() {
    onSelect({
      place: picked.place,
      location: {
        ...picked.location,
        x: picked.point.x,
        y: picked.point.y,
        mapX: picked.point.x,
        mapY: picked.point.y,
        source: "PIN_SELECT",
      },
    });
  }

  return (
    <div className="nested-sheet-backdrop">
      <article className="sheet location-picker-sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2>{type === "found" ? "발견 위치 지정" : "분실 위치 지정"}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="닫기">
            <CloseIcon />
          </button>
        </div>

        <div className="building-search">
          <label className="search-box">
            <SearchIcon />
            <input
              value={buildingQuery}
              onFocus={() => setIsSearchFocused(true)}
              onChange={(event) => {
                setBuildingQuery(event.target.value);
                setIsSearchFocused(true);
              }}
              placeholder="건물 이름 검색"
              autoComplete="off"
            />
          </label>
          {isSearchFocused && (
            <div className="building-suggestion-list">
              {buildingSuggestions.length > 0 ? (
                buildingSuggestions.map((building) => (
                  <button key={building.id} type="button" onClick={() => selectBuilding(building)}>
                    <strong>{building.name}</strong>
                  </button>
                ))
              ) : (
                <div className="building-suggestion-empty">검색 결과가 없습니다.</div>
              )}
            </div>
          )}
        </div>

        <div className="location-picker-map">
          <div
            ref={viewportRef}
            className="map-viewport location-picker-viewport"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div
              className="map-transform-layer"
              style={{
                width: `${mapImageSize.width}px`,
                height: `${mapImageSize.height}px`,
                transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
              }}
            >
              <img
                className="campus-map-base"
                src="/assets/campus-map-base.png"
                alt="동국대학교 WISE캠퍼스 지도"
                draggable="false"
              />
            </div>
            <div className={`location-center-pin ${type}`} aria-hidden="true">
              <span className="pin-symbol">{type === "found" ? "!" : "?"}</span>
            </div>
          </div>
          <div className="map-controls" aria-label="지도 확대 축소">
            <button type="button" onClick={() => zoomFromControls(1.2)} aria-label="확대">
              +
            </button>
            <button type="button" onClick={() => zoomFromControls(0.84)} aria-label="축소">
              -
            </button>
          </div>
          <div className="map-source">지도를 움직여 핀 위치 지정</div>
        </div>

        <div className="location-picker-summary">
          <strong>{picked.place}</strong>
          <span>{picked.location.lat.toFixed(6)}, {picked.location.lng.toFixed(6)}</span>
          <small>{locationNotice}</small>
        </div>

        <button className="primary-action" type="button" onClick={confirmLocation}>
          이 위치로 지정
        </button>
      </article>
    </div>
  );
}

function metadataText(status) {
  switch (status) {
    case "metadata":
      return "사진 위치 확인 중";
    case "metadata-success":
      return "사진 메타데이터로 위치 설정됨";
    case "metadata-empty":
      return "사진 위치 없음, 선택 위치 사용";
  }
}

export default App;
