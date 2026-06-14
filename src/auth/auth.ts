import { Hono } from "hono"
import { setCookie, getCookie } from "hono/cookie"
import * as arctic from "arctic"

const authRoute = new Hono()

const discord = new arctic.Discord(
    "1484521125550620813",
    "KVN-hAJ5gszFGJGRcwh_rez7lE3T-JA8",
    "http://127.0.0.1:8787/auth/callback",
)

authRoute.get("/login", (c) => {
    const state = arctic.generateState()
    const scopes = ["identify", "email"]
    const url = discord.createAuthorizationURL(state, null, scopes)

    setCookie(c, "discord_oauth_state", state, {
        httpOnly: true,
        secure: true,        // false on localhost if not using https
        sameSite: "Lax",
        path: "/",
        maxAge: 600,         // 10 min
    })
    return c.redirect(url.toString())
})

authRoute.get("/callback", async (c) => {
    const code = c.req.query("code")
    const state = c.req.query("state")
    const storedState = getCookie(c, "discord_oauth_state")

    if (!code || !state || !storedState || state !== storedState) {
        return c.text("Invalid request", 400)
    }

    try {
        const tokens = await discord.validateAuthorizationCode(code, null)

        setCookie(c, "access_token", tokens.accessToken(), {
            httpOnly: true,
            secure: true,
            sameSite: "Lax",
            path: "/",
        })
        setCookie(c, "refresh_token", tokens.refreshToken(), {
            httpOnly: true,
            secure: true,
            sameSite: "Lax",
            path: "/",
        })
        return c.text("Running on cookies! authorized, you now may close this page")
    } catch (e) {
        if (e instanceof arctic.OAuth2RequestError) {
            return c.text("Invalid authorization code", 400)
        }
        if (e instanceof arctic.ArcticFetchError) {
            return c.text("Failed to reach Discord", 502)
        }
        throw e
    }
})

export default authRoute