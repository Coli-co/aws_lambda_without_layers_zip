//snapResult model
// set up snapResult schema with Sequelize

export const snapResultModel = (sequelize, DataTypes) => {
  const snapResult = sequelize.define('snapresult', {
    name: {
      type: DataTypes.STRING
    },
    requestDate: { type: 'TIMESTAMP' },
    getPreMessage: { type: DataTypes.STRING },
    getResponseTime: { type: DataTypes.STRING },
    snapStatus: { type: DataTypes.STRING },
    dbProcessDate: { type: 'TIMESTAMP' },
    restStock: { type: DataTypes.STRING }
  })
  return snapResult
}
