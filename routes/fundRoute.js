// user-server/routes/fundRoute.js

const express = require('express');
const { createPaymentIntent, saveFundRecord, getAllFunds } = require('../controllers/fundController'); 
const { verifyToken } = require('../middlewares/verifyToken'); 
const { verifyAdminOrVolunteer } = require('../middlewares/verifyAdminOrVolunteer'); // ⭐ এটি Admin/Volunteer রোল যাচাই করে

const router = express.Router();

// ১. পেমেন্ট ইন্টেন্ট তৈরি
router.post('/create-payment-intent', createPaymentIntent);

// ২. সফল পেমেন্টের পর রেকর্ড সেভ করা
router.post('/save', verifyToken, saveFundRecord);

// ৩. সকল ফান্ড ফেচ করা (404 ফিক্স)
// ক্লায়েন্ট রিকোয়েস্ট: /api/v1/funding/all 
router.get(
    '/all', // ⭐ শুধুমাত্র '/all' কারণ মূল সার্ভারে '/api/v1/funding' বেস পাথ হিসেবে সেট করা হয়েছে
    verifyToken,
    verifyAdminOrVolunteer, // ডেটা সুরক্ষার জন্য রোল চেক
    getAllFunds
);

module.exports = router;