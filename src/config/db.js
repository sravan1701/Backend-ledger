const mongoose=require("mongoose")

function connectToDB(){

    // Suppose your .env file contains:
    // MONGO_URI=mongodb://localhost:27017/mydb
    // Then:
    // process.env.MONGO_URI
    // becomes:
    // "mongodb://localhost:27017/mydb"
    mongoose.connect(process.env.MONGO_URI)


    
    // mongoose.connect() is asynchronous.
    // It returns a Promise.
    .then(()=>{
        console.log("server is connected to DB")
    })
    .catch(err=>{
        console.log(err)

        // process.exit() 
        // immediately terminates the Node.js process.
        // 0 → success
        // 1 → error/failure
        //if it is not terminates it uses the server resources unnessarly without database and also can even do any task
        process.exit(1)
    })
   
}

module.exports=connectToDB