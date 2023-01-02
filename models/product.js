// Product model
// set up product schema with Sequelize

export const productModel = (sequelize, DataTypes) => {
  const Product = sequelize.define('product', {
    productname: {
      type: DataTypes.STRING
    },
    description: {
      type: DataTypes.STRING
    },
    featureone: {
      type: DataTypes.STRING
    },
    featuretwo: {
      type: DataTypes.STRING
    },
    featurethree: {
      type: DataTypes.STRING
    },
    originprice: {
      type: DataTypes.INTEGER
    },
    sellprice: {
      type: DataTypes.INTEGER
    },
    img: {
      type: DataTypes.STRING
    },
    quantity: {
      type: DataTypes.INTEGER
    }
  })
  return Product
}
