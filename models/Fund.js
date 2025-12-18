// user-server/models/Fund.js

const mongoose = require('mongoose');

const FundSchema = new mongoose.Schema({
    donorName: {
        type: String,
        required: true,
    },
    donorEmail: {
        type: String,
        required: true,
    },
    amount: {
        // ডলার বা অন্য মুদ্রায় সেভ করা হবে (যদি কন্ট্রোলারে /100 দিয়ে ভাগ করা হয়)
        type: Number, 
        required: true,
    },
    transactionId: {
        type: String,
        required: true,
        unique: true,
    },
    fundingDate: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true // এই স্কিমাতে ডেটা কখন তৈরি এবং আপডেট হয়েছে তা ট্র্যাক করবে
});

// কালেকশনের নাম 'funds' হবে, কারণ আপনি সেটিই উল্লেখ করেছেন

const Fund = mongoose.model('Fund', FundSchema); 
module.exports = Fund;