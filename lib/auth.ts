"use client"

export type FlexioUser = {
  id: string
  gym_id?: string
  userType?: "member" | "owner"
  user_type?: "member" | "gym_owner"
  [key: string]: any
}

export function getCurrentUser(): FlexioUser | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem("flexio_user")
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Normalize role naming across the app
    const supabaseRole = parsed?.user_type as "member" | "gym_owner" | undefined
    const appRole = parsed?.userType as "member" | "owner" | undefined
    let normalized: "member" | "owner" | undefined = appRole
    if (!normalized && supabaseRole) {
      normalized = supabaseRole === "gym_owner" ? "owner" : "member"
    }
    return { ...parsed, userType: normalized }
  } catch (e) {
    return null
  }
}

export function redirectIfNotAuthenticated(expectedRole?: "member" | "owner"): FlexioUser | null {
  const user = getCurrentUser()
  if (!user) {
    if (typeof window !== "undefined") {
      window.location.href = "/auth/signin"
    }
    return null
  }

  if (expectedRole) {
    const actualRole: "member" | "owner" | undefined = user.userType
    if (!actualRole) {
      if (typeof window !== "undefined") {
        window.location.href = "/auth/signin"
      }
      return null
    }
    if (actualRole !== expectedRole) {
      if (typeof window !== "undefined") {
        window.location.href = actualRole === "owner" ? "/owner/dashboard" : "/member/dashboard"
      }
      return null
    }
  }

  return user
}

export function logout() {
  if (typeof window === "undefined") return
  localStorage.removeItem("flexio_user")
  window.location.href = "/auth/signin"
}