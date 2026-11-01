// ---------------------------------------------------------------------------
// User identity — generates and persists a unique client identifier in
// localStorage so the Favorites and Reviews APIs can associate data with
// this browser session.  No authentication is involved.
// ---------------------------------------------------------------------------

const USER_IDENTIFIER_KEY = 'bore_barrel_user_id'
const USER_PROFILE_KEY = 'bore_barrel_user_profile'

/**
 * Check if a string is a valid UUID
 */
const isValidUUID = (str) =>
  typeof str === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)

/**
 * Generate a standard RFC4122 v4 UUID
 */
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Return a stable, randomly-generated user identifier (UUID).
 * Compatible with Supabase PostgreSQL UUID foreign keys.
 * Creates one on first call and stores it in localStorage.
 */
export const getUserIdentifier = () => {
  try {
    let userId = localStorage.getItem(USER_IDENTIFIER_KEY)
    if (!userId || !isValidUUID(userId)) {
      userId = generateUUID()
      localStorage.setItem(USER_IDENTIFIER_KEY, userId)
    }
    return userId
  } catch {
    // Private / incognito mode may throw — return a transient UUID.
    return generateUUID()
  }
}

/**
 * Return the user profile object stored in localStorage, or a sensible
 * default.  The profile is purely cosmetic (username for reviews, etc.).
 */
export const getUserProfile = () => {
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      return { username: p.username || 'Shooter', avatar: p.avatar || null, bio: p.bio || '', phone: p.phone || '087822408980', userId: p.userId || getUserIdentifier() }
    }
  } catch {
    /* corrupted data — fall through to default */
  }
  return {
    username: 'Shooter',
    avatar: null,
    bio: '',
    phone: '087822408980',
    userId: getUserIdentifier(),
  }
}

/**
 * Persist an updated profile object.
 */
export const saveUserProfile = (profile) => {
  try {
    const data = {
      ...profile,
      userId: getUserIdentifier(),
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(data))
    return { success: true, data }
  } catch (err) {
    return { success: false, message: err.message }
  }
}

/**
 * Update username
 */
export const updateUsername = (username) => {
  const profile = getUserProfile()
  profile.username = username.trim() || 'Shooter'
  return saveUserProfile(profile)
}

/**
 * Update bio
 */
export const updateBio = (bio) => {
  const profile = getUserProfile()
  profile.bio = bio.trim()
  return saveUserProfile(profile)
}

/**
 * Update avatar
 */
export const updateAvatar = (avatarBase64) => {
  const profile = getUserProfile()
  profile.avatar = avatarBase64
  return saveUserProfile(profile)
}

/**
 * Reset identifier (generates a new anonymous identifier)
 */
export const resetUserIdentifier = () => {
  try {
    localStorage.removeItem(USER_IDENTIFIER_KEY)
    localStorage.removeItem(USER_PROFILE_KEY)
    return getUserIdentifier()
  } catch {
    return `anon_${Date.now()}`
  }
}

export default {
  getUserIdentifier,
  getUserProfile,
  saveUserProfile,
  updateUsername,
  updateBio,
  updateAvatar,
  resetUserIdentifier,
}
