import axios from "axios";
import { campusMapPoints, campusSpots, categories } from "./data.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const DEMO_USER_ID = Number(import.meta.env.VITE_DEMO_USER_ID || 1);
const USE_BACKEND = import.meta.env.VITE_USE_BACKEND === "true";
const AUTH_STORAGE_KEY = "campusfind.auth";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 6000,
});

const categoryIdByLocalId = {
  electronics: 1,
  wallet: 2,
  "student-id": 3,
  bag: 4,
  clothes: 5,
  etc: 6,
};

const localCategoryByBackendId = {
  1: "electronics",
  2: "wallet",
  3: "student-id",
  4: "bag",
  5: "clothes",
  6: "etc",
};

const localCategoryByBackendName = {
  전자기기: "electronics",
  지갑: "wallet",
  카드: "wallet",
  학생증: "student-id",
  가방: "bag",
  의류: "clothes",
  책: "book",
  필기구: "book",
  기타: "etc",
};

const buildingIdBySpotId = {
  wonhyo: 8,
  library: 7,
  "student-hall": 1,
  munmu: 4,
  jinheung: 9,
  science: 3,
  ground: 16,
  centennial: 6,
};

export function isBackendEnabled() {
  return USE_BACKEND;
}

export function getStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;

    const session = JSON.parse(raw);
    if (!session?.token || !session?.user) return null;

    return session;
  } catch {
    return null;
  }
}

export function saveStoredAuth(session) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function loginWithApi({ email, password }) {
  const { data } = await api.post("/auth/login", { email, password });
  return normalizeSession(data);
}

export async function signupWithApi({ email, password, nickname, studentId }) {
  const { data } = await api.post("/auth/signup", {
    email,
    password,
    nickname,
    student_id: studentId,
  });

  return normalizeSession(data);
}

export async function sendSignupCodeWithApi(email) {
  const { data } = await api.post("/auth/send-code", { email });
  return data;
}

export async function verifySignupCodeWithApi({ email, code }) {
  const { data } = await api.post("/auth/verify-code", { email, code });
  return data;
}

export async function fetchItemsFromApi() {
  if (!USE_BACKEND) return [];

  const { data } = await api.get("/items");
  return (data.items ?? []).map(toLocalItem);
}

export async function createItemOnApi(draft, session) {
  if (!USE_BACKEND) return null;

  let images = [];
  if (draft.photoFile) {
    try {
      images = await uploadImages([draft.photoFile], session?.token);
    } catch (error) {
      console.warn("이미지 업로드에 실패해 게시글만 등록합니다.", error);
    }
  }

  const { data } = await api.post(
    "/items",
    toCreatePayload(draft, images, session?.user?.id),
    {
      headers: authHeaders(session?.token),
    },
  );
  const savedImage = data.images?.[0] ?? images[0];
  return toLocalItem({
    ...data.item,
    thumbnail_url: savedImage?.storage_url,
  });
}

export async function deleteItemOnApi(item, session) {
  if (!USE_BACKEND) return null;

  const itemId = item.remoteId ?? item.id;
  const { data } = await api.delete(`/items/${itemId}`, {
    headers: authHeaders(session?.token),
  });

  return data;
}

export async function updateItemOnApi(item, draft, session) {
  if (!USE_BACKEND) return null;

  const itemId = item.remoteId ?? item.id;
  const { data } = await api.patch(
    `/items/${itemId}`,
    toUpdatePayload(draft),
    {
      headers: authHeaders(session?.token),
    },
  );

  return toLocalItem({
    ...data.item,
    thumbnail_url: item.imageUrl,
  });
}

export async function sendMessageOnApi(item, content, session) {
  if (!USE_BACKEND) return null;

  const itemId = item.remoteId ?? item.id;
  const senderId = session?.user?.id ?? DEMO_USER_ID;
  const requestConfig = {
    headers: authHeaders(session?.token),
  };
  const roomResponse = await api.post(
    "/rooms",
    {
      item_id: itemId,
      sender_id: senderId,
    },
    requestConfig,
  );

  const roomId = roomResponse.data.room_id;
  const { data } = await api.post(
    `/rooms/${roomId}/messages`,
    {
      sender_id: senderId,
      content,
    },
    requestConfig,
  );

  return data.data;
}

export async function fetchInboxMessagesFromApi(session) {
  if (!USE_BACKEND || !session?.user?.id || !session?.token) return [];

  const userId = Number(session.user.id);
  const requestConfig = {
    headers: authHeaders(session.token),
  };
  const { data } = await api.get("/rooms", {
    ...requestConfig,
    params: { user_id: userId },
  });
  const rooms = data.rooms ?? [];
  const roomMessages = await Promise.all(
    rooms.map(async (room) => {
      const response = await api.get(`/rooms/${room.id}/messages`, {
        ...requestConfig,
        params: { user_id: userId },
      });
      const messages = response.data.messages ?? [];
      const lastMessage = messages.at(-1);

      return toInboxMessage(room, lastMessage, userId);
    }),
  );

  return roomMessages.filter(Boolean);
}

export async function fetchRoomMessagesFromApi(roomId, session) {
  if (!USE_BACKEND || !session?.user?.id || !session?.token || !roomId) return [];

  const userId = Number(session.user.id);
  const { data } = await api.get(`/rooms/${roomId}/messages`, {
    headers: authHeaders(session.token),
    params: { user_id: userId },
  });

  return (data.messages ?? []).map((message) => toConversationMessage(message, userId));
}

export async function sendRoomMessageOnApi(roomId, content, session) {
  if (!USE_BACKEND || !session?.user?.id || !session?.token || !roomId) return null;

  const userId = Number(session.user.id);
  const { data } = await api.post(
    `/rooms/${roomId}/messages`,
    {
      sender_id: userId,
      content,
    },
    { headers: authHeaders(session.token) },
  );

  return toConversationMessage({ ...data.data, room_id: roomId }, userId);
}

export async function markRoomReadOnApi(roomId, session) {
  if (!USE_BACKEND || !session?.user?.id || !session?.token || !roomId) return null;

  const { data } = await api.put(
    `/rooms/${roomId}/read`,
    { user_id: Number(session.user.id) },
    { headers: authHeaders(session.token) },
  );

  return data;
}

async function uploadImages(files, token) {
  const formData = new FormData();
  files.forEach((file) => formData.append("images", file));

  const { data } = await api.post("/images/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
      ...authHeaders(token),
    },
  });

  return data.images ?? [];
}

function toCreatePayload(draft, images, authorId) {
  const spot = findSpot(draft.place);
  const location = draft.location ?? {
    lat: spot?.lat,
    lng: spot?.lng,
  };

  return {
    author_id: authorId ?? DEMO_USER_ID,
    category_id: categoryIdByLocalId[draft.category] ?? categoryIdByLocalId.etc,
    building_id: buildingIdBySpotId[spot?.id] ?? 1,
    type: draft.type === "found" ? "FOUND" : "LOST",
    title: draft.title.trim(),
    description: draft.description.trim(),
    location_detail: draft.place,
    latitude: location.lat,
    longitude: location.lng,
    reward_amount: draft.type === "request" ? Number(draft.reward || 0) : 0,
    images,
  };
}

function toUpdatePayload(draft) {
  const spot = findSpot(draft.place);
  const location = draft.location ?? {
    lat: spot?.lat,
    lng: spot?.lng,
  };

  return {
    category_id: categoryIdByLocalId[draft.category] ?? categoryIdByLocalId.etc,
    building_id: buildingIdBySpotId[spot?.id] ?? 1,
    type: draft.type === "found" ? "FOUND" : "LOST",
    title: draft.title.trim(),
    description: draft.description.trim(),
    location_detail: draft.place,
    latitude: location.lat,
    longitude: location.lng,
    reward_amount: draft.type === "request" ? Number(draft.reward || 0) : 0,
  };
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function normalizeUser(user = {}) {
  return {
    id: user.id,
    email: user.email ?? "",
    nickname: user.nickname ?? user.name ?? "캠퍼스 사용자",
    studentId: user.student_id ?? user.studentId ?? "",
  };
}

function normalizeSession(payload = {}) {
  if (!payload.token) {
    throw new Error("서버 응답에 JWT 토큰이 없습니다.");
  }

  return {
    token: payload.token,
    user: normalizeUser(payload.user),
  };
}

function toInboxMessage(room, lastMessage, userId) {
  const unreadCount = Number(room.unread_count ?? 0);
  const isSent = Number(lastMessage?.sender_id) === userId;
  const timeSource = lastMessage?.created_at || room.last_message_at || room.created_at;

  return {
    id: lastMessage ? `room-${room.id}-message-${lastMessage.id}` : `room-${room.id}`,
    roomId: room.id,
    itemId: room.item_id,
    itemTitle: room.item_title,
    direction: isSent ? "sent" : "received",
    sender: isSent ? "나" : room.other_nickname || "상대방",
    time: formatRelativeTime(timeSource),
    unread: !isSent && unreadCount > 0,
    message: lastMessage?.content || room.last_message || "아직 메시지가 없습니다.",
  };
}

function toConversationMessage(message, userId) {
  const isSent = Number(message.sender_id) === userId;

  return {
    id: message.id,
    roomId: message.room_id,
    direction: isSent ? "sent" : "received",
    sender: isSent ? "나" : "상대방",
    time: formatRelativeTime(message.created_at),
    unread: !isSent && message.is_read === false,
    message: message.content || "",
    createdAt: message.created_at,
  };
}

function toLocalItem(item) {
  const type = item.type === "FOUND" ? "found" : "request";
  const category = resolveLocalCategory(item.category_name, item.category_id);
  const location = resolveLocation(item);
  const label = categories.find((entry) => entry.id === category)?.label ?? "물품";

  return {
    id: item.id,
    remoteId: item.id,
    authorId: item.author_id ? Number(item.author_id) : null,
    type,
    category,
    title: item.title,
    description: item.description || "상세 설명이 없습니다.",
    place: item.location_detail || item.building_name || "위치 미확인",
    time: formatRelativeTime(item.created_at),
    imageLabel: item.thumbnail_url ? label : label,
    imageUrl: item.thumbnail_url ?? null,
    color: type === "found" ? colorForCategory(category) : "#2563eb",
    location,
    reward: Number(item.reward_amount || 0),
  };
}

function resolveLocalCategory(categoryName, categoryId) {
  if (categoryName) {
    const matchedKey = Object.keys(localCategoryByBackendName).find((keyword) =>
      categoryName.includes(keyword),
    );

    if (matchedKey) return localCategoryByBackendName[matchedKey];
  }

  return localCategoryByBackendId[Number(categoryId)] ?? "etc";
}

function resolveLocation(item) {
  const spot = findSpot(item.building_name || item.location_detail);
  const exactPlace = (item.building_name || item.location_detail || "").trim();
  const mapPoint = campusMapPoints.find((point) => point.name === exactPlace);

  return {
    x: spot?.x ?? 50,
    y: spot?.y ?? 50,
    mapX: mapPoint?.x,
    mapY: mapPoint?.y,
    lat: Number(item.latitude ?? spot?.lat ?? 35.8622),
    lng: Number(item.longitude ?? spot?.lng ?? 129.1951),
    source: "SERVER",
  };
}

function findSpot(value = "") {
  return campusSpots.find((spot) => value.includes(spot.name)) ?? campusSpots[0];
}

function colorForCategory(category) {
  const colors = {
    electronics: "#2f3437",
    wallet: "#2563eb",
    "student-id": "#0f766e",
    bag: "#64748b",
    clothes: "#7c3aed",
    etc: "#3182f6",
  };

  return colors[category] ?? colors.etc;
}

function formatRelativeTime(value) {
  if (!value) return "방금";

  const createdAt = new Date(value);
  if (Number.isNaN(createdAt.getTime())) return "방금";

  const diffMinutes = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 60000));
  if (diffMinutes < 1) return "방금";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}일 전`;

  return createdAt.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}
