


// require("dotenv"):It loads the dotenv package.
// .config():Looks for a .env file.
// Reads all variables from it.
// Adds them to process.env.
require("dotenv").config()


// require() returns whatever was assigned to module.exports.
const app=require("./src/app")

const connectToDB=require("./src/config/db.js")
connectToDB()




// listen() tells Express:
// "Start an HTTP server and wait for requests on port 3000."
// This callback runs after the server successfully starts.
app.listen(3000,()=>{
    console.log(`server is running on port 3000`)
})


