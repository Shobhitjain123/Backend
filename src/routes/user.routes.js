import { Router } from 'express'
import { 
    loginUser, 
    registerUser, 
    logOutUser, 
    refreshAccessToken, 
    changeCurrentPassword, 
    getCurrentUser,
    updateUserAccount,
    updateAvatarImage,
    updateCoverImage,
    getUserProfileDetails,
    getWatchHistory
    } from '../contollers/user.controller.js'
import { upload } from "../middlewares/multer.middleware.js"
import { verifyJWT } from '../middlewares/auth.middleware.js'

const router = Router()

router.route('/register').post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser)

router.route('/login').post(loginUser)
//secured routes
router.route('/logout').post(verifyJWT, logOutUser)
router.route('/refresh-token').post(refreshAccessToken)
router.route('/changePassword').post(verifyJWT, changeCurrentPassword)
router.route('/current-user-info').get(verifyJWT, getCurrentUser)
router.route('/updateAccount').patch(verifyJWT, updateUserAccount)
router.route('/updateAvatar').patch(verifyJWT, upload.single("avatar"), updateAvatarImage)
router.route('/updateCovrImage').patch(verifyJWT, upload.single("coverImage"), updateCoverImage)
router.route('/c/:username').get(verifyJWT, getUserProfileDetails)
router.route('/watchHistory').get(verifyJWT, getWatchHistory)
export default router