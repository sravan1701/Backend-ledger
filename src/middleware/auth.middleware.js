const userModel = require("../models/user.model");
const jwt = require("jsonwebtoken");
const tokenBlacklistModel=require("../models/blackList.model")

async function authMiddleware(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Unauthorized acces, token is missing",
    });
  }

  const isblacklisted=await tokenBlacklistModel.findOne({token})

  if(isblacklisted){
    return res.status(401).json({
      message:"Unautharized access,token is invalid"
    })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userModel.findById(decoded.userId);

    if (!user) {
      return res
        .status(401)
        .json({ message: "Unauthorized access, user no longer exists" });
    }

    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({
      message: "Unauthorized acces, token is invalid",
    });
  }
}

async function authSystemUserMiddleware(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Unauthorized acces, token is missing",
    });
  }

  const isblacklisted=await tokenBlacklistModel.findOne({token})

  if(isblacklisted){
    return res.status(401).json({
      message:"Unautharized access,token is invalid"
    })
  }


  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userModel.findById(decoded.userId).select("+systemUser");
    if (!user) {
      return res
        .status(401)
        .json({ message: "Unauthorized access, user no longer exists" });
    }
    if (!user.systemUser) {
      return res.status(403).json({
        message: "Forbidden access, user is not a system user",
      });
    }
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({
      message: "Unauthorized acces, token is invalid",
    });
  }
}

module.exports = {
  authMiddleware,
  authSystemUserMiddleware,
};
