import { Hono } from "hono"
import { env } from "cloudflare:workers";
import { setCookie, getCookie } from "hono/cookie"
import * as arctic from "arctic"

const authRoute = new Hono()

const discord = new arctic.Discord(
    env.DISCORD_CLIENT_ID,
    env.DISCORD_CLIENT_SECRET,
    env.DISCORD_REDIRECT_URI,
)

type UserData = {
    id: string
    username: string
    avatar: string
}

const PAIR_TTL = 300

authRoute.get("/login", (c) => {
    const pair = c.req.query("pair")
    if (!pair) {
        return c.text("Missing pair", 400)
    }

    const state = `${arctic.generateState()}.${pair}`
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

    const pair = state.split(".")[1]
    if (!pair) {
        return c.text("Invalid request", 400)
    }

    try {
        const tokens = await discord.validateAuthorizationCode(code, null)

        const response = await fetch("https://discord.com/api/users/@me", {
            headers: {
                Authorization: `Bearer ${tokens.accessToken()}`,
            },
        })
        const userData: UserData = await response.json()

        const token = crypto.randomUUID()
        await env.KV.put(`token:${token}`, JSON.stringify({
            userId: userData.id,
            username: userData.username,
        }))

        await env.KV.put(`pair:${pair}`, token, { expirationTtl: PAIR_TTL })

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


authRoute.get("/poll", async (c) => {
    const pair = c.req.query("pair")
    if (!pair) {
        return c.text("Missing pair", 400)
    }

    const token = await env.KV.get(`pair:${pair}`)
    if (!token) {
        return c.body(null, 204)
    }

    await env.KV.delete(`pair:${pair}`)
    return c.json({ token })
})

export default authRoute
