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
  // number of milliseconds to wait before timing out when connecting a new client, default : 0
  idleTimeoutMillis: 60000,
  // number of milliseconds a client must sit idle in the pool,  default is 10000 (10 seconds)
  connectionTimeoutMillis: 60000
}

// 紀錄同一時間發出 request 時間
const requestTime = recordTime()
const requestDate = requestTime[0]

async function productInfo(productName) {
  const client = await new Pool(configParams).connect()
  try {
    const query = `SELECT * FROM products WHERE productname = $1`
    const results = await client.query(query, [productName])

    const product = results.rows[0]

    return product
  } catch (err) {
    console.log('product err:', err)
  } finally {
    client.release()
  }
}

async function getClients(clientName) {
  const client = await new Pool(configParams).connect()
  try {
    const query = `SELECT * FROM clients WHERE name = $1`
    const results = await client.query(query, [clientName])
    const quantity = results.rows[0].quantity // client 索取數量
    const amount = results.rows[0].amount // client 餘額
    return [quantity, amount]
  } catch (err) {
    console.log('client err:', err)
  } finally {
    client.release()
  }
}

async function snapStatusCheck(clientName, productName) {
  const client = await new Pool(configParams).connect()

  try {
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
          .transaction(
            {
              isolationLevel:
                Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
            },
            async (t2) => {
              // 檢查商品資訊
              const product = await productInfo(productName)
              let restStock = product['quantity']
              const price = product['sellprice']
              const snapClient = await getClients(clientName)
              const quantity = snapClient[0] // client 索取數量
              const amount = snapClient[1] // client 餘額

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
            }
          )
          .catch((err) => {
            console.log('Amount or reststock err:', err)
          })
      }
    )
  } catch (err) {
    console.log('transaction err:', err)
  } finally {
    client.release()
    console.log('Transaction is done.')
  }
}

// test case
// async function test() {
//   // 1602, 2
//   await snapStatusCheck('Wilbert Wilkinson', '黃金脆皮雞腿排')
//   // 21, 2
//   await snapStatusCheck('Michele Wehner', '黃金脆皮雞腿排')
//   // 7534, 3
//   await snapStatusCheck('Colleen Zemlak', '黃金脆皮雞腿排')
//   // 7417, 1
//   await snapStatusCheck('Nicolas Bernhard', '黃金脆皮雞腿排')
//   // 1507, 2
//   await snapStatusCheck('Edmund Tillman', '黃金脆皮雞腿排')
// }

export const handler = async (event) => {
  console.log('event:', event)
  console.log('length:', event.Records.length)

  try {
    const result = event.Records[0].body.split('-')

    const clientName = result[0].trim()
    const productName = result[1].trim()

    console.log('clientName:', clientName)
    console.log('productName:', productName)

    await snapStatusCheck(clientName, productName)
  } catch (err) {
    console.log('record err:', err)
  }
}
