const userModel = require("../models/user.model");
const jwt = require("jsonwebtoken");
const sendemail = require("../services/email.services");
const tokenBlacklistModel=require("../models/blackList.model")



/**
 * -user register controller
 * -post  /api/auth/register
 */
async function userRegisterController(req, res) {
  const { email, password, name } = req.body;

  const isExists = await userModel.findOne({
    email: email,
  });

  if (isExists) {
    return res.status(422).json({
      message: "user already exists with email",
      status: "failed",
    });
  }

  const user = await userModel.create({
    email,
    password,
    name,
  });

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
    expiresIn: "3d",
  });

  res.cookie("token", token);
  res.status(201).json({
    user: {
      _id: user._id,
      email: user.email,
      name: user.name,
    },
    token,
  });

  try {
    await sendemail.sendRegistrationEmail(user.email, user.name);
  } catch (err) {
    console.error("Failed to send registration email:", err);
  }
}

/**
 * -user login controller
 * -post  /api/auth/login
 */
async function userLoginController(req, res) {
  const { email, password } = req.body;

  const user = await userModel.findOne({ email }).select("+password");

  if (!user) {
    return res.status(401).json({
      message: "email not found",
    });
  }

  const isValidPassword = await user.comparePassword(password);

  if (!isValidPassword) {
    return res.status(401).json({
      message: "password is incorrect",
    });
  }

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
    expiresIn: "3d",
  });

  res.cookie("token", token,{httpOnly:true,secure:true,sameSite:"strict"});
  // status code 200 for successful login
  // and 201 for successful registration as per RESTful API conventions
  res.status(200).json({
    user: {
      _id: user._id,
      email: user.email,
      name: user.name,
    },
    token,
  });
}


/**
 * 
 * 
 */

async function userLogoutController(req,res){
  const token=req.cookies.token|| req.headers.authorization?.split(" ")[1]

  if(!token){
    return res.status(200).json({
      message:"user logged out successfully"
    })
  }

  
  await tokenBlacklistModel.create({
    token:token
  })
  res.clearCookie("token")

  res.status(200).json({
    message:"user logged out successfully"
  })
}

module.exports = {
  userRegisterController,
  userLoginController,
  userLogoutController
};
