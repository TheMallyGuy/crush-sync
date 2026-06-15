import { Hono } from 'hono'
import { cors } from 'hono/cors'
import authRoute from "./auth/auth"
import configRoute from './config/config'

const app = new Hono()

app.use("/auth/*", cors())
app.use("/config/*", cors())

app.route("/auth", authRoute)
app.route("/config", configRoute)

app.get('/', (c) => {
  return c.redirect("https://github.com/themallyguy/crush-sync")
})

export default app