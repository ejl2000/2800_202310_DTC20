// This code was modified from Emma Lee's COMP 2537 Assignment 2.

// Import required modules
require("./utils.js");
require('dotenv').config();

// Import express
const express = require('express');
// Import express-session                 
const session = require('express-session');
// Import ObjectId from connect-mongo   
const ObjectId = require('mongodb').ObjectId;
// Import connect-mongo       
const MongoStore = require('connect-mongo');
// Import mongodb    
const { MongoClient } = require('mongodb');
// Create an express application       
const app = express();
// Import body-parser middleware package and make it accessible in req.body
const bodyParser = require('body-parser');
// Parse incoming request bodies with URL-encoded payloads
app.use(bodyParser.urlencoded({ extended: false }));
// Import bcrypt                         
const bcrypt = require('bcrypt');
// Set saltRounds to 12              
const saltRounds = 12;
// Import url 
const url = require('url');
// Import JOI 
const Joi = require("joi");
// Set localhost to 4000
const port = process.env.PORT || 4000;

// Set expiration time for session to 1 hour 
const expireTime = 1 * 60 * 60 * 1000;

// Secret Information Section 
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
// End Secret Information Section 

// Our MongoURL
const mongoURL = `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/test`;

console.log(mongodb_password)
console.log(mongodb_user)
const node_session_secret = process.env.NODE_SESSION_SECRET;

var { database } = include('databaseConnection');

// Display message if there is error in connection 
MongoClient.connect(mongoURL, (err, client) => {
    if (err) {
        console.error('Error connecting to MongoDB:', err);
        return;
    }
});

// Set userCollection to mongodb collection 
const userCollection = database.db(mongodb_database).collection('users');

// Set view engine to EJS
app.set('view engine', 'ejs');

// Req.body required to parse (app.post) ex. req.body.username
app.use(express.urlencoded({ extended: false }));

// Set static files to public folder 
app.use(express.static('./public'));

// Initially was session, now /test in mongoURL
var mongoStore = MongoStore.create({
    mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/test`,
    // mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/test`,
    crypto: {
        secret: mongodb_session_secret
    }
})

// Handle cookies. Ex. req.session.cookies (would have to parse cookies otherwise).  
app.use(session({
    secret: node_session_secret,
    store: mongoStore, //default is memory store 
    saveUninitialized: false,
    resave: true
}));

// Session authentication 
function isValidSession(req) {
    if (req.session.authenticated) {
        return true;
    }
    return false;
}

// Session validation
function sessionValidation(req, res, next) {
    // If valid session call next action
    if (isValidSession(req)) {
        next();
    }
    // Otherwise don't render and redirect to login
    else {
        res.redirect("login.ejs");
    }
}

// Login post route
app.post('/login', async (req, res) => {
    var username = req.body.username;
    var password = req.body.password;

    const schema = Joi.string().max(20).required();
    const validationResult = schema.validate(username);
    if (validationResult.error != null) {
        console.log(validationResult.error);
        res.redirect("/login");
        return;
    }

    const result = await userCollection.find({ username: username }).project({ username: 1, password: 1, _id: 1 }).toArray();

    console.log(result);
    console.log("CHECKPOINT");
    if (result.length != 1) {
        res.send("User Not Found" + "<br>" + '<a href="/login">Try again</a>');;
        return;
    }
    else if (await bcrypt.compare(password, result[0].password)) {
        console.log("correct password");
        req.session.authenticated = true;
        req.session.username = username;
        req.session.cookie.maxAge = expireTime;

        res.redirect('/home');
        return;
    }
    else {
        res.send("Incorrect Password" + "<br>" + '<a href="/login">Try again</a>');
        return;
    }
});

app.get('/', (req, res) => {
    console.log(req.url);
    console.log(url.parse(req.url));
    res.render("login");
});

app.get('/login', (req, res) => {
    res.render('login');
});

const filenames = [
    'mmse1.ejs',
    'mmse2.ejs',
    'mmse3.ejs',
    'mmse4.ejs',
    'mmse5.ejs',
    'mmse6.ejs',
    'mmse7.ejs',
    'mmse8.ejs',
];

// Fisher-Yates shuffle implementation
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Shuffle the array of file names
const shuffledFilenames = shuffle(filenames);

// Route for MMSE questions
app.all('/mmse/:index', (req, res) => {
    const index = parseInt(req.params.index);
    console.log(index);
    const filename = shuffledFilenames[index];
    console.log(filename);

    if (index < 0 || index >= shuffledFilenames.length) {
        res.status(404).send('Page not found');
    } else {
        if (req.method === 'GET') {
            // Render the MMSE page for the specified index
            res.render(filename.split('.')[0], { index: index });
        } else if (req.method === 'POST') {
            // Handle form data stuff
            console.log(req.body);

            // Increment index and store it in the session
            req.session.index = (req.session.index || index) + 1;

            if (req.session.index < shuffledFilenames.length) {
                // Redirect to a random MMSE page
                const randomIndex = Math.floor(Math.random() * shuffledFilenames.length);
                res.redirect('/mmse/' + randomIndex);
            } else {
                req.session.index = 0;
                res.redirect('/score');
            }
        }
    }
});

// Post route for recommendation based on totalScore
// Score reference points calculated from Kaggle: data_demented.js and data_nondemented.js. 
// Screening (mmse9.ejs and mmse10.ejs) scores obtained from data_demented.js, data_nondemented.js, and 
app.post('/recommendation', (req, res) => {
    const totalScore = req.session.totalScore; //total score from session 

    let recommendation;
    if (totalScore <= 17) {
        recommendation = "are at risk";
    } else if (totalScore === 18) {
        recommendation = "may be at risk";
    } else {
        recommendation = "are not at risk";
    }
    console.log(recommendation)
    req.session.recommendation = recommendation;
    res.render('recommendation', { recommendation: recommendation });
});

// Post route for /signup using JOI validation 
app.post('/signup', async (req, res) => {
    const { username, email, password, number } = req.body;
    console.log(username);
    console.log(email);

    // validate the input style for username, email and password using Joi
    const schema = Joi.object({
        username: Joi.string().alphanum().max(20).required(),
        email: Joi.string().max(254).required(),
        password: Joi.string().alphanum().max(20).required(),
        number: Joi.number().integer().max(999999999999999).required(),
    });

    // validate the input
    const validationResult = schema.validate({ username, email, password, number });
    if (validationResult.error != null) {
        console.log(validationResult.error);
        // Render the sign-up form with error messages
        return res.render('signup', { error: validationResult.error.details[0].message });
    }

    try {
        // Password encryption
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        //console.log(hashedPassword);

        // Insert user into the database
        const result = await userCollection.insertOne({
            username: username,
            email: email,
            password: hashedPassword,
            number: number,
        });

        const x = await userCollection.findOne({ "username": username })
        console.log(x);
        const y = await userCollection.findOne({ "email": email })
        console.log(y);

        res.redirect('/login');

    } catch (error) {
        console.error(error);
        // Handle the error appropriately, e.g., render an error page or redirect to a specific route
        res.redirect('/login');
    }
});

// Post route for updating password in mongodb 
app.post('/updatepassword', async (req, res) => {
    console.log("Need this to show up or this route is not being hit.");
    try {
        const userCollection = database.db(mongodb_database).collection('users'); // Use the correct database connection
        console.log("Collection:", userCollection);

        const filter = { username: req.body.username };
        console.log("Filter:", filter);

        const user = await userCollection.findOne(filter);
        console.log("User:", user);

        if (!user) {
            console.log('No user found.');
            return res.status(404).json({ message: 'User not found' });
        }

        const hashedPassword = await bcrypt.hash(req.body.password, saltRounds); // Use async bcrypt function
        const update = {
            $set: { password: hashedPassword },
        };
        console.log("Update:", update);

        console.log("Updating document...");
        const result = await userCollection.updateOne(filter, update);
        console.log("Update Result:", result);

        if (result.modifiedCount === 1) {
            console.log('Successfully updated password.');
            res.render("home.ejs");
            //res.status(200).json({ message: 'Password updated successfully' });
        } else {
            console.log('No document matched the filter.');
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Error updating password in MongoDB:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Post route for updating number in mongodb
app.post('/updatenumber', async (req, res) => {
    console.log("Need this to show up or this route is not being hit.");
    try {
        const userCollection = await database.db(mongodb_database).collection('users'); // Use the correct database connection
        console.log("Collection:", userCollection);

        const filter = { username: req.body.username };
        console.log("Filter:", filter);

        const user = await userCollection.findOne(filter);
        console.log("User:", user);

        if (!user) {
            console.log('No user found.');
            return res.status(404).json({ message: 'User not found' });
        }
        const newNumber = req.body.number;
        const update = {
            $set: { number: req.body.number },
        };
        console.log("Update:", update);

        console.log("Updating document...");
        const result = await userCollection.updateOne(filter, update);
        console.log("Update Result:", result);

        if (result.modifiedCount === 1) {
            console.log('Successfully updated number.');
            res.render("home.ejs");

        } else {
            console.log('No document matched the filter.');
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Error updating number in MongoDB:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});


app.get('/fetchProfile', sessionValidation, async (req, res) => {
    try {
        const user = await userCollection.findOne({ username: req.session.username }, { projection: { name: 1, username: 1, email: 1, number: 1 } });
        res.json({ user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/profile', sessionValidation, async (req, res) => {
    try {
        const user = await userCollection.findOne({ username: req.session.username }, { projection: { username: 1, email: 1, number: 1 } });
        res.render('profile', { user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error...!' });
    }
});

app.get('/password', async (req, res) => {
    try {
        const user = await userCollection.findOne({ username: req.session.username }, { projection: { username: 1, email: 1, number: 1 } });
        res.render('password', { user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error...!' });
    }
});

app.get('/email', (req, res) => {
    res.render('email');
});

app.get('/mmse1', (req, res) => {
    res.render('mmse1');
});

app.get('/mmse2', (req, res) => {
    res.render('mmse2');
});

app.get('/mmse3', (req, res) => {
    res.render('mmse3');
});

app.get('/mmse4', (req, res) => {
    res.render('mmse4');
});

app.get('/mmse5', (req, res) => {
    res.render('mmse5');
});

app.get('/mmse6', (req, res) => {
    res.render('mmse6');
});

app.get('/mmse7', (req, res) => {
    res.render('mmse7');
});

app.get('/mmse8', (req, res) => {
    res.render('mmse8');
});

app.get('/score', (req, res) => {
    res.render('score');
});

app.get('/revise', (req, res) => {
    res.render('revise');
});

app.get('/signup', (req, res) => {
    res.render('signup');
});

app.get('/thankyou', (req, res) => {
    res.render('thankyou');
});

app.get('/password', (req, res) => {
    res.render('password', { user });
});

app.get('/home', (req, res) => {
    res.render('home');
});

app.get('/profile', (req, res) => {
    res.render('profile');
});

app.get('/questions', (req, res) => {
    res.render('questions');
});

app.get('/number', (req, res) => {
    const user = userCollection.findOne({ username: req.session.username }, { projection: { username: 1, email: 1, number: 1 } });
    res.render('number', { user });
});

app.get('/recommendation', (req, res) => {
    const recommendation = req.session.recommendation;
    res.render('recommendation', { recommendation: recommendation });
});

app.get('/logout', (req, res) => {
    res.render('logout');
});

app.get('/logoutuser', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/submitthanks', (req, res) => {
    req.session.destroy();
    res.redirect('/submitthanks');
});

app.get("*", (req, res) => {
    res.status(404).render("404.ejs");
});

app.listen(port, () => {
    console.log("Node application listening on port " + port);
});