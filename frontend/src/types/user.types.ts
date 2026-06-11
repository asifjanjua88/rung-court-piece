export type IdentityType = 'guest' | 'email'

export interface User {
  id: string
  identityType: IdentityType
  displayName: string
  email?: string
  isVerified: boolean
  createdAt: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken?: string
}
