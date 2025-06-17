const members = require('./gw_members.json')

console.log('"user_id";"org.name";"credential";"creation.date"')
members.forEach(m => {

  let line = ''
  line += `"${m.user.$oid}";`
  line += `"${m.customer_name}";`
  line += `"${m.credential}";`
  line += `"${m.creation_date.$date}"`
  console.log(line)

})

