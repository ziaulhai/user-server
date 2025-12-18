// user-server/middlewares/verifyAdmin.js -

// এই ফাংশনটি ইউজার কালেকশন (userCollection) গ্রহণ করে মিডলওয়্যার রিটার্ন করবে
const verifyAdmin = (userCollection) => async (req, res, next) => {

    // 🔥 ফিক্স ১: req.decoded চেক করা
    // যদি req.decoded বা req.decoded.email না থাকে, তবে 403 পাঠানো।
    if (!req.decoded || !req.decoded.email) {
        // এই ক্ষেত্রে, JWT যাচাইয়ে ব্যর্থতা ঘটেছে বা টোকেন নেই। 
        // যদিও verifyJWT আগে রান হওয়া উচিত, এই চেকটি ক্র্যাশ হওয়া থেকে রক্ষা করবে।
        return res.status(403).send({ message: 'Forbidden access: User data missing after JWT check.' });
    }

    // 🔥 ফিক্স ২: req.user এর পরিবর্তে req.decoded ব্যবহার
    const email = req.decoded.email; // <--- এখন এটি req.decoded থেকে ইমেইল পড়বে

    try {
        // ২. ডেটাবেস থেকে ইউজারের বর্তমান রোল চেক করা
        const user = await userCollection.findOne(
            { email: email },
            { projection: { role: 1 } } 
        );

        if (!user || user.role !== 'admin') {
            // ইউজার অ্যাডমিন না হলে 403 (Forbidden) রেসপন্স পাঠানো
            return res.status(403).send({ message: 'Forbidden access: Admin required.' });
        }

        // ৩. অ্যাডমিন হলে পরবর্তী ধাপে যাওয়া
        next();

    } catch (error) {
        console.error("Database Error in verifyAdmin:", error);
        res.status(500).send({ message: "Internal Server Error during role check." });
    }
};

module.exports = verifyAdmin;