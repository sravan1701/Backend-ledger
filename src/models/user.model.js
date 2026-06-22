const mongoose=require("mongoose")
const bcrypt=require("bcryptjs")

const userschema=new mongoose.Schema({
    email:{
        type:String,
        required:[true,"email is required"],
        trim:true,
        lowercase:true,
        match:[/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address'],
        unique:[true,"email already exits"]
    },
    name:{
        type:String,
        required:[true,"name is required for creating the account"],
    },
    password:{
        type:String,
        required:[true,"password is required creating an account"],
        minlength:[6,"password should contain more than 6 characters"],
        select:false 
    },
    systemUser:{
        type:Boolean,
        default:false,
        immutable:true,
        select:false
    }
},{
    timestamps:true
})

// pre("save") means:
// "Before MongoDB saves this document, execute this function first."
userschema.pre("save",async function () {
    if(!this.isModified("password")){
        return 
    }
    const hash=await bcrypt.hash(this.password,10)
    this.password=hash;

    return 
    //next() is used in Mongoose middleware to tell Mongoose:
    // "I'm done with this middleware. You can continue to the next middleware or the actual save operation."
    // Without next()
    // await user.save();
    // Mongoose enters the middleware, but it never gets told that the middleware finished.
    // Result:
    // save operation waits forever
    // because next() was never called.


})


// bcrypt hashes the entered password internally and checks whether it matches.
userschema.methods.comparePassword= async function (password) {
    return await bcrypt.compare(password,this.password)
}

const userModel=mongoose.model("user",userschema)

module.exports=userModel
