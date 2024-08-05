import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"
const registerUser = asyncHandler( async (req, res) => {
    // get userdetails from frontend
    // validate- no empty
    // check if user already exists or not
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - crate entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res   

    // Validation- No Field is empty
    const {fullname, email, username, password} = req.body
    console.log("Email: ", email);
    if([fullname, email, username, password].some(el => el?.trim() === "")){
        throw new ApiError(400, "All fields are required")
    }

    // Validation - User already exists
    const existingUser = User.findOne({
        $or: [{username}, {email}]
    })
    if(existingUser) 
    {
        throw new ApiError(409, "User aleady exists with this username or email!!")
    }

    // Upload and check for images
        const avatarLocalPath = req.files?.avatar[0]?.path
        const coverImageLocalPath = req.files?.coverImage[0]?.path
        if(!avatarLocalPath){
            throw new ApiError(400, "Avatar file is required")
        }
    
    // Uploading file on cloudinary
       const avatar = await uploadOnCloudinary(avatarLocalPath)
       const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    // Check if Avatar is successfully uploaded
        if(!avatar){
            throw new ApiError(400, "Avatar file is required")
        }
    
    // Create user object entry in database
    const user = await User.create({
        fullname,
        email,
        password,
        username: username.toLowerCase(),
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
    })

    // Removing password and refreshtoken from response
    const userCreated = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    // Check if user is created
    if(!userCreated){
        throw new ApiError(500, "Something went wrong while registring the user")
    }

    return new ApiResponse(201, userCreated, "User is registered successfully")
} )

export {registerUser}