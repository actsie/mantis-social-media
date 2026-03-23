import { SessionOptions } from 'iron-session'

export interface SessionData {
  authenticated?: boolean
}

export const sessionOptions: SessionOptions = {
  password: process.env.APP_SECRET as string,
  cookieName: 'agentcard_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
  },
}
