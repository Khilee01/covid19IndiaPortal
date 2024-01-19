const express = require('express')
const path = require('path')
const sqlite3 = require('sqlite3')
const {open} = require('sqlite')
const app = express()
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
app.use(express.json())

let db = null
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http:/localhost:3000')
    })
  } catch (e) {
    console.log(`Error Message: ${e.message}`)
    process.exit(1)
  }
}
initializeDBAndServer()

const stateObj = state => {
  return {
    stateId: state.state_id,
    stateName: state.state_name,
    population: state.population,
  }
}

const districtObj = district => {
  return {
    districtId: district.district_id,
    districtName: district.district_name,
    stateId: district.state_id,
    cases: district.cases,
    cured: district.cured,
    active: district.active,
    deaths: district.deaths,
  }
}

const authenticateJwtToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'My_secret_token', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

app.post('/login', async (request, response) => {
  const {username, password} = request.body
  const getuserDetails = `SELECT * FROM  user WHERE username="${username}";`
  const userExist = await db.get(getuserDetails)
  if (userExist === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const passwordMatched = await bcrypt.compare(password, userExist.password)
    if (passwordMatched === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'My_secret_token')
      response.status(200)
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

app.get('/states/', authenticateJwtToken, async (request, response) => {
  const getStates = `SELECT * FROM state`
  const arrayOfStates = await db.all(getStates)
  response.send(arrayOfStates.map(eachState => stateObj(eachState)))
})

app.get('/states/:stateId', authenticateJwtToken, async (request, response) => {
  const {stateId} = request.params
  const getState = `SELECT * FROM state WHERE state_id=${stateId}`
  const state = await db.get(getState)
  response.send(stateObj(state))
})

app.post('/districts/', authenticateJwtToken, async (request, response) => {
  const districtDetails = request.body
  const {districtName, stateId, cases, cured, active, deaths} = districtDetails
  const inserTDistrictQuery = `INSERT INTO district (district_name,state_id,cases,cured,active,deaths) VALUES
  ("${districtName}",${stateId},${cases},${cured},${active},${deaths});`
  await db.run(inserTDistrictQuery)
  response.send('District Successfully Added')
})

app.get(
  '/districts/:districtId/',
  authenticateJwtToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrict = `SELECT * FROM district WHERE district_id=${districtId}`
    const district = await db.get(getDistrict)
    response.send(districtObj(district))
  },
)

app.delete(
  '/districts/:districtId/',
  authenticateJwtToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteQuery = `DELETE FROM district WHERE district_id=${districtId};`
    const deleteQ = await db.run(deleteQuery)
    response.send('District Removed')
  },
)

app.put(
  '/districts/:districtId/',
  authenticateJwtToken,
  async (request, response) => {
    const {districtId} = request.params
    const districtDetails = request.body
    const {districtName, stateId, cases, cured, active, deaths} =
      districtDetails
    const updateQuery = `UPDATE district SET district_name="${districtName}",state_id=${stateId},cases=${cases},cured=${cured},active=${active},deaths=${deaths}
    WHERE district_id=${districtId};`
    const districtUpdate = await db.run(updateQuery)
    response.send('District Details Updated')
  },
)
app.get(
  '/states/:stateId/stats/',
  authenticateJwtToken,
  async (request, response) => {
    const {stateId} = request.params
    const totalQuery = `SELECT SUM(cases) as totalCases,SUM(cured) as totalCured,SUM(active) as totalActive,Sum(deaths) as totalDeaths
    FROM district WHERE state_id=${stateId};`
    const totalQ = await db.get(totalQuery)
    response.send(totalQ)
  },
)

module.exports = app
