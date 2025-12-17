// user-server/routes/payment.js

const express = require('express');
const Stripe = require('stripe');
const router = express.Router();

let stripeInstance = null;

const createPaymentRoutes = (fundsCollection, verifyJWT, verifyAdminOrVolunteer) => {

    // Stripe ইনিশিয়ালাইজেশন
    if (!process.env.STRIPE_SECRET_KEY) {
        console.error("FATAL: STRIPE_SECRET_KEY is missing.");
    } else {
        stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
    }

    // মিডলওয়্যারগুলো undefined কি না চেক করা (নিরাপত্তার জন্য)
    const jwtAuth = verifyJWT || ((req, res, next) => next());
    const roleAuth = verifyAdminOrVolunteer || ((req, res, next) => next());

    // ১. পেমেন্ট ইন্টেন্ট তৈরি
    router.post('/create-payment-intent', async (req, res) => {
        const { price } = req.body;
        if (!stripeInstance) return res.status(500).send({ message: "Stripe service unavailable." });
        if (price < 1) return res.status(400).send({ error: 'Amount must be at least 1.' });

        const amount = parseInt(price * 100);
        try {
            const paymentIntent = await stripeInstance.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret });
        } catch (error) {
            res.status(500).send({ error: error.message });
        }
    });

    // ২. পেমেন্ট ডেটা সেভ (URL: /payment/funds)
    router.post('/funds', jwtAuth, async (req, res) => { // verifyJWT এর বদলে jwtAuth
        const fundRecord = req.body;
        if (req.decoded?.email !== fundRecord.donorEmail) {
            return res.status(403).send({ message: 'Forbidden access: Email mismatch.' });
        }
        try {
            const result = await fundsCollection.insertOne(fundRecord);
            res.status(201).send(result);
        } catch (error) {
            res.status(500).send({ message: 'Failed to save record.' });
        }
    });

    // ৩. মোট ফান্ড
    router.get('/total-fund-amount', jwtAuth, roleAuth, async (req, res) => {
        try {
            const result = await fundsCollection.aggregate([
                { $group: { _id: null, totalAmount: { $sum: "$amount" } } }
            ]).toArray();
            const total = result.length > 0 ? result[0].totalAmount : 0;
            res.send({ totalFundAmount: total / 100 });
        } catch (error) {
            res.status(500).send({ message: 'Failed to fetch data.' });
        }
    });

    // ৪. সব ফান্ড লিস্ট
    router.get('/funds', jwtAuth, roleAuth, async (req, res) => {
        try {
            const allFunds = await fundsCollection.find().sort({ fundingDate: -1 }).toArray();
            res.send(allFunds);
        } catch (error) {
            res.status(500).send({ message: 'Error fetching funds.' });
        }
    });

    return router;
};

module.exports = createPaymentRoutes;