import dotenv from 'dotenv'
dotenv.config()
import { Sequelize, DataTypes } from 'sequelize'

// Set up database with Sequelize
import { productModel } from './product.js'
import { clientModel } from './client.js'
import { snapResultModel } from './snapResult.js'

const sequelize = new Sequelize(
  `postgres://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDB}`,
  { dialect: 'postgres', logging: false }
)

// checking connection
sequelize
  .authenticate()
  .then(() => {
    console.log(`Database connected to snapupproducts`)
  })
  .catch((err) => console.log(err))

const db = {}

db.Sequelize = Sequelize
db.sequelize = sequelize
sequelize.sync() //synchorize all models

// connecting to model
// db.clients = require('./client')(sequelize, DataTypes)
const Product = productModel(sequelize, DataTypes)
const Client = clientModel(sequelize, DataTypes)
const snapResult = snapResultModel(sequelize, DataTypes)
// const User = db.users

// module.exports ={ db, Client, User }
// export const Client = client
export { Product, Client, snapResult, sequelize }
