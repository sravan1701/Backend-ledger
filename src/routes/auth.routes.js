

const express=require("express")


const authController=require("../controllers/auth.controller")

const router=express.Router()

router.get("/test", (req, res) => {
    res.send("Auth route working");
});


router.post("/register",authController.userRegisterController)

router.post("/login", authController.userLoginController)


router.post("/logout",authController.userLogoutController)

module.exports=router 