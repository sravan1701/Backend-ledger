// generally use of app.js is to create server , and config server(middleware , api's)

// loads the Express module and returns a function
const express=require("express")
const cookieParser=require("cookie-parser")

const authRoutes=require("./routes/auth.routes")
const accountRoutes=require("./routes/account.routes")
const transactionRoutes=require("./routes/transaction.routes")

// calling the Express function.
// This creates an Express application object and stores it in app.
const app=express()

//generally express server cannot read req.body data. so we give capabality to read req.body by below line
app.use(express.json())

app.use(cookieParser())

app.use("/api/auth",authRoutes)
app.use("/api/accounts",accountRoutes)
app.use("/api/transactions",transactionRoutes)

module.exports=app