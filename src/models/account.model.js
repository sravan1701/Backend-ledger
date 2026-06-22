const mongoose=require("mongoose")
const ledgerModel=require("./ledger.model")

const accountSchema=new mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"user",
        required:[true,"Account must be associated with a user"],
        index:true
    },
    accountType: {
        type: String,
        enum: ["SYSTEM", "CUSTOMER"],
        default: "CUSTOMER",
        index: true
    },
    status:{
        type:String,
        enum:{
            values:["Active","Inactive","Closed"],
            message:"Status must be either Active, Inactive, or Closed",
            
        },
        default:"Active"
    },
    currency:{
        type:String,
        required:[true,"Currency is required"],
        default:"INR"
    }
},{
    timestamps:true
})

accountSchema.index({user:1,status:1})

accountSchema.methods.getBalance=async function(){
    const balanceData=await ledgerModel.aggregate([
        {
            $match:{
            account:this._id
        }
    },
        {
            $group:{
                _id:null,
                totalDebit:{
                    $sum:{
                        $cond:[{$eq:["$type","DEBIT"]},"$amount",0]  /** this generally works like the ternary operator  i.e checks the &eq equation if it is true set first value if not second*/
                    }
                },
                totalCredit:{
                    $sum:{
                        $cond:[{$eq:["$type","CREDIT"]},"$amount",0]
                    }
                },
            }
        },
        {
            $project:{
            _id:0,
            balance:{$subtract:["$totalCredit","$totalDebit"]}  
            /** _id: 0
             * Removes the _id field.
             * Without it:
             * {
             * _id: null,
             * balance: 1200
             * }
             * With it:
             * {
             * balance: 1200
             * } */
  
        }
        }
    
    ])

    if(balanceData.length===0){
        return 0;
    }
    return balanceData[0].balance;
}

const accountModel=mongoose.model("account",accountSchema)

module.exports=accountModel
