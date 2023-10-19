const req = require('../../core/api/req')

class TeamsIntegration {
  constructor (webhook_url) {
    this.webhook_url = webhook_url
  }

  async sendMessage (template = null, message) {
    const payload = templates[template](message)

    const options = {
      headers: {
        'Accept': '*/*'
      },
      url: this.webhook_url,
      method: 'POST',
      json: payload
    }

    return req(options)
  }
}

const templates = []
templates[0] = (text) => {
  return {
    "type":"message",
    "attachments":[
      {
        "contentType":"application/vnd.microsoft.card.adaptive",
        "contentUrl":null,
        "content":{
          "$schema":"http://adaptivecards.io/schemas/adaptive-card.json",
          "type":"AdaptiveCard",
          "version":"1.2",
          "body": [
            {
              "type": "TextBlock",
              "text": `${text}`
            }
          ]
        }
      }
    ]
  }
}

templates[1] = () => {
  return {
    "type":"message",
    "attachments": [
      {
        "contentType":"application/vnd.microsoft.card.adaptive",
        "content": {
          "$schema":"http://adaptivecards.io/schemas/adaptive-card.json",
          "type":"AdaptiveCard",
          "version":"1.2",
          "body": [
            {
              "type": "ColumnSet",
              "columns": [
                {
                  "type": "Column",
                  "items": [
                    {
                      "type": "TextBlock",
                      "weight": "bolder",
                      "text": "${name}",
                      "wrap": true
                    }
                  ],
                  "width": "stretch"
                }
              ]
            },
            {
              "type": "TextBlock",
              "size": "Medium",
              "weight": "Bolder",
              "text": "${title}",
              "wrap": true
            },
            {
              "type": "TextBlock",
              "text": "${description}",
              "wrap": true
            },
            {
              "type": "TextBlock",
              "text": "${operationType}",
              "weight": "Bolder",
              "wrap": true
            },
            {
              "type": "TextBlock",
              "text": "${module}",
              "wrap": true
            },
            {
              "type": "TextBlock",
              "text": "${resume}",
              "weight": "Bolder",
              "wrap": true
            },
            {
              "type": "TextBlock",
              "text": "${status}",
              "weight": "Bolder",
              "size": "Large",
              "wrap": true
            },
            //{
            //  "type": "FactSet",
            //  "facts": [
            //    {
            //      "$data": "${properties}",
            //      "title": "${key}:",
            //      "value": "${value}"
            //    }
            //  ]
            //}
          ]
        }
      }
    ]
  }
}

templates[2] = () => {
  return {
    "type":"message",
    "attachments":[
      {
        "contentType":"application/vnd.microsoft.card.adaptive",
        "contentUrl":null,
        "content":{
          "$schema":"http://adaptivecards.io/schemas/adaptive-card.json",
          "msteams": {
            "width": "Full"
          },
          "type":"AdaptiveCard",
          "version":"1.2",
          "body": [{
            "type": "Container",
            "items": [{
              "type": "TextBlock",
              "text": "Digest card",
              "size": "Large",
              "weight": "Bolder"
            }]
          },{
            "type": "Image",
            "url": "https://picsum.photos/200/200?image=110",
            "msTeams": {
              "allowExpand": true
            }
          }]
        }
      }
    ]
  }
}

module.exports = TeamsIntegration

// Esto es una integración de Teams vía connector.
// Los connectores solo soportan el formato de mensaje version 1.2
// https://docs.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/cards-reference#adaptive-card
const main = async (webhook_url, template, message = 'Hola Mundo') => {
  const teams = new TeamsIntegration(webhook_url)
  return teams.sendMessage(template, message)
}

if (require.main === module) {
  const webhook = process.argv[2]
  const template = JSON.parse(process.argv[3])
  const message = process.argv[4]
  main(webhook, template, message)
    .then(resp => {
      console.log('ok')
    }).catch(err => {
      console.error('error')
      console.error(err.message)
    })
}
