const { Pool } = require('pg')
require('dotenv').config()
const configParams = {
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDB,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
  // maximum number of clients the pool should contain,default:10
  max: 20,
  // number of milliseconds to wait before timing out when connecting a new client
  // default : 0
  idleTimeoutMillis: 30000,
  // number of milliseconds a client must sit idle in the pool and not be checked out before it is disconnected from the backend and discarded
  // default is 10000 (10 seconds)
  connectionTimeoutMillis: 20000
}

// create pg connection
// async function pgConnect() {
//   const pool = new Pool(configParams)
//   try {
//     const now = await pool.query('SELECT NOW()')
//     await pool.end()
//     return now
//   } catch (err) {
//     console.log(err.stack)
//   }
// }

// const connect = (async () => {
//   const res = await pgConnect()
//   console.log('Connect with the pool:', res.rows[0]['now'])
// })()

// GET all products
const getProducts = async (req, res) => {
  const pool = new Pool(configParams)
  const query = `SELECT * FROM products ORDER BY id ASC`
  try {
    const results = await pool.query(query)
    const data = results.rows
    console.log('data is:', data)
  } catch (err) {
    console.log(err)
  }
}

getProducts()

module.exports = configParams
