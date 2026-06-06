import axios from "axios";
import { campusSpots, categories } from "./data.js";

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
  book: 6,
  etc: 7,
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
  wonhyo: 1,
  library: 2,
  "student-hall": 3,
  munmu: 4,
  jinheung: 5,
  science: 11,
  ground: 14,
  centennial: 31,
  "main-gate": 10,
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

  const images = draft.photoFile ? await uploadImages([draft.photoFile], session?.token) : [];
  const { data } = await api.post(
    "/items",
    toCreatePayload(draft, images, session?.user?.id),
    {
      headers: authHeaders(session?.token),
    },
  );
  return toLocalItem({
    ...data.item,
    thumbnail_url: images[0]?.storage_url,
  });
}

export async function sendMessageOnApi(item, content, session) {
  if (!USE_BACKEND) return null;

  const itemId = item.remoteId ?? item.id;
  const requestConfig = {
    headers: authHeaders(session?.token),
  };
  const roomResponse = await api.post(
    "/rooms",
    {
      item_id: itemId,
    },
    requestConfig,
  );

  const roomId = roomResponse.data.room_id;
  const { data } = await api.post(
    `/rooms/${roomId}/messages`,
    {
      content,
    },
    requestConfig,
  );

  return data.data;
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

function toLocalItem(item) {
  const type = item.type === "FOUND" ? "found" : "request";
  const category = resolveLocalCategory(item.category_name, item.category_id);
  const location = resolveLocation(item);
  const label = categories.find((entry) => entry.id === category)?.label ?? "물품";

  return {
    id: item.id,
    remoteId: item.id,
    type,
    category,
    title: item.title,
    description: item.description || "상세 설명이 없습니다.",
    place: item.location_detail || item.building_name || "위치 미확인",
    time: formatRelativeTime(item.created_at),
    imageLabel: item.thumbnail_url ? label : label,
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

  const entry = Object.entries(categoryIdByLocalId).find(([, id]) => id === Number(categoryId));
  return entry?.[0] ?? "etc";
}

function resolveLocation(item) {
  const spot = findSpot(item.building_name || item.location_detail);

  return {
    x: spot?.x ?? 50,
    y: spot?.y ?? 50,
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
    book: "#b45309",
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
