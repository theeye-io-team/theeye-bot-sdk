# TheEye Mail Client

A flexible mail client for TheEye platform that supports both Microsoft Graph API and IMAP protocols for email monitoring and processing capabilities.

## Features

### Microsoft Graph Client
- Microsoft Graph API integration
- Email search and filtering
- Message content retrieval
- Attachment handling
- Message movement between folders
- Permission management

### IMAP Client
- IMAP protocol support
- Email search and filtering
- Message content retrieval
- Attachment handling
- Message movement between folders
- SSL/TLS support

## Configuration

The mail client supports two types of configurations:

### Microsoft Graph Configuration

```javascript
{
  msGraph: {
    auth: {
      tenantId: "your-tenant-id",
      clientId: "your-client-id",
      clientSecret: "your-client-secret",
      user: "target-mailbox@domain.com",
      scopeUrl: "https://graph.microsoft.com/.default",
      options: {
        authorityHost: "https://login.microsoftonline.com/"
      }
    },
    proxy: {
      enabled: false,
      host: "proxy-host",
      port: "proxy-port"
    },
    apiBaseUrl: "https://graph.microsoft.com/v1.0",
    searchUrl: "/users/{userId}/messages",
    encodeSearchParams: false
  },
  moveProcessedMessages: true,
  folders: {
    processed: "Processed" // Target folder for processed messages
  }
}
```

### IMAP Configuration

```javascript
{
  imap: {
    user: "your-email@domain.com",
    password: "your-password",
    host: "imap.domain.com",
    port: 993,
    tls: true,
    tlsOptions: {
      rejectUnauthorized: false
    }
  },
  moveProcessedMessages: true,
  folders: {
    processed: "Processed" // Target folder for processed messages
  }
}
```

## Usage

### Basic Connection

```javascript
const MailBot = require('theeye-bot-sdk/core/mail/client')
const config = require('./config')

// The client will automatically choose between MS Graph and IMAP based on config
const mailBot = new MailBot(config)
await mailBot.connect()
```

### Searching Messages

#### Microsoft Graph Search
```javascript
// Search for messages in the last 7 days
const searchCriteria = {
  customFilter: `receivedDateTime ge ${sinceDate.toISOString()} and receivedDateTime le ${currentDate.toISOString()}`
}

const messages = await mailBot.searchMessages(searchCriteria)
```

#### IMAP Search
```javascript
// Search for messages in the last 7 days
const searchCriteria = {
  since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
}

const messages = await mailBot.searchMessages(searchCriteria)
```

### Available Search Criteria

#### Microsoft Graph
- `from`: Filter by sender email
- `subject`: Filter by subject content
- `body`: Filter by message body content
- `seen`: Filter by read status (boolean)
- `since`: Filter by reception time (ISO date string)
- `customFilter`: Custom OData filter string

#### IMAP
- `from`: Filter by sender email
- `subject`: Filter by subject content
- `body`: Filter by message body content
- `seen`: Filter by read status (boolean)
- `since`: Filter by reception time (Date object)
- `before`: Filter by reception time before date (Date object)

### Message Operations

```javascript
// Get message content
const messageContent = message.data

// Move message to processed folder
await message.move('Processed')

// Download attachments
const attachments = await message.downloadAttachments()
```

## Testing

The module includes test scripts for connection and permissions verification:

### Connection Test
```bash
node test/connection.js
```
Tests basic connectivity and message retrieval.

### Permissions Check (Microsoft Graph only)
```bash
node test/check-permissions.js
```
Verifies granted permissions for the Microsoft Graph application.

## Required Permissions

### Microsoft Graph
The application requires the following Microsoft Graph API permissions:
- Mail.Read or Mail.ReadBasic.All (for reading mail)
- Mail.ReadWrite (for moving messages between folders)

### IMAP
The IMAP client requires:
- Valid IMAP server credentials
- Appropriate folder access permissions
- SSL/TLS support if using secure connection

## Error Handling

The client includes comprehensive error handling for:
- Authentication failures
- Permission issues
- Network problems
- Invalid configurations
- Connection timeouts
- SSL/TLS errors (IMAP)

## Security Considerations

- Client secrets and passwords should be stored securely
- Use environment variables for sensitive data
- Implement proper error handling
- Follow least privilege principle for permissions
- Use SSL/TLS for IMAP connections
- Validate server certificates

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 