const {Router}=require("express")
const authMiddleware=require("../middleware/auth.middleware")
const transactionController=require("../controllers/transaction.controller")

const transactionRoutes=Router()

transactionRoutes.post("/",authMiddleware.authMiddleware,transactionController.createTransaction)


/**
 * -post /api/transaction/system/initial-funds
 * -create initial funds transaction from system user
 */

transactionRoutes.post("/system/initial-funds",authMiddleware.authSystemUserMiddleware,transactionController.createInitialFundsTransaction)   

module.exports=transactionRoutes