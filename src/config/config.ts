import { Hono } from "hono";
import { env } from "cloudflare:workers"

type Session = {
    userId: string
    username: string
}

const configRoute = new Hono()

configRoute.post("/sync", async (c) => {
    const authHeader = c.req.header("Authorization")
    const token = authHeader?.replace("Bearer ", "")

    if (!token) {
        return c.text("Unauthorized", 401)
    }

    const raw = await env.KV.get(`token:${token}`)
    if (!raw) {
        return c.text("Unauthorized", 401)
    }

    const session: Session = JSON.parse(raw)

    const receivedJson = await c.req.json()
    await env.KV.put(`config:${session.userId}`, JSON.stringify(receivedJson))

    return c.text("Success", 200)
})

configRoute.get("/sync", async (c) => {
    const authHeader = c.req.header("Authorization")
    const token = authHeader?.replace("Bearer ", "")

    if (!token) {
        return c.text("Unauthorized", 401)
    }

    const raw = await env.KV.get(`token:${token}`)
    if (!raw) {
        return c.text("Unauthorized", 401)
    }

    const session: Session = JSON.parse(raw)

    const savedConfig = await env.KV.get(`config:${session.userId}`)

    if (!savedConfig) {
        return c.text("Error when trying to getting your configuration", 500)
    }

    return c.text(savedConfig, 200)
})

export default configRoute;
