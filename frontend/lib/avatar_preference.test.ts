import {
  AVATAR_PROVIDER_COOKIE_NAME,
  readAvatarProviderPreference,
  writeAvatarProviderPreference,
} from "./avatar_preference";
import { denyStorageAccess, failStorageReads, failStorageWrites } from "./storage_test_helpers";

beforeEach(() => {
  window.localStorage.clear();
  document.cookie = `${AVATAR_PROVIDER_COOKIE_NAME}=; max-age=0; path=/`;
});

afterEach(() => {
  window.localStorage.clear();
  document.cookie = `${AVATAR_PROVIDER_COOKIE_NAME}=; max-age=0; path=/`;
});

test("reads null when browser storage is unavailable", () => {
  const restoreStorage = denyStorageAccess();

  try {
    expect(readAvatarProviderPreference()).toBeNull();
  } finally {
    restoreStorage();
  }
});

test("survives denied browser storage when saving the avatar preference", () => {
  const restoreStorage = denyStorageAccess();

  try {
    expect(() => writeAvatarProviderPreference("sage-svg-2d")).not.toThrow();
  } finally {
    restoreStorage();
  }
});

test("survives quota errors when saving the avatar preference", () => {
  const restoreStorage = failStorageWrites();

  try {
    expect(() => writeAvatarProviderPreference("sage-svg-2d")).not.toThrow();
  } finally {
    restoreStorage();
  }
});

test("reads null when storage reads fail", () => {
  const restoreStorage = failStorageReads();

  try {
    expect(readAvatarProviderPreference()).toBeNull();
  } finally {
    restoreStorage();
  }
});
