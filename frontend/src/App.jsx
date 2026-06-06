import { useEffect, useMemo, useRef, useState } from "react";
import exifr from "exifr";
import {
  clearStoredAuth,
  createItemOnApi,
  fetchInboxMessagesFromApi,
  fetchItemsFromApi,
  getStoredAuth,
  isBackendEnabled,
  loginWithApi,
  markRoomReadOnApi,
  saveStoredAuth,
  sendSignupCode,
  sendMessageOnApi,
  signupWithApi,
  verifySignupCode,
} from "./api.js";
import { campusSpots, categories, initialItems } from "./data.js";
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

const kakaoMapAppKey = import.meta.env.VITE_KAKAO_MAP_APP_KEY?.trim() ?? "";
const kakaoMapCenter = { lat: 35.86255, lng: 129.1951 };
let kakaoMapsPromise = null;

function App() {
  const [authSession, setAuthSession] = useState(() => getStoredAuth());
  const [authMode, setAuthMode] = useState(null);
  const [authError, setAuthError] = useState("");
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
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
  const [messages, setMessages] = useState([]);
  const [isInboxLoading, setIsInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState("");
  const [profile, setProfile] = useState({
    nickname: authSession?.user?.nickname ?? "동국 분실물 매니저",
    avatarUrl: "",
    avatarName: "",
  });

  const authUser = authSession?.user ?? null;

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

  useEffect(() => {
    let ignore = false;

    if (!authSession?.token || !authSession?.user?.id || !isBackendEnabled()) {
      setMessages([]);
      setInboxError("");
      setIsInboxLoading(false);
      return undefined;
    }

    setIsInboxLoading(true);
    setInboxError("");

    fetchInboxMessagesFromApi(authSession)
      .then((remoteMessages) => {
        if (!ignore) setMessages(remoteMessages);
      })
      .catch((error) => {
        if (!ignore) {
          setInboxError(error.response?.data?.message || error.message);
          setMessages([]);
        }
      })
      .finally(() => {
        if (!ignore) setIsInboxLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [authSession]);

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
      imageUrl: draft.type === "found" && draft.photoFile ? URL.createObjectURL(draft.photoFile) : null,
      color: draft.color,
      location,
      reward: draft.type === "request" ? Number(draft.reward || 0) : 0,
    };

    setItems((prev) => [item, ...prev]);
    setSelectedItem(item);
    setIsCreateOpen(false);

    if (!isBackendEnabled()) return;

    try {
      const savedItem = await createItemOnApi(draft, authSession);
      if (!savedItem) return;

      setItems((prev) => prev.map((entry) => (entry.id === item.id ? savedItem : entry)));
      setSelectedItem(savedItem);
    } catch (error) {
      console.warn("게시글 API 저장에 실패해 로컬 등록 상태를 유지합니다.", error);
    }
  }

  async function sendMessage(item, message) {
    if (!authSession?.user?.id || !authSession?.token) {
      setAuthError("쪽지를 보내려면 먼저 로그인해 주세요.");
      setAuthMode("login");
      return;
    }

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
      await sendMessageOnApi(item, message, authSession);
      const remoteMessages = await fetchInboxMessagesFromApi(authSession);
      setMessages(remoteMessages);
    } catch (error) {
      setMessages((prev) =>
        prev.map((entry) =>
          entry.id === sentMessage.id
            ? { ...entry, message: `${entry.message}\n\n(API 전송 실패: ${error.message})` }
            : entry,
        ),
      );
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

  function applyAuthSession(session) {
    setAuthSession(session);
    saveStoredAuth(session);
    setProfile((prev) => ({
      ...prev,
      nickname: session.user.nickname || prev.nickname,
    }));
    setAuthError("");
    setAuthMode(null);
  }

  async function handleLogin(credentials) {
    setIsAuthSubmitting(true);
    setAuthError("");

    try {
      const session = await loginWithApi(credentials);
      applyAuthSession(session);
    } catch (error) {
      setAuthError(error.response?.data?.message || error.message);
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleSignup(form) {
    setIsAuthSubmitting(true);
    setAuthError("");

    try {
      const session = await signupWithApi(form);
      applyAuthSession(session);
    } catch (error) {
      setAuthError(error.response?.data?.message || error.message);
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  function requireAuth(nextMode = "login") {
    if (authSession?.token) return true;

    setAuthError("로그인이 필요한 기능입니다.");
    setAuthMode(nextMode);
    return false;
  }

  function logout() {
    clearStoredAuth();
    setAuthSession(null);
    setSelectedItem(null);
    setSelectedMessage(null);
    setIsCreateOpen(false);
    setAuthError("");
    setActiveTab("profile");
  }

  async function handleSelectMessage(message) {
    setMessages((prev) =>
      prev.map((item) => (item.id === message.id ? { ...item, unread: false } : item)),
    );
    setSelectedMessage({ ...message, unread: false });

    if (!message.unread || !message.roomId || !isBackendEnabled()) return;

    try {
      await markRoomReadOnApi(message.roomId, authSession);
    } catch (error) {
      setInboxError(error.response?.data?.message || error.message);
    }
  }

  return (
    <div className="app-shell">
      <main className="phone-frame">
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
            onCreate={() => {
              if (requireAuth()) setIsCreateOpen(true);
            }}
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
              authUser={authUser}
              messages={messages}
              itemById={itemById}
              isLoading={isInboxLoading}
              error={inboxError}
              onLogin={() => {
                setAuthError("");
                setAuthMode("login");
              }}
              onSelectMessage={handleSelectMessage}
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
              onLogin={() => {
                setAuthError("");
                setAuthMode("login");
              }}
              onSignup={() => {
                setAuthError("");
                setAuthMode("signup");
              }}
              onLogout={logout}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === "my-lost" && (
            <MyItemsView
              items={myLostItems}
              emptyText="등록한 찾아주세요 게시글이 없습니다."
              description="내가 잃어버려서 등록한 물건을 한 곳에서 확인합니다."
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

        {authMode && (
          <AuthDialog
            mode={authMode}
            error={authError}
            isSubmitting={isAuthSubmitting}
            onClose={() => {
              setAuthMode(null);
              setAuthError("");
            }}
            onModeChange={(mode) => {
              setAuthError("");
              setAuthMode(mode);
            }}
            onLogin={handleLogin}
            onSignup={handleSignup}
          />
        )}
      </main>
    </div>
  );
}

function AuthDialog({ mode, error, isSubmitting, onClose, onModeChange, onLogin, onSignup }) {
  const title = mode === "login" ? "로그인" : "회원가입";

  return (
    <div className="auth-backdrop">
      <section className="auth-card" aria-label={title}>
        <div className="sheet-header">
          <div>
            <p className="eyebrow">CampusFind 계정</p>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="닫기">
            <CloseIcon />
          </button>
        </div>

        {mode === "login" ? (
          <LoginForm
            error={error}
            isSubmitting={isSubmitting}
            onSubmit={onLogin}
            onShowSignup={() => onModeChange("signup")}
          />
        ) : (
          <SignupForm
            error={error}
            isSubmitting={isSubmitting}
            onSubmit={onSignup}
            onShowLogin={() => onModeChange("login")}
          />
        )}
      </section>
    </div>
  );
}

function LoginForm({ error, isSubmitting, onSubmit, onShowSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({
      email: email.trim().toLowerCase(),
      password,
    });
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>학교 이메일</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="student@dongguk.ac.kr"
          autoComplete="email"
          required
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
          required
        />
      </label>
      {error && <p className="auth-error">{error}</p>}
      <button className="primary-action" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "로그인 중" : "로그인"}
      </button>
      <button className="auth-switch" type="button" onClick={onShowSignup}>
        계정이 없으면 회원가입
      </button>
    </form>
  );
}

function SignupForm({ error, isSubmitting, onSubmit, onShowLogin }) {
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [otpMessage, setOtpMessage] = useState("");
  const [otpError, setOtpError] = useState("");
  const [studentId, setStudentId] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const passwordMismatch = Boolean(confirmPassword) && password !== confirmPassword;

  function handleEmailChange(value) {
    setEmail(value);
    setVerificationCode("");
    setIsEmailVerified(false);
    setOtpMessage("");
    setOtpError("");
  }

  async function handleSendCode() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setOtpError("학교 이메일을 먼저 입력해 주세요.");
      return;
    }

    setIsSendingCode(true);
    setOtpError("");
    setOtpMessage("");

    try {
      const result = await sendSignupCode(normalizedEmail);
      setOtpMessage(result.message || "인증코드가 발송되었습니다.");
    } catch (requestError) {
      setOtpError(requestError.response?.data?.message || requestError.message);
    } finally {
      setIsSendingCode(false);
    }
  }

  async function handleVerifyCode() {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = verificationCode.trim();
    if (!normalizedEmail || !normalizedCode) {
      setOtpError("이메일과 인증코드를 입력해 주세요.");
      return;
    }

    setIsVerifyingCode(true);
    setOtpError("");
    setOtpMessage("");

    try {
      const result = await verifySignupCode({
        email: normalizedEmail,
        code: normalizedCode,
      });
      setIsEmailVerified(true);
      setOtpMessage(result.message || "이메일 인증이 완료되었습니다.");
    } catch (requestError) {
      setIsEmailVerified(false);
      setOtpError(requestError.response?.data?.message || requestError.message);
    } finally {
      setIsVerifyingCode(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (passwordMismatch || !isEmailVerified) return;

    onSubmit({
      email: email.trim().toLowerCase(),
      studentId: studentId.trim(),
      nickname: nickname.trim(),
      password,
    });
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>학교 이메일</span>
        <input
          type="email"
          value={email}
          onChange={(event) => handleEmailChange(event.target.value)}
          placeholder="student@dongguk.ac.kr"
          autoComplete="email"
          required
        />
      </label>
      <div className="otp-actions">
        <button className="secondary-action" type="button" onClick={handleSendCode} disabled={isSendingCode}>
          {isSendingCode ? "발송 중" : "인증코드 발송"}
        </button>
      </div>
      <label className="field">
        <span>이메일 인증코드</span>
        <input
          value={verificationCode}
          onChange={(event) => {
            setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6));
            setIsEmailVerified(false);
          }}
          placeholder="6자리 코드"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
        />
      </label>
      <button
        className="auth-switch"
        type="button"
        onClick={handleVerifyCode}
        disabled={isVerifyingCode || isEmailVerified}
      >
        {isEmailVerified ? "인증 완료" : isVerifyingCode ? "확인 중" : "인증코드 확인"}
      </button>
      <label className="field">
        <span>학번</span>
        <input
          value={studentId}
          onChange={(event) => setStudentId(event.target.value)}
          placeholder="학번"
          autoComplete="off"
          required
        />
      </label>
      <label className="field">
        <span>닉네임</span>
        <input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="닉네임"
          autoComplete="nickname"
          required
        />
      </label>
      <label className="field">
        <span>비밀번호</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="8자 이상"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      <label className="field">
        <span>비밀번호 확인</span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="비밀번호 재입력"
          autoComplete="new-password"
          required
        />
      </label>
      {passwordMismatch && <p className="auth-error">비밀번호가 일치하지 않습니다.</p>}
      {!isEmailVerified && <p className="auth-help">이메일 인증을 완료해야 회원가입할 수 있습니다.</p>}
      {otpMessage && <p className="auth-success">{otpMessage}</p>}
      {otpError && <p className="auth-error">{otpError}</p>}
      {error && <p className="auth-error">{error}</p>}
      <button className="primary-action" type="submit" disabled={isSubmitting || passwordMismatch || !isEmailVerified}>
        {isSubmitting ? "가입 중" : "회원가입"}
      </button>
      <button className="auth-switch" type="button" onClick={onShowLogin}>
        이미 계정이 있으면 로그인
      </button>
    </form>
  );
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
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={item.title} />
      ) : (
        <span>{item.imageLabel?.slice(0, 4)}</span>
      )}
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

function InboxView({ authUser, messages, itemById, isLoading, error, onLogin, onSelectMessage }) {
  const receivedMessages = messages.filter((message) => message.direction === "received");
  const sentMessages = messages.filter((message) => message.direction === "sent");
  const unreadCount = receivedMessages.filter((message) => message.unread).length;

  if (!authUser) {
    return (
      <div className="content-view inbox-view">
        <section className="inbox-auth-card">
          <h2>로그인이 필요합니다</h2>
          <p>쪽지함은 로그인한 계정의 실제 채팅방을 불러옵니다.</p>
          <button className="primary-action" type="button" onClick={onLogin}>
            로그인
          </button>
        </section>
      </div>
    );
  }

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

      {isLoading && <div className="empty-state">쪽지함을 불러오는 중입니다.</div>}
      {error && <div className="empty-state">쪽지함 API 오류: {error}</div>}

      <MessageListSection
        title="받은 쪽지"
        messages={receivedMessages}
        itemById={itemById}
        emptyText="아직 받은 쪽지가 없습니다."
        onSelectMessage={onSelectMessage}
      />
      {!isLoading && (
        <MessageListSection
          title="보낸 쪽지"
          messages={sentMessages}
          itemById={itemById}
          emptyText="아직 보낸 쪽지가 없습니다."
          onSelectMessage={onSelectMessage}
        />
      )}
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
                <h3>{item?.title ?? message.itemTitle ?? "삭제된 게시글"}</h3>
                <p>{message.message}</p>
                <div className="message-meta-row">
                  <span>{message.direction === "received" ? message.sender : "나"}</span>
                  {(item?.place || message.place) && <span>{item?.place ?? message.place}</span>}
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
  onSignup,
  onLogout,
  onNavigate,
}) {
  if (!authUser) {
    return (
      <div className="content-view profile-view">
        <section className="profile-card profile-auth-card">
          <div className="profile-auth-copy">
            <h2>로그인이 필요합니다</h2>
            <p>JWT 로그인 후 게시글 등록, 쪽지 전송, 내 리스트 확인 기능을 사용할 수 있습니다.</p>
          </div>
          <div className="profile-auth-actions">
            <button className="primary-action" type="button" onClick={onLogin}>
              로그인
            </button>
            <button className="secondary-action" type="button" onClick={onSignup}>
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
          {authUser.studentId && <span>{authUser.studentId}</span>}
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

      <button className="logout-button" type="button" onClick={onLogout}>
        로그아웃
      </button>
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
  if (!kakaoMapAppKey) {
    return (
      <>
        <StaticCampusMap items={items} onSelectItem={onSelectItem} />
        <div className="map-integration-notice">
          카카오맵 앱키가 없어 정적 지도를 표시 중입니다.
        </div>
      </>
    );
  }

  return <KakaoCampusMap items={items} onSelectItem={onSelectItem} appKey={kakaoMapAppKey} />;
}

function StaticCampusMap({ items, onSelectItem }) {
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const viewportRef = useRef(null);
  const transformRef = useRef(transform);
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);

  function applyTransform(nextTransform) {
    const clampedScale = clamp(nextTransform.scale, 1, 3);
    const rect = viewportRef.current?.getBoundingClientRect();

    if (!rect) {
      const fallbackTransform = { x: 0, y: 0, scale: clampedScale };
      transformRef.current = fallbackTransform;
      setTransform(fallbackTransform);
      return;
    }

    const minX = rect.width - rect.width * clampedScale;
    const minY = rect.height - rect.height * clampedScale;
    const clampedTransform = {
      x: clamp(nextTransform.x, minX, 0),
      y: clamp(nextTransform.y, minY, 0),
      scale: clampedScale,
    };

    transformRef.current = clampedTransform;
    setTransform(clampedTransform);
  }

  function zoomAt(clientX, clientY, factor, currentTarget) {
    if (!currentTarget) return;

    const rect = currentTarget.getBoundingClientRect();
    const current = transformRef.current;
    const nextScale = clamp(current.scale * factor, 1, 3);
    const pointX = clientX - rect.left;
    const pointY = clientY - rect.top;
    const scaleRatio = nextScale / current.scale;

    applyTransform({
      x: pointX - (pointX - current.x) * scaleRatio,
      y: pointY - (pointY - current.y) * scaleRatio,
      scale: nextScale,
    });
  }

  function zoomFromControls(factor) {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor, viewport);
  }

  function handleWheel(event) {
    event.preventDefault();
    zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 1.16 : 0.86, event.currentTarget);
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
      const nextScale = clamp(gesture.baseScale * (currentDistance / gesture.startDistance), 1, 3);

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
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="map-transform-layer"
          style={{
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
          }}
        >
          <img
            className="campus-map-base"
            src="/assets/campus-map-base.png"
            alt="동국대학교 WISE캠퍼스 지도"
            draggable="false"
          />
          <div className="service-pin-layer">
            {items.map((item) => {
              const point = toCampusPoint(item.location);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`map-pin ${item.type}`}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  onClick={() => onSelectItem(item)}
                  aria-label={`${item.title} 위치`}
                >
                  <span className="pin-symbol">{item.type === "found" ? "!" : "?"}</span>
                </button>
              );
            })}
          </div>
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

function KakaoCampusMap({ items, onSelectItem, appKey }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlayRefs = useRef([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    setStatus("loading");
    setError("");

    loadKakaoMaps(appKey)
      .then((kakao) => {
        if (cancelled || !containerRef.current) return;

        const center = new kakao.maps.LatLng(kakaoMapCenter.lat, kakaoMapCenter.lng);
        const map = new kakao.maps.Map(containerRef.current, {
          center,
          level: 4,
        });

        if (typeof map.setMinLevel === "function") map.setMinLevel(2);
        if (typeof map.setMaxLevel === "function") map.setMaxLevel(6);

        map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
        mapRef.current = map;
        setStatus("ready");
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError.message);
        setStatus("error");
      });

    return () => {
      cancelled = true;
      overlayRefs.current.forEach((overlay) => overlay.setMap(null));
      overlayRefs.current = [];
      mapRef.current = null;
    };
  }, [appKey]);

  useEffect(() => {
    if (status !== "ready" || !mapRef.current || !window.kakao?.maps) return undefined;

    const kakao = window.kakao;
    const map = mapRef.current;
    overlayRefs.current.forEach((overlay) => overlay.setMap(null));
    overlayRefs.current = [];

    const visibleItems = items.filter((item) => {
      const lat = Number(item.location?.lat);
      const lng = Number(item.location?.lng);
      return Number.isFinite(lat) && Number.isFinite(lng);
    });

    visibleItems.forEach((item) => {
      const position = new kakao.maps.LatLng(Number(item.location.lat), Number(item.location.lng));
      const pin = document.createElement("button");
      pin.type = "button";
      pin.className = `kakao-map-pin ${item.type}`;
      pin.setAttribute("aria-label", `${item.title} 위치`);
      pin.innerHTML = `<span class="pin-symbol">${item.type === "found" ? "!" : "?"}</span>`;
      pin.addEventListener("click", (event) => {
        event.preventDefault();
        onSelectItem(item);
      });

      const overlay = new kakao.maps.CustomOverlay({
        position,
        content: pin,
        yAnchor: 1,
        zIndex: 10,
      });

      overlay.setMap(map);
      overlayRefs.current.push(overlay);
    });

    if (visibleItems.length === 1) {
      const item = visibleItems[0];
      map.setCenter(new kakao.maps.LatLng(Number(item.location.lat), Number(item.location.lng)));
      map.setLevel(3);
    } else if (visibleItems.length > 1) {
      const bounds = new kakao.maps.LatLngBounds();
      visibleItems.forEach((item) => {
        bounds.extend(new kakao.maps.LatLng(Number(item.location.lat), Number(item.location.lng)));
      });
      map.setBounds(bounds);
    }

    return () => {
      overlayRefs.current.forEach((overlay) => overlay.setMap(null));
      overlayRefs.current = [];
    };
  }, [items, onSelectItem, status]);

  if (status === "error") {
    return (
      <>
        <StaticCampusMap items={items} onSelectItem={onSelectItem} />
        <div className="map-integration-notice">
          카카오맵 로드 실패: {error}
        </div>
      </>
    );
  }

  return (
    <>
      <div ref={containerRef} className="kakao-map-viewport" aria-label="카카오맵 캠퍼스 지도" />
      {status === "loading" && <div className="map-loading">카카오맵 불러오는 중</div>}
      <div className="map-source">Kakao Maps</div>
    </>
  );
}

function loadKakaoMaps(appKey) {
  if (!appKey) {
    return Promise.reject(new Error("VITE_KAKAO_MAP_APP_KEY가 설정되지 않았습니다."));
  }

  if (window.kakao?.maps) {
    return new Promise((resolve) => {
      window.kakao.maps.load(() => resolve(window.kakao));
    });
  }

  if (kakaoMapsPromise) return kakaoMapsPromise;

  kakaoMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector("script[data-kakao-map-sdk]");

    function handleLoad() {
      if (!window.kakao?.maps) {
        reject(new Error("Kakao Maps SDK 객체를 찾을 수 없습니다."));
        return;
      }

      window.kakao.maps.load(() => resolve(window.kakao));
    }

    if (existingScript) {
      existingScript.addEventListener("load", handleLoad, { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Kakao Maps SDK 로드 실패")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.dataset.kakaoMapSdk = "true";
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", () => reject(new Error("Kakao Maps SDK 로드 실패")), { once: true });
    document.head.appendChild(script);
  });

  return kakaoMapsPromise;
}

function toCampusPoint({ lat, lng }) {
  const bounds = {
    north: 35.86645,
    south: 35.85805,
    west: 129.19045,
    east: 129.19815,
  };
  const x = 7 + ((lng - bounds.west) / (bounds.east - bounds.west)) * 86;
  const y = 8 + ((bounds.north - lat) / (bounds.north - bounds.south)) * 84;
  const visible =
    lat <= bounds.north &&
    lat >= bounds.south &&
    lng >= bounds.west &&
    lng <= bounds.east;

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
          <h2>{item?.title ?? message.itemTitle ?? "삭제된 게시글"}</h2>
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

  function handlePlaceChange(placeName) {
    const spot = campusSpots.find((spotItem) => spotItem.name === placeName);
    setDraft((prev) => ({
      ...prev,
      place: placeName,
      location: spot
        ? {
            x: spot.x,
            y: spot.y,
            lat: spot.lat,
            lng: spot.lng,
            source: "MANUAL_SELECT",
          }
        : prev.location,
    }));
  }

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

        <label className="field">
          <span>{draft.type === "found" ? "발견 위치" : "예상 분실 위치"}</span>
          <select value={draft.place} onChange={(event) => handlePlaceChange(event.target.value)}>
            {campusSpots.map((spot) => (
              <option key={spot.id} value={spot.name}>
                {spot.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>설명</span>
          <textarea
            value={draft.description}
            onChange={(event) => updateDraft("description", event.target.value)}
            placeholder="물품 특징과 보관 위치를 적어주세요."
          />
        </label>

        <button className="primary-action" type="submit">
          등록하기
        </button>
      </form>
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
    default:
      return "사진 GPS가 있으면 위치가 자동 설정됩니다.";
  }
}

export default App;
