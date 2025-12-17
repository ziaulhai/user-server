// user-server/controllers/fundController.js

require('dotenv').config();
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const Fund = require('../models/Fund'); // MongoDB Fund মডেল আমদানি করা হলো

// --- ১. Payment Intent তৈরি করা ---
exports.createPaymentIntent = async (req, res) => {
    try {
        const { price } = req.body;
        // price সেন্টে (cents) থাকতে হবে (1 USD = 100 cents)
        const amount = parseInt(price); 

        if (amount < 100) { 
            return res.status(400).send({ error: "Amount must be at least 1 USD (100 cents)" });
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            payment_method_types: ['card'],
        });

        res.send({
            clientSecret: paymentIntent.client_secret,
        });

    } catch (error) {
        console.error("Stripe Error in createPaymentIntent:", error);
        res.status(500).send({ error: 'Failed to create payment intent.' });
    }
};

// --- ২. ফান্ড রেকর্ড সেভ করা ---
exports.saveFundRecord = async (req, res) => {
    try {
        let fundData = req.body;
        
        // 🔥 যদি ফ্রন্টএন্ড থেকে সেন্টে (cents) ডেটা আসে, তবে ডেটাবেসে ডলারে সেভ করতে এখানে ভাগ করা যেতে পারে
        // fundData.amount = fundData.amount / 100; 

        // নিরাপত্তা যাচাই: রিকোয়েস্ট করা ব্যবহারকারী এবং ডোনারের ইমেল মেলানো
        if (req.user.email !== fundData.donorEmail) {
            return res.status(403).send({ message: "Forbidden access: Email mismatch." });
        }

        const newFund = new Fund(fundData);
        const result = await newFund.save();
        
        res.status(201).send({ 
            message: 'Fund record saved successfully', 
            insertedId: result._id 
        });

    } catch (error) {
        console.error("MongoDB Error in saveFundRecord:", error);
        res.status(500).send({ error: 'Failed to save fund record.' });
    }
};

// --- ৩. সকল ফান্ড ফেচ করা (Admin/Volunteer সুরক্ষিত) ---
exports.getAllFunds = async (req, res) => {
    try {
        // অ্যাডমিন/ভলান্টিয়ারের জন্য সমস্ত ফান্ডিং ডেটা নতুন থেকে পুরনো ক্রমে আনা
        const funds = await Fund.find({}).sort({ fundingDate: -1 }); 

        res.send(funds);
    } catch (error) {
        console.error("MongoDB Error in getAllFunds:", error);
        res.status(500).send({ error: 'Failed to fetch funds.' });
    }
};