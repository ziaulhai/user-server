const express = require('express');
const app = express();
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const port = process.env.PORT || 5000;

// ১. মিডলওয়্যার কনফিগারেশন
app.use(cors({
    origin: ['http://localhost:5173', 
        'https://blood-donation-gray-kappa.vercel.app',
    'https://manageblooddonation.netlify.app'
    ],
    credentials: true
}));
app.use(express.json());

// MongoDB Connection
const client = new MongoClient(process.env.MONGODB_URI, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

// JWT Verification Middleware
const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).send({ message: 'Unauthorized access' });
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).send({ message: 'Forbidden access' });
        req.decoded = decoded;
        next();
    });
};

async function run() {
    try {
        const db = client.db("blood_donation_db");
        const userCollection = db.collection("users");
        const donationRequestsCollection = db.collection("donationRequests");
        const blogCollection = db.collection("blogs");
        const fundsCollection = db.collection("funds");

        // ২. রাউট ইমপোর্ট (Path Updated to Root Level)
        const authRoutes = require('./routes/auth');
        const userRoutes = require('./routes/users');
        const donationRoutes = require('./routes/donationRequests');
        const blogRoutes = require('./routes/blogPosts');
        const publicRoutes = require('./routes/publicRoutes');
        const statsRoutes = require('./routes/stats');
        const paymentRoutes = require('./routes/payment');

        const apiV1Router = express.Router();

      // 🔥 ইমেইল চেক করার রুট (রেজিস্ট্রেশনের সময় তৎক্ষণাৎ চেক করার জন্য)
        apiV1Router.get('/users/check-email/:email', async (req, res) => {
            try {
                const email = req.params.email.toLowerCase();
                const user = await userCollection.findOne({ email: email });
                if (user) {
                    return res.send({ exists: true });
                }
                res.send({ exists: false });
            } catch (error) {
                res.status(500).send({ message: "Internal Server Error" });
            }
        });


        // ৩. রাউট মাউন্টিং
        apiV1Router.use('/auth', authRoutes(userCollection));
        apiV1Router.use('/users', userRoutes(userCollection)); 
        apiV1Router.use('/donation-requests', donationRoutes(donationRequestsCollection, userCollection));
        apiV1Router.use('/content/blog-posts', blogRoutes(blogCollection));
        apiV1Router.use('/public', publicRoutes(userCollection, donationRequestsCollection, blogCollection));
        apiV1Router.use('/stats', statsRoutes(userCollection, donationRequestsCollection));
        
        // পেমেন্ট রাউট
        apiV1Router.use('/payment', paymentRoutes(fundsCollection, verifyJWT));

        // এপিআই বেস পাথ সেটআপ
        app.use('/api/v1', apiV1Router);

        // JWT ইস্যু রুট (Separate path for login)
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '7d' });
            res.send({ token });
        });

        console.log("✅ Database Connected & Routes Loaded from Root!");
    } catch (error) {
        console.error("❌ Critical Server Error:", error);
    }
}
run().catch(console.dir);

// ৪. বেস রুট এবং হেলথ চেক
app.get('/', (req, res) => res.send('Blood Donation Server is Running'));

// ৫. গ্লোবাল 404 হ্যান্ডলার (সব রাউটের নিচে রাখতে হবে)
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
});

module.exports = app;

if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => console.log(`🚀 Server running on http://localhost:${port}`));
}