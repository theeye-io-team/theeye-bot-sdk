const users = require('./gw_users.json')

console.log('"user_id";"username";"email";"creation.date"')
users.forEach(u => {

  let line = ''
  line += `"${u._id.$oid}";`
  line += `"${u.username}";`
  line += `"${u.email}";`
  line += `"${u.creation_date.$date}"`
  console.log(line)

})

