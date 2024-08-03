import { asyncHandler } from "../utils/asyncHandler.js";

const registerUser = asyncHandler( async (req, res) => {
    console.log(req.url)
    console.log(req.baseUrl)
    console.log(req.originalUrl)
    res.status(200).json({
        message: "Haa ho gaya"
    })
} )

export {registerUser}