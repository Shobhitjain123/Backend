import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      'Something went wrong while generating access and refresh token'
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // get userdetails from frontend
  // validate- no empty
  // check if user already exists or not
  // check for images, check for avatar
  // upload them to cloudinary, avatar
  // create user object - crate entry in db
  // remove password and refresh token field from response
  // check for user creation
  // return res

  console.log('Request files:', req.files);
  console.log('Request body:', req.body);

  // Validation- No Field is empty
  const { fullname, email, username, password } = req.body;
  if ([fullname, email, username, password].some((el) => el?.trim() === '')) {
    throw new ApiError(400, 'All fields are required');
  }

  // Validation - User already exists
  const existingUser = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (existingUser) {
    throw new ApiError(409, 'User aleady exists with this username or email!!');
  }

  // Upload and check for images
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, 'Avatar file is required');
  }

  // Uploading file on cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  // Check if Avatar is successfully uploaded
  if (!avatar) {
    throw new ApiError(400, 'Avatar file is required on cloudinary');
  }

  // Create user object entry in database
  const user = await User.create({
    fullname,
    email,
    password,
    username: username.toLowerCase(),
    avatar: avatar.url,
    coverImage: coverImage?.url || '',
  });

  // Removing password and refreshtoken from response
  const userCreated = await User.findById(user._id).select(
    '-password -refreshToken'
  );

  // Check if user is created
  if (!userCreated) {
    throw new ApiError(500, 'Something went wrong while registring the user');
  }

  return res
    .status(200)
    .json(new ApiResponse(201, userCreated, 'User is registered successfully'));
});

const loginUser = asyncHandler(async (req, res) => {
  // req.body -> data
  // username or email check
  // find user
  // check password
  // access and refresh token
  //send cookie

  const { email, username, password } = req.body;

  // Validation to check if username or email is passed by user
  if (!(username && email)) {
    throw new ApiError(400, 'Username or email is required');
  }

  //Find user in DB
  const user = await User.findOne({
    $or: [{ username, email }],
  });
  if (!user) {
    throw new ApiError(404, 'User not found, Please register first to login');
  }

  // Check if password is correct
  const isPasswordCorrect = await user.isPasswordCorrect(password);
  if (!isPasswordCorrect) {
    throw new ApiError(401, 'Invalid password credentials');
  }

  // Get generated access and refresh token
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  // Removing pasword and refresh token from the final response to the user
  const loggedInUser = await User.findById(user._id).select(
    '-password -refreshToken'
  );

  const options = {
    httpOnly: true,
    secure: false,
  };

  return res
    .status(200)
    .cookie('accessToken', accessToken, options)
    .cookie('refreshToken', refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          refreshToken,
          accessToken,
        },
        'User is logged in successfully'
      )
    );
});

const logOutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: false,
  };

  return res
    .status(200)
    .clearCookie('accessToken', options)
    .clearCookie('refreshToken', options)
    .json(
      new ApiResponse(200, {}, "User is logged out")
    );
});

const refreshAccessToken = asyncHandler(async(req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
      throw new ApiError(401, "Unauthorized user")
    }

    try {
      const decode = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
  
      const user = await User.findById(decode?._id)
  
      if(!user){
        throw new ApiError(401, "Invalid refresh token")
      }
  
      if(incomingRefreshToken !== user.refreshToken){
        throw new ApiError(401, "Refresh token is expired or invalid")
      }
  
      const {accessToken, newRefreshToken} = generateAccessAndRefreshToken(user._id)
  
      const options = {
          httpOnly: true,
          secure: false
      }
  
      res.status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(200, {
          accessToken,
          refreshAccessToken: newRefreshToken
        }, "Token is refreshed")
      )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh Token")
    }

})
export { registerUser, loginUser, logOutUser, refreshAccessToken };
