import { Hono } from 'hono'
import { cors } from 'hono/cors'
import authRoute from "./auth/auth"
import configRoute from './config/config'

const app = new Hono()

app.use("/v1/auth/*", cors())
app.use("/v1/config/*", cors())

app.route("/v1/auth", authRoute)
app.route("/v1/config", configRoute)

app.get('/', (c) => {
  return c.redirect("https://github.com/themallyguy/crush-sync")
})

export default app