import dotenv from "dotenv"
import connectDB from "./db/index.js";
import { app } from "./app.js"
dotenv.config({path: "./.env"})


const port = process.env.PORT || 8000

connectDB()
.then(() => {

    app.on("Error", (err) => {
        console.log("Error: ", err)
        throw err
    })

    app.listen(port, () => {
        console.log(`Listening on port ${port}`)
    })
})
.catch((err) => {
    console.log(`MongoDB Connection Failed: `, err)
})




















/*
import express from "express";

const app = express();

( async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error", (error) => {
            console.log("Error: ", error);
            throw error
        })

        app.listen(process.env.PORT, () => {
            console.log(`Listening on port ${process.env.PORT}`)
        })


    } catch (error) {
        console.log("Error: ", error)
        throw error
    }
})()

*/