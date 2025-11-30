export interface JwtPayload {
  sub: string; // user id
  email: string;
  username: string;
  role?: string;
  iat?: number;
  exp?: number;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string | null;
    role?: string;
  };
}
