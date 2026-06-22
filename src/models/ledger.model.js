const mongoose=require("mongoose")

const ledgerSchema=new mongoose.Schema({

    account:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"account",
        required:[true,"Ledger entry must be associated with an account"],
        index:true,
        immutable:true
    },
    amount:{
        type:Number,
        required:[true,"Amount is required for creating a ledger entry"],
        min:[0.01,"Ledger entry amount cannot be negative"],
        immutable:true
    },
    transaction:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"transaction",
        required:[true,"Transaction is required for creating a ledger entry"],
        index:true,
        immutable:true
    },
    type:{
        type:String,
        enum:{
            values:["DEBIT","CREDIT"],
            message:"Type can be either DEBIT or CREDIT"
        },
        required:[true,"Type is required for creating a ledger entry"],
        immutable:true
    }
})

function preventLedgerModification() {
    throw new Error("Ledger entries cannot be modified once created")
}

ledgerSchema.pre("findOneAndUpdate", preventLedgerModification)
ledgerSchema.pre("updateOne", preventLedgerModification)
ledgerSchema.pre("updateMany", preventLedgerModification)
ledgerSchema.pre("update", preventLedgerModification)
ledgerSchema.pre("deleteOne", preventLedgerModification)
ledgerSchema.pre("deleteMany", preventLedgerModification)
ledgerSchema.pre("findOneAndDelete", preventLedgerModification)
ledgerSchema.pre("findOneAndRemove", preventLedgerModification)
ledgerSchema.pre("remove", preventLedgerModification)

const ledgerModel=mongoose.model("ledger",ledgerSchema)

module.exports=ledgerModel