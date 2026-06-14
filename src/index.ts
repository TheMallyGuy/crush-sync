import { Hono } from 'hono'
import authRoute from "./auth/auth"

const app = new Hono()

app.route("/auth", authRoute)

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

export default app