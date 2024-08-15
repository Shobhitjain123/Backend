import express from "express";
import cors from "cors"
import cookieParser from "cookie-parser";

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended:true, limit: "16kb"}))
app.use(express.static("public"))
app.use(cookieParser())

// Routes import

import userRoute from './routes/user.routes.js'

// Routes Declaration

app.use('/api/v1/users', userRoute)
app.use('/api/v1/login', userRoute)
app.use('/api/v1/logout', userRoute)


export { app } 