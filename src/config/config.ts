import { Hono } from "hono";
import { env } from "cloudflare:workers"
import * as arctic from "arctic"

const discord = new arctic.Discord(
    env.DISCORD_CLIENT_ID,
    env.DISCORD_CLIENT_SECRET,
    "http://127.0.0.1:8787/auth/callback",
)

type UserData = {
    id: number
    username: string
    avatar: string
}

const configRoute = new Hono()

configRoute.post("sync", async (c) => {

    const recviced_json = await c.req.json()
    try {
        const authHeader = c.req.header("Authorization")
        const refresh = authHeader?.replace("Bearer ", "")

        if (!refresh) {
            return c.text("Unauthorized", 401)
        }

        const tokens = await discord.refreshAccessToken(refresh)

        const response = await fetch("https://discord.com/api/users/@me", {
            headers: {
                Authorization: `Bearer ${tokens.accessToken()}`
            }
        })

        const userData: UserData = await response.json()

        await env.KV.put(`${userData.id}`, JSON.stringify(recviced_json))

        return c.text("Success", 200)

    } catch (e) {
        console.error(e) 
        
        if (e instanceof arctic.OAuth2RequestError) {
            return c.text("Error during authenication", 400)
        }
    }
})

export default configRoute;