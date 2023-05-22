require('dotenv').config('.env');
const jwt = require("jsonwebtoken");
const cors = require("cors");
const express = require("express");
const app = express();
const morgan = require("morgan");
const { PORT = 3000 } = process.env;
// TODO - require express-openid-connect and destructure auth from it
const { auth } = require("express-openid-connect");
const { User, Cupcake } = require("./db");

// middleware
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* *********** YOUR CODE HERE *********** */
// follow the module instructions: destructure config environment variables from process.env
// follow the docs:
// define the config object
// attach Auth0 OIDC auth router
// create a GET / route handler that sends back Logged in or Logged out
const {
  AUTH0_SECRET = "openssl rand - base64 32", // generate one by using: `openssl rand -base64 32`
  AUTH0_AUDIENCE = "http://localhost:3000",
  AUTH0_CLIENT_ID,
  AUTH0_BASE_URL,
} = process.env;

const config = {
  authRequired: false, // this is different from the documentation
  auth0Logout: true,
  secret: AUTH0_SECRET,
  baseURL: AUTH0_AUDIENCE,
  clientID: AUTH0_CLIENT_ID,
  issuerBaseURL: "https://dev-3lxwz8nylh7eiqbf.uk.auth0.com",
};

// auth router attaches /login, /logout, and /callback routes to the baseURL
app.use(auth(config));

app.use(async (req, res, next) => {
  const [user] = await User.findOrCreate({
    where: {
      name: req.oidc.user.name,
      email: req.oidc.user.email,
    },
  });
  console.log(user);
  next();
});

// req.isAuthenticated is provided from the auth router
app.get("/", (req, res) => {
  console.log(req.oidc.user);
  const html = `
  <h1>Welcome, ${req.oidc.user.given_name}!</h1>
  <h2>Your Profile:</h2>
  <p>Name: ${req.oidc.user.name}</p>
  <p>Email: ${req.oidc.user.email}</p>
  <p>Profile Picture:</p>
  <img src="${req.oidc.user.picture}" alt="Profile Picture">
`;

  res.send(html);
});

app.use((req, res, next) => {
  const authHeader = req.header("Authorization");
  if (authHeader) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch (error) {
      console.error(error);
      res.status(401).send({ error: "Invalid token" });
      return;
    }
  }
  next();
});

app.post("/cupcakes", async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401).send({ error: "Unauthorized" });
      return;
    }

    const { title, flavor, stars } = req.body;
    const createdCupcake = await Cupcake.create({
      title,
      flavor,
      stars,
      userId: req.user.id,
    });

    res.send(createdCupcake);
  } catch (error) {
    console.error(error);
    next(error);
  }
});

app.get("/me", async (req, res, next) => {
  try {
    const user = await User.findOne({
      where: { name: req.oidc.user.name },
      raw: true,
    });

    if (user) {
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "1w" });
      res.send({ user, token });
    } else {
      res.status(404).send({ error: "User not found" });
    }
  } catch (error) {
    console.error(error);
    next(error);
  }
});

// error handling middleware
app.use((error, req, res, next) => {
  console.error('SERVER ERROR: ', error);
  if(res.statusCode < 400) res.status(500);
  res.send({error: error.message, name: error.name, message: error.message});
});

app.listen(PORT, () => {
  console.log(`Cupcakes are ready at http://localhost:${PORT}`);
});

