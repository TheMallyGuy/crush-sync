import { Hono } from 'hono'
import authRoute from "./auth/auth"
import configRoute from './config/config'

const app = new Hono()

app.route("/auth", authRoute)
app.route("/config", configRoute)

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

export default app