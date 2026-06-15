import { Hono } from 'hono'
import authRoute from "./auth/auth"
import configRoute from './config/config'

const app = new Hono()

app.route("/auth", authRoute)
app.route("/config", configRoute)

app.get('/', (c) => {
  return c.redirect("https://github.com/themallyguy/crush-sync")
})

export default app