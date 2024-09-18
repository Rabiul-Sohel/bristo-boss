const express = require("express");
require("dotenv").config();
const app = express();
const cors = require("cors");
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken')
const SSLCommerzPayment = require('sslcommerz-lts')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000;




// MIDDLWARE----
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:5173', 'https://bistro-boss-97bb5.web.app', 'https://bistro-boss-97bb5.firebaseapp.com'],
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

const verifyTokenFromStorage = (req, res, next) => {
  const token = req.headers.token;
  // console.log(token);

  if (!token) {
    return res.status(401).send({ message: 'UnAuthorize user' })
  }
  jwt.verify(token, process.env.TOKEN_SECRET, (err, decoded) => {
    // console.log(err, decoded, 'from verification');
    if (err) {
      return res.status(401).send({ message: 'Unauthorized' })
    }
    req.user = decoded;
    // console.log(decoded);
    next()
  })
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
    // await client.connect();

    //  COLLECTIONS
    const menuCollection = client.db("bossDB").collection("menu");
    const reviewCollection = client.db("bossDB").collection("reviews");
    const userCollection = client.db("bossDB").collection("user");
    const cartCollection = client.db('bossDB').collection('cart')
    const paymentCollection = client.db('bossDB').collection('payments')

    const verifyAdmin = async (req, res, next) => {
      const email = req.user?.email
      const query = { email: email }
      const user = await userCollection.findOne(query)
      const isAdmin = user?.role === 'admin';
      // console.log(isAdmin);
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next()

    }
    app.post('/payment-initiate', async (req, res) => {
      const payment = req.body
      const store_id = process.env.SSL_STORE_ID
      const store_pass = process.env.SSL_STORE_PASS
      const is_live = false 
      const trans_id = new ObjectId().toHexString()
      const data = {
        total_amount: payment.price,
        currency: 'USD',
        tran_id: trans_id, // use unique tran_id for each api call
        success_url: `https://bristo-boss-server-ten.vercel.app/payment/success/${trans_id}`,
        fail_url: `https://bristo-boss-server-ten.vercel.app/payment/failed/${trans_id}`,
        cancel_url: `https://bristo-boss-server-ten.vercel.app/payment/cancel/${trans_id}`,
        ipn_url: 'http://localhost:3030/ipn',
        shipping_method: 'Courier',
        product_name: 'Computer.',
        product_category: 'Electronic',
        product_profile: 'general',
        cus_name: 'Customer Name',
        cus_email: 'customer@example.com',
        cus_add1: 'Dhaka',
        cus_add2: 'Dhaka',
        cus_city: 'Dhaka',
        cus_state: 'Dhaka',
        cus_postcode: '1000',
        cus_country: 'Bangladesh',
        cus_phone: '01711111111',
        cus_fax: '01711111111',
        ship_name: 'Customer Name',
        ship_add1: 'Dhaka',
        ship_add2: 'Dhaka',
        ship_city: 'Dhaka',
        ship_state: 'Dhaka',
        ship_postcode: 1000,
        ship_country: 'Bangladesh',
      };
      const sslcz = new SSLCommerzPayment(store_id, store_pass, is_live)
      sslcz.init(data)
        .then(apiResponse => {
          // console.log(apiResponse.GatewayPageURL);
          const pageUrl = apiResponse.GatewayPageURL
          res.send({url: pageUrl})
          payment.transactionId = trans_id
          const result =  paymentCollection.insertOne(payment)
          // console.log(result);
        })
    })

    app.post('/payment/success/:trans_id', async(req, res)=>{
      const trans_id = req.params.trans_id
      // const payment= req.body
      const query = {transactionId: trans_id}
      const payment = await paymentCollection.findOne(query)
      const paymentIds = payment.ids 
      const updatedDoc = {
        $set:{
          status: 'Success'
        }
      }
      // console.log(payment, 'from success');
      const insertedResult = await paymentCollection.updateOne(query, updatedDoc)
      if(insertedResult.modifiedCount > 0){
        const query = {
          _id : {
            $in: paymentIds.map(id => ObjectId.createFromHexString(id))
          }
        }
        const deletedResult = await cartCollection.deleteMany(query)
        if(deletedResult.deletedCount > 0){
          res.redirect('http://localhost:5173/dashboard/paymentSuccess')
        }
        
      }
      
    })
    app.post('/payment/failed/:trans_id', async(req, res)=>{
      const trans_id = req.params.trans_id
      const query = {transactionId : trans_id}
      const result = await paymentCollection.deleteOne(query)
      if(result.deletedCount > 0){
        res.redirect('http://localhost:5173/dashboard/paymentFailed')
      }
      console.log(result);

    })
    app.post('/payment/cancel/:trans_id', async(req, res)=>{
      const trans_id = req.params.trans_id
      const query = {transactionId : trans_id}
      const result = await paymentCollection.deleteOne(query)
      if(result.deletedCount > 0){
        res.redirect('http://localhost:5173/dashboard/cart')
      }
      console.log(result);

    })

    // jwt token
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      // console.log(user);
      const token = jwt.sign(user, process.env.TOKEN_SECRET, { expiresIn: '2h' })
      res.send({ 'token': token })
    })
    app.get('/jwt', async (req, res) => {
      res.clearCookie('token').send({ message: 'Cookie Clear Successfully' })

    })

    app.post('/menu', async (req, res) => {
      const item = req.body;
      console.log(item);
      const result = await menuCollection.insertOne(item)
      res.send(result)
    })

    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });
    app.delete('/menu/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) || id }
      // console.log(query);

      const result = await menuCollection.deleteOne(query)
      res.send(result)
    })

    app.get('/menu/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: id }
      const result = await menuCollection.findOne(query)
      res.send(result)
      // console.log(result);

    })
    app.patch('/menu/:id', async (req, res) => {
      const id = req.params.id;
      const product = req.body;
      const query = { _id: id || new ObjectId(id) }
      const updatedDoc = {
        $set: {
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

    app.post('/carts', async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem)
      res.send(result)
    })
    app.get('/carts', async (req, res) => {
      const email = req.query.email;
      const userEmail = req.user?.email
      // console.log(email, userEmail, 'from api');

      // if(userEmail !== email){
      //   return res.status(403).send({message: 'Forbidden'})
      // }
      const query = { customer: email }
      const result = await cartCollection.find(query).toArray()
      res.send(result)


    })
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.deleteOne(query)
      res.send(result)
    })

    // user apis
    app.get('/users', async (req, res) => {
      const result = await userCollection.find().toArray()
      res.send(result)
    })
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: 'User already exist', insertedId: null })
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get('/users/admin/:email', async (req, res) => {
      const email = req.params.email;
      const userEmail = req.user?.email;
      // console.log(userEmail, 'from admin api', email);

      // if(userEmail !== email){
      //   return res.status(403).send({message: 'forbidden access'})
      // }
      const query = { email: email }
      const user = await userCollection.findOne(query)
      let admin = false
      if (user) {
        admin = user?.role === 'admin'
      }
      res.send({ admin })
    })
    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query)
      res.send(result)
    })
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })



    app.post('/create-payment-intent', async (req, res) => {
      const { amount } = req.body;
      // const amount = parseInt(totalPrice*100)
      const newAmount = parseInt(amount * 100)
      // console.log(newAmount);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: newAmount,
        currency: 'usd',
        payment_method_types: ['card']

      })
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })


    app.post('/payment-intent', async (req, res) => {
      const { amount } = req.body
      const newAmount = amount * 100
      const paymentIntent = await stripe.paymentIntents.create({
        amount: newAmount,
        currency: 'usd',
        payment_method_types: ['card']
      })
      res.send({ clientSecret: paymentIntent.client_secret })
    })

    app.get('/payments/:email', async (req, res) => {
      const query = { email: req.params.email }
      const result = await paymentCollection.find(query).toArray()
      res.send(result)
    })

    app.post('/payments', async (req, res) => {
      const payment = req.body
      const insertedResult = await paymentCollection.insertOne(payment)
      const query = {
        _id: {
          $in: payment.ids.map(id => ObjectId.createFromHexString(id))
        }
      }
      if (insertedResult.insertedId) {
        const deletedResult = await cartCollection.deleteMany(query)
        res.send({
          insertedResult,
          deletedResult
        })
      }

    })

    // app.post('/payments', async (req, res) => {
    //   const payment = req.body;
    //   // console.log(payment);
    //   const paymentResult = await paymentCollection.insertOne(payment)
    //   const query = {
    //     _id: {
    //       $in: payment.cartIds.map(id => ObjectId.createFromHexString(id))
    //     }
    //   }
    //   const deletedResult = await cartCollection.deleteMany(query)
    //   // console.log(query);
    //   res.send({
    //     paymentResult,
    //     deletedResult
    //   })
    // })
    // app.get('/admin-stats', async (req, res) => {
    //   const users = await userCollection.estimatedDocumentCount()
    //   const menuItems = await menuCollection.estimatedDocumentCount()
    //   const orders = await paymentCollection.estimatedDocumentCount()
    //   // this is not the best way
    //   // const payments = await paymentCollection.find().toArray()
    //   // const revenue = payments.reduce((total, payment)=>total + payment.price,0)

    //   const result = await paymentCollection.aggregate([
    //     {
    //       $group: {
    //         _id: null,
    //         totalPrice: { $sum: '$price' }
    //       }
    //     }
    //   ]).toArray()
    //   const totalPrice = (result.length > 0 ? result[0].totalPrice : 0).toFixed(2)
    //   res.send({
    //     users,
    //     menuItems,
    //     orders,
    //     totalPrice
    //   })
    // })

    app.get('/admin-stats', async (req, res) => {
      const users = await userCollection.estimatedDocumentCount()
      const menuItems = await menuCollection.estimatedDocumentCount()
      const orders = await paymentCollection.estimatedDocumentCount()

      // const payments = await paymentCollection.find().toArray()
      // const revenue =  payments.reduce((sum, item)=> sum + item.price, 0)
      const result = await paymentCollection.aggregate([
        {
          $group: {
            _id: null,
            totalPrice: { $sum: '$price' }
          }
        }
      ]).toArray()
      const totalPrice = result.length > 0 ? result[0].totalPrice : 0

      console.log(totalPrice);
      res.send({
        users,
        menuItems,
        orders,
        totalPrice
      })
    })

    // app.get('/order-stats', async (req, res) => {
    //   const result = await paymentCollection.aggregate([
    //     {
    //       $unwind: '$menuIds'
    //     },
    //     {
    //       $lookup: {
    //         from: 'menu',
    //         localField: 'menuIds',
    //         foreignField: '_id',
    //         as: 'menuItems'
    //       }
    //     },
    //     {
    //       $unwind: '$menuItems'
    //     },
    //     {
    //       $group: {
    //         _id: '$menuItems.category',
    //         totalQuantity: { $sum: 1 },
    //         totalRevenue: { $sum: '$menuItems.price' }
    //       }
    //     },
    //     {
    //       $project: {
    //         _id: 0,
    //         category: '$_id',
    //         quantity: '$totalQuantity',
    //         revenue: '$totalRevenue'
    //       }
    //     }
    //   ]).toArray()
    //   res.send(result)
    // })
    app.get('/order-stats', async (req, res) => {
      const result = await paymentCollection.aggregate([
        {
          $unwind: '$menuIds'
        },
        {
          $lookup: {
            from: 'menu',
            localField: 'menuIds',
            foreignField: '_id',
            as: 'menuItems'
          }
        },
        {
          $unwind: '$menuItems'
        },
        {
          $group: {
            _id: '$menuItems.category',
            totalPrice: { $sum: '$price' },
            totalQuantity: { $sum: 1 }
          }

        },
        {
          $project: {
            _id: 0,
            category: '$_id',
            quantity: '$totalQuantity',
            revenue: '$totalPrice'
          }
        }
      ]).toArray()
      res.send(result)
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
