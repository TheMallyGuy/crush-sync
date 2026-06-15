import { Hono } from 'hono'
import { cors } from 'hono/cors'
import authRoute from "./v1/auth/auth"
import configRoute from './v1/config/config'
import v2configRoute from './v2/config/config';

const app = new Hono()

app.use("/v1/auth/*", cors())
app.use("/v1/config/*", cors())
app.use("/v2/config/*", cors())

app.route("/v1/auth", authRoute)
app.route("/v1/config", configRoute)

app.route("/v2/config", v2configRoute)


app.get('/', (c) => {
  return c.redirect("https://github.com/themallyguy/crush-sync")
})

export default app