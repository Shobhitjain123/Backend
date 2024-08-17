import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

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
  // Find and update(make empty) the refresh token from Db based on the user details taken from middleware
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

  // send response with successfull user logged out and token cleared from cookies
  return res
    .status(200)
    .clearCookie('accessToken', options)
    .clearCookie('refreshToken', options)
    .json(new ApiResponse(200, {}, 'User is logged out'));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  // Get and validate token from cookies or request body
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, 'Unauthorized user');
  }

  try {
    // decode the incoming token
    const decode = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    // Find if user exists for the id extracted from decoded info from incoming token
    const user = await User.findById(decode?._id);

    // Validation user exists or not
    if (!user) {
      throw new ApiError(401, 'Invalid refresh token');
    }

    // validate if incoming token is same as refreshToken stored in DB for the user found
    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, 'Refresh token is expired or invalid');
    }

    // Generate new access and refreshToken for new login
    const { accessToken, newRefreshToken } = generateAccessAndRefreshToken(
      user._id
    );

    const options = {
      httpOnly: true,
      secure: false,
    };

    // Provide the user new Access and Refresh Tokens
    res
      .status(200)
      .cookie('accessToken', accessToken, options)
      .cookie('refreshToken', newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshAccessToken: newRefreshToken,
          },
          'Token is refreshed'
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || 'Invalid refresh Token');
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  // Get user from the req.user extracted from the auth middleware
  const user = await User.findById(req.user?._id);

  // Get oldPassword and new Password from request body
  const { oldPassword, newPassword } = req.body;

  if(!(oldPassword || newPassword)){
    throw new ApiError("Old or New password is required")
  }

  // Validate oldPassword is correct as per current loggedIn user
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(400, 'Invalid Old Password');
  }

  // Update and new passowrd for the user in the DB
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  // Return success for password successfully changed
  return res
    .status(200)
    .json(new ApiResponse(200, {}, 'Password changes successfully'));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

const updateUserAccount = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullname: fullname,
        email: email,
      },
    },
    {
      new: true,
    }
  ).select('-password');

  res.status(200).json(new ApiResponse(200, user, 'Account details updated'));
});

const updateAvatarImage = asyncHandler(async (req, res) => {
  try {
    const avatarLocalPath = req.file?.path;
    if (!avatarLocalPath) {
      throw new ApiError(400, 'Avatar file is missing');
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar) {
      throw new ApiError(400, 'Error while uploading avatar image');
    }

    const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          avatar: avatar.url,
        },
      },
      {
        new: true,
      }
    ).select('-password');

    return res
      .status(200)
      .json(new ApiError(200, user, 'Avatar image updated successfully'));
  } catch (error) {
    throw new ApiError(400, 'Something went wrong while uploading image');
  }
});

const updateCoverImage = asyncHandler(async (req, res) => {
  try {
    const coverLocalPath = req.file?.path;
    if (!coverLocalPath) {
      throw new ApiError(400, 'Cover image file is missing');
    }

    const coverImage = await uploadOnCloudinary(coverLocalPath);
    if (!coverImage) {
      throw new ApiError(400, 'Error while uploading cover image');
    }

    const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          coverImage: coverImage.url,
        },  
      },
      {
        new: true,
      }
    ).select('-password');

    return res
      .status(200)
      .json(new ApiError(200, user, 'Cover image updated successfully'));
  } catch (error) {
    throw new ApiError(400, 'Something went wrong while uploading image');
  }
});

const getUserProfileDetails = asyncHandler(async (req, res) => {
  const { username } = req.params;

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: 'subscriptions',
        localField: '_id',
        foreignField: 'channel',
        as: 'subscribers',
      },
    },
    {
      $lookup: {
        from: 'subscriptions',
        localField: '_id',
        foreignField: 'subscriber',
        as: 'subscribeTo',
      },
    },
    {
      $addFields: {
        subscriberCount: {
          $size: '$subscribers',
        },
        subscribeToCount: {
          $size: '$subscribeTo',
        },
        isSubscribed: {
          $cond: {
            if: {$in: [req.user?._id, "$subscribers.subscriber"]},
            then: true,
            else: false
          }
        }
      },
    },
    {
      $project: {
        fullname: 1,
        email: 1,
        username: 1,
        coverImage: 1,
        avatar: 1,
        subscribeToCount: 1,
        subscriberCount: 1,
        isSubscribed: 1

      }
    }
  ]);
  console.log(channel);
  if(!channel?.length){
    throw new ApiError(404, "Channel does not exist")
  }

  return res.status(200).json(new ApiResponse(200, channel[0], "User channel fetched successfully"))
});

const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(req.user._id)
        }
      },
      {
        $lookup: {
          from: "videos",
          localField: "watchHistory",
          foreignField: "_id",
          as: "watchHistory",
          pipeline: [
            {
              $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                  {
                    $project: {
                      fullname: 1,
                      username: 1,
                      avatar: 1
                    }
                  }
                ]
              }
            },
            {
              $addFields: {
                owner: {
                  $first: "$owner"
                }
              }
            }
          ]
        }
      }
     ])

     res
     .status(200)
     .json(new ApiResponse(200, user[0].watchHistory, "Watch History Fetched successfully"))
})

export {
  registerUser,
  loginUser,
  logOutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateUserAccount,
  updateAvatarImage,
  updateCoverImage,
  getUserProfileDetails,
  getWatchHistory
};
