import pkg from 'pg'
const { Pool } = pkg
import { sequelize, snapResult, Product } from './models/main.js'
import dotenv from 'dotenv'
dotenv.config()
import { recordTime, diffTime } from './recordTime.js'
import { Sequelize, Transaction } from 'sequelize'

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

// 紀錄同一時間發出 request 時間
const requestTime = recordTime()
const requestDate = requestTime[0]

async function productInfo(productName) {
  const pool = await new Pool(configParams)
  try {
    const query = `SELECT * FROM products WHERE productname = $1`
    const results = await pool.query(query, [productName])

    const product = results.rows[0]

    return product
  } catch (err) {
    console.log('product err:', err)
  }
}

async function getClients(clientName) {
  const pool = await new Pool(configParams)
  try {
    const query = `SELECT * FROM clients WHERE name = $1`
    const results = await pool.query(query, [clientName])
    const quantity = results.rows[0].quantity // client 索取數量
    const amount = results.rows[0].amount // client 餘額
    return [quantity, amount]
  } catch (err) {
    console.log('client err:', err)
  }
}

async function snapStatusCheck(clientName, productName) {
  try {
    const pool = await new Pool(configParams)
    // 把請求時間與初步回應時間記錄於 db
    let responseTime = recordTime()
    let responseDate = responseTime[0]
    let getResponseTime = diffTime(requestDate, responseDate)
    return sequelize.transaction(
      {
        isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
      },
      async (t1) => {
        // const t = await sequelize.transaction()
        await snapResult.create(
          {
            name: clientName,
            requestDate: requestDate,
            getPreMessage: '您的訂單已送出。',
            getResponseTime: `${getResponseTime[0]}:${getResponseTime[1]}`
          },
          {
            returning: true,
            transaction: null
          }
        )

        return sequelize
          .transaction(async (t2) => {
            // 檢查商品資訊
            const product = await productInfo(productName)
            // let restStock = product[0] // 剩餘庫存
            // const price = product[1] //商品價格
            let restStock = product['quantity']
            const price = product['sellprice']
            const client = await getClients(clientName)
            const quantity = client[0] // client 索取數量
            const amount = client[1] // client 餘額

            // check status  transactions
            // 搶到商品
            if (
              Number(quantity) <= Number(restStock) &&
              Number(amount) >= Number(price)
            ) {
              // 紀錄 db 處理訂單時間
              responseTime = recordTime()
              responseDate = responseTime[0]
              restStock -= Number(quantity)

              return Promise.all([
                snapResult.update(
                  {
                    snapStatus: '恭喜搶到商品',
                    dbProcessDate: responseDate,
                    restStock: restStock
                  },
                  {
                    where: { name: clientName },
                    returning: true,
                    transaction: t1
                  }
                ),
                // 更新商品庫存
                Product.update(
                  {
                    quantity: restStock
                  },
                  { where: { productname: productName }, transaction: t1 }
                )
              ]).catch((err) => {
                console.log('Update product or get product err:', err)
              })
            }
            // 餘額不足
            if (Number(amount) < Number(price)) {
              // 紀錄 db 處理訂單時間
              responseTime = recordTime()
              responseDate = responseTime[0]
              await snapResult.update(
                {
                  snapStatus: '餘額不足',
                  dbProcessDate: responseDate,
                  restStock: restStock
                },
                {
                  where: { name: clientName },
                  returning: true,
                  transaction: t2
                }
              )
            }
            // 庫存不足
            if (Number(quantity) > Number(restStock)) {
              // 紀錄 db 處理訂單時間
              responseTime = recordTime()
              responseDate = responseTime[0]
              await snapResult.update(
                {
                  snapStatus: '庫存不足',
                  dbProcessDate: responseDate,
                  restStock: restStock
                },
                {
                  where: { name: clientName },
                  returning: true,
                  transaction: t2
                }
              )
            }
          })
          .catch((err) => {
            console.log('Amount or reststock err:', err)
          })
      }
    )
  } catch (err) {
    console.log('transaction err:', err)
  } finally {
    console.log('Transaction is done.')
  }
}

// test case
async function test() {
  // 9366, 2
  await snapStatusCheck('Darlene Stehr', '全自動咖啡機')
  // 3910, 2
  await snapStatusCheck('Ricardo Purdy', '全自動咖啡機')
  // 8889, 1
  await snapStatusCheck('Tonya Hermann', '全自動咖啡機')
  // // 8954, 2
  await snapStatusCheck('Lee Ward', '全自動咖啡機')
  // // 8783, 3
  await snapStatusCheck('Dr. Craig Mraz', '全自動咖啡機')
  // // 2348, 2
  await snapStatusCheck('Claude Romaguera', '全自動咖啡機')
  // // 8639, 3
  await snapStatusCheck("Isabel O'Reilly", '全自動咖啡機')
}

export const handler = async (event) => {
  //clientName-productName
  const result = event.Records[0].body.split('-')
  const clientName = result[0].trim()
  const productName = result[1].trim()
  console.log('clientName:', clientName)
  console.log('productName:', productName)

  await snapStatusCheck(clientName, productName)
}
