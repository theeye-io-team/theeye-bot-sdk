
## Nodemailer Sender

This is a simple helper to avoid code repeating

## Usage

create .env file in your project. if you are using in theeye , add the environment values to the task or worklow.
there is a dotenv file included as reference

this are the available keys

```
CONFIG_FILE_PATH=""
CONFIG_FILE_ENCRYPTED=""
PRIVATE_KEY_PATH=""
PRIVATE_KEY_PASSPHRASE=""
```

create the config file the sender configuration.

the transport config key is the nodemailer createTransport configuration parameter.

[Check Here!](https://nodemailer.com/#example)


Then include the lib and use.
