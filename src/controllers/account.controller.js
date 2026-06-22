const accountModel=require("../models/account.model")


async function createAccountController(req,res) {
    const user=req.user

    const account=await accountModel.create({
        user:user._id
    })

    res.status(201).json({
        account
    })
}


async function getAccountController(req,res) {
    try{
        const user=req.user
    const accounts=await accountModel.find({ user: user._id })

    res.status(200).json({
        accounts
    })
    }
    catch(err){
        res.status(500).json({message:"Error fetching accounts", error: err.message})
    }
}

async function getAccountBalanceController(req,res) {
    try{
        const {accountId}=req.params

    const account=await accountModel.findOne({
        _id:accountId,
        user:req.user._id
    })
    if(!account){
        return res.status(404).json({
            message:"Account not found"
        })
    }

    const balance =await account.getBalance();


    res.status(200).json({
        accountId:account._id,
        balance:balance
    })
    }
    catch(err){
        res.status(500).json({message:"error fetching balance",error:err.message})
    }
}

module.exports={
    createAccountController,
    getAccountController,
    getAccountBalanceController
}