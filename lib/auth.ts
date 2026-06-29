import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
    MicrosoftEntraId({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid profile email Mail.Read User.Read offline_access",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        console.log("[JWT callback] initial sign-in, account.refresh_token exists:", !!account?.refresh_token);
      }
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      if (account?.refresh_token) {
        token.refreshToken = account.refresh_token;
      }
      if (account?.expires_at) {
        token.accessTokenExpires = account.expires_at * 1000;
      }
      if (account?.provider) {
        token.provider = account.provider;
      }

      // If access token has not expired, return it as-is
      if (Date.now() < (token.accessTokenExpires as number ?? 0)) {
        return token;
      }

      // Microsoft tokens use a different refresh endpoint — skip Google refresh
      if (token.provider === "microsoft-entra-id") {
        return token;
      }

      // Access token expired — try to refresh it
      let next = token;
      try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type: "refresh_token",
            refresh_token: token.refreshToken as string,
          }),
        });
        const refreshed = await response.json() as { access_token?: string; expires_in?: number; refresh_token?: string };
        if (!response.ok) throw refreshed;
        next = {
          ...token,
          accessToken: refreshed.access_token,
          accessTokenExpires: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
          refreshToken: refreshed.refresh_token ?? token.refreshToken,
        };
      } catch (error) {
        console.error("Failed to refresh access token", error);
        next = { ...token, error: "RefreshAccessTokenError" };
      }

      console.log("[JWT callback] token.refreshToken exists:", !!next.refreshToken);
      console.log("[JWT callback] token.accessToken exists:", !!next.accessToken);
      console.log("[JWT callback] token.accessTokenExpires:", next.accessTokenExpires);
      console.log("[JWT callback] Date.now():", Date.now());
      console.log("[JWT callback] token expired:", Date.now() >= (next.accessTokenExpires as number ?? 0));

      return next;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      session.provider = token.provider as string | undefined;
      return session;
    },
  },
});
