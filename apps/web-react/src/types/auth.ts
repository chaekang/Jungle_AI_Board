export type PublicUser = {
  id: string
  email: string
  nickname: string
}

export type LoginResponse = {
  accessToken: string
  user: PublicUser
}
