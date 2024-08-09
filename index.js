const express = require("express");
require("dotenv").config();
const app = express();
const cors = require("cors");
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000;



// MIDDLWARE----
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(cookieParser());

// written middlware

// const  verifyAccessToken = (req, res, next)=>{
//   const token = req.cookies.token;

//   if(!token){
//     return res.status(401).send('User unauthorized')
//   }
//   jwt.verify(token, process.env.TOKEN_SECRET, (err, decoded)=>{
//     // console.log(err, decoded);
//     if(err){
//       return res.status(401).send({message: 'Unauthorized'})
//     }
//     req.user = decoded
//     next()
//   })
//   // console.log(token);
 
// }

const verifyTokenFromStorage = (req, res, next) =>{
  const token = req.headers.token;
  // console.log(token);
  
  if(!token){
    return res.status(401).send({message: 'UnAuthorize user'})
  }
  jwt.verify(token, process.env.TOKEN_SECRET, (err, decoded) =>{
    // console.log(err, decoded, 'from verification');
    if(err){
      return res.status(401).send({message: 'Unauthorized'})
    } 
    req.user = decoded;
    // console.log(decoded);
    next()
  } )
}





// dbUser = birstoBoss
// dbPass = OoZcUTCLeZaViija
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ndy3clf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,  
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    //  COLLECTIONS
    const menuCollection = client.db("bossDB").collection("menu");
    const reviewCollection = client.db("bossDB").collection("reviews");
    const userCollection = client.db("bossDB").collection("user");
    const cartCollection = client.db('bossDB').collection('cart')

    const verifyAdmin = async (req, res, next) =>{
      const email = req.user?.email
      const query = {email: email}
      const user = await userCollection.findOne(query)
      const isAdmin = user?.role === 'admin';
      // console.log(isAdmin);
      if(!isAdmin){
        return res.status(403).send({message: 'forbidden access'})
      }
      next()

    }

    // jwt token
    app.post('/jwt', async(req, res) =>{
      const user = req.body;
      // console.log(user);
      const token = jwt.sign(user, process.env.TOKEN_SECRET, {expiresIn: '2h'})
      res.send({'token': token})
    })
    app.get('/jwt', async(req, res)=>{
      res.clearCookie('token').send({message: 'Cookie Clear Successfully'})

    })

    app.post('/menu', async(req, res)=>{
      const item = req.body;
      console.log(item);
      const result = await menuCollection.insertOne(item)
      res.send(result)
    })

    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });
    app.delete('/menu/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id) || id}
      // console.log(query);

      const result = await menuCollection.deleteOne(query)
      res.send(result)
    })

    app.get('/menu/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: id}
      const result = await menuCollection.findOne(query)
      res.send(result)
      // console.log(result);

    })
    app.patch('/menu/:id', async(req, res)=>{
      const id = req.params.id;
      const product = req.body;
      const query = {_id: id || new ObjectId(id)}
      const updatedDoc= {
        $set:{
          name: product.name,
          category: product.category,
          image: product.image,
          price: product.price,
          recipe: product.recipe
        }
      }
      const result = await menuCollection.updateOne(query, updatedDoc)
      res.send(result)

    })

    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    app.post('/carts', async(req, res)=>{
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem)
      res.send(result)
    })
    app.get('/carts', verifyTokenFromStorage,  async(req, res)=>{
      const email = req.query.email;
      const userEmail = req.user?.email
      // console.log(email, userEmail, 'from api');
     
      if(userEmail !== email){
        return res.status(403).send({message: 'Forbidden'})
      }
      const query = {customer: email}
      const result = await cartCollection.find(query).toArray()
      res.send(result)
   
      
    })
    app.delete('/carts/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await cartCollection.deleteOne(query)
      res.send(result)  
    })

    // user apis
    app.get('/users',  async(req, res)=>{
      const result = await userCollection.find().toArray()
      res.send(result)
    })
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = {email: user.email}
      const existingUser = await userCollection.findOne(query)
      if(existingUser){
        return res.send({message: 'User already exist', insertedId: null})
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get('/users/admin/:email', verifyTokenFromStorage, verifyAdmin, async(req, res)=>{
      const email = req.params.email;
      const userEmail = req.user?.email;
      // console.log(userEmail, 'from admin api', email);
     
      if(userEmail !== email){
        return res.status(403).send({message: 'forbidden access'})
      }
      const query = {email: email}
      const user = await userCollection.findOne(query)
      let admin = false
      if(user){
        admin = user?.role === 'admin'
      }
      res.send({admin})  
    })
    app.delete('/users/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await userCollection.deleteOne(query)
      res.send(result)
    })
    app.patch('/users/admin/:id', async(req, res)=>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

    // stripe 
    app.post('/create-payment-intent', async(req, res)=>{
      const {totalPrice} = req.body;
      const amount = parseInt(totalPrice * 100) 
      // console.log(amount);
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        payment_method_types: ['card'],    
        // automatic_payment_methods:{
        //   enabled: true 
        // }
      })
      // console.log(paymentIntent.client_secret);
      res.send({
        clientSecret: paymentIntent.client_secret 
      })    
    })  

    

    // app.get('/users', async(req, res)=>{
    //   const result = await userCollection.find().toArray()
    //   res.send(result)
    // })
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Boss is sitting");
});

app.listen(port, () => {
  console.log(`Boss is sitting on Port ${port}`);
});
